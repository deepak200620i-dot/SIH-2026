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

export const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiGetAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading || !analytics) {
    return <LoadingSpinner />;
  }

  const colors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981", "#8b5cf6"];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-white text-2xl font-bold">Analytics Dashboard</h1>

      {/* 1. Alerts Trend */}
      <div className="bg-gray-900 border border-gray-700 rounded p-4">
        <h2 className="text-white font-semibold mb-4">Alerts - Last 24 Hours</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.alertsTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#ef4444"
              dot={{ fill: "#ef4444" }}
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
            <Bar dataKey="count" fill="#ef4444" name="Intrusions" />
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
        <h2 className="text-white font-semibold mb-4">Detections - Last 24 Hours</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.personDetections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis stroke="#6b7280" />
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
    </div>
  );
};
