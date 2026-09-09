const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

// List Active Live Hangout Rooms
router.get('/', optionalAuth, (req, res) => {
  const rooms = db.prepare(`
    SELECT 
      r.*,
      u.username as owner_username,
      u.avatar_url as owner_avatar,
      u.badge as owner_badge
    FROM rooms r
    LEFT JOIN users u ON r.owner_id = u.id
    WHERE r.is_active = 1
    ORDER BY r.participant_count DESC, r.created_at DESC
  `).all();

  const formatted = rooms.map(r => ({
    id: r.id,
    title: r.title,
    topic: r.topic,
    description: r.description,
    is_private: Boolean(r.is_private),
    max_participants: r.max_participants,
    participant_count: r.participant_count,
    tags: JSON.parse(r.tags || '[]'),
    created_at: r.created_at,
    owner: {
      id: r.owner_id,
      username: r.owner_username || 'Host',
      avatar_url: r.owner_avatar || '',
      badge: r.owner_badge || 'Room Host'
    }
  }));

  return res.json({ rooms: formatted });
});

// Create Live Hangout Room
router.post('/', requireAuth, rateLimiter({ windowMs: 60000, max: 10 }), (req, res) => {
  const {
    title,
    topic = 'General Hangout',
    description = '',
    is_private = false,
    passcode = '',
    max_participants = 25,
    tags = []
  } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Room title is required.' });
  }

  const roomId = `room_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const cleanTags = Array.isArray(tags) ? tags.slice(0, 5) : ['Hangout'];

  try {
    db.prepare(`
      INSERT INTO rooms (
        id, title, topic, description, owner_id, is_private, passcode,
        max_participants, is_active, participant_count, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
    `).run(
      roomId,
      title.trim().substring(0, 80),
      topic.trim().substring(0, 50),
      description.trim().substring(0, 300),
      req.user.id,
      is_private ? 1 : 0,
      passcode || '',
      Math.min(100, Math.max(2, parseInt(max_participants) || 25)),
      JSON.stringify(cleanTags)
    );

    // Also add room creator as owner member in room_members
    db.prepare(`
      INSERT INTO room_members (room_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(roomId, req.user.id);

    return res.status(201).json({
      message: 'Hangout room created!',
      roomId,
      title: title.trim()
    });
  } catch (err) {
    console.error('Error creating room:', err);
    return res.status(500).json({ error: 'Failed to create room.' });
  }
});

// Get Single Room Details
router.get('/:id', optionalAuth, (req, res) => {
  const roomId = req.params.id;
  const room = db.prepare(`
    SELECT 
      r.*,
      u.username as owner_username,
      u.avatar_url as owner_avatar,
      u.badge as owner_badge
    FROM rooms r
    LEFT JOIN users u ON r.owner_id = u.id
    WHERE r.id = ? AND r.is_active = 1
  `).get(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Hangout room not found or closed.' });
  }

  return res.json({
    room: {
      id: room.id,
      title: room.title,
      topic: room.topic,
      description: room.description,
      is_private: Boolean(room.is_private),
      max_participants: room.max_participants,
      participant_count: room.participant_count,
      tags: JSON.parse(room.tags || '[]'),
      created_at: room.created_at,
      owner: {
        id: room.owner_id,
        username: room.owner_username || 'Host',
        avatar_url: room.owner_avatar || '',
        badge: room.owner_badge || 'Host'
      }
    }
  });
});

// Get Rooms hosted by User
router.get('/user/:userId', optionalAuth, (req, res) => {
  const userId = req.params.userId;
  const rooms = db.prepare(`
    SELECT 
      r.*,
      u.username as owner_username,
      u.avatar_url as owner_avatar,
      u.badge as owner_badge
    FROM rooms r
    LEFT JOIN users u ON r.owner_id = u.id
    WHERE r.owner_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);

  const formatted = rooms.map(r => ({
    id: r.id,
    title: r.title,
    topic: r.topic,
    description: r.description,
    is_private: Boolean(r.is_private),
    is_active: Boolean(r.is_active),
    max_participants: r.max_participants,
    participant_count: r.participant_count,
    tags: JSON.parse(r.tags || '[]'),
    created_at: r.created_at,
    owner: {
      id: r.owner_id,
      username: r.owner_username || 'Host',
      avatar_url: r.owner_avatar || '',
      badge: r.owner_badge || 'Host'
    }
  }));

  return res.json({ rooms: formatted });
});

// Close / Delete Room (Owner or Moderator/Admin)
router.delete('/:id', requireAuth, (req, res) => {
  const roomId = req.params.id;
  const room = db.prepare('SELECT owner_id FROM rooms WHERE id = ?').get(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (room.owner_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Only the room host or a moderator can close this room.' });
  }

  db.prepare('UPDATE rooms SET is_active = 0 WHERE id = ?').run(roomId);
  return res.json({ message: 'Room closed successfully.' });
});

module.exports = router;

