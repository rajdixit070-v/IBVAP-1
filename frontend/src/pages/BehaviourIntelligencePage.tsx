import React, { useState, useEffect } from 'react';
import {
  BehaviourEvent,
  BehaviourAnalyticsSummary
} from '../types/behaviour';
import { behaviourService } from '../services/behaviourService';
import { ExplainableRiskModal } from '../components/behaviour/ExplainableRiskModal';
import { BehaviourRulesConfigModal } from '../components/behaviour/BehaviourRulesConfigModal';
import { OperatorFeedbackModal } from '../components/behaviour/OperatorFeedbackModal';
import {
  BrainCircuit,
  Search,
  RefreshCw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Flame,
  TrendingDown,
  Sparkles
} from 'lucide-react';

export const BehaviourIntelligencePage: React.FC = () => {
  const [events, setEvents] = useState<BehaviourEvent[]>([]);
  const [analytics, setAnalytics] = useState<BehaviourAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'probing' | 'kinetics' | 'dwell'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<BehaviourEvent | null>(null);
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState<BehaviourEvent | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, selectedRiskLevel, activeTab]);

  const loadData = async () => {
    try {
      let eventTypeFilter: string | undefined = undefined;
      if (activeTab === 'probing') {
        eventTypeFilter = 'POTENTIAL_PERIMETER_PROBING_PATTERN';
      } else if (activeTab === 'kinetics') {
        eventTypeFilter = 'RAPID_DIRECTION_CHANGE';
      } else if (activeTab === 'dwell') {
        eventTypeFilter = 'VEHICLE_DWELL_ANOMALY';
      }

      const [eventsData, summaryData] = await Promise.all([
        behaviourService.getBehaviourEvents({
          search: searchQuery || undefined,
          risk_level: selectedRiskLevel || undefined,
          event_type: eventTypeFilter,
          limit: 100
        }),
        behaviourService.getAnalyticsSummary().catch(() => null)
      ]);
      setEvents(eventsData);
      if (summaryData) setAnalytics(summaryData);
    } catch (e) {
      console.error('Failed to load behaviour intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExplain = (evt: BehaviourEvent) => {
    setSelectedEvent(evt);
    setExplainModalOpen(true);
  };

  const handleOpenFeedback = (evt: BehaviourEvent) => {
    setFeedbackEvent(evt);
    setFeedbackModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c1938] via-[#111827] to-[#0d131f] border border-purple-500/30 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30 flex items-center gap-1">
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              TACTICAL BEHAVIOUR MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• EXPLAINABLE THREAT & RISK ENGINE</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Multi-Signal Behaviour Intelligence & Explainable Threat Console
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Kinematic feature extraction, statistical activity baselines, perimeter probing analysis, multi-signal threat correlation, explainable factor breakdowns, counter-signals, and graceful risk decay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRulesModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            BEHAVIOUR RULES
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">TOTAL BEHAVIOUR EVENTS</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {analytics?.total_behaviour_events ?? events.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">ELEVATED RISK EVENTS</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {analytics?.elevated_risk_events ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 font-bold">REPEATED APPROACHES</span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {analytics?.repeated_approaches_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">FALSE POSITIVE RATE</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {analytics?.false_positive_rate_percent ?? 0}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'all'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL BEHAVIOUR ANOMALIES ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('probing')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'probing'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            PERIMETER PROBING
          </button>
          <button
            onClick={() => setActiveTab('kinetics')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'kinetics'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            KINETIC OSCILLATIONS
          </button>
          <button
            onClick={() => setActiveTab('dwell')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'dwell'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            VEHICLE DWELL
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search event ID, type, camera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-xs"
          >
            <option value="">All Risk Levels</option>
            <option value="CRITICAL">🔴 Critical Risk</option>
            <option value="HIGH">🟠 High Risk</option>
            <option value="ELEVATED">🟡 Elevated Risk</option>
            <option value="GUARDED">🔵 Guarded</option>
            <option value="LOW">🟢 Low Risk</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Behaviour Events"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Behaviour Events Table */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-4 py-3">EVENT ID</th>
                <th className="px-4 py-3">ANOMALY TYPE</th>
                <th className="px-4 py-3">CAMERA // ZONE</th>
                <th className="px-4 py-3">RISK SCORE (DECAYED)</th>
                <th className="px-4 py-3">AI CONFIDENCE</th>
                <th className="px-4 py-3">EXPLAINABLE SIGNALS</th>
                <th className="px-4 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No behavioural anomaly events recorded.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-bold text-white">
                      {evt.event_id}
                    </td>
                    <td className="px-4 py-3 font-bold text-purple-300">
                      {evt.event_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sky-400 font-bold">{evt.camera_id}</span>
                      {evt.zone_name && (
                        <span className="text-slate-500 text-[11px] block">{evt.zone_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-black px-2 py-0.5 rounded text-[11px] border ${
                            evt.risk_level === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                              : evt.risk_level === 'HIGH'
                              ? 'bg-orange-950 text-orange-300 border-orange-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {evt.decayed_risk_score} / 100
                        </span>
                        {evt.decayed_risk_score < evt.risk_score && (
                          <span className="flex items-center text-emerald-400 text-[10px]">
                            <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-sky-400">
                      {Math.round(evt.confidence * 100)}%
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenExplain(evt)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold transition"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        WHY THIS ALERT? ({evt.factors.length})
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenFeedback(evt)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition border border-slate-700"
                      >
                        FEEDBACK
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ExplainableRiskModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        event={selectedEvent}
        onOpenFeedback={handleOpenFeedback}
      />

      <BehaviourRulesConfigModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        onUpdated={loadData}
      />

      <OperatorFeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        event={feedbackEvent}
        onSuccess={loadData}
      />
    </div>
  );
};
