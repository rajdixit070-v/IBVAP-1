import React, { useState, useEffect } from 'react';
import {
  Send,
  Radio,
  Clock,
  UserCheck,
  CheckCircle2,
  FileText,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

import { dispatchService } from '../../services/dispatchService';
import { BOPDispatch } from '../../types/dispatch';
import { useAuth } from '../../context/AuthContext';
import { DispatchSitrepModal } from './DispatchSitrepModal';

export const HQDispatchesSitrepPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const [dispatches, setDispatches] = useState<BOPDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sitrepModalOpen, setSitrepModalOpen] = useState(false);
  const [selectedBopFilter, setSelectedBopFilter] = useState<string>('ALL');

  // Acknowledging state
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [directiveText, setDirectiveText] = useState<string>('');
  const [submittingAck, setSubmittingAck] = useState(false);

  useEffect(() => {
    loadDispatches();
    const interval = setInterval(loadDispatches, 8000);
    return () => clearInterval(interval);
  }, [selectedBopFilter]);

  const loadDispatches = async () => {
    try {
      const data = await dispatchService.listDispatches({
        bop_id: selectedBopFilter === 'ALL' ? undefined : selectedBopFilter
      });
      setDispatches(data || []);
    } catch (e) {
      console.error('Failed to load dispatches', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (dispatchId: string) => {
    if (!directiveText.trim()) return;
    setSubmittingAck(true);
    try {
      await dispatchService.acknowledgeDispatch(dispatchId, directiveText.trim());
      setAcknowledgingId(null);
      setDirectiveText('');
      loadDispatches();
    } catch (e) {
      console.error('Failed to acknowledge dispatch', e);
    } finally {
      setSubmittingAck(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'FLASH':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'URGENT':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'IMPORTANT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  return (
    <div className="bg-[#0b1320] border border-[#1e293b] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>{isSuperAdmin ? 'Inbound Outpost Dispatches & Daily SITREPs' : 'Outpost Command Transmission Log'}</span>
              <span className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-full text-[10px] font-mono">
                {dispatches.length} REPORTS
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {isSuperAdmin
                ? 'Central Headquarters Situation Room • Multi-BOP Dispatches'
                : `Duty Post: ${user?.scope_id || 'BOP-ALPHA'} • Direct Uplink to HQ Admin`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isSuperAdmin && (
            <select
              value={selectedBopFilter}
              onChange={(e) => setSelectedBopFilter(e.target.value)}
              className="bg-[#0d1626] border border-[#1e2d4a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="ALL">All Outposts (Federated)</option>
              <option value="BOP-ALPHA">BOP Alpha</option>
              <option value="BOP-BRAVO">BOP Bravo</option>
              <option value="BOP-CHARLIE">BOP Charlie</option>
            </select>
          )}

          {!isSuperAdmin && (
            <button
              onClick={() => setSitrepModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-600/30 transition cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>+ TRANSMIT SITREP</span>
            </button>
          )}

          <button
            onClick={loadDispatches}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Refresh SITREPs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {dispatches.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No situation reports dispatched yet today.</p>
          {!isSuperAdmin ? (
            <button
              onClick={() => setSitrepModalOpen(true)}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Click here to transmit first shift SITREP to HQ
            </button>
          ) : (
            <p className="text-xs text-slate-500 font-mono">
              Awaiting incoming field SITREPs from border checkposts.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {dispatches.slice(0, compact ? 4 : 50).map((disp) => {
            const isAcknowledged = disp.status === 'ACKNOWLEDGED_BY_HQ' || disp.status === 'ACTIONED';
            const isThisAcknowledging = acknowledgingId === disp.dispatch_id;

            return (
              <div
                key={disp.dispatch_id}
                className="p-3.5 bg-[#0d1626]/80 border border-[#1e2d4a] rounded-xl hover:border-slate-700 transition space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px] font-mono font-bold">
                      {disp.bop_id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getPriorityBadge(disp.priority)}`}>
                      {disp.priority}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-[280px]">
                      {disp.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(disp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-bold">@{disp.officer_username}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60">
                  {disp.summary}
                </p>

                {/* Metrics Bar */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Suspects: <b className="text-amber-400">{disp.detected_persons_count}</b>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Vehicles: <b className="text-sky-400">{disp.vehicles_scanned_count}</b>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Alerts: <b className="text-rose-400">{disp.alerts_count}</b>
                  </span>

                  {disp.evidence_items && disp.evidence_items.length > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-300 rounded border border-emerald-700/60 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{disp.evidence_items.length} Evidence Records Attached</span>
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {isAcknowledged ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ACKNOWLEDGED BY HQ ({disp.acknowledged_by})</span>
                      </span>
                    ) : isSuperAdmin ? (
                      <button
                        onClick={() => {
                          setAcknowledgingId(isThisAcknowledging ? null : disp.dispatch_id);
                          setDirectiveText('Directives issued: Heighten watchtower surveillance and verify sector boundary.');
                        }}
                        className="px-2.5 py-1 bg-indigo-600/40 hover:bg-indigo-600/70 text-indigo-200 border border-indigo-500/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>ACKNOWLEDGE & ISSUE DIRECTIVE</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>AWAITING HQ REVIEW</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* HQ Directives Box */}
                {disp.hq_notes && (
                  <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs space-y-1">
                    <div className="text-[10px] font-mono font-bold text-indigo-300 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-indigo-400" />
                      <span>HQ COMMAND DIRECTIVE ({disp.acknowledged_by} @ {new Date(disp.acknowledged_at || '').toLocaleTimeString()}):</span>
                    </div>
                    <p className="text-indigo-100 font-sans">{disp.hq_notes}</p>
                  </div>
                )}

                {/* Inline Acknowledgment Form for Super Admin */}
                {isThisAcknowledging && (
                  <div className="p-3 bg-slate-900 border border-indigo-500/50 rounded-xl space-y-2 animate-fade-in">
                    <label className="block text-[11px] font-semibold text-indigo-300">
                      Issue Headquarters Operational Directive to Outpost:
                    </label>
                    <textarea
                      rows={2}
                      value={directiveText}
                      onChange={(e) => setDirectiveText(e.target.value)}
                      className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setAcknowledgingId(null)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAcknowledge(disp.dispatch_id)}
                        disabled={submittingAck}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold font-mono"
                      >
                        {submittingAck ? 'SUBMITTING...' : 'TRANSMIT DIRECTIVE TO POST'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Daily SITREP Submission Modal */}
      <DispatchSitrepModal
        isOpen={sitrepModalOpen}
        onClose={() => setSitrepModalOpen(false)}
        onSuccess={loadDispatches}
      />
    </div>
  );
};
