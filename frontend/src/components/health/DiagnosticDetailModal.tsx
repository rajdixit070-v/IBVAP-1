import React from 'react';
import { X, AlertOctagon, CheckCircle2, Activity } from 'lucide-react';
import { DiagnosticResultItem } from '../../types/health';

interface DiagnosticDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostic: DiagnosticResultItem | null;
}

export const DiagnosticDetailModal: React.FC<DiagnosticDetailModalProps> = ({
  isOpen,
  onClose,
  diagnostic
}) => {
  if (!isOpen || !diagnostic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0b1329]">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              diagnostic.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              diagnostic.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">{diagnostic.diagnostic_id}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                  diagnostic.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  diagnostic.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {diagnostic.severity}
                </span>
                <span className="text-xs font-mono text-slate-400">{diagnostic.event_type}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Correlated Infrastructure Self-Diagnostic Report</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* What Happened */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">What Happened?</h3>
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-200">
              {diagnostic.what_happened}
            </div>
          </div>

          {/* Affected Components */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Affected Components</h3>
            <div className="flex flex-wrap gap-2">
              {diagnostic.affected_components.map((comp, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono text-cyan-300"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>

          {/* Possible Root Cause Card */}
          <div className="p-4 bg-gradient-to-br from-indigo-950/40 to-slate-900/80 border border-indigo-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Possible Root Cause</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Diagnostic Confidence:</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs">
                  {diagnostic.confidence_percent}%
                </span>
              </div>
            </div>
            <p className="text-sm font-medium text-white pl-6">
              {diagnostic.possible_root_cause}
            </p>
            <p className="text-[11px] text-slate-400 pl-6 mt-1 italic">
              Decision Support Notice: This is an algorithmic correlation of multi-source telemetry, not a confirmed physical diagnosis.
            </p>
          </div>

          {/* Evidence Signals */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observed Evidence Signals</h3>
            <div className="space-y-2">
              {diagnostic.evidence_signals.map((sig, i) => (
                <div key={i} className="flex items-start space-x-2.5 p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Operational Actions */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommended Operational Actions</h3>
            <div className="space-y-2">
              {diagnostic.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                      rec.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                      rec.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="text-xs font-medium text-slate-200">{rec.recommendation}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">[{rec.action_type}]</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-[#0b1329]">
          <span className="text-[11px] text-slate-400">
            Detected: {new Date(diagnostic.detected_at).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
