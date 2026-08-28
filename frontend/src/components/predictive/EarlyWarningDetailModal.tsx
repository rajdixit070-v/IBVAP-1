import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { EarlyWarning } from '../../types/predictive';
import { predictiveService } from '../../services/predictiveService';
import {
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface EarlyWarningDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  warning: EarlyWarning | null;
  onUpdated: () => void;
}

export const EarlyWarningDetailModal: React.FC<EarlyWarningDetailModalProps> = ({
  isOpen,
  onClose,
  warning,
  onUpdated
}) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!warning) return null;

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      await predictiveService.acknowledgeWarning(warning.warning_id, 'operator');
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to acknowledge warning', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setSubmitting(true);
    try {
      await predictiveService.dismissWarning(warning.warning_id, notes || 'Operator dismissed', 'operator');
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to dismiss warning', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Early Warning Assessment // ${warning.warning_id}`}
      subtitle={`Predictive Anomaly Forecast • ${warning.zone_name || warning.camera_id}`}
      maxWidth="2xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#090d16] p-4 rounded-xl border border-amber-500/30 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">FORECAST RISK SCORE</span>
            <div className="text-3xl font-black text-amber-400">
              {warning.forecast_risk_score} <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                warning.warning_level === 'HIGH'
                  ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                  : warning.warning_level === 'ELEVATED'
                  ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                  : 'bg-amber-950 text-amber-300 border-amber-500/50'
              }`}
            >
              {warning.warning_level} SEVERITY
            </span>
          </div>

          <div className="bg-[#090d16] p-4 rounded-xl border border-sky-500/30 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">FORECAST CONFIDENCE</span>
            <div className="text-3xl font-black text-sky-400">
              {Math.round(warning.confidence * 100)}%
            </div>
            <span className="text-[10px] text-slate-400 block">Data Quality: {Math.round(warning.data_quality_score * 100)}%</span>
          </div>

          <div className="bg-[#090d16] p-4 rounded-xl border border-slate-800 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">ACTIVITY DEVIATION</span>
            <div className="text-3xl font-black text-white">
              +{warning.deviation_percent.toFixed(0)}%
            </div>
            <div className="text-[10px] text-amber-400 flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{warning.current_activity_count} / {warning.baseline_expected_count.toFixed(1)} baseline</span>
            </div>
          </div>
        </div>

        {/* Why this early warning? */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Why This Early Warning? Contributing Drivers ({warning.reasons.length})</span>
          </div>

          <div className="space-y-2">
            {warning.reasons.map((r, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#171424] border border-amber-500/20 rounded-xl space-y-0.5"
              >
                <div className="text-amber-300 font-bold text-xs">{r.driver.replace(/_/g, ' ')}</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">{r.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Counter-signals */}
        {warning.counter_signals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Mitigating Counter-Signals ({warning.counter_signals.length})</span>
            </div>

            <div className="space-y-2">
              {warning.counter_signals.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#091a1a] border border-emerald-500/20 rounded-xl space-y-0.5"
                >
                  <div className="text-emerald-300 font-bold text-xs">{c.signal.replace(/_/g, ' ')}</div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">{c.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operator Notes / Dismissal */}
        {warning.lifecycle_status === 'ACTIVE' && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="block text-[11px] text-slate-400">Operator Review Notes</label>
            <input
              type="text"
              placeholder="e.g. Dispatched local patrol to verify boundary..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-[#090d16] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-500">
            Expires: {new Date(warning.expires_at).toLocaleTimeString()}
          </span>

          <div className="flex items-center gap-2">
            {warning.lifecycle_status === 'ACTIVE' && (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDismiss}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-bold transition border border-rose-500/30"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  DISMISS
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleAcknowledge}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-lg text-xs transition shadow-lg"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  ACKNOWLEDGE
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
