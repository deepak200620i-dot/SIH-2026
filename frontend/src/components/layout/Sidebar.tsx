import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  AlertCircle,
  Activity,
  Users,
  Zap,
  BarChart3,
  MapPin,
  Settings,
  Radio,
  ShieldAlert,
} from "lucide-react";
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
  { icon: ShieldAlert, label: "Intrusions", path: "/intrusions" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cameraCount, setCameraCount] = useState<{ online: number; total: number }>({ online: 0, total: 0 });

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
      } catch (err) {
        setIsOnline(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen">
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 mx-2 rounded transition ${
                isActive
                  ? "bg-blue-900 text-blue-100 border-l-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* System Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs font-bold text-gray-400 mb-3">SYSTEM STATUS</div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-gray-300">AI Engine {isOnline ? "Online" : "Offline"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-gray-300">Database {isOnline ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cameraCount.online > 0 ? "bg-green-500" : "bg-yellow-500"}`} />
            <span className="text-gray-300">
              {cameraCount.online} / {cameraCount.total} Cameras Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

