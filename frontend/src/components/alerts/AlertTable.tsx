import React from "react";
import { Alert } from "@/types";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { formatDateTime } from "@/utils/date";

interface AlertTableProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
}

export const AlertTable: React.FC<AlertTableProps> = ({ alerts, onAlertClick }) => {
  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 border-b border-gray-700">
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Severity</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Event</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Camera</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Time</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Confidence</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr
              key={alert.id}
              className="border-b border-gray-700 hover:bg-gray-800/50 transition cursor-pointer"
              onClick={() => onAlertClick?.(alert)}
            >
              <td className="px-4 py-3">
                <SeverityBadge severity={alert.severity} />
              </td>
              <td className="px-4 py-3 text-white">{alert.eventType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-gray-300">{alert.cameraId}</td>
              <td className="px-4 py-3 text-gray-400">{formatDateTime(alert.timestamp)}</td>
              <td className="px-4 py-3 text-gray-300">{alert.confidence}%</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    alert.status === "ACTIVE"
                      ? "bg-red-900 text-red-200"
                      : alert.status === "INVESTIGATING"
                      ? "bg-yellow-900 text-yellow-200"
                      : "bg-green-900 text-green-200"
                  }`}
                >
                  {alert.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
