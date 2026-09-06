import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { ShieldAlert, Plus, Trash2, CheckCircle2, AlertTriangle, Camera as CameraIcon, RotateCcw, X, } from "lucide-react";
import { apiGetFenceZones, apiCreateFenceZone, apiDeleteFenceZone, } from "@/services/api";
import { useCameras } from "@/hooks/useCameras";
export const Zones = () => {
    const { cameras } = useCameras();
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    // Editor Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorStep, setEditorStep] = useState("camera");
    const [zoneName, setZoneName] = useState("");
    const [selectedCamera, setSelectedCamera] = useState("");
    const [severity, setSeverity] = useState("high");
    const [vertices, setVertices] = useState([]);
    const [shape, setShape] = useState("polygon");
    const [drawStart, setDrawStart] = useState(null);
    const [dragVertex, setDragVertex] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewError, setPreviewError] = useState(false);
    const canvasRef = useRef(null);
    const webcamPreviewRef = useRef(null);
    const webcamStreamRef = useRef(null);
    const openZoneEditor = () => {
        setIsEditorOpen(true);
        setEditorStep("camera");
        setSelectedCamera("");
        setVertices([]);
        setZoneName("");
        setPreviewUrl(null);
        setPreviewError(false);
    };
    const fetchZones = async () => {
        try {
            setLoading(true);
            const data = await apiGetFenceZones();
            setZones(data);
        }
        catch (err) {
            console.error("Failed to load zones:", err);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchZones();
    }, []);
    // Refresh a server camera frame while the operator is drawing. The image is
    // intentionally displayed underneath the coordinate canvas, so saved points
    // retain the same 640 × 360 coordinate space used by the analytics pipeline.
    useEffect(() => {
        if (!isEditorOpen || editorStep !== "draw" || !selectedCamera || selectedCamera === "device_webcam") {
            setPreviewUrl(null);
            return;
        }
        const refreshPreview = () => {
            setPreviewUrl(`/api/cameras/${encodeURIComponent(selectedCamera)}/preview?t=${Date.now()}`);
        };
        refreshPreview();
        const interval = window.setInterval(refreshPreview, 1250);
        return () => window.clearInterval(interval);
    }, [isEditorOpen, editorStep, selectedCamera]);
    // The local device camera is only available to the browser, so it is shown
    // directly when that camera is selected in the first step.
    useEffect(() => {
        if (!isEditorOpen || editorStep !== "draw" || selectedCamera !== "device_webcam")
            return;
        let active = true;
        navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
            .then((stream) => {
            if (!active) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            webcamStreamRef.current = stream;
            if (webcamPreviewRef.current) {
                webcamPreviewRef.current.srcObject = stream;
                webcamPreviewRef.current.play().catch(() => undefined);
            }
        })
            .catch(() => setPreviewError(true));
        return () => {
            active = false;
            webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
            webcamStreamRef.current = null;
        };
    }, [isEditorOpen, editorStep, selectedCamera]);
    // Redraw canvas when vertices change
    useEffect(() => {
        if (!canvasRef.current || !isEditorOpen)
            return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (vertices.length === 0) {
            // Guide prompt
            ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
            ctx.fillRect(135, canvas.height / 2 - 22, 370, 44);
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillText("Click anywhere inside this frame to place polygon corner points", canvas.width / 2, canvas.height / 2);
            return;
        }
        // Color by severity
        const color = severity === "critical"
            ? "#ef4444"
            : severity === "high"
                ? "#f97316"
                : severity === "medium"
                    ? "#eab308"
                    : "#3b82f6";
        // Draw polygon edges
        ctx.beginPath();
        ctx.moveTo(vertices[0][0], vertices[0][1]);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i][0], vertices[i][1]);
        }
        if (vertices.length >= 3) {
            ctx.closePath();
            ctx.fillStyle =
                severity === "critical"
                    ? "rgba(239, 68, 68, 0.2)"
                    : severity === "high"
                        ? "rgba(249, 115, 22, 0.2)"
                        : severity === "medium"
                            ? "rgba(234, 179, 8, 0.2)"
                            : "rgba(59, 130, 246, 0.2)";
            ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Draw vertex dots
        vertices.forEach(([vx, vy], idx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(vx, vy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Vertex number badge
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(idx + 1), vx, vy - 10);
        });
    }, [vertices, severity, isEditorOpen, editorStep]);
    // Click on canvas to add vertex
    const pointForEvent = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return [
            Math.max(0, Math.min(640, Math.round((e.clientX - rect.left) * scaleX))),
            Math.max(0, Math.min(360, Math.round((e.clientY - rect.top) * scaleY))),
        ];
    };
    const shapeVertices = (start, end) => {
        const [x1, y1] = start;
        const [x2, y2] = end;
        if (shape === "rectangle")
            return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
        return Array.from({ length: 20 }, (_, index) => [
            Math.round(cx + rx * Math.cos((index / 20) * Math.PI * 2)),
            Math.round(cy + ry * Math.sin((index / 20) * Math.PI * 2)),
        ]);
    };
    const handleCanvasPointerDown = (e) => {
        const point = pointForEvent(e);
        if (!point)
            return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const nearby = vertices.findIndex(([x, y]) => Math.hypot(x - point[0], y - point[1]) < 16);
        if (nearby >= 0) {
            setDragVertex(nearby);
            return;
        }
        if (shape === "polygon") {
            setVertices((previous) => [...previous, point]);
        }
        else {
            setDrawStart(point);
            setVertices([point]);
        }
    };
    const handleCanvasPointerMove = (e) => {
        const point = pointForEvent(e);
        if (!point)
            return;
        if (dragVertex !== null) {
            setVertices((previous) => previous.map((vertex, index) => index === dragVertex ? point : vertex));
        }
        else if (drawStart && shape !== "polygon") {
            setVertices(shapeVertices(drawStart, point));
        }
    };
    const handleCanvasPointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        setDrawStart(null);
        setDragVertex(null);
    };
    // Presets
    const applyPreset = (type) => {
        if (type === "center") {
            setVertices([
                [160, 90],
                [480, 90],
                [480, 270],
                [160, 270],
            ]);
        }
        else if (type === "perimeter") {
            setVertices([
                [40, 220],
                [600, 220],
                [600, 340],
                [40, 340],
            ]);
        }
        else if (type === "left") {
            setVertices([
                [20, 40],
                [240, 40],
                [240, 320],
                [20, 320],
            ]);
        }
        else if (type === "right") {
            setVertices([
                [400, 40],
                [620, 40],
                [620, 320],
                [400, 320],
            ]);
        }
    };
    const handleSaveZone = async (e) => {
        e.preventDefault();
        if (!zoneName.trim()) {
            alert("Please specify a zone name.");
            return;
        }
        if (vertices.length < 3) {
            alert("Please place at least 3 points on the canvas to form a polygon.");
            return;
        }
        if (!selectedCamera) {
            alert("Choose a camera before drawing a zone.");
            return;
        }
        setIsSaving(true);
        const created = await apiCreateFenceZone({
            name: zoneName.trim(),
            camera_id: selectedCamera,
            polygon: vertices,
            severity,
        });
        setIsSaving(false);
        if (created) {
            setStatusMessage(`Zone "${zoneName}" created successfully!`);
            setIsEditorOpen(false);
            setVertices([]);
            setZoneName("");
            fetchZones();
            setTimeout(() => setStatusMessage(null), 4000);
        }
        else {
            alert("Failed to save zone. Please ensure the name is unique.");
        }
    };
    const handleDeleteZone = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete restricted zone "${name}"?`)) {
            return;
        }
        const ok = await apiDeleteFenceZone(id);
        if (ok) {
            setZones((prev) => prev.filter((z) => z.id !== id));
            setStatusMessage(`Zone "${name}" deleted.`);
            setTimeout(() => setStatusMessage(null), 3000);
        }
        else {
            alert("Failed to delete zone.");
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Restricted Zones & Virtual Perimeter" }), _jsxs("span", { className: "bg-red-900/60 text-red-300 text-xs px-2.5 py-1 rounded-full border border-red-700 font-semibold flex items-center gap-1.5", children: [_jsx(ShieldAlert, { size: 14 }), zones.length, " Active Zones"] })] }), _jsx("p", { className: "text-gray-400 text-xs mt-1", children: "Draw custom perimeter polygon fences. Intrusions inside these boundaries will trigger high-priority security alarms." })] }), _jsxs("button", { onClick: openZoneEditor, className: "flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition shadow-lg shadow-blue-600/30", children: [_jsx(Plus, { size: 16 }), _jsx("span", { children: "Draw New Restricted Zone" })] })] }), statusMessage && (_jsxs("div", { className: "bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2", children: [_jsx(CheckCircle2, { size: 16 }), _jsx("span", { children: statusMessage })] })), _jsxs("div", { className: "bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex items-start gap-3", children: [_jsx(AlertTriangle, { className: "text-amber-400 shrink-0 mt-0.5", size: 18 }), _jsxs("div", { className: "text-xs text-gray-300 space-y-1", children: [_jsx("p", { className: "font-semibold text-white", children: "How Restricted Zones Work:" }), _jsxs("p", { children: ["When a tracked person or vehicle enters any defined polygon zone, the IBVAP Rules Engine immediately computes polygon intersections (", _jsx("code", { className: "text-amber-300", children: "pointPolygonTest" }), ") and flags an ", _jsx("strong", { className: "text-red-400", children: "INTRUSION" }), " event. Feeds or areas outside defined restricted zones will NOT generate false perimeter alerts."] })] })] }), loading ? (_jsx("div", { className: "py-16 text-center text-gray-400", children: "Loading restricted zones..." })) : zones.length === 0 ? (_jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-4", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 text-2xl", children: "\uD83D\uDEE1\uFE0F" }), _jsx("h2", { className: "text-white text-lg font-bold", children: "No Restricted Zones Defined" }), _jsx("p", { className: "text-gray-400 text-sm max-w-md mx-auto", children: "You currently have no active virtual fence boundaries. Click the button below to draw your first polygon zone on camera feeds." }), _jsxs("button", { onClick: openZoneEditor, className: "inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition", children: [_jsx(Plus, { size: 16 }), _jsx("span", { children: "Create Restricted Zone" })] })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: zones.map((zone) => {
                    const sevColor = zone.severity === "critical"
                        ? "text-red-400 border-red-500/40 bg-red-950/40"
                        : zone.severity === "high"
                            ? "text-orange-400 border-orange-500/40 bg-orange-950/40"
                            : zone.severity === "medium"
                                ? "text-yellow-400 border-yellow-500/40 bg-yellow-950/40"
                                : "text-blue-400 border-blue-500/40 bg-blue-950/40";
                    return (_jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/40 transition group shadow-xl", children: [_jsxs("div", { className: "bg-gray-950 h-36 relative flex items-center justify-center border-b border-gray-800", children: [_jsxs("svg", { viewBox: "0 0 640 360", className: "w-full h-full p-3 pointer-events-none", children: [_jsx("polygon", { points: (zone.polygon || []).map((p) => p.join(",")).join(" "), fill: zone.severity === "critical"
                                                    ? "rgba(239, 68, 68, 0.25)"
                                                    : zone.severity === "high"
                                                        ? "rgba(249, 115, 22, 0.25)"
                                                        : "rgba(234, 179, 8, 0.25)", stroke: zone.severity === "critical"
                                                    ? "#ef4444"
                                                    : zone.severity === "high"
                                                        ? "#f97316"
                                                        : "#eab308", strokeWidth: "4" }), (zone.polygon || []).map(([px, py], i) => (_jsx("circle", { cx: px, cy: py, r: "8", fill: "#ffffff" }, i)))] }), _jsxs("span", { className: "absolute bottom-2 left-3 text-[10px] font-mono text-gray-500", children: [zone.polygon?.length || 0, " Polygon Vertices"] })] }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-white font-bold text-base", children: zone.name }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs text-gray-400 mt-0.5", children: [_jsx(CameraIcon, { size: 12, className: "text-gray-500" }), _jsxs("span", { children: ["Camera: ", _jsx("strong", { className: "text-gray-200", children: zone.camera_id })] })] })] }), _jsx("span", { className: `text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded border ${sevColor}`, children: zone.severity })] }), _jsxs("div", { className: "border-t border-gray-800/80 pt-3 flex items-center justify-between", children: [_jsxs("span", { className: "text-xs text-gray-500 font-mono", children: ["ID: #", zone.id] }), _jsxs("button", { onClick: () => handleDeleteZone(zone.id, zone.name), className: "flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2.5 py-1 rounded transition", children: [_jsx(Trash2, { size: 13 }), _jsx("span", { children: "Delete Zone" })] })] })] })] }, zone.id));
                }) })), isEditorOpen && (_jsx("div", { className: "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm", children: _jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-800 pb-4", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(ShieldAlert, { className: "text-blue-400", size: 22 }), _jsxs("div", { children: [_jsx("h2", { className: "text-white font-bold text-lg", children: "Define New Restricted Zone" }), _jsx("p", { className: "text-gray-400 text-xs", children: editorStep === "camera" ? "First choose the camera whose feed you want to mark." : "Click on the live feed to place polygon boundary points." })] })] }), _jsx("button", { onClick: () => setIsEditorOpen(false), className: "text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition", children: _jsx(X, { size: 20 }) })] }), editorStep === "camera" ? (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "rounded-xl border border-blue-500/30 bg-blue-950/30 p-4 text-sm text-blue-100", children: "Zones are camera-specific. Select the feed first, then draw directly over its live preview." }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("button", { type: "button", onClick: () => { setSelectedCamera("device_webcam"); setEditorStep("draw"); setPreviewError(false); }, className: "rounded-xl border border-gray-700 bg-gray-950 p-4 text-left hover:border-blue-500 hover:bg-gray-800 transition", children: [_jsxs("span", { className: "flex items-center gap-2 text-white font-semibold", children: [_jsx(CameraIcon, { size: 16, className: "text-blue-400" }), " Device Webcam"] }), _jsx("span", { className: "block mt-1 text-xs text-gray-400", children: "Use this browser's live camera feed." })] }), cameras.map((camera) => (_jsxs("button", { type: "button", onClick: () => { setSelectedCamera(camera.id); setEditorStep("draw"); setPreviewError(false); }, className: "rounded-xl border border-gray-700 bg-gray-950 p-4 text-left hover:border-blue-500 hover:bg-gray-800 transition", children: [_jsxs("span", { className: "flex items-center gap-2 text-white font-semibold", children: [_jsx(CameraIcon, { size: 16, className: "text-blue-400" }), " ", camera.name] }), _jsx("span", { className: "block mt-1 text-xs text-gray-400 font-mono", children: camera.id })] }, camera.id)))] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-gray-400", children: [_jsxs("span", { children: ["Live feed: ", _jsx("strong", { className: "text-white", children: selectedCamera === "device_webcam" ? "Device Webcam" : cameras.find((camera) => camera.id === selectedCamera)?.name || selectedCamera }), " (640 \u00D7 360 mapping)"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-white font-semibold", children: [vertices.length, " points placed"] }), vertices.length > 0 && (_jsxs("button", { type: "button", onClick: () => setVertices([]), className: "text-red-400 hover:underline flex items-center gap-1", children: [_jsx(RotateCcw, { size: 12 }), " Clear Canvas"] }))] })] }), _jsxs("div", { className: "relative aspect-video max-h-[380px] bg-slate-950 rounded-xl overflow-hidden border border-gray-700 flex items-center justify-center", children: [selectedCamera === "device_webcam" ? (_jsx("video", { ref: webcamPreviewRef, autoPlay: true, playsInline: true, muted: true, className: "absolute inset-0 w-full h-full object-cover" })) : previewUrl && (_jsx("img", { src: previewUrl, onLoad: () => setPreviewError(false), onError: () => setPreviewError(true), className: "absolute inset-0 w-full h-full object-cover", alt: "Selected camera live preview" })), previewError && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-slate-950 px-6 text-center text-sm text-amber-300", children: "The camera feed is unavailable. Check the camera source and try again." })), _jsx("canvas", { ref: canvasRef, width: 640, height: 360, onPointerDown: handleCanvasPointerDown, onPointerMove: handleCanvasPointerMove, onPointerUp: handleCanvasPointerUp, onPointerCancel: handleCanvasPointerUp, className: "absolute inset-0 z-10 w-full h-full cursor-crosshair touch-none" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 pt-1 text-xs", children: [_jsx("span", { className: "text-gray-400", children: "Shape:" }), ["polygon", "rectangle", "circle"].map((option) => (_jsx("button", { type: "button", onClick: () => { setShape(option); setVertices([]); }, className: `px-2.5 py-1 rounded border capitalize ${shape === option ? "bg-blue-600 border-blue-400 text-white" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200"}`, children: option }, option))), _jsx("span", { className: "text-gray-400", children: "Quick Presets:" }), _jsx("button", { type: "button", onClick: () => applyPreset("center"), className: "bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700", children: "Center Perimeter" }), _jsx("button", { type: "button", onClick: () => applyPreset("perimeter"), className: "bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700", children: "Bottom Gate Zone" }), _jsx("button", { type: "button", onClick: () => applyPreset("left"), className: "bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700", children: "Left Corridor" }), _jsx("button", { type: "button", onClick: () => applyPreset("right"), className: "bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700", children: "Right Corridor" })] })] }), _jsxs("form", { onSubmit: handleSaveZone, className: "space-y-4 pt-2 border-t border-gray-800", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-gray-300 text-xs font-semibold mb-1.5", children: "Zone Name *" }), _jsx("input", { type: "text", required: true, placeholder: "e.g. Border Perimeter Alpha", value: zoneName, onChange: (e) => setZoneName(e.target.value), className: "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" })] }), _jsxs("div", { className: "rounded-lg border border-gray-700 bg-gray-950 px-3 py-2", children: [_jsx("span", { className: "block text-gray-400 text-xs", children: "Associated Camera" }), _jsx("span", { className: "block mt-0.5 text-white text-sm font-medium", children: selectedCamera === "device_webcam" ? "Device Webcam" : cameras.find((camera) => camera.id === selectedCamera)?.name || selectedCamera })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-gray-300 text-xs font-semibold mb-1.5", children: "Intrusion Severity" }), _jsxs("select", { value: severity, onChange: (e) => setSeverity(e.target.value), className: "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none", children: [_jsx("option", { value: "critical", children: "CRITICAL (Red Alarm)" }), _jsx("option", { value: "high", children: "HIGH (High Alert)" }), _jsx("option", { value: "medium", children: "MEDIUM (Standard Alert)" }), _jsx("option", { value: "low", children: "LOW (Informational)" })] })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-3 pt-4 border-t border-gray-800", children: [_jsx("button", { type: "button", onClick: () => setIsEditorOpen(false), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition", children: "Cancel" }), _jsx("button", { type: "submit", disabled: isSaving || vertices.length < 3, className: `px-5 py-2 rounded-lg font-medium text-sm transition shadow-lg ${vertices.length >= 3 && !isSaving
                                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                                                        : "bg-gray-700 text-gray-400 cursor-not-allowed"}`, children: isSaving ? "Saving Zone..." : "Save Restricted Zone" })] })] })] }))] }) }))] }));
};
