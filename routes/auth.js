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
    SELECT * FROM users WHERE username = ? OR email = ?
  `).get(login, login);

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
    email: user.email,
    avatar_url: user.avatar_url,
    banner_url: user.banner_url,
    bio: user.bio,
    role: user.role,
    badge: user.badge,
    karma: user.karma,
    hangout_hours: user.hangout_hours
  };

  return res.json({
    message: 'Welcome back to DragMe!',
    token,
    user: userSafe
  });
});

// Get Current User (Me)
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const stats = {
    post_count: db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(req.user.id).count,
    confession_count: db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_anonymous = 1').get(req.user.id).count,
    likes_received: db.prepare('SELECT COALESCE(SUM(like_count), 0) as total FROM posts WHERE user_id = ?').get(req.user.id).total,
    saved_posts_count: db.prepare('SELECT COUNT(*) as count FROM post_saves WHERE user_id = ?').get(req.user.id).count
  };

  return res.json({
    user: req.user,
    stats
  });
});

// Update Profile
router.put('/profile', requireAuth, (req, res) => {
  const { bio, avatar_url, banner_url } = req.body;

  try {
    db.prepare(`
      UPDATE users 
      SET bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          banner_url = COALESCE(?, banner_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bio !== undefined ? bio.substring(0, 300) : null, avatar_url || null, banner_url || null, req.user.id);

    const updatedUser = db.prepare('SELECT id, username, email, avatar_url, banner_url, bio, role, badge, karma, hangout_hours FROM users WHERE id = ?').get(req.user.id);

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
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
