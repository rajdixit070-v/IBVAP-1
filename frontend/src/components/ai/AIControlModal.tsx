import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CameraAIConfig, CameraAIConfigUpdate, CameraAIStatus } from '../../types/ai';
import { aiService } from '../../services/aiService';
import {
  Cpu,
  Sliders,
  Save,
  CheckCircle2,
  ShieldCheck,
  Zap,
  CloudRain,
  RotateCcw,
  Activity,
  Target,
  Layers
} from 'lucide-react';

interface AIControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraId: string;
  cameraName?: string;
  onSaved?: () => void;
}

export const AIControlModal: React.FC<AIControlModalProps> = ({
  isOpen,
  onClose,
  cameraId,
  cameraName,
  onSaved
}) => {
  const [config, setConfig] = useState<CameraAIConfig | null>(null);
  const [liveStatus, setLiveStatus] = useState<CameraAIStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedTracker, setShowAdvancedTracker] = useState(false);

  useEffect(() => {
    if (isOpen && cameraId) {
      loadConfig();
    }
  }, [isOpen, cameraId]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, statusData] = await Promise.all([
        aiService.getCameraConfig(cameraId),
        aiService.getCameraAIStatus(cameraId).catch(() => null)
      ]);
      setConfig(configData);
      if (statusData) setLiveStatus(statusData);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load AI configuration.');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetType: 'balanced' | 'high_sensitivity' | 'adverse_weather') => {
    if (!config) return;
    if (presetType === 'balanced') {
      setConfig({
        ...config,
        conf_person: 0.40,
        conf_vehicle: 0.45,
        conf_animal: 0.35,
        conf_drone: 0.30,
        target_fps: 10.0,
        track_thresh: 0.45,
        match_thresh: 0.70
      });
    } else if (presetType === 'high_sensitivity') {
      setConfig({
        ...config,
        conf_person: 0.25,
        conf_vehicle: 0.30,
        conf_animal: 0.25,
        conf_drone: 0.20,
        target_fps: 15.0,
        track_thresh: 0.30,
        match_thresh: 0.60
      });
    } else if (presetType === 'adverse_weather') {
      setConfig({
        ...config,
        conf_person: 0.55,
        conf_vehicle: 0.55,
        conf_animal: 0.60,
        conf_drone: 0.45,
        target_fps: 10.0,
        track_thresh: 0.50,
        match_thresh: 0.75
      });
    }
  };

  const handleResetDefaults = () => {
    applyPreset('balanced');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(false);

    try {
      const payload: CameraAIConfigUpdate = {
        enabled: config.enabled,
        model_name: config.model_name,
        target_fps: config.target_fps,
        conf_person: config.conf_person,
        conf_vehicle: config.conf_vehicle,
        conf_animal: config.conf_animal,
        conf_drone: config.conf_drone,
        conf_other: config.conf_other,
        track_thresh: config.track_thresh,
        match_thresh: config.match_thresh
      };
      await aiService.updateCameraConfig(cameraId, payload);
      setSuccessMsg(true);

      // Refresh live telemetry
      const updatedStatus = await aiService.getCameraAIStatus(cameraId).catch(() => null);
      if (updatedStatus) setLiveStatus(updatedStatus);

      if (onSaved) onSaved();
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`AI Inference & Detection Tuning // ${cameraId}`}
      subtitle={cameraName ? `Configuring: ${cameraName}` : 'YOLO Detection Thresholds & ByteTrack Parameters'}
      maxWidth="2xl"
    >
      {loading ? (
        <div className="py-10 text-center text-xs font-mono text-slate-400">
          Loading AI parameters & live telemetry...
        </div>
      ) : config ? (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Live Telemetry & Engine Diagnostics Header */}
          <div className="bg-[#0c1424] border border-[#1e293b] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="font-semibold text-slate-200">
                AI ENGINE: <span className={config.enabled ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{config.enabled ? 'ENABLED' : 'PAUSED'}</span>
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>FPS: <strong className="text-white">{liveStatus?.inference_fps ? `${liveStatus.inference_fps} FPS` : `${config.target_fps} FPS`}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>LATENCY: <strong className="text-white">{liveStatus?.latency_ms ? `${liveStatus.latency_ms}ms` : '<15ms'}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>TRACKS: <strong className="text-white">{liveStatus?.active_tracks_count ?? 0}</strong></span>
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>AI configuration saved and applied dynamically to live video feed!</span>
            </div>
          )}

          {/* Quick Tactical Presets Bar */}
          <div className="bg-[#111a2e] p-3.5 rounded-xl border border-[#1e293b] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> QUICK TACTICAL PRESETS
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
                title="Reset sliders to standard border patrol settings"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => applyPreset('balanced')}
                className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 rounded-lg text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Balanced
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Person 40% | Veh 45%</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('high_sensitivity')}
                className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 rounded-lg text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                  <Target className="w-3.5 h-3.5" /> High Alert
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Person 25% | Drone 20%</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('adverse_weather')}
                className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 rounded-lg text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                  <CloudRain className="w-3.5 h-3.5" /> Bad Weather
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Rain/Dust (55% Cutoff)</div>
              </button>
            </div>
          </div>

          {/* Section 1: Pipeline Control & Inference Rate */}
          <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-4">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Cpu className="w-4 h-4" /> PIPELINE CONTROL & INFERENCE RATE
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">AI Pipeline Status</label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500 bg-slate-900"
                    />
                    <span>AI Object Detection Enabled</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Inference FPS: <span className="text-sky-400 font-mono font-bold">{config.target_fps} FPS</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={config.target_fps}
                  onChange={(e) => setConfig({ ...config, target_fps: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>2 FPS (Eco)</span>
                  <span>10 FPS (Nominal)</span>
                  <span>25 FPS (Max)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Confidence Thresholds */}
          <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-4">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Sliders className="w-4 h-4" /> CATEGORY CONFIDENCE THRESHOLDS
            </h4>

            <div className="space-y-4 text-xs">
              {/* Person Threshold */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-sky-300">Person Confidence Threshold</span>
                  <span className="font-mono text-sky-400 font-bold">{Math.round(config.conf_person * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={config.conf_person}
                  onChange={(e) => setConfig({ ...config, conf_person: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Vehicle Threshold */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-emerald-300">Vehicle Confidence Threshold (Cars, Trucks, Buses)</span>
                  <span className="font-mono text-emerald-400 font-bold">{Math.round(config.conf_vehicle * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={config.conf_vehicle}
                  onChange={(e) => setConfig({ ...config, conf_vehicle: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Animal Threshold */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-amber-300">Animal / Livestock Threshold</span>
                  <span className="font-mono text-amber-400 font-bold">{Math.round(config.conf_animal * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={config.conf_animal}
                  onChange={(e) => setConfig({ ...config, conf_animal: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Drone Threshold */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-purple-300">Drone / UAV Model Hook Threshold</span>
                  <span className="font-mono text-purple-400 font-bold">{Math.round(config.conf_drone * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={config.conf_drone}
                  onChange={(e) => setConfig({ ...config, conf_drone: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Advanced ByteTrack Multi-Frame Tracker Tuning (Collapsible) */}
          <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvancedTracker(!showAdvancedTracker)}
              className="w-full flex items-center justify-between text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider border-b border-slate-800 pb-2 cursor-pointer hover:text-indigo-200 transition"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                BYTETRACK MULTI-FRAME TRACKING PARAMETERS
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {showAdvancedTracker ? '[-] Hide Parameters' : '[+] Show Parameters'}
              </span>
            </button>

            {showAdvancedTracker && (
              <div className="space-y-4 pt-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-300">Track Association Score Threshold</span>
                    <span className="font-mono text-indigo-400 font-bold">{Math.round(config.track_thresh * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="0.85"
                    step="0.05"
                    value={config.track_thresh}
                    onChange={(e) => setConfig({ ...config, track_thresh: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Lower values maintain trajectories across occlusions; higher values eliminate phantom tracks.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-300">Bounding Box IoU Match Threshold</span>
                    <span className="font-mono text-indigo-400 font-bold">{Math.round(config.match_thresh * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="0.90"
                    step="0.05"
                    value={config.match_thresh}
                    onChange={(e) => setConfig({ ...config, match_thresh: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Spatial overlap required between adjacent frames to confirm persistent target identity.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'APPLYING CONFIGURATION...' : 'APPLY CONFIGURATION'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
};

