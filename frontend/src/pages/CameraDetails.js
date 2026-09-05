import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera as CameraIcon, MapPin, Radio } from "lucide-react";
import { useCamera } from "@/hooks/useCameras";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
export const CameraDetails = () => {
    const { cameraId } = useParams();
    const { camera, loading } = useCamera(cameraId);
    if (loading)
        return _jsx(LoadingSpinner, {});
    if (!camera)
        return _jsxs("div", { className: "p-6", children: [_jsx(Link, { className: "text-maroon-800 text-sm", to: "/cameras", children: "\u2190 Back to cameras" }), _jsx("p", { className: "mt-6 text-gray-600", children: "Camera not found." })] });
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs(Link, { className: "inline-flex gap-2 items-center text-sm text-maroon-800 hover:underline", to: "/cameras", children: [_jsx(ArrowLeft, { size: 16 }), "All cameras"] }), _jsxs("div", { className: "flex justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: camera.name }), _jsx("p", { className: "text-sm text-gray-500 font-mono", children: camera.id })] }), _jsx(StatusBadge, { status: camera.status })] }), _jsx("div", { className: "panel overflow-hidden", children: _jsxs("div", { className: "aspect-video bg-[#2a0b12] flex flex-col items-center justify-center text-white", children: [_jsx(CameraIcon, { size: 48, className: "text-[#f6d7db]" }), _jsx("p", { className: "mt-4 font-semibold", children: "Registered camera feed" }), _jsx("p", { className: "mt-1 text-sm text-[#f6d7db]", children: "Video preview is available through Live Surveillance." })] }) }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { className: "panel p-4", children: [_jsx(MapPin, { className: "text-maroon-800", size: 18 }), _jsx("p", { className: "mt-3 text-xs text-gray-500", children: "Source" }), _jsx("p", { className: "text-sm break-all", children: camera.location })] }), _jsxs("div", { className: "panel p-4", children: [_jsx(Radio, { className: "text-maroon-800", size: 18 }), _jsx("p", { className: "mt-3 text-xs text-gray-500", children: "Stream rate" }), _jsxs("p", { className: "text-sm", children: [camera.fps, " FPS"] })] }), _jsxs("div", { className: "panel p-4", children: [_jsx(CameraIcon, { className: "text-maroon-800", size: 18 }), _jsx("p", { className: "mt-3 text-xs text-gray-500", children: "Resolution" }), _jsx("p", { className: "text-sm", children: camera.resolution })] })] })] });
};
