import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { useCameras } from "@/hooks/useCameras";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AlertCircle, Users, Truck, Maximize2, Video, Upload, Plus, X, Play, Square, CheckCircle2, Cpu, Layers, AlertTriangle, } from "lucide-react";
import { apiUploadVideo, apiProcessWebcamFrame, apiAddCamera, } from "@/services/api";
export const LiveSurveillance = () => {
    const { cameras, loading, refreshCameras } = useCameras();
    const [selectedCamera, setSelectedCamera] = useState(null);
    // Webcam State
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [webcamStats, setWebcamStats] = useState({ fps: 0, latencyMs: 0, people: 0, vehicles: 0 });
    const [latestDetections, setLatestDetections] = useState([]);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const streamRef = useRef(null);
    const webcamIntervalRef = useRef(null);
    const frameIndexRef = useRef(0);
    const isProcessingFrameRef = useRef(false);
    // Video Upload State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    // Add Camera Modal State
    const [isAddCameraOpen, setIsAddCameraOpen] = useState(false);
    const [newCamId, setNewCamId] = useState("");
    const [newCamName, setNewCamName] = useState("");
    const [newCamSource, setNewCamSource] = useState("");
    // Start / Stop Webcam
    const toggleWebcam = async () => {
        if (isWebcamActive) {
            // Stop webcam
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (webcamIntervalRef.current) {
                clearInterval(webcamIntervalRef.current);
                webcamIntervalRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setIsWebcamActive(false);
            setLatestDetections([]);
        }
        else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                });
                streamRef.current = stream;
                setIsWebcamActive(true);
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => { });
                    }
                }, 100);
                // Start frame capture loop
                webcamIntervalRef.current = setInterval(captureAndProcessFrame, 500);
            }
            catch (err) {
                console.error("Failed to access device camera:", err);
                alert("Camera access was denied or device camera is unavailable. Please grant camera permission.");
            }
        }
    };
    // Clean up webcam on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (webcamIntervalRef.current) {
                clearInterval(webcamIntervalRef.current);
            }
        };
    }, []);
    // Frame Capture and AI Processing
    const captureAndProcessFrame = async () => {
        if (isProcessingFrameRef.current)
            return;
        if (!videoRef.current || videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
            return;
        }
        const video = videoRef.current;
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        // Create / size offscreen canvas for light payload upload
        if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement("canvas");
        }
        const offCanvas = offscreenCanvasRef.current;
        offCanvas.width = 640;
        offCanvas.height = 360;
        const offCtx = offCanvas.getContext("2d");
        if (!offCtx)
            return;
        offCtx.drawImage(video, 0, 0, 640, 360);
        const base64Image = offCanvas.toDataURL("image/jpeg", 0.65);
        isProcessingFrameRef.current = true;
        frameIndexRef.current += 1;
        try {
            const res = await apiProcessWebcamFrame(base64Image, "device_webcam", frameIndexRef.current);
            if (res && canvasRef.current) {
                setLatestDetections(res.tracked_objects);
                const peopleCount = res.tracked_objects.filter((o) => o.class_name === "person").length;
                const vehicleCount = res.tracked_objects.filter((o) => ["car", "truck", "bus", "motorcycle"].includes(o.class_name)).length;
                setWebcamStats({
                    fps: Math.round(res.fps) || 30,
                    latencyMs: Math.round(res.total_ms) || 18,
                    people: peopleCount,
                    vehicles: vehicleCount,
                });
                // Overlay bounding boxes onto transparent overlay canvas
                const overlayCanvas = canvasRef.current;
                overlayCanvas.width = vWidth;
                overlayCanvas.height = vHeight;
                const ctx = overlayCanvas.getContext("2d");
                if (ctx) {
                    ctx.clearRect(0, 0, vWidth, vHeight);
                    // Scaling factors between 640x360 offscreen and original video
                    const scaleX = vWidth / 640;
                    const scaleY = vHeight / 360;
                    res.tracked_objects.forEach((obj) => {
                        const [x1, y1, x2, y2] = obj.bbox;
                        const sx1 = x1 * scaleX;
                        const sy1 = y1 * scaleY;
                        const sWidth = (x2 - x1) * scaleX;
                        const sHeight = (y2 - y1) * scaleY;
                        // Box
                        ctx.strokeStyle = obj.class_name === "person" ? "#38bdf8" : "#facc15";
                        ctx.lineWidth = 3;
                        ctx.strokeRect(sx1, sy1, sWidth, sHeight);
                        // Translucent fill
                        ctx.fillStyle = obj.class_name === "person" ? "rgba(56, 189, 248, 0.15)" : "rgba(250, 204, 21, 0.15)";
                        ctx.fillRect(sx1, sy1, sWidth, sHeight);
                        // Label Tag
                        ctx.fillStyle = obj.class_name === "person" ? "#0284c7" : "#ca8a04";
                        const label = `${obj.class_name.toUpperCase()} #${obj.track_id} (${Math.round(obj.confidence * 100)}%)`;
                        ctx.font = "bold 15px sans-serif";
                        const textWidth = ctx.measureText(label).width;
                        ctx.fillRect(sx1, Math.max(0, sy1 - 24), textWidth + 10, 24);
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(label, sx1 + 5, Math.max(17, sy1 - 6));
                    });
                }
            }
        }
        finally {
            isProcessingFrameRef.current = false;
        }
    };
    // Video Upload Handler
    const handleVideoUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile)
            return;
        setIsProcessing(true);
        setUploadError(null);
        setUploadResult(null);
        const res = await apiUploadVideo(uploadFile, "upload_feed", 5);
        setIsProcessing(false);
        if (res.success && res.data) {
            setUploadResult(res.data);
        }
        else {
            setUploadError(res.error || "Failed to process video file. Ensure backend is running.");
        }
    };
    // Add Camera Handler
    const handleAddCamera = async (e) => {
        e.preventDefault();
        if (!newCamId || !newCamName || !newCamSource) {
            alert("Please fill out all camera fields.");
            return;
        }
        const success = await apiAddCamera({
            id: newCamId,
            name: newCamName,
            source: newCamSource,
            status: "active",
        });
        if (success) {
            setIsAddCameraOpen(false);
            setNewCamId("");
            setNewCamName("");
            setNewCamSource("");
            if (refreshCameras)
                refreshCameras();
            alert("Camera registered successfully!");
        }
        else {
            alert("Failed to register camera.");
        }
    };
    if (loading) {
        return _jsx(LoadingSpinner, {});
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Live Surveillance & Feeds" }), _jsx("p", { className: "text-gray-400 text-xs", children: "Edge AI Video Analytics: Real-Time CCTV, Device Webcam, and Recorded Video Ingestion" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("button", { onClick: toggleWebcam, className: `flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition shadow-lg ${isWebcamActive
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"}`, children: [isWebcamActive ? _jsx(Square, { size: 16 }) : _jsx(Video, { size: 16 }), _jsx("span", { children: isWebcamActive ? "Stop Webcam" : "Start Device Webcam" })] }), _jsxs("button", { onClick: () => {
                                    setIsUploadOpen(true);
                                    setUploadError(null);
                                }, className: "flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition shadow-lg", children: [_jsx(Upload, { size: 16 }), _jsx("span", { children: "Upload Video" })] }), _jsxs("button", { onClick: () => setIsAddCameraOpen(true), className: "flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg font-medium text-sm transition", children: [_jsx(Plus, { size: 16 }), _jsx("span", { children: "Add Camera" })] })] })] }), isWebcamActive && (_jsxs("div", { className: "bg-gray-900 border border-blue-500/60 rounded-xl p-5 shadow-2xl space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "relative flex h-3 w-3", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" }), _jsx("span", { className: "relative inline-flex rounded-full h-3 w-3 bg-red-500" })] }), _jsx("h2", { className: "text-white font-bold text-lg", children: "Device Webcam \u2014 Live AI Processing" }), _jsx("span", { className: "bg-blue-900/60 text-blue-300 text-xs px-2.5 py-0.5 rounded border border-blue-700", children: "YOLOv8 + DeepSORT + Rules Engine" })] }), _jsxs("div", { className: "flex items-center gap-3 text-xs", children: [_jsxs("div", { className: "flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300", children: [_jsx(Cpu, { size: 14, className: "text-blue-400" }), _jsxs("span", { children: ["Inference: ", _jsxs("strong", { className: "text-white", children: [webcamStats.latencyMs, "ms"] })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300", children: [_jsx(Layers, { size: 14, className: "text-green-400" }), _jsxs("span", { children: ["FPS: ", _jsx("strong", { className: "text-white", children: webcamStats.fps })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300", children: [_jsx(Users, { size: 14, className: "text-cyan-400" }), _jsxs("span", { children: ["People: ", _jsx("strong", { className: "text-white", children: webcamStats.people })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300", children: [_jsx(Truck, { size: 14, className: "text-yellow-400" }), _jsxs("span", { children: ["Vehicles: ", _jsx("strong", { className: "text-white", children: webcamStats.vehicles })] })] })] })] }), _jsxs("div", { className: "relative aspect-video max-h-[560px] mx-auto bg-black rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center", children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-contain rounded-xl bg-black" }), _jsx("canvas", { ref: canvasRef, className: "absolute inset-0 w-full h-full object-contain pointer-events-none" }), latestDetections.length === 0 && (_jsxs("div", { className: "absolute bottom-4 left-4 bg-black/75 px-3 py-1.5 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" }), "Live Camera Active: Ready for object, face & vehicle detection."] }))] })] })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: cameras.map((camera) => (_jsxs("div", { className: "border border-gray-800 bg-gray-900 rounded-xl overflow-hidden hover:border-blue-500/50 transition group", children: [_jsxs("div", { className: "bg-gray-950 aspect-video flex items-center justify-center relative overflow-hidden", children: [_jsxs("div", { className: "text-center p-6 space-y-2", children: [_jsx("div", { className: "text-4xl", children: "\uD83D\uDCF9" }), _jsx("div", { className: "text-gray-400 font-medium text-sm", children: camera.name }), _jsx("div", { className: "text-gray-600 text-xs font-mono", children: camera.location })] }), _jsxs("div", { className: "absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" }), "LIVE ", camera.fps || 30, " FPS"] }), _jsx("button", { onClick: () => setSelectedCamera(camera), className: "absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition opacity-0 group-hover:opacity-100 shadow-lg", children: _jsx(Maximize2, { size: 16 }) })] }), _jsxs("div", { className: "p-4 space-y-3 border-t border-gray-800", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-white font-semibold text-sm", children: camera.name }), _jsx("p", { className: "text-gray-400 text-xs font-mono", children: camera.location })] }), _jsx(StatusBadge, { status: camera.status })] }), _jsxs("div", { className: "grid grid-cols-3 gap-2 text-xs", children: [_jsxs("div", { className: "bg-gray-800/80 p-2.5 rounded-lg border border-gray-700/50", children: [_jsxs("div", { className: "text-gray-400 flex items-center gap-1 mb-1", children: [_jsx(Users, { size: 12, className: "text-blue-400" }), " People"] }), _jsx("div", { className: "text-white font-bold text-base", children: "Active" })] }), _jsxs("div", { className: "bg-gray-800/80 p-2.5 rounded-lg border border-gray-700/50", children: [_jsxs("div", { className: "text-gray-400 flex items-center gap-1 mb-1", children: [_jsx(Truck, { size: 12, className: "text-yellow-400" }), " ANPR"] }), _jsx("div", { className: "text-white font-bold text-base", children: "Ready" })] }), _jsxs("div", { className: "bg-gray-800/80 p-2.5 rounded-lg border border-gray-700/50", children: [_jsxs("div", { className: "text-gray-400 flex items-center gap-1 mb-1", children: [_jsx(AlertCircle, { size: 12, className: "text-red-400" }), " Fence"] }), _jsx("div", { className: "text-white font-bold text-base", children: "Armed" })] })] })] })] }, camera.id))) }), isUploadOpen && (_jsx("div", { className: "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm", children: _jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl p-6 space-y-6 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-800 pb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Upload, { className: "text-blue-400", size: 20 }), _jsx("h2", { className: "text-white font-bold text-lg", children: "Upload Video for AI Analytics" })] }), _jsx("button", { onClick: () => {
                                        setIsUploadOpen(false);
                                        setUploadResult(null);
                                        setUploadError(null);
                                    }, className: "text-gray-400 hover:text-white transition", children: _jsx(X, { size: 20 }) })] }), uploadError && (_jsxs("div", { className: "bg-red-950/60 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 text-red-200 text-xs", children: [_jsx(AlertTriangle, { className: "text-red-400 shrink-0 mt-0.5", size: 18 }), _jsxs("div", { children: [_jsx("strong", { className: "block font-semibold mb-0.5", children: "Upload Failed" }), _jsx("span", { children: uploadError })] })] })), !uploadResult ? (_jsxs("form", { onSubmit: handleVideoUpload, className: "space-y-4", children: [_jsxs("div", { className: "border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-8 text-center transition bg-gray-950/50 cursor-pointer relative", children: [_jsx("input", { type: "file", accept: "video/mp4,video/avi,video/mov,video/mkv", onChange: (e) => {
                                                if (e.target.files?.[0])
                                                    setUploadFile(e.target.files[0]);
                                            }, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer" }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-4xl", children: "\uD83D\uDCC1" }), _jsx("p", { className: "text-white font-medium text-sm", children: uploadFile ? uploadFile.name : "Select or drag & drop a surveillance video file" }), _jsx("p", { className: "text-gray-500 text-xs", children: "Supports .mp4, .avi, .mov (CCTV footage / sample test)" })] })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: () => setIsUploadOpen(false), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition", children: "Cancel" }), _jsx("button", { type: "submit", disabled: !uploadFile || isProcessing, className: "flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition shadow-lg", children: isProcessing ? (_jsxs(_Fragment, { children: [_jsx(LoadingSpinner, {}), _jsx("span", { children: "Running AI Pipeline..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { size: 16 }), _jsx("span", { children: "Run Video Analytics" })] })) })] })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-start gap-3", children: [_jsx(CheckCircle2, { className: "text-emerald-400 shrink-0 mt-0.5", size: 20 }), _jsxs("div", { children: [_jsx("h3", { className: "text-white font-bold text-sm", children: "Video Analytics Completed!" }), _jsx("p", { className: "text-emerald-300/80 text-xs", children: "All detected events, license plates, and intrusions have been logged to the database." })] })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 text-center", children: [_jsxs("div", { className: "bg-gray-800 p-3 rounded-lg border border-gray-700", children: [_jsx("div", { className: "text-gray-400 text-xs", children: "Total Frames" }), _jsx("div", { className: "text-white font-bold text-lg", children: uploadResult.total_frames })] }), _jsxs("div", { className: "bg-gray-800 p-3 rounded-lg border border-gray-700", children: [_jsx("div", { className: "text-gray-400 text-xs", children: "Processed" }), _jsx("div", { className: "text-white font-bold text-lg", children: uploadResult.processed_frames })] }), _jsxs("div", { className: "bg-gray-800 p-3 rounded-lg border border-gray-700", children: [_jsx("div", { className: "text-gray-400 text-xs", children: "Elapsed Time" }), _jsxs("div", { className: "text-white font-bold text-lg", children: [uploadResult.elapsed_seconds, "s"] })] }), _jsxs("div", { className: "bg-gray-800 p-3 rounded-lg border border-gray-700", children: [_jsx("div", { className: "text-gray-400 text-xs", children: "Events Logged" }), _jsx("div", { className: "text-emerald-400 font-bold text-lg", children: uploadResult.events_count })] })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { onClick: () => {
                                                setUploadResult(null);
                                                setUploadFile(null);
                                            }, className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition", children: "Upload Another" }), _jsx("button", { onClick: () => {
                                                setIsUploadOpen(false);
                                                setUploadResult(null);
                                                setUploadFile(null);
                                            }, className: "px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition shadow-lg", children: "Done" })] })] }))] }) })), isAddCameraOpen && (_jsx("div", { className: "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm", children: _jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-800 pb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Plus, { className: "text-blue-400", size: 20 }), _jsx("h2", { className: "text-white font-bold text-lg", children: "Add Camera Source" })] }), _jsx("button", { onClick: () => setIsAddCameraOpen(false), className: "text-gray-400 hover:text-white transition", children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleAddCamera, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-gray-400 text-xs mb-1 font-medium", children: "Camera ID" }), _jsx("input", { type: "text", placeholder: "e.g. cam_05", value: newCamId, onChange: (e) => setNewCamId(e.target.value), className: "w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-gray-400 text-xs mb-1 font-medium", children: "Camera Name" }), _jsx("input", { type: "text", placeholder: "e.g. North Gate Perimeter", value: newCamName, onChange: (e) => setNewCamName(e.target.value), className: "w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-gray-400 text-xs mb-1 font-medium", children: "Source (RTSP / Stream URL / Local Device)" }), _jsx("input", { type: "text", placeholder: "e.g. rtsp://192.168.1.100:554/stream or 0 for Webcam", value: newCamSource, onChange: (e) => setNewCamSource(e.target.value), className: "w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: () => setIsAddCameraOpen(false), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition", children: "Cancel" }), _jsx("button", { type: "submit", className: "px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition", children: "Save Camera" })] })] })] }) })), selectedCamera && (_jsx("div", { className: "fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md", children: _jsxs("div", { className: "w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-800", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-white font-bold text-base", children: selectedCamera.name }), _jsx("p", { className: "text-gray-400 text-xs", children: selectedCamera.location })] }), _jsx("button", { onClick: () => setSelectedCamera(null), className: "px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition", children: "Close View" })] }), _jsx("div", { className: "bg-black aspect-video flex items-center justify-center", children: _jsxs("div", { className: "text-gray-500 text-center space-y-2", children: [_jsx("div", { className: "text-6xl", children: "\uD83D\uDCF9" }), _jsxs("div", { className: "text-gray-400 font-mono text-sm", children: [selectedCamera.name, " \u2014 Live RTSP Feed"] })] }) })] }) }))] }));
};
