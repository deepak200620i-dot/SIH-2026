import React from 'react';
import FaceGallery from '../components/FaceGallery';

function FaceGalleryPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Face Gallery</h1>
        <p className="text-sm text-gray-400">
          Manage known faces for identity-based alerting
        </p>
      </div>

      {/* Gallery */}
      <FaceGallery />
    </div>
  );
}

export default FaceGalleryPage;
