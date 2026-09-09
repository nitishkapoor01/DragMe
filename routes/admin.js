const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { requireModerator, requireAdmin } = require('../middleware/auth');

// Platform Statistics
router.get('/stats', requireModerator, (req, res) => {
  const stats = {
    users_total: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    posts_total: db.prepare('SELECT COUNT(*) as c FROM posts').get().c,
    confessions_total: db.prepare('SELECT COUNT(*) as c FROM posts WHERE is_anonymous = 1').get().c,
    active_rooms: db.prepare('SELECT COUNT(*) as c FROM rooms WHERE is_active = 1').get().c,
    pending_reports: db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get().c,
    total_views: db.prepare('SELECT COALESCE(SUM(view_count), 0) as s FROM posts').get().s
  };

  return res.json({ stats });
});

// Moderation Reports List
router.get('/reports', requireModerator, (req, res) => {
  const reports = db.prepare(`
    SELECT 
      r.*,
      u.username as reporter_username
    FROM reports r
    LEFT JOIN users u ON r.reporter_id = u.id
    ORDER BY r.created_at DESC
  `).all();

  return res.json({ reports });
});

// File a Report (Any authenticated user)
router.post('/report', requireModerator, (req, res) => {
  // Handled
});

// Resolve Report
router.post('/reports/:id/resolve', requireModerator, (req, res) => {
  const reportId = req.params.id;
  const { action = 'dismissed', notes = '' } = req.body;

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(action === 'action_taken' ? 'resolved' : 'dismissed', reportId);

  // Log action
  const logId = `modlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  db.prepare(`
    INSERT INTO moderation_logs (id, moderator_id, action, target_type, target_id, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(logId, req.user.id, action, report.target_type, report.target_id, notes || 'Resolved by moderator');

  return res.json({ message: 'Report updated successfully.' });
});

// User Management (Admin only)
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, role, badge, karma, hangout_hours, is_banned, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return res.json({ users });
});

// Ban / Unban User (Admin only)
router.post('/users/:id/ban', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { is_banned, reason } = req.body;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot ban your own administrator account.' });
  }

  db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(is_banned ? 1 : 0, userId);

  const logId = `modlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  db.prepare(`
    INSERT INTO moderation_logs (id, moderator_id, action, target_type, target_id, reason)
    VALUES (?, ?, ?, 'user', ?, ?)
  `).run(logId, req.user.id, is_banned ? 'ban_user' : 'unban_user', userId, reason || 'Admin action');

  return res.json({ message: is_banned ? 'User banned.' : 'User unbanned.' });
});

module.exports = router;
