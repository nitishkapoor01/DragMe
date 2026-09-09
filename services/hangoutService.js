const { db } = require('../db');
const { generateAnonymousPersona } = require('./privacyService');

// In-memory active room state: roomId -> { participants: Map(ws -> participantInfo), messages: [] }
const activeRooms = new Map();

function initHangoutService(wss) {
  // Handled inside connection dispatcher
}

function handleRoomMessage(ws, message, user) {
  const { type, roomId, payload } = message;

  switch (type) {
    case 'ROOM_JOIN': {
      if (!roomId) return;
      joinRoom(ws, roomId, user, payload?.isAnonymous);
      break;
    }

    case 'ROOM_LEAVE': {
      leaveRoom(ws);
      break;
    }

    case 'ROOM_CHAT': {
      if (!ws.currentRoomId) return;
      broadcastRoomChat(ws, payload?.text);
      break;
    }

    case 'VOICE_STATE': {
      // payload: { isSpeaking, isMuted, isDeafened }
      if (!ws.currentRoomId) return;
      updateVoiceState(ws, payload);
      break;
    }

    case 'ROOM_MODERATE': {
      // payload: { action: 'mute'|'kick'|'promote', targetParticipantId }
      handleRoomModeration(ws, payload);
      break;
    }

    case 'WEBRTC_SIGNAL': {
      // WebRTC audio mesh signaling
      forwardWebRTCSignal(ws, payload);
      break;
    }

    default:
      break;
  }
}

function joinRoom(ws, roomId, user, isAnonymous = false) {
  leaveRoom(ws); // Leave any prior room

  let roomRecord = db.prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(roomId);
  if (!roomRecord) {
    ws.send(JSON.stringify({ type: 'ROOM_ERROR', error: 'Room not found or closed.' }));
    return;
  }

  let roomState = activeRooms.get(roomId);
  if (!roomState) {
    roomState = {
      id: roomId,
      title: roomRecord.title,
      topic: roomRecord.topic,
      ownerId: roomRecord.owner_id,
      participants: new Map(),
      messages: []
    };
    activeRooms.set(roomId, roomState);
  }

  // Determine user role in room
  let role = 'member';
  if (user && user.id === roomRecord.owner_id) {
    role = 'owner';
  } else if (user && (user.role === 'admin' || user.role === 'moderator')) {
    role = 'moderator';
  }

  // Create participant identity
  let participantInfo;
  const participantId = `part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (isAnonymous || !user) {
    const anon = generateAnonymousPersona(user ? user.id : participantId, roomId);
    participantInfo = {
      participantId,
      username: anon.alias,
      avatarUrl: anon.avatar,
      isAnonymous: true,
      role: 'member',
      isSpeaking: false,
      isMuted: false,
      isDeafened: false,
      handRaised: false,
      userId: null
    };
  } else {
    participantInfo = {
      participantId,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      badge: user.badge,
      isAnonymous: false,
      role,
      isSpeaking: false,
      isMuted: false,
      isDeafened: false,
      handRaised: false
    };
  }

  ws.currentRoomId = roomId;
  ws.participantInfo = participantInfo;
  roomState.participants.set(ws, participantInfo);

  // Update DB count
  db.prepare('UPDATE rooms SET participant_count = ? WHERE id = ?').run(roomState.participants.size, roomId);

  // Send current room state to joined participant
  const participantsList = Array.from(roomState.participants.values());
  ws.send(JSON.stringify({
    type: 'ROOM_JOINED',
    roomId,
    roomInfo: {
      id: roomId,
      title: roomState.title,
      topic: roomState.topic,
      role: participantInfo.role,
      myParticipantId: participantInfo.participantId
    },
    participants: participantsList,
    recentMessages: roomState.messages.slice(-30)
  }));

  // Broadcast to all other participants in the room
  broadcastToRoom(roomId, {
    type: 'PARTICIPANT_JOINED',
    participant: participantInfo,
    participantCount: roomState.participants.size
  }, ws);
}

function leaveRoom(ws) {
  const roomId = ws.currentRoomId;
  if (!roomId) return;

  const roomState = activeRooms.get(roomId);
  if (roomState && ws.participantInfo) {
    roomState.participants.delete(ws);
    const count = roomState.participants.size;

    // Update DB
    db.prepare('UPDATE rooms SET participant_count = ? WHERE id = ?').run(count, roomId);

    broadcastToRoom(roomId, {
      type: 'PARTICIPANT_LEFT',
      participantId: ws.participantInfo.participantId,
      participantCount: count
    });

    if (count === 0) {
      activeRooms.delete(roomId);
    }
  }

  ws.currentRoomId = null;
  ws.participantInfo = null;
}

function broadcastRoomChat(ws, text) {
  const roomId = ws.currentRoomId;
  const roomState = activeRooms.get(roomId);
  if (!roomState || !ws.participantInfo || !text || text.trim().length === 0) return;

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender: ws.participantInfo.username,
    avatarUrl: ws.participantInfo.avatarUrl,
    isAnonymous: ws.participantInfo.isAnonymous,
    role: ws.participantInfo.role,
    text: text.trim().substring(0, 500),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  roomState.messages.push(message);
  if (roomState.messages.length > 100) roomState.messages.shift();

  broadcastToRoom(roomId, {
    type: 'ROOM_CHAT_MESSAGE',
    message
  });
}

function updateVoiceState(ws, payload) {
  const roomId = ws.currentRoomId;
  const roomState = activeRooms.get(roomId);
  if (!roomState || !ws.participantInfo) return;

  if (payload.isSpeaking !== undefined) ws.participantInfo.isSpeaking = Boolean(payload.isSpeaking);
  if (payload.isMuted !== undefined) ws.participantInfo.isMuted = Boolean(payload.isMuted);
  if (payload.isDeafened !== undefined) ws.participantInfo.isDeafened = Boolean(payload.isDeafened);
  if (payload.handRaised !== undefined) ws.participantInfo.handRaised = Boolean(payload.handRaised);

  broadcastToRoom(roomId, {
    type: 'VOICE_STATE_UPDATED',
    participantId: ws.participantInfo.participantId,
    voiceState: {
      isSpeaking: ws.participantInfo.isSpeaking,
      isMuted: ws.participantInfo.isMuted,
      isDeafened: ws.participantInfo.isDeafened,
      handRaised: ws.participantInfo.handRaised
    }
  });
}

function handleRoomModeration(ws, payload) {
  const roomId = ws.currentRoomId;
  const roomState = activeRooms.get(roomId);
  if (!roomState || !ws.participantInfo) return;

  // Verify moderator or owner privilege
  if (ws.participantInfo.role !== 'owner' && ws.participantInfo.role !== 'moderator') {
    ws.send(JSON.stringify({ type: 'ROOM_ERROR', error: 'Insufficient permissions for moderation.' }));
    return;
  }

  const { action, targetParticipantId } = payload;
  let targetWs = null;

  for (const [socket, pInfo] of roomState.participants.entries()) {
    if (pInfo.participantId === targetParticipantId) {
      targetWs = socket;
      break;
    }
  }

  if (!targetWs) return;

  if (action === 'kick') {
    targetWs.send(JSON.stringify({ type: 'ROOM_KICKED', reason: 'Removed by room moderator.' }));
    leaveRoom(targetWs);
  } else if (action === 'mute') {
    targetWs.participantInfo.isMuted = true;
    updateVoiceState(targetWs, { isMuted: true, isSpeaking: false });
  } else if (action === 'promote' && ws.participantInfo.role === 'owner') {
    targetWs.participantInfo.role = 'moderator';
    broadcastToRoom(roomId, {
      type: 'PARTICIPANT_ROLE_UPDATED',
      participantId: targetParticipantId,
      role: 'moderator'
    });
  }
}

function forwardWebRTCSignal(ws, payload) {
  const roomId = ws.currentRoomId;
  const roomState = activeRooms.get(roomId);
  if (!roomState || !ws.participantInfo || !payload.targetParticipantId) return;

  for (const [socket, pInfo] of roomState.participants.entries()) {
    if (pInfo.participantId === payload.targetParticipantId && socket.readyState === 1) {
      socket.send(JSON.stringify({
        type: 'WEBRTC_SIGNAL',
        fromParticipantId: ws.participantInfo.participantId,
        signal: payload.signal
      }));
      break;
    }
  }
}

function broadcastToRoom(roomId, messageObj, excludeWs = null) {
  const roomState = activeRooms.get(roomId);
  if (!roomState) return;

  const data = JSON.stringify(messageObj);
  for (const [socket] of roomState.participants.entries()) {
    if (socket !== excludeWs && socket.readyState === 1) {
      socket.send(data);
    }
  }
}

module.exports = {
  activeRooms,
  handleRoomMessage,
  leaveRoom
};
