import React, { useState, useEffect } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { Site } from '../../types/federation';

interface SiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (siteData: Partial<Site>) => Promise<void>;
  siteToEdit?: Site | null;
}

export const SiteModal: React.FC<SiteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  siteToEdit
}) => {
  const [siteId, setSiteId] = useState('');
  const [regionId, setRegionId] = useState('REG-NORTH');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [timezone, setTimezone] = useState('UTC+05:30');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED'>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (siteToEdit) {
      setSiteId(siteToEdit.site_id);
      setRegionId(siteToEdit.region_id);
      setName(siteToEdit.name);
      setCode(siteToEdit.code);
      setDescription(siteToEdit.description || '');
      setLocation(siteToEdit.location || '');
      setLatitude(siteToEdit.latitude || '');
      setLongitude(siteToEdit.longitude || '');
      setTimezone(siteToEdit.timezone || 'UTC+05:30');
      setStatus(siteToEdit.status);
    } else {
      setSiteId(`SITE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
      setRegionId('REG-NORTH');
      setName('');
      setCode('');
      setDescription('');
      setLocation('');
      setLatitude(32.7266);
      setLongitude(74.8570);
      setTimezone('UTC+05:30');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [siteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !siteId.trim()) {
      setError('Site Name, Code, and Site ID are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        site_id: siteId.trim(),
        region_id: regionId.trim(),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        latitude: latitude !== '' ? Number(latitude) : undefined,
        longitude: longitude !== '' ? Number(longitude) : undefined,
        timezone,
        status
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save site.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/60">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {siteToEdit ? 'Edit Tactical Border Site' : 'Create Operational Border Site'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Centralized Border Site Provisioning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Site ID</label>
              <input
                type="text"
                value={siteId}
                disabled={!!siteToEdit}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                placeholder="SITE-BORDER-NORTH"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Site Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="S-NORTH"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Site Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="Northern Border Tactical Command"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Region ID</label>
              <input
                type="text"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                placeholder="REG-NORTH"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Location & Description</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 mb-2"
              placeholder="Northern Himalayan Ridge, Sector 1-4"
            />
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="Operational description, border zero-line corridor coverage..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                placeholder="32.7266"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                placeholder="74.8570"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : siteToEdit ? 'Update Site' : 'Provision Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
