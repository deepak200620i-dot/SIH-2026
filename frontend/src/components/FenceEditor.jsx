import React, { useRef, useState, useCallback, useEffect } from 'react';
import { saveFence } from '../services/api1';
import {
  MdUndo,
  MdDeleteSweep,
  MdSave,
  MdCheckCircle,
  MdError,
  MdAddCircleOutline,
} from 'react-icons/md';

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

export default function FenceEditor() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [bgImage, setBgImage] = useState(null);
  const [vertices, setVertices] = useState([]);
  const [zones, setZones] = useState([]);
  const [zoneName, setZoneName] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });

  // Draw on canvas whenever vertices, zones, or bgImage change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Grid pattern
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw existing zones
    zones.forEach((zone) => {
      drawPolygon(ctx, zone.vertices, 'rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0.6)', zone.name);
    });

    // Draw current polygon in progress
    if (vertices.length > 0) {
      drawPolygon(ctx, vertices, 'rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.8)', null, true);
    }
  }, [vertices, zones, bgImage, canvasSize]);

  function drawPolygon(ctx, pts, fillColor, strokeColor, label, showDots = false) {
    if (pts.length < 2) {
      if (pts.length === 1 && showDots) {
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
      }
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    if (!showDots || pts.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vertex dots
    if (showDots) {
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
      });
    }

    // Label
    if (label && pts.length >= 3) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy);
    }
  }

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    setVertices((prev) => [...prev, [Math.round(x), Math.round(y)]]);
  }, []);

  const handleUndo = () => {
    setVertices((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setVertices([]);
  };

  const handleAddZone = () => {
    if (vertices.length < 3) return;
    if (!zoneName.trim()) return;

    // Normalize to 0–1 range
    const normalized = vertices.map(([x, y]) => [
      +(x / canvasSize.width).toFixed(4),
      +(y / canvasSize.height).toFixed(4),
    ]);

    setZones((prev) => [...prev, { name: zoneName.trim(), severity, vertices: normalized }]);
    setVertices([]);
    setZoneName('');
  };

  const handleRemoveZone = (idx) => {
    setZones((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (zones.length === 0) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await saveFence(zones);
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 transition-colors font-mono"
        >
          Load Background Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <div className="h-4 w-px bg-gray-700" />

        <button
          onClick={handleUndo}
          disabled={vertices.length === 0}
          className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Undo last vertex"
        >
          <MdUndo className="size-4" />
        </button>

        <button
          onClick={handleClear}
          disabled={vertices.length === 0}
          className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Clear current polygon"
        >
          <MdDeleteSweep className="size-4" />
        </button>
      </div>

      {/* Canvas */}
      <div className="rounded-lg overflow-hidden border border-gray-700/50 bg-gray-900">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair"
          style={{ maxHeight: '500px' }}
        />
      </div>

      {/* Zone form */}
      <div className="flex flex-wrap items-end gap-3 bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
            Zone Name
          </label>
          <input
            type="text"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="e.g. Restricted Area A"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
            Severity
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500/50"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAddZone}
          disabled={vertices.length < 3 || !zoneName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/20 border border-cyan-500/30 text-xs text-cyan-400 hover:bg-cyan-600/30 disabled:opacity-30 transition-colors font-mono"
        >
          <MdAddCircleOutline className="size-3.5" />
          Add Zone
        </button>

        <span className="text-[10px] text-gray-600 font-mono">
          {vertices.length} vertices placed
        </span>
      </div>

      {/* Zone list */}
      {zones.length > 0 && (
        <div className="bg-[#1a1f2e] border border-gray-700/50 rounded-lg p-4">
          <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-2">
            DEFINED ZONES ({zones.length})
          </h4>
          <div className="space-y-2">
            {zones.map((zone, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-2 border border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-300">{zone.name}</span>
                  <span className="text-[9px] font-mono text-gray-500">
                    {zone.severity.toUpperCase()} • {zone.vertices.length} pts
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveZone(idx)}
                  className="text-red-500/60 hover:text-red-400 transition-colors text-xs font-mono"
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50 transition-colors"
          >
            <MdSave className="size-4" />
            {saving ? 'Saving...' : 'Save All Zones'}
          </button>

          {saveStatus === 'success' && (
            <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-xs">
              <MdCheckCircle className="size-4" /> Zones saved successfully
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="mt-2 flex items-center gap-1.5 text-red-400 text-xs">
              <MdError className="size-4" /> Failed to save — backend may be unavailable
            </div>
          )}
        </div>
      )}
    </div>
  );
}
