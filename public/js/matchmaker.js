// DragMe 1-on-1 Instant Random Matchmaker
const MatchmakerManager = {
  sessionId: null,
  partner: null,

  init() {
    document.getElementById('nav-item-random')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openMatchmaker();
    });

    wsClient.on('MATCHMAKER_WAITING', (data) => {
      this.updateStatus('Scanning the DragMe frequency for an open connection...');
    });

    wsClient.on('MATCHMAKER_MATCHED', (data) => {
      this.sessionId = data.sessionId;
      this.partner = data.partner;
      this.renderMatchedScreen();
    });

    wsClient.on('MATCHMAKER_CHAT_MESSAGE', (data) => {
      this.appendMatchMessage(data.message, data.isSelf);
    });

    wsClient.on('MATCHMAKER_PARTNER_DISCONNECTED', () => {
      showToast('Partner disconnected.', 'normal');
      this.updateStatus('Partner left. Click "Next Match" to pair again.');
    });
  },

  openMatchmaker() {
    if (!wsClient.isConnected) wsClient.connect();

    let overlay = document.getElementById('matchmaker-full-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'matchmaker-full-overlay';
      overlay.className = 'matchmaker-full-overlay';
      overlay.innerHTML = `
        <div style="position: absolute; top: 20px; right: 24px;">
          <button class="icon-btn" id="btn-close-matchmaker">✕</button>
        </div>

        <div id="matchmaker-radar-view" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div class="radar-spinner-box">
            <div class="radar-sweep"></div>
            <div style="font-size: 2rem;">⚡</div>
          </div>
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 8px;">1-on-1 Instant Hangout</h2>
          <p id="matchmaker-status-text" style="color: var(--text-secondary); font-size: 0.9rem; max-width: 380px;">Connecting to matchmaking frequency...</p>
        </div>

        <div id="matchmaker-chat-view" style="display: none; width: 100%; max-width: 620px;">
          <div class="matched-chat-box">
            <div style="padding: 14px 20px; background: #181924; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="header-streak-badge" style="background: rgba(163, 230, 53, 0.15); color: var(--dragme-lime);">CONNECTED</span>
                <span id="match-partner-name" style="font-weight: 700; color: #fff;">Stranger</span>
              </div>
              <button class="btn-discuss-pill" id="btn-match-next" style="background: var(--neon-magenta); color: #fff; border: none;">Next Match →</button>
            </div>
            <div class="room-chat-stream" id="match-chat-stream" style="flex: 1; padding: 16px; background: #101118;"></div>
            <div style="padding: 12px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px; background: #181924;">
              <input type="text" id="match-chat-input" placeholder="Say hello to your match..." style="flex: 1;">
              <button class="btn-discuss-pill" id="btn-match-send" style="padding: 0 18px;">Send</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#btn-close-matchmaker').onclick = () => this.close();
      overlay.querySelector('#btn-match-next').onclick = () => this.nextMatch();

      const chatInp = overlay.querySelector('#match-chat-input');
      const sendChat = () => {
        const text = chatInp.value.trim();
        if (!text) return;
        wsClient.send({ type: 'MATCHMAKER_CHAT', payload: { text } });
        chatInp.value = '';
      };
      overlay.querySelector('#btn-match-send').onclick = sendChat;
      chatInp.onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
    }

    overlay.style.display = 'flex';
    this.startQueue();
  },

  startQueue() {
    document.getElementById('matchmaker-radar-view').style.display = 'flex';
    document.getElementById('matchmaker-chat-view').style.display = 'none';

    const isAnon = AuthState.currentMode === 'ghost';
    wsClient.send({
      type: 'MATCHMAKER_JOIN',
      payload: { isAnonymous: isAnon }
    });
  },

  renderMatchedScreen() {
    document.getElementById('matchmaker-radar-view').style.display = 'none';
    const chatView = document.getElementById('matchmaker-chat-view');
    chatView.style.display = 'block';

    document.getElementById('match-partner-name').textContent = this.partner?.username || 'Stranger';
    const stream = document.getElementById('match-chat-stream');
    stream.innerHTML = `<div style="text-align: center; color: var(--dragme-lime); font-size: 0.8rem; margin-bottom: 12px;">🎉 Paired with ${this.partner?.username}. Say hi!</div>`;
  },

  appendMatchMessage(msg, isSelf) {
    const stream = document.getElementById('match-chat-stream');
    if (!stream) return;

    const div = document.createElement('div');
    div.style.cssText = `margin-bottom: 8px; display: flex; flex-direction: column; align-items: ${isSelf ? 'flex-end' : 'flex-start'};`;
    div.innerHTML = `
      <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 2px;">${msg.sender}</div>
      <div style="background: ${isSelf ? 'var(--dragme-lime)' : '#1f2130'}; color: ${isSelf ? '#000' : '#fff'}; padding: 8px 14px; border-radius: 12px; max-width: 80%; font-size: 0.85rem; font-weight: 500;">
        ${msg.text}
      </div>
    `;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
  },

  nextMatch() {
    this.startQueue();
  },

  updateStatus(text) {
    const el = document.getElementById('matchmaker-status-text');
    if (el) el.textContent = text;
  },

  close() {
    wsClient.send({ type: 'MATCHMAKER_LEAVE' });
    const overlay = document.getElementById('matchmaker-full-overlay');
    if (overlay) overlay.style.display = 'none';
  }
};
