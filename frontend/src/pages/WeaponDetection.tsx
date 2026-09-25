import React, { useState, useEffect } from "react";
import { apiGetWeaponEvents } from "@/services/api";
import { WeaponEvent } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Crosshair, AlertTriangle, Shield } from "lucide-react";

/**
 * Formats a raw weapon class name into a human-readable label.
 * e.g. "short_gun" → "Short Gun", "ak_47" → "AK 47"
 */
const formatWeaponClass = (cls: string): string =>
  cls
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const WeaponDetection: React.FC = () => {
  const [events, setEvents] = useState<WeaponEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<WeaponEvent | null>(null);
  const pageSize = 12;

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const data = await apiGetWeaponEvents(page, pageSize);
        setEvents(data.items || []);
        setTotalEvents(data.total || (data.items || []).length);
      } catch (error) {
        console.error("Failed to load weapon events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [page]);

  if (loading && events.length === 0) {
    return <LoadingSpinner />;
  }

  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="text-red-500 size-7" />
          <h1 className="text-white text-2xl font-bold">Weapon Detection</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-gray-400 text-sm">Total Detections</p>
            <p className="text-red-400 text-2xl font-bold">{totalEvents}</p>
          </div>
          {totalEvents > 0 && (
            <div className="bg-red-900/40 border border-red-700 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-400 size-4" />
                <span className="text-red-300 text-xs font-semibold">CRITICAL THREATS</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Shield className="text-gray-600 size-12" />}
          message="No weapon detections recorded yet. When the AI pipeline detects a weapon (firearm, knife, etc.) in a camera feed, events will appear here with evidence snapshots, weapon class, and associated person details."
        />
      ) : (
        <>
          {/* Weapon Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="border border-red-900/50 rounded overflow-hidden hover:border-red-500 transition cursor-pointer group"
              >
                {/* Evidence Snapshot */}
                <div className="bg-gray-800 h-48 relative flex items-center justify-center overflow-hidden">
                  <img
                    src={event.evidenceUrl}
                    alt="Weapon evidence"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/favicon.svg";
                    }}
                  />
                  {/* Weapon Class Badge */}
                  <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white text-xs font-bold uppercase tracking-wide">
                      {formatWeaponClass(event.weaponClass)}
                    </span>
                  </div>
                  {/* Confidence */}
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded">
                    <span className="text-white text-xs font-mono">
                      {event.confidence}%
                    </span>
                  </div>
                  {/* Severity Strip */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />
                </div>

                {/* Info */}
                <div className="bg-gray-900 p-4 space-y-3 border-t border-red-900/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="text-red-400 size-4" />
                      <span className="text-red-300 font-semibold text-sm">
                        {formatWeaponClass(event.weaponClass)}
                      </span>
                    </div>
                    <span className="bg-red-900 text-red-200 px-2 py-0.5 rounded text-xs font-semibold">
                      CRITICAL
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500 mb-0.5">Camera</p>
                      <p className="text-gray-300 font-mono">{event.cameraId}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Confidence</p>
                      <p className="text-white font-semibold">{event.confidence}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500 mb-0.5">Person</p>
                      <p className={`font-semibold ${event.unauthorized ? "text-red-400" : "text-green-400"}`}>
                        {event.personIdentity}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Status</p>
                      <p className={`font-semibold ${
                        event.status === "ACTIVE" ? "text-red-400" :
                        event.status === "ACKNOWLEDGED" ? "text-yellow-400" : "text-green-400"
                      }`}>
                        {event.status}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-500 text-xs">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {totalPages} ({totalEvents} total)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800 rounded-lg max-w-2xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-red-900/30 border-b border-red-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crosshair className="text-red-400 size-5" />
                <h2 className="text-white text-lg font-bold">Weapon Detection Detail</h2>
              </div>
              <span className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">
                CRITICAL
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Evidence Image */}
              <div className="bg-gray-800 rounded overflow-hidden">
                <img
                  src={selectedEvent.evidenceUrl}
                  alt="Weapon evidence"
                  className="w-full max-h-72 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.svg";
                  }}
                />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Weapon Class</p>
                  <p className="text-red-300 font-bold text-lg">{formatWeaponClass(selectedEvent.weaponClass)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Detection Confidence</p>
                  <p className="text-white font-bold text-lg">{selectedEvent.confidence}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Camera</p>
                  <p className="text-white font-mono">{selectedEvent.cameraId}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Timestamp</p>
                  <p className="text-white">{new Date(selectedEvent.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Person Holding Weapon</p>
                  <p className={`font-semibold ${selectedEvent.unauthorized ? "text-red-400" : "text-green-400"}`}>
                    {selectedEvent.personIdentity}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Authorization</p>
                  <p className={`font-semibold ${selectedEvent.unauthorized ? "text-red-400" : "text-green-400"}`}>
                    {selectedEvent.unauthorized ? "⚠ UNAUTHORIZED" : "✓ AUTHORIZED"}
                  </p>
                </div>
                {selectedEvent.trackId && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Track ID</p>
                    <p className="text-white font-mono">#{selectedEvent.trackId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-800 px-6 py-4">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
