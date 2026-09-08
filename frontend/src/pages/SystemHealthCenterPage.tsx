import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Cctv,
  Server,
  Cpu,
  HardDrive,
  Network,
  Wrench,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sliders,
  ArrowUpRight,
  ArrowLeft,
  Layers,
  Trash2
} from 'lucide-react';

import { healthService } from '../services/healthService';
import {
  SystemHealthSummary,
  CameraHealthItem,
  EdgeNodeHealthItem,
  ServiceDependencyItem,
  NetworkHealthSummary,
  StorageHealthSummary,
  QueueHealthItem,
  ModelHealthItem,
  DiagnosticResultItem,
  HealthEventItem,
  MaintenanceWindow,
  HealthConfig
} from '../types/health';
import { MaintenanceModal } from '../components/health/MaintenanceModal';
import { DiagnosticDetailModal } from '../components/health/DiagnosticDetailModal';

interface SystemHealthCenterPageProps {
  onBackToDashboard?: () => void;
}

export const SystemHealthCenterPage: React.FC<SystemHealthCenterPageProps> = ({ onBackToDashboard }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Data states
  const [systemHealth, setSystemHealth] = useState<SystemHealthSummary | null>(null);
  const [cameras, setCameras] = useState<CameraHealthItem[]>([]);
  const [edgeNodes, setEdgeNodes] = useState<EdgeNodeHealthItem[]>([]);
  const [services, setServices] = useState<ServiceDependencyItem[]>([]);
  const [network, setNetwork] = useState<NetworkHealthSummary | null>(null);
  const [storage, setStorage] = useState<StorageHealthSummary | null>(null);
  const [queues, setQueues] = useState<QueueHealthItem[]>([]);
  const [models, setModels] = useState<ModelHealthItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResultItem[]>([]);
  const [events, setEvents] = useState<HealthEventItem[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [config, setConfig] = useState<HealthConfig | null>(null);

  // Filters
  const [cameraSearch, setCameraSearch] = useState('');

  // Modals & Target State
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceTargetType, setMaintenanceTargetType] = useState<'CAMERA' | 'EDGE_NODE' | 'SERVICE'>('CAMERA');
  const [maintenanceTargetId, setMaintenanceTargetId] = useState<string>('');
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<DiagnosticResultItem | null>(null);

  // Config Draft State & Operations
  const [configDraft, setConfigDraft] = useState<Partial<HealthConfig>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);

  const handleOpenMaintenance = (type: 'CAMERA' | 'EDGE_NODE' | 'SERVICE' = 'CAMERA', id: string = '') => {
    setMaintenanceTargetType(type);
    setMaintenanceTargetId(id);
    setMaintenanceModalOpen(true);
  };

  const handleTerminateMaintenance = async (maintenanceId: string) => {
    try {
      setTerminatingId(maintenanceId);
      await healthService.terminateMaintenanceWindow(maintenanceId);
      await fetchAllHealthData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to end maintenance window.');
    } finally {
      setTerminatingId(null);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      setDiagnosticRunning(true);
      const res = await healthService.triggerDiagnostics();
      setDiagnostics(res);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setDiagnosticRunning(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const updated = await healthService.updateHealthConfig({
        ...configDraft,
        notes: 'Operator SLA threshold calibration'
      });
      setConfig(updated);
      setConfigDraft(updated);
      setConfigMsg({ type: 'success', text: 'Thresholds & SLA configuration updated successfully!' });
      setTimeout(() => setConfigMsg(null), 5000);
    } catch (err: any) {
      setConfigMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update configuration.' });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTriggerTestEvent = async () => {
    try {
      await healthService.triggerTestEvent(
        'Manual Health Diagnostics Probe',
        'Operator executed manual infrastructure audit verification probe.'
      );
      await fetchAllHealthData();
    } catch (err) {
      console.error('Failed to trigger test event', err);
    }
  };

  const handleClearHealthEvents = async () => {
    if (window.confirm('Are you sure you want to clear all recorded infrastructure health logs?')) {
      try {
        await healthService.clearHealthEvents();
        await fetchAllHealthData();
      } catch (err) {
        console.error('Failed to clear health events', err);
      }
    }
  };

  const fetchAllHealthData = async () => {

    setLoading(true);
    try {
      const [
        sysRes,
        camsRes,
        edgesRes,
        servRes,
        netRes,
        storRes,
        qRes,
        modRes,
        diagRes,
        evtRes,
        maintRes,
        cfgRes
      ] = await Promise.all([
        healthService.getSystemHealth(),
        healthService.getCameraHealthList(),
        healthService.getEdgeNodesHealth(),
        healthService.getServicesHealth(),
        healthService.getNetworkHealth(),
        healthService.getStorageHealth(),
        healthService.getQueueHealth(),
        healthService.getModelsHealth(),
        healthService.getDiagnostics(),
        healthService.getHealthEvents(),
        healthService.getMaintenanceWindows(),
        healthService.getHealthConfig()
      ]);

      setSystemHealth(sysRes);
      setCameras(camsRes);
      setEdgeNodes(edgesRes);
      setServices(servRes);
      setNetwork(netRes);
      setStorage(storRes);
      setQueues(qRes);
      setModels(modRes);
      setDiagnostics(diagRes);
      setEvents(evtRes);
      setMaintenanceWindows(maintRes);
      setConfig(cfgRes);
      setConfigDraft(cfgRes);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load system health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllHealthData();
    const interval = setInterval(fetchAllHealthData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePriorityChange = async (cameraId: string, priority: string) => {
    try {
      await healthService.setCameraPriority(cameraId, priority, 'Operator manual adjustment');
      fetchAllHealthData();
    } catch (e) {
      console.error('Failed to update priority:', e);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 70) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (score >= 50) return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const filteredCameras = cameras.filter(c =>
    c.camera_id.toLowerCase().includes(cameraSearch.toLowerCase()) ||
    c.camera_name.toLowerCase().includes(cameraSearch.toLowerCase()) ||
    c.bop_site.toLowerCase().includes(cameraSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-xl text-xs font-mono font-bold border border-slate-700 transition cursor-pointer shadow-sm group"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-cyan-400" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
              System Health Center
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider font-mono">
                HEALTH MATRIX
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Continuous Infrastructure Observability, Symptom Correlation, Self-Diagnostics & Resource Optimization
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-mono">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={() => fetchAllHealthData()}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => handleOpenMaintenance('CAMERA', '')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-amber-900/20 transition cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Maintenance Mode</span>
          </button>
        </div>
      </div>

      {/* System Health Score Banner */}
      {systemHealth && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
            {/* Overall Score Circle */}
            <div className="flex items-center space-x-6 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-6">
              <div className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center ${getScoreColor(systemHealth.overall_score)}`}>
                <span className="text-3xl font-black font-mono tracking-tight">
                  {Math.round(systemHealth.overall_score)}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mt-0.5">
                  / 100
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase border ${getScoreColor(systemHealth.overall_score)}`}>
                    {systemHealth.status}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-white mt-1.5">
                  {systemHealth.status_label}
                </h2>
                <div className="flex items-center space-x-3 mt-2 text-xs text-slate-400">
                  <span>Critical Issues: <strong className="text-rose-400">{systemHealth.active_critical_issues}</strong></span>
                  <span>Warnings: <strong className="text-amber-400">{systemHealth.active_warnings}</strong></span>
                </div>
              </div>
            </div>

            {/* Pillar Breakdown Cards (3 cols) */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-3">
              {systemHealth.contributors.map((c, i) => (
                <div key={i} className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono text-slate-500">{Math.round(c.weight * 100)}%</span>
                    </div>
                    <div className="text-base font-black font-mono text-white">
                      {Math.round(c.score)}<span className="text-xs text-slate-500 font-normal">/100</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.score >= 85 ? 'bg-emerald-500' :
                          c.score >= 70 ? 'bg-amber-500' :
                          c.score >= 50 ? 'bg-orange-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate mt-1">{c.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex space-x-1 border-b border-slate-800 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Executive Overview', icon: Layers },
          { id: 'cameras', label: `Cameras & Video (${cameras.length})`, icon: Cctv },
          { id: 'edges', label: `Edge Fleet (${edgeNodes.length})`, icon: Server },
          { id: 'ai', label: 'AI Pipeline & Queues', icon: Cpu },
          { id: 'diagnostics', label: `Diagnostic Engine (${diagnostics.length})`, icon: AlertTriangle },
          { id: 'storage', label: 'Storage & Retention', icon: HardDrive },
          { id: 'timeline', label: `Health Timeline (${events.length})`, icon: Clock },
          { id: 'maintenance', label: `Maintenance (${maintenanceWindows.length})`, icon: Wrench },
          { id: 'config', label: 'Health Configuration', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 tracking-wide transition whitespace-nowrap ${
                isActive
                  ? 'border-emerald-500 text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Diagnostic Alerts Banner */}
          {diagnostics.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Correlated Infrastructure Findings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diagnostics.map((d, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDiagnostic(d)}
                    className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition shadow-md flex items-start justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          d.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {d.severity}
                        </span>
                        <span className="text-xs font-bold text-white">{d.event_type}</span>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {d.confidence_percent}% confidence
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">{d.what_happened}</p>
                      <p className="text-[11px] text-slate-400">
                        <span className="text-slate-500 font-semibold">Possible Cause:</span> {d.possible_root_cause}
                      </p>
                    </div>
                    <button className="text-slate-400 hover:text-white p-1 rounded">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subsystem Dependency Health Matrix */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-slate-400" />
              Core Subsystem Dependency Health Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {services.map((s, i) => (
                <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 truncate">{s.service_name}</span>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-slate-500">Latency</span>
                    <span className="font-mono font-bold text-slate-200">{s.latency_ms} ms</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-slate-500">Error Rate</span>
                    <span className="font-mono text-emerald-400">{s.error_rate_percent}%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate mt-2">{s.details}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Storage Summary Card */}
            {storage && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Storage Capacity</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    storage.status === 'NORMAL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {storage.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Used Storage</span>
                    <span className="font-mono text-slate-200">{storage.used_gb} GB / {storage.total_gb} GB ({storage.used_percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${storage.used_percent}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                    <span>Evidence: {storage.evidence_storage_gb} GB</span>
                    <span>Remaining: ~{storage.estimated_days_remaining} days</span>
                  </div>
                </div>
              </div>
            )}

            {/* Network Summary Card */}
            {network && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Network Links</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-400">
                    {network.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Average Stream Latency:</span>
                    <span className="font-mono text-slate-200">{network.average_latency_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Packet Loss:</span>
                    <span className="font-mono text-slate-200">{network.packet_loss_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Low-Bandwidth Mode:</span>
                    <span className={network.low_bandwidth_mode_active ? "text-amber-400 font-bold" : "text-slate-400"}>
                      {network.low_bandwidth_mode_active ? 'ACTIVE' : 'STANDBY'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Queue Summary Card */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Inference Queue</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400">
                  HEALTHY
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {queues.slice(0, 3).map((q, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-400 truncate max-w-[160px]">{q.queue_name}:</span>
                    <span className="font-mono text-slate-200">{q.queue_depth} depth ({q.processing_rate_per_sec}/s)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMERAS & OPTICAL QUALITY */}
      {activeTab === 'cameras' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              value={cameraSearch}
              onChange={(e) => setCameraSearch(e.target.value)}
              placeholder="Search cameras by ID, name, or BOP site..."
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white max-w-md w-full focus:outline-none focus:border-emerald-500"
            />
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredCameras.length} of {cameras.length} cameras
            </span>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1329] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Camera</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">FPS (Act/Exp)</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Optical Quality</th>
                  <th className="px-4 py-3">Tampering</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCameras.map(c => (
                  <tr key={c.camera_id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{c.camera_id}</div>
                      <div className="text-[11px] text-slate-400">{c.camera_name} • {c.bop_site}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400' :
                        c.status === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-400' :
                        c.status === 'DEGRADED' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.priority}
                        onChange={(e) => handlePriorityChange(c.camera_id, e.target.value)}
                        className={`bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          c.priority === 'CRITICAL' ? 'text-rose-400 border-rose-500/40' :
                          c.priority === 'HIGH' ? 'text-orange-400 border-orange-500/40' :
                          'text-slate-300'
                        }`}
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="NORMAL">NORMAL</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={c.fps_degraded ? "text-amber-400 font-bold" : "text-slate-200"}>
                        {c.actual_fps} / {c.expected_fps}
                      </span>
                      {c.fps_degraded && <span className="ml-1 text-[10px] text-amber-400">⚠️</span>}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={c.stream_latency_ms > 120 ? "text-rose-400 font-bold" : "text-slate-300"}>
                        {c.stream_latency_ms} ms
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              c.image_quality_score >= 75 ? 'bg-emerald-400' :
                              c.image_quality_score >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                            style={{ width: `${c.image_quality_score}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-300">{Math.round(c.image_quality_score)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.tampering_detected ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30">
                          TAMPERING
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      {c.health_score}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenMaintenance('CAMERA', c.camera_id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-amber-600/80 text-slate-300 hover:text-white rounded text-[11px] transition cursor-pointer"
                        title={`Schedule Maintenance for Camera ${c.camera_id}`}
                      >
                        Service
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EDGE FLEET */}
      {activeTab === 'edges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {edgeNodes.map(node => (
            <div key={node.node_id} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-sm">{node.node_id}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      node.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{node.name} • {node.bop_site}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  HB: {Math.round(node.heartbeat_age_seconds)}s ago
                </span>
              </div>

              {/* Resource Gauges */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-800/60 rounded-lg">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>CPU</span>
                    <span className="font-mono text-white">{node.cpu_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full" style={{ width: `${node.cpu_percent}%` }} />
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-lg">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>RAM</span>
                    <span className="font-mono text-white">{node.memory_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full" style={{ width: `${node.memory_percent}%` }} />
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-lg">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>GPU</span>
                    <span className="font-mono text-white">{node.gpu_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full" style={{ width: `${node.gpu_percent}%` }} />
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-lg">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Disk</span>
                    <span className="font-mono text-white">{node.disk_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full" style={{ width: `${node.disk_percent}%` }} />
                  </div>
                </div>
              </div>

              {/* Cameras & Sync Status */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">Attached Cameras: <strong className="text-slate-200 font-mono">{node.total_cameras_count}</strong></span>
                <button
                  onClick={() => handleOpenMaintenance('EDGE_NODE', node.node_id)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-amber-600/80 text-slate-300 hover:text-white rounded text-[11px] font-semibold transition cursor-pointer"
                  title={`Schedule Maintenance for Edge Appliance ${node.node_id}`}
                >
                  Service Node
                </button>
              </div>
              {node.affected_cameras.length > 0 && (
                <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                  ⚠️ Affected Cameras: {node.affected_cameras.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: AI PIPELINE & QUEUES */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Health Matrix */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Active Model Health & Inference SLA
              </h3>
              <div className="space-y-3">
                {models.map((m, i) => (
                  <div key={i} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{m.model_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400">
                        {m.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                      <div>Version: <strong className="text-slate-200 font-mono">{m.model_version}</strong></div>
                      <div>FPS: <strong className="text-emerald-400 font-mono">{m.inference_fps}</strong></div>
                      <div>Latency: <strong className="text-slate-200 font-mono">{m.avg_latency_ms}ms</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Queue Backlog Monitoring */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Asynchronous Queue Ingestion & Backlog
              </h3>
              <div className="space-y-3">
                {queues.map((q, i) => (
                  <div key={i} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{q.queue_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        q.status === 'HEALTHY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Queue Depth: <strong className="text-white font-mono">{q.queue_depth}</strong></span>
                      <span>Rate: <strong className="text-slate-200 font-mono">{q.processing_rate_per_sec} /s</strong></span>
                      <span>Delay: <strong className="text-slate-200 font-mono">{q.estimated_delay_seconds}s</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DIAGNOSTIC ENGINE */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>
              The Self-Diagnostic Engine correlates multi-source symptoms across cameras, nodes, and network links to deduce probable root causes without generating duplicate alarm noise.
            </span>
            <div className="flex items-center space-x-3 shrink-0">
              <span className="font-mono text-cyan-400">{diagnostics.length} Correlated Findings</span>
              <button
                onClick={handleRunDiagnostics}
                disabled={diagnosticRunning}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagnosticRunning ? 'animate-spin' : ''}`} />
                <span>{diagnosticRunning ? 'Probing...' : 'Run Diagnostics Scan'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {diagnostics.map((d, i) => (
              <div
                key={i}
                className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                      d.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      d.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {d.severity}
                    </span>
                    <h3 className="font-bold text-white text-sm">{d.what_happened}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedDiagnostic(d)}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                  >
                    <span>View Analysis</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg text-xs space-y-1">
                  <div className="text-slate-400">
                    <strong className="text-indigo-400">Possible Root Cause ({d.confidence_percent}% confidence):</strong> {d.possible_root_cause}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Affected: {d.affected_components.join(' • ')}
                  </div>
                </div>
              </div>
            ))}
            {diagnostics.length === 0 && (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
                No active infrastructure faults or performance degradations detected.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: STORAGE & RETENTION */}
      {activeTab === 'storage' && storage && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Capacity</span>
              <div className="text-2xl font-black font-mono text-white mt-1">{storage.total_gb} GB</div>
              <span className="text-[11px] text-slate-500">NVMe Array</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Used Storage</span>
              <div className="text-2xl font-black font-mono text-cyan-400 mt-1">{storage.used_gb} GB</div>
              <span className="text-[11px] text-slate-500">{storage.used_percent}% utilized</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Evidence Footprint</span>
              <div className="text-2xl font-black font-mono text-indigo-400 mt-1">{storage.evidence_storage_gb} GB</div>
              <span className="text-[11px] text-slate-500">SHA-256 sealed video clips</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Retention Horizon</span>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">~{storage.estimated_days_remaining} Days</div>
              <span className="text-[11px] text-slate-500">{storage.retention_days}-day policy</span>
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 leading-relaxed">
            <strong>Evidence Retention Policy Notice:</strong> Under IBVAP Section 22 security directives, the system displays storage growth rates ({storage.growth_rate_gb_per_day} GB/day) and remaining capacity warnings, but will <em>never automatically purge or truncate authorized security incident video evidence</em> without explicit operator review.
          </div>
        </div>
      )}

      {/* TAB 7: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-1">
            <span className="text-xs text-slate-400 font-mono">Continuous Event Log ({events.length} records)</span>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHealthEvents}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                  title="Clear all recorded health failure logs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Health Logs
                </button>
              )}
              <button
                onClick={handleTriggerTestEvent}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-mono font-semibold border border-slate-700 transition cursor-pointer"
              >
                + Log Diagnostics Probe Event
              </button>
            </div>
          </div>


          {events.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="text-sm font-semibold text-slate-300">No degradation or failure events recorded in current audit window.</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All edge node heartbeats, camera streams, and AI pipelines are operating within nominal parameters.
              </p>
              <button
                onClick={handleTriggerTestEvent}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-mono font-semibold border border-slate-700 transition cursor-pointer"
              >
                + Log Health Diagnostics Probe Event
              </button>
            </div>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    evt.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                    evt.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {evt.event_type}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">{evt.title}</div>
                    <div className="text-[11px] text-slate-400">{evt.description}</div>
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500">
                  {new Date(evt.started_at).toLocaleTimeString()}
                  {evt.downtime_seconds > 0 && (
                    <span className="block text-emerald-400 font-semibold">{Math.round(evt.downtime_seconds)}s downtime</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 8: MAINTENANCE WINDOWS */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Scheduled and active hardware maintenance windows</span>
            <button
              onClick={() => setMaintenanceModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
            >
              + New Maintenance Window
            </button>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0b1329] text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Authorized By</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {maintenanceWindows.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-slate-400">{m.maintenance_id}</td>
                    <td className="px-4 py-3 font-bold text-white">{m.target_type}: {m.target_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.status === 'ACTIVE' ? 'bg-amber-500/20 text-amber-400' :
                        m.status === 'TERMINATED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{m.reason}</td>
                    <td className="px-4 py-3 text-slate-400">{m.authorized_by}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{new Date(m.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {m.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleTerminateMaintenance(m.maintenance_id)}
                          disabled={terminatingId === m.maintenance_id}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold transition cursor-pointer shadow-sm"
                          title="Restore device and bring back ONLINE immediately"
                        >
                          {terminatingId === m.maintenance_id ? 'Restoring...' : 'End Maintenance'}
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[11px] font-mono">Concluded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: CONFIGURATION */}
      {activeTab === 'config' && config && (
        <form onSubmit={handleSaveConfig} className="p-6 bg-slate-900 border border-slate-800 rounded-xl max-w-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Health Monitoring Thresholds & SLAs
            </h3>
            <button
              type="submit"
              disabled={configSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-900/20 transition cursor-pointer"
            >
              {configSaving ? 'Saving...' : 'Save & Apply Thresholds'}
            </button>
          </div>

          {configMsg && (
            <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              configMsg.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}>
              {configMsg.type === 'success' ? '✓' : '⚠️'} {configMsg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Heartbeat Timeout (Seconds)</label>
              <input
                type="number"
                value={configDraft.heartbeat_timeout_seconds ?? 60}
                onChange={(e) => setConfigDraft(prev => ({ ...prev, heartbeat_timeout_seconds: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">FPS Degradation Ratio</label>
              <input
                type="number"
                step="0.05"
                value={configDraft.fps_degradation_ratio ?? 0.60}
                onChange={(e) => setConfigDraft(prev => ({ ...prev, fps_degradation_ratio: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Storage Warning (%)</label>
              <input
                type="number"
                value={configDraft.storage_warning_percent ?? 80}
                onChange={(e) => setConfigDraft(prev => ({ ...prev, storage_warning_percent: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Queue Backlog Threshold</label>
              <input
                type="number"
                value={configDraft.queue_backlog_threshold ?? 25}
                onChange={(e) => setConfigDraft(prev => ({ ...prev, queue_backlog_threshold: Number(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic pt-2">
            All modifications create a new versioned configuration record with an immutable operator audit log.
          </p>
        </form>
      )}

      {/* Modals */}
      <MaintenanceModal
        isOpen={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
        onSuccess={fetchAllHealthData}
        defaultTargetType={maintenanceTargetType}
        defaultTargetId={maintenanceTargetId}
      />

      <DiagnosticDetailModal
        isOpen={!!selectedDiagnostic}
        onClose={() => setSelectedDiagnostic(null)}
        diagnostic={selectedDiagnostic}
      />
    </div>
  );
};
