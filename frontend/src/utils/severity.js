export const getEventSeverity = (eventType) => {
    const severityMap = {
        INTRUSION: "CRITICAL",
        UNKNOWN_FACE: "HIGH",
        RESTRICTED_ZONE_ENTRY: "HIGH",
        LOITERING: "MEDIUM",
        UNKNOWN_VEHICLE: "MEDIUM",
        FACE_RECOGNIZED: "LOW",
        PERSON_DETECTED: "LOW",
        VEHICLE_DETECTED: "LOW",
        ANPR_DETECTED: "LOW",
    };
    return severityMap[eventType];
};
export const shouldGenerateAlert = (eventType) => {
    const alertTypes = [
        "INTRUSION",
        "UNKNOWN_FACE",
        "LOITERING",
        "UNKNOWN_VEHICLE",
        "RESTRICTED_ZONE_ENTRY",
    ];
    return alertTypes.includes(eventType);
};
