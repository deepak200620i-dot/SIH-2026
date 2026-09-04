import React from "react";
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
} from "lucide-react";

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

export const Sidebar: React.FC = () => {
  const location = useLocation();

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
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-300">AI Engine Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-300">Database Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-300">4 / 4 Cameras Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
