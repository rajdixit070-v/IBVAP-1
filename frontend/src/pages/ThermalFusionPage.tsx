import React, { useState, useEffect } from 'react';
import {
  Flame,
  Sun,
  Moon,
  RefreshCw,
  Camera as CameraIcon,
  Plus,
  Trash2,
  Zap,
  Radio,
  Crosshair,
  Thermometer,
  ArrowLeft as BackIcon,
  Columns
} from 'lucide-react';
import { thermalService, CameraPair, ThermalFusionResult } from '../services/thermalService';
import { cameraService } from '../services/cameraService';
import { useCameras } from '../context/CameraContext';
import { CreatePairModal } from '../components/thermal/CreatePairModal';

interface ThermalFusionPageProps {
  onBackToDashboard?: () => void;
}

type ThermalPalette = 'IRONBOW' | 'WHITE_HOT' | 'BLACK_HOT' | 'NIGHT_VISION' | 'RAINBOW' | 'RGB';

const PALETTE_CONFIGS: Record<ThermalPalette, { label: string; filter: string; icon: string; description: string }> = {
  IRONBOW: {
    label: 'FLIR Ironbow',
    filter: 'hue-rotate(180deg) saturate(2.6) contrast(1.4)',
    icon: '🔥',
    description: 'Standard military FLIR thermal gradient'
  },
  WHITE_HOT: {
    label: 'White Hot',
    filter: 'grayscale(100%) contrast(1.5) brightness(1.1)',
    icon: '🤍',
    description: 'Hot thermal targets rendered as glowing white'
  },
  BLACK_HOT: {
    label: 'Black Hot',
    filter: 'grayscale(100%) invert(100%) contrast(1.5)',
    icon: '🖤',
    description: 'Hot targets rendered as dark black contours'
  },
  NIGHT_VISION: {
    label: 'Green Phosphor (NVG)',
    filter: 'sepia(100%) hue-rotate(90deg) saturate(3.5) brightness(0.9) contrast(1.2)',
    icon: '🟢',
    description: 'Gen-3 military night-vision phosphor intensifier'
  },
  RAINBOW: {
    label: 'Rainbow Spectrum',
    filter: 'hue-rotate(270deg) saturate(3) contrast(1.3)',
    icon: '🌈',
    description: 'High-contrast multi-spectrum thermal analysis'
  },
  RGB: {
    label: 'Standard Optical (RGB)',
    filter: 'none',
    icon: '👁️',
    description: 'Raw unfiltered optical daylight feed'
  }
};

export const ThermalFusionPage: React.FC<ThermalFusionPageProps> = ({ onBackToDashboard }) => {
  const { cameras, refreshCameras } = useCameras();
  const [pairs, setPairs] = useState<CameraPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<CameraPair | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [activePalette, setActivePalette] = useState<ThermalPalette>('IRONBOW');
  const [results, setResults] = useState<ThermalFusionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [fusionMode, setFusionMode] = useState<'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY'>('FUSED');
  const [lightingCondition, setLightingCondition] = useState<'NIGHT' | 'DAY'>('NIGHT');
  const [executing, setExecuting] = useState<boolean>(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [showPyrometerHud, setShowPyrometerHud] = useState<boolean>(true);
  const [viewLayout, setViewLayout] = useState<'SINGLE' | 'DUAL'>('SINGLE');

  // Spot Temperature Simulation
  const [spotTemp, setSpotTemp] = useState<number>(36.8);
  const maxTemp = 41.2;
  const minTemp = 17.4;

  // Stream Error fallbacks
  const [streamErrorRgb, setStreamErrorRgb] = useState(false);
  const [streamErrorThermal, setStreamErrorThermal] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pList, rList] = await Promise.all([
        thermalService.getCameraPairs(),
        thermalService.getFusionResults()
      ]);
      setPairs(pList);
      setResults(rList);
      if (pList.length > 0 && !selectedPair) {
        setSelectedPair(pList[0]);
        setFusionMode(pList[0].fusion_mode);
        setActiveCameraId(pList[0].rgb_camera_id || pList[0].thermal_camera_id);
      } else if (cameras.length > 0 && !activeCameraId) {
        setActiveCameraId(cameras[0].camera_id);
      }
    } catch (err) {
      console.error('Error fetching thermal fusion pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Ensure an active camera is selected if pairs or cameras exist
  useEffect(() => {
    if (!activeCameraId) {
      if (selectedPair) {
        setActiveCameraId(fusionMode === 'THERMAL_ONLY' ? selectedPair.thermal_camera_id : selectedPair.rgb_camera_id);
      } else if (cameras.length > 0) {
        setActiveCameraId(cameras[0].camera_id);
      }
    }
  }, [cameras, selectedPair, fusionMode, activeCameraId]);

  // Periodic simulated spot temperature drift
  useEffect(() => {
    const interval = setInterval(() => {
      setSpotTemp(Number((36.5 + Math.random() * 0.8).toFixed(1)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteFusion = async () => {
    try {
      setExecuting(true);
      const pairIdToUse = selectedPair?.pair_id || (pairs.length > 0 ? pairs[0].pair_id : 'PAIR-NORTH-01');
      const res = await thermalService.executeFusion({
        pair_id: pairIdToUse,
        lighting_condition: lightingCondition,
        rgb_detections: [
          { class: 'person', confidence: lightingCondition === 'NIGHT' ? 0.35 : 0.88, bbox: [0.25, 0.30, 0.15, 0.35] }
        ],
        thermal_detections: [
          { class: 'person', confidence: 0.96, bbox: [0.26, 0.31, 0.14, 0.34], temp_c: 37.4 },
          { class: 'concealed_weapon', confidence: 0.82, bbox: [0.32, 0.42, 0.05, 0.08], temp_c: 18.2 }
        ]
      });
      setResults(prev => [res, ...prev]);

      // Auto-sync pairs if an operational pair was provisioned
      if (!selectedPair) {
        const pList = await thermalService.getCameraPairs();
        setPairs(pList);
        if (pList.length > 0) {
          setSelectedPair(pList[0]);
          setActiveCameraId(pList[0].rgb_camera_id || pList[0].thermal_camera_id);
        }
      }
    } catch (err) {
      console.error('Failed to execute thermal fusion:', err);
    } finally {
      setExecuting(false);
    }
  };

  const handleDeleteSingleResult = async (resultId: string) => {
    try {
      await thermalService.deleteSingleResult(resultId);
      setResults(prev => prev.filter(r => r.result_id !== resultId));
    } catch (err) {
      console.error('Failed to delete fusion result:', err);
    }
  };

  const handleClearAllResults = async () => {
    if (!window.confirm('Are you sure you want to clear all thermal fusion scan logs?')) return;
    try {
      await thermalService.clearResults();
      setResults([]);
    } catch (err) {
      console.error('Failed to clear fusion results:', err);
    }
  };

  const handleModeChange = async (mode: 'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY') => {
    setFusionMode(mode);
    if (selectedPair) {
      try {
        const updated = await thermalService.updateCameraPair(selectedPair.pair_id, { fusion_mode: mode });
        setSelectedPair(updated);
      } catch (err) {
        console.error('Failed to update pair mode:', err);
      }
    }
  };

  const handleDeletePair = async (pairId: string) => {
    if (!window.confirm(`Are you sure you want to delete pair ${pairId}?`)) return;
    try {
      await thermalService.deletePair(pairId);
      setSelectedPair(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete pair:', err);
    }
  };

  const resolvedRgbId = selectedPair?.rgb_camera_id || activeCameraId || (cameras.length > 0 ? cameras[0].camera_id : '');
  const resolvedThermalId = selectedPair?.thermal_camera_id || (cameras.length > 1 ? cameras[1].camera_id : activeCameraId);
  const resolvedStreamCameraId = selectedPair
    ? (fusionMode === 'THERMAL_ONLY' ? selectedPair.thermal_camera_id : selectedPair.rgb_camera_id)
    : activeCameraId;

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
          <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30 shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Thermal & Night Vision Sensor Fusion HUD</h1>
            <p className="text-slate-400 text-sm">Long-Wave Infrared (LWIR) + RGB Homography Alignment, Real-Time Color Palettes & Spot Pyrometer</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg shadow-amber-900/30 text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Pair / Register Camera
          </button>
          <button
            onClick={() => setViewLayout(viewLayout === 'SINGLE' ? 'DUAL' : 'SINGLE')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
              viewLayout === 'DUAL'
                ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Toggle Split Dual Feed vs Fused Overlay"
          >
            <Columns className="w-3.5 h-3.5" />
            {viewLayout === 'DUAL' ? 'Dual Side-by-Side View' : 'Single Fused View'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExecuteFusion}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg shadow-orange-900/40 text-xs transition cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {executing ? 'Scanning Heatmap...' : 'Trigger Heat Scan'}
          </button>
        </div>
      </div>

      {/* Main Dual Feed + Calibration Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real Live Stream + Thermal Shaders + Pyrometer HUD */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            {/* Camera / Pair Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <CameraIcon className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-slate-300">ACTIVE PAIR / SENSOR:</span>
                </div>

                {pairs.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPair?.pair_id || ''}
                      onChange={e => {
                        const p = pairs.find(x => x.pair_id === e.target.value);
                        if (p) {
                          setSelectedPair(p);
                          setFusionMode(p.fusion_mode);
                          setActiveCameraId(p.rgb_camera_id);
                          setStreamErrorRgb(false);
                          setStreamErrorThermal(false);
                        }
                      }}
                      className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                    >
                      {pairs.map(p => (
                        <option key={p.pair_id} value={p.pair_id}>
                          Pair: {p.pair_id} (RGB: {p.rgb_camera_id} ↔ Thermal: {p.thermal_camera_id})
                        </option>
                      ))}
                    </select>
                    {selectedPair && (
                      <button
                        onClick={() => handleDeletePair(selectedPair.pair_id)}
                        title="Delete this pair"
                        className="p-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={activeCameraId}
                    onChange={e => {
                      setActiveCameraId(e.target.value);
                      setStreamErrorRgb(false);
                      setStreamErrorThermal(false);
                    }}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {cameras.length === 0 ? (
                      <option value="">No registered cameras available</option>
                    ) : (
                      cameras.map(c => (
                        <option key={c.camera_id} value={c.camera_id}>
                          {c.camera_name} ({c.camera_id} • {c.stream_type || 'RTSP'})
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Fusion Channel Mode & Lighting Matrix */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {(['FUSED', 'RGB_ONLY', 'THERMAL_ONLY'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                        fusionMode === m ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setLightingCondition('DAY')}
                    title="Daylight mode"
                    className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      lightingCondition === 'DAY' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" /> DAY
                  </button>
                  <button
                    onClick={() => setLightingCondition('NIGHT')}
                    title="Night / zero-light mode"
                    className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      lightingCondition === 'NIGHT' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" /> NIGHT
                  </button>
                </div>
              </div>
            </div>

            {/* Tactical Color Palettes Switcher */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Thermometer className="w-3.5 h-3.5" />
                  TACTICAL THERMAL PALETTE / NIGHT VISION SHADER:
                </span>
                <span className="text-slate-400">{PALETTE_CONFIGS[activePalette].description}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {(Object.keys(PALETTE_CONFIGS) as ThermalPalette[]).map(pal => {
                  const cfg = PALETTE_CONFIGS[pal];
                  const isActive = activePalette === pal;
                  return (
                    <button
                      key={pal}
                      type="button"
                      onClick={() => setActivePalette(pal)}
                      className={`p-2 rounded-lg border text-xs font-mono font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-lg shadow-amber-900/40 ring-1 ring-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-[11px] truncate w-full text-center">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Video Canvas: Either Split Dual-View or Single Fused View */}
            {viewLayout === 'DUAL' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Optical Channel View */}
                <div className="relative aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-lg">
                  {resolvedRgbId ? (
                    <img
                      src={streamErrorRgb ? cameraService.getSnapshotUrl(resolvedRgbId) : cameraService.getLiveStreamUrl(resolvedRgbId)}
                      alt="Optical RGB Feed"
                      onError={() => setStreamErrorRgb(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                  <div className="absolute top-2 left-2 bg-slate-950/85 px-2 py-1 rounded text-[10px] font-mono text-sky-400 border border-slate-700">
                    OPTICAL RGB: {resolvedRgbId || 'NO CAM'}
                  </div>
                </div>

                {/* Thermal Channel View with Palette */}
                <div className="relative aspect-video bg-black rounded-xl border border-amber-800/80 overflow-hidden flex items-center justify-center shadow-lg">
                  {resolvedThermalId ? (
                    <img
                      src={streamErrorThermal ? cameraService.getSnapshotUrl(resolvedThermalId) : cameraService.getLiveStreamUrl(resolvedThermalId)}
                      alt="Thermal LWIR Feed"
                      onError={() => setStreamErrorThermal(true)}
                      style={{ filter: PALETTE_CONFIGS[activePalette].filter }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                  <div className="absolute top-2 left-2 bg-slate-950/85 px-2 py-1 rounded text-[10px] font-mono text-amber-400 border border-slate-700">
                    THERMAL LWIR: {resolvedThermalId || 'NO CAM'}
                  </div>
                  {/* Center reticle */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-amber-400/70 rounded-full flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              /* Single Fused HUD Player */
              <div className="relative aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-2xl">
                {resolvedStreamCameraId ? (
                  <img
                    src={streamErrorRgb ? cameraService.getSnapshotUrl(resolvedStreamCameraId) : cameraService.getLiveStreamUrl(resolvedStreamCameraId)}
                    alt="Live Thermal Sensor Feed"
                    style={{
                      filter: PALETTE_CONFIGS[activePalette].filter,
                      transition: 'filter 0.3s ease-in-out'
                    }}
                    onError={() => setStreamErrorRgb(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                    <CameraIcon className="w-12 h-12 text-slate-600" />
                    <div className="text-sm font-bold text-slate-400">No Active Sensor Feed Selected</div>
                    <p className="text-xs text-slate-500">Register a camera or select one from the dropdown above to view live stream.</p>
                  </div>
                )}

                {/* Dynamic Scanning Line Animation */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-amber-500/10 to-transparent h-12 animate-pulse" />

                {/* FLIR Spot Pyrometer HUD & Crosshairs */}
                {showPyrometerHud && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Center Reticle Crosshairs */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <div className="relative w-16 h-16 border border-amber-400/80 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                        <div className="w-2 h-2 bg-amber-400 rounded-full" />
                        <div className="absolute w-6 h-[1px] bg-amber-400 -left-3" />
                        <div className="absolute w-6 h-[1px] bg-amber-400 -right-3" />
                        <div className="absolute h-6 w-[1px] bg-amber-400 -top-3" />
                        <div className="absolute h-6 w-[1px] bg-amber-400 -bottom-3" />
                      </div>

                      {/* Live Spot Temperature Readout */}
                      <div className="mt-2 px-2.5 py-1 bg-black/85 border border-amber-500/80 rounded font-mono text-[11px] font-bold text-amber-300 shadow-xl backdrop-blur-md">
                        🎯 SPOT: {spotTemp}°C <span className="text-[9px] text-emerald-400 ml-1">[HUMAN CORE]</span>
                      </div>
                    </div>

                    {/* Thermal Dynamic Range Scale Bar (Right Edge) */}
                    <div
                      className="absolute right-3 top-12 bottom-12 w-4 rounded-full border border-slate-700 flex flex-col justify-between items-center py-1 text-[9px] font-mono font-bold shadow-lg"
                      style={{
                        background: 'linear-gradient(to bottom, #ffffff, #ef4444, #f59e0b, #06b6d4, #1e1b4b)'
                      }}
                    >
                      <span className="text-black bg-white/90 px-0.5 rounded -mr-9">45°C</span>
                      <span className="text-white bg-black/80 px-0.5 rounded -mr-9">{spotTemp}°C</span>
                      <span className="text-white bg-black/80 px-0.5 rounded -mr-9">15°C</span>
                    </div>
                  </div>
                )}

                {/* Top Left Status HUD */}
                <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 space-y-0.5 shadow-xl">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="text-amber-400">{resolvedStreamCameraId || 'CAMERA'}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-cyan-400">{PALETTE_CONFIGS[activePalette].label}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    SPECTRUM: <span className="text-white">LWIR 8-14μm</span> • FPS: <span className="text-emerald-400">25</span> • HOMOGRAPHY: <span className="text-emerald-400">ALIGNED</span>
                  </div>
                </div>

                {/* Bottom Left Temperature Min/Max Bar */}
                <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-3 shadow-xl">
                  <div>MAX: <strong className="text-red-400">{maxTemp}°C</strong></div>
                  <div className="text-slate-600">|</div>
                  <div>MIN: <strong className="text-sky-400">{minTemp}°C</strong></div>
                  <div className="text-slate-600">|</div>
                  <div>MODE: <strong className="text-amber-400">{fusionMode}</strong></div>
                </div>

                {/* Bottom Right Controls */}
                <div className="absolute bottom-3 right-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPyrometerHud(!showPyrometerHud)}
                    className="px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-amber-400 transition cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3 inline mr-1" />
                    {showPyrometerHud ? 'Hide Pyrometer' : 'Show Pyrometer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: AI Heat Scan Logs */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                AI Heat Scans & Anomaly Logs ({results.length})
              </h2>
              {results.length > 0 && (
                <button
                  onClick={handleClearAllResults}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 rounded text-xs font-mono font-semibold transition cursor-pointer"
                  title="Clear all thermal heat scan logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {results.length === 0 ? (
                <div className="p-6 bg-slate-950 border border-slate-800/80 rounded-lg text-center text-xs text-slate-500">
                  No heat scan results logged. Click "Trigger Heat Scan" above to perform live fusion inference.
                </div>
              ) : (
                results.map((r) => (
                  <div key={r.result_id} className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-xs space-y-1.5 font-mono group transition">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">{r.result_id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</span>
                        <button
                          onClick={() => handleDeleteSingleResult(r.result_id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/60 rounded border border-transparent hover:border-red-900/60 transition cursor-pointer"
                          title="Delete this scan log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>Fused Conf: <strong className="text-emerald-400">{Math.round(r.fused_confidence * 100)}%</strong></span>
                      <span>Lighting: <strong className="text-cyan-400">{r.lighting_condition}</strong></span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Pair: {r.pair_id} • Mode: {r.fusion_mode_applied}</span>
                      {r.has_heat_anomaly && (
                        <span className="text-amber-400 font-bold">🔥 HEAT ANOMALY</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Pair Modal */}
      <CreatePairModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onSuccess={() => {
          fetchData();
          refreshCameras();
        }}
      />
    </div>
  );
};
