import React, { useState, useEffect, useRef } from 'react';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Compass,
  Search,
  RefreshCw,
  Play,
  ArrowLeft as BackIcon,
  RotateCcw,
  Eye
} from 'lucide-react';
import { ptzService, PTZDevice, PTZPreset, ONVIFDevice } from '../services/ptzService';
import { cameraService } from '../services/cameraService';
import { useCameras } from '../context/CameraContext';

interface PTZControlPageProps {
  onBackToDashboard?: () => void;
}

export const PTZControlPage: React.FC<PTZControlPageProps> = ({ onBackToDashboard }) => {
  const { cameras } = useCameras();
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const [deviceStatus, setDeviceStatus] = useState<PTZDevice | null>(null);
  const [presets, setPresets] = useState<PTZPreset[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<ONVIFDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [autoTrack, setAutoTrack] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Visual Pan/Tilt/Zoom Simulation Canvas State
  const [visualZoom, setVisualZoom] = useState<number>(1.0);
  const [visualPan, setVisualPan] = useState<number>(0);
  const [visualTilt, setVisualTilt] = useState<number>(0);

  // Virtual Joystick Draggable Knob State
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      if (status.current_zoom && visualZoom === 1.0) {
        setVisualZoom(status.current_zoom);
      }
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

  // Optical Zoom Handlers
  const applyZoom = async (newZoom: number) => {
    const clamped = Math.round(Math.max(1.0, Math.min(30.0, newZoom)) * 10) / 10;
    setVisualZoom(clamped);

    // Call backend absolute zoom
    try {
      await ptzService.movePTZ(selectedCameraId, {
        move_type: 'ABSOLUTE',
        pan_speed: (visualPan / 100) * 45,
        tilt_speed: -(visualTilt / 100) * 30,
        zoom_speed: clamped
      });
      if (deviceStatus) {
        setDeviceStatus({ ...deviceStatus, current_zoom: clamped });
      }
    } catch (err) {
      console.error('PTZ Zoom command failed:', err);
    }
  };

  const handleStepZoom = (delta: number) => {
    applyZoom(visualZoom + delta);
  };

  const handleStartContinuousZoom = (delta: number) => {
    handleStepZoom(delta);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = setInterval(() => {
      setVisualZoom(prev => {
        const next = Math.round(Math.max(1.0, Math.min(30.0, prev + delta)) * 10) / 10;
        applyZoom(next);
        return next;
      });
    }, 250);
  };

  const handleStopContinuousZoom = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  // Pan/Tilt Move
  const handleMove = async (pan: number, tilt: number, zoom = 0) => {
    // Update visual offsets with boundaries
    setVisualPan(prev => Math.max(-180, Math.min(180, prev + pan * 25)));
    setVisualTilt(prev => Math.max(-120, Math.min(120, prev - tilt * 20)));

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

  const handleResetFraming = () => {
    setVisualZoom(1.0);
    setVisualPan(0);
    setVisualTilt(0);
    applyZoom(1.0);
  };

  // Interactive 2D Virtual Joystick Drag Logic
  const handleJoystickMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingJoystick(true);
    handleJoystickUpdate(e.clientX, e.clientY);
  };

  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    setIsDraggingJoystick(true);
    if (e.touches.length > 0) {
      handleJoystickUpdate(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleJoystickUpdate = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2 - 18;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: dx, y: dy });

    // Normalized velocity (-1.0 to 1.0)
    const normX = Number((dx / maxRadius).toFixed(2));
    const normY = Number((-dy / maxRadius).toFixed(2));

    handleMove(normX * 0.7, normY * 0.7, 0);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingJoystick) {
        handleJoystickUpdate(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDraggingJoystick && e.touches.length > 0) {
        handleJoystickUpdate(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalEnd = () => {
      if (isDraggingJoystick) {
        setIsDraggingJoystick(false);
        setJoystickPos({ x: 0, y: 0 });
        handleStop();
      }
      handleStopContinuousZoom();
    };

    if (isDraggingJoystick) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      window.addEventListener('touchend', handleGlobalEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingJoystick]);

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

  const ZOOM_PRESETS = [
    { label: '1x Wide', value: 1.0 },
    { label: '2x Gate', value: 2.0 },
    { label: '5x Wire', value: 5.0 },
    { label: '10x Patrol', value: 10.0 },
    { label: '20x Recon', value: 20.0 },
    { label: '30x Max', value: 30.0 }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Return to Home Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-mono font-bold border border-slate-700 transition cursor-pointer shrink-0"
              title="Return to Home Dashboard"
            >
              <BackIcon className="w-4 h-4" />
              <span>← Return to Home Dashboard</span>
            </button>
          )}
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 shrink-0">
            <Crosshair className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">PTZ Virtual Joystick & Optical Zoom Controller</h1>
            <p className="text-slate-400 text-sm">Real-time Pan/Tilt/Zoom velocity steering, ByteTrack target lock & guard tour presets</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={fetchStatusAndPresets}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <Search className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Probing Network...' : 'ONVIF Discovery'}
          </button>
          <button
            onClick={handleToggleAutoTrack}
            className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg shadow-lg text-xs transition cursor-pointer ${
              autoTrack
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            {autoTrack ? 'Disengage Auto-Track' : 'Engage ByteTrack Lock'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Video HUD & Virtual Joystick Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-400" />
                Active Pan/Tilt/Zoom Optical Canvas
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">Camera:</span>
                <select
                  value={selectedCameraId}
                  onChange={e => setSelectedCameraId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
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
                <button
                  onClick={handleResetFraming}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition cursor-pointer"
                  title="Reset to default wide framing"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Framing
                </button>
              </div>
            </div>

            {/* Virtual HUD Canvas with Smooth Hardware-Accelerated CSS Scaling & Mouse Wheel Zoom */}
            <div
              onWheel={(e) => {
                e.preventDefault();
                handleStepZoom(e.deltaY < 0 ? 0.5 : -0.5);
              }}
              className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group select-none shadow-2xl cursor-crosshair"
              title="Scroll mouse wheel over canvas to Zoom In / Zoom Out"
            >
              {selectedCameraId ? (
                <img
                  src={cameraService.getLiveStreamUrl(selectedCameraId)}
                  alt="Live PTZ Stream"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.src = cameraService.getSnapshotUrl(selectedCameraId);
                  }}
                  style={{
                    transform: `scale(${visualZoom}) translate(${visualPan}px, ${visualTilt}px)`,
                    transformOrigin: 'center center',
                    transition: isDraggingJoystick ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Eye className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-xs">Select a camera above to engage PTZ optical stream</p>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-transparent to-blue-950/30 pointer-events-none" />

              {/* Reticle / Crosshair */}
              <div className="relative z-10 w-28 h-28 border-2 border-dashed border-sky-400/60 rounded-full flex items-center justify-center pointer-events-none shadow-lg">
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-ping" />
                <div className="absolute w-full h-0.5 bg-sky-400/40" />
                <div className="absolute h-full w-0.5 bg-sky-400/40" />
              </div>

              {/* Status Telemetry HUD */}
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 space-y-0.5 shadow-xl">
                <div>PAN: <span className="text-blue-400 font-bold">{Math.round(deviceStatus?.current_pan || visualPan / 2)}°</span></div>
                <div>TILT: <span className="text-blue-400 font-bold">{Math.round(deviceStatus?.current_tilt || -visualTilt / 2)}°</span></div>
                <div>ZOOM: <span className="text-emerald-400 font-black text-sm">{visualZoom.toFixed(1)}x</span></div>
              </div>

              {/* Mode & Wheel Indicator */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-slate-900/90 border border-slate-700 rounded text-[10px] font-mono text-cyan-300 backdrop-blur-md">
                  🖱️ WHEEL ZOOM ACTIVE
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border backdrop-blur-md shadow-lg ${
                  autoTrack
                    ? 'bg-red-950/90 text-red-300 border-red-700 animate-pulse'
                    : 'bg-slate-900/85 text-slate-300 border-slate-700'
                }`}>
                  {autoTrack ? 'AUTOTRACK: ENGAGED' : 'MANUAL JOYSTICK'}
                </span>
              </div>
            </div>

            {/* Dual Controls Section: 2D Draggable Virtual Joystick + Optical Zoom Console */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
              {/* Virtual 2D Joystick Pad (5 cols) */}
              <div className="md:col-span-5 p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-between shadow-inner">
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>2D Touch / Drag Joystick</span>
                </div>

                <div
                  ref={joystickBaseRef}
                  onMouseDown={handleJoystickMouseDown}
                  onTouchStart={handleJoystickTouchStart}
                  className="relative w-36 h-36 rounded-full bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700/80 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-2xl overflow-visible"
                >
                  {/* Cardinal Axis Markers */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-[1px] bg-slate-800" />
                    <div className="h-full w-[1px] bg-slate-800 absolute" />
                  </div>
                  <span className="absolute top-1 text-[9px] font-mono font-bold text-slate-500">N</span>
                  <span className="absolute bottom-1 text-[9px] font-mono font-bold text-slate-500">S</span>
                  <span className="absolute left-1.5 text-[9px] font-mono font-bold text-slate-500">W</span>
                  <span className="absolute right-1.5 text-[9px] font-mono font-bold text-slate-500">E</span>

                  {/* Draggable Knob */}
                  <div
                    style={{
                      transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                      transition: isDraggingJoystick ? 'none' : 'transform 0.2s ease-out'
                    }}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-sky-300 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.6)] z-20"
                  >
                    <Crosshair className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 text-center mt-2">
                  Drag center knob to steer Pan/Tilt. Release to stop.
                </div>
              </div>

              {/* Optical Zoom Console (7 cols) */}
              <div className="md:col-span-7 p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ZoomIn className="w-4 h-4" />
                    Optical Lens Zoom Level
                  </span>
                  <span className="text-base font-mono font-black text-white bg-slate-900 px-3 py-0.5 rounded border border-slate-700">
                    {visualZoom.toFixed(1)}x
                  </span>
                </div>

                {/* Direct Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>1.0x (Wide Angle)</span>
                    <span>15.0x</span>
                    <span>30.0x (Telephoto)</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={30.0}
                    step={0.5}
                    value={visualZoom}
                    onChange={(e) => applyZoom(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                  />
                </div>

                {/* Quick Presets Buttons */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Quick Zoom Presets:</span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {ZOOM_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => applyZoom(p.value)}
                        className={`py-1 rounded text-[11px] font-mono font-bold border transition cursor-pointer ${
                          Math.abs(visualZoom - p.value) < 0.3
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continuous Hold In/Out Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onMouseDown={() => handleStartContinuousZoom(1.0)}
                    onMouseUp={handleStopContinuousZoom}
                    onMouseLeave={handleStopContinuousZoom}
                    onClick={() => handleStepZoom(1.0)}
                    className="flex items-center justify-center gap-2 py-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 rounded-lg text-white text-xs font-bold font-mono transition shadow cursor-pointer select-none"
                  >
                    <ZoomIn className="w-4 h-4" /> Zoom In (+1x)
                  </button>
                  <button
                    onMouseDown={() => handleStartContinuousZoom(-1.0)}
                    onMouseUp={handleStopContinuousZoom}
                    onMouseLeave={handleStopContinuousZoom}
                    onClick={() => handleStepZoom(-1.0)}
                    className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-lg text-white text-xs font-bold font-mono transition shadow cursor-pointer select-none"
                  >
                    <ZoomOut className="w-4 h-4" /> Zoom Out (-1x)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Presets & Guard Tour */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-400" />
              Presets & Patrol Tour
            </h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New preset name..."
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={handleCreatePreset}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Save
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {presets.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg text-center text-xs text-slate-500">
                  No guard presets saved for this camera.
                </div>
              ) : (
                presets.map(p => (
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-white rounded font-medium text-xs transition cursor-pointer"
                    >
                      <Play className="w-3 h-3" /> Drive
                    </button>
                  </div>
                ))
              )}
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
