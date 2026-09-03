import React from 'react';
import SeverityBadge from '../common/SeverityBadge';
import EmptyState from '../common/EmptyState';
import { formatTimestamp, getEventTitle } from '../../utils/formatters';
import { MdTimeline } from 'react-icons/md';

export default function EventTimeline({ events = [], onEventClick, maxItems = 15 }) {
  const displayEvents = events.slice(0, maxItems);

  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
      <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono mb-3">
        EVENT TIMELINE
      </h3>

      {displayEvents.length === 0 ? (
        <EmptyState
          icon={<MdTimeline className="size-6 text-gray-600" />}
          title="No events"
          message="Events will appear here as they occur"
        />
      ) : (
        <div className="space-y-0 max-h-64 overflow-y-auto relative">
          {/* Timeline vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-700/50" />

          {displayEvents.map((event, idx) => (
            <div
              key={event.id || idx}
              className="relative pl-5 py-2 cursor-pointer hover:bg-gray-800/30 rounded transition-colors group"
              onClick={() => onEventClick?.(event)}
            >
              {/* Timeline dot */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full border-2 border-gray-700 bg-[#1a1f2e] group-hover:border-cyan-500/50 transition-colors z-10" />

              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={event.severity} size="sm" />
                    <span className="text-[10px] text-gray-400 truncate">
                      {getEventTitle(event)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-gray-500 font-mono">
                    {event.zone_name && <span>{event.zone_name}</span>}
                    {event.camera_id && <span>• {event.camera_id}</span>}
                  </div>
                </div>

                <span className="text-[9px] font-mono text-gray-600 shrink-0 mt-0.5">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
