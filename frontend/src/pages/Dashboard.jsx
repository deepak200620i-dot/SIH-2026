import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { useEvents } from '../hooks/useEvents';
import SystemStatus from '../components/dashboard/SystemStatus';
import ThreatLevel from '../components/dashboard/ThreatLevel';
import StatsBar from '../components/dashboard/StatsBar';
import CameraHealth from '../components/dashboard/CameraHealth';
import EventTimeline from '../components/dashboard/EventTimeline';
import EventFeed from '../components/EventFeed';
import CameraCard from '../components/CameraCard';
import AlertDetail from '../components/AlertDetail';

function Dashboard() {
  const { apiStatus, wsStatus, cameras, camerasLoading, stats, statsLoading, wsEvents, threatLevel } = useSystem();
  const { events: restEvents, loading: restEventsLoading } = useEvents({ limit: 50 });
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Combine and deduplicate events
  const allEvents = [...wsEvents, ...(restEvents || [])];
  const combinedEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const firstCameras = (cameras || []).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: Status + Threat Level */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[300px]">
          <SystemStatus apiStatus={apiStatus} wsStatus={wsStatus} cameraCount={(cameras || []).length} />
        </div>
        <ThreatLevel level={threatLevel} />
      </div>

      {/* Row 2: Stats Bar */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* Row 3: Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div>
            <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono mb-3">LIVE CAMERAS</h2>
            {camerasLoading ? (
              <div className="text-gray-400 p-4 border border-gray-800 rounded bg-gray-900/50">Loading cameras...</div>
            ) : firstCameras.length === 0 ? (
              <div className="text-gray-500 p-4 border border-gray-800 rounded bg-gray-900/50 text-sm">No cameras available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {firstCameras.map(camera => (
                  <CameraCard 
                    key={camera.id} 
                    camera={camera} 
                    recentEvents={combinedEvents.filter(e => e.camera_id === camera.id).slice(0, 5)} 
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-mono mb-3">LIVE EVENT FEED</h2>
            <EventFeed 
              events={combinedEvents} 
              loading={restEventsLoading} 
              onEventClick={setSelectedEvent} 
            />
          </div>
        </div>

        {/* Right column */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <CameraHealth cameras={cameras || []} loading={camerasLoading} />
          <EventTimeline events={combinedEvents} onEventClick={setSelectedEvent} />
        </div>
      </div>

      <AlertDetail 
        event={selectedEvent} 
        isOpen={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
      />
    </div>
  );
}

export default Dashboard;
