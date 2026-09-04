import { mapBackendToSecurityEvent } from "./api";
class WebSocketService {
    constructor() {
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "ws", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "reconnectTimeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isConnected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "intentionalClose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    getWsUrl() {
        if (typeof window !== "undefined" && window.location.host) {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/api/events/stream`;
        }
        return "ws://localhost:8000/api/events/stream";
    }
    connect(customUrl) {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return Promise.resolve();
        }
        this.intentionalClose = false;
        const url = customUrl || this.getWsUrl();
        return new Promise((resolve) => {
            try {
                console.log(`📡 [WebSocket] Connecting to ${url}...`);
                this.ws = new WebSocket(url);
                this.ws.onopen = () => {
                    this.isConnected = true;
                    console.log("✅ [WebSocket] Real-time event stream connected");
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const parsed = JSON.parse(event.data);
                        const payload = parsed.data || parsed;
                        const securityEvent = mapBackendToSecurityEvent(payload);
                        console.log("📨 [WebSocket] Real-time security alert:", securityEvent);
                        this.emit(securityEvent);
                    }
                    catch (err) {
                        console.error("Failed to parse WebSocket message:", err);
                    }
                };
                this.ws.onclose = () => {
                    this.isConnected = false;
                    console.log("⚠️ [WebSocket] Connection closed");
                    if (!this.intentionalClose) {
                        this.reconnectTimeout = setTimeout(() => this.connect(url), 3000);
                    }
                };
                this.ws.onerror = (err) => {
                    console.warn("WebSocket error, will retry:", err);
                    this.ws?.close();
                };
            }
            catch (err) {
                console.warn("Failed to create WebSocket:", err);
                resolve();
            }
        });
    }
    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
    subscribe(callback) {
        if (!this.listeners.includes(callback)) {
            this.listeners.push(callback);
        }
        if (!this.isConnected) {
            this.connect();
        }
    }
    unsubscribe(callback) {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }
    emit(event) {
        this.listeners.forEach((cb) => cb(event));
    }
    isReady() {
        return this.isConnected;
    }
}
export const wsService = new WebSocketService();
