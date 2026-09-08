import React, { useState, useEffect } from 'react';
import { X, Building2, Save, MapPin, Compass, Locate, Clock } from 'lucide-react';
import { Site } from '../../types/federation';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST • UTC+05:30) - Indian Standard Time' },
  { value: 'UTC', label: 'UTC (GMT • UTC+00:00) - Coordinated Universal Time' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT • UTC+05:00) - Pakistan Standard Time' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST • UTC+06:00) - Bangladesh Standard Time' },
  { value: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT • UTC+05:45) - Nepal Time' },
  { value: 'Asia/Thimphu', label: 'Asia/Thimphu (BTT • UTC+06:00) - Bhutan Time' },
  { value: 'Asia/Yangon', label: 'Asia/Yangon (MMT • UTC+06:30) - Myanmar Time' },
  { value: 'Asia/Kabul', label: 'Asia/Kabul (AFT • UTC+04:30) - Afghanistan Time' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST • UTC+04:00) - Gulf Standard Time' }
];

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
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED'>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<Date>(new Date());

  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const handleAutoDetectGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS not supported on this browser/device');
      return;
    }
    setIsLocating(true);
    setGpsStatus('Acquiring live GPS signal...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setGpsStatus(`GPS Locked: ${lat}° N, ${lng}° E`);
        setTimeout(() => setGpsStatus(null), 4000);
      },
      (err) => {
        setIsLocating(false);
        setGpsStatus(`GPS error: ${err.message || 'Permission denied'}`);
        setTimeout(() => setGpsStatus(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setPreviewTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

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
      setTimezone(siteToEdit.timezone === 'UTC+05:30' ? 'Asia/Kolkata' : (siteToEdit.timezone || 'Asia/Kolkata'));
      setStatus(siteToEdit.status);
    } else {
      setSiteId(`SITE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
      setRegionId('REG-NORTH');
      setName('');
      setCode('');
      setDescription('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setTimezone('Asia/Kolkata');
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

  const getFormattedRegionalTime = (tz: string) => {
    try {
      const validTz = tz === 'UTC+05:30' || tz === 'IST' ? 'Asia/Kolkata' : tz;
      return previewTime.toLocaleTimeString('en-IN', {
        timeZone: validTz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return previewTime.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
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
                placeholder="SITE-ASR-01"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Site Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="S-ASR"
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

          {/* Geospatial GPS Positioning & Live Locate */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono font-semibold">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>Geospatial GPS Coordinates & Perimeter Placement</span>
              </div>
              <button
                type="button"
                onClick={handleAutoDetectGPS}
                disabled={isLocating}
                className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Detecting...' : 'Live GPS Locate'}</span>
              </button>
            </div>

            {gpsStatus && (
              <div className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-500/40 rounded px-2.5 py-1 flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 animate-spin" />
                <span>{gpsStatus}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Latitude (North) <span className="text-indigo-400 font-mono">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 31.6340"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-[#0d131f] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Longitude (East) <span className="text-indigo-400 font-mono">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 74.8723"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-[#0d131f] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Regional Timezone (IST Primary)
              </label>
              <select
                value={timezone === 'UTC+05:30' ? 'Asia/Kolkata' : timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              >
                {TIMEZONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 rounded px-2.5 py-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>Regional Time:</span>
                </span>
                <span className="font-bold text-white tracking-wider">
                  {getFormattedRegionalTime(timezone)} {timezone === 'Asia/Kolkata' || timezone === 'UTC+05:30' ? 'IST' : ''}
                </span>
              </div>
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
