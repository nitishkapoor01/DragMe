const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { generateToken, requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { generateAnonymousPersona } = require('../services/privacyService');

// Registration
router.post('/register', rateLimiter({ windowMs: 60000, max: 10 }), (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  if (username.length < 3 || username.length > 25) {
    return res.status(400).json({ error: 'Username must be between 3 and 25 characters.' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check uniqueness
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email is already registered.' });
  }

  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const defaultAvatar = `https://images.unsplash.com/photo-${1534528741775 + (Math.floor(Math.random() * 1000))}?w=150&auto=format&fit=crop&q=80`;

  try {
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, avatar_url, role, badge, karma, hangout_hours)
      VALUES (?, ?, ?, ?, ?, 'user', 'Neon Pioneer', 100, 0)
    `).run(userId, username, email, passwordHash, defaultAvatar);

    const user = db.prepare('SELECT id, username, email, avatar_url, banner_url, bio, role, badge, karma, hangout_hours FROM users WHERE id = ?').get(userId);
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Account created successfully!',
      token,
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login
router.post('/login', rateLimiter({ windowMs: 60000, max: 15 }), (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Please provide your username/email and password.' });
  }

  const user = db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR (LOWER(?) = 'dragmemaster' AND LOWER(username) = 'dragme')
  `).get(login, login, login);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  if (user.is_banned) {
    return res.status(403).json({ error: 'Your account has been suspended for community guideline violations.' });
  }

  const token = generateToken(user);
  const userSafe = {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    banner_url: user.banner_url,
    bio: user.bio,
    location: user.location || 'Everywhere',
    role: user.role,
    badge: user.badge,
    custom_badge: user.custom_badge || '👑 FOUNDER',
    verified: user.verified || 0,
    karma: user.karma,
    reputation_score: user.reputation_score || 0,
    cooked_ratio: user.cooked_ratio || 0,
    judgment_accuracy: user.judgment_accuracy || 92,
    rank_title: user.rank_title || '#143 Senior Roaster',
    roast_level: user.roast_level || 'NOVICE ROASTER',
    hangout_hours: user.hangout_hours
  };

  return res.json({
    message: 'Welcome back to DragMe!',
    token,
    user: userSafe
  });
});

// Helper function to build user stats
function getUserStats(userId) {
  const postCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_anonymous = 0').get(userId).count;
  const confessionCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_anonymous = 1').get(userId).count;
  const reactionsReceived = db.prepare('SELECT COALESCE(SUM(like_count), 0) as total FROM posts WHERE user_id = ?').get(userId).total;
  const savesCount = db.prepare('SELECT COUNT(*) as count FROM post_saves WHERE user_id = ?').get(userId).count;
  const followersCount = db.prepare('SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?').get(userId).count;
  const followingCount = db.prepare('SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?').get(userId).count;
  const roomsCount = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE owner_id = ?').get(userId).count;

  return {
    post_count: postCount,
    confession_count: confessionCount,
    followers_count: followersCount,
    following_count: followingCount,
    rooms_count: roomsCount,
    reactions_count: reactionsReceived,
    saved_posts_count: savesCount
  };
}

// Get Current User (Me)
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const stats = getUserStats(req.user.id);

  return res.json({
    user: req.user,
    stats
  });
});

// Get Public User Profile by Username
router.get('/profile/:username', optionalAuth, (req, res) => {
  const username = req.params.username;
  const targetUser = db.prepare(`
    SELECT id, username, display_name, avatar_url, banner_url, bio, location,
           role, badge, custom_badge, verified, karma, reputation_score, cooked_ratio,
           judgment_accuracy, rank_title, roast_level, hangout_hours, created_at
    FROM users 
    WHERE (LOWER(username) = LOWER(?) OR (LOWER(?) = 'dragme' AND (LOWER(username) = 'dragmemaster' OR role = 'admin')) OR (LOWER(?) = 'dragmemaster' AND LOWER(username) = 'dragme')) AND is_banned = 0
  `).get(username, username, username);

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const stats = getUserStats(targetUser.id);
  
  let isFollowing = false;
  let isSelf = false;
  if (req.user) {
    isSelf = req.user.id === targetUser.id;
    if (!isSelf) {
      const follow = db.prepare('SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetUser.id);
      isFollowing = !!follow;
    }
  }

  return res.json({
    user: targetUser,
    stats,
    is_following: isFollowing,
    is_self: isSelf
  });
});

// Update Profile
router.put('/profile', requireAuth, (req, res) => {
  const { display_name, bio, location, avatar_url, banner_url } = req.body;

  try {
    db.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name),
          bio = COALESCE(?, bio),
          location = COALESCE(?, location),
          avatar_url = COALESCE(?, avatar_url),
          banner_url = COALESCE(?, banner_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      display_name !== undefined ? display_name.trim().substring(0, 50) : null,
      bio !== undefined ? bio.trim().substring(0, 500) : null,
      location !== undefined ? location.trim().substring(0, 50) : null,
      avatar_url || null,
      banner_url || null,
      req.user.id
    );

    const updatedUser = db.prepare(`
      SELECT id, username, display_name, email, avatar_url, banner_url, bio, location,
             role, badge, custom_badge, verified, karma, reputation_score, cooked_ratio,
             judgment_accuracy, rank_title, roast_level, hangout_hours, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    const stats = getUserStats(req.user.id);

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
      stats
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Follow / Unfollow Routes
router.post('/follow/:userId', requireAuth, (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User to follow not found.' });
  }

  try {
    db.prepare(`
      INSERT OR IGNORE INTO user_follows (follower_id, following_id)
      VALUES (?, ?)
    `).run(req.user.id, targetId);

    const stats = getUserStats(targetId);

    return res.json({
      message: `You are now following @${target.username}`,
      is_following: true,
      followers_count: stats.followers_count
    });
  } catch (err) {
    console.error('Follow error:', err);
    return res.status(500).json({ error: 'Failed to follow user.' });
  }
});

router.delete('/follow/:userId', requireAuth, (req, res) => {
  const targetId = req.params.userId;

  try {
    db.prepare(`
      DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).run(req.user.id, targetId);

    const stats = getUserStats(targetId);

    return res.json({
      message: 'Unfollowed successfully',
      is_following: false,
      followers_count: stats.followers_count
    });
  } catch (err) {
    console.error('Unfollow error:', err);
    return res.status(500).json({ error: 'Failed to unfollow user.' });
  }
});

// Get Anonymous Persona for current user / session
router.get('/anonymous-persona', optionalAuth, (req, res) => {
  const seed = req.query.seed || 'feed';
  const userId = req.user ? req.user.id : (req.ip || 'guest_seed');
  const persona = generateAnonymousPersona(userId, seed);

  return res.json({ persona });
});

module.exports = router;

