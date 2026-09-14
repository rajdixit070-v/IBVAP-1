import React, { useState, useEffect, useMemo } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { SecurityEvent, SecurityEventsSummary } from '../types/event';
import { eventService, SecurityEventsWebSocket } from '../services/eventService';
import { federationService } from '../services/federationService';
import { incidentService } from '../services/incidentService';
import { dispatchService } from '../services/dispatchService';
import { zoneService } from '../services/zoneService';
import { alertSoundService } from '../services/alertSoundService';
import { BOP } from '../types/federation';
import { Alert } from '../types/incident';
import { BOPDispatch } from '../types/dispatch';
import { SecurityZone } from '../types/zone';
import { RiskBadge } from '../components/events/RiskBadge';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { HQDispatchesSitrepPanel } from '../components/dispatches/HQDispatchesSitrepPanel';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { COMPREHENSIVE_CHECKPOSTS } from '../constants/checkposts';
import { useAuth } from '../context/AuthContext';
import {
  Zap,
  Cctv,
  ShieldAlert,
  Clock,
  Shield,
  Globe,
  FolderLock,
  ShieldCheck,
  Flame,
  Radio,
  X,
  Send,
  RefreshCw,
  Lock,
  Activity,
  ArrowUpRight,
  Layers,
  CheckCircle2,
  Volume2,
  Eye,
  EyeOff,
  Video
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
  onNavigateToHealth?: () => void;
  onNavigateToPredictive?: () => void;
  onNavigateToDrones?: () => void;
  onNavigateToGIS?: () => void;
  onNavigateToPTZ?: () => void;
  onNavigateToThermal?: () => void;
  onNavigateToBehaviour?: () => void;
  onInspectCamera: (camera: Camera) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToLive,
  onNavigateToSOC,
  onNavigateToFederation,
  onNavigateToEvidence,
  onNavigateToSecurity,
  onNavigateToIntelligence,
  onInspectCamera
}) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';

  // Federation & Outpost Data
  const [bops, setBops] = useState<BOP[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dispatches, setDispatches] = useState<BOPDispatch[]>([]);
  const [eventsSummary, setEventsSummary] = useState<SecurityEventsSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [postZones, setPostZones] = useState<SecurityZone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [sirenActive, setSirenActive] = useState(false);

  // Tab Navigation for Commander
  type CommanderTab = 'FEEDS' | 'THREATS' | 'TRIPWIRES' | 'SITREPS';
  const [activeTab, setActiveTab] = useState<CommanderTab>('FEEDS');
  const [threatFilter, setThreatFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'RESOLVED'>('ALL');

  const { cameras, summary } = useCameras();

  // Dynamic Commander Outpost Resolution (Supports ANY logged-in Commander)
  const currentBop = useMemo(() => {
    if (isSuperAdmin) return bops[0] || null;
    if (bops.length > 0) {
      return bops[0];
    }
    return null;
  }, [bops, isSuperAdmin]);

  // Commander Identity - dynamically adapts to whoever logs in
  const commanderScope = (user?.scope_id && user?.scope_id !== '*') ? user.scope_id : (currentBop?.bop_id || 'BOP-WAGAH');

  const matchedCommanderPost = useMemo(() => {
    const scopeLower = commanderScope.toLowerCase();
    const postNameLower = (user?.post_name || '').toLowerCase();

    return COMPREHENSIVE_CHECKPOSTS.find(cp =>
      cp.id.toLowerCase() === scopeLower ||
      cp.code.toLowerCase() === scopeLower ||
      (postNameLower && cp.name.toLowerCase().includes(postNameLower))
    ) || COMPREHENSIVE_CHECKPOSTS[0];
  }, [commanderScope, user?.post_name]);

  const commanderPostName = currentBop?.name || user?.post_name || matchedCommanderPost.name;
  const commanderSector = currentBop?.location || user?.sector || matchedCommanderPost.sector || 'Frontier Sector';
  const commanderLat = currentBop?.latitude ?? matchedCommanderPost.latitude ?? 31.6048;
  const commanderLng = currentBop?.longitude ?? matchedCommanderPost.longitude ?? 74.5731;

  // Dynamically filter cameras for the logged-in Commander's post
  const scopedCameras = useMemo(() => {
    if (isSuperAdmin) return cameras;
    const postLower = commanderPostName.toLowerCase();
    const scopeLower = commanderScope.toLowerCase();

    const filtered = cameras.filter(c => {
      const bopSite = (c.bop_site || '').toLowerCase();
      const camId = (c.camera_id || '').toLowerCase();
      return (
        bopSite.includes(postLower) ||
        bopSite.includes(scopeLower) ||
        camId.includes(scopeLower) ||
        (c.bop_id && c.bop_id.toLowerCase() === scopeLower)
      );
    });
    return filtered.length > 0 ? filtered : cameras;
  }, [cameras, isSuperAdmin, commanderPostName, commanderScope]);

  // Dynamically filter alerts for the logged-in Commander's post
  const scopedAlerts = useMemo(() => {
    if (isSuperAdmin) return alerts;
    const postLower = commanderPostName.toLowerCase();
    const scopeLower = commanderScope.toLowerCase();

    return alerts.filter(a => {
      const bopSite = (a.bop_site || '').toLowerCase();
      return bopSite.includes(postLower) || bopSite.includes(scopeLower) || scopedCameras.some(c => c.camera_id === a.camera_id);
    });
  }, [alerts, isSuperAdmin, commanderPostName, commanderScope, scopedCameras]);

  // Filtered alerts for Threat Alarms tab
  const filteredAlerts = useMemo(() => {
    if (threatFilter === 'ALL') return scopedAlerts;
    if (threatFilter === 'RESOLVED') return scopedAlerts.filter(a => a.status === 'RESOLVED');
    if (threatFilter === 'CRITICAL') return scopedAlerts.filter(a => a.priority === 'CRITICAL');
    if (threatFilter === 'HIGH') return scopedAlerts.filter(a => a.priority === 'HIGH');
    return scopedAlerts;
  }, [scopedAlerts, threatFilter]);

  // Dynamically filter recent events at this post
  const scopedEvents = useMemo(() => {
    if (isSuperAdmin) return recentEvents;
    const postLower = commanderPostName.toLowerCase();
    const scopeLower = commanderScope.toLowerCase();

    return recentEvents.filter(e => {
      const camId = (e.camera_id || '').toLowerCase();
      const zoneName = (e.zone_name || '').toLowerCase();
      return (
        zoneName.includes(postLower) ||
        zoneName.includes(scopeLower) ||
        camId.includes(scopeLower) ||
        camId.includes(postLower) ||
        scopedCameras.some(c => c.camera_id === e.camera_id)
      );
    });
  }, [recentEvents, isSuperAdmin, scopedCameras, commanderPostName, commanderScope]);

  // Live state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [qrtBroadcastSuccess, setQrtBroadcastSuccess] = useState<string | null>(null);

  // SITREP Modal State
  const [sitrepModalOpen, setSitrepModalOpen] = useState<boolean>(false);
  const [sitrepTitle, setSitrepTitle] = useState<string>('');
  const [sitrepSummaryText, setSitrepSummaryText] = useState<string>('');
  const [sitrepPriority, setSitrepPriority] = useState<string>('URGENT');

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [eventsData, bopList, alertList, dispList] = await Promise.all([
        eventService.getSummary().catch(() => null),
        federationService.listBOPs().catch(() => []),
        incidentService.getAlerts({ limit: 50 }).catch(() => []),
        dispatchService.listDispatches().catch(() => [])
      ]);
      if (eventsData) {
        setEventsSummary(eventsData);
        setRecentEvents(eventsData.recent_events || []);
      }
      if (bopList) setBops(bopList);
      if (alertList) setAlerts(alertList);
      if (dispList) setDispatches(dispList);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    }
  };

  const loadPostZones = async () => {
    if (scopedCameras.length === 0) return;
    setLoadingZones(true);
    try {
      const zList = await zoneService.getZones(scopedCameras[0].camera_id);
      setPostZones(zList);
    } catch (e) {
      console.error('Failed to load zones for checkpost:', e);
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const ws = new SecurityEventsWebSocket(() => {
      loadDashboardData();
    });
    const onRefresh = () => loadDashboardData();
    window.addEventListener('ibvap:refresh-all', onRefresh);
    window.addEventListener('ibvap:alert-received', onRefresh);
    const interval = setInterval(loadDashboardData, 6000);
    return () => {
      ws.close();
      window.removeEventListener('ibvap:refresh-all', onRefresh);
      window.removeEventListener('ibvap:alert-received', onRefresh);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (scopedCameras.length > 0) {
      loadPostZones();
    }
  }, [scopedCameras]);

  // Update Priority SLA live with backend
  const handleUpdatePriority = async (newPriority: 'NORMAL' | 'HIGH' | 'CRITICAL') => {
    const targetBopId = currentBop?.bop_id || commanderScope;
    setIsUpdatingPriority(true);
    try {
      const updated = await federationService.updateBOP(targetBopId, {
        operational_priority: newPriority
      });
      setBops(prev => prev.map(b => b.bop_id === updated.bop_id ? updated : b));
      setActionNotice(`Checkpost priority SLA updated to ${newPriority} and synchronized with Delhi Central HQ.`);
      setTimeout(() => setActionNotice(null), 5000);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
    } catch (err) {
      console.error('Failed to update priority:', err);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  // Trigger QRT broadcast
  const handleBroadcastQRT = () => {
    alertSoundService.playAlarm('CRITICAL');
    setQrtBroadcastSuccess(`PRIORITY QRT DISPATCHED // Immediate tactical reinforcement signal transmitted to ${commanderPostName} sentry units.`);
    setTimeout(() => setQrtBroadcastSuccess(null), 5000);
  };

  // Sound Perimeter Siren
  const handleSoundPerimeterSiren = () => {
    setSirenActive(true);
    alertSoundService.playAlarm('CRITICAL');
    alertSoundService.speakVoiceAlert(`Perimeter acoustic warning triggered at ${commanderPostName}. Sentry force take alert positions.`);
    setActionNotice('CHECKPOST PERIMETER SIREN SOUNDING (ACOUSTIC WARNING)!');
    setTimeout(() => {
      setSirenActive(false);
      setActionNotice(null);
    }, 4000);
  };

  // Real API Action: Resolve Alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      await incidentService.resolveAlert(alertId, 'Threat contained and verified by Checkpost Commander');
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, status: 'RESOLVED' } : a));
      setActionNotice(`Alert ${alertId} resolved and logged to Central HQ forensic registry.`);
      setTimeout(() => setActionNotice(null), 4000);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // Real API Action: Arm / Disarm Virtual Zone
  const handleToggleZone = async (zone: SecurityZone) => {
    try {
      const updated = await zoneService.updateZone(zone.zone_id, { enabled: !zone.enabled });
      setPostZones(prev => prev.map(z => z.zone_id === updated.zone_id ? updated : z));
      setActionNotice(`Tripwire '${zone.name}' ${!zone.enabled ? 'ARMED' : 'STANDBY'}. Ground plane updated.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Failed to toggle zone:', err);
    }
  };

  // Open SITREP modal
  const handleOpenSitrepModal = (initialTitleText?: string, initialSummaryContent?: string) => {
    setSitrepTitle(initialTitleText || `Shift SITREP // ${commanderPostName}`);
    setSitrepSummaryText(
      initialSummaryContent ||
      `Perimeter situation report from ${commanderPostName} (${commanderSector}). Operational Priority: ${currentBop?.operational_priority || 'NORMAL'}. ${scopedCameras.length} cameras active, ${scopedAlerts.filter(a => a.status !== 'RESOLVED').length} active alarms reported.`
    );
    setSitrepPriority('URGENT');
    setSitrepModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* ========================================================================= */}
      {/* TOP HEADER: DYNAMIC DUTY STATION & ACTIONS */}
      {/* ========================================================================= */}
      <div className="bg-[#0d1322] border border-[#1e293b] rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            {isSuperAdmin ? <Globe className="w-6 h-6 animate-spin-slow" /> : <ShieldCheck className="w-6 h-6 text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[11px] font-bold border border-sky-500/30">
                {isSuperAdmin ? 'DELHI HQ CENTRAL COMMAND' : 'TACTICAL GROUND OPERATIONS'}
              </span>
              {isSuperAdmin ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md">
                  ALL 6 FRONTIERS • NATIONAL DEFENSE
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  ASSIGNED JURISDICTION: {commanderPostName.toUpperCase()} [LOCKED]
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-white tracking-wide uppercase mt-1">
              {isSuperAdmin
                ? 'IBVAP Central Command // Multi-Site Surveillance Matrix'
                : `Checkpost Tactical Operations // ${commanderPostName}`}
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5 max-w-2xl">
              {isSuperAdmin
                ? 'National federated border oversight, multi-site checkpost triage, zero-trust officer governance, and encrypted forensic evidence custody.'
                : `Ground-level surveillance posture, live perimeter SLA, active sensors, and encrypted military uplink under ${commanderSector}.`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real-time Regional Clock HUD (IST) */}
          <div className="hidden xl:flex items-center gap-2 bg-[#111a2e] border border-cyan-500/30 px-3 py-1.5 rounded-xl shadow-inner text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-bold tracking-wider">
              {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700/80 font-bold">
              IST
            </span>
          </div>

          {isSuperAdmin ? (
            <>
              {onNavigateToFederation && (
                <button
                  onClick={onNavigateToFederation}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>BORDER MAP</span>
                </button>
              )}
              {onNavigateToSOC && (
                <button
                  onClick={onNavigateToSOC}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>SOC MATRIX</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Sound Siren Button */}
              <button
                type="button"
                onClick={handleSoundPerimeterSiren}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                  sirenActive
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/50 animate-pulse'
                    : 'bg-[#141e33] hover:bg-[#1a2744] text-rose-300 border-rose-500/40'
                }`}
                title="Sound checkpost perimeter acoustic warning horn"
              >
                <Volume2 className={`w-3.5 h-3.5 ${sirenActive ? 'animate-bounce' : ''}`} />
                <span>{sirenActive ? 'SIREN ACTIVE...' : 'PERIMETER SIREN'}</span>
              </button>

              <button
                onClick={() => handleOpenSitrepModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg cursor-pointer whitespace-nowrap"
                title="Transmit Tactical Situation Report to Delhi Central HQ"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ TRANSMIT SITREP TO HQ</span>
              </button>

              {onNavigateToFederation && (
                <button
                  onClick={onNavigateToFederation}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-mono font-bold transition border border-emerald-500/40 cursor-pointer"
                  title="Open Checkposts & Tactical Border Map"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>BORDER MAP</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={loadDashboardData}
            title="Refresh Checkpost Telemetry"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-4 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 text-cyan-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {qrtBroadcastSuccess && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-300 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span>{qrtBroadcastSuccess}</span>
          </div>
          <button onClick={() => setQrtBroadcastSuccess(null)} className="p-1 text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMMANDER TACTICAL COCKPIT (Functional Working Tabs, Zero IT Jargon) */}
      {/* ========================================================================= */}
      {!isSuperAdmin && (
        <div className="space-y-6">
          {/* OUTPOST HERO & OPERATIONAL PRIORITY SLA CARD (Always Visible) */}
          <div className="bg-[#0d1322] border border-cyan-800/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </span>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    {commanderPostName}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {currentBop?.code || matchedCommanderPost.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {currentBop?.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400">
                  Frontier Sector: <strong className="text-cyan-400">{commanderSector}</strong> • Post ID: <strong className="text-white">{currentBop?.bop_id || commanderScope}</strong> • GPS: <strong className="text-white">{commanderLat.toFixed(4)}°N, {commanderLng.toFixed(4)}°E</strong>
                </p>
              </div>

              {/* Priority SLA Selector & QRT Emergency Alert */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-800 p-1.5 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 font-bold px-1 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    PRIORITY SLA:
                  </span>
                  <button
                    disabled={isUpdatingPriority}
                    onClick={() => handleUpdatePriority('NORMAL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      currentBop?.operational_priority === 'NORMAL' || !currentBop?.operational_priority
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    🟢 NORMAL
                  </button>
                  <button
                    disabled={isUpdatingPriority}
                    onClick={() => handleUpdatePriority('HIGH')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      currentBop?.operational_priority === 'HIGH'
                        ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ⚠️ ELEVATED
                  </button>
                  <button
                    disabled={isUpdatingPriority}
                    onClick={() => handleUpdatePriority('CRITICAL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      currentBop?.operational_priority === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md animate-pulse'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    🚨 CRITICAL
                  </button>
                </div>

                <button
                  onClick={handleBroadcastQRT}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-md shadow-rose-950/40"
                  title="Broadcast immediate QRT tactical reinforcement signal"
                >
                  <Zap className="w-3.5 h-3.5 text-rose-400" />
                  <span>DISPATCH QRT</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 REAL TELEMETRY METRICS CARDS (Always Visible) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-mono uppercase">Surveillance Fleet</span>
                <Cctv className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {scopedCameras.length} <span className="text-xs font-normal text-slate-400">Cameras</span>
              </div>
              <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                <span className="text-emerald-400">{scopedCameras.filter(c => c.status === 'ONLINE' || c.status === 'HEALTHY' || c.enabled).length} Streaming Live</span>
                <span className="text-slate-500">{scopedCameras.filter(c => c.status === 'OFFLINE').length} Offline</span>
              </div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-mono uppercase">Active Threat Alarms</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {scopedAlerts.filter(a => a.status !== 'RESOLVED').length} <span className="text-xs font-normal text-slate-400">Unresolved</span>
              </div>
              <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                <span className="text-rose-400 font-bold">
                  {scopedAlerts.filter(a => a.priority === 'CRITICAL' && a.status !== 'RESOLVED').length} Critical
                </span>
                <span className="text-amber-400">
                  {scopedAlerts.filter(a => a.priority === 'HIGH' && a.status !== 'RESOLVED').length} High
                </span>
                <span className="text-emerald-400">
                  {scopedAlerts.filter(a => a.status === 'RESOLVED').length} Resolved
                </span>
              </div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-mono uppercase">Perimeter Tripwires</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                <span>{postZones.filter(z => z.enabled).length} ZONES ARMED</span>
              </div>
              <div className="text-[10px] font-mono mt-1 text-slate-400">
                Ground Plane Active • Optical Intersect
              </div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-mono uppercase">Station Commander</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-lg font-bold font-mono text-white truncate">
                {user?.username || 'Commander In-Charge'}
              </div>
              <div className="text-[10px] font-mono mt-1 text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Station Chief • Shift Active</span>
              </div>
            </div>
          </div>

          {/* COMMANDER TACTICAL TABS BAR */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            <button
              onClick={() => setActiveTab('FEEDS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shrink-0 border ${
                activeTab === 'FEEDS'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-950/50'
                  : 'bg-[#0d1322] text-slate-400 hover:text-white border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-cyan-400" />
              <span>1. SENTRY SURVEILLANCE & FEEDS</span>
            </button>

            <button
              onClick={() => setActiveTab('THREATS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shrink-0 border ${
                activeTab === 'THREATS'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-950/50'
                  : 'bg-[#0d1322] text-slate-400 hover:text-white border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>2. ACTIVE THREAT ALARMS & TRIAGE</span>
              {scopedAlerts.filter(a => a.status !== 'RESOLVED').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-bold border border-rose-500/40">
                  {scopedAlerts.filter(a => a.status !== 'RESOLVED').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('TRIPWIRES')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shrink-0 border ${
                activeTab === 'TRIPWIRES'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-950/50'
                  : 'bg-[#0d1322] text-slate-400 hover:text-white border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. VIRTUAL TRIPWIRES & DEFENSE</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40">
                {postZones.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('SITREPS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shrink-0 border ${
                activeTab === 'SITREPS'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-lg shadow-indigo-950/50'
                  : 'bg-[#0d1322] text-slate-400 hover:text-white border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span>4. HQ SITREPS & DISPATCHES</span>
              {dispatches.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-500/40">
                  {dispatches.length}
                </span>
              )}
            </button>
          </div>

          {/* ================================================================= */}
          {/* TAB 1: SENTRY SURVEILLANCE & FEEDS */}
          {/* ================================================================= */}
          {activeTab === 'FEEDS' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Primary Video Feed Box */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Cctv className="w-4 h-4 text-sky-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Checkpost Sentry Surveillance Video Wall ({scopedCameras.length} Cameras)
                    </h3>
                  </div>
                  {onNavigateToLive && (
                    <button
                      onClick={onNavigateToLive}
                      className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      Multi-Cam Full Video Wall <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {scopedCameras.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {scopedCameras.slice(0, 2).map((cam) => (
                      <div key={cam.camera_id} className="bg-[#070b14] border border-slate-800 rounded-xl overflow-hidden shadow-md">
                        <div className="p-3 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            {cam.camera_name}
                          </span>
                          <span className="text-sky-400 font-bold">{cam.camera_id}</span>
                        </div>
                        <div className="aspect-video bg-black relative">
                          <LiveVideoPlayer camera={cam} showControls={true} />
                        </div>
                        <div className="p-2.5 text-[11px] font-mono text-slate-400 flex items-center justify-between bg-slate-950">
                          <span>STREAM: <strong className="text-slate-200">{cam.stream_type || 'RTSP'}</strong></span>
                          <span>SITE: <strong className="text-slate-200">{cam.bop_site || commanderPostName}</strong></span>
                          <button
                            onClick={() => onInspectCamera(cam)}
                            className="text-cyan-400 hover:underline cursor-pointer font-bold"
                          >
                            Inspect Sensor ➔
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-2 bg-[#070b14] rounded-xl border border-slate-800">
                    <Cctv className="w-10 h-10 text-slate-600 mx-auto" />
                    <p>No active sentry cameras registered for {commanderPostName}.</p>
                    <p className="text-[10px] text-slate-600">Cameras onboarded by Central HQ or local officers will stream live here automatically.</p>
                  </div>
                )}
              </div>

              {/* Recent Detected Activity & Intrusion Events */}
              {scopedEvents.length > 0 && (
                <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-sky-400" />
                      Recent Verified Intrusion Events ({scopedEvents.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">Click any event to inspect forensic evidence</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scopedEvents.slice(0, 6).map((evt) => (
                      <div
                        key={evt.event_id}
                        onClick={() => setSelectedEvent(evt)}
                        className="bg-[#070b14] border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl cursor-pointer transition space-y-2"
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
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: ACTIVE THREAT ALARMS & TRIAGE (WITH REAL RESOLVE API) */}
          {/* ================================================================= */}
          {activeTab === 'THREATS' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Threat Severity Filters Bar */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    SEVERITY FILTER:
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['ALL', 'CRITICAL', 'HIGH', 'RESOLVED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setThreatFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        threatFilter === f
                          ? f === 'CRITICAL'
                            ? 'bg-rose-600 text-white border-rose-400 shadow-md'
                            : f === 'HIGH'
                            ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                            : f === 'RESOLVED'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                            : 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                          : 'bg-[#070b14] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {f} ({f === 'ALL' ? scopedAlerts.length : f === 'RESOLVED' ? scopedAlerts.filter(a => a.status === 'RESOLVED').length : scopedAlerts.filter(a => a.priority === f).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Threat Alarms Table with Real Functional Actions */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Active Threat Alarms Log ({filteredAlerts.length})</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Real-Time Optical Tripwires & Sensor Alerts
                  </span>
                </div>

                {filteredAlerts.length > 0 ? (
                  <div className="divide-y divide-slate-800/80">
                    {filteredAlerts.map(alt => (
                      <div key={alt.alert_id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              alt.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' :
                              alt.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {alt.priority}
                            </span>
                            <span className="text-xs font-bold text-white font-mono">{alt.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {alt.alert_id}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                              alt.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {alt.status}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-400">
                            Target Camera: <strong className="text-sky-400">{alt.camera_id}</strong> • Location: <strong className="text-slate-300">{alt.bop_site}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {alt.status !== 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() => handleResolveAlert(alt.alert_id)}
                              className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition"
                              title="Mark threat as resolved and contained"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>RESOLVE THREAT</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenSitrepModal(`ESCALATION // ${alt.title}`, `Escalating threat alarm ${alt.alert_id} from ${commanderPostName}. Camera: ${alt.camera_id}. Severity: ${alt.priority}. Immediate situation escalation to Delhi Central HQ.`)}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-950/50"
                            title="Escalate directly to Delhi Central HQ as a formal SITREP"
                          >
                            <Send className="w-3 h-3" />
                            <span>ESCALATE SITREP</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      PERIMETER SECURE • NO ACTIVE THREAT ALARMS
                    </div>
                    <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                      All perimeter tripwires, optical surveillance, and zero-line sentry sectors are clear of verified intrusions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: VIRTUAL TRIPWIRES & DEFENSE (WITH REAL ARM/DISARM API) */}
          {/* ================================================================= */}
          {activeTab === 'TRIPWIRES' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Virtual Perimeter Tripwires & Security Zones ({postZones.length})
                    </h3>
                  </div>
                  {onNavigateToIntelligence && (
                    <button
                      onClick={onNavigateToIntelligence}
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      Draw & Calibrate Zones on Video Wall <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {loadingZones ? (
                  <div className="py-10 text-center text-xs font-mono text-slate-500">
                    Loading virtual perimeter zones...
                  </div>
                ) : postZones.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {postZones.map(zone => (
                      <div
                        key={zone.zone_id}
                        className={`p-4 rounded-xl border transition space-y-2.5 ${
                          zone.enabled
                            ? 'bg-[#0f172a] border-slate-700 shadow-md'
                            : 'bg-[#090d16] border-slate-800/80 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{zone.name}</span>
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                zone.zone_type === 'RESTRICTED'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {zone.zone_type}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              Camera: {zone.camera_id} • {zone.polygon?.length || 0} Polygon Vertices
                            </span>
                          </div>

                          {/* Real Toggle Action */}
                          <button
                            type="button"
                            onClick={() => handleToggleZone(zone)}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer border ${
                              zone.enabled
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                            title={zone.enabled ? 'Click to disarm this tripwire' : 'Click to arm this tripwire'}
                          >
                            {zone.enabled ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{zone.enabled ? 'ARMED' : 'STANDBY'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className="text-slate-400">MONITORED:</span>
                          {(zone.monitored_classes || ['person', 'vehicle']).map(cls => (
                            <span key={cls} className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                              {cls}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2 bg-[#070b14] rounded-xl border border-slate-800">
                    <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs font-mono text-slate-400">No virtual tripwires configured yet for this post.</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Use the 'Virtual Perimeter / Tripwires' module in the sidebar to draw polygon tripwires along the boundary fence.
                    </p>
                    {onNavigateToIntelligence && (
                      <button
                        onClick={onNavigateToIntelligence}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-md cursor-pointer mt-2"
                      >
                        + Configure Virtual Tripwires
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: HQ SITREPS & DISPATCHES */}
          {/* ================================================================= */}
          {activeTab === 'SITREPS' && (
            <div className="space-y-6 animate-in fade-in">
              {/* SITREP Transmission Header Card */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold border border-indigo-500/30">
                      SITREP COMMUNICATIONS
                    </span>
                    <span className="text-slate-400 font-mono text-xs">
                      • RECIPIENT: DELHI CENTRAL HQ ADMIN
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Outpost SITREP Transmission Log & Military Dispatches
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Transmit official military Situation Reports directly to Delhi Central Command. Every transmission includes cryptographic verification.
                  </p>
                </div>

                <button
                  onClick={() => handleOpenSitrepModal()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-indigo-950/60 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>+ TRANSMIT NEW SITREP TO HQ</span>
                </button>
              </div>

              {/* Transmitted SITREPs Log */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    Transmitted Outpost Dispatches Log ({dispatches.length})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Direct socket link to Delhi HQ
                  </span>
                </div>

                {dispatches.length > 0 ? (
                  <div className="divide-y divide-slate-800/80">
                    {dispatches.map(disp => (
                      <div key={disp.dispatch_id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 border border-indigo-800 text-indigo-300">
                              {disp.priority}
                            </span>
                            <span className="text-xs font-bold text-white font-mono">{disp.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {disp.dispatch_id}</span>
                          </div>
                          <p className="text-xs font-mono text-slate-400 max-w-2xl">{disp.summary}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-emerald-400 font-mono font-bold block">
                            DELIVERED // DELHI HQ
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(disp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(disp.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs font-mono text-slate-500 space-y-2">
                    <p>No shift reports submitted yet for this checkpost.</p>
                    <p className="text-[11px] text-slate-600">Click '+ TRANSMIT NEW SITREP TO HQ' above to send initial operational briefing.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CENTRAL HQ ADMIN FULL WAR ROOM VIEW (isSuperAdmin Only) */}
      {/* ========================================================================= */}
      {isSuperAdmin && (
        <div className="space-y-6 animate-fade-in">
          {/* Executive Summary Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0d1322] border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono font-semibold">TOTAL FLEET</span>
                <Cctv className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-white">{summary?.total_cameras ?? 0}</span>
                <span className="text-xs text-slate-400">Cameras Configured</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400">{summary?.healthy ?? 0} Streaming Live</div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono font-semibold">BORDER OUTPOSTS</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-white">{bops.length}</span>
                <span className="text-xs text-slate-400">All Frontiers</span>
              </div>
              <div className="text-[11px] font-mono text-cyan-400">100% Calibrated with Live GPS</div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono font-semibold">CRITICAL THREATS</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-rose-400">{eventsSummary?.critical_count ?? 0}</span>
                <span className="text-xs text-slate-400">Alarms Detected</span>
              </div>
              <div className="text-[11px] font-mono text-amber-400">{eventsSummary?.high_count ?? 0} High Severity</div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-mono font-semibold">SENTRY COVERAGE</span>
                <Radio className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-purple-400">{scopedCameras.length}</span>
                <span className="text-xs text-slate-400">Active Surveillance Turrets</span>
              </div>
              <div className="text-[11px] font-mono text-purple-400/80">Zero Dead Zone AI Tracking</div>
            </div>
          </div>

          {/* HQ Central Governance & Command Modules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2 font-mono">
                <Shield className="w-4 h-4 text-sky-400" />
                HQ Central Governance & Command Modules
              </h3>
              <span className="text-xs font-mono text-slate-400">Level-5 Central Supreme Authority</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {onNavigateToSOC && (
                <button
                  onClick={onNavigateToSOC}
                  className="group p-4 bg-[#0d1322] hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
                >
                  <div className="p-2 w-fit rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 group-hover:scale-110 transition">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-rose-400 transition">SOC Threat Matrix</div>
                    <div className="text-[10px] text-slate-400">National threat triage</div>
                  </div>
                </button>
              )}

              {onNavigateToFederation && (
                <button
                  onClick={onNavigateToFederation}
                  className="group p-4 bg-[#0d1322] hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
                >
                  <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">Federated Map</div>
                    <div className="text-[10px] text-slate-400">Multi-site border command</div>
                  </div>
                </button>
              )}

              {onNavigateToSecurity && (
                <button
                  onClick={onNavigateToSecurity}
                  className="group p-4 bg-[#0d1322] hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
                >
                  <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-purple-400 transition">Officer Management</div>
                    <div className="text-[10px] text-slate-400">Assign BOPs & credentials</div>
                  </div>
                </button>
              )}

              {onNavigateToEvidence && (
                <button
                  onClick={onNavigateToEvidence}
                  className="group p-4 bg-[#0d1322] hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition text-left space-y-2 cursor-pointer shadow-lg"
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
            </div>
          </div>

          {/* Active Border Video Wall Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2 font-mono uppercase">
                <Layers className="w-4 h-4 text-sky-400" />
                Active Border Surveillance Feeds ({cameras.slice(0, 4).length})
              </h3>
              {onNavigateToLive && (
                <button
                  onClick={onNavigateToLive}
                  className="text-xs text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 transition cursor-pointer"
                >
                  Full Video Wall <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cameras.slice(0, 4).map((cam: Camera) => (
                <div key={cam.camera_id} className="cursor-pointer" onClick={() => onInspectCamera(cam)}>
                  <LiveVideoPlayer camera={cam} showControls={true} />
                </div>
              ))}
            </div>
          </div>

          {/* Inbound Dispatches & Daily SITREPs Panel */}
          <HQDispatchesSitrepPanel />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
          onStatusUpdated={loadDashboardData}
        />
      )}

      {/* SITREP Transmission Modal */}
      <DispatchSitrepModal
        isOpen={sitrepModalOpen}
        onClose={() => setSitrepModalOpen(false)}
        onSuccess={() => {
          loadDashboardData();
          setActionNotice('Tactical SITREP successfully transmitted to Delhi Central HQ Admin!');
        }}
        initialTitle={sitrepTitle}
        initialSummary={sitrepSummaryText}
        initialPriority={sitrepPriority}
      />
    </div>
  );
};
