import React from 'react';
import { MdCloud, MdApi, MdCellWifi, MdVideocam } from 'react-icons/md';

function StatusDot({ status, label, icon: Icon }) {
  const isGood = status === 'connected' || status === 'online' || status === true;
  const isChecking = status === 'checking' || status === 'connecting' || status === 'reconnecting';

  let dotColor = 'bg-red-500';
  let statusText = 'OFFLINE';

  if (isGood) {
    dotColor = 'bg-emerald-500';
    statusText = 'ONLINE';
  } else if (isChecking) {
    dotColor = 'bg-amber-500';
    statusText = 'CONNECTING';
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-gray-500" />
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isChecking ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] font-mono text-gray-400">
        <span className="text-gray-500">{label}</span>{' '}
        <span className={isGood ? 'text-emerald-400' : isChecking ? 'text-amber-400' : 'text-red-400'}>
          {statusText}
        </span>
      </span>
    </div>
  );
}

export default function SystemStatus({ apiStatus, wsStatus, cameraCount = 0 }) {
  return (
    <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <StatusDot status="connected" label="SYSTEM" icon={MdCloud} />
      <StatusDot status={apiStatus} label="API" icon={MdApi} />
      <StatusDot status={wsStatus} label="WS" icon={MdCellWifi} />

      <div className="flex items-center gap-2 ml-auto">
        <MdVideocam className="size-3.5 text-gray-500" />
        <span className="text-[10px] font-mono text-gray-400">
          CAMERAS{' '}
          <span className="text-cyan-400 font-bold">{cameraCount}</span>
        </span>
      </div>
    </div>
  );
}
