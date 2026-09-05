import React, { useState } from 'react';
import { Send, AlertTriangle, ShieldCheck, CheckCircle2, X } from 'lucide-react';

import { dispatchService } from '../../services/dispatchService';
import { BOPDispatchCreateInput } from '../../types/dispatch';
import { useAuth } from '../../context/AuthContext';

interface DispatchSitrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEvidenceIds?: string[];
}

export const DispatchSitrepModal: React.FC<DispatchSitrepModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEvidenceIds = []
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<string>('IMPORTANT');
  const [personsCount, setPersonsCount] = useState<number>(1);
  const [vehiclesCount, setVehiclesCount] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('Please provide a title and detailed shift summary.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const payload: BOPDispatchCreateInput = {
        title,
        summary,
        bop_id: user?.scope_id && user?.scope_id !== '*' ? user.scope_id : 'BOP-ALPHA',
        priority,
        detected_persons_count: Number(personsCount),
        vehicles_scanned_count: Number(vehiclesCount),
        alerts_count: Number(alertsCount),
        evidence_ids: defaultEvidenceIds
      };

      await dispatchService.createDispatch(payload);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to dispatch SITREP to HQ.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b1320] border border-cyan-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-cyan-950/50">
        <div className="px-5 py-4 border-b border-[#1e293b] bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Transmit Daily SITREP to Headquarters
              </h3>
              <p className="text-[11px] text-cyan-400/80 font-mono">
                From: {user?.username} ({user?.scope_id || 'BOP-ALPHA'}) ➔ HQ Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-pulse">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">SITREP Dispatched to HQ</h4>
            <p className="text-xs text-slate-300">
              Central Command Headquarters has been notified. Directives will appear in your log.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SITREP Report Title <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Night Shift Watch: 2 Unknown Suspects Intercepted at Gate-3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transmission Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="ROUTINE">ROUTINE (Standard Shift)</option>
                  <option value="IMPORTANT">IMPORTANT (Action Needed)</option>
                  <option value="URGENT">URGENT (Threat Flagged)</option>
                  <option value="FLASH">FLASH (Immediate Breach)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Attached Evidence Records
                </label>
                <div className="bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>{defaultEvidenceIds.length} Evidence Attached</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Persons Detected
                </label>
                <input
                  type="number"
                  min="0"
                  value={personsCount}
                  onChange={(e) => setPersonsCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Vehicles Checked
                </label>
                <input
                  type="number"
                  min="0"
                  value={vehiclesCount}
                  onChange={(e) => setVehiclesCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Perimeter Alerts
                </label>
                <input
                  type="number"
                  min="0"
                  value={alertsCount}
                  onChange={(e) => setAlertsCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Officer Narrative & Intelligence Summary <span className="text-cyan-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Detail observations, time of detection, suspect physical traits, vehicle license numbers, actions taken on ground, and recommendations for HQ..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'TRANSMITTING...' : 'DISPATCH TO HQ ADMIN'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
