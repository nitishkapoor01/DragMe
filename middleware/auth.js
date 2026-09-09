const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dragme_super_secret_cyber_jwt_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT id, username, display_name, email, avatar_url, banner_url, bio, location,
             role, badge, custom_badge, verified, karma, reputation_score, cooked_ratio,
             judgment_accuracy, rank_title, roast_level, hangout_hours, created_at, is_banned
      FROM users WHERE id = ?
    `).get(decoded.id);
    if (user && !user.is_banned) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in to perform this action.' });
    }
    if (req.user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended for violating community guidelines.' });
    }
    next();
  });
}

function requireModerator(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Moderator or Admin privileges required.' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    next();
  });
}

module.exports = {
  JWT_SECRET,
  generateToken,
  optionalAuth,
  requireAuth,
  requireModerator,
  requireAdmin
};
