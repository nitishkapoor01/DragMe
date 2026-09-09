// DragMe Profile Hub, Telemetry Rails & Interactive Showcase (Exact Replica Spec)
const ProfileManager = {
  currentProfileUser: null,
  currentTab: 'posts',
  defaultSidebarHtml: null,

  async openProfile(targetUsername = null, initialTab = 'posts') {
    this.currentTab = initialTab;

    // Cache default right sidebar widgets if not already cached
    const rightSidebar = document.querySelector('.sidebar-right');
    if (rightSidebar && !this.defaultSidebarHtml) {
      this.defaultSidebarHtml = rightSidebar.innerHTML;
    }

    // Determine target username or me
    let user = null;
    let stats = null;
    let isSelf = false;
    let isFollowing = false;

    try {
      if (!targetUsername || (AuthState.currentUser && AuthState.currentUser.username.toLowerCase() === targetUsername.toLowerCase())) {
        if (!AuthState.currentUser) {
          return openAuthModal('login');
        }
        const meRes = await API.getMe();
        user = meRes.user;
        stats = meRes.stats;
        isSelf = true;
      } else {
        const profRes = await API.getProfile(targetUsername);
        user = profRes.user;
        stats = profRes.stats;
        isSelf = profRes.is_self;
        isFollowing = profRes.is_following;
      }
    } catch (err) {
      showToast(err.message || 'Failed to load profile.', 'error');
      return;
    }

    this.currentProfileUser = user;
    this.renderProfilePage(user, stats, isSelf, isFollowing);
    this.renderProfileRightSidebar(user, stats, isSelf);
    this.loadTabContent(this.currentTab);

    // Update active nav state
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  restoreFeedView() {
    const feedTabsBar = document.querySelector('.feed-tabs-bar');
    if (feedTabsBar) feedTabsBar.style.display = 'flex';

    const rightSidebar = document.querySelector('.sidebar-right');
    if (rightSidebar && this.defaultSidebarHtml) {
      rightSidebar.innerHTML = this.defaultSidebarHtml;
    }
  },

  renderProfilePage(user, stats, isSelf, isFollowing) {
    const mainFeed = document.querySelector('.main-feed-column');
    if (!mainFeed) return;

    // Hide standard feed filter tabs bar
    const feedTabsBar = document.querySelector('.feed-tabs-bar');
    if (feedTabsBar) feedTabsBar.style.display = 'none';

    const postsStream = document.getElementById('posts-stream');
    if (!postsStream) return;

    const defaultBanner = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1400&auto=format&fit=crop&q=80';
    const defaultAvatar = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80';

    const bannerImg = user.banner_url || defaultBanner;
    const avatarImg = user.avatar_url || defaultAvatar;
    const displayName = user.display_name || user.username || 'DragMe Official';
    const locationText = user.location || 'Everywhere';
    const bioText = user.bio || '👑 Official DragMe Founder & Product Team. Building the rawest space on the internet — no filters, just fire. Roadmap, live feature polls & platform updates.';
    
    // Format joined date (e.g. September 2026)
    let joinedDate = 'September 2026';
    if (user.created_at) {
      const d = new Date(user.created_at);
      if (!isNaN(d.getTime())) {
        joinedDate = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }

    postsStream.innerHTML = `
      <div class="profile-view-container">
        <!-- Profile Hero Card -->
        <div class="profile-hero-card">
          <!-- Banner Container -->
          <div class="profile-banner-box" style="background-image: url('${bannerImg}');">
            <div class="profile-banner-overlay"></div>
            ${isSelf ? `
              <button class="btn-edit-banner" id="btn-trigger-edit-banner" title="Change your header banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Edit Banner
              </button>
            ` : ''}
          </div>

          <!-- Profile Details Section -->
          <div class="profile-info-section">
            <div class="profile-avatar-row">
              <div class="profile-avatar-wrapper">
                <img class="profile-avatar-img" src="${avatarImg}" alt="${user.username}">
                ${isSelf ? `
                  <button class="profile-avatar-camera-btn" id="btn-trigger-avatar-edit" title="Update Profile Picture">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </button>
                ` : ''}
              </div>

              <!-- Top Right Actions -->
              <div class="profile-action-buttons">
                ${isSelf ? `
                  <button class="btn-edit-profile-main" id="btn-trigger-edit-profile">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    Edit Profile
                  </button>
                  <button class="profile-icon-action" id="btn-profile-settings" title="Account Settings">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
                  <button class="profile-icon-action" id="btn-profile-share" title="Share Profile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </button>
                ` : `
                  <button class="btn-edit-profile-main ${isFollowing ? 'following' : ''}" id="btn-toggle-follow-user" style="${isFollowing ? 'background: #222638;' : 'background: var(--dragme-lime); color: #000;'}">
                    ${isFollowing ? '✓ Following' : '+ Follow'}
                  </button>
                  <button class="profile-icon-action" id="btn-profile-share" title="Share Profile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  </button>
                `}
              </div>
            </div>

            <!-- Name, Verified & Custom Badges -->
            <div class="profile-name-row">
              <h2 class="profile-display-name">${displayName}</h2>
              <span class="profile-verified-badge" title="Verified Creator & Founder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#a3e635"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </span>
              <span class="badge-founder-gold">${user.custom_badge || '👑 FOUNDER'}</span>
              <span class="badge-senior-roaster">${user.badge || 'Senior Roaster'}</span>
            </div>

            <div class="profile-handle-text">@${user.username}</div>

            <p class="profile-bio-text">${bioText}</p>

            <div class="profile-location-joined">
              <span style="display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${locationText}
              </span>
              <span style="display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Joined ${joinedDate}
              </span>
            </div>

            <!-- Stats Counters Bar -->
            <div class="profile-stats-counters-bar">
              <div class="profile-stat-item">
                <span class="profile-stat-num" id="stat-posts-num">${stats?.post_count || 0}</span>
                <span class="profile-stat-label">Posts</span>
              </div>
              <div class="profile-stat-item">
                <span class="profile-stat-num" id="stat-followers-num">${stats?.followers_count || 0}</span>
                <span class="profile-stat-label">Followers</span>
              </div>
              <div class="profile-stat-item">
                <span class="profile-stat-num" id="stat-following-num">${stats?.following_count || 0}</span>
                <span class="profile-stat-label">Following</span>
              </div>
              <div class="profile-stat-item">
                <span class="profile-stat-num" id="stat-rooms-num">${stats?.rooms_count || 0}</span>
                <span class="profile-stat-label">Rooms</span>
              </div>
              <div class="profile-stat-item">
                <span class="profile-stat-num" id="stat-reactions-num">${stats?.reactions_count || 0}</span>
                <span class="profile-stat-label">Reactions</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Tabs Navigation -->
        <div class="profile-tabs-nav">
          <button class="profile-tab-btn ${this.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
          <button class="profile-tab-btn ${this.currentTab === 'posts' ? 'active' : ''}" data-tab="posts">Posts</button>
          <button class="profile-tab-btn ${this.currentTab === 'rooms' ? 'active' : ''}" data-tab="rooms">Rooms</button>
          <button class="profile-tab-btn ${this.currentTab === 'media' ? 'active' : ''}" data-tab="media">Media</button>
          <button class="profile-tab-btn ${this.currentTab === 'replies' ? 'active' : ''}" data-tab="replies">Replies</button>
          ${isSelf ? `
            <button class="profile-tab-btn ${this.currentTab === 'saved' ? 'active' : ''}" data-tab="saved">
              🔒 Only You
            </button>
          ` : ''}
        </div>

        <!-- Active Tab Dynamic Stream Container -->
        <div id="profile-tab-stream" style="display: flex; flex-direction: column; gap: 16px;"></div>
      </div>
    `;

    // Event Bindings
    if (isSelf) {
      document.getElementById('btn-trigger-edit-profile')?.addEventListener('click', () => this.openEditProfileModal());
      document.getElementById('btn-trigger-edit-banner')?.addEventListener('click', () => this.openEditBannerModal());
      document.getElementById('btn-trigger-avatar-edit')?.addEventListener('click', () => this.openEditProfileModal());
      document.getElementById('btn-profile-settings')?.addEventListener('click', () => {
        showToast('Settings panel: Profile privacy, notifications, and security verified.', 'normal');
      });
    } else {
      document.getElementById('btn-toggle-follow-user')?.addEventListener('click', async () => {
        if (!AuthState.currentUser) return openAuthModal('login');
        try {
          if (isFollowing) {
            const res = await API.unfollowUser(user.id);
            isFollowing = false;
            document.getElementById('stat-followers-num').textContent = res.followers_count;
            showToast(`Unfollowed @${user.username}`, 'normal');
          } else {
            const res = await API.followUser(user.id);
            isFollowing = true;
            document.getElementById('stat-followers-num').textContent = res.followers_count;
            showToast(`Now following @${user.username}!`, 'success');
          }
          const followBtn = document.getElementById('btn-toggle-follow-user');
          if (followBtn) {
            followBtn.textContent = isFollowing ? '✓ Following' : '+ Follow';
            followBtn.style.background = isFollowing ? '#222638' : 'var(--dragme-lime)';
            followBtn.style.color = isFollowing ? '#fff' : '#000';
          }
        } catch (e) {
          showToast(e.message || 'Follow action failed', 'error');
        }
      });
    }

    document.getElementById('btn-profile-share')?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.origin + '/#profile');
      showToast('Profile link copied to clipboard!', 'success');
    });

    // Profile Tab Switches
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.currentTab = tab;
        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.loadTabContent(tab);
      });
    });
  },

  renderProfileRightSidebar(user, stats, isSelf) {
    const rightSidebar = document.querySelector('.sidebar-right');
    if (!rightSidebar) return;

    rightSidebar.innerHTML = `
      <!-- Widget 1: Profile Highlights -->
      <div class="widget-box">
        <div class="widget-header">
          <h4 style="color: #facc15;">✨ PROFILE HIGHLIGHTS</h4>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; padding: 4px 0;">
          <div class="profile-highlight-row">
            <span class="profile-highlight-label">Reputation Score</span>
            <span class="profile-highlight-val">${user.reputation_score || 0}</span>
          </div>
          <div class="profile-highlight-row">
            <span class="profile-highlight-label">Cooked Ratio</span>
            <span class="profile-highlight-val">${user.cooked_ratio || 0}%</span>
          </div>
          <div class="profile-highlight-row">
            <span class="profile-highlight-label">Judgment Accuracy</span>
            <span class="profile-highlight-val lime">${user.judgment_accuracy || 92}%</span>
          </div>
          <div class="profile-highlight-row">
            <span class="profile-highlight-label">Rank</span>
            <span class="profile-highlight-val accent" style="font-size: 0.82rem;">${user.rank_title || '#143 Senior Roaster'}</span>
          </div>
        </div>
      </div>

      <!-- Widget 2: Roast Level -->
      <div class="widget-box">
        <div class="widget-header">
          <h4 style="color: var(--text-secondary);">ROAST LEVEL</h4>
        </div>
        <div style="padding: 4px 0 6px 0;">
          <div class="roast-level-title">${user.roast_level || 'NOVICE ROASTER'}</div>
          <div class="roast-level-sub">Next Level in 500 points</div>
          <div class="roast-progress-track">
            <div class="roast-progress-fill"></div>
          </div>
        </div>
      </div>

      <!-- Widget 3: Top Badges -->
      <div class="widget-box">
        <div class="widget-header">
          <h4>TOP BADGES</h4>
          <a href="javascript:void(0)" class="widget-view-all" id="btn-view-all-badges" style="color: var(--dragme-lime);">View all →</a>
        </div>
        <div class="badges-grid">
          <div class="badge-card-mini" title="Top Roaster Award">
            <span class="badge-card-icon">🔥</span>
            <span class="badge-card-name">Top Roaster</span>
          </div>
          <div class="badge-card-mini" title="Battle Champion">
            <span class="badge-card-icon">⚡</span>
            <span class="badge-card-name">Battle Ch...</span>
          </div>
          <div class="badge-card-mini" title="Great Critic">
            <span class="badge-card-icon">⚖️</span>
            <span class="badge-card-name">Great Critic</span>
          </div>
          <div class="badge-card-mini" title="Problem Solver">
            <span class="badge-card-icon">🪪</span>
            <span class="badge-card-name">Problem ...</span>
          </div>
        </div>
      </div>

      <!-- Widget 4: Only You Can See -->
      ${isSelf ? `
        <div class="widget-box">
          <div class="widget-header">
            <h4 style="color: #facc15;"><span style="font-size: 0.85rem;">🔒</span> ONLY YOU CAN SEE</h4>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 12px; margin-top: -6px;">
            Private owner-only activity
          </div>

          <div class="private-feature-item" id="btn-sidebar-recent-activity">
            <div class="private-feature-left">
              <span style="font-size: 1.1rem; color: var(--dragme-lime);">🕒</span>
              <div>
                <div class="private-feature-title">Recent Activity</div>
                <div class="private-feature-sub">Your private activity timeline</div>
              </div>
            </div>
            <span style="color: var(--text-muted); font-size: 0.8rem;">🔒</span>
          </div>

          <div class="private-feature-item" id="btn-sidebar-saved-posts">
            <div class="private-feature-left">
              <span style="font-size: 1.1rem; color: #facc15;">🔖</span>
              <div>
                <div class="private-feature-title">Saved</div>
                <div class="private-feature-sub">Posts, rooms & content you saved</div>
              </div>
            </div>
            <span style="color: var(--text-muted); font-size: 0.8rem;">🔒</span>
          </div>
        </div>
      ` : ''}
    `;

    if (isSelf) {
      document.getElementById('btn-sidebar-saved-posts')?.addEventListener('click', () => {
        document.querySelector('.profile-tab-btn[data-tab="saved"]')?.click();
      });
      document.getElementById('btn-sidebar-recent-activity')?.addEventListener('click', () => {
        showToast('Timeline activity: No suspicious logins. All sessions encrypted.', 'normal');
      });
      document.getElementById('btn-view-all-badges')?.addEventListener('click', () => {
        showToast('Badges earned: Founder, Neon Pioneer, Senior Roaster, Critic Tier 1.', 'success');
      });
    }
  },

  async loadTabContent(tab) {
    const stream = document.getElementById('profile-tab-stream');
    if (!stream || !this.currentProfileUser) return;

    stream.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner-ring"></div>
      </div>
    `;

    try {
      if (tab === 'saved') {
        const data = await API.getSavedPosts();
        if (!data.posts || data.posts.length === 0) {
          stream.innerHTML = `
            <div class="empty-state-box" style="padding: 40px 20px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px;">
              <span style="font-size: 2.2rem;">🔖</span>
              <h3 style="color: #fff; margin-top: 10px; font-size: 1.1rem;">No Saved Posts Yet</h3>
              <p style="color: var(--text-muted); font-size: 0.86rem; margin-top: 6px;">Click the bookmark icon on any post in your feed to save it for later.</p>
            </div>
          `;
          return;
        }

        stream.innerHTML = '';
        data.posts.forEach(post => {
          stream.appendChild(PostRenderer.renderPostCard(post));
        });
        return;
      }

      if (tab === 'rooms') {
        const data = await API.getUserRooms(this.currentProfileUser.id);
        if (!data.rooms || data.rooms.length === 0) {
          stream.innerHTML = `
            <div class="empty-state-box" style="padding: 40px 20px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px;">
              <span style="font-size: 2.2rem;">🎙️</span>
              <h3 style="color: #fff; margin-top: 10px; font-size: 1.1rem;">No Active Rooms Hosted</h3>
              <p style="color: var(--text-muted); font-size: 0.86rem; margin-top: 6px;">Start a live audio hangout room or voice discussion to invite the community.</p>
            </div>
          `;
          return;
        }

        stream.innerHTML = '';
        data.rooms.forEach(r => {
          const roomEl = document.createElement('div');
          roomEl.className = 'post-card';
          roomEl.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div>
                <span class="topic-pill" style="font-size: 0.72rem;">${r.topic}</span>
                <h3 style="font-size: 1.15rem; color: #fff; margin-top: 6px;">${r.title}</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${r.description || 'Live hangout session'}</p>
              </div>
              <button class="btn-discuss-pill" onclick="HangoutManager.joinTopicRoom('${r.id}')" style="padding: 8px 18px;">
                Enter Room (${r.participant_count})
              </button>
            </div>
          `;
          stream.appendChild(roomEl);
        });
        return;
      }

      if (tab === 'replies') {
        const data = await API.getUserPosts(this.currentProfileUser.id, 'replies');
        if (!data.comments || data.comments.length === 0) {
          stream.innerHTML = `
            <div class="empty-state-box" style="padding: 40px 20px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px;">
              <span style="font-size: 2.2rem;">💬</span>
              <h3 style="color: #fff; margin-top: 10px; font-size: 1.1rem;">No Replies Yet</h3>
              <p style="color: var(--text-muted); font-size: 0.86rem; margin-top: 6px;">Comment on community confessions and threads to build discussion karma.</p>
            </div>
          `;
          return;
        }

        stream.innerHTML = '';
        data.comments.forEach(c => {
          const cEl = document.createElement('div');
          cEl.className = 'post-card';
          cEl.innerHTML = `
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
              Replied to post: <span style="color: #fff; font-weight: 700;">${c.post_title || 'Post Thread'}</span>
            </div>
            <div style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5; background: #0c0d12; border: 1px solid var(--border-subtle); padding: 12px; border-radius: 10px;">
              "${c.content}"
            </div>
          `;
          stream.appendChild(cEl);
        });
        return;
      }

      // Default: 'posts' or 'overview' or 'media'
      const data = await API.getUserPosts(this.currentProfileUser.id, tab);
      if (!data.posts || data.posts.length === 0) {
        stream.innerHTML = `
          <div class="empty-state-box" style="padding: 40px 20px; text-align: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px;">
            <span style="font-size: 2.2rem;">🚀</span>
            <h3 style="color: #fff; margin-top: 10px; font-size: 1.1rem;">No ${tab} Published Yet</h3>
            <p style="color: var(--text-muted); font-size: 0.86rem; margin-top: 6px;">Put your first thoughts, confessions, memes, or polls out into the realm.</p>
          </div>
        `;
        return;
      }

      stream.innerHTML = '';
      data.posts.forEach(post => {
        stream.appendChild(PostRenderer.renderPostCard(post));
      });
    } catch (err) {
      stream.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--neon-red);">
          Failed to load ${tab}. Please refresh.
        </div>
      `;
    }
  },

  openEditProfileModal() {
    if (!AuthState.currentUser) return openAuthModal('login');
    const u = this.currentProfileUser || AuthState.currentUser;

    let modal = document.getElementById('edit-profile-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-window" style="max-width: 540px;">
        <div class="modal-header">
          <div class="modal-title">Edit Profile</div>
          <button class="modal-close-btn" id="btn-close-edit-modal">✕</button>
        </div>

        <form id="form-edit-profile" class="modal-form-body">
          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input type="text" id="edit-display-name" class="form-input" value="${u.display_name || u.username}" maxlength="50" required>
          </div>

          <div class="form-group">
            <label class="form-label">Bio (Description)</label>
            <textarea id="edit-bio" class="form-input" rows="3" maxlength="500" style="resize: vertical;">${u.bio || ''}</textarea>
            <div style="text-align: right; font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;" id="bio-char-count">0/500</div>
          </div>

          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" id="edit-location" class="form-input" value="${u.location || 'Everywhere'}" maxlength="50">
          </div>

          <div class="form-group">
            <label class="form-label">Avatar Image URL</label>
            <div style="display: flex; gap: 8px;">
              <input type="url" id="edit-avatar-url" class="form-input" value="${u.avatar_url || ''}" placeholder="https://images.unsplash.com/...">
              <label class="btn-discuss-pill" style="cursor: pointer; padding: 10px 14px; white-space: nowrap; font-size: 0.78rem;">
                Upload
                <input type="file" id="edit-avatar-file" accept="image/*" style="display: none;">
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Banner Image URL</label>
            <div style="display: flex; gap: 8px;">
              <input type="url" id="edit-banner-url" class="form-input" value="${u.banner_url || ''}" placeholder="https://images.unsplash.com/...">
              <label class="btn-discuss-pill" style="cursor: pointer; padding: 10px 14px; white-space: nowrap; font-size: 0.78rem;">
                Upload
                <input type="file" id="edit-banner-file" accept="image/*" style="display: none;">
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn-discuss-pill" id="btn-cancel-edit-profile" style="background: #1c1d28;">Cancel</button>
            <button type="submit" class="header-action-circle plus-btn" style="width: auto; border-radius: var(--radius-md); padding: 8px 24px; font-size: 0.88rem; font-weight: 800;">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Character counter for bio
    const bioTextarea = modal.querySelector('#edit-bio');
    const bioCounter = modal.querySelector('#bio-char-count');
    const updateCount = () => { bioCounter.textContent = `${bioTextarea.value.length}/500`; };
    bioTextarea.addEventListener('input', updateCount);
    updateCount();

    // File Upload listeners
    modal.querySelector('#edit-avatar-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast('Uploading avatar...', 'normal');
        const res = await API.uploadMedia(file);
        modal.querySelector('#edit-avatar-url').value = res.url;
        showToast('Avatar uploaded!', 'success');
      } catch (err) {
        showToast(err.message || 'Avatar upload failed', 'error');
      }
    });

    modal.querySelector('#edit-banner-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast('Uploading banner...', 'normal');
        const res = await API.uploadMedia(file);
        modal.querySelector('#edit-banner-url').value = res.url;
        showToast('Banner uploaded!', 'success');
      } catch (err) {
        showToast(err.message || 'Banner upload failed', 'error');
      }
    });

    // Close listeners
    const closeModal = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-edit-modal').onclick = closeModal;
    modal.querySelector('#btn-cancel-edit-profile').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Form submit
    modal.querySelector('#form-edit-profile').onsubmit = async (e) => {
      e.preventDefault();
      const displayName = modal.querySelector('#edit-display-name').value.trim();
      const bio = modal.querySelector('#edit-bio').value.trim();
      const location = modal.querySelector('#edit-location').value.trim();
      const avatarUrl = modal.querySelector('#edit-avatar-url').value.trim();
      const bannerUrl = modal.querySelector('#edit-banner-url').value.trim();

      try {
        const res = await API.updateProfile({
          display_name: displayName,
          bio,
          location,
          avatar_url: avatarUrl,
          banner_url: bannerUrl
        });

        AuthState.currentUser = res.user;
        AuthState.updateUI();
        showToast('Profile updated successfully!', 'success');
        closeModal();
        this.openProfile();
      } catch (err) {
        showToast(err.message || 'Failed to update profile', 'error');
      }
    };

    setTimeout(() => modal.classList.add('open'), 10);
  },

  openEditBannerModal() {
    this.openEditProfileModal();
  }
};
