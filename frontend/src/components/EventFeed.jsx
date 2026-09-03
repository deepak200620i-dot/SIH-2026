import React, { useRef, useEffect } from 'react';
import SeverityBadge from './common/SeverityBadge';
import LoadingState from './common/LoadingState';
import EmptyState from './common/EmptyState';
import { formatTimestamp, getEventTitle, formatCameraId } from '../utils/formatters';
import { MdNotificationsNone } from 'react-icons/md';

export default function EventFeed({ events = [], loading = false, onEventClick }) {
  const scrollRef = useRef(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (events.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  if (loading) {
    return (
      <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        <LoadingState message="Loading events..." />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        <EmptyState
          icon={<MdNotificationsNone className="size-8 text-gray-600" />}
          title="No events"
          message="Events will stream here when the backend is connected"
        />
      </div>
    );
  }

  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
          Live Events
        </span>
        <span className="text-[10px] font-mono text-gray-600">
          {events.length} events
        </span>
      </div>

      {/* Scrollable list */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto divide-y divide-gray-800/50">
        {events.map((event, idx) => (
          <div
            key={event.id || idx}
            className="px-4 py-2.5 hover:bg-gray-800/30 cursor-pointer transition-colors animate-fade-in flex items-center gap-3"
            onClick={() => onEventClick?.(event)}
          >
            <SeverityBadge severity={event.severity} size="sm" />

            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-300 block truncate">
                {getEventTitle(event)}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {event.zone_name && (
                  <span className="text-[9px] font-mono text-gray-500">{event.zone_name}</span>
                )}
                {event.camera_id && (
                  <span className="text-[9px] font-mono text-gray-600">
                    {formatCameraId(event.camera_id)}
                  </span>
                )}
              </div>
            </div>

            <span className="text-[9px] font-mono text-gray-600 shrink-0">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
