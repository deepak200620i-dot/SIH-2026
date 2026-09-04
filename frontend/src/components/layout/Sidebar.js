import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Camera, AlertCircle, Activity, Users, Zap, BarChart3, MapPin, Settings, Radio, } from "lucide-react";
import { apiGetSystemStatus, apiGetCameras } from "@/services/api";
const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Radio, label: "Live Surveillance", path: "/live" },
    { icon: Camera, label: "Cameras", path: "/cameras" },
    { icon: AlertCircle, label: "Alerts", path: "/alerts" },
    { icon: Activity, label: "Events", path: "/events" },
    { icon: Zap, label: "Face Recognition", path: "/face-recognition" },
    { icon: Users, label: "Persons", path: "/persons" },
    { icon: Zap, label: "ANPR", path: "/anpr" },
    { icon: MapPin, label: "Zones", path: "/zones" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Settings, label: "Settings", path: "/settings" },
];
export const Sidebar = () => {
    const location = useLocation();
    const [isOnline, setIsOnline] = useState(true);
    const [cameraCount, setCameraCount] = useState({ online: 0, total: 0 });
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const [sysStatus, cameras] = await Promise.all([
                    apiGetSystemStatus(),
                    apiGetCameras(),
                ]);
                setIsOnline(sysStatus.apiServer === "ONLINE");
                const onlineCams = cameras.filter((c) => c.status === "ONLINE").length;
                setCameraCount({ online: onlineCams, total: cameras.length });
            }
            catch (err) {
                setIsOnline(false);
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);
    return (_jsxs("div", { className: "w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen", children: [_jsx("div", { className: "flex-1 overflow-y-auto py-6", children: menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (_jsxs(Link, { to: item.path, className: `flex items-center gap-3 px-4 py-3 mx-2 rounded transition ${isActive
                            ? "bg-blue-900 text-blue-100 border-l-2 border-blue-500"
                            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`, children: [_jsx(Icon, { size: 18 }), _jsx("span", { className: "text-sm font-medium", children: item.label })] }, item.path));
                }) }), _jsxs("div", { className: "p-4 border-t border-gray-800", children: [_jsx("div", { className: "text-xs font-bold text-gray-400 mb-3", children: "SYSTEM STATUS" }), _jsxs("div", { className: "space-y-2 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}` }), _jsxs("span", { className: "text-gray-300", children: ["AI Engine ", isOnline ? "Online" : "Offline"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}` }), _jsxs("span", { className: "text-gray-300", children: ["Database ", isOnline ? "Connected" : "Disconnected"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${cameraCount.online > 0 ? "bg-green-500" : "bg-yellow-500"}` }), _jsxs("span", { className: "text-gray-300", children: [cameraCount.online, " / ", cameraCount.total, " Cameras Online"] })] })] })] })] }));
};
