// Security Events & Alerts
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EventType = 
  | "PERSON_DETECTED"
  | "VEHICLE_DETECTED"
  | "FACE_RECOGNIZED"
  | "UNKNOWN_FACE"
  | "INTRUSION"
  | "ANPR_DETECTED"
  | "UNKNOWN_VEHICLE"
  | "LOITERING"
  | "RESTRICTED_ZONE_ENTRY";

export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED";
export type CameraStatus = "ONLINE" | "OFFLINE" | "WARNING";
export type FaceMatchStatus = "KNOWN" | "UNKNOWN" | "PARTIAL_MATCH";

// Camera
export interface Camera {
  id: string;
  name: string;
  source?: string;
  location: string;
  status: CameraStatus;
  fps: number;
  resolution: string;
  lastHeartbeat: string;
  aiProcessing: boolean;
  onlineCount?: number;
}

// Detection & Tracking
export interface Detection {
  id: string;
  cameraId: string;
  type: "PERSON" | "VEHICLE" | "FACE";
  confidence: number;
  bbox: BoundingBox;
  timestamp: string;
  trackId?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Track {
  id: number;
  type: "PERSON" | "VEHICLE";
  detections: Detection[];
  lastSeen: string;
  confidence: number;
}

// Persons & Vehicles
export interface Person {
  id: string;
  name: string;
  category: string;
  status: string;
  photoUrl?: string;
  lastSeen?: string;
  lastCamera?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  color?: string;
  type?: string;
  status: string;
  photoUrl?: string;
}

// Face Recognition
export interface FaceEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  faceImageUrl: string;
  matchStatus: FaceMatchStatus;
  similarity: number;
  matchedPersonId?: string;
  matchedPersonName?: string;
  confidence: number;
}

// ANPR - Automatic Number Plate Recognition
export interface ANPREvent {
  id: string;
  cameraId: string;
  timestamp: string;
  vehicleImageUrl: string;
  plateImageUrl: string;
  plateNumber: string;
  ocrConfidence: number;
  status: "AUTHORIZED" | "UNKNOWN" | "WATCHLIST";
}

// Security Events
export interface SecurityEvent {
  id: string;
  cameraId: string;
  eventType: EventType;
  severity: Severity;
  timestamp: string;
  confidence?: number;
  trackId?: number;
  personId?: string;
  vehicleId?: string;
  evidenceUrl?: string;
  description: string;
  status: AlertStatus;
  detailedInfo?: Record<string, any>;
}

// Alerts
export interface Alert {
  id: string;
  severity: Severity;
  eventType: EventType;
  cameraId: string;
  timestamp: string;
  confidence: number;
  status: AlertStatus;
  description: string;
  evidenceImageUrl?: string;
  relatedEvents?: string[];
}

// Zones
export interface Zone {
  id: string;
  cameraId: string;
  name: string;
  type: "RESTRICTED" | "NO_ENTRY" | "HIGH_SECURITY" | "MONITORING";
  status: "ACTIVE" | "INACTIVE";
  polygon?: { x: number; y: number }[];
}

// System Status
export interface SystemStatus {
  aiEngine: "ONLINE" | "OFFLINE" | "WARNING";
  videoProcessing: "ONLINE" | "OFFLINE" | "WARNING";
  database: "ONLINE" | "OFFLINE" | "WARNING";
  apiServer: "ONLINE" | "OFFLINE" | "WARNING";
  websocket: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
  camerasOnline: number;
  camerasTotal: number;
  aiInferenceMs: number;
  apiLatencyMs: number;
  streamFps: number;
}

// Analytics
export interface AnalyticsData {
  alertsTrend: { timestamp: string; count: number }[];
  intrusionsByCamera: { camera: string; count: number }[];
  unknownFacesTrend: { timestamp: string; count: number }[];
  vehicleDetections: { timestamp: string; count: number }[];
  personDetections: { timestamp: string; count: number }[];
  eventDistribution: { type: EventType; count: number }[];
  cameraActivity: { camera: string; events: number }[];
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
