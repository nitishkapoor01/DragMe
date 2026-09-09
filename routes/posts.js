const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { getFYPFeed, recordPostView } = require('../services/fypService');
const { generateAnonymousPersona, scrubPostPayload } = require('../services/privacyService');

// Get Feed (FYP, Confessions Lounge, Polls, Media, etc.)
router.get('/', optionalAuth, (req, res) => {
  const filterType = req.query.filter || null; // 'all', 'confession', 'poll', 'meme', 'video', 'carousel', 'voice', 'hangout_invite'
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  const excludeSeen = req.query.excludeSeen === 'true';

  const feed = getFYPFeed({
    userId: req.user ? req.user.id : null,
    limit,
    offset,
    filterType,
    excludeSeen
  });

  return res.json({
    posts: feed,
    offset: offset + feed.length,
    hasMore: feed.length === limit
  });
});

// Get Single Post
router.get('/:id', optionalAuth, (req, res) => {
  const postId = req.params.id;
  const currentUserId = req.user ? req.user.id : null;

  const post = db.prepare(`
    SELECT 
      p.*,
      u.username as author_username,
      u.avatar_url as author_avatar,
      u.badge as author_badge,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) as has_liked,
      (SELECT COUNT(*) FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = ?) as has_saved,
      (SELECT option_index FROM poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = ?) as user_vote
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(currentUserId || '', currentUserId || '', currentUserId || '', postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const cleanPost = scrubPostPayload(post, currentUserId);
  return res.json({ post: cleanPost });
});

// Create Post (8 rich formats, Public or Anonymous)
router.post('/', requireAuth, rateLimiter({ windowMs: 60000, max: 20 }), (req, res) => {
  const {
    post_type = 'text',
    title = '',
    content = '',
    media_urls = [],
    poll_options = [],
    extra_data = {},
    is_anonymous = false
  } = req.body;

  const validTypes = ['confession', 'meme', 'video', 'carousel', 'text', 'poll', 'voice', 'hangout_invite'];
  if (!validTypes.includes(post_type)) {
    return res.status(400).json({ error: `Invalid post type. Allowed: ${validTypes.join(', ')}` });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Post content cannot be empty.' });
  }

  if (content.length > 5000) {
    return res.status(400).json({ error: 'Content exceeds 5,000 character maximum.' });
  }

  const postId = `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  let anonAlias = '';
  let anonAvatar = '';

  if (is_anonymous || post_type === 'confession') {
    const persona = generateAnonymousPersona(req.user.id, postId);
    anonAlias = persona.alias;
    anonAvatar = persona.avatar;
  }

  // Handle Poll validation
  let formattedPollOptions = [];
  if (post_type === 'poll') {
    if (!Array.isArray(poll_options) || poll_options.length < 2) {
      return res.status(400).json({ error: 'Polls must contain at least 2 options.' });
    }
    formattedPollOptions = poll_options.slice(0, 6).map((opt, idx) => ({
      id: idx,
      text: typeof opt === 'string' ? opt.trim() : (opt.text || `Option ${idx + 1}`),
      votes: 0
    }));
  }

  try {
    db.prepare(`
      INSERT INTO posts (
        id, user_id, is_anonymous, anonymous_alias, anonymous_avatar,
        post_type, title, content, media_urls, poll_options, extra_data,
        like_count, comment_count, save_count, share_count, view_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0)
    `).run(
      postId,
      req.user.id,
      is_anonymous || post_type === 'confession' ? 1 : 0,
      anonAlias,
      anonAvatar,
      post_type,
      title ? title.trim().substring(0, 150) : '',
      content.trim(),
      JSON.stringify(Array.isArray(media_urls) ? media_urls : []),
      JSON.stringify(formattedPollOptions),
      JSON.stringify(typeof extra_data === 'object' ? extra_data : {})
    );

    // Reward user with karma
    db.prepare('UPDATE users SET karma = karma + 10 WHERE id = ?').run(req.user.id);

    const createdPost = db.prepare(`
      SELECT 
        p.*,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.badge as author_badge,
        0 as has_liked,
        0 as has_saved,
        NULL as user_vote
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(postId);

    const clean = scrubPostPayload(createdPost, req.user.id);

    return res.status(201).json({
      message: 'Post created successfully!',
      post: clean
    });
  } catch (err) {
    console.error('Error creating post:', err);
    return res.status(500).json({ error: 'Failed to create post.' });
  }
});

// Like / Unlike Post (Atomic)
router.post('/:id/like', requireAuth, rateLimiter({ windowMs: 60000, max: 60 }), (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  const post = db.prepare('SELECT id, user_id, is_anonymous FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const existingLike = db.prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);

  let hasLiked = false;
  if (existingLike) {
    // Unlike
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
    db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(postId);
    hasLiked = false;
  } else {
    // Like
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, userId);
    db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(postId);
    hasLiked = true;

    // Send notification to author if not self and not anonymous post author
    if (post.user_id !== userId) {
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare(`
        INSERT INTO notifications (id, user_id, sender_id, sender_name, sender_avatar, type, target_id, title, message)
        VALUES (?, ?, ?, ?, ?, 'like', ?, 'New Reaction!', ?)
      `).run(
        notifId,
        post.user_id,
        userId,
        req.user.username,
        req.user.avatar_url,
        postId,
        `@${req.user.username} liked your post.`
      );
    }
  }

  const updatedCount = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(postId).like_count;

  return res.json({
    liked: hasLiked,
    like_count: updatedCount
  });
});

// Save / Bookmark Post
router.post('/:id/save', requireAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const existingSave = db.prepare('SELECT id FROM post_saves WHERE post_id = ? AND user_id = ?').get(postId, userId);
  let hasSaved = false;

  if (existingSave) {
    db.prepare('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?').run(postId, userId);
    db.prepare('UPDATE posts SET save_count = MAX(0, save_count - 1) WHERE id = ?').run(postId);
    hasSaved = false;
  } else {
    db.prepare('INSERT INTO post_saves (post_id, user_id) VALUES (?, ?)').run(postId, userId);
    db.prepare('UPDATE posts SET save_count = save_count + 1 WHERE id = ?').run(postId);
    hasSaved = true;
  }

  const updatedCount = db.prepare('SELECT save_count FROM posts WHERE id = ?').get(postId).save_count;

  return res.json({
    saved: hasSaved,
    save_count: updatedCount
  });
});

// Share Post
router.post('/:id/share', optionalAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.user ? req.user.id : null;

  try {
    db.prepare('INSERT INTO post_shares (post_id, user_id) VALUES (?, ?)').run(postId, userId);
    db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').run(postId);

    const updatedCount = db.prepare('SELECT share_count FROM posts WHERE id = ?').get(postId).share_count;
    return res.json({ share_count: updatedCount });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record share.' });
  }
});

// Vote in Poll (Strictly single-vote per user)
router.post('/:id/vote', requireAuth, rateLimiter({ windowMs: 60000, max: 20 }), (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { option_index } = req.body;

  if (option_index === undefined || typeof option_index !== 'number') {
    return res.status(400).json({ error: 'Valid option_index is required.' });
  }

  const post = db.prepare('SELECT id, post_type, poll_options FROM posts WHERE id = ?').get(postId);
  if (!post || post.post_type !== 'poll') {
    return res.status(404).json({ error: 'Poll post not found.' });
  }

  // Check if user already voted
  const existingVote = db.prepare('SELECT id FROM poll_votes WHERE post_id = ? AND user_id = ?').get(postId, userId);
  if (existingVote) {
    return res.status(409).json({ error: 'You have already voted on this poll.' });
  }

  const options = JSON.parse(post.poll_options || '[]');
  if (option_index < 0 || option_index >= options.length) {
    return res.status(400).json({ error: 'Option index out of range.' });
  }

  try {
    // Record vote
    db.prepare('INSERT INTO poll_votes (post_id, user_id, option_index) VALUES (?, ?, ?)').run(postId, userId, option_index);

    // Update poll options count in post
    options[option_index].votes = (options[option_index].votes || 0) + 1;
    db.prepare('UPDATE posts SET poll_options = ? WHERE id = ?').run(JSON.stringify(options), postId);

    return res.json({
      message: 'Vote recorded!',
      poll_options: options,
      user_vote: option_index
    });
  } catch (err) {
    console.error('Error voting on poll:', err);
    return res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// Log View / Dwell Time
router.post('/:id/view', optionalAuth, (req, res) => {
  const postId = req.params.id;
  const dwellMs = parseInt(req.body.dwell_ms) || 0;
  const ip = req.ip || req.connection.remoteAddress || '';
  const userId = req.user ? req.user.id : null;

  recordPostView({ postId, userId, ip, dwellMs });
  return res.json({ success: true });
});

// Delete Post (Owner or Admin/Moderator only)
router.delete('/:id', requireAuth, (req, res) => {
  const postId = req.params.id;
  const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  if (post.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'You do not have permission to delete this post.' });
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  return res.json({ message: 'Post deleted successfully.' });
});

module.exports = router;
