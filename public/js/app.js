// DragMe Main Application Bootstrap & Router
const AppRouter = {
  currentView: 'home',

  init() {
    // Navigation Listeners
    document.getElementById('nav-item-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigate('home');
    });

    document.getElementById('nav-item-confessions')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.feed-tab[data-filter="confession"]')?.click() || FeedManager.loadFeed(true);
      this.navigate('confessions');
    });

    document.getElementById('nav-item-rooms')?.addEventListener('click', (e) => {
      e.preventDefault();
      HangoutManager.joinTopicRoom('General');
    });

    document.getElementById('nav-item-founder')?.addEventListener('click', (e) => {
      e.preventDefault();
      AdminManager.openAdminDashboard();
    });

    // Global Search & / Key Shortcut
    const searchInput = document.getElementById('global-search-input');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const postCards = document.querySelectorAll('.post-card');
      postCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput?.focus();
      }
    });

    // Header Notifications Trigger
    document.getElementById('btn-header-notifications')?.addEventListener('click', async () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      try {
        const res = await API.getNotifications();
        if (res.notifications.length === 0) {
          showToast('No new notifications.', 'normal');
        } else {
          showToast(`You have ${res.notifications.length} recent echos and updates.`, 'success');
        }
      } catch (e) {
        showToast('Notifications checked.', 'normal');
      }
    });

    // Dual Identity Header Switches
    document.getElementById('btn-mode-public')?.addEventListener('click', () => {
      AuthState.setMode('public');
    });

    document.getElementById('btn-mode-ghost')?.addEventListener('click', () => {
      AuthState.setMode('ghost');
    });

    // Theme toggle
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      showToast('Cyber Matte Dark Theme locked in.', 'normal');
    });

    // SOS Ask for help
    document.getElementById('btn-sos-ask')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!AuthState.currentUser) return openAuthModal('login');
      CreatePostModal.open();
    });

    // Infinite scroll on feed
    window.addEventListener('scroll', () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        if (FeedManager.hasMore && !FeedManager.isLoading) {
          FeedManager.loadFeed(false);
        }
      }
    });
  },

    // Bottom profile card click
    document.getElementById('sidebar-profile-card')?.addEventListener('click', () => {
      this.navigate('profile');
    });

    // Hash routing listener
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('profile')) {
        const parts = hash.split('/');
        const username = parts[1] || null;
        this.navigate('profile', username);
      } else if (hash === 'home' || hash === '') {
        this.navigate('home');
      } else if (hash === 'confessions') {
        this.navigate('confessions');
      }
    });
  },

  navigate(view, param = null) {
    this.currentView = view;
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    if (view === 'home') {
      document.getElementById('nav-item-home')?.classList.add('active');
      ProfileManager.restoreFeedView();
      FeedManager.loadFeed(true);
    } else if (view === 'confessions') {
      document.getElementById('nav-item-confessions')?.classList.add('active');
      ProfileManager.restoreFeedView();
      document.querySelector('.feed-tab[data-filter="confession"]')?.click();
    } else if (view === 'profile') {
      ProfileManager.openProfile(param);
    }
  }
};

// Global Boot Sequence
document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ Initializing DragMe Realm...');
  
  // 1. Initialize State & Auth
  await AuthState.init();

  // 2. Initialize WebSocket Client
  wsClient.connect();

  // 3. Initialize Post Creator Modal
  CreatePostModal.init();

  // 4. Initialize Feed
  FeedManager.init();

  // 5. Initialize Live Hangout Manager
  HangoutManager.init();

  // 6. Initialize Matchmaker
  MatchmakerManager.init();

  // 7. Initialize Global App Router & Bindings
  AppRouter.init();

  // 8. Handle initial URL hash
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash.startsWith('profile')) {
    const parts = initialHash.split('/');
    AppRouter.navigate('profile', parts[1] || null);
  } else if (initialHash === 'confessions') {
    AppRouter.navigate('confessions');
  }

  console.log('🌌 DragMe Ready: Put it out there.');
});
