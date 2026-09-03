import React from 'react';
import { SEVERITY_CONFIG } from '../../utils/constants';

export default function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded font-mono font-bold uppercase tracking-wider
        ${config.bg} ${config.text} border ${config.border}
        ${sizeClasses[size] || sizeClasses.md}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      {config.label}
    </span>
  );
}
