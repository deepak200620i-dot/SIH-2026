import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { useEvents } from '../hooks/useEvents';
import SeverityBadge from '../components/common/SeverityBadge';
import AlertDetail from '../components/AlertDetail';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import { formatTimestamp, getEventTitle, getEventDescription, formatCameraId } from '../utils/formatters';
import { SEVERITY_ORDER } from '../utils/constants';
import { MdNotifications, MdFilterList } from 'react-icons/md';

function Alerts() {
  const { wsEvents } = useSystem();
  const { events: restEvents, loading } = useEvents({ limit: 100 });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');

  // Combine and deduplicate
  const allEvents = [...wsEvents, ...(restEvents || [])];
  const combinedEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Filter
  const filteredEvents = filterSeverity === 'all'
    ? combinedEvents
    : combinedEvents.filter(e => e.severity === filterSeverity);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-400">Active and recent security alerts</p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <MdFilterList className="size-4 text-gray-500" />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Severities</option>
            {SEVERITY_ORDER.map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert list */}
      {loading ? (
        <LoadingState message="Loading alerts..." />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<MdNotifications className="size-10 text-gray-600" />}
          title="No alerts"
          message={filterSeverity !== 'all'
            ? `No ${filterSeverity.toUpperCase()} alerts found`
            : 'No alerts to display — events will appear when the backend is connected'}
        />
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event, idx) => (
            <div
              key={event.id || idx}
              onClick={() => setSelectedEvent(event)}
              className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/40 cursor-pointer transition-colors animate-fade-in flex items-start gap-4"
            >
              <SeverityBadge severity={event.severity} size="md" />

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-200">
                  {getEventTitle(event)}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {getEventDescription(event)}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {event.camera_id && (
                    <span className="text-[10px] font-mono text-gray-500">
                      {formatCameraId(event.camera_id)}
                    </span>
                  )}
                  {event.zone_name && (
                    <span className="text-[10px] font-mono text-gray-500">
                      {event.zone_name}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono text-gray-600 shrink-0">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      <AlertDetail
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default Alerts;
