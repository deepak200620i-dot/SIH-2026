import React from 'react';
import FenceEditor from '../components/FenceEditor';
import { MdFence } from 'react-icons/md';

function FenceConfig() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Fence Configuration</h1>
        <p className="text-sm text-gray-400">
          Draw restricted zones on camera frames to trigger intrusion alerts
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
        <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
          <MdFence className="size-3.5" />
          INSTRUCTIONS
        </h3>
        <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
          <li>Load a camera frame as background (optional — use "Load Background Image")</li>
          <li>Click on the canvas to place polygon vertices</li>
          <li>Place at least 3 vertices to define a zone boundary</li>
          <li>Enter a zone name and select severity level</li>
          <li>Click "Add Zone" to save the zone, then continue adding more</li>
          <li>Click "Save All Zones" to push configuration to the backend</li>
        </ol>
      </div>

      {/* Editor */}
      <FenceEditor />
    </div>
  );
}

export default FenceConfig;
