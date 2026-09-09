const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const { db, initDatabase } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const { sanitizeMiddleware } = require('./middleware/sanitize');

// Import Routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const roomsRoutes = require('./routes/rooms');
const uploadRoutes = require('./routes/upload');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Import WebSocket Handlers
const { handleRoomMessage, leaveRoom } = require('./services/hangoutService');
const { handleMatchmakerMessage, leaveMatchQueue } = require('./services/matchmakerService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(sanitizeMiddleware);

// Security Headers & Content Security Policy (Zero Trust Architecture)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' ws: wss: http: https:;"
  );
  next();
});

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts', commentsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// SPA Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ---------------- WebSocket Server Setup ----------------
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.user = null;

  // Try extracting token from URL query or headers
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, username, email, avatar_url, role, badge FROM users WHERE id = ?').get(decoded.id);
      if (user) ws.user = user;
    } catch (e) {
      // invalid token, treat as guest
    }
  }

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      // Auth handshake message
      if (message.type === 'AUTH') {
        if (message.token) {
          try {
            const decoded = jwt.verify(message.token, JWT_SECRET);
            const user = db.prepare('SELECT id, username, email, avatar_url, role, badge FROM users WHERE id = ?').get(decoded.id);
            if (user) {
              ws.user = user;
              ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: { id: user.id, username: user.username } }));
            }
          } catch (err) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid token' }));
          }
        }
        return;
      }

      // Route Room events
      if (message.type && (message.type.startsWith('ROOM_') || message.type === 'VOICE_STATE' || message.type === 'WEBRTC_SIGNAL')) {
        handleRoomMessage(ws, message, ws.user);
        return;
      }

      // Route Matchmaker events
      if (message.type && (message.type.startsWith('MATCHMAKER_'))) {
        handleMatchmakerMessage(ws, message, ws.user);
        return;
      }

      // Heartbeat ping/pong
      if (message.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }
    } catch (err) {
      console.error('Malformed WebSocket payload:', err.message);
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    leaveMatchQueue(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
  });
});

// Periodic heartbeat to prevent dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      leaveRoom(ws);
      leaveMatchQueue(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 DRAGME PLATFORM ONLINE at http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Hub active on ws://localhost:${PORT}/ws`);
    console.log(`🌌 Dual-Identity: Public Profile & Anonymous Ghost Mode`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, server, wss };
