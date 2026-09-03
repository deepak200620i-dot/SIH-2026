import React, { useState, useCallback, useEffect } from 'react';
import { getKnownFaces, addKnownFace, removeKnownFace } from '../services/api1';
import LoadingState from './common/LoadingState';
import EmptyState from './common/EmptyState';
import ErrorState from './common/ErrorState';
import {
  MdFace,
  MdPersonAdd,
  MdDelete,
  MdClose,
  MdUploadFile,
} from 'react-icons/md';

export default function FaceGallery() {
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addFile, setAddFile] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  const fetchFaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKnownFaces();
      setFaces(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load faces');
      setFaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaces();
  }, [fetchFaces]);

  const handleAdd = async () => {
    if (!addName.trim() || !addFile) return;
    setAddLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', addName.trim());
      formData.append('image', addFile);
      await addKnownFace(formData);
      setAddName('');
      setAddFile(null);
      setShowAddForm(false);
      fetchFaces();
    } catch (err) {
      // Silently handle — backend may not support faces endpoint
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await removeKnownFace(id);
      setFaces((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      // Silently handle
    }
  };

  if (loading) {
    return <LoadingState message="Loading known faces..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchFaces} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          {faces.length} known {faces.length === 1 ? 'face' : 'faces'}
        </span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/20 border border-cyan-500/30 text-xs text-cyan-400 hover:bg-cyan-600/30 transition-colors font-mono"
        >
          {showAddForm ? <MdClose className="size-3.5" /> : <MdPersonAdd className="size-3.5" />}
          {showAddForm ? 'Cancel' : 'Add Face'}
        </button>
      </div>

      {/* Add face form */}
      {showAddForm && (
        <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4 animate-fade-in space-y-3">
          <div>
            <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
              Name
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
              Photo
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded cursor-pointer hover:border-gray-600 transition-colors">
              <MdUploadFile className="size-4 text-gray-500" />
              <span className="text-xs text-gray-400 truncate">
                {addFile ? addFile.name : 'Choose image...'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          <button
            onClick={handleAdd}
            disabled={!addName.trim() || !addFile || addLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50 transition-colors"
          >
            <MdPersonAdd className="size-4" />
            {addLoading ? 'Adding...' : 'Add Face'}
          </button>
        </div>
      )}

      {/* Face grid */}
      {faces.length === 0 ? (
        <EmptyState
          icon={<MdFace className="size-10 text-gray-600" />}
          title="No known faces"
          message="Add faces to enable recognition alerts"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {faces.map((face) => (
            <div
              key={face.id}
              className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg overflow-hidden group hover:border-gray-600 transition-colors"
            >
              <div className="aspect-square bg-gray-900 flex items-center justify-center relative">
                {face.image_url ? (
                  <img
                    src={face.image_url}
                    alt={face.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <MdFace className="size-12 text-gray-700" />
                )}

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(face.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <MdDelete className="size-3.5" />
                </button>
              </div>

              <div className="p-2">
                <span className="text-xs text-gray-300 truncate block">{face.name}</span>
                {face.created_at && (
                  <span className="text-[9px] text-gray-600 font-mono">
                    Added {new Date(face.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
