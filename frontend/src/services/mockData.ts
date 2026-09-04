import { 
  Camera, 
  SecurityEvent, 
  Alert, 
  FaceEvent, 
  ANPREvent, 
  Person, 
  Zone,
  SystemStatus,
  AnalyticsData,
  EventType
} from "@/types";
import { getEventSeverity } from "@/utils/severity";

const generateId = (): string => Math.random().toString(36).substr(2, 9);
const generateTimestamp = (minutesAgo: number = 0): string => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date.toISOString();
};

// ============ CAMERAS ============
export const mockCameras: Camera[] = [
  {
    id: "CAM-001",
    name: "BOP-01",
    location: "North Border Gate",
    status: "ONLINE",
    fps: 24,
    resolution: "1920x1080",
    lastHeartbeat: generateTimestamp(0),
    aiProcessing: true,
    onlineCount: 1,
  },
  {
    id: "CAM-002",
    name: "BOP-02",
    location: "East Check Post",
    status: "ONLINE",
    fps: 22,
    resolution: "1920x1080",
    lastHeartbeat: generateTimestamp(1),
    aiProcessing: true,
    onlineCount: 1,
  },
  {
    id: "CAM-003",
    name: "BOP-03",
    location: "Patrol Road - Sector A",
    status: "ONLINE",
    fps: 25,
    resolution: "1920x1080",
    lastHeartbeat: generateTimestamp(0),
    aiProcessing: true,
    onlineCount: 1,
  },
  {
    id: "CAM-004",
    name: "BOP-04",
    location: "South Entry Control",
    status: "ONLINE",
    fps: 23,
    resolution: "1920x1080",
    lastHeartbeat: generateTimestamp(2),
    aiProcessing: true,
    onlineCount: 1,
  },
];

// ============ PERSONS ============
export const mockPersons: Person[] = [
  {
    id: "P-001",
    name: "Authorized Officer - Raj Kumar",
    category: "AUTHORIZED_PERSONNEL",
    status: "ACTIVE",
    lastSeen: generateTimestamp(5),
    lastCamera: "CAM-001",
  },
  {
    id: "P-002",
    name: "Border Guard - Priya Singh",
    category: "AUTHORIZED_PERSONNEL",
    status: "ACTIVE",
    lastSeen: generateTimestamp(10),
    lastCamera: "CAM-002",
  },
  {
    id: "P-003",
    name: "Security Patrol - Vikram Patel",
    category: "AUTHORIZED_PERSONNEL",
    status: "ACTIVE",
    lastSeen: generateTimestamp(8),
    lastCamera: "CAM-003",
  },
];

// ============ ZONES ============
export const mockZones: Zone[] = [
  {
    id: "Z-001",
    cameraId: "CAM-001",
    name: "Restricted Zone A",
    type: "RESTRICTED",
    status: "ACTIVE",
  },
  {
    id: "Z-002",
    cameraId: "CAM-002",
    name: "No Entry Zone",
    type: "NO_ENTRY",
    status: "ACTIVE",
  },
  {
    id: "Z-003",
    cameraId: "CAM-003",
    name: "High Security Area",
    type: "HIGH_SECURITY",
    status: "ACTIVE",
  },
];

// ============ FACE EVENTS ============
export const generateMockFaceEvent = (cameraId: string, index: number): FaceEvent => ({
  id: generateId(),
  cameraId,
  timestamp: generateTimestamp(Math.floor(Math.random() * 60)),
  faceImageUrl: `https://via.placeholder.com/100?text=Face+${index}`,
  matchStatus: Math.random() > 0.5 ? "KNOWN" : "UNKNOWN",
  similarity: Math.floor(Math.random() * 30) + 70,
  matchedPersonId: Math.random() > 0.5 ? `P-${String(Math.floor(Math.random() * 3) + 1).padStart(3, "0")}` : undefined,
  matchedPersonName: Math.random() > 0.5 ? "Raj Kumar" : undefined,
  confidence: Math.floor(Math.random() * 20) + 80,
});

export const mockFaceEvents: FaceEvent[] = Array.from({ length: 8 }, (_, i) =>
  generateMockFaceEvent(mockCameras[i % 4].id, i)
);

// ============ ANPR EVENTS ============
export const generateMockANPREvent = (cameraId: string, index: number): ANPREvent => ({
  id: generateId(),
  cameraId,
  timestamp: generateTimestamp(Math.floor(Math.random() * 60)),
  vehicleImageUrl: `https://via.placeholder.com/120x80?text=Vehicle+${index}`,
  plateImageUrl: `https://via.placeholder.com/80x30?text=Plate`,
  plateNumber: `KA${String(Math.floor(Math.random() * 99) + 1).padStart(2, "0")}AB${String(Math.floor(Math.random() * 9999) + 1000).padStart(4, "0")}`,
  ocrConfidence: Math.floor(Math.random() * 20) + 85,
  status: Math.random() > 0.7 ? "UNKNOWN" : "AUTHORIZED",
});

export const mockANPREvents: ANPREvent[] = Array.from({ length: 6 }, (_, i) =>
  generateMockANPREvent(mockCameras[i % 4].id, i)
);

// ============ SECURITY EVENTS ============
export const generateMockSecurityEvent = (cameraId: string, eventType: EventType): SecurityEvent => {
  const timestamp = generateTimestamp(Math.floor(Math.random() * 120));
  return {
    id: generateId(),
    cameraId,
    eventType,
    severity: getEventSeverity(eventType),
    timestamp,
    confidence: Math.floor(Math.random() * 15) + 85,
    trackId: Math.floor(Math.random() * 100),
    description: `${eventType.replace(/_/g, " ")} detected in ${cameraId}`,
    status: Math.random() > 0.5 ? "ACTIVE" : "ACKNOWLEDGED",
  };
};

const eventTypes: EventType[] = [
  "PERSON_DETECTED",
  "VEHICLE_DETECTED",
  "INTRUSION",
  "UNKNOWN_FACE",
  "LOITERING",
];

export const mockSecurityEvents: SecurityEvent[] = Array.from({ length: 25 }, (_, i) =>
  generateMockSecurityEvent(
    mockCameras[i % 4].id,
    eventTypes[i % eventTypes.length]
  )
).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

// ============ ALERTS ============
export const mockAlerts: Alert[] = mockSecurityEvents
  .filter((e) => ["CRITICAL", "HIGH"].includes(e.severity))
  .slice(0, 5)
  .map((event) => ({
    id: generateId(),
    severity: event.severity,
    eventType: event.eventType,
    cameraId: event.cameraId,
    timestamp: event.timestamp,
    confidence: event.confidence || 85,
    status: event.status,
    description: event.description,
  }));

// ============ SYSTEM STATUS ============
export const mockSystemStatus: SystemStatus = {
  aiEngine: "ONLINE",
  videoProcessing: "ONLINE",
  database: "ONLINE",
  apiServer: "ONLINE",
  websocket: "CONNECTED",
  camerasOnline: 4,
  camerasTotal: 4,
  aiInferenceMs: Math.floor(Math.random() * 20) + 35,
  apiLatencyMs: Math.floor(Math.random() * 10) + 15,
  streamFps: 24,
};

// ============ ANALYTICS ============
export const generateAnalyticsData = (): AnalyticsData => {
  const last24Hours = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setHours(date.getHours() - (23 - i));
    return {
      timestamp: date.toISOString().split("T")[0] + " " + String(date.getHours()).padStart(2, "0") + ":00",
      count: Math.floor(Math.random() * 10) + 2,
    };
  });

  return {
    alertsTrend: last24Hours,
    intrusionsByCamera: mockCameras.map((cam) => ({
      camera: cam.name,
      count: Math.floor(Math.random() * 8) + 1,
    })),
    unknownFacesTrend: last24Hours,
    vehicleDetections: last24Hours,
    personDetections: last24Hours,
    eventDistribution: eventTypes.map((type) => ({
      type,
      count: Math.floor(Math.random() * 50) + 10,
    })),
    cameraActivity: mockCameras.map((cam) => ({
      camera: cam.name,
      events: Math.floor(Math.random() * 100) + 20,
    })),
  };
};

export const mockAnalyticsData = generateAnalyticsData();
