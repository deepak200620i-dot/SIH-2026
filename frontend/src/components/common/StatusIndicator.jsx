import React from 'react';
import { STATUS_COLORS } from '../../utils/constants1';

export default function StatusIndicator({ status, label, size = 'md' }) {
  const normalizedStatus = (status || 'offline').toLowerCase();
  const dotColor = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.offline;

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const textSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
  };

  const isAnimated = normalizedStatus === 'online' || normalizedStatus === 'active' || normalizedStatus === 'connecting';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex">
        <span
          className={`${dotSizes[size]} rounded-full ${dotColor} ${isAnimated ? 'animate-pulse' : ''}`}
        />
      </span>
      {label && (
        <span className={`${textSizes[size]} font-mono text-gray-400 uppercase tracking-wider`}>
          {label}
        </span>
      )}
    </span>
  );
}
