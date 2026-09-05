import React, { useEffect, useState } from "react";
import { Database, Server, ShieldCheck, Wifi } from "lucide-react";
import { apiGetSystemStatus } from "@/services/api";
import { SystemStatus } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export const Settings: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  useEffect(() => { apiGetSystemStatus().then(setStatus); }, []);
  if (!status) return <LoadingSpinner />;
  const services = [["API Server", status.apiServer, Server], ["Database", status.database, Database], ["AI Engine", status.aiEngine, ShieldCheck], ["Event stream", status.websocket, Wifi]] as const;
  return <div className="p-6 space-y-6"><div><h1 className="text-2xl font-bold">System Settings</h1><p className="text-sm text-gray-500">Live health of the local IBVAP services.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{services.map(([label, value, Icon]) => <div key={label} className="panel p-5 flex gap-4 items-center"><div className="rounded-full bg-maroon-50 p-3 text-maroon-800"><Icon size={22}/></div><div><p className="text-sm text-gray-500">{label}</p><p className="font-semibold">{value}</p></div></div>)}</div><div className="panel p-5"><h2 className="font-semibold">Deployment note</h2><p className="mt-2 text-sm text-gray-600">This build stores event data in the configured local SQLite database. Configure external infrastructure before using it for persistent multi-user operations.</p></div></div>;
};
