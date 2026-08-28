import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { EdgeNode, EdgeRemoteConfig } from '../../types/edge';
import { edgeService } from '../../services/edgeService';
import { Save, Wifi, Cpu } from 'lucide-react';

interface RemoteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: EdgeNode | null;
  onSuccess: () => void;
}

export const RemoteConfigModal: React.FC<RemoteConfigModalProps> = ({
  isOpen,
  onClose,
  node,
  onSuccess
}) => {
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [inferenceFps, setInferenceFps] = useState(10);
  const [syncBatchSize, setSyncBatchSize] = useState(25);
  const [diskWarning, setDiskWarning] = useState(85);
  const [diskCritical, setDiskCritical] = useState(95);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setLowBandwidthMode(node.low_bandwidth_mode);
      setInferenceFps(10);
      setSyncBatchSize(25);
      setDiskWarning(85);
      setDiskCritical(95);
    }
  }, [node, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!node) return;

    setLoading(true);
    setError(null);

    try {
      const config: EdgeRemoteConfig = {
        low_bandwidth_mode: lowBandwidthMode,
        inference_fps: inferenceFps,
        sync_batch_size: syncBatchSize,
        disk_warning_threshold: diskWarning,
        disk_critical_threshold: diskCritical
      };

      await edgeService.updateRemoteConfig(node.node_id, config);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to apply remote configuration.');
    } finally {
      setLoading(false);
    }
  };

  if (!node) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Remote Configuration // ${node.node_id}`}
      subtitle={`Configure edge operating profile for ${node.name} (Config v${node.config_version})`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Low-Bandwidth Mode Toggle */}
        <div className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Low-Bandwidth Adaptive Mode</span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm">
              Prioritizes metadata and events over raw video; drops remote preview resolution to 360p and batches store-and-forward sync.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={lowBandwidthMode}
              onChange={(e) => setLowBandwidthMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Inference FPS Slider */}
        <div className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Target Edge AI Inference Rate</span>
            </div>
            <span className="text-sky-400 font-mono font-bold">{inferenceFps} FPS</span>
          </div>
          <input
            type="range"
            min={4}
            max={25}
            step={1}
            value={inferenceFps}
            onChange={(e) => setInferenceFps(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>4 FPS (Power Saver)</span>
            <span>10 FPS (Standard)</span>
            <span>25 FPS (Full Speed)</span>
          </div>
        </div>

        {/* Sync Batch Size & Disk Thresholds */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-1">
            <label className="block text-xs font-bold text-white">Sync Batch Size</label>
            <p className="text-[10px] text-slate-500">Max events per store-and-forward batch</p>
            <input
              type="number"
              min={5}
              max={100}
              value={syncBatchSize}
              onChange={(e) => setSyncBatchSize(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-1">
            <label className="block text-xs font-bold text-white">Disk Alert Threshold (%)</label>
            <p className="text-[10px] text-slate-500">Warning limit for edge evidence purge</p>
            <input
              type="number"
              min={50}
              max={98}
              value={diskWarning}
              onChange={(e) => setDiskWarning(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'APPLYING CONFIG...' : `APPLY CONFIG V${node.config_version + 1}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
