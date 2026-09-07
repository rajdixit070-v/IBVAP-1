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
  Sparkles,
  Trash2,
  Info,
  ArrowLeft as BackIcon,
  Clock,
  HelpCircle
} from 'lucide-react';

interface BehaviourIntelligencePageProps {
  onBackToDashboard?: () => void;
}

export const BehaviourIntelligencePage: React.FC<BehaviourIntelligencePageProps> = ({ onBackToDashboard }) => {
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

  // Operational Guide Collapse State
  const [showGuide, setShowGuide] = useState(true);

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

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm(`Delete behaviour event '${eventId}'?`)) return;
    try {
      await behaviourService.deleteBehaviourEvent(eventId);
      setEvents(prev => prev.filter(e => e.event_id !== eventId));
      loadData();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleClearAllEvents = async () => {
    if (!window.confirm('Are you sure you want to delete and purge ALL behaviour anomaly records?')) return;
    try {
      await behaviourService.clearBehaviourEvents();
      setEvents([]);
      loadData();
    } catch (err) {
      console.error('Failed to clear events:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner with Return to Home Dashboard */}
      <div className="bg-gradient-to-r from-[#1c1938] via-[#111827] to-[#0d131f] border border-purple-500/30 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-mono font-bold border border-slate-700 transition cursor-pointer shrink-0 mr-1"
                title="Return to Home Dashboard"
              >
                <BackIcon className="w-3.5 h-3.5" />
                <span>← Return to Home Dashboard</span>
              </button>
            )}
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
            Kinematic feature extraction, statistical activity baselines, perimeter probing analysis, multi-signal threat correlation, explainable factor breakdowns, and graceful risk decay.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showGuide ? 'Hide Operational Guide' : 'How & When To Use?'}
          </button>
          <button
            onClick={() => setRulesModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-purple-900/40 cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            CONFIGURE BEHAVIOUR RULES
          </button>
        </div>
      </div>

      {/* Operational Guide Card (Hinglish + Military Explanations) */}
      {showGuide && (
        <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4.5 h-4.5 text-purple-400" />
              <span>Behaviour Rules Module: Iska Use Kaise Hoga Aur Kab Karein?</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              TACTICAL SOP GUIDE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Box 1: Kya Hai? */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
              <div className="font-bold text-purple-400 flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4" /> 1. Behaviour Rules Kya Hain?
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Ye AI engine target ki speed, direction aur thehraav (dwell) ko analyze karta hai. Agar koi person zero-line fence ke paas lamba samay bita raha hai ya baar-baar aage-peechhe ho raha hai, to wire cross hone se pehle hi alert generate hota hai.
              </p>
            </div>

            {/* Box 2: Kab Use Karein? */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> 2. Kab Aur Kahan Use Karein?
              </div>
              <ul className="text-slate-300 text-[11px] space-y-1 leading-relaxed list-disc list-inside">
                <li><strong>Night Curfew (22:00 - 05:00):</strong> No-go zero line sector me koi bhi shaq hone par.</li>
                <li><strong>Fence Probing:</strong> Jab target camera ke blindspot ya wire cutting ka rasta dhundh raha ho.</li>
                <li><strong>Sprint Burst:</strong> Checkpost barrier ke paas achanak tezi se bhagne par.</li>
              </ul>
            </div>

            {/* Box 3: Kaise Configure Karein? */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" /> 3. Sensitivity Kaise Set Karein?
              </div>
              <ul className="text-slate-300 text-[11px] space-y-1 leading-relaxed list-disc list-inside">
                <li><strong>Dwell (Seconds):</strong> Target kitne second ruka rahe (e.g. 20s).</li>
                <li><strong>Speed (m/s):</strong> Sprint speed threshold (e.g. 4.0 m/s = ~15 km/h).</li>
                <li><strong>Risk Weight:</strong> Threat score me kitne points add hon (e.g. +25 points).</li>
                <li><strong>Cooldown:</strong> Baar-baar fake alert se bachne ka wait time (e.g. 60s).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

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

      {/* Tabs & Search & Purge Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL BEHAVIOUR ANOMALIES ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('probing')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'probing'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            PERIMETER PROBING
          </button>
          <button
            onClick={() => setActiveTab('kinetics')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'kinetics'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            KINETIC SPRINT & ZIG-ZAG
          </button>
          <button
            onClick={() => setActiveTab('dwell')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'dwell'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            DWELL & LOITERING
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
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

          {events.length > 0 && (
            <button
              onClick={handleClearAllEvents}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-mono transition cursor-pointer"
              title="Purge all behaviour events"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
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
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No active behavioural anomaly events recorded. All surveillance sectors nominal.
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
                        className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        WHY THIS ALERT? ({evt.factors.length})
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenFeedback(evt)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition border border-slate-700 cursor-pointer"
                        >
                          FEEDBACK
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.event_id)}
                          className="p-1.5 hover:bg-red-900/60 text-slate-400 hover:text-red-300 border border-slate-700/60 rounded transition cursor-pointer"
                          title="Delete this event record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
