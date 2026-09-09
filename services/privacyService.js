const crypto = require('crypto');

const GHOST_ADJECTIVES = [
  'Phantom', 'Cyber', 'Neon', 'Shadow', 'Spectral', 'Quantum', 'Obsidian',
  'Astral', 'Glitch', 'Vortex', 'Echo', 'Cryptic', 'Solar', 'Lunar', 'Void'
];

const GHOST_NOUNS = [
  'Whisper', 'Spectre', 'Ghost', 'Kitsune', 'Nomad', 'Enigma', 'Oracle',
  'Drifter', 'Phantom', 'Cipher', 'Valkyrie', 'Warden', 'Raven', 'Pulse', 'Mirage'
];

const GHOST_AVATARS = [
  'neon_ghost_purple',
  'neon_ghost_cyan',
  'neon_ghost_pink',
  'neon_ghost_emerald',
  'neon_ghost_amber',
  'neon_ghost_crimson'
];

/**
 * Generate a consistent, aesthetic anonymous alias and avatar mask
 */
function generateAnonymousPersona(userId, seedStr = '') {
  const hash = crypto.createHash('sha256').update(`${userId}:${seedStr}:dragme_privacy_salt_2026`).digest('hex');
  const num = parseInt(hash.substring(0, 4), 16) % 1000;
  const adjIdx = parseInt(hash.substring(4, 6), 16) % GHOST_ADJECTIVES.length;
  const nounIdx = parseInt(hash.substring(6, 8), 16) % GHOST_NOUNS.length;
  const avatarIdx = parseInt(hash.substring(8, 10), 16) % GHOST_AVATARS.length;

  const alias = `${GHOST_ADJECTIVES[adjIdx]} ${GHOST_NOUNS[nounIdx]} #${String(num).padStart(3, '0')}`;
  const avatar = GHOST_AVATARS[avatarIdx];

  return { alias, avatar };
}

/**
 * Scans and scrubs post objects before sending to client, ensuring 100% zero identity leak
 */
function scrubPostPayload(post, currentUserId = null) {
  if (!post) return null;

  const isAuthor = Boolean(currentUserId && post.user_id === currentUserId);
  const isAnon = Boolean(post.is_anonymous);

  const clean = {
    id: post.id,
    post_type: post.post_type,
    title: post.title || '',
    content: post.content,
    media_urls: typeof post.media_urls === 'string' ? JSON.parse(post.media_urls || '[]') : (post.media_urls || []),
    poll_options: typeof post.poll_options === 'string' ? JSON.parse(post.poll_options || '[]') : (post.poll_options || []),
    extra_data: typeof post.extra_data === 'string' ? JSON.parse(post.extra_data || '{}') : (post.extra_data || {}),
    like_count: post.like_count || 0,
    comment_count: post.comment_count || 0,
    save_count: post.save_count || 0,
    share_count: post.share_count || 0,
    view_count: post.view_count || 0,
    created_at: post.created_at,
    is_anonymous: isAnon,
    is_author: isAuthor,
    has_liked: Boolean(post.has_liked),
    has_saved: Boolean(post.has_saved),
    user_vote: post.user_vote !== undefined ? post.user_vote : null
  };

  if (isAnon) {
    // Zero-leak anonymous identity
    clean.author = {
      username: post.anonymous_alias || 'Anonymous Ghost',
      avatar_url: post.anonymous_avatar || 'neon_ghost_purple',
      badge: 'Ghost Persona',
      is_anonymous: true
    };
    clean.user_id = null; // NEVER expose real user ID
  } else {
    clean.author = {
      id: post.author_id || post.user_id,
      username: post.author_username || post.username || 'DragMe Explorer',
      avatar_url: post.author_avatar || post.avatar_url || '',
      badge: post.author_badge || post.badge || 'Neon Pioneer',
      is_anonymous: false
    };
    clean.user_id = post.user_id;
  }

  return clean;
}

/**
 * Scrubs comment objects ensuring anonymous replies never expose real user ID
 */
function scrubCommentPayload(comment, currentUserId = null) {
  if (!comment) return null;

  const isAuthor = Boolean(currentUserId && comment.user_id === currentUserId);
  const isAnon = Boolean(comment.is_anonymous);

  const clean = {
    id: comment.id,
    post_id: comment.post_id,
    parent_id: comment.parent_id,
    content: comment.content,
    media_url: comment.media_url || '',
    like_count: comment.like_count || 0,
    created_at: comment.created_at,
    is_anonymous: isAnon,
    is_author: isAuthor,
    has_liked: Boolean(comment.has_liked)
  };

  if (isAnon) {
    clean.author = {
      username: comment.anonymous_alias || 'Masked Whisperer',
      avatar_url: comment.anonymous_avatar || 'neon_ghost_cyan',
      badge: 'Ghost Commenter',
      is_anonymous: true
    };
    clean.user_id = null;
  } else {
    clean.author = {
      id: comment.author_id || comment.user_id,
      username: comment.author_username || comment.username || 'Explorer',
      avatar_url: comment.author_avatar || comment.avatar_url || '',
      badge: comment.author_badge || comment.badge || 'Neon Pioneer',
      is_anonymous: false
    };
    clean.user_id = comment.user_id;
  }

  return clean;
}

module.exports = {
  generateAnonymousPersona,
  scrubPostPayload,
  scrubCommentPayload
};
