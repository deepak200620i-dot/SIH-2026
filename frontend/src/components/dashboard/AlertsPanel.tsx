import React from "react";
import { Alert } from "@/types";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { formatTime } from "@/utils/date";
import { AlertCircle } from "lucide-react";

interface AlertsPanelProps {
  alerts: Alert[];
  maxItems?: number;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, maxItems = 5 }) => {
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <AlertCircle size={18} className="text-red-500" />
          Active Alerts
        </h3>
        <span className="text-red-500 text-sm font-bold">{alerts.length}</span>
      </div>

      {displayAlerts.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-8">No active alerts</div>
      ) : (
        <div className="space-y-3">
          {displayAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3 bg-gray-800 border-l-4 border-red-500 rounded hover:bg-gray-700 transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <SeverityBadge severity={alert.severity} />
                <span className="text-gray-400 text-xs">{formatTime(alert.timestamp)}</span>
              </div>
              <p className="text-white text-sm font-semibold mb-1">
                {alert.eventType.replace(/_/g, " ")}
              </p>
              <p className="text-gray-300 text-xs">{alert.description}</p>
              <div className="mt-2 text-xs text-gray-400">{alert.cameraId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
