import React, { useState, useEffect } from "react";
import { apiGetAnalytics } from "@/services/api";
import { AnalyticsData } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TimeRange = "24h" | "7d" | "30d" | "1y" | "all";

const RANGE_LABELS: Record<TimeRange, string> = {
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "1y": "Last 1 Year",
  all: "All Time",
};

export const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<TimeRange>("24h");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiGetAnalytics(range);
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [range]);

  const colors = ["#06b6d4", "#3b82f6", "#8b5cf6", "#f97316", "#10b981", "#eab308"];

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm">Security telemetry and activity intelligence</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-gray-900 border border-gray-800 p-1.5 rounded-lg">
          {(["24h", "7d", "30d", "1y", "all"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                range === r
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {loading && !analytics ? (
        <LoadingSpinner />
      ) : !analytics ? (
        <p className="text-gray-400">No analytics data available.</p>
      ) : (
        <>
          {/* 1. Alerts Trend */}
          <div className="bg-gray-900 border border-gray-700 rounded p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Alerts Trend — {RANGE_LABELS[range]}</h2>
              {loading && <span className="text-xs text-blue-400">Updating...</span>}
            </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.alertsTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="timestamp" stroke="#6b7280" minTickGap={24} />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#06b6d4"
              dot={{ fill: "#06b6d4" }}
              name="Alerts"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Intrusions by Camera */}
      <div className="bg-gray-900 border border-gray-700 rounded p-4">
        <h2 className="text-white font-semibold mb-4">Intrusions by Camera</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.intrusionsByCamera}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis stroke="#6b7280" dataKey="camera" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey="count" fill="#3b82f6" name="Intrusions" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Event Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded p-4">
          <h2 className="text-white font-semibold mb-4">Event Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.eventDistribution}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {analytics.eventDistribution.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#fff" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Camera Activity */}
        <div className="bg-gray-900 border border-gray-700 rounded p-4">
          <h2 className="text-white font-semibold mb-4">Camera Activity</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.cameraActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis stroke="#6b7280" dataKey="camera" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="events" fill="#3b82f6" name="Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Detection Trends */}
      <div className="bg-gray-900 border border-gray-700 rounded p-4">
        <h2 className="text-white font-semibold mb-4">Person Detections — {RANGE_LABELS[range]}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.personDetections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="timestamp" stroke="#6b7280" minTickGap={24} />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              dot={{ fill: "#10b981" }}
              name="Person Detections"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
        </>
      )}
    </div>
  );
};
