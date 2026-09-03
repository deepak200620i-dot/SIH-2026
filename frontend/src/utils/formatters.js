import { EVENT_TYPES, SEVERITY_ORDER } from './constants1';

export function formatTimestamp(iso) {
  if (!iso) return '--:--:--';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso) {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Unknown';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const time = formatTimestamp(iso);
  
  return `${day} ${month} ${year}, ${time}`;
}

export function formatConfidence(value) {
  if (value === null || value === undefined) return '--';
  return `${Math.round(value * 100)}%`;
}

export function formatTrackId(id) {
  if (id === null || id === undefined || id === -1) return null;
  return `TRACK #${id}`;
}

export function formatCameraId(id) {
  if (!id) return '--';
  return id.replace(/_/g, '-').toUpperCase();
}

export function parseBbox(bboxStr) {
  if (!bboxStr) return null;
  try {
    const parsed = JSON.parse(bboxStr);
    if (Array.isArray(parsed) && parsed.length === 4) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function parseMetadata(metaStr) {
  if (!metaStr) return {};
  try {
    return JSON.parse(metaStr);
  } catch (e) {
    return {};
  }
}

export function getEventTitle(event) {
  if (!event || !event.event_type) return 'Unknown Event';
  return EVENT_TYPES[event.event_type]?.label || 'Unknown Event';
}

export function getEventDescription(event) {
  if (!event) return '';
  switch (event.event_type) {
    case 'intrusion':
      return event.zone_name ? `Intrusion detected in ${event.zone_name}` : 'Intrusion detected in restricted zone';
    case 'face_match':
      return event.face_name ? `Known person identified: ${event.face_name}` : 'Known person identified';
    case 'face_unknown':
      return 'Unknown person detected';
    case 'anpr':
      return event.plate_text ? `Vehicle plate detected: ${event.plate_text}` : 'Vehicle plate detected';
    case 'loitering':
      return event.class_name ? `Loitering detected: ${event.class_name}` : 'Loitering detected';
    default:
      return 'Activity detected';
  }
}

export function getHighestSeverity(events) {
  if (!events || events.length === 0) return 'none';
  
  for (const severity of SEVERITY_ORDER) {
    if (events.some(e => e.severity === severity)) {
      return severity;
    }
  }
  return 'none';
}
