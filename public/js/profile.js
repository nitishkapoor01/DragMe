// DragMe Profile & Karma Showcase
const ProfileManager = {
  async openProfileModal() {
    if (!AuthState.currentUser) return openAuthModal('login');

    try {
      const data = await API.getMe();
      const u = data.user;
      const s = data.stats;

      let modal = document.getElementById('profile-modal');
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = 'profile-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-window" style="max-width: 540px;">
          <div style="height: 120px; background: linear-gradient(135deg, rgba(163, 230, 53, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%); position: relative;">
            <button class="icon-btn" id="btn-profile-close" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.5);">✕</button>
          </div>
          <div style="padding: 0 24px 24px 24px; position: relative;">
            <img src="${u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}" style="width: 72px; height: 72px; border-radius: 50%; border: 3px solid #13141b; margin-top: -36px; object-fit: cover;">
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
              <div>
                <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">@${u.username}</h3>
                <span class="user-badge-pill" style="font-size: 0.72rem;">${u.badge || 'Neon Pioneer'}</span>
              </div>
              <div class="header-streak-badge" style="background: rgba(163, 230, 53, 0.15); color: var(--dragme-lime);">
                ⚡ ${u.karma || 100} Karma
              </div>
            </div>

            <p style="font-size: 0.88rem; color: var(--text-secondary); margin: 12px 0 16px 0; line-height: 1.5;">
              ${u.bio || 'Exploring the dual-identity realm on DragMe.'}
            </p>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #0c0d12; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px; text-align: center;">
              <div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${s?.post_count || 0}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Posts</div>
              </div>
              <div>
                <div style="font-size: 1.1rem; font-weight: 800; color: var(--neon-magenta);">${s?.confession_count || 0}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Confessions</div>
              </div>
              <div>
                <div style="font-size: 1.1rem; font-weight: 800; color: var(--dragme-lime);">${s?.likes_received || 0}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Likes Echoed</div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#btn-profile-close').onclick = () => modal.classList.remove('open');
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

      modal.classList.add('open');
    } catch (err) {
      showToast('Failed to load profile.', 'error');
    }
  }
};
