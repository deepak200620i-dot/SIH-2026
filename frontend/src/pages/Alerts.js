import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { AlertTable } from "@/components/alerts/AlertTable";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { apiUpdateAlertStatus } from "@/services/api";
export const Alerts = () => {
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [severity, setSeverity] = useState(null);
    const { alerts, loading } = useAlerts(severity ? { severity } : undefined);
    const handleUpdateStatus = async (alertId, status) => {
        await apiUpdateAlertStatus(alertId, status);
        setSelectedAlert(null);
    };
    if (loading) {
        return _jsx(LoadingSpinner, {});
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Alerts" }), _jsxs("span", { className: "bg-red-900 text-red-200 px-3 py-1 rounded text-sm font-semibold", children: [alerts.length, " Active"] })] }), _jsx("div", { className: "flex gap-2", children: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (_jsx("button", { onClick: () => setSeverity(severity === sev ? null : sev), className: `px-3 py-2 rounded text-xs font-medium transition ${severity === sev
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`, children: sev }, sev))) }), _jsx(AlertTable, { alerts: alerts, onAlertClick: setSelectedAlert }), selectedAlert && (_jsx("div", { className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-6 max-w-lg w-full", children: [_jsx("h2", { className: "text-white text-xl font-bold mb-4", children: selectedAlert.eventType }), _jsxs("div", { className: "space-y-4 mb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Description" }), _jsx("p", { className: "text-white", children: selectedAlert.description })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Camera" }), _jsx("p", { className: "text-white font-mono", children: selectedAlert.cameraId })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Confidence" }), _jsxs("p", { className: "text-white", children: [selectedAlert.confidence, "%"] })] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleUpdateStatus(selectedAlert.id, "ACKNOWLEDGED"), className: "flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition", children: "Acknowledge" }), _jsx("button", { onClick: () => handleUpdateStatus(selectedAlert.id, "INVESTIGATING"), className: "flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition", children: "Investigate" }), _jsx("button", { onClick: () => setSelectedAlert(null), className: "flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition", children: "Close" })] })] }) }))] }));
};
