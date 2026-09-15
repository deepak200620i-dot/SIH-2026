import { Severity, EventType } from "@/types";

export const getEventSeverity = (eventType: EventType): Severity => {
  const severityMap: Record<EventType, Severity> = {
    INTRUSION: "CRITICAL",
    WEAPON_DETECTED: "CRITICAL",
    DIRECTION_VIOLATION: "HIGH",
    REPEATED_ZONE_ENTRY: "HIGH",
    UNKNOWN_FACE: "HIGH",
    RESTRICTED_ZONE_ENTRY: "HIGH",
    LOITERING: "MEDIUM",
    CROWDING: "MEDIUM",
    RAPID_MOVEMENT: "MEDIUM",
    ABNORMAL_DWELL: "MEDIUM",
    UNKNOWN_VEHICLE: "MEDIUM",
    FACE_RECOGNIZED: "LOW",
    PERSON_DETECTED: "LOW",
    VEHICLE_DETECTED: "LOW",
    ANPR_DETECTED: "LOW",
  };
  return severityMap[eventType] || "MEDIUM";
};

export const shouldGenerateAlert = (eventType: EventType): boolean => {
  const alertTypes: EventType[] = [
    "INTRUSION",
    "WEAPON_DETECTED",
    "UNKNOWN_FACE",
    "LOITERING",
    "UNKNOWN_VEHICLE",
    "RESTRICTED_ZONE_ENTRY",
    "DIRECTION_VIOLATION",
    "REPEATED_ZONE_ENTRY",
    "CROWDING",
    "RAPID_MOVEMENT",
    "ABNORMAL_DWELL",
  ];
  return alertTypes.includes(eventType);
};
