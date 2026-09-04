import React, { useState } from "react";
import { useCameras } from "@/hooks/useCameras";
import { Camera } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AlertCircle, Users, Truck, Maximize2 } from "lucide-react";

export const LiveSurveillance: React.FC = () => {
  const { cameras, loading } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-white text-2xl font-bold">Live Surveillance</h1>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className="border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition group"
          >
            {/* Video Preview */}
            <div className="bg-gray-800 aspect-video flex items-center justify-center relative overflow-hidden group-hover:bg-gray-700 transition">
              <div className="text-gray-600 text-center">
                <div className="mb-2 text-4xl">📹</div>
                <div className="text-gray-500">Live Stream</div>
              </div>

              {/* Overlay Detection Info */}
              <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-green-400">
                ● LIVE {camera.fps} FPS
              </div>


              {/* Action Button */}
              <button
                onClick={() => setSelectedCamera(camera)}
                className="absolute bottom-2 right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded transition opacity-0 group-hover:opacity-100"
              >
                <Maximize2 size={16} className="text-white" />
              </button>
            </div>

            {/* Info Panel */}
            <div className="bg-gray-900 p-4 space-y-3 border-t border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{camera.name}</p>
                  <p className="text-gray-400 text-xs">{camera.location}</p>
                </div>
                <StatusBadge status={camera.status} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-800 px-3 py-2 rounded">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <Users size={12} /> People
                  </div>
                  <div className="text-white text-lg font-bold">{Math.floor(Math.random() * 5)}</div>
                </div>
                <div className="bg-gray-800 px-3 py-2 rounded">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <Truck size={12} /> Vehicles
                  </div>
                  <div className="text-white text-lg font-bold">{Math.floor(Math.random() * 3)}</div>
                </div>
                <div className="bg-gray-800 px-3 py-2 rounded">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Alerts
                  </div>
                  <div className="text-white text-lg font-bold">{Math.floor(Math.random() * 2)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Camera View */}
      {selectedCamera && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <button
              onClick={() => setSelectedCamera(null)}
              className="mb-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              Close
            </button>
            <div className="bg-gray-800 aspect-video rounded flex items-center justify-center">
              <div className="text-gray-600 text-center">
                <div className="text-6xl mb-2">📹</div>
                <div className="text-gray-500">{selectedCamera.name} - Expanded View</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
