import React, { useState, useEffect } from 'react';
import { Incident, IncidentAnalyticsSummary } from '../types/incident';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { useAuth } from '../context/AuthContext';
import { CreateIncidentModal } from '../components/incidents/CreateIncidentModal';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { LiveIncidentWorkspace } from '../components/incidents/LiveIncidentWorkspace';
import { IncidentReportModal } from '../components/incidents/IncidentReportModal';
import { IncidentReviewModal } from '../components/incidents/IncidentReviewModal';
import { IncidentClusterModal } from '../components/incidents/IncidentClusterModal';
import {
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Flame,
  Sparkles,
  Maximize2,
  Trash2,
  ArrowLeft
} from 'lucide-react';

interface IncidentsPageProps {
  onBackToDashboard?: () => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ onBackToDashboard }) => {
  const { user } = useAuth();
  const isHQCommand = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [analytics, setAnalytics] = useState<IncidentAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'my_queue' | 'analytics'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  // Tactical Command Modals
  const [workspaceIncident, setWorkspaceIncident] = useState<Incident | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [clusterModalOpen, setClusterModalOpen] = useState(false);

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
    const interval = setInterval(loadIncidents, 5000);
    return () => clearInterval(interval);
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

  const handleDeleteIncident = async (e: React.MouseEvent, incidentId: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete incident '${incidentId}'?`)) {
      try {
        await incidentService.deleteIncident(incidentId);
        setIncidents((prev) => prev.filter((item) => item.incident_id !== incidentId));
        if (selectedIncidentId === incidentId) {
          setDetailModalOpen(false);
          setSelectedIncidentId(null);
        }
        if (workspaceIncident?.incident_id === incidentId) {
          setWorkspaceIncident(null);
        }
      } catch (err) {
        console.error('Failed to delete incident', err);
      }
    }
  };

  const handleClearAllIncidents = async () => {
    if (window.confirm('Are you sure you want to delete all operational incidents from the database?')) {
      try {
        await incidentService.clearAllIncidents();
        loadIncidents();
      } catch (err) {
        console.error('Failed to clear all incidents', err);
      }
    }
  };

  const myIncidents = incidents.filter(
    (i) => i.assigned_to && i.assigned_to.toLowerCase().includes('operator')
  );

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c1322] via-[#0f172a] to-[#0d131f] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              TACTICAL INCIDENT COMMAND & RESPONSE ORCHESTRATION
            </span>
            <span className="text-slate-400 font-mono text-xs">• MISSION CONTROL WORKSPACE</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isHQCommand
                ? 'bg-purple-950/70 text-purple-300 border-purple-600/50'
                : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
            }`}>
              {isHQCommand ? '🏢 HQ WAR ROOM ORCHESTRATION' : '🪖 BOP FIELD SOP CHECKLIST'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Tactical Security Incident Directory & Command Orchestration
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Multi-camera correlation, SLA-driven multi-tier escalation, standard operating response playbooks with interactive checklists, situational awareness workspaces, and cryptographically sealed dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>DASHBOARD</span>
            </button>
          )}
          {incidents.length > 0 && (
            <button
              onClick={handleClearAllIncidents}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white rounded-xl text-xs font-mono font-bold border border-rose-500/40 transition cursor-pointer"
              title="Delete All Incidents"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              CLEAR ALL
            </button>
          )}
          {/* Emergency QRT Broadcast Trigger */}
          <button
            onClick={handleBroadcastQRT}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-950/60 cursor-pointer animate-pulse"
            title="Broadcast Emergency QRT Mobilization to Border Outposts"
          >
            <Flame className="w-4 h-4" />
            <span>BROADCAST QRT</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            CREATE INCIDENT
          </button>
        </div>
      </div>

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
              {analytics?.critical_incidents ?? 0}
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
              {analytics?.resolved_incidents ?? 0}
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

      {/* Subtabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'all'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL INCIDENTS ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('my_queue')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'my_queue'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            MY WORK QUEUE ({myIncidents.length})
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
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
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
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">🔴 Critical</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🟢 Low</option>
          </select>

          <button
            onClick={loadIncidents}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
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
                <th className="px-4 py-3">PLAYBOOK</th>
                <th className="px-4 py-3">ASSIGNED TO</th>
                <th className="px-4 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(activeTab === 'my_queue' ? myIncidents : incidents).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No incident records found matching criteria.
                  </td>
                </tr>
              ) : (
                (activeTab === 'my_queue' ? myIncidents : incidents).map((inc) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleOpenWorkspace(inc, e)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition shadow cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3 text-cyan-400" />
                          WORKSPACE
                        </button>
                        <button
                          onClick={(e) => handleDeleteIncident(e, inc.incident_id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                          title="Delete Incident Record"
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

      {/* Modals */}
      <CreateIncidentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadIncidents}
      />

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
