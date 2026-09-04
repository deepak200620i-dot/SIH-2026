import React, { useState, useEffect, useCallback } from 'react';
import { getEvents } from '../services/api';
import { useSystem } from '../context/SystemContext';
import SeverityBadge from '../components/common/SeverityBadge';
import AlertDetail from '../components/AlertDetail';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { formatTimestamp, formatDateTime, getEventTitle, formatCameraId, formatConfidence } from '../utils/formatters';
import { SEVERITY_ORDER, EVENT_TYPES } from '../utils/constants';
import { MdHistory, MdFilterList, MdChevronLeft, MdChevronRight } from 'react-icons/md';

const PAGE_SIZE = 25;

function EventHistory() {
  const { cameras } = useSystem();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Filters
  const [severity, setSeverity] = useState('');
  const [eventType, setEventType] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (severity) params.severity = severity;
      if (eventType) params.event_type = eventType;
      if (cameraId) params.camera_id = cameraId;

      const data = await getEvents(params);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, severity, eventType, cameraId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [severity, eventType, cameraId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Event History</h1>
        <p className="text-sm text-gray-400">Browse and filter past security events</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-3">
        <MdFilterList className="size-4 text-gray-500 shrink-0" />

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Severities</option>
          {SEVERITY_ORDER.map(s => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>

        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Types</option>
          {Object.entries(EVENT_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        <select
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Cameras</option>
          {(cameras || []).map(c => (
            <option key={c.id} value={c.id}>{c.name || c.id}</option>
          ))}
        </select>
      </div>

      {/* Events table */}
      {loading ? (
        <LoadingState message="Loading events..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPage} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<MdHistory className="size-10 text-gray-600" />}
          title="No events found"
          message="Try adjusting filters or check backend connection"
        />
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider hidden md:table-cell">Camera</th>
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider hidden lg:table-cell">Zone</th>
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider hidden lg:table-cell">Confidence</th>
                    <th className="px-4 py-2.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {events.map((event, idx) => (
                    <tr
                      key={event.id || idx}
                      onClick={() => setSelectedEvent(event)}
                      className="hover:bg-gray-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <SeverityBadge severity={event.severity} size="sm" />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-300">
                        {getEventTitle(event)}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-gray-500 hidden md:table-cell">
                        {formatCameraId(event.camera_id)}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-gray-500 hidden lg:table-cell">
                        {event.zone_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-gray-500 hidden lg:table-cell">
                        {formatConfidence(event.confidence)}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-gray-600">
                        {formatDateTime(event.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">
              Page {page + 1} • {events.length} results
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <MdChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={events.length < PAGE_SIZE}
                className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <MdChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <AlertDetail
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default EventHistory;
