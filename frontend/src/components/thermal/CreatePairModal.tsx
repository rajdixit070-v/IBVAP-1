import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { thermalService } from '../../services/thermalService';
import { cameraService } from '../../services/cameraService';
import { useCameras } from '../../context/CameraContext';
import { Flame, CheckCircle2, Plus, Link, Video } from 'lucide-react';

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
  const { cameras, refreshCameras } = useCameras();
  const [activeTab, setActiveTab] = useState<'link' | 'register'>('link');

  // Link Form State
  const [pairId, setPairId] = useState('');
  const [rgbCameraId, setRgbCameraId] = useState('');
  const [thermalCameraId, setThermalCameraId] = useState('');
  const [fusionMode, setFusionMode] = useState<'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY'>('FUSED');
  const [bopId, setBopId] = useState('BOP-ALPHA');
  const [siteId] = useState('SITE-BORDER-NORTH');

  // Register New Camera Form State
  const [newCamId, setNewCamId] = useState('');
  const [newCamName, setNewCamName] = useState('');
  const [newCamType, setNewCamType] = useState<'thermal' | 'main'>('thermal');
  const [newCamRtsp, setNewCamRtsp] = useState('');
  const [linkWithCamId, setLinkWithCamId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto generate Pair ID when cameras change
  const autoSuggestPairId = (rgb: string, th: string) => {
    if (rgb && th) {
      const cleanRgb = rgb.replace(/[^a-zA-Z0-9]/g, '');
      const cleanTh = th.replace(/[^a-zA-Z0-9]/g, '');
      return `PAIR-${cleanRgb}-${cleanTh}`.toUpperCase();
    }
    return '';
  };

  const handleRgbSelect = (id: string) => {
    setRgbCameraId(id);
    if (!pairId || pairId.startsWith('PAIR-')) {
      const s = autoSuggestPairId(id, thermalCameraId);
      if (s) setPairId(s);
    }
  };

  const handleThermalSelect = (id: string) => {
    setThermalCameraId(id);
    if (!pairId || pairId.startsWith('PAIR-')) {
      const s = autoSuggestPairId(rgbCameraId, id);
      if (s) setPairId(s);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'link') {
        const finalPairId = pairId.trim().toUpperCase() || autoSuggestPairId(rgbCameraId, thermalCameraId);
        if (!finalPairId || !rgbCameraId || !thermalCameraId) {
          setError('Please provide Pair ID and select both Optical and Thermal cameras.');
          setLoading(false);
          return;
        }
        if (rgbCameraId === thermalCameraId) {
          setError('Optical and Thermal camera IDs cannot be identical.');
          setLoading(false);
          return;
        }

        await thermalService.createCameraPair({
          pair_id: finalPairId,
          rgb_camera_id: rgbCameraId,
          thermal_camera_id: thermalCameraId,
          site_id: siteId,
          bop_id: bopId,
          fusion_mode: fusionMode,
          status: 'ACTIVE',
          overlap_ratio: 0.85,
          sync_tolerance_ms: 100
        });
      } else {
        // Register new camera first, then pair
        if (!newCamId.trim() || !newCamName.trim() || !linkWithCamId) {
          setError('Please provide Camera ID, Camera Name, and select a camera to pair with.');
          setLoading(false);
          return;
        }

        const registeredId = newCamId.trim().toUpperCase();

        // 1. Create camera in camera database
        await cameraService.createCamera({
          camera_id: registeredId,
          camera_name: newCamName.trim(),
          description: `Auto-registered ${newCamType === 'thermal' ? 'LWIR Thermal' : 'Optical RGB'} Sensor`,
          bop_site: bopId || 'BOP Alpha',
          sector: 'North Sector',
          stream_type: newCamType,
          rtsp_url: newCamRtsp.trim() || `synthetic://${registeredId.toLowerCase()}/main`,
          enabled: true
        });

        // Start stream
        try {
          await cameraService.startStream(registeredId);
        } catch (_) {}

        // 2. Determine which is RGB and which is Thermal
        const finalRgb = newCamType === 'thermal' ? linkWithCamId : registeredId;
        const finalThermal = newCamType === 'thermal' ? registeredId : linkWithCamId;
        const finalPairId = pairId.trim().toUpperCase() || `PAIR-${finalRgb}-${finalThermal}`.toUpperCase();

        // 3. Create Pair
        await thermalService.createCameraPair({
          pair_id: finalPairId,
          rgb_camera_id: finalRgb,
          thermal_camera_id: finalThermal,
          site_id: siteId,
          bop_id: bopId,
          fusion_mode: fusionMode,
          status: 'ACTIVE',
          overlap_ratio: 0.85,
          sync_tolerance_ms: 100
        });

        await refreshCameras();
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create thermal camera pair.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Optical + Thermal Camera Pairing & Registration"
      subtitle="Link visible optical video with thermal LWIR infrared sensor for spatial homography alignment"
      maxWidth="xl"
    >
      <div className="p-6 space-y-4">
        {/* Tab Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'link'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            1. Link Existing Cameras ({cameras.length} Registered)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'register'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            2. Register & Pair New Camera
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'link' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pair ID Identifier <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAIR-CAM01-CAM02"
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
                  <select
                    value={rgbCameraId}
                    onChange={(e) => handleRgbSelect(e.target.value)}
                    required
                    className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  >
                    <option value="">Select Optical Camera...</option>
                    {cameras.map(c => (
                      <option key={c.camera_id} value={c.camera_id}>
                        {c.camera_id} — {c.camera_name} ({c.stream_type === 'thermal' ? 'THERMAL' : 'RGB'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thermal Infrared Camera <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={thermalCameraId}
                    onChange={(e) => handleThermalSelect(e.target.value)}
                    required
                    className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="">Select Thermal Camera...</option>
                    {cameras.map(c => (
                      <option key={c.camera_id} value={c.camera_id}>
                        {c.camera_id} — {c.camera_name} ({c.stream_type === 'thermal' ? '🔥 THERMAL' : 'RGB'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Register New Camera Fields */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  New Sensor Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">New Camera ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CAM-TH-05"
                      value={newCamId}
                      onChange={(e) => setNewCamId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Sensor Designation Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Riverbed Thermal Night Guard"
                      value={newCamName}
                      onChange={(e) => setNewCamName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Sensor Technology Type</label>
                    <select
                      value={newCamType}
                      onChange={(e) => setNewCamType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    >
                      <option value="thermal">🔥 Long-Wave Infrared (LWIR Thermal)</option>
                      <option value="main">👁️ Daylight Optical (RGB)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">RTSP Stream URL (or Synthetic)</label>
                    <input
                      type="text"
                      placeholder="synthetic://cam-th/main or rtsp://..."
                      value={newCamRtsp}
                      onChange={(e) => setNewCamRtsp(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Pair With Existing {newCamType === 'thermal' ? 'Optical RGB' : 'Thermal'} Camera *
                  </label>
                  <select
                    value={linkWithCamId}
                    onChange={(e) => setLinkWithCamId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select camera to pair with...</option>
                    {cameras.map(c => (
                      <option key={c.camera_id} value={c.camera_id}>
                        {c.camera_id} — {c.camera_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Fusion Channel Mode</label>
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
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold font-mono transition shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{loading ? 'Processing Pairing...' : activeTab === 'register' ? 'Register & Link Pair' : 'Save & Link Pair'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
