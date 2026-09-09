const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get Notifications for Current User
router.get('/', requireAuth, (req, res) => {
  const notifs = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 40
  `).all(req.user.id);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).count;

  return res.json({ notifications: notifs, unreadCount });
});

// Mark Notifications as Read
router.post('/read', requireAuth, (req, res) => {
  const { notification_id } = req.body;

  if (notification_id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notification_id, req.user.id);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  }

  return res.json({ success: true });
});

module.exports = router;
