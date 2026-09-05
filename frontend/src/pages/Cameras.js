import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { ChevronRight, Video } from "lucide-react";
import { useCameras } from "@/hooks/useCameras";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
export const Cameras = () => {
    const { cameras, loading } = useCameras();
    if (loading)
        return _jsx(LoadingSpinner, {});
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Camera Sources" }), _jsx("p", { className: "text-sm text-gray-500", children: "Registered feeds available to the analytics engine." })] }), cameras.length === 0 ? _jsx("div", { className: "panel p-8 text-center text-gray-500", children: "No cameras registered. Add one from Live Surveillance." }) :
                _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: cameras.map(camera => _jsxs(Link, { to: `/cameras/${camera.id}`, className: "panel p-5 hover:border-maroon-700 transition flex gap-4 items-center", children: [_jsx("div", { className: "rounded-full bg-maroon-50 text-maroon-800 p-3", children: _jsx(Video, { size: 22 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-semibold truncate", children: camera.name }), _jsx("p", { className: "text-xs text-gray-500 truncate", children: camera.location }), _jsx("div", { className: "mt-2", children: _jsx(StatusBadge, { status: camera.status }) })] }), _jsx(ChevronRight, { className: "text-maroon-700", size: 20 })] }, camera.id)) })] });
};
