import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { sensorService, Sensor } from '../../services/sensorService';
import { useCameras } from '../../context/CameraContext';
import { Radio, CheckCircle2 } from 'lucide-react';

interface RegisterSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterSensorModal: React.FC<RegisterSensorModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { cameras } = useCameras();
  const [sensorId, setSensorId] = useState('');
  const [name, setName] = useState('');
  const [sensorType, setSensorType] = useState<Sensor['sensor_type']>('RADAR');
  const [sector, setSector] = useState('Sector-North');
  const [siteId] = useState('SITE-BORDER-NORTH');
  const [bopId] = useState('BOP-ALPHA');

  const [cameraId, setCameraId] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(31.6245);
  const [longitude, setLongitude] = useState<number | undefined>(74.8725);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensorId.trim() || !name.trim() || !sector.trim()) {
      setError('Please provide Sensor ID, Name, and Sector.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sensorService.registerSensor({
        sensor_id: sensorId.toUpperCase(),
        name,
        sensor_type: sensorType,
        sector,
        site_id: siteId,
        bop_id: bopId,
        camera_id: cameraId || undefined,
        latitude,
        longitude,
        status: 'ONLINE',
        health_score: 100,
        latency_ms: 18.5,
        reliability_weight: sensorType === 'RADAR' ? 0.95 : 0.85
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register sensor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Advanced Perimeter Sensor"
      subtitle="Provision Radar, Ground Seismic Geophone, Acoustic array, or Weather station for Bayesian correlation"
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
              Sensor ID <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. RAD-NORTH-01"
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value.toUpperCase())}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Sensor Type <span className="text-cyan-400">*</span>
            </label>
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value as any)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
            >
              <option value="RADAR">📡 X-Band Tactical Radar</option>
              <option value="SEISMIC">🌐 Ground Seismic Geophone</option>
              <option value="ACOUSTIC">🔊 Perimeter Acoustic Mic Array</option>
              <option value="THERMAL">🔥 Thermal Long-Range Pyrometer</option>
              <option value="WEATHER">⛅ Weather & Visibility Station</option>
              <option value="DRONE">🛸 Drone Fleet Tether Sensor</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Sensor Designation / Call Sign <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Outpost Alpha Ground Geophone Array"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Sector <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Linked Camera (Optional)</label>
            <select
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="">No Camera Linked (Stand-alone Sensor)</option>
              {cameras.map(c => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_id} — {c.camera_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={latitude ?? ''}
              onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={longitude ?? ''}
              onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Bayesian fusion engine correlates this sensor with optical cameras in the same sector in a 5-second window.</span>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold font-mono transition shadow-lg shadow-cyan-900/30 cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{loading ? 'Provisioning...' : 'Provision Sensor'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
