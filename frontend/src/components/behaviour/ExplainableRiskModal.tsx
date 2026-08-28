import React from 'react';
import { Modal } from '../common/Modal';
import { BehaviourEvent } from '../../types/behaviour';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';

interface ExplainableRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: BehaviourEvent | null;
  onOpenFeedback?: (event: BehaviourEvent) => void;
}

export const ExplainableRiskModal: React.FC<ExplainableRiskModalProps> = ({
  isOpen,
  onClose,
  event,
  onOpenFeedback
}) => {
  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Explainable Threat Assessment // ${event.event_id}`}
      subtitle={`AI Assessment Reason Breakdown • ${event.event_type.replace(/_/g, ' ')}`}
      maxWidth="2xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {/* Score & Confidence Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#090d16] p-4 rounded-xl border border-rose-500/30 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">ACTIVE RISK SCORE</span>
            <div className="text-3xl font-black text-rose-400">
              {event.decayed_risk_score} <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                event.risk_level === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                  : event.risk_level === 'HIGH'
                  ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                  : 'bg-amber-950 text-amber-300 border-amber-500/50'
              }`}
            >
              {event.risk_level} RISK LEVEL
            </span>
          </div>

          <div className="bg-[#090d16] p-4 rounded-xl border border-sky-500/30 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">DETECTION CONFIDENCE</span>
            <div className="text-3xl font-black text-sky-400">
              {Math.round(event.confidence * 100)}%
            </div>
            <span className="text-[10px] text-slate-400 block">AI Observation Certainty</span>
          </div>

          <div className="bg-[#090d16] p-4 rounded-xl border border-slate-800 text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">ORIGINAL PEAK RISK</span>
            <div className="text-3xl font-black text-slate-300">{event.risk_score}</div>
            <div className="text-[10px] text-emerald-400 flex items-center justify-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Graceful Decay Active</span>
            </div>
          </div>
        </div>

        {/* Why This Alert? Positive Contributing Factors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Why This Alert? Contributing Threat Signals ({event.factors.length})</span>
          </div>

          <div className="space-y-2">
            {event.factors.length === 0 ? (
              <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 text-slate-500">
                No acute threat factors registered.
              </div>
            ) : (
              event.factors.map((f, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#131b2e] border border-rose-500/20 rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-white font-bold text-xs">{f.factor.replace(/_/g, ' ')}</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">{f.description}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black text-xs shrink-0 border border-rose-500/30">
                    +{f.weight} PTS
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mitigating Counter-Signals */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Mitigating Evidence & Counter-Signals ({event.counter_factors.length})</span>
          </div>

          <div className="space-y-2">
            {event.counter_factors.length === 0 ? (
              <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 text-slate-500">
                No mitigating counter-signals present.
              </div>
            ) : (
              event.counter_factors.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#091a1a] border border-emerald-500/20 rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-emerald-300 font-bold text-xs">{c.signal.replace(/_/g, ' ')}</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">{c.description}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-xs shrink-0 border border-emerald-500/30">
                    -{c.mitigation} PTS
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-500">
            Detected: {new Date(event.created_at).toLocaleString()}
          </span>

          <div className="flex items-center gap-2">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFeedback(event);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition border border-slate-700"
              >
                OPERATOR FEEDBACK
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-lg"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
