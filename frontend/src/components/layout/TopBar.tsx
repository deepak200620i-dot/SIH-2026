import React, { useState, useEffect } from "react";
import { Bell, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCurrentDateTime } from "@/utils/date";

interface TopBarProps {
  title?: string;
  alertCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({ title, alertCount = 0 }) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(getCurrentDateTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentDateTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-white font-bold text-lg">IBVAP</h1>
          <p className="text-gray-400 text-xs">Intelligent Border Video Analytics</p>
        </div>
      </div>


      {/* Center */}
      {title && <h2 className="text-white font-semibold">{title}</h2>}

      {/* Right */}
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-white font-mono text-sm">{currentTime}</p>
        </div>

        {/* Alerts */}
        <button className="relative p-2 hover:bg-gray-800 rounded transition">
          <Bell size={20} className="text-gray-300" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button onClick={() => navigate("/settings")} aria-label="Open settings" className="p-2 hover:bg-gray-800 rounded transition">
          <Settings size={20} className="text-gray-300" />
        </button>

        {/* Logout */}
        <button
          onClick={() => { sessionStorage.removeItem("ibvap-authenticated"); window.location.assign("/"); }}
          aria-label="Log out"
          className="p-2 hover:bg-gray-800 rounded transition"
        >
          <LogOut size={20} className="text-gray-300" />
        </button>
      </div>
    </div>
  );
};
