import React, { useState, useEffect, useMemo } from 'react';
import { useCameras } from '../context/CameraContext';
import { useAuth } from '../context/AuthContext';
import { Camera } from '../types/camera';
import { SecurityZone, NormalizedPoint } from '../types/zone';
import { zoneService } from '../services/zoneService';
import { alertSoundService } from '../services/alertSoundService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { ZoneDrawingCanvas } from '../components/zones/ZoneDrawingCanvas';
import { ZoneModal } from '../components/zones/ZoneModal';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
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
  Compass,
  Volume2,
  Send,
  Shield,
  Zap,
  Sliders,
  X,
  Lock
} from 'lucide-react';

export const PerimeterIntelligencePage: React.FC = () => {
  const { cameras } = useCameras();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const userBop = user?.scope_id || '';
  const postName = user?.post_name || '';
  const sector = user?.sector || '';

  // Universal Scoping: Adapts dynamically to ANY logged-in Commander
  const scopedCameras = useMemo(() => {
    if (isSuperAdmin || (!userBop && !postName) || userBop === 'GLOBAL') return cameras;
    const sId = userBop.toLowerCase().replace('bop-', '');
    const pName = postName.toLowerCase();
    const sec = sector.toLowerCase();

    const filtered = cameras.filter((cam) => {
      const bSite = (cam.bop_site || '').toLowerCase();
      const cId = (cam.camera_id || '').toLowerCase();
      const cSec = (cam.sector || '').toLowerCase();
      return (
        (userBop && bSite === userBop.toLowerCase()) ||
        (sId && (cId.includes(sId) || bSite.includes(sId))) ||
        (pName && (bSite.includes(pName) || cId.includes(pName))) ||
        (sec && cSec.includes(sec))
      );
    });
    return filtered.length > 0 ? filtered : cameras;
  }, [cameras, isSuperAdmin, userBop, postName, sector]);

  const effectiveCameras = scopedCameras;

  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [zones, setZones] = useState<SecurityZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [sirenActive, setSirenActive] = useState(false);
  const [isPerimeterArmed, setIsPerimeterArmed] = useState(true);
  const [sensitivity, setSensitivity] = useState<'HIGH' | 'BALANCED' | 'WEATHER'>('BALANCED');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<NormalizedPoint[]>([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<SecurityZone | null>(null);

  // Dispatch modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState('URGENT');

  useEffect(() => {
    if (effectiveCameras.length > 0) {
      if (!selectedCamera || !effectiveCameras.some((c) => c.camera_id === selectedCamera.camera_id)) {
        setSelectedCamera(effectiveCameras[0]);
      }
    }
  }, [effectiveCameras, selectedCamera]);

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

  // 1-Click Quick Preset Boundary Polygon (Fence-Line Calibration)
  const handleQuickPresetBoundary = () => {
    if (!selectedCamera) return;
    const presetPolygon: NormalizedPoint[] = [
      { x: 0.05, y: 0.65 },
      { x: 0.95, y: 0.65 },
      { x: 0.95, y: 0.95 },
      { x: 0.05, y: 0.95 }
    ];
    setDrawnPoints(presetPolygon);
    setIsDrawing(false);
    setZoneToEdit(null);
    setZoneModalOpen(true);
  };

  // Master Perimeter Grid Arm/Disarm
  const handleToggleMasterArm = () => {
    const next = !isPerimeterArmed;
    setIsPerimeterArmed(next);
    if (next) {
      alertSoundService.speakVoiceAlert('Perimeter boundary armed. Sentry tripwires active.');
      setActionNotice('Perimeter Grid ARMED: Optical tripwires actively monitoring ground plane.');
    } else {
      alertSoundService.speakVoiceAlert('Perimeter in standby mode.');
      setActionNotice('Perimeter Grid STANDBY: Maintenance mode active. Alarms suppressed.');
    }
    setTimeout(() => setActionNotice(null), 4000);
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

  const handleTestSiren = () => {
    setSirenActive(true);
    alertSoundService.playAlarm('CRITICAL');
    alertSoundService.speakVoiceAlert('Perimeter acoustic test initiated. Sentry boundary siren operational.');
    setTimeout(() => setSirenActive(false), 3000);
  };

  const handleDispatchBreach = (zone?: SecurityZone) => {
    const zoneName = zone ? zone.name : 'Boundary Wire';
    const camId = selectedCamera ? selectedCamera.camera_id : 'CAM-PERIMETER';
    const postLabel = postName || userBop || 'CHECKPOST';
    setDispatchTitle(`🚨 VIRTUAL PERIMETER BREACH: ${zoneName} (${postLabel})`);
    setDispatchSummary(
      `Intrusion alert on ${camId}. Tripwire zone '${zoneName}' (${zone ? zone.zone_type : 'RESTRICTED'}) triggered at physical ground plane. Sensitivity: ${sensitivity}. Sentry patrol mobilized under Checkpost SOP-Alpha.`
    );
    setDispatchPriority(zone?.severity === 'CRITICAL' ? 'FLASH_CRITICAL' : 'URGENT');
    setDispatchModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner with Checkpost Scope & Tactical Actions */}
      <div className="bg-gradient-to-r from-[#1c132b] via-[#0f172a] to-[#0d131f] border border-[#2e1a47] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
              VIRTUAL PERIMETER & TRIPWIRES
            </span>
            <span className="text-slate-400 font-mono text-xs flex items-center gap-1">
              <Lock className="w-3 h-3 text-cyan-400" />
              JURISDICTION: <strong className="text-white">{postName || userBop || 'ASSIGNED CHECKPOST'}</strong>
            </span>
            <span className="text-slate-500 font-mono text-xs">
              • SECTOR: {sector || 'FRONTIER'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Checkpost Boundary Fences & Tripwire Matrix
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Configure virtual security polygons and tripwires across border fences, gates, and restricted zones. Object ground coordinates trigger immediate sentry alarms and cryptographic SITREP reporting to Delhi Central HQ.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Master Perimeter Arm / Standby Switch */}
          <button
            type="button"
            onClick={handleToggleMasterArm}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
              isPerimeterArmed
                ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/50'
                : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/60 text-amber-300 shadow-md shadow-amber-950/50'
            }`}
            title="Toggle Master Virtual Perimeter Grid State"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{isPerimeterArmed ? 'GRID: ARMED' : 'GRID: STANDBY'}</span>
          </button>

          {/* Quick Preset Boundary Action */}
          <button
            type="button"
            onClick={handleQuickPresetBoundary}
            disabled={!selectedCamera}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition shadow-md shadow-cyan-900/30 cursor-pointer"
            title="Calibrate standard fence boundary polygon instantly"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-300" />
            <span>⚡ QUICK BOUNDARY PRESET</span>
          </button>

          {/* Test Sentry Siren Button */}
          <button
            onClick={handleTestSiren}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
              sirenActive
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/50 animate-pulse'
                : 'bg-[#141e33] hover:bg-[#1a2744] text-rose-300 border-rose-500/40'
            }`}
            title="Trigger 3-second audible test on checkpost fence acoustic horn"
          >
            <Volume2 className={`w-3.5 h-3.5 ${sirenActive ? 'animate-bounce' : ''}`} />
            <span>{sirenActive ? 'SIREN SOUNDING...' : 'TEST SIREN'}</span>
          </button>

          {/* Transmit Breach to HQ Button */}
          <button
            onClick={() => handleDispatchBreach()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-600/20 cursor-pointer"
            title="Transmit an emergency tripwire breach report directly to Delhi Central HQ"
          >
            <Send className="w-3.5 h-3.5" />
            <span>DISPATCH BREACH TO HQ</span>
          </button>

          {/* Draw Zone Action */}
          {isDrawing ? (
            <>
              <button
                onClick={handleCancelDrawing}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinishDrawing}
                disabled={drawnPoints.length < 3}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete ({drawnPoints.length} pts)
              </button>
            </>
          ) : (
            <button
              onClick={handleStartDrawing}
              disabled={!selectedCamera}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Draw Zone
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-3.5 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 text-cyan-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Commander 3-Step Workflow Helper Banner */}
      <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
            SOP GUIDE
          </span>
          <span className="text-slate-400">Tactical Virtual Perimeter Configuration Workflow:</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
          <span className="text-cyan-300 font-bold">1. Select Sentry Camera</span>
          <span className="text-slate-600">➔</span>
          <span className="text-amber-300 font-bold">2. Draw Zone or use ⚡ Quick Preset</span>
          <span className="text-slate-600">➔</span>
          <span className="text-emerald-300 font-bold">3. Set Threat Rules & Sentry Alarm</span>
        </div>
      </div>

      {/* Checkpost Sentinel Status Bar & Tactical Sensitivity Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111a2e] border border-rose-500/30 p-3.5 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-rose-400 font-bold uppercase">CHECKPOST PERIMETER</span>
            <div className="text-base font-mono font-black text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-rose-400" />
              {postName || userBop || 'BORDER SECTOR'}
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            isPerimeterArmed
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            {isPerimeterArmed ? 'FENCE ARMED' : 'STANDBY'}
          </span>
        </div>

        <div className="bg-[#111a2e] border border-sky-500/30 p-3.5 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-sky-400 font-bold uppercase">ACTIVE TRIPWIRES / ZONES</span>
            <div className="text-base font-mono font-black text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              {zones.filter((z) => z.enabled).length} Armed / {zones.length} Configured
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            GROUND-PLANE
          </span>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-3.5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase flex items-center gap-1">
              <Sliders className="w-3 h-3 text-amber-400" /> SENSITIVITY PRESET:
            </span>
            <div className="flex items-center gap-1">
              {(['HIGH', 'BALANCED', 'WEATHER'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSensitivity(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                    sensitivity === s
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {sensitivity === 'HIGH' ? 'STRICT' : sensitivity === 'WEATHER' ? 'FILTERED' : 'NOMINAL'}
          </span>
        </div>
      </div>


      {/* Camera Selector Tabs (Scoped to Checkpost) */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono text-slate-400 font-bold flex items-center justify-between px-1">
          <span>SELECT CHECKPOST SENTRY CAMERA TO CONFIGURE VIRTUAL TRIPWIRE:</span>
          <span className="text-slate-500">{effectiveCameras.length} cameras available</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          {effectiveCameras.map((cam) => (
            <button
              key={cam.camera_id}
              onClick={() => {
                if (isDrawing) setIsDrawing(false);
                setSelectedCamera(cam);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition shrink-0 cursor-pointer ${
                selectedCamera?.camera_id === cam.camera_id
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>{cam.camera_id}</span>
              <span className="text-slate-500 font-sans truncate max-w-[130px]">{cam.camera_name}</span>
            </button>
          ))}
        </div>
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
                  Active Tripwires & Zones ({zones.length})
                </h3>
                <button
                  onClick={() => selectedCamera && loadZones(selectedCamera.camera_id)}
                  className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
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
                    <p>No virtual tripwires configured for {selectedCamera.camera_id}.</p>
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
                          {/* 1-Click Report Breach on this Zone */}
                          <button
                            onClick={() => handleDispatchBreach(z)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                            title="Report breach on this zone to Delhi HQ"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleZone(z)}
                            className={`p-1.5 rounded transition cursor-pointer ${
                              z.enabled ? 'text-emerald-400 hover:bg-emerald-950/40' : 'text-slate-500 hover:bg-slate-800'
                            }`}
                            title={z.enabled ? 'Disable Zone' : 'Enable Zone'}
                          >
                            {z.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleEditZone(z)}
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition cursor-pointer"
                            title="Edit Zone"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(z.zone_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
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

      {/* SITREP Breach Dispatch Modal */}
      <DispatchSitrepModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={() => setDispatchModalOpen(false)}
        initialTitle={dispatchTitle}
        initialSummary={dispatchSummary}
        initialPriority={dispatchPriority}
      />
    </div>
  );
};
