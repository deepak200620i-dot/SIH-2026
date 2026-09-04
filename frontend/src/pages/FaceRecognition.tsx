import React, { useState } from "react";
import { apiGetFaceEvents } from "@/services/api";
import { FaceEvent } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { FACE_MATCH_COLORS } from "@/utils/constants";
import { useEffect } from "react";

export const FaceRecognition: React.FC = () => {
  const [faceEvents, setFaceEvents] = useState<FaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadFaceEvents = async () => {
      try {
        setLoading(true);
        const data = await apiGetFaceEvents(page, 12);
        setFaceEvents(data.items);
      } catch (error) {
        console.error("Failed to load face events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFaceEvents();
  }, [page]);

  if (loading) {
    return <LoadingSpinner />;
  }

  const unknownCount = faceEvents.filter((f) => f.matchStatus === "UNKNOWN").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Face Recognition</h1>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Unknown Faces</p>
          <p className="text-red-400 text-2xl font-bold">{unknownCount}</p>
        </div>
      </div>

      {/* Face Events Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {faceEvents.map((event) => (
          <div
            key={event.id}
            className="border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition"
          >
            {/* Face Image */}
            <div className="bg-gray-800 aspect-square flex items-center justify-center">
              <img
                src={event.faceImageUrl}
                alt="Face"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="bg-gray-900 p-3 space-y-2 border-t border-gray-700">
              <div
                className={`text-xs font-bold ${FACE_MATCH_COLORS[event.matchStatus]}`}
              >
                {event.matchStatus}
              </div>
              {event.matchedPersonName && (
                <div>
                  <p className="text-white text-xs font-semibold">{event.matchedPersonName}</p>
                </div>
              )}
              <div className="text-gray-400 text-xs">
                Similarity: {event.similarity}%
              </div>
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
