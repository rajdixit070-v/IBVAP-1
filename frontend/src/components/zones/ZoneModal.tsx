import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { SecurityZone, SecurityZoneCreate, SecurityZoneUpdate, ZoneType, NormalizedPoint } from '../../types/zone';
import { zoneService } from '../../services/zoneService';
import { Save, Sliders } from 'lucide-react';

interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraId: string;
  polygon: NormalizedPoint[];
  zoneToEdit?: SecurityZone | null;
  onSuccess: () => void;
}

export const ZoneModal: React.FC<ZoneModalProps> = ({
  isOpen,
  onClose,
  cameraId,
  polygon,
  zoneToEdit,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('RESTRICTED');
  const [monitoredClasses, setMonitoredClasses] = useState<string[]>(['person', 'vehicle']);
  const [directionRule, setDirectionRule] = useState('NONE');
  const [severity, setSeverity] = useState('HIGH');
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (zoneToEdit) {
      setName(zoneToEdit.name);
      setZoneType(zoneToEdit.zone_type);
      setMonitoredClasses(zoneToEdit.monitored_classes);
      setDirectionRule(zoneToEdit.direction_rule);
      setSeverity(zoneToEdit.severity);
      setEnabled(zoneToEdit.enabled);
    } else {
      setName('');
      setZoneType('RESTRICTED');
      setMonitoredClasses(['person', 'vehicle']);
      setDirectionRule('NONE');
      setSeverity('HIGH');
      setEnabled(true);
    }
  }, [zoneToEdit, isOpen]);

  const toggleClass = (cls: string) => {
    if (monitoredClasses.includes(cls)) {
      setMonitoredClasses(monitoredClasses.filter((c) => c !== cls));
    } else {
      setMonitoredClasses([...monitoredClasses, cls]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this security zone.');
      return;
    }

    const activePolygon = (polygon && polygon.length >= 3) ? polygon : (zoneToEdit ? zoneToEdit.polygon : []);
    if (!activePolygon || activePolygon.length < 3) {
      setError('A security zone must contain at least 3 vertices.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (zoneToEdit) {
        const updateData: SecurityZoneUpdate = {
          name,
          zone_type: zoneType,
          polygon: activePolygon,
          monitored_classes: monitoredClasses,
          direction_rule: directionRule,
          severity,
          enabled
        };
        await zoneService.updateZone(zoneToEdit.zone_id, updateData);
      } else {
        const createData: SecurityZoneCreate = {
          camera_id: cameraId,
          name,
          zone_type: zoneType,
          polygon: activePolygon,
          monitored_classes: monitoredClasses,
          direction_rule: directionRule,
          severity,
          enabled
        };
        await zoneService.createZone(createData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save security zone.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={zoneToEdit ? `Configure Security Zone // ${zoneToEdit.zone_id}` : `Create Virtual Security Zone // ${cameraId}`}
      subtitle={zoneToEdit ? `Editing: ${zoneToEdit.name}` : `Drawn Perimeter: ${polygon.length} normalized vertices`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Section 1: Basic Zone Details */}
        <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Zone Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. North Gate Restricted Area"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Zone Type</label>
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value as ZoneType)}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="RESTRICTED">RESTRICTED ZONE (High Criticality)</option>
                <option value="HIGH_SECURITY">HIGH SECURITY (Critical Asset)</option>
                <option value="BUFFER">BUFFER ZONE (Observation)</option>
                <option value="MONITORING">MONITORING ZONE (Standard)</option>
                <option value="CUSTOM">CUSTOM PERIMETER</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Monitored Classes & Direction Rule */}
        <div className="bg-[#111a2e] p-4 rounded-xl border border-[#1e293b] space-y-4">
          <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Sliders className="w-4 h-4" /> THREAT RULES & FALSE ALARM FILTERING
          </h4>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Monitored Target Classes (Unchecked classes are ignored)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'person', label: '👤 Person / Human' },
                { id: 'vehicle', label: '🚗 Vehicle' },
                { id: 'animal', label: '🐕 Animal / Wildlife' },
                { id: 'drone', label: '🛸 Drone / UAV Hook' }
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                    monitoredClasses.includes(item.id)
                      ? 'bg-sky-950/60 border-sky-500/50 text-sky-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={monitoredClasses.includes(item.id)}
                    onChange={() => toggleClass(item.id)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Forbidden Breach Direction (Image-Space)
              </label>
              <select
                value={directionRule}
                onChange={(e) => setDirectionRule(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="NONE">NONE (Any Movement Direction Monitored)</option>
                <option value="SOUTH">SOUTH (Inbound toward domestic border)</option>
                <option value="SOUTH_WEST">SOUTH-WEST</option>
                <option value="SOUTH_EAST">SOUTH-EAST</option>
                <option value="NORTH">NORTH (Outbound)</option>
                <option value="EAST">EAST</option>
                <option value="WEST">WEST</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Alert Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500"
            />
            <span>Virtual Zone Active & Monitoring</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
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
            {loading ? 'SAVING...' : 'SAVE SECURITY ZONE'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
