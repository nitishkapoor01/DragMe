const { generateAnonymousPersona } = require('./privacyService');

// Waiting queue: array of { ws, user, isAnonymous, queuedAt }
const waitingQueue = [];
// Active matched sessions: sessionId -> { userA: { ws, info }, userB: { ws, info } }
const activeSessions = new Map();

function handleMatchmakerMessage(ws, message, user) {
  const { type, payload } = message;

  switch (type) {
    case 'MATCHMAKER_JOIN': {
      joinMatchQueue(ws, user, payload?.isAnonymous);
      break;
    }

    case 'MATCHMAKER_LEAVE': {
      leaveMatchQueue(ws);
      break;
    }

    case 'MATCHMAKER_CHAT': {
      sendMatchChat(ws, payload?.text);
      break;
    }

    case 'MATCHMAKER_TYPING': {
      sendMatchTyping(ws, payload?.isTyping);
      break;
    }

    case 'MATCHMAKER_NEXT': {
      skipToNextMatch(ws, user, payload?.isAnonymous);
      break;
    }

    case 'MATCHMAKER_SIGNAL': {
      forwardMatchSignal(ws, payload?.signal);
      break;
    }

    default:
      break;
  }
}

function joinMatchQueue(ws, user, isAnonymous = true) {
  leaveMatchQueue(ws);

  // Generate identity info
  let info;
  const participantId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  if (isAnonymous || !user) {
    const anon = generateAnonymousPersona(user ? user.id : participantId, 'matchmaker');
    info = {
      participantId,
      username: anon.alias,
      avatarUrl: anon.avatar,
      isAnonymous: true,
      badge: 'Ghost Match'
    };
  } else {
    info = {
      participantId,
      username: user.username,
      avatarUrl: user.avatar_url,
      isAnonymous: false,
      badge: user.badge
    };
  }

  ws.matchInfo = info;
  ws.matchIsAnon = isAnonymous;

  // Check if someone is already in queue
  if (waitingQueue.length > 0) {
    const partner = waitingQueue.shift();
    if (partner.ws.readyState === 1 && partner.ws !== ws) {
      pairUsers(partner, { ws, user, isAnonymous, info });
      return;
    }
  }

  // Otherwise add to queue
  waitingQueue.push({ ws, user, isAnonymous, info, queuedAt: Date.now() });
  ws.send(JSON.stringify({
    type: 'MATCHMAKER_WAITING',
    message: 'Scanning the DragMe frequency for an open connection...'
  }));
}

function pairUsers(itemA, itemB) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const session = {
    sessionId,
    userA: itemA,
    userB: itemB
  };

  activeSessions.set(sessionId, session);

  itemA.ws.matchSessionId = sessionId;
  itemB.ws.matchSessionId = sessionId;

  // Notify User A
  itemA.ws.send(JSON.stringify({
    type: 'MATCHMAKER_MATCHED',
    sessionId,
    partner: itemB.info
  }));

  // Notify User B
  itemB.ws.send(JSON.stringify({
    type: 'MATCHMAKER_MATCHED',
    sessionId,
    partner: itemA.info
  }));
}

function leaveMatchQueue(ws) {
  // Remove from waiting queue
  const idx = waitingQueue.findIndex(item => item.ws === ws);
  if (idx !== -1) {
    waitingQueue.splice(idx, 1);
  }

  // End active session if any
  const sessionId = ws.matchSessionId;
  if (sessionId && activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    const partnerWs = session.userA.ws === ws ? session.userB.ws : session.userA.ws;

    if (partnerWs && partnerWs.readyState === 1) {
      partnerWs.send(JSON.stringify({
        type: 'MATCHMAKER_PARTNER_DISCONNECTED',
        message: 'Your hangout partner has disconnected.'
      }));
      partnerWs.matchSessionId = null;
    }

    activeSessions.delete(sessionId);
  }

  ws.matchSessionId = null;
}

function skipToNextMatch(ws, user, isAnonymous) {
  leaveMatchQueue(ws);
  joinMatchQueue(ws, user, isAnonymous);
}

function sendMatchChat(ws, text) {
  const sessionId = ws.matchSessionId;
  if (!sessionId || !activeSessions.has(sessionId) || !text || text.trim().length === 0) return;

  const session = activeSessions.get(sessionId);
  const isA = session.userA.ws === ws;
  const senderInfo = isA ? session.userA.info : session.userB.info;
  const partnerWs = isA ? session.userB.ws : session.userA.ws;

  const chatMsg = {
    id: `mmsg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    sender: senderInfo.username,
    avatarUrl: senderInfo.avatarUrl,
    isAnonymous: senderInfo.isAnonymous,
    text: text.trim().substring(0, 500),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  ws.send(JSON.stringify({ type: 'MATCHMAKER_CHAT_MESSAGE', message: chatMsg, isSelf: true }));

  if (partnerWs && partnerWs.readyState === 1) {
    partnerWs.send(JSON.stringify({ type: 'MATCHMAKER_CHAT_MESSAGE', message: chatMsg, isSelf: false }));
  }
}

function sendMatchTyping(ws, isTyping) {
  const sessionId = ws.matchSessionId;
  if (!sessionId || !activeSessions.has(sessionId)) return;

  const session = activeSessions.get(sessionId);
  const partnerWs = session.userA.ws === ws ? session.userB.ws : session.userA.ws;

  if (partnerWs && partnerWs.readyState === 1) {
    partnerWs.send(JSON.stringify({ type: 'MATCHMAKER_PARTNER_TYPING', isTyping: Boolean(isTyping) }));
  }
}

function forwardMatchSignal(ws, signal) {
  const sessionId = ws.matchSessionId;
  if (!sessionId || !activeSessions.has(sessionId)) return;

  const session = activeSessions.get(sessionId);
  const partnerWs = session.userA.ws === ws ? session.userB.ws : session.userA.ws;

  if (partnerWs && partnerWs.readyState === 1) {
    partnerWs.send(JSON.stringify({ type: 'MATCHMAKER_SIGNAL', signal }));
  }
}

module.exports = {
  handleMatchmakerMessage,
  leaveMatchQueue
};
