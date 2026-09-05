import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera as CameraIcon, MapPin, Radio } from "lucide-react";
import { useCamera } from "@/hooks/useCameras";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";

export const CameraDetails: React.FC = () => {
  const { cameraId } = useParams();
  const { camera, loading } = useCamera(cameraId);
  if (loading) return <LoadingSpinner />;
  if (!camera) return <div className="p-6"><Link className="text-maroon-800 text-sm" to="/cameras">← Back to cameras</Link><p className="mt-6 text-gray-600">Camera not found.</p></div>;
  return <div className="p-6 space-y-6">
    <Link className="inline-flex gap-2 items-center text-sm text-maroon-800 hover:underline" to="/cameras"><ArrowLeft size={16} />All cameras</Link>
    <div className="flex justify-between gap-4"><div><h1 className="text-2xl font-bold">{camera.name}</h1><p className="text-sm text-gray-500 font-mono">{camera.id}</p></div><StatusBadge status={camera.status} /></div>
    <div className="panel overflow-hidden"><div className="aspect-video bg-[#2a0b12] flex flex-col items-center justify-center text-white"><CameraIcon size={48} className="text-[#f6d7db]"/><p className="mt-4 font-semibold">Registered camera feed</p><p className="mt-1 text-sm text-[#f6d7db]">Video preview is available through Live Surveillance.</p></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="panel p-4"><MapPin className="text-maroon-800" size={18}/><p className="mt-3 text-xs text-gray-500">Source</p><p className="text-sm break-all">{camera.location}</p></div><div className="panel p-4"><Radio className="text-maroon-800" size={18}/><p className="mt-3 text-xs text-gray-500">Stream rate</p><p className="text-sm">{camera.fps} FPS</p></div><div className="panel p-4"><CameraIcon className="text-maroon-800" size={18}/><p className="mt-3 text-xs text-gray-500">Resolution</p><p className="text-sm">{camera.resolution}</p></div></div>
  </div>;
};
