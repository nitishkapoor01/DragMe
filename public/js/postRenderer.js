// DragMe 8 Rich Post Formats Renderer & Micro-Interactions Engine
const PostRenderer = {
  renderPost(post) {
    const card = document.createElement('div');
    card.className = `post-card format-${post.post_type}`;
    card.id = `post-${post.id}`;
    card.dataset.postId = post.id;

    // Build format-specific content HTML
    let bodyContentHTML = '';

    switch (post.post_type) {
      case 'confession':
        bodyContentHTML = this.renderConfessionBody(post);
        break;
      case 'meme':
        bodyContentHTML = this.renderMemeBody(post);
        break;
      case 'video':
        bodyContentHTML = this.renderVideoBody(post);
        break;
      case 'carousel':
        bodyContentHTML = this.renderCarouselBody(post);
        break;
      case 'text':
        bodyContentHTML = this.renderTextBody(post);
        break;
      case 'poll':
        bodyContentHTML = this.renderPollBody(post);
        break;
      case 'voice':
        bodyContentHTML = this.renderVoiceBody(post);
        break;
      case 'hangout_invite':
        bodyContentHTML = this.renderHangoutInviteBody(post);
        break;
      default:
        bodyContentHTML = `<div class="post-body-text">${this.escapeHTML(post.content)}</div>`;
    }

    // Author and topic info
    const isAnon = post.is_anonymous;
    const authorName = post.author?.username || (isAnon ? 'Ghost Persona' : 'Tester Supreme');
    const authorAvatar = isAnon 
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorName)}&backgroundColor=1a0815`
      : (post.author?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100');

    const topicName = post.extra_data?.topic || (isAnon ? 'Confessions' : 'General');
    const timeFormatted = this.formatTimestamp(post.created_at);

    card.innerHTML = `
      <div class="post-header">
        <div class="post-author-row" ${!isAnon && post.author?.username ? `style="cursor: pointer;" onclick="AppRouter.navigate('profile', '${post.author.username}')"` : ''}>
          <img class="author-avatar ${isAnon ? 'ghost-avatar' : ''}" src="${authorAvatar}" alt="${authorName}" loading="lazy">
          <div class="author-meta-text">
            <span style="${!isAnon ? 'font-weight: 700; color: #fff;' : ''}">${this.escapeHTML(authorName)}</span>
            <span class="author-topic">in ${this.escapeHTML(topicName)}</span>
            <span class="author-dot">·</span>
            <span class="author-time">${timeFormatted}</span>
          </div>
        </div>

        <div class="post-header-actions">
          <button class="btn-discuss-pill btn-comments-toggle" data-post-id="${post.id}">DISCUSS</button>
          <button class="btn-post-menu" data-post-id="${post.id}">···</button>
        </div>
      </div>

      ${post.title ? `<div class="post-title">${this.escapeHTML(post.title)}</div>` : ''}
      
      ${bodyContentHTML}

      <div class="post-actions-bar">
        <div class="action-btn-group">
          <button class="action-btn btn-like ${post.has_liked ? 'liked' : ''}" data-post-id="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span class="like-count">${post.like_count || 0}</span>
          </button>

          <button class="action-btn btn-comments-toggle" data-post-id="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <span class="comment-count">${post.comment_count || 0}</span>
          </button>

          <button class="action-btn btn-share" data-post-id="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span class="share-count">${post.share_count || 0}</span>
          </button>
        </div>

        <button class="action-btn btn-save ${post.has_saved ? 'saved' : ''}" data-post-id="${post.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </button>
      </div>

      <div class="comments-section" id="comments-container-${post.id}" style="display: none;">
        <div class="comment-identity-bar" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 0.78rem;">
          <span style="color: var(--text-muted);">Replying as:</span>
          <div class="identity-switch-container" style="padding: 2px; transform: scale(0.9); transform-origin: right;">
            <button class="identity-btn ${AuthState.currentMode === 'public' ? 'active public-mode' : ''} comment-mode-toggle-public" data-post-id="${post.id}">
              @${AuthState.currentUser ? AuthState.currentUser.username : 'You'}
            </button>
            <button class="identity-btn ${AuthState.currentMode === 'ghost' ? 'active ghost-mode' : ''} comment-mode-toggle-ghost" data-post-id="${post.id}">
              🎭 Ghost
            </button>
          </div>
        </div>
        <div class="comment-input-box">
          <input type="text" placeholder="Write your response..." id="comment-input-${post.id}">
          <button class="btn-discuss-pill btn-send-comment" data-post-id="${post.id}">Echo</button>
        </div>
        <div class="comments-stream" id="comments-stream-${post.id}"></div>
      </div>
    `;

    this.attachEventListeners(card, post);
    return card;
  },

  // 1. Confession Format
  renderConfessionBody(post) {
    const sentiment = post.extra_data?.sentiment || 'Raw Truth';
    return `
      <div class="confession-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>
        ${this.escapeHTML(sentiment)}
      </div>
      <div class="post-body-text" style="font-size: 1rem; font-style: italic; color: #ffe6f0; line-height: 1.6;">
        "${this.escapeHTML(post.content)}"
      </div>
    `;
  },

  // 2. Meme / Image Format
  renderMemeBody(post) {
    const mediaUrl = post.media_urls?.[0] || '';
    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      ${mediaUrl ? `
        <div class="post-media-box">
          <img src="${mediaUrl}" alt="Post Media" loading="lazy">
        </div>
      ` : ''}
    `;
  },

  // 3. Video Format
  renderVideoBody(post) {
    const videoUrl = post.media_urls?.[0] || '';
    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      ${videoUrl ? `
        <div class="video-player-container" id="video-box-${post.id}">
          <video src="${videoUrl}" playsinline loop></video>
          <div class="video-custom-controls">
            <button class="video-ctrl-btn btn-video-play">▶</button>
            <div class="video-progress-bar"><div class="video-progress-fill"></div></div>
            <button class="video-ctrl-btn btn-video-mute">🔊</button>
          </div>
        </div>
      ` : ''}
    `;
  },

  // 4. Multi-Image Carousel Format
  renderCarouselBody(post) {
    const images = post.media_urls || [];
    if (images.length === 0) return `<div class="post-body-text">${this.escapeHTML(post.content)}</div>`;

    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      <div class="carousel-container" id="carousel-${post.id}">
        <div class="carousel-slides">
          ${images.map(img => `
            <div class="carousel-slide"><img src="${img}" alt="Slide" loading="lazy"></div>
          `).join('')}
        </div>
        ${images.length > 1 ? `
          <button class="carousel-btn prev" data-post-id="${post.id}">‹</button>
          <button class="carousel-btn next" data-post-id="${post.id}">›</button>
          <div class="carousel-dots">
            ${images.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  // 5. Text Format
  renderTextBody(post) {
    return `
      <div class="post-body-text" style="font-size: 1.05rem; line-height: 1.65; color: #fff;">
        “${this.escapeHTML(post.content)}”
      </div>
    `;
  },

  // 6. Poll Format
  renderPollBody(post) {
    const options = post.poll_options || [];
    const totalVotes = options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const userVote = post.user_vote;

    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      <div class="poll-container" id="poll-${post.id}">
        ${options.map((opt, idx) => {
          const votes = opt.votes || 0;
          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isVoted = userVote === idx;

          return `
            <button class="poll-option-btn ${isVoted ? 'voted' : ''}" data-post-id="${post.id}" data-opt-index="${idx}">
              <div class="poll-option-fill" style="width: ${percent}%;"></div>
              <span class="poll-option-text">${this.escapeHTML(opt.text)}</span>
              <span class="poll-option-percent">${percent}% (${votes})</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  },

  // 7. Voice Snippet
  renderVoiceBody(post) {
    const audioUrl = post.media_urls?.[0] || '';
    const waveform = post.extra_data?.waveform || [20, 45, 60, 90, 75, 50, 80, 95, 40, 60, 85, 30];

    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      <div class="voice-snippet-card" id="voice-${post.id}">
        <audio src="${audioUrl}" preload="none"></audio>
        <button class="voice-play-btn" data-post-id="${post.id}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <div class="waveform-visualizer">
          ${waveform.map(h => `<div class="waveform-bar" style="height: ${h}%;"></div>`).join('')}
        </div>
        <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">0:42</span>
      </div>
    `;
  },

  // 8. Live Hangout Invite
  renderHangoutInviteBody(post) {
    const roomId = post.extra_data?.room_id || 'room_midnight_01';
    const roomTitle = post.extra_data?.room_title || 'Midnight Cyber Lounge';
    const participants = post.extra_data?.participant_count || 8;

    return `
      <div class="post-body-text">${this.escapeHTML(post.content)}</div>
      <div class="hangout-invite-box">
        <div>
          <h4 style="font-weight: 700; color: #fff;">${this.escapeHTML(roomTitle)}</h4>
          <p style="font-size: 0.78rem; color: var(--dragme-lime);">${participants} live participants right now</p>
        </div>
        <button class="btn-join-hangout" data-room-id="${roomId}">Join Voice Room</button>
      </div>
    `;
  },

  attachEventListeners(card, post) {
    // Like button
    const likeBtn = card.querySelector('.btn-like');
    likeBtn?.addEventListener('click', async () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      try {
        const res = await API.toggleLike(post.id);
        likeBtn.classList.toggle('liked', res.liked);
        card.querySelector('.like-count').textContent = res.like_count;
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Save button
    const saveBtn = card.querySelector('.btn-save');
    saveBtn?.addEventListener('click', async () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      try {
        const res = await API.toggleSave(post.id);
        saveBtn.classList.toggle('saved', res.saved);
        showToast(res.saved ? 'Saved to bookmarks' : 'Removed from bookmarks');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Share button
    const shareBtn = card.querySelector('.btn-share');
    shareBtn?.addEventListener('click', async () => {
      try {
        const res = await API.sharePost(post.id);
        card.querySelector('.share-count').textContent = res.share_count;
        navigator.clipboard?.writeText(`${window.location.origin}/#post-${post.id}`);
        showToast('Link copied to clipboard!', 'success');
      } catch (err) {
        showToast('Shared link', 'success');
      }
    });

    // Toggle comments
    const commentsToggleBtns = card.querySelectorAll('.btn-comments-toggle');
    const commentsContainer = card.querySelector(`#comments-container-${post.id}`);
    commentsToggleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const isOpen = commentsContainer.style.display !== 'none';
        if (isOpen) {
          commentsContainer.style.display = 'none';
        } else {
          commentsContainer.style.display = 'flex';
          await this.loadComments(post.id);
        }
      });
    });

    // Per-comment identity toggle listeners
    let commentReplyMode = AuthState.currentMode;
    const pubToggle = card.querySelector('.comment-mode-toggle-public');
    const ghostToggle = card.querySelector('.comment-mode-toggle-ghost');

    pubToggle?.addEventListener('click', () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      commentReplyMode = 'public';
      pubToggle.classList.add('active', 'public-mode');
      ghostToggle.classList.remove('active', 'ghost-mode');
    });

    ghostToggle?.addEventListener('click', () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      commentReplyMode = 'ghost';
      ghostToggle.classList.add('active', 'ghost-mode');
      pubToggle.classList.remove('active', 'public-mode');
    });

    // Send comment
    const sendCommentBtn = card.querySelector(`.btn-send-comment[data-post-id="${post.id}"]`);
    const commentInput = card.querySelector(`#comment-input-${post.id}`);
    const submitComment = async () => {
      if (!AuthState.currentUser) return openAuthModal('login');
      const text = commentInput.value.trim();
      if (!text) return;

      try {
        const isAnon = commentReplyMode === 'ghost' || post.is_anonymous;
        await API.addComment(post.id, {
          content: text,
          is_anonymous: isAnon
        });
        commentInput.value = '';
        await this.loadComments(post.id);
        const countSpan = card.querySelector('.comment-count');
        countSpan.textContent = parseInt(countSpan.textContent || 0) + 1;
        showToast(isAnon ? '🎭 Anonymous Ghost echo posted!' : '📢 Public comment posted!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    sendCommentBtn?.addEventListener('click', submitComment);
    commentInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitComment();
    });

    // Poll Option Buttons
    if (post.post_type === 'poll') {
      const pollBtns = card.querySelectorAll('.poll-option-btn');
      pollBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!AuthState.currentUser) return openAuthModal('login');
          const optIdx = parseInt(btn.dataset.optIndex);
          try {
            const res = await API.votePoll(post.id, optIdx);
            const totalVotes = res.poll_options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
            pollBtns.forEach((b, idx) => {
              const opt = res.poll_options[idx];
              const votes = opt.votes || 0;
              const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              b.classList.toggle('voted', idx === optIdx);
              b.querySelector('.poll-option-fill').style.width = `${percent}%`;
              b.querySelector('.poll-option-percent').textContent = `${percent}% (${votes})`;
            });
            showToast('Vote recorded in poll!', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    }

    // Voice snippet player
    if (post.post_type === 'voice') {
      const voiceCard = card.querySelector(`#voice-${post.id}`);
      const audio = voiceCard?.querySelector('audio');
      const playBtn = voiceCard?.querySelector('.voice-play-btn');
      const bars = voiceCard?.querySelectorAll('.waveform-bar');

      playBtn?.addEventListener('click', () => {
        if (audio.paused) {
          audio.play();
          playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
          bars?.forEach(b => b.classList.add('active'));
        } else {
          audio.pause();
          playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
          bars?.forEach(b => b.classList.remove('active'));
        }
      });
      audio?.addEventListener('ended', () => {
        playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
        bars?.forEach(b => b.classList.remove('active'));
      });
    }

    // Video custom controls
    if (post.post_type === 'video') {
      const videoBox = card.querySelector(`#video-box-${post.id}`);
      const video = videoBox?.querySelector('video');
      const playBtn = videoBox?.querySelector('.btn-video-play');
      const muteBtn = videoBox?.querySelector('.btn-video-mute');
      const progressFill = videoBox?.querySelector('.video-progress-fill');

      playBtn?.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playBtn.textContent = '⏸';
        } else {
          video.pause();
          playBtn.textContent = '▶';
        }
      });
      muteBtn?.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? '🔇' : '🔊';
      });
      video?.addEventListener('timeupdate', () => {
        if (video.duration) {
          progressFill.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }
      });
    }

    // Carousel slides
    if (post.post_type === 'carousel') {
      const carousel = card.querySelector(`#carousel-${post.id}`);
      const slidesContainer = carousel?.querySelector('.carousel-slides');
      const prevBtn = carousel?.querySelector('.carousel-btn.prev');
      const nextBtn = carousel?.querySelector('.carousel-btn.next');
      const dots = carousel?.querySelectorAll('.carousel-dot');
      let currentSlide = 0;
      const totalSlides = post.media_urls?.length || 1;

      const updateSlide = (idx) => {
        currentSlide = (idx + totalSlides) % totalSlides;
        if (slidesContainer) slidesContainer.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots?.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
      };

      prevBtn?.addEventListener('click', () => updateSlide(currentSlide - 1));
      nextBtn?.addEventListener('click', () => updateSlide(currentSlide + 1));
      dots?.forEach((d, i) => d.addEventListener('click', () => updateSlide(i)));
    }

    // Join Hangout button
    const joinHangoutBtn = card.querySelector('.btn-join-hangout');
    joinHangoutBtn?.addEventListener('click', () => {
      const roomId = joinHangoutBtn.dataset.roomId;
      HangoutManager.joinRoom(roomId);
    });
  },

  async loadComments(postId) {
    const stream = document.getElementById(`comments-stream-${postId}`);
    if (!stream) return;

    try {
      const data = await API.getComments(postId);
      if (data.comments.length === 0) {
        stream.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 10px;">No comments yet. Start the discussion.</p>`;
        return;
      }

      stream.innerHTML = data.comments.map(c => this.renderCommentNode(c)).join('');
    } catch (err) {
      stream.innerHTML = `<p style="color: var(--neon-magenta); font-size: 0.8rem;">Failed to load comments.</p>`;
    }
  },

  renderCommentNode(comment) {
    const isAnon = comment.is_anonymous;
    const authorName = comment.author?.username || 'Masked Whisperer';
    const avatarUrl = isAnon
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorName)}&backgroundColor=1a0815`
      : (comment.author?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100');

    return `
      <div class="comment-item" id="comment-${comment.id}">
        <img class="comment-avatar" src="${avatarUrl}" alt="${authorName}" loading="lazy">
        <div class="comment-content-box">
          <div class="comment-author-name">
            ${this.escapeHTML(authorName)}
            ${isAnon ? `<span style="color: var(--neon-magenta); font-size: 0.7rem;">(Ghost)</span>` : ''}
          </div>
          <p class="comment-text">${this.escapeHTML(comment.content)}</p>
        </div>
      </div>
    `;
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatTimestamp(dateStr) {
    if (!dateStr) return '2d ago';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((now - date) / (1000 * 60 * 60));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  },

  renderPostCard(post) {
    return this.renderPost(post);
  }
};
