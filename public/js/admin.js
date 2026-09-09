// DragMe Admin & Moderation Module
const AdminManager = {
  async openAdminDashboard() {
    if (!AuthState.currentUser || (AuthState.currentUser.role !== 'admin' && AuthState.currentUser.role !== 'moderator')) {
      showToast('Administrator or Moderator privileges required.', 'error');
      return;
    }

    try {
      const statsData = await API.getAdminStats();
      const reportsData = await API.getAdminReports();

      let modal = document.getElementById('admin-modal');
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = 'admin-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-window" style="max-width: 720px;">
          <div class="modal-header">
            <h3 style="font-family: var(--font-display); font-size: 1.25rem;">🛡️ DragMe Security & Moderation Console</h3>
            <button class="icon-btn" id="btn-admin-close">✕</button>
          </div>
          <div class="modal-body">
            <!-- Platform Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
              <div class="cyber-card" style="text-align: center; padding: 14px;">
                <div style="font-size: 1.3rem; font-weight: 800; color: #fff;">${statsData.stats.users_total}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Users</div>
              </div>
              <div class="cyber-card" style="text-align: center; padding: 14px;">
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--dragme-lime);">${statsData.stats.posts_total}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Posts</div>
              </div>
              <div class="cyber-card" style="text-align: center; padding: 14px;">
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--neon-magenta);">${statsData.stats.confessions_total}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Confessions</div>
              </div>
              <div class="cyber-card" style="text-align: center; padding: 14px;">
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--neon-cyan);">${statsData.stats.active_rooms}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Live Rooms</div>
              </div>
            </div>

            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 10px;">Pending Reports Triage</h4>
            <div id="admin-reports-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
              ${reportsData.reports.length === 0 ? `<p style="font-size: 0.84rem; color: var(--text-muted); text-align: center; padding: 20px;">No pending reports. Platform status clean.</p>` : ''}
              ${reportsData.reports.map(r => `
                <div style="background: #101118; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 700; color: #fff;">Reason: ${r.reason} (${r.target_type})</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Status: ${r.status}</div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-discuss-pill btn-resolve-report" data-report-id="${r.id}" data-action="dismiss">Dismiss</button>
                    <button class="btn-discuss-pill btn-resolve-report" data-report-id="${r.id}" data-action="action_taken" style="background: var(--neon-magenta); color: #fff;">Resolve</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#btn-admin-close').onclick = () => modal.classList.remove('open');
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

      modal.querySelectorAll('.btn-resolve-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          const reportId = btn.dataset.reportId;
          const action = btn.dataset.action;
          await API.resolveReport(reportId, action, 'Handled in console');
          showToast('Report updated!', 'success');
          btn.closest('div[style*="border"]').remove();
        });
      });

      modal.classList.add('open');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
