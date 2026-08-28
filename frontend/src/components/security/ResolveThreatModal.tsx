import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { securityService } from '../../services/securityService';
import { SecurityThreatEvent } from '../../types/security';

interface ResolveThreatModalProps {
  isOpen: boolean;
  onClose: () => void;
  threat: SecurityThreatEvent | null;
  onResolved: () => void;
}

export const ResolveThreatModal: React.FC<ResolveThreatModalProps> = ({
  isOpen,
  onClose,
  threat,
  onResolved
}) => {
  const [status, setStatus] = useState<'RESOLVED' | 'CONTAINED' | 'FALSE_POSITIVE'>('RESOLVED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !threat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    setSubmitting(true);
    try {
      await securityService.resolveThreat(threat.event_id, notes.trim(), status);
      onResolved();
      onClose();
    } catch (err) {
      console.error('Failed to resolve threat:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-xl w-full max-w-md flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Mitigate Security Threat</h3>
              <p className="text-xs font-mono text-slate-400">{threat.event_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
            <div>Type: <span className="text-cyan-300">{threat.event_type}</span></div>
            <div>Severity: <span className="text-rose-400">{threat.severity}</span></div>
            <div>Source IP: <span className="text-slate-200">{threat.source_ip}</span></div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Resolution Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
            >
              <option value="RESOLVED">RESOLVED (Mitigated & Isolated)</option>
              <option value="CONTAINED">CONTAINED (Active Monitoring)</option>
              <option value="FALSE_POSITIVE">FALSE_POSITIVE (Legitimate Traffic)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Investigation Notes & Mitigation Summary *</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Blocked attacking IP on perimeter firewall; credentials reset."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !notes.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Saving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
