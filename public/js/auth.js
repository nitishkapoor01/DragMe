// DragMe State & Auth Management (Login, Sign Up, Guest Explorer & Dual-Identity)
const AuthState = {
  currentUser: null,
  isGuest: false,
  currentMode: 'public', // 'public' or 'ghost'
  anonymousPersona: null,
  listeners: [],

  async init() {
    this.currentMode = localStorage.getItem('dragme_identity_mode') || 'public';
    const guestFlag = localStorage.getItem('dragme_guest_mode');
    this.isGuest = guestFlag === 'true';

    try {
      const token = API.getToken();
      if (token) {
        const data = await API.getMe();
        this.currentUser = data.user;
        this.isGuest = false;
        localStorage.removeItem('dragme_guest_mode');
      } else {
        this.currentUser = null;
      }
    } catch (err) {
      this.currentUser = null;
    }

    await this.fetchAnonymousPersona();
    this.updateUI();
    this.notify();
  },

  async fetchAnonymousPersona() {
    try {
      const seed = this.currentUser ? this.currentUser.id : (this.isGuest ? 'guest_seed' : 'dragme');
      const res = await API.getAnonymousPersona(seed);
      this.anonymousPersona = res.persona;
    } catch (e) {
      this.anonymousPersona = { alias: 'Phantom Ghost #714', avatar: 'neon_ghost_purple' };
    }
  },

  setMode(mode) {
    if (mode !== 'public' && mode !== 'ghost') return;
    this.currentMode = mode;
    localStorage.setItem('dragme_identity_mode', mode);
    this.updateUI();
    this.notify();

    showToast(
      mode === 'ghost' ? '🌌 Switched to Ghost Mode (Zero identity leak active)' : '⚡ Switched to Public Profile Mode',
      'success'
    );
  },

  toggleMode() {
    this.setMode(this.currentMode === 'public' ? 'ghost' : 'public');
  },

  setGuestMode() {
    this.currentUser = null;
    this.isGuest = true;
    localStorage.setItem('dragme_guest_mode', 'true');
    API.setToken(null);
    this.updateUI();
    this.notify();
    showToast('👤 Exploring as Guest (View-Only Mode)', 'normal');
  },

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this);
  },

  notify() {
    this.listeners.forEach(cb => cb(this));
  },

  updateUI() {
    const publicBtn = document.getElementById('btn-mode-public');
    const ghostBtn = document.getElementById('btn-mode-ghost');
    const ghostSidebarCard = document.getElementById('sidebar-ghost-card');
    const ghostAliasText = document.getElementById('sidebar-ghost-alias');

    if (publicBtn && ghostBtn) {
      if (this.currentMode === 'public') {
        publicBtn.classList.add('active');
        ghostBtn.classList.remove('active');
      } else {
        ghostBtn.classList.add('active');
        publicBtn.classList.remove('active');
      }
    }

    if (ghostSidebarCard && ghostAliasText && this.anonymousPersona) {
      ghostAliasText.textContent = this.anonymousPersona.alias;
    }

    // Update Nav profile button or guest buttons
    const authActionsContainer = document.getElementById('nav-auth-actions');
    if (authActionsContainer) {
      if (this.currentUser) {
        authActionsContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="user-avatar-btn" id="nav-profile-btn" title="View Profile (@${this.currentUser.username})">
              <img src="${this.currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" alt="Avatar">
              <span style="font-size: 0.82rem; font-weight: 700; color: #fff; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">@${this.currentUser.username}</span>
            </button>
            <button class="icon-btn" id="nav-logout-btn" title="Logout" style="width: 32px; height: 32px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        `;

        document.getElementById('nav-profile-btn')?.addEventListener('click', () => {
          AppRouter.navigate('profile');
        });
        document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
          API.setToken(null);
          AuthState.currentUser = null;
          AuthState.isGuest = true;
          showToast('Logged out. Switched to Guest Explore mode.');
          AuthState.updateUI();
          AuthState.notify();
          FeedManager.loadFeed(true);
        });
      } else {
        // Guest or Logged-out state
        authActionsContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="guest-pill-badge" id="btn-guest-status" title="You are currently in Guest View-Only mode">
              <span class="guest-dot">●</span> Guest
            </button>
            <button class="btn-discuss-pill" id="btn-open-login" style="padding: 5px 14px; font-size: 0.78rem;">
              Login
            </button>
            <button class="header-action-circle plus-btn" id="btn-open-register" title="Sign Up" style="width: 32px; height: 32px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; padding: 0 12px; width: auto;">
              Sign Up
            </button>
          </div>
        `;

        document.getElementById('btn-open-login')?.addEventListener('click', () => openAuthModal('login'));
        document.getElementById('btn-open-register')?.addEventListener('click', () => openAuthModal('register'));
        document.getElementById('btn-guest-status')?.addEventListener('click', () => openAuthModal('guest'));
      }
    }
  }
};

// Sleek Auth Hub Modal: Login, Sign Up & Guest Explorer Management
function openAuthModal(initialTab = 'login') {
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-window" style="max-width: 520px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-subtle); padding: 18px 24px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="logo-crown" style="font-size: 1.3rem;">👑</span>
            <h3 id="auth-modal-title" style="font-family: var(--font-display); font-size: 1.2rem; color: #fff;">DragMe Access Hub</h3>
          </div>
          <button class="icon-btn" id="auth-modal-close">✕</button>
        </div>

        <div class="modal-body" style="padding: 22px 24px;">
          <!-- 3 Auth Mode Tabs -->
          <div style="display: flex; gap: 6px; background: #0c0d12; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 4px; margin-bottom: 20px;">
            <button class="feed-tab active" id="auth-tab-login" style="flex: 1; text-align: center; border-radius: 8px; font-size: 0.84rem;">Sign In</button>
            <button class="feed-tab" id="auth-tab-register" style="flex: 1; text-align: center; border-radius: 8px; font-size: 0.84rem;">Create ID</button>
            <button class="feed-tab" id="auth-tab-guest" style="flex: 1; text-align: center; border-radius: 8px; font-size: 0.84rem;">👤 Guest</button>
          </div>
          
          <!-- FORM CONTAINER -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Registration-Only Fields -->
            <div id="auth-reg-fields" style="display: none; flex-direction: column; gap: 12px;">
              <div>
                <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Username</label>
                <input type="text" id="auth-input-username" placeholder="e.g. NeonValkyrie_99" autocomplete="username" style="width: 100%;">
              </div>
            </div>

            <!-- Login / Email Field -->
            <div id="auth-login-fields" style="display: flex; flex-direction: column; gap: 4px;">
              <label id="auth-login-label" style="font-size: 0.8rem; color: var(--text-secondary);">Email or Username</label>
              <input type="text" id="auth-input-login" placeholder="you@domain.com or username" required autocomplete="email" style="width: 100%;">
            </div>

            <!-- Password Field -->
            <div id="auth-password-fields" style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.8rem; color: var(--text-secondary);">Password</label>
              <input type="password" id="auth-input-password" placeholder="••••••••" required autocomplete="current-password" style="width: 100%;">
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn-create-post" id="auth-submit-btn" style="margin-top: 8px; width: 100%; justify-content: center; padding: 11px; font-size: 0.92rem;">
              Enter DragMe
            </button>
          </form>

          <!-- GUEST VIEW SECTION -->
          <div id="auth-guest-section" style="display: none; flex-direction: column; gap: 14px; text-align: center; padding: 10px 0;">
            <div style="font-size: 2.2rem; margin-bottom: 4px;">👤</div>
            <h4 style="color: #fff; font-size: 1.1rem; font-weight: 700;">Explore as Guest</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
              You can explore the full FYP feed, read confessions, browse live hangout rooms, and check trending topics with <strong>zero sign-up required</strong>.
            </p>
            <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.25); border-radius: 10px; padding: 12px; font-size: 0.8rem; color: var(--dragme-lime); text-align: left;">
              ℹ️ <strong>View-Only Mode</strong>: When you want to post, like, vote on polls, or reply with an anonymous persona, you can log in with a single click.
            </div>
            <button type="button" class="btn-create-room-sidebar" id="btn-confirm-guest" style="margin-top: 6px; padding: 11px; font-size: 0.9rem;">
              Continue as Guest Explorer →
            </button>
          </div>

          <!-- Quick Test Accounts Switcher -->
          <div id="auth-demo-accounts" style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; text-align: center;">
              ⚡ Quick Demo 1-Click Login
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              <button type="button" class="btn-discuss-pill demo-login-btn" data-user="TesterSupreme" data-pass="Password123!" style="text-align: center; font-size: 0.72rem; padding: 6px 4px; background: rgba(163, 230, 53, 0.15); color: var(--dragme-lime);">
                🧪 Tester
              </button>
              <button type="button" class="btn-discuss-pill demo-login-btn" data-user="DragMeMaster" data-pass="Password123!" style="text-align: center; font-size: 0.72rem; padding: 6px 4px;">
                👑 Admin
              </button>
              <button type="button" class="btn-discuss-pill demo-login-btn" data-user="AuraGamer" data-pass="Password123!" style="text-align: center; font-size: 0.72rem; padding: 6px 4px;">
                ⚡ Creator
              </button>
              <button type="button" class="btn-discuss-pill demo-login-btn" data-user="ValkyrieGuard" data-pass="Password123!" style="text-align: center; font-size: 0.72rem; padding: 6px 4px;">
                🛡️ Mod
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let currentTab = 'login';

    const setTab = (tab) => {
      currentTab = tab;
      const title = document.getElementById('auth-modal-title');
      const tabLogin = document.getElementById('auth-tab-login');
      const tabRegister = document.getElementById('auth-tab-register');
      const tabGuest = document.getElementById('auth-tab-guest');
      const form = document.getElementById('auth-form');
      const guestSection = document.getElementById('auth-guest-section');
      const regFields = document.getElementById('auth-reg-fields');
      const loginLabel = document.getElementById('auth-login-label');
      const submitBtn = document.getElementById('auth-submit-btn');
      const demoAccounts = document.getElementById('auth-demo-accounts');

      tabLogin.classList.remove('active');
      tabRegister.classList.remove('active');
      tabGuest.classList.remove('active');

      if (tab === 'login') {
        title.textContent = 'Welcome Back to DragMe';
        tabLogin.classList.add('active');
        form.style.display = 'flex';
        guestSection.style.display = 'none';
        regFields.style.display = 'none';
        loginLabel.textContent = 'Email or Username';
        submitBtn.textContent = 'Sign In';
        demoAccounts.style.display = 'block';
      } else if (tab === 'register') {
        title.textContent = 'Create DragMe Identity';
        tabRegister.classList.add('active');
        form.style.display = 'flex';
        guestSection.style.display = 'none';
        regFields.style.display = 'flex';
        loginLabel.textContent = 'Email Address';
        submitBtn.textContent = 'Join Network';
        demoAccounts.style.display = 'none';
      } else if (tab === 'guest') {
        title.textContent = 'Guest Explorer Access';
        tabGuest.classList.add('active');
        form.style.display = 'none';
        guestSection.style.display = 'flex';
        demoAccounts.style.display = 'none';
      }
    };

    document.getElementById('auth-tab-login').onclick = () => setTab('login');
    document.getElementById('auth-tab-register').onclick = () => setTab('register');
    document.getElementById('auth-tab-guest').onclick = () => setTab('guest');
    document.getElementById('auth-modal-close').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

    // Continue as guest button
    document.getElementById('btn-confirm-guest').onclick = () => {
      AuthState.setGuestMode();
      modal.classList.remove('open');
    };

    // Quick demo accounts
    modal.querySelectorAll('.demo-login-btn').forEach(btn => {
      btn.onclick = async () => {
        const u = btn.dataset.user;
        const p = btn.dataset.pass;
        try {
          const res = await API.login(u, p);
          API.setToken(res.token);
          AuthState.currentUser = res.user;
          AuthState.isGuest = false;
          showToast(`Logged in as @${res.user.username} (${res.user.role})!`, 'success');
          modal.classList.remove('open');
          await AuthState.fetchAnonymousPersona();
          AuthState.updateUI();
          AuthState.notify();
          FeedManager.loadFeed(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    });

    // Form Submit
    document.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const loginVal = document.getElementById('auth-input-login').value.trim();
      const passVal = document.getElementById('auth-input-password').value;
      const userVal = document.getElementById('auth-input-username')?.value.trim();

      try {
        if (currentTab === 'login') {
          const res = await API.login(loginVal, passVal);
          API.setToken(res.token);
          AuthState.currentUser = res.user;
          AuthState.isGuest = false;
          showToast(`Welcome, @${res.user.username}!`, 'success');
        } else {
          const res = await API.register(userVal, loginVal, passVal);
          API.setToken(res.token);
          AuthState.currentUser = res.user;
          AuthState.isGuest = false;
          showToast('Account initialized successfully!', 'success');
        }

        modal.classList.remove('open');
        await AuthState.fetchAnonymousPersona();
        AuthState.updateUI();
        AuthState.notify();
        FeedManager.loadFeed(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  modal.classList.add('open');
  if (initialTab === 'register') {
    document.getElementById('auth-tab-register').click();
  } else if (initialTab === 'guest') {
    document.getElementById('auth-tab-guest').click();
  } else {
    document.getElementById('auth-tab-login').click();
  }
}
