import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiGetEvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SecurityEvent } from "@/types";

const duration = (seconds: number) => {
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

export const Intrusions: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiGetEvents(1, 100, { eventType: "INTRUSION" }).then((result) => setEvents(result.items)).finally(() => setLoading(false));
  }, []);
  const visibleEvents = events.filter((event, index, all) => {
    const session = event.detailedInfo?.session_key;
    if (session) return !all.slice(0, index).some((prior) => prior.detailedInfo?.session_key === session);
    // Collapse pre-session legacy duplicate entries from the same camera into
    // one short entry window; current sessions are never merged this way.
    const bucket = Math.floor(new Date(event.timestamp).getTime() / 120000);
    return !all.slice(0, index).some((prior) => prior.cameraId === event.cameraId && !prior.detailedInfo?.session_key && Math.floor(new Date(prior.timestamp).getTime() / 120000) === bucket);
  });
  if (loading) return <LoadingSpinner />;
  return <div className="p-6 space-y-6">
    <div><h1 className="text-white text-2xl font-bold flex items-center gap-2"><ShieldAlert className="text-red-500" /> Intrusions</h1><p className="text-gray-400 text-sm mt-1">One evidence capture is created when a person enters a restricted zone.</p></div>
    {visibleEvents.length === 0 ? <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center text-gray-400">No intrusion entries recorded yet.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{visibleEvents.map((event) => {
      const entry = event.detailedInfo?.entry_time || event.timestamp;
      const seconds = event.detailedInfo?.time_in_zone_seconds;
      return <article key={event.id} className="overflow-hidden rounded-xl border border-red-500/40 bg-gray-900">{event.evidenceUrl && <img src={event.evidenceUrl} alt="Intrusion evidence" className="aspect-video w-full object-cover" />}<div className="p-4 space-y-2"><div className="flex justify-between text-xs"><span className="rounded bg-red-600 px-2 py-1 font-bold text-white">CRITICAL ZONE ENTRY</span><span className="text-gray-400">{event.cameraId}</span></div><p className="font-semibold text-white">{event.personId || `Person #${event.trackId ?? "unknown"}`}</p><p className="text-sm text-gray-300">Entry: {new Date(entry).toLocaleString()}</p><p className="text-sm text-amber-300">Time in zone: {typeof seconds === "number" ? duration(seconds) : "Active — recorded when person exits"}</p></div></article>;
    })}</div>}
  </div>;
};
