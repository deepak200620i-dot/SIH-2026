const getDefaultWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined' && window.location.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/events/stream`;
  }
  return 'ws://localhost:8000/api/events/stream';
};

export const WS_URL = getDefaultWsUrl();


export default class WebSocketManager {
  constructor(url = WS_URL) {
    this.url = url;
    this.ws = null;
    this.status = 'disconnected';
    this.eventListeners = [];
    this.statusListeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 16000;
    this.baseDelay = 1000;
    this.reconnectTimer = null;
    this.intentionalClose = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalClose = false;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.ws.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          const payload = parsed.data || parsed;
          this.notifyEventListeners(payload);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        if (!this.intentionalClose) {
          this.reconnect();
        } else {
          this.setStatus('disconnected');
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.reconnect();
    }
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  reconnect() {
    this.setStatus('reconnecting');
    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  getStatus() {
    return this.status;
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyStatusListeners();
    }
  }

  notifyEventListeners(event) {
    this.eventListeners.forEach(callback => callback(event));
  }

  notifyStatusListeners() {
    this.statusListeners.forEach(callback => callback(this.status));
  }
}
