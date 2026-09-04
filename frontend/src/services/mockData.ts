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
} from "@/types";

// Zero fake data — all collections start empty
export const mockCameras: Camera[] = [];
export const mockSecurityEvents: SecurityEvent[] = [];
export const mockAlerts: Alert[] = [];
export const mockPersons: Person[] = [];
export const mockFaceEvents: FaceEvent[] = [];
export const mockANPREvents: ANPREvent[] = [];
export const mockZones: Zone[] = [];

export const mockSystemStatus: SystemStatus = {
  aiEngine: "ONLINE",
  videoProcessing: "ONLINE",
  database: "ONLINE",
  apiServer: "ONLINE",
  websocket: "CONNECTED",
  camerasOnline: 0,
  camerasTotal: 0,
  aiInferenceMs: 0,
  apiLatencyMs: 0,
  streamFps: 0,
};

export const mockAnalyticsData: AnalyticsData = {
  alertsTrend: [],
  intrusionsByCamera: [],
  unknownFacesTrend: [],
  vehicleDetections: [],
  personDetections: [],
  eventDistribution: [],
  cameraActivity: [],
};
