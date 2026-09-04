import React, { useState, useEffect, useCallback } from "react";
import { useCameras } from "@/hooks/useCameras";
import { useAlerts } from "@/hooks/useAlerts";
import { apiGetDashboardStats, apiGetCameraStatus } from "@/services/api";
import { KPICard } from "@/components/dashboard/KPICard";
import { CameraGrid } from "@/components/dashboard/CameraGrid";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SecurityEvent } from "@/types";
import { Users, Truck, AlertCircle, Camera as CameraIcon, Radio } from "lucide-react";

export const Dashboard: React.FC = () => {
  const { cameras, loading: camerasLoading } = useCameras();
  const { alerts } = useAlerts();
  const [stats, setStats] = useState<any>(null);
  const [cameraStats, setCameraStats] = useState<Record<string, any>>({});
  const [recentEvent, setRecentEvent] = useState<SecurityEvent | null>(null);

  // Handle real-time events
  const handleEvent = useCallback((event: SecurityEvent) => {
    setRecentEvent(event);
    setStats((prev: any) =>
      prev ? { ...prev, activeAlerts: prev.activeAlerts + 1 } : prev
    );
  }, []);

  useWebSocket(handleEvent);

  // Load initial stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiGetDashboardStats();
        setStats(data);

        if (cameras.length > 0) {
          const cameraStatusMap: Record<string, any> = {};
          for (const camera of cameras) {
            const status = await apiGetCameraStatus(camera.id);
            if (status) {
              cameraStatusMap[camera.id] = status;
            }
          }
          setCameraStats(cameraStatusMap);
        }
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      }
    };

    loadStats();
  }, [cameras]);

  if (camerasLoading || !stats) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard
          title="Cameras Online"
          value={`${stats.camerasOnline} / ${stats.camerasTotal}`}
          icon={<CameraIcon size={20} />}
          color={stats.camerasOnline === stats.camerasTotal ? "green" : "yellow"}
        />
        <KPICard
          title="Active Alerts"
          value={stats.activeAlerts}
          icon={<AlertCircle size={20} />}
          color={stats.activeAlerts > 0 ? "red" : "green"}
          trend={stats.activeAlerts > 0 ? "up" : null}
        />
        <KPICard
          title="People Detected"
          value={stats.peopleDetected}
          icon={<Users size={20} />}
          color="blue"
        />
        <KPICard
          title="Vehicles Detected"
          value={stats.vehiclesDetected}
          icon={<Truck size={20} />}
          color="blue"
        />
        <KPICard
          title="Unknown Faces"
          value={stats.unknownFaces}
          icon={<AlertCircle size={20} />}
          color={stats.unknownFaces > 0 ? "yellow" : "green"}
        />
        <KPICard
          title="Intrusions Today"
          value={stats.intrusionsToday}
          icon={<Radio size={20} />}
          color={stats.intrusionsToday > 0 ? "red" : "green"}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-white font-semibold mb-4">Live Surveillance</h2>
          <CameraGrid cameras={cameras} cameraStats={cameraStats} />
        </div>

        {/* Alerts Panel */}
        <div>
          <AlertsPanel alerts={alerts} maxItems={10} />
        </div>
      </div>

      {/* Recent Event Notification */}
      {recentEvent && (
        <div className="fixed bottom-6 right-6 max-w-xs bg-red-900 border border-red-500 rounded p-4 animate-pulse">
          <p className="text-red-200 font-semibold text-sm mb-1">New Event</p>
          <p className="text-red-100 text-xs">{recentEvent.description}</p>
        </div>
      )}
    </div>
  );
};
