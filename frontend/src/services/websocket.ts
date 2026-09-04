import { SecurityEvent } from "@/types";
import { mapBackendToSecurityEvent } from "./api";

type EventCallback = (event: SecurityEvent) => void;

class WebSocketService {
  private listeners: EventCallback[] = [];
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private isConnected: boolean = false;
  private intentionalClose: boolean = false;

  private getWsUrl(): string {
    if (typeof window !== "undefined" && window.location.host) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/api/events/stream`;
    }
    return "ws://localhost:8000/api/events/stream";
  }

  connect(customUrl?: string): Promise<void> {
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
          } catch (err) {
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
      } catch (err) {
        console.warn("Failed to create WebSocket:", err);
        resolve();
      }
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  subscribe(callback: EventCallback): void {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
    if (!this.isConnected) {
      this.connect();
    }
  }

  unsubscribe(callback: EventCallback): void {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  private emit(event: SecurityEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export const wsService = new WebSocketService();
