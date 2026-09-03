import React from 'react';
import { SEVERITY_CONFIG } from '../../utils/constants';
import { MdShield } from 'react-icons/md';

const LEVEL_STYLES = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    text: 'text-red-400',
    glow: 'severity-critical-glow',
    pulse: true,
  },
  high: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    glow: '',
    pulse: false,
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    glow: '',
    pulse: false,
  },
  low: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    glow: '',
    pulse: false,
  },
  none: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-700/50',
    text: 'text-gray-400',
    glow: '',
    pulse: false,
  },
};

export default function ThreatLevel({ level = 'none' }) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.none;
  const config = SEVERITY_CONFIG[level];
  const displayLabel = config?.label || 'NOMINAL';

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border
        ${style.bg} ${style.border} ${style.glow}
        ${style.pulse ? 'animate-pulse-slow' : ''}
        transition-all duration-500
      `}
    >
      <MdShield className={`size-6 ${style.text} shrink-0`} />
      <div className="flex flex-col">
        <span className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-mono">
          THREAT LEVEL
        </span>
        <span className={`text-sm font-bold font-mono tracking-wider ${style.text}`}>
          {displayLabel}
        </span>
      </div>
    </div>
  );
}
