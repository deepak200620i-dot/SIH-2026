import React from "react";
import { Link } from "react-router-dom";
import { Camera as CameraIcon, ChevronRight, Video } from "lucide-react";
import { useCameras } from "@/hooks/useCameras";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";

export const Cameras: React.FC = () => {
  const { cameras, loading } = useCameras();
  if (loading) return <LoadingSpinner />;

  return <div className="p-6 space-y-6">
    <div><h1 className="text-2xl font-bold">Camera Sources</h1><p className="text-sm text-gray-500">Registered feeds available to the analytics engine.</p></div>
    {cameras.length === 0 ? <div className="panel p-8 text-center text-gray-500">No cameras registered. Add one from Live Surveillance.</div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{cameras.map(camera =>
        <Link key={camera.id} to={`/cameras/${camera.id}`} className="panel p-5 hover:border-maroon-700 transition flex gap-4 items-center">
          <div className="rounded-full bg-maroon-50 text-maroon-800 p-3"><Video size={22} /></div>
          <div className="min-w-0 flex-1"><p className="font-semibold truncate">{camera.name}</p><p className="text-xs text-gray-500 truncate">{camera.location}</p><div className="mt-2"><StatusBadge status={camera.status} /></div></div>
          <ChevronRight className="text-maroon-700" size={20} />
        </Link>)}</div>}
  </div>;
};
