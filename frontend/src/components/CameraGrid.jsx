import React from 'react';
import CameraCard from './CameraCard';
import LoadingState from './common/LoadingState';
import EmptyState from './common/EmptyState';
import { MdVideocamOff } from 'react-icons/md';

export default function CameraGrid({ cameras = [], loading = false, events = [] }) {
  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <LoadingState message="Loading cameras..." />
      </div>
    );
  }

  if (!cameras || cameras.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <EmptyState 
          icon={<MdVideocamOff className="size-8 text-gray-600" />}
          title="No cameras available" 
          message="Cameras will appear here when configured in the backend" 
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {cameras.map((camera) => {
        const cameraEvents = events.filter(e => e.camera_id === camera.id);
        return (
          <CameraCard 
            key={camera.id} 
            camera={camera} 
            recentEvents={cameraEvents} 
          />
        );
      })}
    </div>
  );
}
