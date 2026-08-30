import React, { useState, useEffect } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { SecurityZone, NormalizedPoint } from '../types/zone';
import { zoneService } from '../services/zoneService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { ZoneDrawingCanvas } from '../components/zones/ZoneDrawingCanvas';
import { ZoneModal } from '../components/zones/ZoneModal';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Layers,
  Compass
} from 'lucide-react';

export const PerimeterIntelligencePage: React.FC = () => {
  const { cameras } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [zones, setZones] = useState<SecurityZone[]>([]);
  const [loading, setLoading] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<NormalizedPoint[]>([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<SecurityZone | null>(null);

  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0]);
    }
  }, [cameras, selectedCamera]);

  useEffect(() => {
    if (selectedCamera) {
      loadZones(selectedCamera.camera_id);
    }
  }, [selectedCamera]);

  const loadZones = async (cameraId: string) => {
    setLoading(true);
    try {
      const data = await zoneService.getZones(cameraId);
      setZones(data);
    } catch (e) {
      console.error('Failed to load zones', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDrawing = () => {
    setDrawnPoints([]);
    setIsDrawing(true);
    setZoneToEdit(null);
  };

  const handleFinishDrawing = () => {
    if (drawnPoints.length < 3) {
      alert('A virtual security zone requires at least 3 points to form a polygon.');
      return;
    }
    setIsDrawing(false);
    setZoneModalOpen(true);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  const handleToggleZone = async (zone: SecurityZone) => {
    try {
      await zoneService.updateZone(zone.zone_id, { enabled: !zone.enabled });
      if (selectedCamera) loadZones(selectedCamera.camera_id);
    } catch (e) {
      console.error('Failed to toggle zone', e);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (window.confirm('Are you sure you want to delete this virtual security zone?')) {
      try {
        await zoneService.deleteZone(zoneId);
        if (selectedCamera) loadZones(selectedCamera.camera_id);
      } catch (e) {
        console.error('Failed to delete zone', e);
      }
    }
  };

  const handleEditZone = (zone: SecurityZone) => {
    setZoneToEdit(zone);
    setDrawnPoints(zone.polygon);
    setZoneModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c132b] via-[#0f172a] to-[#0d131f] border border-[#2e1a47] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
              VIRTUAL PERIMETER MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• RESTRICTED ZONES & BEHAVIOURAL RULES</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Virtual Fences, Restricted Zones & Behaviour Intelligence
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Create resolution-independent normalized virtual fences and intrusion perimeters. Object ground-plane bottom-center coordinates are evaluated for boundary crossing, dwell loitering, stationary vehicle duration, and wrong-direction breaches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDrawing ? (
            <>
              <button
                onClick={handleCancelDrawing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Cancel Drawing
              </button>
              <button
                onClick={handleFinishDrawing}
                disabled={drawnPoints.length < 3}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Zone ({drawnPoints.length} pts)
              </button>
            </>
          ) : (
            <button
              onClick={handleStartDrawing}
              disabled={!selectedCamera}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              Draw Security Zone
            </button>
          )}
        </div>
      </div>

      {/* Camera Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {cameras.map((cam) => (
          <button
            key={cam.camera_id}
            onClick={() => {
              if (isDrawing) setIsDrawing(false);
              setSelectedCamera(cam);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition shrink-0 ${
              selectedCamera?.camera_id === cam.camera_id
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>{cam.camera_id}</span>
            <span className="text-slate-500 font-sans truncate max-w-[120px]">{cam.camera_name}</span>
          </button>
        ))}
      </div>

      {/* Main Workspace Layout */}
      {selectedCamera && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Video & Drawing Canvas (7 Cols) */}
          <div className="lg:col-span-7 bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  {selectedCamera.camera_id}
                </span>
                <span className="text-sm font-semibold text-white">
                  {selectedCamera.camera_name}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {isDrawing ? 'DRAWING MODE: Click points on video' : 'LIVE MONITORING & PERIMETER OVERLAY'}
              </span>
            </div>

            {/* Video Canvas Container */}
            <div className="relative rounded-xl overflow-hidden aspect-video bg-black border border-[#1e293b]">
              <LiveVideoPlayer camera={selectedCamera} showControls={false} />

              {/* Interactive Zone Drawing Canvas Overlay */}
              <ZoneDrawingCanvas
                isDrawing={isDrawing}
                points={drawnPoints}
                onPointsChange={setDrawnPoints}
                existingZones={zones}
              />
            </div>
          </div>

          {/* Right Column: Configured Security Zones List (5 Cols) */}
          <div className="lg:col-span-5 bg-[#111a2e] border border-[#1e293b] rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-400" />
                  Active Security Zones ({zones.length})
                </h3>
                <button
                  onClick={() => selectedCamera && loadZones(selectedCamera.camera_id)}
                  className="p-1 text-slate-400 hover:text-white rounded transition"
                  title="Refresh Zones"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>

              {/* Zones List */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {zones.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-mono space-y-2">
                    <ShieldAlert className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                    <p>No virtual security zones configured for {selectedCamera.camera_id}.</p>
                    <p className="text-[11px] text-slate-600">
                      Click "Draw Security Zone" above to place vertices on the video.
                    </p>
                  </div>
                ) : (
                  zones.map((z) => (
                    <div
                      key={z.zone_id}
                      className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                        z.enabled
                          ? 'bg-[#0f172a] border-slate-700/80 shadow-md'
                          : 'bg-[#090d16] border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{z.name}</span>
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                z.zone_type === 'RESTRICTED'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : z.zone_type === 'HIGH_SECURITY'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : z.zone_type === 'BUFFER'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {z.zone_type}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {z.zone_id} • {z.polygon.length} Vertices
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleZone(z)}
                            className={`p-1.5 rounded transition ${
                              z.enabled ? 'text-emerald-400 hover:bg-emerald-950/40' : 'text-slate-500 hover:bg-slate-800'
                            }`}
                            title={z.enabled ? 'Disable Zone' : 'Enable Zone'}
                          >
                            {z.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleEditZone(z)}
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                            title="Edit Zone"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(z.zone_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="text-slate-400">Monitored:</span>
                        {z.monitored_classes.map((cls) => (
                          <span
                            key={cls}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]"
                          >
                            {cls}
                          </span>
                        ))}
                        {z.direction_rule !== 'NONE' && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 text-[10px]">
                            FORBID: {z.direction_rule}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Helper Info */}
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b] rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                Ground-Plane Intrusion Detection
              </div>
              <p>
                Object intersection is calculated using the bottom-center anchor point of tracked entities, ensuring precise boundary crossing detection at the physical ground plane.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zone Configuration Modal */}
      {selectedCamera && (
        <ZoneModal
          isOpen={zoneModalOpen}
          onClose={() => setZoneModalOpen(false)}
          cameraId={selectedCamera.camera_id}
          polygon={drawnPoints}
          zoneToEdit={zoneToEdit}
          onSuccess={() => {
            loadZones(selectedCamera.camera_id);
            setDrawnPoints([]);
          }}
        />
      )}
    </div>
  );
};
