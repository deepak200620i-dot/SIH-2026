import React from 'react';
import SeverityBadge from './common/SeverityBadge';
import {
  formatDateTime,
  formatConfidence,
  formatTrackId,
  formatCameraId,
  getEventTitle,
  getEventDescription,
  parseBbox,
  parseMetadata,
} from '../utils/formatters';
import { getEvidenceUrl } from '../services/api1';
import {
  MdClose,
  MdAccessTime,
  MdVideocam,
  MdGpsFixed,
  MdFace,
  MdDirectionsCar,
  MdFingerprint,
  MdInfoOutline,
  MdArrowForward,
} from 'react-icons/md';

export default function AlertDetail({ event, isOpen, onClose }) {
  if (!isOpen || !event) return null;

  const evidenceUrl = event.snapshot ? getEvidenceUrl(event.snapshot) : null;
  const bbox = parseBbox(event.bbox);
  const metadata = parseMetadata(event.metadata);
  const trackId = formatTrackId(event.track_id);

  // Build "WHY THIS ALERT?" chain from event fields
  const alertChain = [];
  if (event.class_name) alertChain.push({ label: 'Detected', value: event.class_name.toUpperCase() });
  if (event.zone_name) alertChain.push({ label: 'Zone', value: event.zone_name });
  if (event.event_type) alertChain.push({ label: 'Rule', value: event.event_type.replace(/_/g, ' ').toUpperCase() });
  if (event.severity) alertChain.push({ label: 'Severity', value: event.severity.toUpperCase() });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-[#0d1117] border-l border-gray-800 z-50 overflow-y-auto animate-fade-in shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0d1117]/95 backdrop-blur-sm border-b border-gray-800 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={event.severity} size="lg" />
            <h2 className="text-sm font-semibold text-gray-100">
              {getEventTitle(event)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <MdClose className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Evidence image */}
          {evidenceUrl && (
            <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-800">
              <img
                src={evidenceUrl}
                alt="Evidence"
                className="w-full object-contain max-h-64"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {/* Bounding box overlay */}
              {bbox && (
                <div
                  className="absolute border-2 border-cyan-400/60 bg-cyan-400/10 pointer-events-none"
                  style={{
                    left: `${(bbox[0] / 1920) * 100}%`,
                    top: `${(bbox[1] / 1080) * 100}%`,
                    width: `${((bbox[2] - bbox[0]) / 1920) * 100}%`,
                    height: `${((bbox[3] - bbox[1]) / 1080) * 100}%`,
                  }}
                />
              )}
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-gray-300">{getEventDescription(event)}</p>

          {/* Detail fields */}
          <div className="grid grid-cols-2 gap-3">
            <DetailField icon={MdAccessTime} label="Timestamp" value={formatDateTime(event.timestamp)} />
            <DetailField icon={MdVideocam} label="Camera" value={formatCameraId(event.camera_id)} />
            {event.zone_name && <DetailField icon={MdGpsFixed} label="Zone" value={event.zone_name} />}
            {trackId && <DetailField icon={MdFingerprint} label="Track" value={trackId} />}
            {event.class_name && <DetailField icon={MdInfoOutline} label="Class" value={event.class_name} />}
            {event.confidence != null && <DetailField icon={MdInfoOutline} label="Confidence" value={formatConfidence(event.confidence)} />}
            {event.face_name && <DetailField icon={MdFace} label="Face Match" value={event.face_name} />}
            {event.plate_text && <DetailField icon={MdDirectionsCar} label="Plate" value={event.plate_text} />}
          </div>

          {/* WHY THIS ALERT? */}
          {alertChain.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-3">
                WHY THIS ALERT?
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {alertChain.map((step, i) => (
                  <React.Fragment key={step.label}>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-600 uppercase font-mono">{step.label}</span>
                      <span className="text-xs text-cyan-400 font-mono font-bold">{step.value}</span>
                    </div>
                    {i < alertChain.length - 1 && (
                      <MdArrowForward className="text-gray-600 size-3.5 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Additional metadata */}
          {Object.keys(metadata).length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-2">
                METADATA
              </h4>
              <pre className="text-[10px] font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DetailField({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="size-3 text-gray-600" />
        <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs text-gray-300 font-medium">{value || '—'}</span>
    </div>
  );
}
