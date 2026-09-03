import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import CameraGrid from '../components/CameraGrid';
import AlertDetail from '../components/AlertDetail';

function LiveCameras() {
  const { cameras, camerasLoading, wsEvents } = useSystem();
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Live Cameras</h1>
        <p className="text-sm text-gray-400">Real-time camera monitoring</p>
      </div>

      <div className="flex-1">
        <CameraGrid 
          cameras={cameras || []} 
          loading={camerasLoading} 
          events={wsEvents} 
        />
      </div>

      <AlertDetail 
        event={selectedEvent} 
        isOpen={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
      />
    </div>
  );
}

export default LiveCameras;
