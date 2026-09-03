import React, { useState, useEffect } from "react";
import { apiGetANPREvents } from "@/services/api";
import { ANPREvent } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export const ANPR: React.FC = () => {
  const [anprEvents, setAnprEvents] = useState<ANPREvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadANPREvents = async () => {
      try {
        setLoading(true);
        const data = await apiGetANPREvents(page, 12);
        setAnprEvents(data.items);
      } catch (error) {
        console.error("Failed to load ANPR events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadANPREvents();
  }, [page]);

  if (loading) {
    return <LoadingSpinner />;
  }

  const unknownCount = anprEvents.filter((e) => e.status === "UNKNOWN").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Vehicle Plate Recognition (ANPR)</h1>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Unknown Vehicles</p>
          <p className="text-yellow-400 text-2xl font-bold">{unknownCount}</p>
        </div>
      </div>

      {/* ANPR Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {anprEvents.map((event) => (
          <div
            key={event.id}
            className="border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition"
          >
            {/* Vehicle Image */}
            <div className="bg-gray-800 h-32 flex items-center justify-center">
              <img
                src={event.vehicleImageUrl}
                alt="Vehicle"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Plate Info */}
            <div className="bg-gray-900 p-4 space-y-3 border-t border-gray-700">
              <div className="bg-yellow-900 border border-yellow-500 p-2 rounded text-center">
                <p className="text-yellow-200 font-bold text-lg font-mono">{event.plateNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400 mb-1">OCR Confidence</p>
                  <p className="text-white font-semibold">{event.ocrConfidence}%</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Status</p>
                  <p
                    className={`font-semibold ${
                      event.status === "UNKNOWN"
                        ? "text-yellow-400"
                        : event.status === "AUTHORIZED"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {event.status}
                  </p>
                </div>
              </div>

              <p className="text-gray-400 text-xs">{event.cameraId}</p>
            </div>
          </div>
        ))}
      </div>

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
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};
