import React, { useState, useEffect } from 'react';
import { Incident, IncidentAnalyticsSummary } from '../types/incident';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { useAuth } from '../context/AuthContext';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { LiveIncidentWorkspace } from '../components/incidents/LiveIncidentWorkspace';
import { IncidentReportModal } from '../components/incidents/IncidentReportModal';
import { IncidentReviewModal } from '../components/incidents/IncidentReviewModal';
import { IncidentClusterModal } from '../components/incidents/IncidentClusterModal';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Flame,
  Sparkles,
  Maximize2,
  Eye,
  ShieldCheck,
  Send,
  CheckSquare,
  Square,
  Volume2,
  Zap,
  ShieldAlert
} from 'lucide-react';

interface IncidentsPageProps {}

export const IncidentsPage: React.FC<IncidentsPageProps> = () => {
  const { user } = useAuth();
  const isHQCommand = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const userBop = user?.scope_id && user?.scope_id !== '*' ? user.scope_id : null;
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sopNotice, setSopNotice] = useState<string | null>(null);

  // SOP-Alpha Step-by-Step Tactical Checklist for Ground Commander
  const [sopSteps, setSopSteps] = useState([
    {
      id: 'step-1',
      number: 1,
      title: 'Visual Confirmation & Sensor Lock',
      desc: 'Verify PTZ optical and thermal camera feed. Confirm intruder presence vs false trigger (animal/shadow).',
      actionText: 'Confirm Sensor',
      type: 'verify',
      done: true
    },
    {
      id: 'step-2',
      number: 2,
      title: 'Checkpost Acoustic Siren & Loudspeaker Challenge',
      desc: 'Trigger perimeter acoustic warning siren and sound standard border challenge protocol.',
      actionText: 'Sound Siren',
      type: 'siren',
      done: false
    },
    {
      id: 'step-3',
      number: 3,
      title: 'Deploy Armed Sentry Quick Reaction Patrol',
      desc: 'Mobilize 2-man armed quick intercept sentry squad to coordinates along perimeter fence line.',
      actionText: 'Deploy Patrol',
      type: 'patrol',
      done: false
    },
    {
      id: 'step-4',
      number: 4,
      title: 'Transmit Cryptographic SITREP to Delhi HQ',
      desc: 'Send encrypted shift SITREP and sensor evidence directly to Central HQ War Room.',
      actionText: 'Transmit to HQ',
      type: 'sitrep',
      done: false
    },
    {
      id: 'step-5',
      number: 5,
      title: 'Seal Case Evidence & Restore Nominal Posture',
      desc: 'Archive SHA-256 evidence chain and restore standard zero-trust sentry watch posture.',
      actionText: 'Complete SOP',
      type: 'seal',
      done: false
    }
  ]);
  const [analytics, setAnalytics] = useState<IncidentAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs: 'all' | 'active' | 'resolved'
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  // Tactical Command Modals
  const [workspaceIncident, setWorkspaceIncident] = useState<Incident | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [clusterModalOpen, setClusterModalOpen] = useState(false);

  // SOP Action Handlers
  const handleToggleStep = (stepId: string) => {
    setSopSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s))
    );
  };

  const handleExecuteSopAction = async (step: typeof sopSteps[0]) => {
    if (step.type === 'siren') {
      alertSoundService.testAlarm();
      setSopSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: true } : s)));
      setSopNotice('SENTRY ACOUSTIC SIREN ACTIVATED. AUDIO CHALLENGE IN PROGRESS.');
      setTimeout(() => setSopNotice(null), 4000);
    } else if (step.type === 'patrol') {
      try {
        await incidentService.createIncident({
          title: `EMERGENCY SENTRY PATROL DEPLOYED - ${userBop || 'CHECKPOST'}`,
          description: `Checkpost sentry patrol dispatched to boundary fence per SOP-Alpha Step 3.`,
          priority: 'CRITICAL',
          incident_type: 'SECURITY',
          camera_id: 'POST-CAM-01',
          bop_site: userBop || 'Border Checkpost',
          zone_name: 'Perimeter Boundary Fence',
          risk_score: 95
        });
        setSopSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: true } : s)));
        setSopNotice('SENTRY QUICK PATROL MOBILIZED TO PERIMETER FENCE LINE.');
        setTimeout(() => setSopNotice(null), 4000);
        loadIncidents();
      } catch (e) {
        console.error('Failed to deploy patrol', e);
      }
    } else if (step.type === 'sitrep') {
      setSopSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: true } : s)));
      setSopNotice('SOP STEP 4: OPENING EVIDENCE & DISPATCH HUB TO TRANSMIT TO DELHI HQ...');
      setTimeout(() => {
        window.location.hash = '#evidence';
      }, 1200);
    } else if (step.type === 'verify') {
      setSopSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: true } : s)));
      setSopNotice('VISUAL CONFIRMATION LOGGED ON OPTICAL SENSOR.');
      setTimeout(() => setSopNotice(null), 3000);
    } else if (step.type === 'seal') {
      setSopSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: true } : s)));
      setSopNotice('SOP-ALPHA COMPLETED. EVIDENCE CHAIN SEALED.');
      setTimeout(() => setSopNotice(null), 4000);
    }
  };

  const handleExecuteRapidSOP = async () => {
    if (
      !window.confirm(
        `🚨 EXECUTE RAPID TACTICAL SOP PROTOCOL AT ${userBop || 'CHECKPOST'}?\n\nThis sounds the sentry siren, mobilizes patrol units, and prepares an emergency dispatch for Delhi HQ.`
      )
    ) {
      return;
    }

    alertSoundService.testAlarm();
    try {
      await incidentService.createIncident({
        title: `RAPID SOP-ALPHA PROTOCOL EXECUTED - ${userBop || 'CHECKPOST'}`,
        description: `Full tactical SOP-Alpha protocol initiated by Checkpost Commander. Ground sentries mobilized and boundary fence secured.`,
        priority: 'CRITICAL',
        incident_type: 'SECURITY',
        camera_id: 'POST-CAM-01',
        bop_site: userBop || 'Border Outpost',
        zone_name: 'Perimeter Sector Alpha',
        risk_score: 96
      });
      setSopSteps((prev) => prev.map((s) => ({ ...s, done: true })));
      setSopNotice(`SOP-ALPHA PROTOCOL EXECUTED. REDIRECTING TO EVIDENCE DISPATCH HUB...`);
      setTimeout(() => {
        setSopNotice(null);
        window.location.hash = '#evidence';
      }, 2000);
      loadIncidents();
    } catch (e) {
      console.error('Failed to execute rapid SOP', e);
    }
  };

  const handleBroadcastQRT = async () => {
    if (!window.confirm("BROADCAST NATIONAL QRT ALERT: Issue emergency Quick Reaction Team deployment order to Border Outposts?")) {
      return;
    }
    try {
      await incidentService.createIncident({
        title: "EMERGENCY NATIONAL QRT BROADCAST - CODE RED",
        description: "Immediate tactical mobilization commanded by Delhi HQ Central War Room. Quick Reaction Team (QRT) dispatched with SOP Bravo across active border sectors.",
        priority: "CRITICAL",
        incident_type: "SECURITY",
        camera_id: "HQ-WAR-ROOM",
        bop_site: "BOP Alpha",
        zone_name: "North Sector",
        risk_score: 98
      });
      alertSoundService.playAlarm('CRITICAL');
      loadIncidents();
    } catch (e) {
      console.error("Failed to broadcast QRT", e);
    }
  };

  useEffect(() => {
    loadIncidents();
    const handleRefresh = () => {
      loadIncidents();
    };
    window.addEventListener('ibvap:refresh-all', handleRefresh);
    window.addEventListener('ibvap:alert-received', handleRefresh);
    const interval = setInterval(loadIncidents, 5000);
    return () => {
      window.removeEventListener('ibvap:refresh-all', handleRefresh);
      window.removeEventListener('ibvap:alert-received', handleRefresh);
      clearInterval(interval);
    };
  }, [searchQuery, selectedStatus, selectedPriority]);

  const loadIncidents = async () => {
    try {
      const [incidentsData, analyticsData] = await Promise.all([
        incidentService.getIncidents({
          search: searchQuery || undefined,
          status: selectedStatus || undefined,
          priority: selectedPriority || undefined,
          limit: 100
        }),
        incidentService.getAnalyticsSummary().catch(() => null)
      ]);
      setIncidents(incidentsData);
      if (analyticsData) setAnalytics(analyticsData);

      // Keep workspace updated if active
      if (workspaceIncident) {
        const match = incidentsData.find((i) => i.incident_id === workspaceIncident.incident_id);
        if (match) setWorkspaceIncident(match);
      }
    } catch (e) {
      console.error('Failed to load incidents', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setDetailModalOpen(true);
  };

  const handleOpenWorkspace = (inc: Incident, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaceIncident(inc);
  };

  const activeIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED' && i.status !== 'FALSE_ALARM'
  );

  const resolvedIncidents = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED' || i.status === 'FALSE_ALARM'
  );

  const displayedIncidents = 
    activeTab === 'active' 
      ? activeIncidents 
      : activeTab === 'resolved' 
      ? resolvedIncidents 
      : incidents;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c1322] via-[#0f172a] to-[#0d131f] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {isHQCommand ? 'TACTICAL INCIDENT COMMAND & RESPONSE ORCHESTRATION' : `CHECKPOST INCIDENT SOP & SENTRY COMMAND • ${userBop || 'BOP'}`}
            </span>
            <span className="text-slate-400 font-mono text-xs">
              {isHQCommand ? '• MISSION CONTROL WORKSPACE' : '• FIELD TACTICAL WORKSPACE'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isHQCommand
                ? 'bg-purple-950/70 text-purple-300 border-purple-600/50'
                : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
            }`}>
              {isHQCommand ? '🏢 HQ WAR ROOM ORCHESTRATION' : '🪖 BOP FIELD SOP PLAYBOOK'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            {isHQCommand
              ? 'National Security Incident Directory & SOP Command'
              : `Checkpost Incident Response & Tactical SOP Execution // ${userBop || 'Field Outpost'}`}
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {isHQCommand
              ? 'Multi-camera correlation, SLA-driven escalation, automated standard operating response (SOP) playbooks with interactive checklists, situational awareness workspaces, and verified evidence dossiers.'
              : 'Field-level incident tracking, step-by-step SOP execution, post sentry mobilization, and direct SITREP dispatch to Delhi Central HQ War Room.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isHQCommand ? (
            <button
              onClick={handleBroadcastQRT}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-950/60 cursor-pointer animate-pulse"
              title="Broadcast Emergency QRT Mobilization to Border Outposts"
            >
              <Flame className="w-4 h-4" />
              <span>BROADCAST QRT</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleExecuteRapidSOP}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-950/60 cursor-pointer animate-pulse"
                title="Execute Rapid SOP Protocol (Siren + Patrol + Dispatch)"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>RAPID SOP EXECUTE</span>
              </button>

              <button
                onClick={() => {
                  window.location.hash = '#evidence';
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-cyan-950/60 cursor-pointer"
                title="Transmit Incident SITREP and Evidence to Delhi HQ"
              >
                <Send className="w-4 h-4" />
                <span>DISPATCH HUB →</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notice Toast */}
      {sopNotice && (
        <div className="p-3.5 bg-cyan-950/80 border border-cyan-500/60 rounded-xl text-xs font-mono text-cyan-200 flex items-center gap-2 shadow-xl animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span className="font-bold">{sopNotice}</span>
        </div>
      )}

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-cyan-400 font-bold">TOTAL INCIDENTS</span>
            <div className="text-2xl font-mono font-black text-cyan-400">
              {analytics?.total_incidents ?? incidents.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">ACTIVE / CRITICAL</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {analytics?.critical_incidents ?? activeIncidents.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">RESOLVED INCIDENTS</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {analytics?.resolved_incidents ?? resolvedIncidents.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 font-bold">FALSE ALARM RATE</span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {analytics?.false_alarm_rate_percent ?? 0}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Checkpost SOP-Alpha Operational Playbook Widget (Officer View) */}
      {!isHQCommand && (
        <div className="bg-[#111a2e] border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                  Tactical Incident SOP-Alpha Playbook // Ground Execution
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  STANDARD OPERATING PROCEDURE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive response protocol required for all boundary intrusion alarms. Check off steps as ground actions occur.
              </p>
            </div>

            {/* Progress Meter */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-cyan-400">
                  {sopSteps.filter((s) => s.done).length} / {sopSteps.length} STEPS COMPLETED
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {Math.round((sopSteps.filter((s) => s.done).length / sopSteps.length) * 100)}% Protocol Compliance
                </div>
              </div>
              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${(sopSteps.filter((s) => s.done).length / sopSteps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 5 Step Rows */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {sopSteps.map((step) => (
              <div
                key={step.id}
                onClick={() => handleToggleStep(step.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2.5 ${
                  step.done
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                    : 'bg-[#090d16] border-[#1e293b] hover:border-cyan-500/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      step.done
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      STEP 0{step.number}
                    </span>
                    {step.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  <h4 className={`text-xs font-bold font-mono ${step.done ? 'text-emerald-200' : 'text-slate-200'}`}>
                    {step.title}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    {step.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecuteSopAction(step);
                  }}
                  className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                    step.done
                      ? 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
                      : 'bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border-cyan-500/40'
                  }`}
                >
                  {step.type === 'siren' && <Volume2 className="w-3 h-3 text-amber-400" />}
                  {step.type === 'patrol' && <Zap className="w-3 h-3 text-rose-400" />}
                  {step.type === 'sitrep' && <Send className="w-3 h-3 text-cyan-400" />}
                  <span>{step.done ? 'COMPLETED ✓' : step.actionText}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL INCIDENTS ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-rose-950/50 text-rose-300 border border-rose-500/50 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
            ACTIVE THREATS ({activeIncidents.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'resolved'
                ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            RESOLVED ARCHIVE ({resolvedIncidents.length})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search incident title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESPONDING">Responding</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="FALSE_ALARM">False Alarm</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">🔴 Critical</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🟢 Low</option>
          </select>

          <button
            onClick={loadIncidents}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh Incidents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-4 py-3">INCIDENT ID</th>
                <th className="px-4 py-3">TITLE</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">PRIORITY / RISK</th>
                <th className="px-4 py-3">CAMERAS & SECTOR</th>
                <th className="px-4 py-3">SOP PLAYBOOK</th>
                <th className="px-4 py-3">ASSIGNED TO</th>
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {displayedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No incident records found matching criteria.
                  </td>
                </tr>
              ) : (
                displayedIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => handleOpenDetail(inc.incident_id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-bold text-white">
                      {inc.incident_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200 truncate max-w-xs">
                      {inc.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          inc.status === 'RESOLVED' || inc.status === 'CLOSED'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                            : inc.status === 'ESCALATED' || inc.priority === 'CRITICAL'
                            ? 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                            : inc.status === 'FALSE_ALARM'
                            ? 'bg-slate-900 text-slate-400 border-slate-700'
                            : 'bg-amber-950/70 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-bold">{inc.priority}</span>{' '}
                      <span className="text-slate-400">({inc.risk_score})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-cyan-400 font-bold">{inc.camera_id}</span>
                      {inc.related_cameras.length > 1 && (
                        <span className="text-slate-400 ml-1 text-[10px]">(+{inc.related_cameras.length - 1} linked)</span>
                      )}
                      <span className="text-slate-400 block text-[10px]">{inc.bop_site}</span>
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-bold">
                      {inc.playbook_id || 'PB-VIRTUAL-FENCE'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {inc.assigned_to || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(inc.incident_id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold transition shadow cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-400" />
                          SOP DOSSIER
                        </button>
                        <button
                          onClick={(e) => handleOpenWorkspace(inc, e)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition shadow cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3 text-cyan-400" />
                          WAR ROOM
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

      {/* Live Mission Control Workspace */}
      {workspaceIncident && (
        <LiveIncidentWorkspace
          incident={workspaceIncident}
          onRefresh={loadIncidents}
          onOpenReport={() => setReportModalOpen(true)}
          onOpenReview={() => setReviewModalOpen(true)}
          onOpenCluster={() => setClusterModalOpen(true)}
          onClose={() => setWorkspaceIncident(null)}
        />
      )}



      {/* Detail / SOP Modal */}
      <IncidentDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        incidentId={selectedIncidentId}
        onUpdated={loadIncidents}
      />

      <IncidentReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        incidentId={workspaceIncident?.incident_id || null}
      />

      <IncidentReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        incident={workspaceIncident}
        onUpdated={loadIncidents}
      />

      <IncidentClusterModal
        isOpen={clusterModalOpen}
        onClose={() => setClusterModalOpen(false)}
        currentIncidentId={workspaceIncident?.incident_id || ''}
        onUpdated={loadIncidents}
      />
    </div>
  );
};
