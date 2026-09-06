import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiGetEvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
const duration = (seconds) => {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};
export const Intrusions = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        apiGetEvents(1, 100, { eventType: "INTRUSION" }).then((result) => setEvents(result.items)).finally(() => setLoading(false));
    }, []);
    const visibleEvents = events.filter((event, index, all) => {
        const session = event.detailedInfo?.session_key;
        if (session)
            return !all.slice(0, index).some((prior) => prior.detailedInfo?.session_key === session);
        // Collapse pre-session legacy duplicate entries from the same camera into
        // one short entry window; current sessions are never merged this way.
        const bucket = Math.floor(new Date(event.timestamp).getTime() / 120000);
        return !all.slice(0, index).some((prior) => prior.cameraId === event.cameraId && !prior.detailedInfo?.session_key && Math.floor(new Date(prior.timestamp).getTime() / 120000) === bucket);
    });
    if (loading)
        return _jsx(LoadingSpinner, {});
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-white text-2xl font-bold flex items-center gap-2", children: [_jsx(ShieldAlert, { className: "text-red-500" }), " Intrusions"] }), _jsx("p", { className: "text-gray-400 text-sm mt-1", children: "One evidence capture is created when a person enters a restricted zone." })] }), visibleEvents.length === 0 ? _jsx("div", { className: "rounded-xl border border-gray-700 bg-gray-900 p-12 text-center text-gray-400", children: "No intrusion entries recorded yet." }) : _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5", children: visibleEvents.map((event) => {
                    const entry = event.detailedInfo?.entry_time || event.timestamp;
                    const seconds = event.detailedInfo?.time_in_zone_seconds;
                    return _jsxs("article", { className: "overflow-hidden rounded-xl border border-red-500/40 bg-gray-900", children: [event.evidenceUrl && _jsx("img", { src: event.evidenceUrl, alt: "Intrusion evidence", className: "aspect-video w-full object-cover" }), _jsxs("div", { className: "p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "rounded bg-red-600 px-2 py-1 font-bold text-white", children: "CRITICAL ZONE ENTRY" }), _jsx("span", { className: "text-gray-400", children: event.cameraId })] }), _jsx("p", { className: "font-semibold text-white", children: event.personId || `Person #${event.trackId ?? "unknown"}` }), _jsxs("p", { className: "text-sm text-gray-300", children: ["Entry: ", new Date(entry).toLocaleString()] }), _jsxs("p", { className: "text-sm text-amber-300", children: ["Time in zone: ", typeof seconds === "number" ? duration(seconds) : "Active — recorded when person exits"] })] })] }, event.id);
                }) })] });
};
