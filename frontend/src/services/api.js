import { mockCameras, mockSecurityEvents, mockAlerts, mockPersons, mockFaceEvents, mockANPREvents, mockZones, mockSystemStatus, mockAnalyticsData, } from "./mockData";
// Simulate network delay
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
// ============ CAMERAS ============
export const apiGetCameras = async () => {
    await delay();
    return mockCameras;
};
export const apiGetCamera = async (cameraId) => {
    await delay();
    return mockCameras.find((c) => c.id === cameraId) || null;
};
export const apiGetCameraStatus = async (cameraId) => {
    await delay();
    const camera = mockCameras.find((c) => c.id === cameraId);
    if (!camera)
        return null;
    return {
        cameraId,
        peopleCount: Math.floor(Math.random() * 5),
        vehicleCount: Math.floor(Math.random() * 3),
        lastAlert: mockAlerts[0] || null,
    };
};
// ============ EVENTS ============
export const apiGetEvents = async (page = 1, pageSize = 20, filters) => {
    await delay();
    let events = [...mockSecurityEvents];
    if (filters?.cameraId) {
        events = events.filter((e) => e.cameraId === filters.cameraId);
    }
    if (filters?.eventType) {
        events = events.filter((e) => e.eventType === filters.eventType);
    }
    if (filters?.severity) {
        events = events.filter((e) => e.severity === filters.severity);
    }
    const total = events.length;
    const start = (page - 1) * pageSize;
    const items = events.slice(start, start + pageSize);
    return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    };
};
export const apiGetEvent = async (eventId) => {
    await delay();
    return mockSecurityEvents.find((e) => e.id === eventId) || null;
};
// ============ ALERTS ============
export const apiGetAlerts = async (page = 1, pageSize = 20, filters) => {
    await delay();
    let alerts = [...mockAlerts];
    if (filters?.severity) {
        alerts = alerts.filter((a) => a.severity === filters.severity);
    }
    if (filters?.cameraId) {
        alerts = alerts.filter((a) => a.cameraId === filters.cameraId);
    }
    const total = alerts.length;
    const start = (page - 1) * pageSize;
    const items = alerts.slice(start, start + pageSize);
    return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    };
};
export const apiUpdateAlertStatus = async (alertId, status) => {
    await delay();
    const alert = mockAlerts.find((a) => a.id === alertId);
    if (alert) {
        alert.status = status;
        return true;
    }
    return false;
};
// ============ PERSONS ============
export const apiGetPersons = async () => {
    await delay();
    return mockPersons;
};
export const apiGetPerson = async (personId) => {
    await delay();
    return mockPersons.find((p) => p.id === personId) || null;
};
// ============ FACE RECOGNITION ============
export const apiGetFaceEvents = async (page = 1, pageSize = 20) => {
    await delay();
    const total = mockFaceEvents.length;
    const start = (page - 1) * pageSize;
    const items = mockFaceEvents.slice(start, start + pageSize);
    return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    };
};
// ============ ANPR ============
export const apiGetANPREvents = async (page = 1, pageSize = 20) => {
    await delay();
    const total = mockANPREvents.length;
    const start = (page - 1) * pageSize;
    const items = mockANPREvents.slice(start, start + pageSize);
    return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    };
};
// ============ ZONES ============
export const apiGetZones = async () => {
    await delay();
    return mockZones;
};
export const apiGetZone = async (zoneId) => {
    await delay();
    return mockZones.find((z) => z.id === zoneId) || null;
};
// ============ SYSTEM STATUS ============
export const apiGetSystemStatus = async () => {
    await delay();
    return {
        ...mockSystemStatus,
        aiInferenceMs: Math.floor(Math.random() * 20) + 35,
        apiLatencyMs: Math.floor(Math.random() * 10) + 15,
    };
};
// ============ ANALYTICS ============
export const apiGetAnalytics = async () => {
    await delay();
    return mockAnalyticsData;
};
// ============ DASHBOARD STATS ============
export const apiGetDashboardStats = async () => {
    await delay();
    return {
        camerasOnline: mockCameras.filter((c) => c.status === "ONLINE").length,
        camerasTotal: mockCameras.length,
        activeAlerts: mockAlerts.filter((a) => a.status === "ACTIVE").length,
        peopleDetected: Math.floor(Math.random() * 20) + 5,
        vehiclesDetected: Math.floor(Math.random() * 10) + 2,
        unknownFaces: mockFaceEvents.filter((f) => f.matchStatus === "UNKNOWN").length,
        intrusionsToday: mockSecurityEvents.filter((e) => e.eventType === "INTRUSION").length,
    };
};
