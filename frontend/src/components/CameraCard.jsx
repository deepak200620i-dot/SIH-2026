import React, { useState } from 'react';
import StatusIndicator from './common/StatusIndicator';
import SeverityBadge from './common/SeverityBadge';
import { formatCameraId, formatConfidence, formatTrackId } from '../utils/formatters';
import { getEvidenceUrl } from '../services/api1';
import { MdVideocam, MdVideocamOff, MdPersonSearch, MdDirectionsCar } from 'react-icons/md';

export default function CameraCard({ camera, recentEvents = [] }) {
  const [imageError, setImageError] = useState(false);

  const isActive = camera.status === 'active' || camera.status === 'online';
  const latestEvent = recentEvents.length > 0 ? recentEvents[0] : null;
  const snapshotUrl = latestEvent?.snapshot ? getEvidenceUrl(latestEvent.snapshot) : null;
  
  // Parse bounding box if available and image is active
  let bboxStyle = null;
  if (isActive && latestEvent?.bbox && !imageError) {
    try {
      const [x1, y1, x2, y2] = JSON.parse(latestEvent.bbox);
      // Assuming a standard 16:9 1920x1080 resolution for relative percentages if actual isn't known
      // or using rough bounding box overlays directly via percentage if normalized.
      // If the coords are pixel coords on a 1920x1080 stream:
      const width = 1920;
      const height = 1080;
      const left = (x1 / width) * 100;
      const top = (y1 / height) * 100;
      const boxWidth = ((x2 - x1) / width) * 100;
      const boxHeight = ((y2 - y1) / height) * 100;
      
      bboxStyle = {
        left: `${left}%`,
        top: `${top}%`,
        width: `${boxWidth}%`,
        height: `${boxHeight}%`,
      };
    } catch (e) {
      // Failed to parse bbox, ignore
    }
  }

  // Detection info logic
  const detectionEvent = recentEvents.find(e => e.class_name && e.confidence);

  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg overflow-hidden group hover:border-gray-600 transition-colors flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
        <div className="flex items-center gap-2 overflow-hidden pr-2">
          <MdVideocam className="text-gray-500 size-[14px] shrink-0" />
          <span className="text-xs font-medium text-gray-300 truncate">
            {camera.name || 'Unknown Camera'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-gray-500">
            {formatCameraId(camera.id)}
          </span>
          <StatusIndicator status={camera.status} size="sm" />
        </div>
      </div>

      {/* Video/Frame Area */}
      <div className="aspect-video bg-gray-900 relative overflow-hidden flex items-center justify-center">
        {isActive ? (
          <>
            {snapshotUrl && !imageError ? (
              <img 
                src={snapshotUrl} 
                alt="Latest Evidence" 
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-600 space-y-2">
                <MdVideocam className="size-8 opacity-20" />
                <span className="text-xs font-mono tracking-widest">AWAITING FEED</span>
              </div>
            )}

            {/* Bounding Box Overlay */}
            {bboxStyle && (
              <div 
                className="absolute border-2 border-cyan-400/50 bg-cyan-400/10 pointer-events-none"
                style={bboxStyle}
              />
            )}

            {/* Detection HUD Overlay */}
            {detectionEvent && (
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded px-2 py-1 border border-gray-700/50 flex flex-col items-end">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
                  {detectionEvent.class_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400">
                    {formatConfidence(detectionEvent.confidence)}
                  </span>
                  {detectionEvent.track_id && (
                    <span className="text-[10px] font-mono text-gray-500">
                      {formatTrackId(detectionEvent.track_id)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600 space-y-3 p-4">
            <MdVideocamOff className="size-10 text-gray-700" />
            <span className="text-xs font-mono tracking-widest text-gray-500">CAMERA OFFLINE</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/50 min-h-[44px] flex items-center">
        {latestEvent ? (
          <div className="flex items-center gap-2 w-full truncate">
            <SeverityBadge severity={latestEvent.severity} size="sm" />
            <span className="text-[10px] text-gray-400 truncate">
              {latestEvent.event_type ? latestEvent.event_type.replace(/_/g, ' ').toUpperCase() : 'EVENT DETECTED'}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-500 font-mono">
            NO RECENT ACTIVITY
          </span>
        )}
      </div>
    </div>
  );
}
