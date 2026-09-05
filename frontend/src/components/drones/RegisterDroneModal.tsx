import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { droneService } from '../../services/droneService';
import { Plane, CheckCircle2 } from 'lucide-react';

interface RegisterDroneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterDroneModal: React.FC<RegisterDroneModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [droneId, setDroneId] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('BorderGuardian-X8');
  const [siteId] = useState('SITE-BORDER-NORTH');
  const [bopId] = useState('BOP-ALPHA');

  const [streamUrl, setStreamUrl] = useState('rtsp://192.168.1.200:8554/live');
  const [latitude, setLatitude] = useState<number>(31.6240);
  const [longitude, setLongitude] = useState<number>(74.8720);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!droneId.trim() || !name.trim()) {
      setError('Please provide Drone ID and Name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await droneService.registerDrone({
        drone_id: droneId.toUpperCase(),
        name,
        model,
        site_id: siteId,
        bop_id: bopId,
        status: 'AVAILABLE',
        battery_pct: 100,
        latitude,
        longitude,
        altitude_m: 0,
        heading_deg: 0,
        speed_mps: 0,
        flight_state: 'LANDED',
        gps_satellites: 18,
        link_quality_pct: 98,
        camera_stream_url: streamUrl || undefined,
        camera_gimbal_pitch: -45.0
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register drone.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Autonomous Patrol Drone (UAV)"
      subtitle="Provision unmanned aerial vehicle for automated camera-to-drone intrusion handoffs and sector sweeps"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Drone ID <span className="text-purple-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. DRONE-ALPHA-01"
              value={droneId}
              onChange={(e) => setDroneId(e.target.value.toUpperCase())}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              UAV Model / Airframe
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            >
              <option value="BorderGuardian-X8">BorderGuardian-X8 (Heavy Lift Thermal)</option>
              <option value="DJI-Matrice-300">DJI Matrice 300 RTK</option>
              <option value="Autel-EVO-Max-4T">Autel EVO Max 4T (AI Recon)</option>
              <option value="Skydio-X2D">Skydio X2D Autonomous Patrol</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Call Sign / Designation <span className="text-purple-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Eagle-1 Rapid Response UAV"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Gimbal Live Video Stream URL (RTSP / UDP)
          </label>
          <input
            type="text"
            placeholder="rtsp://192.168.1.200:8554/live"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dock Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dock Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Equipped with auto-takeoff logic, optical+thermal night tracking, and camera-to-drone sector handoff capability.</span>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold font-mono transition shadow-lg shadow-purple-900/30 cursor-pointer"
          >
            <Plane className="w-3.5 h-3.5" />
            <span>{loading ? 'Registering...' : 'Register UAV'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
