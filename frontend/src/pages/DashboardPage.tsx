import React, { useState, useEffect } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { SecurityEvent, SecurityEventsSummary } from '../types/event';
import { ANPRSummary } from '../types/anpr';
import { FaceAnalyticsSummary } from '../types/face';
import { EdgeSyncStats } from '../types/edge';
import { eventService, SecurityEventsWebSocket } from '../services/eventService';
import { anprService } from '../services/anprService';
import { faceService } from '../services/faceService';
import { edgeService } from '../services/edgeService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { RiskBadge } from '../components/events/RiskBadge';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { HQDispatchesSitrepPanel } from '../components/dispatches/HQDispatchesSitrepPanel';

import {
  Cctv,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  TrendingUp,
  Clock,
  Car,
  Fingerprint,
  Server,
  Shield,
  Globe,
  FolderLock,
  FileCheck,
  ShieldCheck,
  Flame
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToCameras?: () => void;
  onNavigateToLive?: () => void;
  onNavigateToSOC?: () => void;
  onNavigateToFederation?: () => void;
  onNavigateToEvidence?: () => void;
  onNavigateToIncidents?: () => void;
  onNavigateToSecurity?: () => void;
  onNavigateToIntelligence?: () => void;
  onNavigateToEvents?: () => void;
  onNavigateToANPR?: () => void;
  onNavigateToFace?: () => void;
  onNavigateToEdge?: () => void;
  onInspectCamera: (camera: Camera) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToLive,
  onNavigateToSOC,
  onNavigateToFederation,
  onNavigateToEvidence,
  onNavigateToIncidents,
  onNavigateToSecurity,
  onNavigateToEvents,
  onNavigateToANPR,
  onNavigateToFace,

  onNavigateToEdge,
  onInspectCamera
}) => {

  const { cameras, summary } = useCameras();
  const [eventsSummary, setEventsSummary] = useState<SecurityEventsSummary | null>(null);
  const [anprSummary, setAnprSummary] = useState<ANPRSummary | null>(null);
  const [faceSummary, setFaceSummary] = useState<FaceAnalyticsSummary | null>(null);
  const [edgeStats, setEdgeStats] = useState<EdgeSyncStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const activeCameras = cameras.filter((c: Camera) => c.enabled);
  const featuredCameras = activeCameras.slice(0, 4);

  useEffect(() => {
    loadDashboardData();
    const ws = new SecurityEventsWebSocket(() => {
      loadDashboardData();
    });
    const interval = setInterval(loadDashboardData, 5000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const [eventsData, anprData, faceData, edgeData] = await Promise.all([
        eventService.getSummary().catch(() => null),
        anprService.getSummary().catch(() => null),
        faceService.getSummary().catch(() => null),
        edgeService.getSyncStats().catch(() => null)
      ]);
      if (eventsData) {
        setEventsSummary(eventsData);
        setRecentEvents(eventsData.recent_events || []);
      }
      if (anprData) setAnprSummary(anprData);
      if (faceData) setFaceSummary(faceData);
      if (edgeData) setEdgeStats(edgeData);
    } catch (e) {
      console.error('Failed to load events summary on dashboard', e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Welcome & Mission Banner */}
      <div className="bg-gradient-to-r from-[#111c33] via-[#0f172a] to-[#0d131f] border border-[#1e293b] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[11px] font-bold border border-sky-500/30">
              TACTICAL BORDER SURVEILLANCE
            </span>
            <span className="text-slate-400 font-mono text-xs">• SECTOR HQ DISPATCH</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            IBVAP Central Surveillance Matrix
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Real-time IP CCTV ingestion, Edge AI inference, offline store-and-forward sync, ANPR consensus, facial analytics, and explainable threat scoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToFederation && (
            <button
              onClick={onNavigateToFederation}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-emerald-600/20"
            >
              <Globe className="w-4 h-4" />
              NATIONAL BORDER MAP
            </button>
          )}
          {onNavigateToSOC && (
            <button
              onClick={onNavigateToSOC}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-600/20"
            >
              <Flame className="w-4 h-4" />
              SOC THREAT MATRIX
            </button>
          )}
        </div>
      </div>

      {/* HQ Central Command Governance Hub (Admin Exclusive Modules) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            HQ Central Governance & Command Modules
          </h3>
          <span className="text-xs font-mono text-slate-400">Level-5 Central Supreme Authority</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {onNavigateToSOC && (
            <button
              onClick={onNavigateToSOC}
              className="group p-4 bg-[#111a2e] hover:bg-rose-950/40 border border-[#1e293b] hover:border-rose-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 group-hover:scale-110 transition">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-rose-400 transition">SOC Command</div>
                <div className="text-[10px] text-slate-400">Real-time threat triage</div>
              </div>
            </button>
          )}

          {onNavigateToFederation && (
            <button
              onClick={onNavigateToFederation}
              className="group p-4 bg-[#111a2e] hover:bg-emerald-950/40 border border-[#1e293b] hover:border-emerald-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">Federated Map</div>
                <div className="text-[10px] text-slate-400">National border sites</div>
              </div>
            </button>
          )}

          {onNavigateToSecurity && (
            <button
              onClick={onNavigateToSecurity}
              className="group p-4 bg-[#111a2e] hover:bg-purple-950/40 border border-[#1e293b] hover:border-purple-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-purple-400 transition">Officer Management</div>
                <div className="text-[10px] text-slate-400">Assign BOPs & RBAC</div>
              </div>
            </button>
          )}

          {onNavigateToEvidence && (
            <button
              onClick={onNavigateToEvidence}
              className="group p-4 bg-[#111a2e] hover:bg-cyan-950/40 border border-[#1e293b] hover:border-cyan-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 group-hover:scale-110 transition">
                <FolderLock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition">Forensic Vault</div>
                <div className="text-[10px] text-slate-400">SHA-256 chain of custody</div>
              </div>
            </button>
          )}

          {onNavigateToIncidents && (
            <button
              onClick={onNavigateToIncidents}
              className="group p-4 bg-[#111a2e] hover:bg-amber-950/40 border border-[#1e293b] hover:border-amber-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">SOP Playbooks</div>
                <div className="text-[10px] text-slate-400">QRT response workflows</div>
              </div>
            </button>
          )}

          {onNavigateToEdge && (
            <button
              onClick={onNavigateToEdge}
              className="group p-4 bg-[#111a2e] hover:bg-sky-950/40 border border-[#1e293b] hover:border-sky-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
            >
              <div className="p-2 w-fit rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 group-hover:scale-110 transition">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-sky-400 transition">Border Edge Sync</div>
                <div className="text-[10px] text-slate-400">Outpost connectivity</div>
              </div>
            </button>
          )}
        </div>
      </div>


      {/* Threat Intelligence Metrics Section */}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Threat Intelligence & Active Security Alerts
          </h3>
          {onNavigateToEvents && (
            <button
              onClick={onNavigateToEvents}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-mono"
            >
              View Full Incident Log <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-rose-400 font-bold">CRITICAL THREATS</span>
              <div className="text-2xl font-mono font-black text-rose-400">
                {eventsSummary?.critical_count ?? 0}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#111a2e] border border-orange-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-orange-400 font-bold">HIGH RISK EVENTS</span>
              <div className="text-2xl font-mono font-black text-orange-400">
                {eventsSummary?.high_count ?? 0}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-amber-400 font-bold">MEDIUM RISKS</span>
              <div className="text-2xl font-mono font-black text-amber-400">
                {eventsSummary?.medium_count ?? 0}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-emerald-400 font-bold">LOW SEVERITY</span>
              <div className="text-2xl font-mono font-black text-emerald-400">
                {eventsSummary?.low_count ?? 0}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Edge & Intelligence Triad: Edge Outposts, ANPR & Face Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Edge Fleet Card */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4" />
              EDGE OUTPOSTS & SYNC
            </h4>
            {onNavigateToEdge && (
              <button onClick={onNavigateToEdge} className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1">
                Edge Fleet <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-[#090d16] p-2 rounded-lg border border-[#1e293b]">
              <span className="text-emerald-400 text-[10px] block">ONLINE</span>
              <span className="text-base font-bold text-emerald-400">{edgeStats?.nodes_online ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-amber-500/30">
              <span className="text-amber-400 text-[10px] block">QUEUED</span>
              <span className="text-base font-bold text-amber-400">{edgeStats?.pending_sync ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-purple-500/30">
              <span className="text-purple-400 text-[10px] block">SYNCED</span>
              <span className="text-base font-bold text-purple-400">{edgeStats?.total_synced ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ANPR Card */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Car className="w-4 h-4" />
              ANPR & VEHICLES
            </h4>
            {onNavigateToANPR && (
              <button onClick={onNavigateToANPR} className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1">
                Vehicle Matrix <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-[#090d16] p-2 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 text-[10px] block">READS</span>
              <span className="text-base font-bold text-white">{anprSummary?.total_reads ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-rose-500/30">
              <span className="text-rose-400 text-[10px] block">WATCHLIST</span>
              <span className="text-base font-bold text-rose-400">{anprSummary?.watchlist_matches ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-emerald-500/30">
              <span className="text-emerald-400 text-[10px] block">AUTHORIZED</span>
              <span className="text-base font-bold text-emerald-400">{anprSummary?.authorized_count ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Face Analytics Card */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <h4 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              FACIAL ANALYTICS
            </h4>
            {onNavigateToFace && (
              <button onClick={onNavigateToFace} className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1">
                Identity Matrix <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-[#090d16] p-2 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 text-[10px] block">FACES</span>
              <span className="text-base font-bold text-white">{faceSummary?.total_faces ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-rose-500/30">
              <span className="text-rose-400 text-[10px] block">MATCHES</span>
              <span className="text-base font-bold text-rose-400">{faceSummary?.potential_matches ?? 0}</span>
            </div>
            <div className="bg-[#090d16] p-2 rounded-lg border border-emerald-500/30">
              <span className="text-emerald-400 text-[10px] block">CLEARANCE</span>
              <span className="text-base font-bold text-emerald-400">{faceSummary?.authorized_faces ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Recent Security Incidents Ticker */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            LATEST DETECTED THREAT INCIDENTS
          </h4>
          <span className="text-[11px] font-mono text-slate-400">Live Real-Time Stream</span>
        </div>

        {recentEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentEvents.map((evt) => (
              <div
                key={evt.event_id}
                onClick={() => setSelectedEvent(evt)}
                className="bg-[#090d16] border border-[#1e293b] hover:border-slate-700 p-3 rounded-xl cursor-pointer transition space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-sky-400">{evt.camera_id}</span>
                  <RiskBadge level={evt.risk_level} score={evt.risk_score} showIcon={false} />
                </div>
                <div className="text-xs font-bold text-white uppercase">
                  {evt.event_type.replace(/_/g, ' ')}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{evt.zone_name || 'Restricted Wire'}</span>
                  <span>{new Date(evt.last_updated_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              PERIMETER SECURE • NO ACTIVE THREAT INCIDENTS DETECTED
            </div>
            <p className="text-[11px] font-mono text-slate-500 max-w-xl mx-auto">
              Real-time threat events will stream here automatically when perimeter intrusions, unauthorized vehicle loitering, or anomalous target tracks are verified.
            </p>
          </div>
        )}
      </div>

      {/* Camera Infrastructure Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cameras */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-400">TOTAL FLEET</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cctv className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-white">{summary?.total_cameras ?? 0}</span>
            <span className="text-xs text-slate-400">IP Nodes Configured</span>
          </div>
          <div className="text-[11px] font-mono text-sky-400 flex items-center gap-1">
            <span>RTSP / FFMPEG Active</span>
          </div>
        </div>

        {/* Healthy Streams */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-emerald-400">HEALTHY STREAMS</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-emerald-400">{summary?.healthy ?? 0}</span>
            <span className="text-xs text-slate-400">Streaming at Nominal FPS</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400/80">
            Avg FPS: 25.0 • Low Latency
          </div>
        </div>

        {/* Degraded Streams */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-amber-400">DEGRADED / RETRYING</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-amber-400">{summary?.degraded ?? 0}</span>
            <span className="text-xs text-slate-400">Auto-Reconnecting</span>
          </div>
          <div className="text-[11px] font-mono text-amber-400/80">
            Backoff Polling Active
          </div>
        </div>

        {/* Offline Cameras */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-rose-400">OFFLINE NODES</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-rose-400">{summary?.offline ?? 0}</span>
            <span className="text-xs text-slate-400">Endpoints Unreachable</span>
          </div>
          <div className="text-[11px] font-mono text-rose-400/80">
            Requires Route Audit
          </div>
        </div>
      </div>

      {/* Featured Live Streams Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Active Surveillance Feeds ({featuredCameras.length})
          </h3>
          <button
            onClick={onNavigateToLive}
            className="text-xs text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 transition"
          >
            Full Video Wall <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {featuredCameras.length === 0 ? (
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-12 text-center text-slate-400 space-y-4">
            <Cctv className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-300">No active cameras streaming from border outposts</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Field officers onboard local cameras directly at their respective border checkposts. Feeds stream to HQ automatically once connected.
              </p>
            </div>
            {onNavigateToFederation && (
              <button
                onClick={onNavigateToFederation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold tracking-wider transition shadow-lg shadow-emerald-600/20"
              >
                Inspect National Border Map
              </button>
            )}
          </div>
        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredCameras.map((cam: Camera) => (
              <div key={cam.camera_id} className="cursor-pointer" onClick={() => onInspectCamera(cam)}>
                <LiveVideoPlayer camera={cam} showControls={true} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outpost Intelligence Dispatches & Daily SITREPs Feed */}
      <HQDispatchesSitrepPanel />

      {/* Event Details Modal */}

      {selectedEvent && (
        <EventDetailModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
          onStatusUpdated={loadDashboardData}
        />
      )}
    </div>
  );
};
