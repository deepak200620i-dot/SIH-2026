import React from 'react';
import { MdVideocam, MdPerson, MdDirectionsCar, MdWarning, MdEvent } from 'react-icons/md';

export default function StatsBar({ stats, loading }) {
  const statItems = [
    { key: 'cameras_active', label: 'Active Cameras', icon: MdVideocam, format: (s) => s?.cameras_active ?? '—' },
    { key: 'people', label: 'People Detected', icon: MdPerson, format: (s) => s?.people_detected ?? '—' },
    { key: 'vehicles', label: 'Vehicles Detected', icon: MdDirectionsCar, format: (s) => s?.vehicles_detected ?? '—' },
    { key: 'alerts', label: 'Active Alerts', icon: MdWarning, format: (s) => s?.alerts_active ?? '—' },
    { key: 'events', label: 'Total Events', icon: MdEvent, format: (s) => s?.total_events ?? '—' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {statItems.map((item) => (
        <div 
          key={item.key} 
          className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-2">
            <item.icon className="text-cyan-400 shrink-0" size={20} />
            <span className="text-xs text-gray-400 uppercase tracking-wider truncate">
              {item.label}
            </span>
          </div>
          
          <div className="mt-auto">
            {loading ? (
              <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
            ) : (
              <span className="text-2xl font-bold text-gray-100 font-mono">
                {item.format(stats)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
