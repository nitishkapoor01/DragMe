// DragMe Real-Time WebSocket Manager
class DragMeSocket {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = API.getToken();
    const url = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ''}`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('⚡ DragMe WebSocket connected.');
      this.startHeartbeat();

      // If we have an active token, authenticate
      if (token) {
        this.send({ type: 'AUTH', token });
      }

      this.emit('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message);
        this.emit('*', message);
      } catch (err) {
        console.error('WS Parse Error:', err);
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.stopHeartbeat();
      console.log('DragMe WebSocket disconnected. Reconnecting in 3s...');
      this.emit('disconnected');

      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = (err) => {
      console.error('WS Error:', err);
    };
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send WS message: Socket not open');
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;
    const callbacks = this.listeners.get(eventType).filter(cb => cb !== callback);
    this.listeners.set(eventType, callbacks);
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in WS event listener for ${eventType}:`, e);
        }
      });
    }
  }

  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING' });
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }
}

const wsClient = new DragMeSocket();
