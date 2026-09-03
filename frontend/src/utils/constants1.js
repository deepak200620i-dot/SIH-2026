export const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/50', dot: 'bg-red-500', label: 'CRITICAL' },
  high:     { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/50', dot: 'bg-orange-500', label: 'HIGH' },
  medium:   { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/50', dot: 'bg-amber-500', label: 'MEDIUM' },
  low:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/50', dot: 'bg-emerald-500', label: 'LOW' },
};

export const EVENT_TYPES = {
  intrusion: { label: 'Zone Intrusion', icon: 'MdGppBad' },
  face_match: { label: 'Face Matched', icon: 'MdFace' },
  face_unknown: { label: 'Unknown Face', icon: 'MdPersonOff' },
  anpr: { label: 'Plate Detected', icon: 'MdDirectionsCar' },
  loitering: { label: 'Loitering', icon: 'MdTimer' },
};

export const STATUS_COLORS = {
  online: 'bg-emerald-500',
  active: 'bg-emerald-500',
  offline: 'bg-red-500',
  inactive: 'bg-gray-500',
  connecting: 'bg-amber-500',
};

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
