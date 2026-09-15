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
  | "RESTRICTED_ZONE_ENTRY"
  | "DIRECTION_VIOLATION"
  | "CROWDING"
  | "RAPID_MOVEMENT"
  | "ABNORMAL_DWELL"
  | "REPEATED_ZONE_ENTRY"
  | "WEAPON_DETECTED";

export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED";
export type CameraStatus = "ONLINE" | "OFFLINE" | "WARNING";
export type FaceMatchStatus = "KNOWN" | "UNKNOWN" | "PARTIAL_MATCH";
export type Role = "admin" | "operator" | "auditor";
export type IntegrityStatus = "PENDING" | "VERIFIED" | "FAILED" | "NOT_AVAILABLE";
export type LedgerStatus = "PENDING" | "REGISTERED" | "FAILED" | "NOT_APPLICABLE";

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
  timeUnderCameraSeconds?: number;
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
  // Security fields
  evidenceSha256?: string;
  integrityStatus?: IntegrityStatus;
  ledgerStatus?: LedgerStatus;
  ledgerProvider?: string;
  ledgerRecordId?: string;
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

// Auth & Security
export interface User {
  id: number;
  username: string;
  role: Role;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
}

export interface AuditLogEntry {
  id: number;
  actor_username?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  timestamp: string;
  result?: string;
  metadata_json?: Record<string, any>;
  ip_address?: string;
}

export interface IntegrityCheckResponse {
  event_id: number;
  evidence_sha256?: string;
  integrity_status: string;
  snapshot_path?: string;
}

export interface LedgerRecord {
  event_id: number;
  provider?: string;
  record_id?: string;
  status: string;
  registered_at?: string;
  on_chain_data?: Record<string, any>;
}
