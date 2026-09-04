import React from "react";
import { SecurityEvent } from "@/types";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { formatDateTime } from "@/utils/date";
import { EVENT_TYPES } from "@/utils/constants";

interface EventTableProps {
  events: SecurityEvent[];
  onEventClick?: (event: SecurityEvent) => void;
}

export const EventTable: React.FC<EventTableProps> = ({ events, onEventClick }) => {
  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 border-b border-gray-700">
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Timestamp</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Camera</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Event Type</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Confidence</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Severity</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              className="border-b border-gray-700 hover:bg-gray-800/50 transition cursor-pointer"
              onClick={() => onEventClick?.(event)}
            >
              <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(event.timestamp)}</td>
              <td className="px-4 py-3 text-white font-medium">{event.cameraId}</td>
              <td className="px-4 py-3 text-gray-300">{EVENT_TYPES[event.eventType]}</td>
              <td className="px-4 py-3 text-gray-300">{event.confidence || 0}%</td>
              <td className="px-4 py-3">
                <SeverityBadge severity={event.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
