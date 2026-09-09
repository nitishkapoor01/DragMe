// DragMe Create Post Modal (Supports all 8 formats, Public vs Ghost mode, media uploads)
const CreatePostModal = {
  currentType: 'text',
  uploadedMediaUrls: [],
  pollOptions: ['', ''],

  init() {
    const triggerBtn = document.getElementById('btn-header-create-post');
    triggerBtn?.addEventListener('click', () => {
      if (!AuthState.currentUser) {
        openAuthModal('login');
        return;
      }
      this.open();
    });
  },

  open() {
    let modal = document.getElementById('create-post-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'create-post-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-window" style="max-width: 620px;">
          <div class="modal-header">
            <h3 style="font-family: var(--font-display); font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
              <span>Publish Drag</span>
              <span id="create-modal-persona-badge" class="ghost-badge-pill" style="font-size: 0.72rem;">Ghost Mode</span>
            </h3>
            <button class="icon-btn" id="create-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- Format Selector Tabs -->
            <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle);">
              <button class="feed-tab active" data-type="text">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Text
              </button>
              <button class="feed-tab" data-type="confession">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Confession
              </button>
              <button class="feed-tab" data-type="meme">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Meme / Image
              </button>
              <button class="feed-tab" data-type="video">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                Video
              </button>
              <button class="feed-tab" data-type="carousel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                Carousel
              </button>
              <button class="feed-tab" data-type="poll">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Poll
              </button>
              <button class="feed-tab" data-type="voice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                Voice
              </button>
              <button class="feed-tab" data-type="hangout_invite">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Hangout
              </button>
            </div>

            <form id="create-post-form" style="display: flex; flex-direction: column; gap: 14px;">
              <!-- Dual-Identity Post Mode Switcher -->
              <div style="background: #0f1017; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 0.84rem; font-weight: 700; color: #fff;" id="post-identity-title">Posting Identity</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);" id="post-identity-subtitle">Choose how your name and avatar appear</div>
                </div>
                <div class="identity-switch-container">
                  <button type="button" class="identity-btn ${AuthState.currentMode === 'public' ? 'active public-mode' : ''}" id="modal-identity-public">
                    Public
                  </button>
                  <button type="button" class="identity-btn ${AuthState.currentMode === 'ghost' ? 'active ghost-mode' : ''}" id="modal-identity-ghost">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 3px;"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>
                    Ghost
                  </button>
                </div>
              </div>

              <input type="text" id="post-input-title" placeholder="Catchy Title (Optional)" style="font-size: 0.95rem; font-weight: 600;">
              
              <textarea id="post-input-content" rows="4" placeholder="What's on your mind? Put it out there..." required style="resize: vertical; font-size: 0.92rem;"></textarea>

              <!-- Dynamic Section for Media / Uploads -->
              <div id="create-post-dynamic-section"></div>

              <!-- Media Uploader Box -->
              <div id="create-post-upload-box" style="display: none;">
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 6px;">Upload Media (Magic-byte verified)</label>
                <input type="file" id="post-file-input" accept="image/*,video/*,audio/*" style="width: 100%;">
                <div id="post-upload-preview" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;"></div>
              </div>

              <div class="modal-footer" style="padding: 10px 0 0 0; margin-top: 6px;">
                <button type="button" class="feed-tab" id="create-modal-cancel">Cancel</button>
                <button type="submit" class="btn-create-post" id="btn-submit-post" style="padding: 8px 22px;">Broadcast</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Handle Tab Selection
      const tabs = modal.querySelectorAll('.feed-tab[data-type]');
      tabs.forEach(t => {
        t.addEventListener('click', () => {
          tabs.forEach(tab => tab.classList.remove('active'));
          t.classList.add('active');
          this.currentType = t.dataset.type;
          this.renderDynamicSection();
        });
      });

      modal.querySelector('#create-modal-close').onclick = () => modal.classList.remove('open');
      modal.querySelector('#create-modal-cancel').onclick = () => modal.classList.remove('open');
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

      // File Uploader Handler
      const fileInput = modal.querySelector('#post-file-input');
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          showToast('Uploading media...', 'normal');
          const res = await API.uploadMedia(file);
          this.uploadedMediaUrls.push(res.url);
          showToast('Media uploaded!', 'success');

          const previewBox = modal.querySelector('#post-upload-preview');
          previewBox.innerHTML += `<div style="font-size: 0.75rem; background: var(--bg-elevated); padding: 4px 8px; border-radius: 4px; color: var(--neon-cyan);">✓ ${file.name}</div>`;
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      // Identity Switcher in Modal
      let postIdentityMode = AuthState.currentMode;
      const pubBtn = modal.querySelector('#modal-identity-public');
      const ghostBtn = modal.querySelector('#modal-identity-ghost');
      const postSub = modal.querySelector('#post-identity-subtitle');

      const updateIdentityUI = () => {
        if (postIdentityMode === 'public') {
          pubBtn.classList.add('active', 'public-mode');
          ghostBtn.classList.remove('active', 'ghost-mode');
          postSub.textContent = `Posting publicly as @${AuthState.currentUser ? AuthState.currentUser.username : 'You'}`;
        } else {
          ghostBtn.classList.add('active', 'ghost-mode');
          pubBtn.classList.remove('active', 'public-mode');
          postSub.textContent = `Posting anonymously as ${AuthState.anonymousPersona?.alias || 'Masked Ghost'}`;
        }
      };

      pubBtn.onclick = () => {
        postIdentityMode = 'public';
        updateIdentityUI();
      };
      ghostBtn.onclick = () => {
        postIdentityMode = 'ghost';
        updateIdentityUI();
      };
      updateIdentityUI();

      // Submit Form
      modal.querySelector('#create-post-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = modal.querySelector('#post-input-title').value.trim();
        const content = modal.querySelector('#post-input-content').value.trim();
        const isAnon = postIdentityMode === 'ghost' || this.currentType === 'confession';

        if (!content) return;

        // Collect poll options if poll
        let pollOpts = [];
        if (this.currentType === 'poll') {
          const optInputs = modal.querySelectorAll('.input-poll-opt');
          optInputs.forEach(inp => {
            if (inp.value.trim()) pollOpts.push(inp.value.trim());
          });
          if (pollOpts.length < 2) {
            showToast('Please provide at least 2 poll options.', 'error');
            return;
          }
        }

        try {
          await API.createPost({
            post_type: this.currentType,
            title,
            content,
            media_urls: this.uploadedMediaUrls,
            poll_options: pollOpts,
            is_anonymous: isAnon
          });

          showToast(isAnon ? '🎭 Anonymous Drag posted!' : '📢 Public Drag posted!', 'success');
          modal.classList.remove('open');
          this.resetForm(modal);
          FeedManager.loadFeed(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Update Persona Badge in header
    const badge = modal.querySelector('#create-modal-persona-badge');
    const anonCheck = modal.querySelector('#post-checkbox-anon');
    if (AuthState.currentMode === 'ghost') {
      badge.textContent = 'Ghost Mode (Masked)';
      badge.className = 'ghost-badge-pill';
      anonCheck.checked = true;
    } else {
      badge.textContent = 'Public Mode';
      badge.className = 'user-badge-pill';
      anonCheck.checked = false;
    }

    this.renderDynamicSection();
    modal.classList.add('open');
  },

  renderDynamicSection() {
    const container = document.getElementById('create-post-dynamic-section');
    const uploadBox = document.getElementById('create-post-upload-box');
    if (!container || !uploadBox) return;

    container.innerHTML = '';
    uploadBox.style.display = 'none';

    if (['meme', 'video', 'carousel', 'voice'].includes(this.currentType)) {
      uploadBox.style.display = 'block';
    }

    if (this.currentType === 'poll') {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary);">Poll Options</label>
          <input type="text" class="input-poll-opt" placeholder="Option 1" required>
          <input type="text" class="input-poll-opt" placeholder="Option 2" required>
          <input type="text" class="input-poll-opt" placeholder="Option 3 (Optional)">
        </div>
      `;
    }
  },

  resetForm(modal) {
    modal.querySelector('#post-input-title').value = '';
    modal.querySelector('#post-input-content').value = '';
    this.uploadedMediaUrls = [];
    modal.querySelector('#post-upload-preview').innerHTML = '';
  }
};
