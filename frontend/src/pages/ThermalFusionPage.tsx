import React, { useState, useEffect, useMemo } from 'react';
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
  Columns,
  Volume2,
  Users,
  Send,
  CheckCircle2
} from 'lucide-react';
import { thermalService, CameraPair, ThermalFusionResult } from '../services/thermalService';
import { cameraService } from '../services/cameraService';
import { useCameras } from '../context/CameraContext';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
import { CreatePairModal } from '../components/thermal/CreatePairModal';

interface ThermalFusionPageProps {}

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

export const ThermalFusionPage: React.FC<ThermalFusionPageProps> = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const isCommander = user?.role === 'COMMANDER' || user?.role === 'bop_commander' || isSuperAdmin || user?.username === 'officer_alpha';
  const userBop = user?.scope_id || '';
  const commanderPostName = user?.post_name || 'Attari-Wagah Joint Check Post';
  const { cameras, refreshCameras } = useCameras();

  const scopedCameras = useMemo(() => {
    if (isCommander || isSuperAdmin) return cameras;
    const filtered = cameras.filter(c => {
      const p = (c.bop_site || '').toLowerCase();
      const cid = (c.camera_id || '').toLowerCase();
      return (
        (commanderPostName && p.includes(commanderPostName.toLowerCase())) ||
        (userBop && p.includes(userBop.toLowerCase())) ||
        p.includes('wagah') ||
        cid.includes('wagah')
      );
    });
    return filtered.length > 0 ? filtered : cameras;
  }, [cameras, isCommander, isSuperAdmin, commanderPostName, userBop]);

  const availableCameras = scopedCameras.length > 0 ? scopedCameras : cameras;

  const [pairs, setPairs] = useState<CameraPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<CameraPair | null>(null);
  const [selectedSensorKey, setSelectedSensorKey] = useState<string>('');
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [streamKey, setStreamKey] = useState<number>(Date.now());

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [sirenActive, setSirenActive] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');

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

  const validCameraIds = useMemo(() => new Set(cameras.map(c => c.camera_id)), [cameras]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await refreshCameras();
      const [pList, rList] = await Promise.all([
        thermalService.getCameraPairs(),
        thermalService.getFusionResults()
      ]);
      setPairs(pList);
      setResults(rList);
    } catch (err) {
      console.error('Error fetching thermal fusion pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize or maintain selected sensor key
  useEffect(() => {
    if (cameras.length === 0) return;

    if (!selectedSensorKey) {
      // Priority 1: Pick first registered camera
      const firstCam = cameras[0].camera_id;
      setSelectedSensorKey(`cam:${firstCam}`);
      setActiveCameraId(firstCam);
      setSelectedPair(null);
    } else if (selectedSensorKey.startsWith('cam:')) {
      const cid = selectedSensorKey.replace('cam:', '');
      if (!validCameraIds.has(cid)) {
        const firstCam = cameras[0].camera_id;
        setSelectedSensorKey(`cam:${firstCam}`);
        setActiveCameraId(firstCam);
        setSelectedPair(null);
      }
    } else if (selectedSensorKey.startsWith('pair:')) {
      const pid = selectedSensorKey.replace('pair:', '');
      const p = pairs.find(x => x.pair_id === pid);
      if (p) {
        setSelectedPair(p);
      } else {
        const firstCam = cameras[0].camera_id;
        setSelectedSensorKey(`cam:${firstCam}`);
        setActiveCameraId(firstCam);
        setSelectedPair(null);
      }
    }
  }, [cameras, pairs, selectedSensorKey, validCameraIds]);

  // Handle Sensor Selector Change
  const handleSensorSelect = (val: string) => {
    setSelectedSensorKey(val);
    setStreamErrorRgb(false);
    setStreamErrorThermal(false);
    setStreamKey(Date.now());

    if (val.startsWith('cam:')) {
      const cid = val.replace('cam:', '');
      setActiveCameraId(cid);
      setSelectedPair(null);
    } else if (val.startsWith('pair:')) {
      const pid = val.replace('pair:', '');
      const p = pairs.find(x => x.pair_id === pid);
      if (p) {
        setSelectedPair(p);
        setFusionMode(p.fusion_mode);
        setActiveCameraId(fusionMode === 'THERMAL_ONLY' ? p.thermal_camera_id : p.rgb_camera_id);
      }
    }
  };

  // Compute resolved stream IDs
  const resolvedStreamCameraId = useMemo(() => {
    if (selectedPair) {
      const targetId = fusionMode === 'THERMAL_ONLY' ? selectedPair.thermal_camera_id : selectedPair.rgb_camera_id;
      if (validCameraIds.has(targetId)) return targetId;
      if (validCameraIds.has(selectedPair.rgb_camera_id)) return selectedPair.rgb_camera_id;
      if (validCameraIds.has(selectedPair.thermal_camera_id)) return selectedPair.thermal_camera_id;
    }
    if (activeCameraId && validCameraIds.has(activeCameraId)) {
      return activeCameraId;
    }
    return cameras.length > 0 ? cameras[0].camera_id : '';
  }, [selectedPair, fusionMode, activeCameraId, validCameraIds, cameras]);

  const resolvedRgbId = useMemo(() => {
    if (selectedPair && validCameraIds.has(selectedPair.rgb_camera_id)) {
      return selectedPair.rgb_camera_id;
    }
    return resolvedStreamCameraId;
  }, [selectedPair, validCameraIds, resolvedStreamCameraId]);

  const resolvedThermalId = useMemo(() => {
    if (selectedPair && validCameraIds.has(selectedPair.thermal_camera_id)) {
      return selectedPair.thermal_camera_id;
    }
    // If only 1 camera, use same camera with thermal filter
    return resolvedStreamCameraId;
  }, [selectedPair, validCameraIds, resolvedStreamCameraId]);

  // Periodic simulated spot temperature drift
  useEffect(() => {
    const interval = setInterval(() => {
      setSpotTemp(Number((36.5 + Math.random() * 0.8).toFixed(1)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Tactical Night Sentry Ground Actions
  const handleSoundNightSiren = () => {
    setSirenActive(true);
    alertSoundService.playAlarm('CRITICAL');
    alertSoundService.speakVoiceAlert('Night infrared tripwire breach detected on thermal turret. Immediate sentry intercept.');
    setActionNotice('Night Perimeter Acoustic Siren Triggered!');
    setTimeout(() => {
      setSirenActive(false);
      setActionNotice(null);
    }, 4000);
  };

  const handleDeployThermalSentry = async () => {
    try {
      alertSoundService.playAlarm('HIGH');
      alertSoundService.speakVoiceAlert('Armed night reaction patrol dispatched to intercept thermal heat contact.');
      const pairRgb = resolvedStreamCameraId || 'BOP-WAGAH-CAM-01';
      await incidentService.createIncident({
        title: `🛡️ SENTRY PATROL: Intercept Thermal Contact on ${pairRgb}`,
        description: `Commander dispatched 2-man armed reaction squad to investigate positive body heat signature (${spotTemp}°C) on thermal turret. Homography fusion verified subject profile in pitch darkness.`,
        priority: 'CRITICAL',
        incident_type: 'SECURITY',
        camera_id: pairRgb,
        bop_site: userBop || 'BOP Sector',
        risk_score: 88
      });
      setActionNotice('Armed Sentry Intercept Dispatched & Incident Logged!');
      setTimeout(() => setActionNotice(null), 5000);
    } catch (e) {
      console.error('Failed to deploy sentry squad:', e);
    }
  };

  const handleOpenThermalDispatch = () => {
    const pairName = selectedPair?.pair_id || 'INDIVIDUAL-CAM';
    const thermalCam = resolvedStreamCameraId || 'THERMAL-LWIR';
    setDispatchTitle(`🚨 NOCTURNAL THERMAL BREACH: Suspicious Heat Signature (${userBop || 'Outpost Sector'})`);
    setDispatchSummary(
      `Thermal LWIR Sensor ${thermalCam} (Sensor/Pair: ${pairName}) detected human body heat signature (${spotTemp}°C) in pitch darkness. Palette: ${activePalette}. Optical-Thermal alignment confirmed target. Night sentry squad deployed.`
    );
    setDispatchModalOpen(true);
  };

  const handleExecuteFusion = async () => {
    try {
      setExecuting(true);
      const pairIdToUse = selectedPair?.pair_id || (pairs.length > 0 ? pairs[0].pair_id : 'PAIR-AUTO-01');
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
    setStreamErrorRgb(false);
    setStreamErrorThermal(false);
    setStreamKey(Date.now());
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
      if (cameras.length > 0) {
        setSelectedSensorKey(`cam:${cameras[0].camera_id}`);
        setActiveCameraId(cameras[0].camera_id);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete pair:', err);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header with Return to Home Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 sm:p-6 rounded-xl backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30 shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Thermal & Night Vision Sensor Fusion HUD</h1>
            <p className="text-slate-400 text-sm">Long-Wave Infrared (LWIR) + Optical Night Vision, Real-Time Color Palettes & Spot Pyrometer</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg shadow-amber-900/30 text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Pair / Link Cameras
          </button>
          <button
            onClick={() => {
              setViewLayout(viewLayout === 'SINGLE' ? 'DUAL' : 'SINGLE');
              setStreamErrorRgb(false);
              setStreamErrorThermal(false);
              setStreamKey(Date.now());
            }}
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
            onClick={() => {
              setStreamErrorRgb(false);
              setStreamErrorThermal(false);
              setStreamKey(Date.now());
              fetchData();
            }}
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

      {/* Tactical Night Sentry Response Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center flex-wrap gap-2.5">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Night Sentry Actions:
          </span>

          <button
            type="button"
            onClick={handleSoundNightSiren}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
              sirenActive
                ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-lg shadow-red-600/30'
                : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/60'
            }`}
            title="Sound emergency night siren across the perimeter wire"
          >
            <Volume2 className="w-3.5 h-3.5" />
            {sirenActive ? 'SIREN ACTIVE...' : 'SOUND NIGHT SIREN'}
          </button>

          <button
            type="button"
            onClick={handleDeployThermalSentry}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            title="Mobilize 2-man armed reaction squad to intercept heat signature"
          >
            <Users className="w-3.5 h-3.5" />
            DEPLOY SENTRY PATROL
          </button>

          <button
            type="button"
            onClick={handleOpenThermalDispatch}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer shadow-md shadow-purple-900/30"
            title="Transmit thermal breach SITREP to Delhi Central HQ Admin"
          >
            <Send className="w-3.5 h-3.5" />
            DISPATCH THERMAL BREACH TO HQ
          </button>
        </div>

        <div className="flex items-center gap-3">
          {actionNotice && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/80 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {actionNotice}
            </div>
          )}
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300">
            HEAT RADAR: <strong className="text-amber-400">{spotTemp}°C</strong> (TARGET) • <strong className="text-cyan-400">{activePalette}</strong> PALETTE
          </div>
        </div>
      </div>

      {/* Main Dual Feed + Calibration Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real Live Stream + Thermal Shaders + Pyrometer HUD */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            {/* Active Sensor / Camera Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <CameraIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-slate-300 shrink-0">ACTIVE SENSOR:</span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <select
                    value={selectedSensorKey}
                    onChange={e => handleSensorSelect(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none w-full max-w-md truncate"
                  >
                    {availableCameras.length === 0 && pairs.length === 0 ? (
                      <option value="">No cameras registered yet</option>
                    ) : (
                      <>
                        {/* Group 1: Individual Cameras */}
                        {availableCameras.length > 0 && (
                          <optgroup label="📹 REGISTERED BORDER CAMERAS">
                            {availableCameras.map(c => (
                              <option key={`cam:${c.camera_id}`} value={`cam:${c.camera_id}`}>
                                {c.camera_name} [{c.camera_id}] • {c.stream_type.toUpperCase()} ({c.bop_site || 'BOP'})
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Group 2: Dual Sensor Pairs */}
                        {pairs.length > 0 && (
                          <optgroup label="⚡ DUAL SENSOR PAIRS (OPTICAL + THERMAL)">
                            {pairs.map(p => (
                              <option key={`pair:${p.pair_id}`} value={`pair:${p.pair_id}`}>
                                Pair {p.pair_id}: (RGB: {p.rgb_camera_id} ↔ Thermal: {p.thermal_camera_id})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
                  </select>

                  {selectedPair && (
                    <button
                      onClick={() => handleDeletePair(selectedPair.pair_id)}
                      title="Delete this pair"
                      className="p-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lighting Condition Mode (Day / Night) */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setLightingCondition('DAY')}
                  title="Daylight mode"
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                    lightingCondition === 'DAY' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> DAY
                </button>
                <button
                  type="button"
                  onClick={() => setLightingCondition('NIGHT')}
                  title="Night / zero-light mode"
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                    lightingCondition === 'NIGHT' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> NIGHT
                </button>
              </div>
            </div>

            {/* Fusion Mode Selector Box (Neatly Contained Inside Layout Box) */}
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> FUSION CHANNEL:
                </span>
                <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
                  Optical & LWIR Overlay Mode
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800/80 shrink-0">
                {(['FUSED', 'RGB_ONLY', 'THERMAL_ONLY'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      fusionMode === m
                        ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-900/40 border border-amber-400/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    {m === 'FUSED' && <span>⚡</span>}
                    {m === 'RGB_ONLY' && <span>👁️</span>}
                    {m === 'THERMAL_ONLY' && <span>🔥</span>}
                    <span>{m.replace('_', ' ')}</span>
                  </button>
                ))}
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
                      key={`rgb-${resolvedRgbId}-${streamKey}`}
                      src={streamErrorRgb ? cameraService.getSnapshotUrl(resolvedRgbId) : cameraService.getLiveStreamUrl(resolvedRgbId, 25, 'main')}
                      alt="Optical RGB Feed"
                      onError={() => setStreamErrorRgb(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-mono text-slate-500">NO OPTICAL CAMERA</span>
                  )}
                  <div className="absolute top-2 left-2 bg-slate-950/85 px-2 py-1 rounded text-[10px] font-mono text-sky-400 border border-slate-700">
                    OPTICAL RGB: {resolvedRgbId || 'NO CAM'}
                  </div>
                </div>

                {/* Thermal Channel View with Palette */}
                <div className="relative aspect-video bg-black rounded-xl border border-amber-800/80 overflow-hidden flex items-center justify-center shadow-lg">
                  {resolvedThermalId ? (
                    <img
                      key={`th-${resolvedThermalId}-${streamKey}`}
                      src={streamErrorThermal ? cameraService.getSnapshotUrl(resolvedThermalId) : cameraService.getLiveStreamUrl(resolvedThermalId, 25, 'main')}
                      alt="Thermal LWIR Feed"
                      onError={() => setStreamErrorThermal(true)}
                      style={{ filter: PALETTE_CONFIGS[activePalette].filter }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-mono text-slate-500">NO THERMAL CAMERA</span>
                  )}
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
                  <>
                    <img
                      key={`main-${resolvedStreamCameraId}-${streamKey}`}
                      src={streamErrorRgb ? cameraService.getSnapshotUrl(resolvedStreamCameraId) : cameraService.getLiveStreamUrl(resolvedStreamCameraId, 25, 'main')}
                      alt="Live Thermal Sensor Feed"
                      style={{
                        filter: PALETTE_CONFIGS[activePalette].filter,
                        transition: 'filter 0.3s ease-in-out'
                      }}
                      onError={() => setStreamErrorRgb(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {streamErrorRgb && (
                      <div className="absolute top-2 right-2 bg-amber-950/80 border border-amber-600/60 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 z-10">
                        SNAPSHOT MODE
                      </div>
                    )}
                  </>
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

                {/* Bottom Center Controls */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                  <button
                    type="button"
                    onClick={() => setShowPyrometerHud(!showPyrometerHud)}
                    className="px-3 py-1 bg-slate-950/90 hover:bg-slate-800 border border-amber-500/60 rounded-lg text-[11px] font-mono font-bold text-amber-300 transition cursor-pointer shadow-lg backdrop-blur"
                  >
                    <Crosshair className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                    {showPyrometerHud ? 'HIDE PYROMETER' : 'SHOW PYROMETER'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionNotice('FLIR NUC Sensor Recalibrated. Thermal Shutter Cleared.');
                      setStreamErrorRgb(false);
                      setStreamErrorThermal(false);
                      setStreamKey(Date.now());
                      setTimeout(() => setActionNotice(null), 4000);
                    }}
                    className="px-3 py-1 bg-slate-950/90 hover:bg-slate-800 border border-cyan-500/60 rounded-lg text-[11px] font-mono font-bold text-cyan-300 transition cursor-pointer shadow-lg backdrop-blur"
                    title="Non-Uniformity Correction FLIR Shutter Calibration"
                  >
                    <RefreshCw className="w-3.5 h-3.5 inline mr-1 text-cyan-400" />
                    NUC CALIBRATION
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Tactical Homography Logs & Heat Scan Results */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Thermometer className="w-4 h-4" /> RECENT HEAT ANOMALY LOGS
              </h3>
              {results.length > 0 && (
                <button
                  onClick={handleClearAllResults}
                  className="text-[10px] font-mono text-slate-400 hover:text-red-400 transition cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                No heat anomalies recorded yet. Click "Trigger Heat Scan" to perform live sensor fusion analysis.
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {results.map((r) => (
                  <div
                    key={r.result_id}
                    className="p-3 bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-lg space-y-2 text-xs font-mono transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400">{r.result_id}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.has_heat_anomaly ? 'bg-red-950/80 text-red-300 border border-red-800' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r.has_heat_anomaly ? 'HEAT ANOMALY' : 'NORMAL HEAT'}
                        </span>
                        <button
                          onClick={() => handleDeleteSingleResult(r.result_id)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>Pair: <strong className="text-slate-300">{r.pair_id}</strong></div>
                      <div>Mode: <strong className="text-slate-300">{r.fusion_mode_applied || 'FUSED'}</strong></div>
                      <div>Lighting: <strong className="text-slate-300">{r.lighting_condition}</strong></div>
                      <div>Confidence: <strong className="text-emerald-400">{((r.fused_confidence || 0.85) * 100).toFixed(0)}%</strong></div>
                    </div>

                    {(() => {
                      let list: any[] = [];
                      try {
                        list = typeof r.detections_json === 'string' ? JSON.parse(r.detections_json || '[]') : (r.detections_json || []);
                      } catch {
                        list = [];
                      }
                      if (!list || list.length === 0) return null;
                      return (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold">Fused Heat Signatures:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {list.map((d: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-amber-950/40 border border-amber-800/50 rounded text-[10px] text-amber-300 font-bold"
                              >
                                {d.class?.toUpperCase() || 'TARGET'} ({d.temp_c ? `${d.temp_c}°C` : `${spotTemp}°C`})
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Pair or Register Camera */}
      <CreatePairModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onSuccess={() => {
          fetchData();
          setIsPairModalOpen(false);
        }}
      />

      {/* Modal: Dispatch Sitrep to HQ */}
      <DispatchSitrepModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={() => {
          setDispatchModalOpen(false);
          setActionNotice('Thermal Breach SITREP Dispatched to Central HQ!');
          setTimeout(() => setActionNotice(null), 5000);
        }}
        initialTitle={dispatchTitle}
        initialSummary={dispatchSummary}
        initialPriority="CRITICAL"
      />
    </div>
  );
};
