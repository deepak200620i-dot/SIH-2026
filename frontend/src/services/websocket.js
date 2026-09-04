import { mockCameras } from "./mockData";
import { getEventSeverity } from "@/utils/severity";
class WebSocketService {
    constructor() {
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "reconnectInterval", {
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
        Object.defineProperty(this, "mockEventInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    connect(url) {
        if (this.isConnected)
            return Promise.resolve();
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
    disconnect() {
        this.isConnected = false;
        if (this.mockEventInterval)
            clearInterval(this.mockEventInterval);
        if (this.reconnectInterval)
            clearInterval(this.reconnectInterval);
        console.log("❌ [WebSocket] Disconnected");
    }
    subscribe(callback) {
        if (!this.listeners.includes(callback)) {
            this.listeners.push(callback);
        }
    }
    unsubscribe(callback) {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }
    emit(event) {
        this.listeners.forEach((cb) => cb(event));
    }
    startMockEventGenerator() {
        if (this.mockEventInterval) {
            clearInterval(this.mockEventInterval);
        }
        const eventTypes = [
            "PERSON_DETECTED",
            "VEHICLE_DETECTED",
            "INTRUSION",
            "UNKNOWN_FACE",
            "LOITERING",
            "ANPR_DETECTED",
            "UNKNOWN_VEHICLE",
        ];
        this.mockEventInterval = setInterval(() => {
            if (!this.isConnected)
                return;
            // Random chance to generate event (30%)
            if (Math.random() > 0.7) {
                const randomEventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
                const randomCamera = mockCameras[Math.floor(Math.random() * mockCameras.length)];
                const event = {
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
    isReady() {
        return this.isConnected;
    }
}
export const wsService = new WebSocketService();
