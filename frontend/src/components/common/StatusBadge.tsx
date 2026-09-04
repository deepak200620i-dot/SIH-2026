import React from "react";
import { CameraStatus } from "@/types";
import { CAMERA_STATUS_COLORS } from "@/utils/constants";

interface StatusBadgeProps {
  status: CameraStatus;
  text?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  const colorClass = CAMERA_STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorClass}`} />
      <span className="text-xs font-medium">{text || status}</span>
    </div>
  );
};
