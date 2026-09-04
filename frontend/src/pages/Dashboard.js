import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { useCameras } from "@/hooks/useCameras";
import { useAlerts } from "@/hooks/useAlerts";
import { apiGetDashboardStats, apiGetCameraStatus } from "@/services/api";
import { KPICard } from "@/components/dashboard/KPICard";
import { CameraGrid } from "@/components/dashboard/CameraGrid";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Users, Truck, AlertCircle, Camera as CameraIcon, Radio } from "lucide-react";
export const Dashboard = () => {
    const { cameras, loading: camerasLoading } = useCameras();
    const { alerts } = useAlerts();
    const [stats, setStats] = useState(null);
    const [cameraStats, setCameraStats] = useState({});
    const [recentEvent, setRecentEvent] = useState(null);
    // Handle real-time events
    const handleEvent = useCallback((event) => {
        setRecentEvent(event);
        setStats((prev) => prev ? { ...prev, activeAlerts: prev.activeAlerts + 1 } : prev);
    }, []);
    useWebSocket(handleEvent);
    // Load initial stats
    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await apiGetDashboardStats();
                setStats(data);
                if (cameras.length > 0) {
                    const cameraStatusMap = {};
                    for (const camera of cameras) {
                        const status = await apiGetCameraStatus(camera.id);
                        if (status) {
                            cameraStatusMap[camera.id] = status;
                        }
                    }
                    setCameraStats(cameraStatusMap);
                }
            }
            catch (error) {
                console.error("Failed to load dashboard stats:", error);
            }
        };
        loadStats();
    }, [cameras]);
    if (camerasLoading || !stats) {
        return _jsx(LoadingSpinner, {});
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4", children: [_jsx(KPICard, { title: "Cameras Online", value: `${stats.camerasOnline} / ${stats.camerasTotal}`, icon: _jsx(CameraIcon, { size: 20 }), color: stats.camerasOnline === stats.camerasTotal ? "green" : "yellow" }), _jsx(KPICard, { title: "Active Alerts", value: stats.activeAlerts, icon: _jsx(AlertCircle, { size: 20 }), color: stats.activeAlerts > 0 ? "red" : "green", trend: stats.activeAlerts > 0 ? "up" : null }), _jsx(KPICard, { title: "People Detected", value: stats.peopleDetected, icon: _jsx(Users, { size: 20 }), color: "blue" }), _jsx(KPICard, { title: "Vehicles Detected", value: stats.vehiclesDetected, icon: _jsx(Truck, { size: 20 }), color: "blue" }), _jsx(KPICard, { title: "Unknown Faces", value: stats.unknownFaces, icon: _jsx(AlertCircle, { size: 20 }), color: stats.unknownFaces > 0 ? "yellow" : "green" }), _jsx(KPICard, { title: "Intrusions Today", value: stats.intrusionsToday, icon: _jsx(Radio, { size: 20 }), color: stats.intrusionsToday > 0 ? "red" : "green" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Live Surveillance" }), _jsx(CameraGrid, { cameras: cameras, cameraStats: cameraStats })] }), _jsx("div", { children: _jsx(AlertsPanel, { alerts: alerts, maxItems: 10 }) })] }), recentEvent && (_jsxs("div", { className: "fixed bottom-6 right-6 max-w-xs bg-red-900 border border-red-500 rounded p-4 animate-pulse", children: [_jsx("p", { className: "text-red-200 font-semibold text-sm mb-1", children: "New Event" }), _jsx("p", { className: "text-red-100 text-xs", children: recentEvent.description })] }))] }));
};
