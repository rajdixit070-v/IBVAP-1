import React, { useState, useEffect } from 'react';
import {
  BehaviourEvent
} from '../types/behaviour';
import { behaviourService } from '../services/behaviourService';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { useAuth } from '../context/AuthContext';
import { ExplainableRiskModal } from '../components/behaviour/ExplainableRiskModal';
import { BehaviourRulesConfigModal } from '../components/behaviour/BehaviourRulesConfigModal';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
import {
  BrainCircuit,
  Search,
  RefreshCw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Trash2,
  Volume2,
  Send,
  Users,
  CheckCircle2,
  Play,
  Info
} from 'lucide-react';

export const BehaviourIntelligencePage: React.FC = () => {
  const { user } = useAuth();
  const userBop = user?.scope_id || '';

  const [events, setEvents] = useState<BehaviourEvent[]>([]);
  const [allEvents, setAllEvents] = useState<BehaviourEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // 5 Tactical Border Threat Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'probing' | 'dwell' | 'kinetics' | 'curfew'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');

  // Sentry Action Notices
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [hornActive, setHornActive] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<BehaviourEvent | null>(null);
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // SITREP Dispatch Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState('URGENT');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, selectedRiskLevel, activeTab]);

  const loadData = async () => {
    try {
      let eventTypeFilter: string | undefined = undefined;
      if (activeTab === 'probing') {
        eventTypeFilter = 'POTENTIAL_PERIMETER_PROBING_PATTERN,REPEATED_APPROACH,FENCE_EDGE_MOVEMENT';
      } else if (activeTab === 'dwell') {
        eventTypeFilter = 'VEHICLE_DWELL_ANOMALY,REPEATED_VEHICLE_VISIT,POTENTIAL_ABANDONED_OBJECT';
      } else if (activeTab === 'kinetics') {
        eventTypeFilter = 'SUDDEN_SPEED_CHANGE,RAPID_DIRECTION_CHANGE,DIRECTION_ANOMALY';
      } else if (activeTab === 'curfew') {
        eventTypeFilter = 'AFTER_HOURS_ACTIVITY,NIGHT_CURFEW_BREACH,BASELINE_ACTIVITY_ANOMALY';
      }

      const [eventsData, allEventsData] = await Promise.all([
        behaviourService.getBehaviourEvents({
          risk_level: selectedRiskLevel || undefined,
          event_type: eventTypeFilter,
          limit: 100
        }),
        behaviourService.getBehaviourEvents({ limit: 150 })
      ]);

      setEvents(eventsData);
      setAllEvents(allEventsData);
    } catch (e) {
      console.error('Failed to load behaviour intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  // Category Counts from Master Feed
  const probingCount = allEvents.filter(e =>
    ['POTENTIAL_PERIMETER_PROBING_PATTERN', 'REPEATED_APPROACH', 'FENCE_EDGE_MOVEMENT'].includes(e.event_type)
  ).length;

  const dwellCount = allEvents.filter(e =>
    ['VEHICLE_DWELL_ANOMALY', 'REPEATED_VEHICLE_VISIT', 'POTENTIAL_ABANDONED_OBJECT'].includes(e.event_type)
  ).length;

  const kineticsCount = allEvents.filter(e =>
    ['SUDDEN_SPEED_CHANGE', 'RAPID_DIRECTION_CHANGE', 'DIRECTION_ANOMALY'].includes(e.event_type)
  ).length;

  const curfewCount = allEvents.filter(e =>
    ['AFTER_HOURS_ACTIVITY', 'NIGHT_CURFEW_BREACH', 'BASELINE_ACTIVITY_ANOMALY'].includes(e.event_type)
  ).length;

  const handleOpenExplain = (evt: BehaviourEvent) => {
    setSelectedEvent(evt);
    setExplainModalOpen(true);
  };

  // Field Action 1: Trigger Checkpost Fence Warning Horn
  const handleTriggerFenceHorn = () => {
    setHornActive(true);
    alertSoundService.playAlarm('CRITICAL');
    alertSoundService.speakVoiceAlert('Attention. You are approaching the international boundary restricted zone. Halt and retreat immediately.');
    setActionNotice('Boundary Warning Acoustic Horn Triggered!');
    setTimeout(() => {
      setHornActive(false);
      setActionNotice(null);
    }, 4000);
  };

  // Field Action 2: Mobilize 2-Man Sentry Patrol Team
  const handleDeploySentryPatrol = async (evt?: BehaviourEvent) => {
    try {
      alertSoundService.playAlarm('HIGH');
      alertSoundService.speakVoiceAlert('Two-man sentry reaction patrol dispatched to checkpost boundary sector.');

      const camId = evt?.camera_id || 'BOP-WAGAH-CAM-01';
      const threatType = evt?.event_type || 'FENCE_LOITERING_ANOMALY';
      const riskScore = evt?.risk_score || 80;

      await incidentService.createIncident({
        title: `🛡️ SENTRY PATROL: Intercept ${threatType} at ${userBop || 'BOP Sector'}`,
        description: `Commander deployed 2-man armed sentry team to intercept suspicious behaviour on camera ${camId}. Ground risk score: ${riskScore}. SOP-Alpha activated.`,
        priority: riskScore >= 80 ? 'CRITICAL' : 'HIGH',
        incident_type: 'SECURITY',
        camera_id: camId,
        bop_site: userBop || 'BOP-WAGAH',
        risk_score: riskScore
      });

      setActionNotice('2-Man Armed Sentry Patrol Deployed & Incident Logged!');
      setTimeout(() => setActionNotice(null), 5000);
      loadData();
    } catch (e) {
      console.error('Failed to deploy sentry patrol', e);
    }
  };

  // Field Action 3: Transmit Threat to Central HQ
  const handleDispatchBehaviourAlert = (evt?: BehaviourEvent) => {
    const threatName = evt?.event_type || 'SUSPICIOUS_BEHAVIOUR_PATTERN';
    const riskLevel = evt?.risk_level || 'ELEVATED';
    const camId = evt?.camera_id || 'SECTOR-CAM';
    const postName = userBop || 'CHECKPOST';

    setDispatchTitle(`🚨 BEHAVIOUR THREAT: ${threatName} (${postName})`);
    setDispatchSummary(
      `Suspicious ground pattern '${threatName}' detected at ${postName} on camera ${camId}. Risk Level: ${riskLevel} (${evt?.risk_score || 75}/100). Sentry patrol notified.`
    );
    setDispatchPriority(riskLevel === 'CRITICAL' ? 'FLASH_CRITICAL' : 'URGENT');
    setDispatchModalOpen(true);
  };

  // Field Action 4: Simulate / Test Threat Anomaly On-Demand
  const handleSimulateThreat = async () => {
    setSimulating(true);
    try {
      const cat = activeTab === 'all' ? 'probing' : activeTab;
      const newEv = await behaviourService.simulateBehaviourEvent({
        category: cat,
        camera_id: 'BOP-WAGAH-CAM-01',
        zone_name: cat === 'probing' ? 'Zero-Line Boundary Wire' : cat === 'dwell' ? 'Checkpost Gate Boom Barrier' : cat === 'kinetics' ? 'Perimeter Restricted Zone' : 'Zero-Line Nocturnal Sector'
      });

      alertSoundService.playAlarm('CRITICAL');
      alertSoundService.speakVoiceAlert(`Simulated threat anomaly recorded: ${newEv.event_type.replace(/_/g, ' ')}.`);
      setActionNotice(`New Anomaly Generated: ${newEv.event_type.replace(/_/g, ' ')} (${newEv.risk_score} pts)!`);
      setTimeout(() => setActionNotice(null), 5000);
      loadData();
    } catch (e) {
      console.error('Failed to simulate threat anomaly', e);
    } finally {
      setSimulating(false);
    }
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner with Sentry Ground Actions */}
      <div className="bg-gradient-to-r from-[#1c1938] via-[#111827] to-[#0d131f] border border-purple-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30 flex items-center gap-1">
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              TACTICAL BEHAVIOUR MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">
              • {userBop || 'CHECKPOST SECTOR'} • GROUND THREAT PATTERNS & SENTRY ALARMS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Tactical Ground Behaviour & Sentry Response Console
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Automated detection of border fence probing, stationary gate dwell, high-speed sprint bursts, and curfew violations. Issue acoustic warnings across the wire, mobilize sentry patrols, and dispatch SITREPs to Delhi Central HQ.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Action: Simulate Anomaly */}
          <button
            onClick={handleSimulateThreat}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            title="Generate a realistic test anomaly in the current tab category"
          >
            <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
            <span>{simulating ? 'GENERATING...' : 'SIMULATE THREAT'}</span>
          </button>

          {/* Action: Fence Warning Horn */}
          <button
            onClick={handleTriggerFenceHorn}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
              hornActive
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/50 animate-pulse'
                : 'bg-[#151c30] hover:bg-[#1c2744] text-amber-300 border-amber-500/40'
            }`}
            title="Trigger audible warning across the fence line"
          >
            <Volume2 className="w-4 h-4" />
            <span>{hornActive ? 'HORN SOUNDING...' : 'SOUND FENCE HORN'}</span>
          </button>

          {/* Action: Deploy Sentry Patrol */}
          <button
            onClick={() => handleDeploySentryPatrol()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-sky-600/20 cursor-pointer"
            title="Dispatch 2-man armed sentry team"
          >
            <Users className="w-4 h-4" />
            <span>DEPLOY SENTRY PATROL</span>
          </button>

          {/* Action: Dispatch to HQ */}
          <button
            onClick={() => handleDispatchBehaviourAlert()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-purple-600/20 cursor-pointer"
            title="Transmit behaviour threat report to Central HQ"
          >
            <Send className="w-3.5 h-3.5" />
            <span>DISPATCH TO HQ</span>
          </button>

          {/* Configure Rules */}
          <button
            onClick={() => setRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold border border-slate-700 transition cursor-pointer"
            title="Adjust threshold settings"
          >
            <Sliders className="w-4 h-4" />
            <span>RULES</span>
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="p-4 bg-sky-950/80 border border-sky-500/50 rounded-2xl flex items-center justify-between text-sky-300 font-mono text-xs shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
            <span className="font-bold">{actionNotice}</span>
          </div>
          <span className="text-[10px] bg-sky-900/60 px-2 py-0.5 rounded border border-sky-500/40">
            SYSTEM NOTIFIED
          </span>
        </div>
      )}

      {/* 4 Interactive Threat Rule Cards (Clicking switches tab immediately) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rule 1: Fence Loitering */}
        <div
          onClick={() => setActiveTab('probing')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeTab === 'probing'
              ? 'bg-rose-950/50 border-rose-500 shadow-lg shadow-rose-950/50'
              : 'bg-[#111a2e] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400">1. FENCE PROBING</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {probingCount} Active
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1">Wire Loitering &gt; 30s</p>
          <span className="text-[11px] text-slate-400 block mt-0.5">Target lingering near border wire</span>
        </div>

        {/* Rule 2: Gate Barrier Dwell */}
        <div
          onClick={() => setActiveTab('dwell')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeTab === 'dwell'
              ? 'bg-amber-950/50 border-amber-500 shadow-lg shadow-amber-950/50'
              : 'bg-[#111a2e] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-amber-400">2. BARRIER DWELL</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {dwellCount} Active
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1">Stationary Vehicle &gt; 60s</p>
          <span className="text-[11px] text-slate-400 block mt-0.5">Idling vehicle on checkpost gate</span>
        </div>

        {/* Rule 3: Sprint Infiltration */}
        <div
          onClick={() => setActiveTab('kinetics')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeTab === 'kinetics'
              ? 'bg-sky-950/50 border-sky-500 shadow-lg shadow-sky-950/50'
              : 'bg-[#111a2e] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-sky-400">3. SPRINT BURST</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {kineticsCount} Active
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1">Speed Burst &gt; 4.0 m/s</p>
          <span className="text-[11px] text-slate-400 block mt-0.5">Rapid dash towards international line</span>
        </div>

        {/* Rule 4: Night Curfew */}
        <div
          onClick={() => setActiveTab('curfew')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeTab === 'curfew'
              ? 'bg-purple-950/50 border-purple-500 shadow-lg shadow-purple-950/50'
              : 'bg-[#111a2e] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-400">4. NIGHT CURFEW</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {curfewCount} Active
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1">Hours: 22:00 - 05:00</p>
          <span className="text-[11px] text-slate-400 block mt-0.5">Unauthorized nocturnal perimeter activity</span>
        </div>
      </div>

      {/* Metrics Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">TOTAL ANOMALIES</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {allEvents.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">ELEVATED / CRITICAL</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {allEvents.filter(e => e.risk_score >= 80).length}
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
              {allEvents.filter(e => e.event_type.includes('REPEATED') || e.event_type.includes('PROBING')).length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">SOP COMPLIANCE</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              100%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 5 Tactical Navigation Tabs Bar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL ANOMALIES ({allEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('probing')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'probing'
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            FENCE PROBING ({probingCount})
          </button>
          <button
            onClick={() => setActiveTab('dwell')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'dwell'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            BARRIER DWELL ({dwellCount})
          </button>
          <button
            onClick={() => setActiveTab('kinetics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'kinetics'
                ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            SPRINT BURSTS ({kineticsCount})
          </button>
          <button
            onClick={() => setActiveTab('curfew')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'curfew'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            NIGHT CURFEW ({curfewCount})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search threat event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
          >
            <option value="">All Risk Levels</option>
            <option value="CRITICAL">🔴 Critical Risk</option>
            <option value="HIGH">🟠 High Risk</option>
            <option value="ELEVATED">🟡 Elevated Risk</option>
            <option value="LOW">🟢 Low Risk</option>
          </select>

          {allEvents.length > 0 && (
            <button
              onClick={handleClearAllEvents}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg border border-rose-500/30 transition text-xs font-mono font-bold cursor-pointer"
              title="Purge all behaviour anomaly records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              PURGE
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh Behaviour Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Tab Operational Sub-Header */}
      <div className="p-3 bg-[#0d1322] border border-[#1e293b] rounded-xl flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          <span className="text-slate-300">
            {activeTab === 'probing' && 'CURRENT VIEW: FENCE PROBING & RECONNAISSANCE PATTERNS (LINGERING WITHIN 5M > 30S)'}
            {activeTab === 'dwell' && 'CURRENT VIEW: CHECKPOST GATE & BOOM BARRIER DWELL (STATIONARY VEHICLE/PACKAGE > 60S)'}
            {activeTab === 'kinetics' && 'CURRENT VIEW: KINETIC ACCELERATION BURSTS & EVASIVE ZIGZAG (SPEED > 4.0 M/S)'}
            {activeTab === 'curfew' && 'CURRENT VIEW: NIGHT NO-GO CURFEW VIOLATIONS (RESTRICTED HOURS: 2200 TO 0500 HRS)'}
            {activeTab === 'all' && 'CURRENT VIEW: COMPREHENSIVE TACTICAL GROUND ANOMALIES FEED (ALL MONITORED THREATS)'}
          </span>
        </div>
        <span className="text-slate-500">
          Showing {events.length} of {allEvents.length} records
        </span>
      </div>

      {/* Events Table with Action Triggers */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-4 py-3">RISK SCORE</th>
                <th className="px-4 py-3">ANOMALY TYPE</th>
                <th className="px-4 py-3">CAMERA & SECTOR</th>
                <th className="px-4 py-3">TARGET</th>
                <th className="px-4 py-3">THREAT FACTORS</th>
                <th className="px-4 py-3">TIME</th>
                <th className="px-4 py-3 text-right">SENTRY ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="space-y-2">
                      <BrainCircuit className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                      <p>No behaviour anomalies found matching the current tab criteria.</p>
                      <p className="text-[11px] text-slate-600">
                        Click "SIMULATE THREAT" above to test automated sentry threat detection in this category.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded border ${
                            evt.risk_score >= 90
                              ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                              : evt.risk_score >= 80
                              ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                              : evt.risk_score >= 60
                              ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          {evt.risk_score}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">{evt.risk_level}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-white block">{evt.event_type.replace(/_/g, ' ')}</span>
                      {evt.zone_name && (
                        <span className="text-[10px] text-slate-400">Zone: {evt.zone_name}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sky-400 font-bold">{evt.camera_id}</span>
                      <span className="text-slate-500 block text-[10px]">{userBop || 'Sector'}</span>
                    </td>

                    <td className="px-4 py-3 uppercase text-slate-300">
                      {evt.object_type} • #{evt.local_track_id || evt.id}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(evt.factors || []).slice(0, 2).map((f: any, fIdx) => {
                          const factorStr = typeof f === 'string' ? f : (f?.factor || f?.description || 'Threat Factor');
                          return (
                            <span
                              key={fIdx}
                              className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 text-[10px]"
                            >
                              {factorStr.replace(/_/g, ' ')}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDeploySentryPatrol(evt)}
                          className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Deploy sentries to intercept"
                        >
                          <Users className="w-3 h-3" />
                          Patrol
                        </button>
                        <button
                          onClick={() => handleDispatchBehaviourAlert(evt)}
                          className="p-1 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded transition border border-transparent hover:border-purple-500/30 cursor-pointer"
                          title="Transmit threat to Central HQ"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenExplain(evt)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition cursor-pointer"
                          title="Explain threat breakdown"
                        >
                          Explain
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.event_id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Delete event"
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

      {/* Explainable Threat Modal */}
      {selectedEvent && (
        <ExplainableRiskModal
          isOpen={explainModalOpen}
          onClose={() => setExplainModalOpen(false)}
          event={selectedEvent}
        />
      )}

      {/* Rules Configuration Modal */}
      <BehaviourRulesConfigModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        onUpdated={loadData}
      />

      {/* SITREP Behaviour Alert Dispatch Modal */}
      <DispatchSitrepModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={() => setDispatchModalOpen(false)}
        initialTitle={dispatchTitle}
        initialSummary={dispatchSummary}
        initialPriority={dispatchPriority}
      />
    </div>
  );
};
