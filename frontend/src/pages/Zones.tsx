import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Camera as CameraIcon,
  RotateCcw,
  X,
  Eye,
  Sliders,
} from "lucide-react";
import {
  apiGetFenceZones,
  apiCreateFenceZone,
  apiDeleteFenceZone,
  FenceZoneItem,
} from "@/services/api";
import { useCameras } from "@/hooks/useCameras";

export const Zones: React.FC = () => {
  const { cameras } = useCameras();
  const [zones, setZones] = useState<FenceZoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<string>("all");
  const [severity, setSeverity] = useState<"critical" | "high" | "medium" | "low">("high");
  const [vertices, setVertices] = useState<Array<[number, number]>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await apiGetFenceZones();
      setZones(data);
    } catch (err) {
      console.error("Failed to load zones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  // Redraw canvas when vertices change
  useEffect(() => {
    if (!canvasRef.current || !isEditorOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background grid
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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

    if (vertices.length === 0) {
      // Guide prompt
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Click anywhere inside this frame to place polygon corner points",
        canvas.width / 2,
        canvas.height / 2
      );
      return;
    }

    // Color by severity
    const color =
      severity === "critical"
        ? "#ef4444"
        : severity === "high"
        ? "#f97316"
        : severity === "medium"
        ? "#eab308"
        : "#3b82f6";

    // Draw polygon edges
    ctx.beginPath();
    ctx.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i][0], vertices[i][1]);
    }
    if (vertices.length >= 3) {
      ctx.closePath();
      ctx.fillStyle =
        severity === "critical"
          ? "rgba(239, 68, 68, 0.2)"
          : severity === "high"
          ? "rgba(249, 115, 22, 0.2)"
          : severity === "medium"
          ? "rgba(234, 179, 8, 0.2)"
          : "rgba(59, 130, 246, 0.2)";
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw vertex dots
    vertices.forEach(([vx, vy], idx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vertex number badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(idx + 1), vx, vy - 10);
    });
  }, [vertices, severity, isEditorOpen]);

  // Click on canvas to add vertex
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setVertices((prev) => [...prev, [x, y]]);
  };

  // Presets
  const applyPreset = (type: "center" | "perimeter" | "left" | "right") => {
    if (type === "center") {
      setVertices([
        [160, 90],
        [480, 90],
        [480, 270],
        [160, 270],
      ]);
    } else if (type === "perimeter") {
      setVertices([
        [40, 220],
        [600, 220],
        [600, 340],
        [40, 340],
      ]);
    } else if (type === "left") {
      setVertices([
        [20, 40],
        [240, 40],
        [240, 320],
        [20, 320],
      ]);
    } else if (type === "right") {
      setVertices([
        [400, 40],
        [620, 40],
        [620, 320],
        [400, 320],
      ]);
    }
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) {
      alert("Please specify a zone name.");
      return;
    }
    if (vertices.length < 3) {
      alert("Please place at least 3 points on the canvas to form a polygon.");
      return;
    }

    setIsSaving(true);
    const created = await apiCreateFenceZone({
      name: zoneName.trim(),
      camera_id: selectedCamera,
      polygon: vertices,
      severity,
    });
    setIsSaving(false);

    if (created) {
      setStatusMessage(`Zone "${zoneName}" created successfully!`);
      setIsEditorOpen(false);
      setVertices([]);
      setZoneName("");
      fetchZones();
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      alert("Failed to save zone. Please ensure the name is unique.");
    }
  };

  const handleDeleteZone = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete restricted zone "${name}"?`)) {
      return;
    }
    const ok = await apiDeleteFenceZone(id);
    if (ok) {
      setZones((prev) => prev.filter((z) => z.id !== id));
      setStatusMessage(`Zone "${name}" deleted.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      alert("Failed to delete zone.");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-white text-2xl font-bold">Restricted Zones & Virtual Perimeter</h1>
            <span className="bg-red-900/60 text-red-300 text-xs px-2.5 py-1 rounded-full border border-red-700 font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} />
              {zones.length} Active Zones
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            Draw custom perimeter polygon fences. Intrusions inside these boundaries will trigger high-priority security alarms.
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditorOpen(true);
            setVertices([]);
            setZoneName("");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition shadow-lg shadow-blue-600/30"
        >
          <Plus size={16} />
          <span>Draw New Restricted Zone</span>
        </button>
      </div>

      {/* Notice Banner */}
      {statusMessage && (
        <div className="bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
        <div className="text-xs text-gray-300 space-y-1">
          <p className="font-semibold text-white">How Restricted Zones Work:</p>
          <p>
            When a tracked person or vehicle enters any defined polygon zone, the IBVAP Rules Engine immediately computes polygon intersections (<code className="text-amber-300">pointPolygonTest</code>) and flags an <strong className="text-red-400">INTRUSION</strong> event. Feeds or areas outside defined restricted zones will NOT generate false perimeter alerts.
          </p>
        </div>
      </div>

      {/* Zones Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading restricted zones...</div>
      ) : zones.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 text-2xl">
            🛡️
          </div>
          <h2 className="text-white text-lg font-bold">No Restricted Zones Defined</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            You currently have no active virtual fence boundaries. Click the button below to draw your first polygon zone on camera feeds.
          </p>
          <button
            onClick={() => {
              setIsEditorOpen(true);
              setVertices([]);
              setZoneName("");
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition"
          >
            <Plus size={16} />
            <span>Create Restricted Zone</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone) => {
            const sevColor =
              zone.severity === "critical"
                ? "text-red-400 border-red-500/40 bg-red-950/40"
                : zone.severity === "high"
                ? "text-orange-400 border-orange-500/40 bg-orange-950/40"
                : zone.severity === "medium"
                ? "text-yellow-400 border-yellow-500/40 bg-yellow-950/40"
                : "text-blue-400 border-blue-500/40 bg-blue-950/40";

            return (
              <div
                key={zone.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/40 transition group shadow-xl"
              >
                {/* Mini Preview Box */}
                <div className="bg-gray-950 h-36 relative flex items-center justify-center border-b border-gray-800">
                  <svg
                    viewBox="0 0 640 360"
                    className="w-full h-full p-3 pointer-events-none"
                  >
                    <polygon
                      points={(zone.polygon || []).map((p) => p.join(",")).join(" ")}
                      fill={
                        zone.severity === "critical"
                          ? "rgba(239, 68, 68, 0.25)"
                          : zone.severity === "high"
                          ? "rgba(249, 115, 22, 0.25)"
                          : "rgba(234, 179, 8, 0.25)"
                      }
                      stroke={
                        zone.severity === "critical"
                          ? "#ef4444"
                          : zone.severity === "high"
                          ? "#f97316"
                          : "#eab308"
                      }
                      strokeWidth="4"
                    />
                    {(zone.polygon || []).map(([px, py], i) => (
                      <circle key={i} cx={px} cy={py} r="8" fill="#ffffff" />
                    ))}
                  </svg>
                  <span className="absolute bottom-2 left-3 text-[10px] font-mono text-gray-500">
                    {zone.polygon?.length || 0} Polygon Vertices
                  </span>
                </div>

                {/* Card Details */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-white font-bold text-base">{zone.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <CameraIcon size={12} className="text-gray-500" />
                        <span>Camera: <strong className="text-gray-200">{zone.camera_id}</strong></span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded border ${sevColor}`}
                    >
                      {zone.severity}
                    </span>
                  </div>

                  <div className="border-t border-gray-800/80 pt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-mono">
                      ID: #{zone.id}
                    </span>
                    <button
                      onClick={() => handleDeleteZone(zone.id, zone.name)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2.5 py-1 rounded transition"
                    >
                      <Trash2 size={13} />
                      <span>Delete Zone</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draw / Define Zone Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="text-blue-400" size={22} />
                <div>
                  <h2 className="text-white font-bold text-lg">Define New Restricted Zone</h2>
                  <p className="text-gray-400 text-xs">
                    Click anywhere on the canvas below to place polygon boundary points.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Canvas Interactive Drawing Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Perimeter Canvas (640 x 360 Standard Resolution)</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{vertices.length} points placed</span>
                  {vertices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVertices([])}
                      className="text-red-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Clear Canvas
                    </button>
                  )}
                </div>
              </div>

              <div className="relative aspect-video max-h-[380px] bg-slate-950 rounded-xl overflow-hidden border border-gray-700 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  onClick={handleCanvasClick}
                  className="w-full h-full object-contain cursor-crosshair"
                />
              </div>

              {/* Template Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-gray-400">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("center")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700"
                >
                  Center Perimeter
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("perimeter")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700"
                >
                  Bottom Gate Zone
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("left")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700"
                >
                  Left Corridor
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("right")}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded border border-gray-700"
                >
                  Right Corridor
                </button>
              </div>
            </div>

            {/* Zone Metadata Form */}
            <form onSubmit={handleSaveZone} className="space-y-4 pt-2 border-t border-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1.5">
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Border Perimeter Alpha"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1.5">
                    Associated Camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All Cameras (Global Perimeter)</option>
                    <option value="device_webcam">Device Webcam</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1.5">
                    Intrusion Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="critical">CRITICAL (Red Alarm)</option>
                    <option value="high">HIGH (High Alert)</option>
                    <option value="medium">MEDIUM (Standard Alert)</option>
                    <option value="low">LOW (Informational)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || vertices.length < 3}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition shadow-lg ${
                    vertices.length >= 3 && !isSaving
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isSaving ? "Saving Zone..." : "Save Restricted Zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
