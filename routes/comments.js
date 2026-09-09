const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { generateAnonymousPersona, scrubCommentPayload } = require('../services/privacyService');

// Get Comments for a Post (Threaded Tree)
router.get('/:postId/comments', optionalAuth, (req, res) => {
  const postId = req.params.postId;
  const currentUserId = req.user ? req.user.id : null;

  const rawComments = db.prepare(`
    SELECT 
      c.*,
      u.username as author_username,
      u.avatar_url as author_avatar,
      u.badge as author_badge,
      (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as has_liked
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(currentUserId || '', postId);

  // Scrub privacy on all comments
  const cleanComments = rawComments.map(c => scrubCommentPayload(c, currentUserId));

  // Build threaded hierarchy
  const commentMap = new Map();
  const roots = [];

  cleanComments.forEach(c => {
    c.replies = [];
    commentMap.set(c.id, c);
  });

  cleanComments.forEach(c => {
    if (c.parent_id && commentMap.has(c.parent_id)) {
      commentMap.get(c.parent_id).replies.push(c);
    } else {
      roots.push(c);
    }
  });

  return res.json({ comments: roots, total: cleanComments.length });
});

// Add Comment or Reply (Public or Anonymous)
router.post('/:postId/comments', requireAuth, rateLimiter({ windowMs: 60000, max: 30 }), (req, res) => {
  const postId = req.params.postId;
  const { content, parent_id = null, is_anonymous = false, media_url = '' } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }

  if (content.length > 1000) {
    return res.status(400).json({ error: 'Comment exceeds 1,000 character maximum.' });
  }

  const post = db.prepare('SELECT id, user_id, is_anonymous FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const commentId = `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  let anonAlias = '';
  let anonAvatar = '';

  if (is_anonymous || post.is_anonymous) {
    const persona = generateAnonymousPersona(req.user.id, commentId);
    anonAlias = persona.alias;
    anonAvatar = persona.avatar;
  }

  try {
    db.prepare(`
      INSERT INTO comments (
        id, post_id, parent_id, user_id, is_anonymous,
        anonymous_alias, anonymous_avatar, content, media_url, like_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      commentId,
      postId,
      parent_id || null,
      req.user.id,
      is_anonymous || post.is_anonymous ? 1 : 0,
      anonAlias,
      anonAvatar,
      content.trim(),
      media_url || ''
    );

    // Increment post comment count
    db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(postId);

    // Notify post author if not self and post is not anonymous
    if (post.user_id !== req.user.id) {
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const senderName = (is_anonymous || post.is_anonymous) ? anonAlias : req.user.username;
      const senderAvatar = (is_anonymous || post.is_anonymous) ? anonAvatar : req.user.avatar_url;

      db.prepare(`
        INSERT INTO notifications (id, user_id, sender_id, sender_name, sender_avatar, type, target_id, title, message)
        VALUES (?, ?, ?, ?, ?, 'comment', ?, 'New Echo Response', ?)
      `).run(
        notifId,
        post.user_id,
        (is_anonymous || post.is_anonymous) ? '' : req.user.id,
        senderName,
        senderAvatar,
        postId,
        `${senderName} commented on your post: "${content.substring(0, 40)}..."`
      );
    }

    const createdComment = db.prepare(`
      SELECT 
        c.*,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.badge as author_badge,
        0 as has_liked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    const clean = scrubCommentPayload(createdComment, req.user.id);
    clean.replies = [];

    return res.status(201).json({
      message: 'Comment posted!',
      comment: clean
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// Like / Unlike Comment
router.post('/comment/:id/like', requireAuth, rateLimiter({ windowMs: 60000, max: 60 }), (req, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;

  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found.' });
  }

  const existingLike = db.prepare('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?').get(commentId, userId);
  let hasLiked = false;

  if (existingLike) {
    db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
    db.prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(commentId);
    hasLiked = false;
  } else {
    db.prepare('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)').run(commentId, userId);
    db.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').run(commentId);
    hasLiked = true;
  }

  const count = db.prepare('SELECT like_count FROM comments WHERE id = ?').get(commentId).like_count;

  return res.json({
    liked: hasLiked,
    like_count: count
  });
});

// Delete Comment
router.delete('/comment/:id', requireAuth, (req, res) => {
  const commentId = req.params.id;
  const comment = db.prepare('SELECT id, user_id, post_id FROM comments WHERE id = ?').get(commentId);

  if (!comment) {
    return res.status(404).json({ error: 'Comment not found.' });
  }

  if (comment.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'You do not have permission to delete this comment.' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  db.prepare('UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(comment.post_id);

  return res.json({ message: 'Comment deleted successfully.' });
});

module.exports = router;
