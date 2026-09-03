import React from 'react';
import StatusIndicator from '../common/StatusIndicator';
import LoadingState from '../common/LoadingState';
import EmptyState from '../common/EmptyState';
import { MdVideocam, MdVideocamOff } from 'react-icons/md';

export default function CameraHealth({ cameras = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
        <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono mb-3">CAMERA HEALTH</h3>
        <LoadingState message="Loading cameras..." />
      </div>
    );
  }

  if (!cameras || cameras.length === 0) {
    return (
      <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
        <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono mb-3">CAMERA HEALTH</h3>
        <EmptyState
          icon={<MdVideocamOff className="size-6 text-gray-600" />}
          title="No cameras"
          message="Camera feeds will appear when backend is connected"
        />
      </div>
    );
  }

  const onlineCount = cameras.filter(c => c.status === 'active' || c.status === 'online').length;

  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono">CAMERA HEALTH</h3>
        <span className="text-[10px] font-mono text-cyan-400">
          {onlineCount}/{cameras.length} online
        </span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {cameras.map((camera) => {
          const isOnline = camera.status === 'active' || camera.status === 'online';
          return (
            <div
              key={camera.id}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MdVideocam className={`size-3.5 shrink-0 ${isOnline ? 'text-gray-400' : 'text-gray-600'}`} />
                <span className={`text-xs truncate ${isOnline ? 'text-gray-300' : 'text-gray-500'}`}>
                  {camera.name || camera.id}
                </span>
              </div>
              <StatusIndicator status={camera.status} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
