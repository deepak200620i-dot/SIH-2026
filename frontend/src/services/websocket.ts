import { SecurityEvent, EventType } from "@/types";
import { mockCameras } from "./mockData";
import { getEventSeverity } from "@/utils/severity";

type EventCallback = (event: SecurityEvent) => void;

class WebSocketService {
  private listeners: EventCallback[] = [];
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private mockEventInterval: NodeJS.Timeout | null = null;

  connect(url?: string): Promise<void> {
    if (this.isConnected) return Promise.resolve();
    return new Promise((resolve) => {
      // For now, using mock WebSocket
      // In production, replace with real WebSocket
      console.log("📡 [WebSocket] Connecting to event stream...");

      setTimeout(() => {
        this.isConnected = true;
        console.log("✅ [WebSocket] Connected");
        this.startMockEventGenerator();
        resolve();
      }, 500);
    });
  }

  disconnect(): void {
    this.isConnected = false;
    if (this.mockEventInterval) clearInterval(this.mockEventInterval);
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    console.log("❌ [WebSocket] Disconnected");
  }

  subscribe(callback: EventCallback): void {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }

  unsubscribe(callback: EventCallback): void {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  private emit(event: SecurityEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }

  private startMockEventGenerator(): void {
    if (this.mockEventInterval) {
      clearInterval(this.mockEventInterval);
    }

    const eventTypes: EventType[] = [
      "PERSON_DETECTED",
      "VEHICLE_DETECTED",
      "INTRUSION",
      "UNKNOWN_FACE",
      "LOITERING",
      "ANPR_DETECTED",
      "UNKNOWN_VEHICLE",
    ];

    this.mockEventInterval = setInterval(() => {
      if (!this.isConnected) return;

      // Random chance to generate event (30%)
      if (Math.random() > 0.7) {
        const randomEventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const randomCamera = mockCameras[Math.floor(Math.random() * mockCameras.length)];

        const event: SecurityEvent = {
          id: Math.random().toString(36).substr(2, 9),
          cameraId: randomCamera.id,
          eventType: randomEventType,
          severity: getEventSeverity(randomEventType),
          timestamp: new Date().toISOString(),
          confidence: Math.floor(Math.random() * 15) + 85,
          trackId: Math.floor(Math.random() * 100),
          description: `${randomEventType.replace(/_/g, " ")} at ${randomCamera.name}`,
          status: "ACTIVE",
        };

        console.log(`📨 [WebSocket] Event received:`, event);
        this.emit(event);
      }
    }, 5000); // Generate events every 5 seconds (30% chance)
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export const wsService = new WebSocketService();
