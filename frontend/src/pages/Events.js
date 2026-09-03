import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useEvents } from "@/hooks/useEvents";
import { EventTable } from "@/components/events/EventTable";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EVENT_TYPES } from "@/utils/constants";
export const Events = () => {
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventTypeFilter, setEventTypeFilter] = useState(null);
    const { events, loading, page, setPage, hasMore } = useEvents(eventTypeFilter ? { eventType: eventTypeFilter } : undefined);
    if (loading) {
        return _jsx(LoadingSpinner, {});
    }
    const eventTypeOptions = Object.keys(EVENT_TYPES);
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Events" }), _jsxs("span", { className: "text-gray-400 text-sm", children: [events.length, " events loaded"] })] }), _jsxs("div", { className: "flex gap-2 overflow-x-auto pb-2", children: [_jsx("button", { onClick: () => setEventTypeFilter(null), className: `px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition ${!eventTypeFilter
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`, children: "All" }), eventTypeOptions.map((type) => (_jsx("button", { onClick: () => setEventTypeFilter(eventTypeFilter === type ? null : type), className: `px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition ${eventTypeFilter === type
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`, children: EVENT_TYPES[type] }, type)))] }), _jsx(EventTable, { events: events, onEventClick: setSelectedEvent }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { disabled: page === 1, onClick: () => setPage(page - 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition", children: "Previous" }), _jsxs("span", { className: "text-gray-400", children: ["Page ", page] }), _jsx("button", { disabled: !hasMore, onClick: () => setPage(page + 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition", children: "Next" })] }), selectedEvent && (_jsx("div", { className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-6 max-w-lg w-full", children: [_jsx("h2", { className: "text-white text-xl font-bold mb-4", children: selectedEvent.eventType }), _jsxs("div", { className: "space-y-4 mb-6 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Description" }), _jsx("p", { className: "text-white", children: selectedEvent.description })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Camera" }), _jsx("p", { className: "text-white font-mono text-xs", children: selectedEvent.cameraId })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Confidence" }), _jsxs("p", { className: "text-white", children: [selectedEvent.confidence, "%"] })] })] }), selectedEvent.trackId && (_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Track ID" }), _jsxs("p", { className: "text-white", children: ["#", selectedEvent.trackId] })] }))] }), _jsx("button", { onClick: () => setSelectedEvent(null), className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition", children: "Close" })] }) }))] }));
};
