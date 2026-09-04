import React from "react";
import { Link } from "react-router-dom";
import { Camera } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AlertCircle, Users, Truck } from "lucide-react";

interface CameraGridProps {
  cameras: Camera[];
  cameraStats?: Record<string, any>;
}

export const CameraGrid: React.FC<CameraGridProps> = ({ cameras, cameraStats = {} }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cameras.map((camera) => {
        const stats = cameraStats[camera.id] || {};
        return (
          <Link
            key={camera.id}
            to={`/cameras/${camera.id}`}
            className="border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition group cursor-pointer"
          >
            {/* Video Preview */}
            <div className="bg-gray-800 aspect-video flex items-center justify-center relative overflow-hidden group-hover:bg-gray-700 transition">
              <div className="text-gray-500 text-center">
                <div className="mb-2">📹</div>
                <div className="text-xs text-gray-400">Video Stream</div>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-gray-900 border-t border-gray-700 space-y-2">
              <div>
                <p className="text-white font-semibold text-sm">{camera.name}</p>
                <p className="text-gray-400 text-xs">{camera.location}</p>
              </div>

              <div className="flex items-center justify-between">
                <StatusBadge status={camera.status} />
                <span className="text-gray-400 text-xs">{camera.fps} FPS</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-1 text-xs">
                  <Users size={12} className="text-gray-500" />
                  <span className="text-gray-300">{stats.peopleCount || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Truck size={12} className="text-gray-500" />
                  <span className="text-gray-300">{stats.vehicleCount || 0}</span>
                </div>
              </div>

              {/* Latest Alert */}
              {stats.latestAlert && (
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex items-center gap-1 text-xs">
                    <AlertCircle size={12} className="text-orange-400" />
                    <span className="text-orange-300 truncate">{stats.latestAlert.description}</span>
                  </div>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
