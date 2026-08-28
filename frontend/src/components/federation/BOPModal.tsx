import React, { useState, useEffect } from 'react';
import { X, Shield, Save } from 'lucide-react';
import { BOP, Site } from '../../types/federation';

interface BOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bopData: Partial<BOP>) => Promise<void>;
  bopToEdit?: BOP | null;
  sites: Site[];
  defaultSiteId?: string;
}

export const BOPModal: React.FC<BOPModalProps> = ({
  isOpen,
  onClose,
  onSave,
  bopToEdit,
  sites,
  defaultSiteId
}) => {
  const [bopId, setBopId] = useState('');
  const [siteId, setSiteId] = useState(defaultSiteId || 'SITE-BORDER-NORTH');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED'>('ACTIVE');
  const [operationalPriority, setOperationalPriority] = useState<'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bopToEdit) {
      setBopId(bopToEdit.bop_id);
      setSiteId(bopToEdit.site_id);
      setName(bopToEdit.name);
      setCode(bopToEdit.code);
      setDescription(bopToEdit.description || '');
      setLocation(bopToEdit.location || '');
      setLatitude(bopToEdit.latitude || '');
      setLongitude(bopToEdit.longitude || '');
      setStatus(bopToEdit.status);
      setOperationalPriority(bopToEdit.operational_priority);
    } else {
      setBopId(`BOP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
      setSiteId(defaultSiteId || (sites[0]?.site_id || 'SITE-BORDER-NORTH'));
      setName('');
      setCode('');
      setDescription('');
      setLocation('');
      setLatitude(32.7266);
      setLongitude(74.8570);
      setStatus('ACTIVE');
      setOperationalPriority('NORMAL');
    }
    setError(null);
  }, [bopToEdit, defaultSiteId, sites, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !bopId.trim() || !siteId.trim()) {
      setError('BOP Name, Code, BOP ID, and Parent Site are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        bop_id: bopId.trim(),
        site_id: siteId.trim(),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        latitude: latitude !== '' ? Number(latitude) : undefined,
        longitude: longitude !== '' ? Number(longitude) : undefined,
        status,
        operational_priority: operationalPriority
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save BOP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/60">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {bopToEdit ? 'Edit Border Outpost (BOP)' : 'Provision New Border Outpost (BOP)'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Tactical Border Outpost Hierarchy</p>
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
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Parent Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                disabled={!!bopToEdit}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                {sites.map((s) => (
                  <option key={s.site_id} value={s.site_id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">BOP ID</label>
              <input
                type="text"
                value={bopId}
                disabled={!!bopToEdit}
                onChange={(e) => setBopId(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                placeholder="BOP-ALPHA"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">BOP Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="BOP Delta"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">BOP Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 uppercase"
                placeholder="BOP-D"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Location & Operational Details</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 mb-2"
              placeholder="Ridge Top Point 4, Sector Bravo"
            />
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              placeholder="Operational responsibilities, watch duty post notes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Operational Priority</label>
              <select
                value={operationalPriority}
                onChange={(e) => setOperationalPriority(e.target.value as any)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="CRITICAL">CRITICAL (Zero Tolerance)</option>
                <option value="HIGH">HIGH (Standard Active Patrol)</option>
                <option value="NORMAL">NORMAL</option>
                <option value="LOW">LOW</option>
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : bopToEdit ? 'Update BOP' : 'Provision BOP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
