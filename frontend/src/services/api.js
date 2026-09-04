import { mockCameras, mockSecurityEvents, mockAlerts, mockPersons, mockFaceEvents, mockANPREvents, mockZones, mockSystemStatus, mockAnalyticsData, } from "./mockData";
const getDefaultApiBase = () => {
    if (typeof window !== "undefined" && window.location.origin) {
        return window.location.origin;
    }
    return "http://localhost:8000";
};
const API_BASE = getDefaultApiBase();
// Helper to map backend event_type to Frontend EventType
const mapEventType = (rawType) => {
    const t = (rawType || "").toLowerCase();
    if (t === "intrusion")
        return "INTRUSION";
    if (t === "loitering")
        return "LOITERING";
    if (t === "face_match")
        return "FACE_RECOGNIZED";
    if (t === "face_unknown")
        return "UNKNOWN_FACE";
    if (t === "anpr")
        return "ANPR_DETECTED";
    if (t.includes("vehicle"))
        return "VEHICLE_DETECTED";
    if (t.includes("person"))
        return "PERSON_DETECTED";
    return "INTRUSION";
};
// Helper to map backend severity to Frontend Severity
const mapSeverity = (rawSev) => {
    const s = (rawSev || "").toUpperCase();
    if (s === "CRITICAL" || s === "HIGH" || s === "MEDIUM" || s === "LOW") {
        return s;
    }
    return "MEDIUM";
};
// Map backend event row to SecurityEvent
export const mapBackendToSecurityEvent = (raw) => {
    const eventType = mapEventType(raw.event_type || raw.eventType);
    const severity = mapSeverity(raw.severity);
    const desc = raw.description ||
        `${eventType.replace(/_/g, " ")} detected at ${raw.camera_id || raw.cameraId || "Camera 1"}`;
    return {
        id: String(raw.id || Math.random().toString(36).substr(2, 9)),
        cameraId: raw.camera_id || raw.cameraId || "cam_01",
        eventType,
        severity,
        timestamp: raw.timestamp || new Date().toISOString(),
        confidence: raw.confidence ? Math.round(raw.confidence * 100) : 90,
        trackId: raw.track_id || raw.trackId,
        personId: raw.face_name || raw.personId,
        vehicleId: raw.plate_text || raw.vehicleId,
        evidenceUrl: raw.snapshot
            ? `${API_BASE}/api/evidence/${raw.snapshot.replace(/^data\/evidence\//, "")}`
            : undefined,
        description: desc,
        status: "ACTIVE",
        detailedInfo: raw.metadata || {},
    };
};
// Map backend event row to Alert
export const mapBackendToAlert = (raw) => {
    const sec = mapBackendToSecurityEvent(raw);
    return {
        id: `alert-${sec.id}`,
        severity: sec.severity,
        eventType: sec.eventType,
        cameraId: sec.cameraId,
        timestamp: sec.timestamp,
        confidence: sec.confidence || 90,
        status: "ACTIVE",
        description: sec.description,
        evidenceImageUrl: sec.evidenceUrl,
        relatedEvents: [sec.id],
    };
};
// ============ CAMERAS ============
export const apiGetCameras = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/cameras`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data.map((c) => ({
                    id: c.id,
                    name: c.name || c.id,
                    location: c.source || "Border Perimeter",
                    status: c.status === "active" || c.status === "online" ? "ONLINE" : "OFFLINE",
                    fps: 30,
                    resolution: "1080p",
                    lastHeartbeat: new Date().toISOString(),
                    aiProcessing: true,
                    onlineCount: 1,
                }));
            }
        }
    }
    catch (err) {
        console.warn("Falling back to mock cameras:", err);
    }
    return mockCameras;
};
export const apiGetCamera = async (cameraId) => {
    const cams = await apiGetCameras();
    return cams.find((c) => c.id === cameraId) || null;
};
export const apiGetCameraStatus = async (cameraId) => {
    try {
        const res = await fetch(`${API_BASE}/api/events?camera_id=${cameraId}&limit=5`);
        if (res.ok) {
            const data = await res.json();
            const items = data.items || [];
            return {
                cameraId,
                peopleCount: items.filter((e) => e.class_name === "person").length || 1,
                vehicleCount: items.filter((e) => e.class_name === "car").length || 0,
                lastAlert: items[0] ? mapBackendToAlert(items[0]) : null,
            };
        }
    }
    catch (err) { }
    return {
        cameraId,
        peopleCount: 1,
        vehicleCount: 0,
        lastAlert: null,
    };
};
// ============ EVENTS ============
export const apiGetEvents = async (page = 1, pageSize = 20, filters) => {
    try {
        const offset = (page - 1) * pageSize;
        let url = `${API_BASE}/api/events?limit=${pageSize}&offset=${offset}`;
        if (filters?.severity)
            url += `&severity=${filters.severity.toLowerCase()}`;
        if (filters?.cameraId)
            url += `&camera_id=${filters.cameraId}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const items = (data.items || []).map(mapBackendToSecurityEvent);
            const total = data.total ?? items.length;
            return {
                items,
                total,
                page,
                pageSize,
                hasMore: offset + pageSize < total,
            };
        }
    }
    catch (err) {
        console.warn("Falling back to mock events:", err);
    }
    const start = (page - 1) * pageSize;
    const items = mockSecurityEvents.slice(start, start + pageSize);
    return {
        items,
        total: mockSecurityEvents.length,
        page,
        pageSize,
        hasMore: start + pageSize < mockSecurityEvents.length,
    };
};
export const apiGetEvent = async (eventId) => {
    try {
        const res = await fetch(`${API_BASE}/api/events/${eventId}`);
        if (res.ok) {
            const data = await res.json();
            return mapBackendToSecurityEvent(data);
        }
    }
    catch (err) { }
    return mockSecurityEvents.find((e) => e.id === eventId) || null;
};
// ============ ALERTS ============
export const apiGetAlerts = async (page = 1, pageSize = 20, filters) => {
    try {
        const offset = (page - 1) * pageSize;
        let url = `${API_BASE}/api/events?limit=${pageSize}&offset=${offset}`;
        if (filters?.severity)
            url += `&severity=${filters.severity.toLowerCase()}`;
        if (filters?.cameraId)
            url += `&camera_id=${filters.cameraId}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const items = (data.items || []).map(mapBackendToAlert);
            const total = data.total ?? items.length;
            return {
                items,
                total,
                page,
                pageSize,
                hasMore: offset + pageSize < total,
            };
        }
    }
    catch (err) {
        console.warn("Falling back to mock alerts:", err);
    }
    const start = (page - 1) * pageSize;
    const items = mockAlerts.slice(start, start + pageSize);
    return {
        items,
        total: mockAlerts.length,
        page,
        pageSize,
        hasMore: start + pageSize < mockAlerts.length,
    };
};
export const apiGetAlert = async (alertId) => {
    const cleanId = alertId.replace(/^alert-/, "");
    const evt = await apiGetEvent(cleanId);
    if (evt)
        return mapBackendToAlert(evt);
    return mockAlerts.find((a) => a.id === alertId) || null;
};
export const apiUpdateAlertStatus = async (alertId, status) => {
    return true;
};
// ============ PERSONS (Known Faces) ============
export const apiGetPersons = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/faces`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data.map((f) => ({
                    id: String(f.id),
                    name: f.name,
                    category: "Personnel",
                    status: "Active",
                    photoUrl: f.image_url ? `${API_BASE}${f.image_url}` : undefined,
                    lastSeen: f.created_at,
                    lastCamera: "cam_01",
                }));
            }
        }
    }
    catch (err) { }
    return mockPersons;
};
export const apiAddPerson = async (person) => {
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: person.name || "Unknown",
        category: person.category || "Personnel",
        status: person.status || "Active",
        photoUrl: person.photoUrl,
        lastSeen: new Date().toISOString(),
    };
};
export const apiDeletePerson = async (personId) => {
    try {
        const res = await fetch(`${API_BASE}/api/faces/${personId}`, { method: "DELETE" });
        return res.ok;
    }
    catch (err) {
        return false;
    }
};
// ============ FACE EVENTS ============
export const apiGetFaceEvents = async (page = 1, pageSize = 20) => {
    try {
        const offset = (page - 1) * pageSize;
        const res = await fetch(`${API_BASE}/api/events?limit=${pageSize}&offset=${offset}`);
        if (res.ok) {
            const data = await res.json();
            const faceEvts = (data.items || []).filter((e) => ["face_match", "face_unknown"].includes(e.event_type));
            if (faceEvts.length > 0) {
                const items = faceEvts.map((e) => ({
                    id: String(e.id),
                    cameraId: e.camera_id || "cam_01",
                    timestamp: e.timestamp,
                    faceImageUrl: e.snapshot ? `${API_BASE}/api/evidence/${e.snapshot.replace(/^data\/evidence\//, "")}` : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
                    matchStatus: (e.event_type === "face_match" ? "KNOWN" : "UNKNOWN"),
                    similarity: e.confidence ? Math.round(e.confidence * 100) : 85,
                    matchedPersonName: e.face_name,
                    confidence: e.confidence ? Math.round(e.confidence * 100) : 90,
                }));
                return {
                    items,
                    total: data.total ?? items.length,
                    page,
                    pageSize,
                    hasMore: offset + pageSize < (data.total ?? items.length),
                };
            }
        }
    }
    catch (err) { }
    const start = (page - 1) * pageSize;
    const items = mockFaceEvents.slice(start, start + pageSize);
    return {
        items,
        total: mockFaceEvents.length,
        page,
        pageSize,
        hasMore: start + pageSize < mockFaceEvents.length,
    };
};
// ============ ANPR EVENTS ============
export const apiGetANPREvents = async (page = 1, pageSize = 20) => {
    try {
        const offset = (page - 1) * pageSize;
        const res = await fetch(`${API_BASE}/api/events?limit=${pageSize}&offset=${offset}`);
        if (res.ok) {
            const data = await res.json();
            const anprEvts = (data.items || []).filter((e) => e.event_type === "anpr");
            if (anprEvts.length > 0) {
                const items = anprEvts.map((e) => ({
                    id: String(e.id),
                    cameraId: e.camera_id || "cam_03",
                    timestamp: e.timestamp,
                    vehicleImageUrl: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400",
                    plateImageUrl: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=200",
                    plateNumber: e.plate_text || "DL01AB1234",
                    ocrConfidence: e.confidence ? Math.round(e.confidence * 100) : 95,
                    status: "AUTHORIZED",
                }));
                return {
                    items,
                    total: data.total ?? items.length,
                    page,
                    pageSize,
                    hasMore: offset + pageSize < (data.total ?? items.length),
                };
            }
        }
    }
    catch (err) { }
    const start = (page - 1) * pageSize;
    const items = mockANPREvents.slice(start, start + pageSize);
    return {
        items,
        total: mockANPREvents.length,
        page,
        pageSize,
        hasMore: start + pageSize < mockANPREvents.length,
    };
};
// ============ ZONES ============
export const apiGetZones = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/config/fence`);
        if (res.ok) {
            const data = await res.json();
            const zones = data.zones || [];
            if (zones.length > 0) {
                return zones.map((z, idx) => ({
                    id: `zone-${idx + 1}`,
                    cameraId: "cam_01",
                    name: z.name,
                    type: z.severity === "critical" ? "HIGH_SECURITY" : "RESTRICTED",
                    status: "ACTIVE",
                    polygon: (z.polygon || []).map(([x, y]) => ({ x, y })),
                }));
            }
        }
    }
    catch (err) { }
    return mockZones;
};
export const apiAddZone = async (zone) => {
    return {
        id: `zone-${Date.now()}`,
        cameraId: zone.cameraId || "cam_01",
        name: zone.name || "New Zone",
        type: zone.type || "RESTRICTED",
        status: "ACTIVE",
        polygon: zone.polygon,
    };
};
export const apiUpdateZone = async (zoneId, updates) => {
    const zones = await apiGetZones();
    const zone = zones.find((z) => z.id === zoneId);
    return zone ? { ...zone, ...updates } : null;
};
export const apiDeleteZone = async (zoneId) => {
    return true;
};
// ============ SYSTEM STATUS ============
export const apiGetSystemStatus = async () => {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const isOnline = res.ok;
        return {
            aiEngine: isOnline ? "ONLINE" : "OFFLINE",
            videoProcessing: isOnline ? "ONLINE" : "OFFLINE",
            database: isOnline ? "ONLINE" : "OFFLINE",
            apiServer: isOnline ? "ONLINE" : "OFFLINE",
            websocket: isOnline ? "CONNECTED" : "DISCONNECTED",
            camerasOnline: 4,
            camerasTotal: 4,
            aiInferenceMs: 14.2,
            apiLatencyMs: 8.5,
            streamFps: 30.0,
        };
    }
    catch (err) {
        return mockSystemStatus;
    }
};
// ============ ANALYTICS ============
export const apiGetAnalytics = async () => {
    return mockAnalyticsData;
};
// ============ DASHBOARD STATS ============
export const apiGetDashboardStats = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/events/stats`);
        if (res.ok) {
            const stats = await res.json();
            const byType = stats.by_type || {};
            const bySev = stats.by_severity || {};
            return {
                camerasOnline: stats.active_cameras ?? 4,
                camerasTotal: 4,
                activeAlerts: (bySev.critical || 0) + (bySev.high || 0),
                peopleDetected: byType.intrusion || 0,
                vehiclesDetected: byType.anpr || 0,
                unknownFaces: byType.face_unknown || 0,
                intrusionsToday: byType.intrusion || 0,
                threatLevel: (bySev.critical || 0) > 0 ? "CRITICAL" : (bySev.high || 0) > 0 ? "HIGH" : "LOW",
            };
        }
    }
    catch (err) {
        console.warn("Falling back to mock dashboard stats:", err);
    }
    return {
        camerasOnline: 4,
        camerasTotal: 4,
        activeAlerts: 0,
        peopleDetected: 0,
        vehiclesDetected: 0,
        unknownFaces: 0,
        intrusionsToday: 0,
        threatLevel: "LOW",
    };
};
