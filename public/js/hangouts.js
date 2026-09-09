// DragMe Live Voice & Chat Hangout Rooms Manager
const HangoutManager = {
  currentRoom: null,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  handRaised: false,

  init() {
    this.setupListeners();
  },

  setupListeners() {
    // Left sidebar create room button
    document.getElementById('btn-sidebar-create-room')?.addEventListener('click', () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      this.openCreateRoomModal();
    });

    // Active room items in sidebar
    document.querySelectorAll('.active-room-item').forEach(item => {
      item.addEventListener('click', () => {
        const topic = item.dataset.roomTopic;
        this.joinTopicRoom(topic);
      });
    });

    // WebSocket Room Event Handlers
    wsClient.on('ROOM_JOINED', (data) => {
      this.renderInRoomStage(data);
    });

    wsClient.on('PARTICIPANT_JOINED', (data) => {
      this.addParticipantToStage(data.participant);
      showToast(`${data.participant.username} joined the lounge`, 'normal');
    });

    wsClient.on('PARTICIPANT_LEFT', (data) => {
      this.removeParticipantFromStage(data.participantId);
    });

    wsClient.on('ROOM_CHAT_MESSAGE', (data) => {
      this.appendRoomChatMessage(data.message);
    });

    wsClient.on('VOICE_STATE_UPDATED', (data) => {
      this.updateParticipantVoiceHalo(data.participantId, data.voiceState);
    });

    wsClient.on('ROOM_KICKED', (data) => {
      showToast('You have been removed from the room.', 'error');
      this.leaveRoom();
    });
  },

  async joinTopicRoom(topic) {
    try {
      const data = await API.getRooms();
      const match = data.rooms.find(r => r.topic.toLowerCase().includes(topic.toLowerCase())) || data.rooms[0];
      if (match) {
        this.joinRoom(match.id);
      } else {
        showToast('No active room found for this topic right now.', 'normal');
      }
    } catch (err) {
      showToast('Failed to connect to room.', 'error');
    }
  },

  joinRoom(roomId) {
    if (!wsClient.isConnected) wsClient.connect();

    this.currentRoom = { id: roomId };
    const isAnon = AuthState.currentMode === 'ghost';

    wsClient.send({
      type: 'ROOM_JOIN',
      roomId,
      payload: { isAnonymous: isAnon }
    });
  },

  leaveRoom() {
    wsClient.send({ type: 'ROOM_LEAVE' });
    this.currentRoom = null;
    const stage = document.getElementById('hangout-room-overlay');
    if (stage) stage.remove();
  },

  renderInRoomStage(data) {
    let overlay = document.getElementById('hangout-room-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'hangout-room-overlay';
    overlay.className = 'live-hangout-overlay';
    overlay.innerHTML = `
      <div class="hangout-room-navbar">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="header-streak-badge" style="background: rgba(163, 230, 53, 0.15); color: var(--dragme-lime);">● LIVE</div>
          <h3 style="font-family: var(--font-display); font-size: 1.1rem; color: #fff;">${data.roomInfo.title}</h3>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">(${data.roomInfo.topic})</span>
        </div>
        <button class="icon-btn" id="btn-hangout-close" title="Minimize / Leave">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="hangout-room-layout">
        <!-- Voice Participants Grid -->
        <div class="voice-participants-stage" id="hangout-participants-grid">
          ${data.participants.map(p => this.renderParticipantCard(p)).join('')}
        </div>

        <!-- Room Live Chat Sidebar -->
        <div class="room-chat-sidebar">
          <div style="padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem; font-weight: 700;">
            Lounge Chat Stream
          </div>
          <div class="room-chat-stream" id="hangout-chat-stream">
            ${(data.recentMessages || []).map(m => this.renderChatMessageHTML(m)).join('')}
          </div>
          <div style="padding: 12px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px;">
            <input type="text" id="hangout-chat-input" placeholder="Say something in room..." style="flex: 1; font-size: 0.85rem;">
            <button class="btn-discuss-pill" id="btn-send-room-chat" style="padding: 0 16px;">Send</button>
          </div>
        </div>
      </div>

      <!-- Bottom Audio Controls Bar -->
      <div class="hangout-bottom-bar">
        <button class="hangout-ctrl-btn ${this.isMuted ? 'active' : ''}" id="btn-toggle-mic" title="Mute/Unmute Mic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>

        <button class="hangout-ctrl-btn ${this.isDeafened ? 'active' : ''}" id="btn-toggle-deafen" title="Deafen Audio">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        </button>

        <button class="hangout-ctrl-btn ${this.handRaised ? 'active' : ''}" id="btn-toggle-hand" title="Raise Hand">
          ✋
        </button>

        <button class="hangout-ctrl-btn leave-btn" id="btn-leave-room-bottom" title="Leave Lounge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Attach In-Room UI events
    overlay.querySelector('#btn-hangout-close').onclick = () => this.leaveRoom();
    overlay.querySelector('#btn-leave-room-bottom').onclick = () => this.leaveRoom();

    // Toggle Mic
    const micBtn = overlay.querySelector('#btn-toggle-mic');
    micBtn.onclick = () => {
      this.isMuted = !this.isMuted;
      micBtn.classList.toggle('active', this.isMuted);
      wsClient.send({ type: 'VOICE_STATE', payload: { isMuted: this.isMuted, isSpeaking: !this.isMuted } });
      showToast(this.isMuted ? 'Mic Muted' : 'Mic Unmuted');
    };

    // Toggle Deafen
    const deafenBtn = overlay.querySelector('#btn-toggle-deafen');
    deafenBtn.onclick = () => {
      this.isDeafened = !this.isDeafened;
      deafenBtn.classList.toggle('active', this.isDeafened);
      wsClient.send({ type: 'VOICE_STATE', payload: { isDeafened: this.isDeafened } });
    };

    // Toggle Hand
    const handBtn = overlay.querySelector('#btn-toggle-hand');
    handBtn.onclick = () => {
      this.handRaised = !this.handRaised;
      handBtn.classList.toggle('active', this.handRaised);
      wsClient.send({ type: 'VOICE_STATE', payload: { handRaised: this.handRaised } });
    };

    // Chat submit
    const chatInput = overlay.querySelector('#hangout-chat-input');
    const sendBtn = overlay.querySelector('#btn-send-room-chat');
    const sendChat = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      wsClient.send({ type: 'ROOM_CHAT', payload: { text } });
      chatInput.value = '';
    };
    sendBtn.onclick = sendChat;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
  },

  renderParticipantCard(p) {
    const avatarUrl = p.isAnonymous 
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.username)}&backgroundColor=1a0815`
      : (p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100');

    return `
      <div class="participant-avatar-card" id="part-${p.participantId}">
        <div class="speaking-halo ${p.isSpeaking ? 'speaking' : ''}" id="halo-${p.participantId}">
          <img src="${avatarUrl}" alt="${p.username}">
        </div>
        <div style="text-align: center;">
          <h4 style="font-size: 0.84rem; font-weight: 700; color: #fff;">${p.username}</h4>
          <span style="font-size: 0.68rem; color: var(--dragme-lime);">${p.role || 'Member'}</span>
        </div>
      </div>
    `;
  },

  addParticipantToStage(p) {
    const grid = document.getElementById('hangout-participants-grid');
    if (!grid) return;
    const existing = document.getElementById(`part-${p.participantId}`);
    if (!existing) {
      grid.insertAdjacentHTML('beforeend', this.renderParticipantCard(p));
    }
  },

  removeParticipantFromStage(participantId) {
    const card = document.getElementById(`part-${participantId}`);
    if (card) card.remove();
  },

  updateParticipantVoiceHalo(participantId, state) {
    const halo = document.getElementById(`halo-${participantId}`);
    if (halo) {
      halo.classList.toggle('speaking', Boolean(state.isSpeaking && !state.isMuted));
    }
  },

  appendRoomChatMessage(msg) {
    const stream = document.getElementById('hangout-chat-stream');
    if (!stream) return;

    stream.insertAdjacentHTML('beforeend', this.renderChatMessageHTML(msg));
    stream.scrollTop = stream.scrollHeight;
  },

  renderChatMessageHTML(msg) {
    return `
      <div style="font-size: 0.82rem; line-height: 1.4;">
        <span style="font-weight: 700; color: ${msg.isAnonymous ? 'var(--neon-magenta)' : 'var(--dragme-lime)'};">${msg.sender}:</span>
        <span style="color: var(--text-primary);">${msg.text}</span>
      </div>
    `;
  },

  openCreateRoomModal() {
    let modal = document.getElementById('create-room-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'create-room-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-window">
          <div class="modal-header">
            <h3 style="font-family: var(--font-display); font-size: 1.15rem;">Host a Live Hangout Room</h3>
            <button class="icon-btn" id="create-room-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <form id="create-room-form" style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="font-size: 0.82rem; color: var(--text-secondary);">Room Title</label>
                <input type="text" id="input-room-title" placeholder="e.g. Midnight Code & Synthwave Lounge" required style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 0.82rem; color: var(--text-secondary);">Topic / Category</label>
                <input type="text" id="input-room-topic" placeholder="e.g. Design & UI/UX, Gaming, Philosophy" required style="width: 100%;">
              </div>
              <button type="submit" class="btn-create-post" style="margin-top: 10px; width: 100%; justify-content: center;">Start Live Stage</button>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#create-room-modal-close').onclick = () => modal.classList.remove('open');
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

      modal.querySelector('#create-room-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = modal.querySelector('#input-room-title').value.trim();
        const topic = modal.querySelector('#input-room-topic').value.trim();

        try {
          const res = await API.createRoom({ title, topic });
          showToast('Live hangout opened!', 'success');
          modal.classList.remove('open');
          this.joinRoom(res.roomId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    modal.classList.add('open');
  }
};
