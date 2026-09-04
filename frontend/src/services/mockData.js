// Zero fake data — all collections start empty
export const mockCameras = [];
export const mockSecurityEvents = [];
export const mockAlerts = [];
export const mockPersons = [];
export const mockFaceEvents = [];
export const mockANPREvents = [];
export const mockZones = [];
export const mockSystemStatus = {
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
export const mockAnalyticsData = {
    alertsTrend: [],
    intrusionsByCamera: [],
    unknownFacesTrend: [],
    vehicleDetections: [],
    personDetections: [],
    eventDistribution: [],
    cameraActivity: [],
};
