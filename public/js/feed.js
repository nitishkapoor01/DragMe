// DragMe FYP Feed Manager & Dwell-Time Tracker Engine
const FeedManager = {
  currentFilter: 'all',
  offset: 0,
  limit: 15,
  isLoading: false,
  hasMore: true,
  dwellTracker: new Map(), // postId -> { startTime, observer }
  observer: null,

  init() {
    this.setupTabs();
    this.setupIntersectionObserver();
    const hash = window.location.hash.replace('#', '');
    if (!hash.startsWith('profile')) {
      this.loadFeed(true);
    }
  },

  setupTabs() {
    const tabs = document.querySelectorAll('.feed-tab[data-filter]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.loadFeed(true);
      });
    });
  },

  setupIntersectionObserver() {
    // Tracks when posts are visible in the viewport to measure real dwell time
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const postId = entry.target.dataset.postId;
        if (!postId) return;

        if (entry.isIntersecting) {
          // Started viewing post
          this.dwellTracker.set(postId, Date.now());
        } else {
          // Left viewport, calculate dwell time and send to FYP engine if > 1.5s
          if (this.dwellTracker.has(postId)) {
            const startTime = this.dwellTracker.get(postId);
            const dwellMs = Date.now() - startTime;
            this.dwellTracker.delete(postId);

            if (dwellMs >= 1500) {
              API.logView(postId, dwellMs).catch(() => {});
            }
          }
        }
      });
    }, { threshold: 0.5 }); // 50% visibility threshold
  },

  async loadFeed(reset = false) {
    if (this.isLoading) return;
    if (typeof AppRouter !== 'undefined' && AppRouter.currentView === 'profile') return;
    this.isLoading = true;

    const streamContainer = document.getElementById('posts-stream');
    const loader = document.getElementById('feed-loader');

    if (reset) {
      this.offset = 0;
      this.hasMore = true;
      if (streamContainer) streamContainer.innerHTML = '';
    }

    if (loader) loader.style.display = 'block';

    try {
      const data = await API.getPosts(this.currentFilter, this.offset, this.limit);
      
      // If user switched to profile view while API was fetching, do not overwrite profile!
      if (typeof AppRouter !== 'undefined' && AppRouter.currentView === 'profile') return;

      if (data.posts.length === 0 && this.offset === 0) {
        streamContainer.innerHTML = `
          <div class="cyber-card" style="text-align: center; padding: 40px 20px;">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--dragme-lime)" stroke-width="1.8" style="margin-bottom: 10px;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="2" y1="12" x2="4" y2="12"></line></svg>
            <h3 style="font-family: var(--font-display); margin-bottom: 8px;">No Signals Found</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Be the first to broadcast on this frequency.</p>
          </div>
        `;
      } else {
        data.posts.forEach(post => {
          const postNode = PostRenderer.renderPost(post);
          streamContainer.appendChild(postNode);

          // Observe for dwell-time tracking
          if (this.observer) this.observer.observe(postNode);
        });
      }

      this.offset = data.offset;
      this.hasMore = data.hasMore;
    } catch (err) {
      showToast('Failed to load feed signals.', 'error');
    } finally {
      this.isLoading = false;
      if (loader) loader.style.display = 'none';
    }
  }
};
