import React, { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { AlertTable } from "@/components/alerts/AlertTable";
import { Alert } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { apiUpdateAlertStatus } from "@/services/api";

export const Alerts: React.FC = () => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const { alerts, loading } = useAlerts(severity ? { severity } : undefined);

  const handleUpdateStatus = async (alertId: string, status: string) => {
    await apiUpdateAlertStatus(alertId, status);
    setSelectedAlert(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Alerts</h1>
        <span className="bg-red-900 text-red-200 px-3 py-1 rounded text-sm font-semibold">
          {alerts.length} Active
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverity(severity === sev ? null : sev)}
            className={`px-3 py-2 rounded text-xs font-medium transition ${
              severity === sev
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Alert Table */}
      <AlertTable alerts={alerts} onAlertClick={setSelectedAlert} />

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded p-6 max-w-lg w-full">
            <h2 className="text-white text-xl font-bold mb-4">{selectedAlert.eventType}</h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-gray-400 text-xs mb-1">Description</p>
                <p className="text-white">{selectedAlert.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Camera</p>
                  <p className="text-white font-mono">{selectedAlert.cameraId}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Confidence</p>
                  <p className="text-white">{selectedAlert.confidence}%</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateStatus(selectedAlert.id, "ACKNOWLEDGED")}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition"
              >
                Acknowledge
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedAlert.id, "INVESTIGATING")}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
              >
                Investigate
              </button>
              <button
                onClick={() => setSelectedAlert(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
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
