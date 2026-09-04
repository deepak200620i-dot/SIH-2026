import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | null;
  subtitle?: string;
  color?: "red" | "green" | "yellow" | "blue";
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = "blue",
}) => {
  const colorClasses = {
    red: "border-red-500 bg-red-900/20",
    green: "border-green-500 bg-green-900/20",
    yellow: "border-yellow-500 bg-yellow-900/20",
    blue: "border-blue-500 bg-blue-900/20",
  };

  return (
    <div className={`border ${colorClasses[color]} rounded p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">{title}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="text-gray-500">{icon}</div>
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trend === "up" ? (
            <>
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-green-400">↑ 12%</span>
            </>
          ) : (
            <>
              <TrendingDown size={14} className="text-red-400" />
              <span className="text-red-400">↓ 5%</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
