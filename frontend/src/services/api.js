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
const mapFrontendEventTypeToBackend = (eventType) => {
    const types = {
        INTRUSION: "intrusion", LOITERING: "loitering", FACE_RECOGNIZED: "face_match",
        UNKNOWN_FACE: "face_unknown", ANPR_DETECTED: "anpr", PERSON_DETECTED: "person_detected",
        VEHICLE_DETECTED: "vehicle_detected", RESTRICTED_ZONE_ENTRY: "intrusion",
    };
    return types[eventType] || eventType.toLowerCase();
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
        status: raw.status || "ACTIVE",
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
        status: sec.status,
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
            if (Array.isArray(data)) {
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
        console.warn("Failed to fetch cameras:", err);
    }
    return [];
};
export const apiAddCamera = async (camera) => {
    try {
        const res = await fetch(`${API_BASE}/api/cameras`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: camera.id,
                name: camera.name,
                source: camera.source,
                status: camera.status || "active",
            }),
        });
        return res.ok;
    }
    catch (err) {
        console.error("Failed to add camera:", err);
        return false;
    }
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
                peopleCount: items.filter((e) => e.class_name === "person").length,
                vehicleCount: items.filter((e) => e.class_name === "car").length,
                lastAlert: items[0] ? mapBackendToAlert(items[0]) : null,
            };
        }
    }
    catch (err) { }
    return {
        cameraId,
        peopleCount: 0,
        vehicleCount: 0,
        lastAlert: null,
    };
};
export const apiUploadVideo = async (file, cameraId = "upload_cam_01", frameSkip = 5) => {
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("camera_id", cameraId);
        formData.append("frame_skip", String(frameSkip));
        formData.append("max_frames", "150");
        const res = await fetch(`${API_BASE}/api/video/upload`, {
            method: "POST",
            body: formData,
        });
        if (res.ok) {
            const data = await res.json();
            return { success: true, data };
        }
        else {
            const errData = await res.json().catch(() => ({}));
            return {
                success: false,
                error: errData.detail || `Server error (HTTP ${res.status})`,
            };
        }
    }
    catch (err) {
        return {
            success: false,
            error: err?.message || "Network request failed. Ensure backend is running.",
        };
    }
};
export const apiProcessWebcamFrame = async (base64Image, cameraId = "webcam_01", frameIndex = 0) => {
    try {
        const res = await fetch(`${API_BASE}/api/video/process-frame`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image: base64Image,
                camera_id: cameraId,
                frame_index: frameIndex,
            }),
        });
        if (res.ok) {
            return await res.json();
        }
        else {
            console.warn(`[Webcam API] process-frame failed: HTTP ${res.status}`);
        }
    }
    catch (err) {
        console.warn("[Webcam API] Network error during frame processing:", err);
    }
    return null;
};
// ============ EVENTS ============
export const apiGetEvents = async (page = 1, pageSize = 20, filters) => {
    try {
        const offset = (page - 1) * pageSize;
        let url = `${API_BASE}/api/events?limit=${pageSize}&offset=${offset}`;
        if (filters?.severity)
            url += `&severity=${filters.severity.toLowerCase()}`;
        if (filters?.eventType)
            url += `&event_type=${encodeURIComponent(mapFrontendEventTypeToBackend(filters.eventType))}`;
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
        console.warn("Failed to fetch events:", err);
    }
    return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
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
    return null;
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
        console.warn("Failed to fetch alerts:", err);
    }
    return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
    };
};
export const apiGetAlert = async (alertId) => {
    const cleanId = alertId.replace(/^alert-/, "");
    const evt = await apiGetEvent(cleanId);
    if (evt)
        return mapBackendToAlert(evt);
    return null;
};
export const apiUpdateAlertStatus = async (alertId, status) => {
    try {
        const eventId = alertId.replace(/^alert-/, "");
        const res = await fetch(`${API_BASE}/api/events/${eventId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        return res.ok;
    }
    catch (err) {
        console.error("Failed to update alert status:", err);
        return false;
    }
};
// ============ PERSONS (Known Faces) ============
export const apiGetPersons = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/faces`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
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
    return [];
};
export const apiAddPerson = async (person) => {
    throw new Error("Use apiUploadPerson with an image file.");
};
export const apiUploadPerson = async (name, image) => {
    try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("image", image);
        const res = await fetch(`${API_BASE}/api/faces`, { method: "POST", body: formData });
        if (!res.ok)
            return null;
        const face = await res.json();
        return {
            id: String(face.id), name: face.name, category: "Personnel", status: "Active",
            photoUrl: face.image_url ? `${API_BASE}${face.image_url}` : undefined,
            lastSeen: face.created_at, lastCamera: "cam_01",
        };
    }
    catch (err) {
        console.error("Failed to upload person:", err);
        return null;
    }
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
            const items = faceEvts.map((e) => ({
                id: String(e.id),
                cameraId: e.camera_id || "cam_01",
                timestamp: e.timestamp,
                faceImageUrl: e.snapshot ? `${API_BASE}/api/evidence/${e.snapshot.replace(/^data\/evidence\//, "")}` : "/favicon.svg",
                matchStatus: (e.event_type === "face_match" ? "KNOWN" : "UNKNOWN"),
                similarity: e.confidence ? Math.round(e.confidence * 100) : 85,
                matchedPersonName: e.face_name,
                confidence: e.confidence ? Math.round(e.confidence * 100) : 90,
            }));
            return {
                items,
                total: items.length,
                page,
                pageSize,
                hasMore: offset + pageSize < items.length,
            };
        }
    }
    catch (err) { }
    return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
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
            const items = anprEvts.map((e) => ({
                id: String(e.id),
                cameraId: e.camera_id || "cam_03",
                timestamp: e.timestamp,
                vehicleImageUrl: e.snapshot ? `${API_BASE}/api/evidence/${e.snapshot.replace(/^data\/evidence\//, "")}` : "/favicon.svg",
                plateImageUrl: e.snapshot ? `${API_BASE}/api/evidence/${e.snapshot.replace(/^data\/evidence\//, "")}` : "/favicon.svg",
                plateNumber: e.plate_text || "UNKNOWN",
                ocrConfidence: e.confidence ? Math.round(e.confidence * 100) : 95,
                status: "AUTHORIZED",
            }));
            return {
                items,
                total: items.length,
                page,
                pageSize,
                hasMore: offset + pageSize < items.length,
            };
        }
    }
    catch (err) { }
    return {
        items: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
    };
};
export const apiGetFenceZones = async (cameraId) => {
    try {
        const url = cameraId && cameraId !== "all"
            ? `${API_BASE}/api/zones?camera_id=${cameraId}`
            : `${API_BASE}/api/zones`;
        const res = await fetch(url);
        if (res.ok) {
            return await res.json();
        }
    }
    catch (err) {
        console.warn("Failed to fetch zones:", err);
    }
    return [];
};
export const apiCreateFenceZone = async (zone) => {
    try {
        const res = await fetch(`${API_BASE}/api/zones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: zone.name,
                polygon: zone.polygon,
                severity: zone.severity.toLowerCase(),
                camera_id: zone.camera_id || "all",
            }),
        });
        if (res.ok) {
            return await res.json();
        }
    }
    catch (err) {
        console.error("Failed to create zone:", err);
    }
    return null;
};
export const apiDeleteFenceZone = async (zoneId) => {
    try {
        const res = await fetch(`${API_BASE}/api/zones/${zoneId}`, {
            method: "DELETE",
        });
        return res.ok;
    }
    catch (err) {
        console.error("Failed to delete zone:", err);
        return false;
    }
};
export const apiGetZones = async () => {
    const backendZones = await apiGetFenceZones();
    if (backendZones.length > 0) {
        return backendZones.map((z) => ({
            id: String(z.id),
            cameraId: z.camera_id,
            name: z.name,
            type: z.severity === "critical" ? "HIGH_SECURITY" : "RESTRICTED",
            status: "ACTIVE",
            polygon: (z.polygon || []).map(([x, y]) => ({ x, y })),
            severity: z.severity,
        }));
    }
    return [];
};
export const apiAddZone = async (zone) => {
    const polygonArr = (zone.polygon || []).map((p) => [Math.round(p.x), Math.round(p.y)]);
    const created = await apiCreateFenceZone({
        name: zone.name || `Zone_${Date.now()}`,
        polygon: polygonArr.length >= 3 ? polygonArr : [[0, 0], [100, 0], [100, 100], [0, 100]],
        severity: zone.type === "HIGH_SECURITY" ? "critical" : "high",
        camera_id: zone.cameraId || "all",
    });
    return {
        id: String(created?.id || Date.now()),
        cameraId: zone.cameraId || "all",
        name: zone.name || "New Zone",
        type: zone.type || "RESTRICTED",
        status: "ACTIVE",
        polygon: zone.polygon,
    };
};
export const apiUpdateZone = async (zoneId, updates) => {
    return null;
};
export const apiDeleteZone = async (zoneId) => {
    const idNum = parseInt(zoneId.replace("zone-", ""), 10);
    if (!isNaN(idNum)) {
        return await apiDeleteFenceZone(idNum);
    }
    return true;
};
// ============ SYSTEM STATUS ============
export const apiGetSystemStatus = async () => {
    try {
        const [healthRes, cams] = await Promise.all([
            fetch(`${API_BASE}/health`),
            apiGetCameras(),
        ]);
        const isOnline = healthRes.ok;
        const onlineCams = cams.filter((c) => c.status === "ONLINE").length;
        return {
            aiEngine: isOnline ? "ONLINE" : "OFFLINE",
            videoProcessing: isOnline ? "ONLINE" : "OFFLINE",
            database: isOnline ? "ONLINE" : "OFFLINE",
            apiServer: isOnline ? "ONLINE" : "OFFLINE",
            websocket: isOnline ? "CONNECTED" : "DISCONNECTED",
            camerasOnline: onlineCams,
            camerasTotal: cams.length,
            aiInferenceMs: 14.2,
            apiLatencyMs: 8.5,
            streamFps: 30.0,
        };
    }
    catch (err) {
        return {
            aiEngine: "OFFLINE",
            videoProcessing: "OFFLINE",
            database: "OFFLINE",
            apiServer: "OFFLINE",
            websocket: "DISCONNECTED",
            camerasOnline: 0,
            camerasTotal: 0,
            aiInferenceMs: 0,
            apiLatencyMs: 0,
            streamFps: 0,
        };
    }
};
// ============ ANALYTICS ============
export const apiGetAnalytics = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/events?limit=100`);
        if (res.ok) {
            const data = await res.json();
            const events = data.items || [];
            // Group by camera
            const camMap = {};
            const typeMap = {};
            events.forEach((e) => {
                const cam = e.camera_id || "cam_01";
                camMap[cam] = (camMap[cam] || 0) + 1;
                const t = mapEventType(e.event_type);
                typeMap[t] = (typeMap[t] || 0) + 1;
            });
            const intrusionsByCamera = Object.entries(camMap).map(([camera, count]) => ({ camera, count }));
            const eventDistribution = Object.entries(typeMap).map(([type, count]) => ({ type: type, count }));
            return {
                alertsTrend: [],
                intrusionsByCamera,
                unknownFacesTrend: [],
                vehicleDetections: [],
                personDetections: [],
                eventDistribution,
                cameraActivity: intrusionsByCamera.map((i) => ({ camera: i.camera, events: i.count })),
            };
        }
    }
    catch (err) { }
    return {
        alertsTrend: [],
        intrusionsByCamera: [],
        unknownFacesTrend: [],
        vehicleDetections: [],
        personDetections: [],
        eventDistribution: [],
        cameraActivity: [],
    };
};
// ============ DASHBOARD STATS ============
export const apiGetDashboardStats = async () => {
    try {
        const [statsRes, cams] = await Promise.all([
            fetch(`${API_BASE}/api/events/stats`),
            apiGetCameras(),
        ]);
        const stats = statsRes.ok ? await statsRes.json() : {};
        const byType = stats.by_type || {};
        const bySev = stats.by_severity || {};
        const onlineCams = cams.filter((c) => c.status === "ONLINE").length;
        return {
            camerasOnline: onlineCams,
            camerasTotal: cams.length,
            activeAlerts: (bySev.critical || 0) + (bySev.high || 0) + (bySev.medium || 0),
            peopleDetected: byType.intrusion || 0,
            vehiclesDetected: byType.anpr || 0,
            unknownFaces: byType.face_unknown || 0,
            intrusionsToday: byType.intrusion || 0,
            threatLevel: (bySev.critical || 0) > 0 ? "CRITICAL" : (bySev.high || 0) > 0 ? "HIGH" : "LOW",
        };
    }
    catch (err) {
        console.warn("Failed to fetch dashboard stats:", err);
    }
    return {
        camerasOnline: 0,
        camerasTotal: 0,
        activeAlerts: 0,
        peopleDetected: 0,
        vehiclesDetected: 0,
        unknownFaces: 0,
        intrusionsToday: 0,
        threatLevel: "LOW",
    };
};
