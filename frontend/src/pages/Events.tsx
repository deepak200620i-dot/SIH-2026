import React, { useState } from "react";
import { useEvents } from "@/hooks/useEvents";
import { EventTable } from "@/components/events/EventTable";
import { SecurityEvent } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EVENT_TYPES } from "@/utils/constants";

export const Events: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const { events, loading, page, setPage, hasMore } = useEvents(
    eventTypeFilter ? { eventType: eventTypeFilter } : undefined
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  const eventTypeOptions = Object.keys(EVENT_TYPES);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Events</h1>
        <span className="text-gray-400 text-sm">{events.length} events loaded</span>
      </div>

      {/* Event Type Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setEventTypeFilter(null)}
          className={`px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition ${
            !eventTypeFilter
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          All
        </button>
        {eventTypeOptions.map((type) => (
          <button
            key={type}
            onClick={() => setEventTypeFilter(eventTypeFilter === type ? null : type)}
            className={`px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition ${
              eventTypeFilter === type
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {EVENT_TYPES[type]}
          </button>
        ))}
      </div>

      {/* Event Table */}
      <EventTable events={events} onEventClick={setSelectedEvent} />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition"
        >
          Previous
        </button>
        <span className="text-gray-400">Page {page}</span>
        <button
          disabled={!hasMore}
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition"
        >
          Next
        </button>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded p-6 max-w-lg w-full">
            <h2 className="text-white text-xl font-bold mb-4">{selectedEvent.eventType}</h2>

            <div className="space-y-4 mb-6 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-1">Description</p>
                <p className="text-white">{selectedEvent.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Camera</p>
                  <p className="text-white font-mono text-xs">{selectedEvent.cameraId}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Confidence</p>
                  <p className="text-white">{selectedEvent.confidence}%</p>
                </div>
              </div>
              {selectedEvent.trackId && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Track ID</p>
                  <p className="text-white">#{selectedEvent.trackId}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
