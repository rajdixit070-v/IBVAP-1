import React, { useState, useEffect } from 'react';
import {
  Crosshair,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Square,
  Bookmark,
  Compass,
  Search,
  RefreshCw,
  Play
} from 'lucide-react';
import { ptzService, PTZDevice, PTZPreset, ONVIFDevice } from '../services/ptzService';
import { useCameras } from '../context/CameraContext';

export const PTZControlPage: React.FC = () => {
  const { cameras } = useCameras();
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const [deviceStatus, setDeviceStatus] = useState<PTZDevice | null>(null);
  const [presets, setPresets] = useState<PTZPreset[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<ONVIFDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [autoTrack, setAutoTrack] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    if (cameras.length > 0 && (!selectedCameraId || !cameras.some(c => c.camera_id === selectedCameraId))) {
      setSelectedCameraId(cameras[0].camera_id);
    }
  }, [cameras, selectedCameraId]);

  const fetchStatusAndPresets = async () => {
    if (!selectedCameraId) {
      setDeviceStatus(null);
      setPresets([]);
      return;
    }
    try {
      setLoading(true);
      const [status, pList] = await Promise.all([
        ptzService.getPTZStatus(selectedCameraId),
        ptzService.getPresets(selectedCameraId)
      ]);
      setDeviceStatus(status);
      setPresets(pList);
      setAutoTrack(status.auto_track_enabled);
    } catch (err) {
      console.error('Error fetching PTZ status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCameraId) {
      fetchStatusAndPresets();
    }
  }, [selectedCameraId]);


  const handleMove = async (pan: number, tilt: number, zoom = 0) => {
    try {
      await ptzService.movePTZ(selectedCameraId, {
        move_type: 'CONTINUOUS',
        pan_speed: pan,
        tilt_speed: tilt,
        zoom_speed: zoom,
        timeout_sec: 1.5
      });
      fetchStatusAndPresets();
    } catch (err) {
      console.error('PTZ Move failed:', err);
    }
  };

  const handleStop = async () => {
    try {
      await ptzService.stopPTZ(selectedCameraId);
      fetchStatusAndPresets();
    } catch (err) {
      console.error('PTZ Stop failed:', err);
    }
  };

  const handleToggleAutoTrack = async () => {
    const nextState = !autoTrack;
    setAutoTrack(nextState);
    try {
      await ptzService.setAutoTrack(selectedCameraId, {
        enable: nextState,
        target_id: nextState ? 'TRACK-PERSON-01' : undefined,
        bbox: nextState ? [0.35, 0.40, 0.12, 0.28] : undefined
      });
      fetchStatusAndPresets();
    } catch (err) {
      console.error('Failed to toggle auto-track:', err);
    }
  };

  const handleCreatePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      await ptzService.createPreset(selectedCameraId, { preset_name: newPresetName });
      setNewPresetName('');
      fetchStatusAndPresets();
    } catch (err) {
      console.error('Failed to create preset:', err);
    }
  };

  const handleGotoPreset = async (token: string) => {
    try {
      await ptzService.gotoPreset(selectedCameraId, token);
      fetchStatusAndPresets();
    } catch (err) {
      console.error('Goto preset failed:', err);
    }
  };

  const handleDiscover = async () => {
    try {
      setDiscovering(true);
      const devs = await ptzService.discoverDevices();
      setDiscoveredDevices(devs);
    } catch (err) {
      console.error('ONVIF discovery error:', err);
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Crosshair className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">PTZ Auto-Tracking & ONVIF Controller</h1>
            <p className="text-slate-400 text-sm">Real-time Pan/Tilt/Zoom velocity steering, ByteTrack target lock & guard tour presets</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatusAndPresets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition"
          >
            <Search className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Probing Network...' : 'ONVIF WS-Discovery'}
          </button>
          <button
            onClick={handleToggleAutoTrack}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg shadow-lg text-sm transition ${
              autoTrack
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            {autoTrack ? 'Disengage Auto-Track Lock' : 'Engage ByteTrack Auto-Lock'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Video HUD & Virtual Joystick */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-400" />
                Active Pan/Tilt Optical Canvas
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Select Camera:</span>
                <select
                  value={selectedCameraId}
                  onChange={e => setSelectedCameraId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  {cameras.length === 0 ? (
                    <option value="">No cameras registered</option>
                  ) : (
                    cameras.map(c => (
                      <option key={c.camera_id} value={c.camera_id}>
                        {c.camera_id} — {c.camera_name} ({c.bop_site || 'BOP Site'})
                      </option>
                    ))
                  )}
                </select>

              </div>
            </div>

            {/* Virtual HUD Canvas */}
            <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/30 opacity-90" />
              
              {/* Reticle / Crosshair */}
              <div className="relative z-10 w-24 h-24 border border-blue-500/40 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                <div className="absolute w-full h-0.5 bg-blue-500/30" />
                <div className="absolute h-full w-0.5 bg-blue-500/30" />
              </div>

              {/* Status Telemetry */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 space-y-0.5">
                <div>PAN: <span className="text-blue-400 font-bold">{deviceStatus?.current_pan || 0.0}°</span></div>
                <div>TILT: <span className="text-blue-400 font-bold">{deviceStatus?.current_tilt || 0.0}°</span></div>
                <div>ZOOM: <span className="text-emerald-400 font-bold">{deviceStatus?.current_zoom || 1.0}x</span></div>
              </div>

              <div className="absolute top-3 right-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border backdrop-blur ${
                  autoTrack
                    ? 'bg-red-950/80 text-red-300 border-red-700 animate-pulse'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700'
                }`}>
                  {autoTrack ? 'AUTOTRACK: LOCKED' : 'MANUAL CONTROL'}
                </span>
              </div>
            </div>

            {/* Virtual Joystick Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="col-span-2 flex items-center justify-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="grid grid-cols-3 gap-2 w-36">
                  <div />
                  <button
                    onClick={() => handleMove(0, 0.4)}
                    className="p-3 bg-slate-800 hover:bg-blue-600 rounded-lg text-white flex items-center justify-center transition"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <div />
                  <button
                    onClick={() => handleMove(-0.4, 0)}
                    className="p-3 bg-slate-800 hover:bg-blue-600 rounded-lg text-white flex items-center justify-center transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleStop}
                    className="p-3 bg-red-900/80 hover:bg-red-700 rounded-lg text-white flex items-center justify-center transition"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(0.4, 0)}
                    className="p-3 bg-slate-800 hover:bg-blue-600 rounded-lg text-white flex items-center justify-center transition"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div />
                  <button
                    onClick={() => handleMove(0, -0.4)}
                    className="p-3 bg-slate-800 hover:bg-blue-600 rounded-lg text-white flex items-center justify-center transition"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <div />
                </div>
              </div>

              <div className="flex flex-col justify-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">Optical Zoom</span>
                <button
                  onClick={() => handleMove(0, 0, 0.4)}
                  className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition"
                >
                  <ZoomIn className="w-4 h-4" /> Zoom In (+)
                </button>
                <button
                  onClick={() => handleMove(0, 0, -0.4)}
                  className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition"
                >
                  <ZoomOut className="w-4 h-4" /> Zoom Out (-)
                </button>
              </div>

              <div className="flex flex-col justify-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Profile:</span>
                  <span className="font-mono text-white">{deviceStatus?.onvif_profile_token || 'Profile_1'}</span>
                </div>
                <div className="flex justify-between">
                  <span>WS-Port:</span>
                  <span className="font-mono text-white">{deviceStatus?.onvif_port || 80}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exclusive Lock:</span>
                  <span className="text-emerald-400 font-semibold">{deviceStatus?.is_locked ? 'Locked' : 'Available'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Presets & Guard Tour */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-400" />
              Presets & Patrol Tour
            </h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New preset name..."
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <button
                onClick={handleCreatePreset}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs transition"
              >
                Save
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {presets.map(p => (
                <div
                  key={p.preset_id}
                  className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{p.preset_name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      P: {p.pan}° | T: {p.tilt}° | Z: {p.zoom}x
                    </div>
                  </div>
                  <button
                    onClick={() => handleGotoPreset(p.preset_token)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-white rounded font-medium text-xs transition"
                  >
                    <Play className="w-3 h-3" /> Drive
                  </button>
                </div>
              ))}
            </div>

            {discoveredDevices.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300 mb-2">Discovered ONVIF Devices ({discoveredDevices.length})</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {discoveredDevices.map((d, i) => (
                    <div key={i} className="p-2 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-300 flex justify-between">
                      <span className="font-mono text-cyan-400">{d.device_ip || d.camera_id}</span>
                      <span className="text-slate-400">{d.manufacturer} {d.model}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

