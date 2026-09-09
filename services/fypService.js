const { db } = require('../db');
const { scrubPostPayload } = require('./privacyService');

/**
 * Calculate dynamic FYP feed for a user (or guest)
 */
function getFYPFeed({ userId = null, limit = 20, offset = 0, filterType = null, excludeSeen = false } = {}) {
  let query = `
    SELECT 
      p.*,
      u.username as author_username,
      u.avatar_url as author_avatar,
      u.badge as author_badge,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) as has_liked,
      (SELECT COUNT(*) FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = ?) as has_saved,
      (SELECT option_index FROM poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = ?) as user_vote,
      (SELECT COALESCE(AVG(dwell_ms), 0) FROM user_views uv WHERE uv.post_id = p.id) as avg_dwell_ms
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
  `;

  const params = [userId || '', userId || '', userId || ''];
  const whereClauses = [];

  if (filterType === 'confession') {
    whereClauses.push('p.is_anonymous = 1');
  } else if (filterType === 'my_posts' && userId) {
    whereClauses.push('p.user_id = ? AND p.is_anonymous = 0');
    params.push(userId);
  } else if (filterType === 'saved' && userId) {
    whereClauses.push('p.id IN (SELECT post_id FROM post_saves WHERE user_id = ?)');
    params.push(userId);
  } else if (filterType === 'media') {
    whereClauses.push("p.media_urls != '[]' AND p.media_urls IS NOT NULL AND p.media_urls != ''");
  } else if (filterType && filterType !== 'all' && filterType !== 'trending' && filterType !== 'new') {
    whereClauses.push('p.post_type = ?');
    params.push(filterType);
  }

  if (excludeSeen && userId) {
    whereClauses.push(`p.id NOT IN (
      SELECT post_id FROM user_views 
      WHERE user_id = ? AND dwell_ms > 3000 AND viewed_at > datetime('now', '-1 day')
    )`);
    params.push(userId);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  const rawPosts = db.prepare(query).all(...params);

  // Score posts dynamically using engagement velocity, dwell time & decay
  const scoredPosts = rawPosts.map(post => {
    const createdAtTime = new Date(post.created_at).getTime();
    const nowTime = Date.now();
    const hoursOld = Math.max(0.05, (nowTime - createdAtTime) / (1000 * 60 * 60));

    const likesWeight = (post.like_count || 0) * 2.0;
    const commentsWeight = (post.comment_count || 0) * 3.5;
    const sharesWeight = (post.share_count || 0) * 4.0;
    const savesWeight = (post.save_count || 0) * 2.5;
    const baseEngagement = likesWeight + commentsWeight + sharesWeight + savesWeight + 5.0; // base floor

    // Dwell time boost: if average dwell > 5 seconds, boost score
    const dwellBoost = 1 + Math.min(2.0, (post.avg_dwell_ms || 0) / 10000);

    // Format freshness/novelty boost (confessions and polls get high interaction velocity)
    let formatBoost = 1.0;
    if (post.post_type === 'confession') formatBoost = 1.25;
    if (post.post_type === 'poll') formatBoost = 1.2;
    if (post.post_type === 'hangout_invite') formatBoost = 1.3;

    // Time decay formula
    const velocityScore = (baseEngagement * dwellBoost * formatBoost) / Math.pow(hoursOld + 1.2, 1.35);

    return {
      post,
      score: velocityScore
    };
  });

  // Sort descending by score
  scoredPosts.sort((a, b) => b.score - a.score);

  // Slice pagination
  const paginated = scoredPosts.slice(offset, offset + limit);

  // Scrub privacy payload for zero-leak delivery
  return paginated.map(item => scrubPostPayload(item.post, userId));
}

/**
 * Record dwell time and view event for algorithm tuning
 */
function recordPostView({ postId, userId = null, ip = '', dwellMs = 0 }) {
  if (!postId) return;

  const crypto = require('crypto');
  const ipHash = crypto.createHash('sha256').update(ip + '_salt_dragme').digest('hex').substring(0, 16);

  try {
    // Insert view record
    const insert = db.prepare(`
      INSERT INTO user_views (post_id, user_id, ip_hash, dwell_ms)
      VALUES (?, ?, ?, ?)
    `);
    insert.run(postId, userId || '', ipHash, Math.min(dwellMs, 300000)); // cap at 5 min max

    // Atomically increment post view count
    db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(postId);
  } catch (err) {
    console.error('Error recording post view:', err.message);
  }
}

module.exports = {
  getFYPFeed,
  recordPostView
};
