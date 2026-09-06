import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiGetEvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SecurityEvent } from "@/types";

const elapsed = (entry: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - new Date(entry).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export const Intrusions: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    apiGetEvents(1, 100, { eventType: "INTRUSION" }).then((result) => setEvents(result.items)).finally(() => setLoading(false));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (loading) return <LoadingSpinner />;
  return <div className="p-6 space-y-6">
    <div><h1 className="text-white text-2xl font-bold flex items-center gap-2"><ShieldAlert className="text-red-500" /> Intrusions</h1><p className="text-gray-400 text-sm mt-1">One evidence capture is created when a person enters a restricted zone.</p></div>
    {events.length === 0 ? <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center text-gray-400">No intrusion entries recorded yet.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{events.map((event) => {
      const entry = event.detailedInfo?.entry_time || event.timestamp;
      return <article key={event.id} className="overflow-hidden rounded-xl border border-red-500/40 bg-gray-900">{event.evidenceUrl && <img src={event.evidenceUrl} alt="Intrusion evidence" className="aspect-video w-full object-cover" />}<div className="p-4 space-y-2"><div className="flex justify-between text-xs"><span className="rounded bg-red-600 px-2 py-1 font-bold text-white">CRITICAL ZONE ENTRY</span><span className="text-gray-400">{event.cameraId}</span></div><p className="font-semibold text-white">{event.personId || `Person #${event.trackId ?? "unknown"}`}</p><p className="text-sm text-gray-300">Entry: {new Date(entry).toLocaleString()}</p><p className="text-sm text-amber-300">Time in zone: {elapsed(entry, now)}</p></div></article>;
    })}</div>}
  </div>;
};
