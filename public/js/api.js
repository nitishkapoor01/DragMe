// DragMe Unified API Client
const API = {
  getToken() {
    return localStorage.getItem('dragme_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('dragme_token', token);
    } else {
      localStorage.removeItem('dragme_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Network request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth
  async register(username, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  async login(login, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async updateProfile(profileData) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  async getAnonymousPersona(seed) {
    return this.request(`/api/auth/anonymous-persona?seed=${encodeURIComponent(seed || '')}`);
  },

  // Posts
  async getPosts(filter = 'all', offset = 0, limit = 20) {
    return this.request(`/api/posts?filter=${filter}&offset=${offset}&limit=${limit}`);
  },

  async getPost(id) {
    return this.request(`/api/posts/${id}`);
  },

  async createPost(postData) {
    return this.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  },

  async toggleLike(postId) {
    return this.request(`/api/posts/${postId}/like`, { method: 'POST' });
  },

  async toggleSave(postId) {
    return this.request(`/api/posts/${postId}/save`, { method: 'POST' });
  },

  async sharePost(postId) {
    return this.request(`/api/posts/${postId}/share`, { method: 'POST' });
  },

  async votePoll(postId, optionIndex) {
    return this.request(`/api/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ option_index: optionIndex })
    });
  },

  async logView(postId, dwellMs) {
    return this.request(`/api/posts/${postId}/view`, {
      method: 'POST',
      body: JSON.stringify({ dwell_ms: dwellMs })
    });
  },

  async deletePost(postId) {
    return this.request(`/api/posts/${postId}`, { method: 'DELETE' });
  },

  // Comments
  async getComments(postId) {
    return this.request(`/api/posts/${postId}/comments`);
  },

  async addComment(postId, commentData) {
    return this.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  },

  async toggleCommentLike(commentId) {
    return this.request(`/api/posts/comment/${commentId}/like`, { method: 'POST' });
  },

  // Rooms
  async getRooms() {
    return this.request('/api/rooms');
  },

  async createRoom(roomData) {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData)
    });
  },

  async getRoom(id) {
    return this.request(`/api/rooms/${id}`);
  },

  async closeRoom(id) {
    return this.request(`/api/rooms/${id}`, { method: 'DELETE' });
  },

  // Upload
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('media', file);

    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  // Notifications
  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationsRead(id = null) {
    return this.request('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: id })
    });
  },

  // Admin
  async getAdminStats() {
    return this.request('/api/admin/stats');
  },

  async getAdminReports() {
    return this.request('/api/admin/reports');
  },

  async resolveReport(reportId, action, notes) {
    return this.request(`/api/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes })
    });
  },

  async getAdminUsers() {
    return this.request('/api/admin/users');
  },

  async banUser(userId, isBanned, reason) {
    return this.request(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ is_banned: isBanned, reason })
    });
  }
};

// Simple Toast Notification Helper
function showToast(message, type = 'normal') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
