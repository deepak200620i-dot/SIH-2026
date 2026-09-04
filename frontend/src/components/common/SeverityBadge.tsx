import React from "react";
import { Severity } from "@/types";
import { SEVERITY_COLORS } from "@/utils/constants";

interface SeverityBadgeProps {
  severity: Severity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const colors = SEVERITY_COLORS[severity];
  return (
    <div className={`inline-block px-2 py-1 rounded text-xs font-bold ${colors.badge} text-white`}>
      {severity}
    </div>
  );
};
