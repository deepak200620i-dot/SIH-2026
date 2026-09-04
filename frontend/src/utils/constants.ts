const environment = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

export const API_BASE_URL = environment.VITE_API_URL || "http://localhost:8000/api";
export const WS_URL = environment.VITE_WS_URL || "ws://localhost:8000/ws";

export const EVENT_TYPES: Record<string, string> = {
  PERSON_DETECTED: "Person Detected",
  VEHICLE_DETECTED: "Vehicle Detected",
  FACE_RECOGNIZED: "Face Recognized",
  UNKNOWN_FACE: "Unknown Face",
  INTRUSION: "Intrusion Detected",
  ANPR_DETECTED: "Vehicle Plate Detected",
  UNKNOWN_VEHICLE: "Unknown Vehicle",
  LOITERING: "Loitering Detected",
  RESTRICTED_ZONE_ENTRY: "Restricted Zone Entry",
};

export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const SEVERITY_COLORS = {
  CRITICAL: { bg: "bg-red-900", text: "text-red-400", badge: "bg-red-500" },
  HIGH: { bg: "bg-orange-900", text: "text-orange-400", badge: "bg-orange-500" },
  MEDIUM: { bg: "bg-yellow-900", text: "text-yellow-400", badge: "bg-yellow-500" },
  LOW: { bg: "bg-blue-900", text: "text-blue-400", badge: "bg-blue-500" },
};

export const CAMERA_STATUS_COLORS = {
  ONLINE: "bg-green-500",
  OFFLINE: "bg-red-500",
  WARNING: "bg-yellow-500",
};

export const FACE_MATCH_COLORS = {
  KNOWN: "text-green-400",
  UNKNOWN: "text-red-400",
  PARTIAL_MATCH: "text-yellow-400",
};
