import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiGetEvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
const elapsed = (entry, now) => {
    const seconds = Math.max(0, Math.floor((now - new Date(entry).getTime()) / 1000));
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
export const Intrusions = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        apiGetEvents(1, 100, { eventType: "INTRUSION" }).then((result) => setEvents(result.items)).finally(() => setLoading(false));
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    if (loading)
        return _jsx(LoadingSpinner, {});
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-white text-2xl font-bold flex items-center gap-2", children: [_jsx(ShieldAlert, { className: "text-red-500" }), " Intrusions"] }), _jsx("p", { className: "text-gray-400 text-sm mt-1", children: "One evidence capture is created when a person enters a restricted zone." })] }), events.length === 0 ? _jsx("div", { className: "rounded-xl border border-gray-700 bg-gray-900 p-12 text-center text-gray-400", children: "No intrusion entries recorded yet." }) : _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5", children: events.map((event) => {
                    const entry = event.detailedInfo?.entry_time || event.timestamp;
                    return _jsxs("article", { className: "overflow-hidden rounded-xl border border-red-500/40 bg-gray-900", children: [event.evidenceUrl && _jsx("img", { src: event.evidenceUrl, alt: "Intrusion evidence", className: "aspect-video w-full object-cover" }), _jsxs("div", { className: "p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "rounded bg-red-600 px-2 py-1 font-bold text-white", children: "CRITICAL ZONE ENTRY" }), _jsx("span", { className: "text-gray-400", children: event.cameraId })] }), _jsx("p", { className: "font-semibold text-white", children: event.personId || `Person #${event.trackId ?? "unknown"}` }), _jsxs("p", { className: "text-sm text-gray-300", children: ["Entry: ", new Date(entry).toLocaleString()] }), _jsxs("p", { className: "text-sm text-amber-300", children: ["Time in zone: ", elapsed(entry, now)] })] })] }, event.id);
                }) })] });
};
