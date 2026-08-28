import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Share2,
  Activity,
  Bot,
  Layers,
  Search,
  Sliders,
  Download,
  RefreshCw,
  Clock,
  Car,
  UserCheck
} from 'lucide-react';
import { multimodalService } from '../services/multimodalService';
import {
  MultimodalSecurityEvent,
  MultimodalOverview,
  AIModelRegistryItem,
  CameraAIProfile,
  FeedbackAnalytics,
  FlowAnalytics,
  HeatmapData
} from '../types/multimodal';
import { EventGraphModal } from '../components/multimodal/EventGraphModal';
import { AIAssistantModal } from '../components/multimodal/AIAssistantModal';
import { FeedbackModal } from '../components/multimodal/FeedbackModal';

export const MultimodalIntelligencePage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'feed' | 'temporal' | 'heatmaps' | 'assistant' | 'models' | 'feedback' | 'profiles'
  >('feed');

  // State
  const [overview, setOverview] = useState<MultimodalOverview | null>(null);
  const [events, setEvents] = useState<MultimodalSecurityEvent[]>([]);
  const [models, setModels] = useState<AIModelRegistryItem[]>([]);
  const [profiles, setProfiles] = useState<CameraAIProfile[]>([]);
  const [flows, setFlows] = useState<FlowAnalytics | null>(null);
  const [heatmaps, setHeatmaps] = useState<HeatmapData | null>(null);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Modals
  const [selectedEventForGraph, setSelectedEventForGraph] = useState<MultimodalSecurityEvent | null>(null);
  const [selectedEventForFeedback, setSelectedEventForFeedback] = useState<MultimodalSecurityEvent | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const loadData = async () => {
    try {
      const [ov, evs, ms, profs, fl, hm, fb] = await Promise.all([
        multimodalService.getOverview(),
        multimodalService.listEvents({ limit: 50 }),
        multimodalService.listModels().catch(() => []),
        multimodalService.listProfiles().catch(() => []),
        multimodalService.getFlows().catch(() => null),
        multimodalService.getHeatmaps().catch(() => null),
        multimodalService.getFeedbackAnalytics().catch(() => null)
      ]);
      setOverview(ov);
      setEvents(evs);
      setModels(ms);
      setProfiles(profs);
      setFlows(fl);
      setHeatmaps(hm);
      setFeedbackAnalytics(fb);
    } catch (err) {
      console.error('Failed to load Multimodal Intelligence data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRollbackModel = async (modelId: number) => {
    try {
      await multimodalService.rollbackModel(modelId);
      const updatedModels = await multimodalService.listModels();
      setModels(updatedModels);
    } catch (err) {
      console.error('Failed to switch model version:', err);
    }
  };

  const handleProfileChange = async (cameraId: string, newProfile: 'LOW' | 'BALANCED' | 'HIGH') => {
    try {
      await multimodalService.updateProfile(cameraId, { profile: newProfile });
      const updatedProfiles = await multimodalService.listProfiles();
      setProfiles(updatedProfiles);
    } catch (err) {
      console.error('Failed to update camera profile:', err);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (selectedRiskFilter !== 'ALL' && e.risk_level !== selectedRiskFilter) return false;
    if (selectedTypeFilter !== 'ALL' && e.event_type !== selectedTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.event_id.toLowerCase().includes(q) ||
        e.primary_camera_id.toLowerCase().includes(q) ||
        e.bop_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 bg-[#070b12] text-slate-100 min-h-full">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Advanced AI/ML + Multimodal Security Intelligence
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  NEURAL MATRIX
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Explainable Multi-Signal Detection Fusion • Temporal Trajectory Analytics • AI Model Registry
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/50 transition-all"
          >
            <Bot className="w-4 h-4" />
            AI Assistant Search
          </button>
          <a
            href={multimodalService.exportEventsUrl('csv')}
            download
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Executive KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Active Correlated Events</div>
          <div className="text-xl font-bold text-cyan-400 mt-1">
            {overview?.active_ai_events ?? '...'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Fused non-redundant</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">High/Critical Threats</div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {overview?.high_risk_events ?? '...'}
          </div>
          <div className="text-[10px] text-rose-500 font-mono mt-0.5">Priority triage required</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Behavioral Anomalies</div>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {overview?.anomalies_count ?? '...'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Loitering & Route Deviations</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Unique Tracked Entities</div>
          <div className="text-xl font-bold text-purple-400 mt-1">
            {overview?.tracked_unique_objects ?? '...'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">ByteTrack Temporal Continuity</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">ANPR Reads / Vehicles</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {overview?.anpr_reads_count ?? 0} / {overview?.vehicle_observations_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Multi-frame consensus</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Multimodal Health</div>
          <div className="text-xl font-bold text-cyan-300 mt-1">
            {overview?.overall_multimodal_health ?? 92.5}%
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">FP Rate: {overview?.false_positive_rate ?? 0.04}</div>
        </div>
      </div>

      {/* Sub-Tab Navigation Strip */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-2">
        {[
          { id: 'feed', label: 'Live Multimodal Feed', icon: Activity },
          { id: 'temporal', label: 'Temporal & Flow Analytics', icon: Clock },
          { id: 'heatmaps', label: 'Activity & Anomaly Heatmaps', icon: Layers },
          { id: 'models', label: 'AI Model Registry & Observability', icon: BrainCircuit },
          { id: 'feedback', label: 'Human-in-the-Loop Feedback', icon: UserCheck },
          { id: 'profiles', label: 'Camera AI Profiles & Toggles', icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab 1: Live Multimodal Intelligence Feed */}
      {activeSubTab === 'feed' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter events by ID, title, camera..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={selectedRiskFilter}
                onChange={(e) => setSelectedRiskFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Event Types</option>
                <option value="CORRELATED_ANOMALY">Correlated Anomaly</option>
                <option value="PROLONGED_PRESENCE">Prolonged Presence</option>
                <option value="VEHICLE_PLATE_CORRELATION">Vehicle & ANPR</option>
                <option value="FACE_PRESENCE">Face Analytics</option>
                <option value="MULTIMODAL_INTRUSION">Multimodal Intrusion</option>
              </select>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Showing {filteredEvents.length} of {events.length} Correlated Events
            </div>
          </div>

          {/* Event Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((ev) => {
              const explanation = JSON.parse(ev.explanation_json || '{}');
              const factors: string[] = explanation.contributing_factors || [];

              return (
                <div
                  key={ev.event_id}
                  className="bg-[#0d1424] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4.5 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header line */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                          {ev.event_id}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            ev.risk_level === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : ev.risk_level === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          }`}
                        >
                          {ev.risk_level} ({ev.risk_score}/100)
                        </span>
                      </div>

                      <span className="text-xs font-mono text-slate-400">
                        {new Date(ev.event_occurred_at).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-slate-100">{ev.title}</h3>

                    {/* Contributing Factors */}
                    <div className="space-y-1 bg-slate-950/70 p-3 rounded-lg border border-slate-900">
                      <div className="text-[10px] font-mono text-cyan-400 uppercase">
                        Explainable Contributing Signals:
                      </div>
                      {factors.map((fact, idx) => (
                        <div key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                          <span className="text-cyan-400">•</span>
                          <span>{fact}</span>
                        </div>
                      ))}
                    </div>

                    {/* Signals & Metadata Strip */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 pt-1">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        Sensor: {ev.primary_camera_id}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        Location: {ev.bop_name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                        Confidence: {Math.round(ev.confidence * 100)}% ({ev.confidence_level})
                      </span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => setSelectedEventForGraph(ev)}
                      className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      View Signal Graph & Timeline
                    </button>

                    <button
                      onClick={() => setSelectedEventForFeedback(ev)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Operator Feedback
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Temporal & Flow Analytics */}
      {activeSubTab === 'temporal' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Total Persons Detected (24h)</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                {flows?.total_persons_detected ?? 0}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                Estimated Unique: {flows?.estimated_unique_persons ?? 0}
              </div>
            </div>

            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Sector Boundary Flow</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {flows?.person_entries ?? 0} In / {flows?.person_exits ?? 0} Out
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">Virtual Fencing Directional Count</div>
            </div>

            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Vehicles Flow Rate</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {flows?.vehicles_per_hour ?? 0} / hr
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                Total 24h: {flows?.total_vehicles ?? 0} vehicles
              </div>
            </div>

            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Directional Flow Vector</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {flows?.direction_flow_breakdown?.NORTH_BOUND ?? 0} N / {flows?.direction_flow_breakdown?.SOUTH_BOUND ?? 0} S
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">Corridor Vector Distribution</div>
            </div>
          </div>

          {/* Vehicle Classification Breakdown */}
          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Car className="w-4 h-4 text-cyan-400" /> Supported Vehicle Class Distribution (24h)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {flows?.vehicle_classes_breakdown &&
                Object.entries(flows.vehicle_classes_breakdown).map(([vClass, count]) => (
                  <div key={vClass} className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                    <div className="text-xs font-mono text-slate-400 capitalize">{vClass}</div>
                    <div className="text-lg font-bold text-slate-100 mt-1">{count}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Activity & Anomaly Heatmaps */}
      {activeSubTab === 'heatmaps' && (
        <div className="space-y-6">
          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" /> Spatial Perimeter Heatmap & Anomaly Clustering
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aggregated object density vs anomalous intrusion vectors.
                </p>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                Baseline Deviation: +{heatmaps?.baseline_deviation_percentage ?? 14.5}%
              </span>
            </div>

            {/* Visual Heatmap Canvas Mock */}
            <div className="h-64 bg-[#080d1a] border border-slate-800 rounded-xl relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Heatmap points */}
              {heatmaps?.activity_points.map((pt, idx) => (
                <div
                  key={`act-${idx}`}
                  style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 blur-md animate-pulse" />
                  <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950 absolute top-4.5" />
                  <span className="text-[10px] font-mono text-cyan-300 bg-slate-950/90 px-1.5 py-0.5 rounded border border-cyan-800 mt-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    {pt.label} (Density: {Math.round(pt.intensity * 100)}%)
                  </span>
                </div>
              ))}

              {heatmaps?.anomaly_points.map((pt, idx) => (
                <div
                  key={`anom-${idx}`}
                  style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-rose-500/30 blur-lg animate-ping" />
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950 absolute top-6" />
                  <span className="text-[10px] font-mono text-rose-300 bg-slate-950/90 px-1.5 py-0.5 rounded border border-rose-800 mt-9 opacity-0 group-hover:opacity-100 transition-opacity">
                    {pt.label} (Anomaly: {Math.round(pt.intensity * 100)}%)
                  </span>
                </div>
              ))}

              <div className="text-xs font-mono text-slate-500 z-10">
                Perimeter Zero-Line Tactical Grid Matrix
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: AI Model Registry & Observability */}
      {activeSubTab === 'models' && (
        <div className="space-y-6">
          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-cyan-400" /> Active AI Model Registry & Performance Metrics
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] font-mono text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase">
                  <tr>
                    <th className="p-3">Model Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Precision / Recall</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Error Rate</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-200 font-sans">{m.model_name}</td>
                      <td className="p-3 text-slate-400">{m.model_type}</td>
                      <td className="p-3 text-cyan-400">{m.version}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {Math.round(m.precision * 100)}% / {Math.round(m.recall * 100)}%
                      </td>
                      <td className="p-3 text-slate-300">{m.latency_ms} ms</td>
                      <td className="p-3 text-slate-400">{Math.round(m.error_rate * 1000) / 10}%</td>
                      <td className="p-3 text-right">
                        {!m.is_active && (
                          <button
                            onClick={() => handleRollbackModel(m.id)}
                            className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded text-[11px] font-sans transition-colors"
                          >
                            Activate / Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Human-in-the-Loop Feedback */}
      {activeSubTab === 'feedback' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Total Operator Reviews</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">
                {feedbackAnalytics?.total_feedbacks ?? 0}
              </div>
            </div>
            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Verified Inferences</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {feedbackAnalytics?.valid_count ?? 0}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                Validation: {Math.round((feedbackAnalytics?.validation_rate ?? 0.95) * 100)}%
              </div>
            </div>
            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">False Positives Suppressed</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {feedbackAnalytics?.false_positive_count ?? 0}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                FP Rate: {Math.round((feedbackAnalytics?.false_positive_rate ?? 0.04) * 100)}%
              </div>
            </div>
            <div className="bg-[#0e1626] border border-slate-800 p-4 rounded-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Uncertain Events</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {feedbackAnalytics?.uncertain_count ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 6: Camera AI Resource Profiles & Toggles */}
      {activeSubTab === 'profiles' && (
        <div className="space-y-6">
          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Compute-Aware Camera AI Profiles & Feature Toggles
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] font-mono text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase">
                  <tr>
                    <th className="p-3">Camera ID</th>
                    <th className="p-3">Active Profile</th>
                    <th className="p-3">Inference Target</th>
                    <th className="p-3">ANPR</th>
                    <th className="p-3">Face Analytics</th>
                    <th className="p-3">Loitering Threshold</th>
                    <th className="p-3 text-right">Resource Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {profiles.map((p) => (
                    <tr key={p.camera_id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-200">{p.camera_id}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.profile === 'HIGH'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : p.profile === 'BALANCED'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.profile}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{p.target_fps} FPS</td>
                      <td className="p-3 text-slate-300">{p.anpr_enabled ? 'ENABLED' : 'DISABLED'}</td>
                      <td className="p-3 text-slate-300">{p.face_detection ? 'ENABLED' : 'DISABLED'}</td>
                      <td className="p-3 text-slate-300">{p.loitering_threshold_seconds}s</td>
                      <td className="p-3 text-right">
                        <select
                          value={p.profile}
                          onChange={(e) =>
                            handleProfileChange(p.camera_id, e.target.value as 'LOW' | 'BALANCED' | 'HIGH')
                          }
                          className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 font-sans focus:outline-none focus:border-cyan-500"
                        >
                          <option value="LOW">LOW (5 FPS)</option>
                          <option value="BALANCED">BALANCED (10 FPS)</option>
                          <option value="HIGH">HIGH (20 FPS)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EventGraphModal
        isOpen={!!selectedEventForGraph}
        onClose={() => setSelectedEventForGraph(null)}
        event={selectedEventForGraph}
      />

      <AIAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onSelectEvent={(ev) => {
          setIsAssistantOpen(false);
          setSelectedEventForGraph(ev);
        }}
      />

      <FeedbackModal
        isOpen={!!selectedEventForFeedback}
        onClose={() => setSelectedEventForFeedback(null)}
        event={selectedEventForFeedback}
        onFeedbackSaved={loadData}
      />
    </div>
  );
};
