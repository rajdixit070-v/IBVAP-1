import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CameraAIConfig, CameraAIConfigUpdate } from '../../types/ai';
import { aiService } from '../../services/aiService';
import { Cpu, Sliders, Save, CheckCircle2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && cameraId) {
      loadConfig();
    }
  }, [isOpen, cameraId]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiService.getCameraConfig(cameraId);
      setConfig(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load AI configuration.');
    } finally {
      setLoading(false);
    }
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
          Loading AI parameters...
        </div>
      ) : config ? (
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> AI configuration updated and applied live to stream!
            </div>
          )}

          {/* Section 1: State & Performance Rate */}
          <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-4">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Cpu className="w-4 h-4" /> PIPELINE CONTROL & INFERENCE RATE
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">AI Pipeline Status</label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500"
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
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'SAVING...' : 'APPLY CONFIGURATION'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
};
