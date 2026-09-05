import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { thermalService } from '../../services/thermalService';
import { useCameras } from '../../context/CameraContext';
import { Flame, CheckCircle2 } from 'lucide-react';

interface CreatePairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePairModal: React.FC<CreatePairModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { cameras } = useCameras();
  const [pairId, setPairId] = useState('');
  const [rgbCameraId, setRgbCameraId] = useState('');
  const [thermalCameraId, setThermalCameraId] = useState('');
  const [siteId] = useState('SITE-BORDER-NORTH');
  const [bopId, setBopId] = useState('BOP-ALPHA');

  const [fusionMode, setFusionMode] = useState<'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY'>('FUSED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairId.trim() || !rgbCameraId || !thermalCameraId) {
      setError('Please provide Pair ID and select both Optical and Thermal cameras.');
      return;
    }
    if (rgbCameraId === thermalCameraId) {
      setError('Optical and Thermal camera IDs cannot be identical.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await thermalService.createCameraPair({
        pair_id: pairId.toUpperCase(),
        rgb_camera_id: rgbCameraId,
        thermal_camera_id: thermalCameraId,
        site_id: siteId,
        bop_id: bopId,
        fusion_mode: fusionMode,
        status: 'ACTIVE',
        overlap_ratio: 0.85,
        sync_tolerance_ms: 100
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create thermal camera pair.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Optical + Thermal Camera Pair"
      subtitle="Link visible spectrum optical camera with thermal infrared camera for homography alignment"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Pair ID <span className="text-amber-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. PAIR-NORTH-01"
            value={pairId}
            onChange={(e) => setPairId(e.target.value.toUpperCase())}
            className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optical RGB Camera <span className="text-sky-400">*</span>
            </label>
            {cameras.length > 0 ? (
              <select
                value={rgbCameraId}
                onChange={(e) => setRgbCameraId(e.target.value)}
                required
                className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="">Select Camera...</option>
                {cameras.map(c => (
                  <option key={c.camera_id} value={c.camera_id}>
                    {c.camera_id} — {c.camera_name} ({c.bop_site})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                placeholder="e.g. CAM-01"
                value={rgbCameraId}
                onChange={(e) => setRgbCameraId(e.target.value.toUpperCase())}
                className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Thermal Infrared Camera <span className="text-amber-400">*</span>
            </label>
            {cameras.length > 0 ? (
              <select
                value={thermalCameraId}
                onChange={(e) => setThermalCameraId(e.target.value)}
                required
                className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="">Select Thermal Camera...</option>
                {cameras.map(c => (
                  <option key={c.camera_id} value={c.camera_id}>
                    {c.camera_id} — {c.camera_name} ({c.bop_site})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                placeholder="e.g. CAM-THERMAL-01"
                value={thermalCameraId}
                onChange={(e) => setThermalCameraId(e.target.value.toUpperCase())}
                className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Default Fusion Mode</label>
            <select
              value={fusionMode}
              onChange={(e) => setFusionMode(e.target.value as any)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="FUSED">⚡ FUSED (Overlay Heatmap & BBoxes)</option>
              <option value="RGB_ONLY">☀️ RGB Optical Only</option>
              <option value="THERMAL_ONLY">🌙 Thermal Infrared Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Border Outpost (BOP)</label>
            <input
              type="text"
              value={bopId}
              onChange={(e) => setBopId(e.target.value)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Homography calibration matrix (3x3 perspective warp) will be auto-calculated upon frame registration.</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold font-mono transition shadow-lg shadow-amber-900/30 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{loading ? 'Pairing Cameras...' : 'Save & Link Pair'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
