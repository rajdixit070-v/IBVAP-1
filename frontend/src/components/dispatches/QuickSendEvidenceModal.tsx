import React, { useState } from 'react';
import { Send, ShieldAlert, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { dispatchService } from '../../services/dispatchService';
import { Evidence } from '../../types/incident';

interface QuickSendEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  evidence: Evidence | null;
}

export const QuickSendEvidenceModal: React.FC<QuickSendEvidenceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  evidence
}) => {
  const [priority, setPriority] = useState<string>('URGENT');
  const [officerNotes, setOfficerNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !evidence) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await dispatchService.quickSendEvidence(evidence.evidence_id, priority, officerNotes);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to dispatch evidence to HQ.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b1320] border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-amber-950/50">
        <div className="px-5 py-4 border-b border-[#1e293b] bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Transmit Evidence to HQ
              </h3>
              <p className="text-[11px] text-amber-400/80 font-mono">
                {evidence.evidence_id} • {evidence.camera_id}
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
            <h4 className="text-base font-bold text-white">Evidence Delivered to HQ</h4>
            <p className="text-xs text-slate-300">
              Central Command Headquarters has received the forensic evidence record and SHA-256 hash.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-[#0d1626] border border-[#1e2d4a] rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Evidence Type:</span>
                <span className="text-white font-bold">{evidence.evidence_type}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>SHA-256 Hash:</span>
                <span className="text-cyan-400 truncate max-w-[200px]">
                  {evidence.checksum_sha256 || 'COMPUTED_HASH'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Timestamp:</span>
                <span className="text-slate-300">{new Date(evidence.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Urgency Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="ROUTINE">ROUTINE (Standard Archive)</option>
                <option value="IMPORTANT">IMPORTANT (Requires Review)</option>
                <option value="URGENT">URGENT (Suspect / Vehicle Match)</option>
                <option value="FLASH">FLASH (Active Pursuit / Breach)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Officer Notes / Ground Intelligence
              </label>
              <textarea
                rows={3}
                placeholder="Mention why this frame or clip requires HQ review, suspect behavior observed, or instructions needed..."
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none font-sans"
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
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'SENDING...' : 'TRANSMIT TO HQ'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
