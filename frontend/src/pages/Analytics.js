import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { apiGetAnalytics } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, } from "recharts";
export const Analytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                setLoading(true);
                const data = await apiGetAnalytics();
                setAnalytics(data);
            }
            catch (error) {
                console.error("Failed to load analytics:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadAnalytics();
    }, []);
    if (loading || !analytics) {
        return _jsx(LoadingSpinner, {});
    }
    const colors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981", "#8b5cf6"];
    return (_jsxs("div", { className: "p-6 space-y-8", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Analytics Dashboard" }), _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-4", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Alerts - Last 24 Hours" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: analytics.alertsTrend, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#374151" }), _jsx(XAxis, { dataKey: "timestamp", stroke: "#6b7280", minTickGap: 24 }), _jsx(YAxis, { stroke: "#6b7280" }), _jsx(Tooltip, { contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151" }, labelStyle: { color: "#fff" } }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "count", stroke: "#ef4444", dot: { fill: "#ef4444" }, name: "Alerts" })] }) })] }), _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-4", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Intrusions by Camera" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: analytics.intrusionsByCamera, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#374151" }), _jsx(XAxis, { stroke: "#6b7280", dataKey: "camera" }), _jsx(YAxis, { stroke: "#6b7280" }), _jsx(Tooltip, { contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151" }, labelStyle: { color: "#fff" } }), _jsx(Bar, { dataKey: "count", fill: "#ef4444", name: "Intrusions" })] }) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-4", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Event Distribution" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: analytics.eventDistribution, dataKey: "count", nameKey: "type", cx: "50%", cy: "50%", outerRadius: 100, label: true, children: analytics.eventDistribution.map((_, index) => (_jsx(Cell, { fill: colors[index % colors.length] }, index))) }), _jsx(Tooltip, { contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151" }, labelStyle: { color: "#fff" } })] }) })] }), _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-4", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Camera Activity" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: analytics.cameraActivity, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#374151" }), _jsx(XAxis, { stroke: "#6b7280", dataKey: "camera" }), _jsx(YAxis, { stroke: "#6b7280" }), _jsx(Tooltip, { contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151" }, labelStyle: { color: "#fff" } }), _jsx(Bar, { dataKey: "events", fill: "#3b82f6", name: "Events" })] }) })] })] }), _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded p-4", children: [_jsx("h2", { className: "text-white font-semibold mb-4", children: "Detections - Last 24 Hours" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: analytics.personDetections, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#374151" }), _jsx(XAxis, { dataKey: "timestamp", stroke: "#6b7280", minTickGap: 24 }), _jsx(YAxis, { stroke: "#6b7280" }), _jsx(Tooltip, { contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151" }, labelStyle: { color: "#fff" } }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "count", stroke: "#10b981", dot: { fill: "#10b981" }, name: "Person Detections" })] }) })] })] }));
};
