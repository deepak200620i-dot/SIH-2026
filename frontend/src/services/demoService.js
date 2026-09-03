import { mockCameras, mockPersons } from "./mockData";
class DemoModeService {
    constructor() {
        Object.defineProperty(this, "isRunning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "intervals", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    subscribe(callback) {
        this.listeners.push(callback);
    }
    unsubscribe(callback) {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }
    emit(event) {
        console.log("🎬 [Demo] Event:", event);
        this.listeners.forEach((cb) => cb(event));
    }
    async startDemo() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const camera1 = mockCameras[0]; // BOP-01
        const camera2 = mockCameras[1]; // BOP-02
        const camera3 = mockCameras[2]; // BOP-03
        const camera4 = mockCameras[3]; // BOP-04
        try {
            // Step 1: Person detected
            await this.delay(2000);
            this.emit({
                id: "demo-1",
                cameraId: camera1.id,
                eventType: "PERSON_DETECTED",
                severity: "LOW",
                timestamp: new Date().toISOString(),
                confidence: 92,
                trackId: 1,
                description: "Person detected in frame",
                status: "ACTIVE",
            });
            // Step 2: Person tracked
            await this.delay(3000);
            this.emit({
                id: "demo-2",
                cameraId: camera1.id,
                eventType: "PERSON_DETECTED",
                severity: "LOW",
                timestamp: new Date().toISOString(),
                confidence: 94,
                trackId: 1,
                description: "Person #1 being tracked",
                status: "ACTIVE",
            });
            // Step 3: INTRUSION ALERT
            await this.delay(3000);
            this.emit({
                id: "demo-3",
                cameraId: camera1.id,
                eventType: "INTRUSION",
                severity: "CRITICAL",
                timestamp: new Date().toISOString(),
                confidence: 96,
                trackId: 1,
                description: "⚠️ CRITICAL: Person entered restricted zone A",
                status: "ACTIVE",
            });
            // Step 4: Unknown face detected
            await this.delay(4000);
            this.emit({
                id: "demo-4",
                cameraId: camera2.id,
                eventType: "UNKNOWN_FACE",
                severity: "HIGH",
                timestamp: new Date().toISOString(),
                confidence: 89,
                description: "Unknown person detected - face recognition match 62%",
                status: "ACTIVE",
            });
            // Step 5: Face recognized (known person)
            await this.delay(3000);
            this.emit({
                id: "demo-5",
                cameraId: camera3.id,
                eventType: "FACE_RECOGNIZED",
                severity: "LOW",
                timestamp: new Date().toISOString(),
                confidence: 94,
                description: `Known person: ${mockPersons[0].name} detected`,
                status: "ACTIVE",
            });
            // Step 6: Vehicle detected
            await this.delay(3000);
            this.emit({
                id: "demo-6",
                cameraId: camera4.id,
                eventType: "VEHICLE_DETECTED",
                severity: "LOW",
                timestamp: new Date().toISOString(),
                confidence: 91,
                description: "Vehicle detected in frame",
                status: "ACTIVE",
            });
            // Step 7: ANPR result
            await this.delay(2000);
            this.emit({
                id: "demo-7",
                cameraId: camera4.id,
                eventType: "ANPR_DETECTED",
                severity: "LOW",
                timestamp: new Date().toISOString(),
                confidence: 94,
                description: "Vehicle plate detected: KA01AB1234 (Unknown)",
                status: "ACTIVE",
            });
            // Step 8: Another intrusion
            await this.delay(3000);
            this.emit({
                id: "demo-8",
                cameraId: camera2.id,
                eventType: "LOITERING",
                severity: "MEDIUM",
                timestamp: new Date().toISOString(),
                confidence: 88,
                description: "Person loitering in monitored area for 5+ minutes",
                status: "ACTIVE",
            });
            console.log("✅ [Demo] Sequence completed");
        }
        catch (error) {
            console.error("❌ [Demo] Error:", error);
        }
        finally {
            this.isRunning = false;
        }
    }
    stopDemo() {
        this.isRunning = false;
        this.intervals.forEach((interval) => clearInterval(interval));
        this.intervals = [];
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    isActive() {
        return this.isRunning;
    }
}
export const demoService = new DemoModeService();
