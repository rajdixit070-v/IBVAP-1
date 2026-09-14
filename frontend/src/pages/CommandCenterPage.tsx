import React, { useState, useEffect, useMemo } from 'react';
import { Alert, Incident } from '../types/incident';
import { Camera } from '../types/camera';
import { useCameras } from '../context/CameraContext';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { SituationalMapModal } from '../components/incidents/SituationalMapModal';
import {
  ShieldAlert,
  Radio,
  MapPin,
  Flame,
  RefreshCw,
  BellRing,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Eye,
  Filter,
  Layers,
  Search,
  Crosshair,
  Activity,
  FileCheck,
  Send,
  Volume2,
  VolumeX
} from 'lucide-react';

interface CommandCenterPageProps {
  onBackToDashboard?: () => void;
  onNavigateToIncidents?: () => void;
}

const SECTOR_DEFINITIONS = [
  { id: 'ALL', label: 'All Frontiers' },
  { id: 'Punjab', label: 'Punjab Frontier', matchers: ['wagah', 'punjab', 'attari', 'fazilka', 'hussaini', 'sadqi', 'khemkaran', 'dbn', 'gurdaspur'] },
  { id: 'Rajasthan', label: 'Rajasthan Frontier', matchers: ['jaisalmer', 'rajasthan', 'longewala', 'tanot', 'munabao', 'barmer', 'bikaner', 'ramgarh', 'hindumal'] },
  { id: 'Jammu', label: 'Jammu & Kashmir', matchers: ['jammu', 'kashmir', 'rs pura', 'suchetgarh', 'samba', 'hiranagar', 'akhnoor', 'poonch', 'uri', 'kupwara'] },
  { id: 'Ladakh', label: 'Ladakh Sector', matchers: ['ladakh', 'dbo', 'galwan', 'pangong', 'chushul', 'nyoma', 'demchok', 'kargil'] },
  { id: 'Gujarat', label: 'Gujarat / Kutch', matchers: ['gujarat', 'kutch', 'harami', 'sir creek', 'khavda', 'lakhpat', 'vighakot'] },
  { id: 'Eastern', label: 'Eastern Frontier', matchers: ['petrapole', 'bengal', 'assam', 'meghalaya', 'dawki', 'hili', 'changrabandha', 'tripura', 'akhaura', 'moreh'] },
];

const THREAT_CATEGORIES = [
  { id: 'ALL', label: 'All Threat Types' },
  { id: 'PERIMETER', label: '🚨 Perimeter Breach / Fence', matchers: ['fence', 'perimeter', 'cut', 'wire', 'tripwire', 'breach', 'barrier'] },
  { id: 'WEAPONS', label: '🔫 Armed Suspect / Weapon', matchers: ['weapon', 'gun', 'firearm', 'armed', 'rifle', 'pistol'] },
  { id: 'DRONE', label: '🛸 Drone / UAV Air Threat', matchers: ['drone', 'uav', 'aerial', 'airdrop', 'quadcopter'] },
  { id: 'VEHICLE', label: '🚗 Vehicle / ANPR Alert', matchers: ['vehicle', 'car', 'truck', 'anpr', 'plate', 'speed', 'convoy'] },
  { id: 'INTRUSION', label: '👤 Intrusion / Infiltration', matchers: ['intrusion', 'infiltrat', 'person', 'trespass', 'crawling', 'loiter'] }
];

export const CommandCenterPage: React.FC<CommandCenterPageProps> = ({
  onBackToDashboard,
  onNavigateToIncidents
}) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const userBop = user?.scope_id && user?.scope_id !== '*' ? user.scope_id : null;
  const [sirenTesting, setSirenTesting] = useState(false);
  const { cameras } = useCameras();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  // Feedback State
  const [qrtSuccessMessage, setQrtSuccessMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSOCData();
    const interval = setInterval(loadSOCData, 4000);
    const onRefresh = () => loadSOCData();
    window.addEventListener('ibvap:refresh-all', onRefresh);
    window.addEventListener('ibvap:alert-received', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ibvap:refresh-all', onRefresh);
      window.removeEventListener('ibvap:alert-received', onRefresh);
    };
  }, []);

  const localCameras = useMemo(() => {
    if (isSuperAdmin || !userBop) return cameras;
    const bopLower = userBop.toLowerCase();
    const matched = cameras.filter((c: Camera) => {
      const site = (c.bop_site || '').toLowerCase();
      const cam = (c.camera_id || '').toLowerCase();
      return site.includes(bopLower) || bopLower.includes(site) || cam.includes(bopLower);
    });
    return matched.length > 0 ? matched : cameras;
  }, [cameras, isSuperAdmin, userBop]);

  useEffect(() => {
    const list = isSuperAdmin ? cameras : localCameras;
    if (list.length > 0 && !selectedCamera) {
      setSelectedCamera(list[0]);
    }
  }, [cameras, localCameras, selectedCamera, isSuperAdmin]);

  const loadSOCData = async () => {
    try {
      const [alertsData, incidentsData] = await Promise.all([
        incidentService.getAlerts({ limit: 100 }),
        incidentService.getIncidents({ limit: 50 })
      ]);
      setAlerts(alertsData);
      setIncidents(incidentsData);
    } catch (e) {
      console.error('Failed to load SOC Command Center data', e);
    } finally {
      setLoading(false);
    }
  };

  // Resolve which border sector an alert belongs to
  const resolveAlertSector = (alert: Alert): string => {
    const text = `${alert.bop_site || ''} ${alert.camera_id || ''} ${alert.title || ''}`.toLowerCase();
    for (const sec of SECTOR_DEFINITIONS) {
      if (sec.id === 'ALL') continue;
      if (sec.matchers?.some((m) => text.includes(m))) {
        return sec.id;
      }
    }
    return 'Other';
  };

  // Resolve threat category
  const resolveAlertCategory = (alert: Alert): string => {
    const text = `${alert.title || ''} ${alert.event_id || ''}`.toLowerCase();
    for (const cat of THREAT_CATEGORIES) {
      if (cat.id === 'ALL') continue;
      if (cat.matchers?.some((m) => text.includes(m))) {
        return cat.id;
      }
    }
    return 'INTRUSION';
  };

  // 1-Click Focus: Switch video player to this alert's camera
  const handleFocusCamera = (cameraId: string, bopSite?: string) => {
    const found = cameras.find(
      (c) => c.camera_id?.toLowerCase() === cameraId?.toLowerCase()
    );
    if (found) {
      setSelectedCamera(found);
    } else {
      setSelectedCamera({
        camera_id: cameraId,
        camera_name: `Border Sensor [${cameraId}]`,
        bop_site: bopSite || 'Border Outpost',
        rtsp_url: `http://localhost:8000/api/v1/cameras/${cameraId}/live`,
        status: 'ONLINE',
        is_ptz: false,
        created_at: new Date().toISOString()
      } as unknown as Camera);
    }

    const el = document.getElementById('primary-soc-video-feed');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setActionNotice(`Focused surveillance feed on sensor: ${cameraId}`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Acknowledge alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await incidentService.acknowledgeAlert(alertId, 'Central HQ SOC');
      setActionNotice(`Alert ${alertId} acknowledged by Central HQ`);
      setTimeout(() => setActionNotice(null), 3000);
      loadSOCData();
    } catch (e) {
      console.error('Failed to acknowledge alert', e);
    }
  };

  // Escalate alert
  const handleEscalateAlert = async (alertId: string) => {
    try {
      await incidentService.escalateAlert(alertId, 'Escalated to Sector Commander by Central HQ SOC');
      alertSoundService.playAlarm('CRITICAL');
      setActionNotice(`Alert ${alertId} escalated to Sector Tactical Command`);
      setTimeout(() => setActionNotice(null), 3000);
      loadSOCData();
    } catch (e) {
      console.error('Failed to escalate alert', e);
    }
  };

  // Resolve alert
  const handleResolveAlert = async (alertId: string) => {
    const notes = window.prompt(
      'Enter containment / SITREP resolution notes:',
      'Threat verified and contained by ground patrol. Nominal status restored.'
    );
    if (notes === null) return;

    try {
      await incidentService.resolveAlert(alertId, notes);
      setActionNotice(`Alert ${alertId} resolved and archived`);
      setTimeout(() => setActionNotice(null), 3000);
      loadSOCData();
    } catch (e) {
      console.error('Failed to resolve alert', e);
    }
  };

  // Test Local Post Siren Sound
  const toggleSirenSound = () => {
    if (!sirenTesting) {
      alertSoundService.testAlarm();
      setSirenTesting(true);
      setTimeout(() => {
        setSirenTesting(false);
      }, 3000);
    }
  };

  // Mobilize Local Checkpost Sentry / Ground Patrol
  const handleMobilizePostSentry = async () => {
    if (
      !window.confirm(
        `🚨 MOBILIZE CHECKPOST PATROL & SENTRIES?\n\nThis deploys the armed ground intercept sentry unit to the boundary fence at ${userBop || 'this checkpost'}.`
      )
    ) {
      return;
    }

    try {
      await incidentService.createIncident({
        title: `EMERGENCY SENTRY PATROL DEPLOYED - ${userBop || 'CHECKPOST'}`,
        description: `Checkpost Commander deployed emergency ground sentries and patrol for immediate perimeter intercept. Local audio siren activated.`,
        priority: 'CRITICAL',
        incident_type: 'SECURITY',
        camera_id: selectedCamera?.camera_id || 'LOCAL-POST-CAM',
        bop_site: userBop || selectedCamera?.bop_site || 'Border Checkpost',
        zone_name: 'Perimeter Fence Line',
        risk_score: 96
      });
      alertSoundService.playAlarm('CRITICAL');
      setQrtSuccessMessage(
        `POST SENTRY PATROL MOBILIZED AT ${userBop || 'CHECKPOST'}. SENTRY ACOUSTIC SIREN ACTIVE.`
      );
      setTimeout(() => setQrtSuccessMessage(null), 5000);
      loadSOCData();
    } catch (e) {
      console.error('Failed to mobilize post sentry', e);
    }
  };

  // Broadcast National QRT Directive
  const handleBroadcastQRT = async () => {
    if (
      !window.confirm(
        '🚨 INITIATE NATIONAL QRT MOBILIZATION?\n\nThis broadcasts an immediate Code Red tactical deployment directive to all frontier Quick Reaction Teams (QRT).'
      )
    ) {
      return;
    }

    try {
      await incidentService.createIncident({
        title: 'EMERGENCY NATIONAL QRT BROADCAST - SOC DIRECTIVE',
        description:
          'National SOC Central Command has mobilized Quick Reaction Teams (QRT) for immediate containment across threatened border outposts.',
        priority: 'CRITICAL',
        incident_type: 'SECURITY',
        camera_id: selectedCamera?.camera_id || 'HQ-SOC-MATRIX',
        bop_site: selectedCamera?.bop_site || 'NATIONAL-FRONTIER',
        zone_name: 'Frontier Perimeter',
        risk_score: 99
      });
      alertSoundService.playAlarm('CRITICAL');
      setQrtSuccessMessage(
        'NATIONAL QRT DIRECTIVE BROADCASTED SUCCESSFULLY. CODE RED MOBILIZATION ACTIVE.'
      );
      setTimeout(() => setQrtSuccessMessage(null), 5000);
      loadSOCData();
    } catch (e) {
      console.error('Failed to broadcast QRT', e);
    }
  };

  // Open incident detail modal
  const handleOpenIncidentDetail = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setDetailModalOpen(true);
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a: Alert) => {
      // Scope filter for ground Commander
      if (!isSuperAdmin && userBop) {
        const bopLower = userBop.toLowerCase();
        const site = (a.bop_site || '').toLowerCase();
        const cam = (a.camera_id || '').toLowerCase();
        const title = (a.title || '').toLowerCase();
        const matchesPost = site.includes(bopLower) || bopLower.includes(site) || cam.includes(bopLower) || title.includes(bopLower);
        // Only enforce if there are alerts matching this post; else keep visible for vigilance
        if (alerts.some(x => (x.bop_site || '').toLowerCase().includes(bopLower)) && !matchesPost) {
          return false;
        }
      }

      // Sector filter
      if (selectedSector !== 'ALL') {
        const sec = resolveAlertSector(a);
        if (sec !== selectedSector) return false;
      }

      // Priority filter
      if (selectedPriority !== 'ALL' && a.priority !== selectedPriority) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const cat = resolveAlertCategory(a);
        if (cat !== selectedCategory) return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'ACTIVE') {
          if (a.status !== 'NEW' && a.status !== 'ESCALATED') return false;
        } else if (a.status !== selectedStatus) {
          return false;
        }
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const combined = `${a.title} ${a.camera_id} ${a.bop_site} ${a.alert_id}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }, [alerts, selectedSector, selectedPriority, selectedCategory, selectedStatus, searchQuery]);

  // Sector Breakdown Telemetry
  const sectorCounts = useMemo(() => {
    const counts: Record<string, { total: number; critical: number }> = {};
    for (const sec of SECTOR_DEFINITIONS) {
      if (sec.id === 'ALL') continue;
      counts[sec.id] = { total: 0, critical: 0 };
    }

    for (const a of alerts) {
      const sec = resolveAlertSector(a);
      if (counts[sec]) {
        counts[sec].total += 1;
        if (a.priority === 'CRITICAL' && a.status !== 'RESOLVED') {
          counts[sec].critical += 1;
        }
      }
    }
    return counts;
  }, [alerts]);

  // High-Risk Checkposts (BOPs) with active alerts
  const highRiskCheckposts = useMemo(() => {
    const map = new Map<string, { bop: string; sector: string; count: number; maxRisk: number; cameraId: string }>();
    for (const a of alerts) {
      if (a.status === 'RESOLVED') continue;
      const bopName = a.bop_site || a.camera_id || 'Unknown Outpost';
      const existing = map.get(bopName);
      const sec = resolveAlertSector(a);
      if (existing) {
        existing.count += 1;
        if (a.risk_score > existing.maxRisk) existing.maxRisk = a.risk_score;
      } else {
        map.set(bopName, {
          bop: bopName,
          sector: sec,
          count: 1,
          maxRisk: a.risk_score || 80,
          cameraId: a.camera_id
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.maxRisk - a.maxRisk).slice(0, 6);
  }, [alerts]);

  // Executive KPI Counts
  const totalAlerts = alerts.length;
  const activeAlerts = alerts.filter((a) => a.status === 'NEW' || a.status === 'ESCALATED');
  const criticalAlerts = alerts.filter(
    (a) => a.priority === 'CRITICAL' && (a.status === 'NEW' || a.status === 'ESCALATED')
  );
  const resolvedAlerts = alerts.filter((a) => a.status === 'RESOLVED');
  const containmentRate = totalAlerts > 0 ? Math.round(((totalAlerts - activeAlerts.length) / totalAlerts) * 100) : 98;

  return (
    <div className="p-6 space-y-6 bg-[#070b12] text-slate-100 min-h-full">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c131d] via-[#0f172a] to-[#0d131f] border border-[#3b1928] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-bold border flex items-center gap-1.5 ${
              isSuperAdmin
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              {isSuperAdmin ? 'NATIONAL SOC THREAT MATRIX' : `CHECKPOST PERIMETER THREAT RADAR • ${userBop || 'LOCAL BOP'}`}
            </span>
            <span className="text-slate-400 font-mono text-xs">
              {isSuperAdmin ? '• 24/7 BORDER DEFENSE RADAR' : '• LOCAL TACTICAL RADAR & DEFENSE'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            {isSuperAdmin
              ? 'National Border Threat Matrix & Real-Time Defense Telemetry'
              : `Checkpost Threat Radar & Sentry Defense // ${userBop || 'Field Outpost'}`}
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {isSuperAdmin
              ? 'Real-time AI perimeter threat feeds, automated camera sensor focus, critical SLA escalation, and multi-sector border readiness across all 7 frontiers.'
              : 'Real-time optical & thermal perimeter alarms, sentry acoustic sirens, tactical video surveillance, and live SITREP dispatch to Delhi Central HQ.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>DASHBOARD</span>
            </button>
          )}

          <button
            onClick={() => setMapModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-xl text-xs font-mono font-bold transition border border-sky-500/30 hover:border-sky-400 cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-sky-400" />
            <span>SITUATIONAL MAP</span>
          </button>

          {!isSuperAdmin && (
            <button
              onClick={toggleSirenSound}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                sirenTesting
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
              }`}
              title="Test Local Checkpost Audio Siren"
            >
              {sirenTesting ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{sirenTesting ? 'MUTE SIREN' : 'TEST SIREN'}</span>
            </button>
          )}

          {isSuperAdmin ? (
            <button
              onClick={handleBroadcastQRT}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-900/30 border border-rose-500/50 cursor-pointer animate-pulse"
              title="Dispatch Quick Reaction Teams to Active Hotspots"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>BROADCAST QRT</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleMobilizePostSentry}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-900/30 border border-rose-500/50 cursor-pointer animate-pulse"
                title="Mobilize Checkpost Ground Sentry / Patrol Unit"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>MOBILIZE SENTRY</span>
              </button>

              <button
                onClick={() => {
                  window.location.hash = '#incidents';
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-mono font-bold transition border border-amber-500/30 cursor-pointer"
                title="Follow Checkpost Tactical SOP Checklist"
              >
                <span>SOP PLAYBOOK →</span>
              </button>

              <button
                onClick={() => {
                  window.location.hash = '#evidence';
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-cyan-950/50 border border-cyan-500/40 cursor-pointer"
                title="Attach Evidence & Transmit SITREP to Delhi HQ"
              >
                <Send className="w-3.5 h-3.5" />
                <span>DISPATCH HUB →</span>
              </button>
            </>
          )}

          <button
            onClick={loadSOCData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 cursor-pointer"
            title="Refresh Telemetry Stream"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast Banners */}
      {qrtSuccessMessage && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-500 rounded-xl text-xs font-mono text-rose-200 flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-bold">{qrtSuccessMessage}</span>
          </div>
          <button
            onClick={() => setQrtSuccessMessage(null)}
            className="text-rose-400 hover:text-white text-xs underline"
          >
            DISMISS
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-500/60 rounded-xl text-xs font-mono text-cyan-200 flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-4 rounded-xl space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              Active Threat Alarms
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{activeAlerts.length}</span>
            <span className="text-[11px] font-mono text-slate-400">/ {totalAlerts} Total</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Live deduplicated alarms</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#111a2e] border border-rose-500/40 p-4 rounded-xl space-y-1 shadow-md bg-gradient-to-br from-[#111a2e] to-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-rose-300 font-bold uppercase tracking-wider">
              Critical SLA Threats
            </span>
            <BellRing className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono">{criticalAlerts.length}</span>
            <span className="text-[11px] font-mono text-rose-300/80">Immediate Action</span>
          </div>
          <p className="text-[10px] text-rose-400/70 font-mono">Under 180s response SLA</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-4 rounded-xl space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              {isSuperAdmin ? 'Monitored Frontiers' : 'Post Sensors Online'}
            </span>
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {isSuperAdmin ? '7 / 7' : `${localCameras.length} SENSORS`}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">100% ACTIVE</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {isSuperAdmin ? 'Indo-Pak & Indo-China Lines' : `${userBop || 'Checkpost'} Optical/Thermal Array`}
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#111a2e] border border-[#1e293b] p-4 rounded-xl space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              AI Containment Rate
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">{containmentRate}%</span>
            <span className="text-[11px] font-mono text-slate-400">{resolvedAlerts.length} Resolved</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Nominal Zero-Trust Posture</p>
        </div>
      </div>

      {/* Critical Alert Flash Beacon (If any critical alerts are active) */}
      {criticalAlerts.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-rose-950/80 via-[#210e16] to-[#1a0f1b] border-2 border-rose-500/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl shadow-rose-950/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/60 flex items-center justify-center text-rose-400 shrink-0">
              <BellRing className="w-6 h-6 text-rose-400 animate-bounce" />
            </div>
            <div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2 flex-wrap">
                <span>{criticalAlerts[0].title}</span>
                <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-black tracking-wider">
                  CRITICAL SLA DIRECTIVE
                </span>
                <span className="text-[11px] text-rose-300 font-mono">
                  Sensor: <span className="font-bold text-white">{criticalAlerts[0].camera_id}</span> ({criticalAlerts[0].bop_site})
                </span>
              </div>
              <p className="text-xs text-rose-200 mt-0.5">
                Central HQ decision required. Acknowledge or mobilize QRT to prevent automatic escalation to Northern/Western Sector Command.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleFocusCamera(criticalAlerts[0].camera_id, criticalAlerts[0].bop_site)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-lg text-xs font-mono font-bold transition border border-sky-500/40 flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>FOCUS SENSOR</span>
            </button>
            <button
              onClick={() => handleAcknowledgeAlert(criticalAlerts[0].alert_id)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold transition shadow-md shadow-rose-600/30 cursor-pointer"
            >
              ACKNOWLEDGE
            </button>
            <button
              onClick={() => handleEscalateAlert(criticalAlerts[0].alert_id)}
              className="px-3.5 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-mono font-bold transition border border-amber-500/40 cursor-pointer"
            >
              ESCALATE
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Live Video Inspector & Filtered Alerts Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Primary Surveillance Feed // Targeted Sensor */}
          <div
            id="primary-soc-video-feed"
            className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Targeted Tactical Video Feed // {selectedCamera?.camera_id || 'SELECT SENSOR'}
                </span>
                {selectedCamera?.bop_site && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {selectedCamera.bop_site}
                  </span>
                )}
              </div>

              {/* Camera Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">SWITCH SENSOR:</span>
                <select
                  value={selectedCamera?.camera_id || ''}
                  onChange={(e) => {
                    const list = isSuperAdmin ? cameras : localCameras;
                    const c = list.find((cam: Camera) => cam.camera_id === e.target.value) || cameras.find(cam => cam.camera_id === e.target.value);
                    if (c) setSelectedCamera(c);
                  }}
                  className="px-3 py-1 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {(isSuperAdmin ? cameras : localCameras).map((c: Camera) => (
                    <option key={c.camera_id} value={c.camera_id}>
                      {c.camera_id} • {c.camera_name} ({c.bop_site || 'BOP'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Video Player */}
            {selectedCamera ? (
              <div className="rounded-xl overflow-hidden shadow-inner border border-slate-800">
                <LiveVideoPlayer camera={selectedCamera} showControls={true} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 font-mono text-xs">
                No active camera selected. Click 'VIEW SENSOR' on any alert to focus stream.
              </div>
            )}
          </div>

          {/* Card 2: Real-time Threat Alerts Stream */}
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-4 shadow-xl">
            {/* Stream Header */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  Live Real-Time Threat Stream ({filteredAlerts.length} of {alerts.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  IMMUTABLE AUDIT TRAIL
                </span>
              </div>
            </div>

            {/* Sector Quick Filter Pills / Post Sentinel Banner */}
            {isSuperAdmin ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-slate-300">
                    <Filter className="w-3 h-3 text-cyan-400" />
                    BORDER FRONTIER SECTOR:
                  </span>
                  {selectedSector !== 'ALL' && (
                    <button
                      onClick={() => setSelectedSector('ALL')}
                      className="text-cyan-400 hover:underline text-[10px]"
                    >
                      RESET SECTOR
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SECTOR_DEFINITIONS.map((sec) => {
                    const isSelected = selectedSector === sec.id;
                    const count = sec.id === 'ALL' ? alerts.length : sectorCounts[sec.id]?.total || 0;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedSector(sec.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold shadow-sm shadow-cyan-500/20'
                            : 'bg-[#090d16] text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        <span>{sec.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#090d16] border border-cyan-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    POST SENTINEL ACTIVE // {userBop || 'CHECKPOST ZONE'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
                    NOMINAL POSTURE
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                  <span>SENTRY SIREN: READY</span>
                  <span>•</span>
                  <span>PATROL: ON DUTY</span>
                </div>
              </div>
            )}

            {/* Sub-Filters: Priority, Threat Category, Status & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80">
              {/* Priority Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">PRIORITY</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-2.5 py-1 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">🔴 Critical Only</option>
                  <option value="HIGH">🟠 High Priority</option>
                  <option value="MEDIUM">🟡 Medium Priority</option>
                  <option value="LOW">⚪ Low Priority</option>
                </select>
              </div>

              {/* Threat Category Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">CATEGORY</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  {THREAT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">STATUS</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">⚠️ Active (New/Escalated)</option>
                  <option value="NEW">New Alarms</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="RESOLVED">Resolved Archive</option>
                </select>
              </div>

              {/* Text Search */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">SEARCH THREAT</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search camera, title..."
                    className="w-full px-2.5 py-1 pl-7 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
                </div>
              </div>
            </div>

            {/* Alerts List */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No threat alerts match the selected criteria.
                </div>
              ) : (
                filteredAlerts.map((a: Alert) => {
                  const sec = resolveAlertSector(a);
                  const isCritical = a.priority === 'CRITICAL';
                  const isHigh = a.priority === 'HIGH';

                  return (
                    <div
                      key={a.alert_id}
                      className={`p-3.5 bg-[#090d16] border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition group ${
                        isCritical
                          ? 'border-rose-500/40 hover:border-rose-400 bg-rose-950/10'
                          : isHigh
                          ? 'border-amber-500/30 hover:border-amber-400'
                          : 'border-[#1e293b] hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Alert Information */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Priority Pill */}
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                              isCritical
                                ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                                : isHigh
                                ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {a.priority}
                          </span>

                          {/* Alert Title */}
                          <span className="text-xs font-bold text-white truncate max-w-md">
                            {a.title}
                          </span>

                          {/* Sector Badge */}
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800/80 text-cyan-300 border border-cyan-500/20">
                            {sec}
                          </span>

                          {/* Timestamp */}
                          <span className="text-[10px] text-slate-500 font-mono ml-auto">
                            {new Date(a.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {/* Telemetry Line */}
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 flex-wrap">
                          <span>
                            Sensor: <span className="text-sky-400 font-bold">{a.camera_id}</span>
                          </span>
                          <span>•</span>
                          <span>
                            Outpost: <span className="text-slate-300">{a.bop_site || 'Border Post'}</span>
                          </span>
                          <span>•</span>
                          <span>
                            Risk Score:{' '}
                            <span
                              className={`font-bold ${
                                a.risk_score >= 85
                                  ? 'text-rose-400'
                                  : a.risk_score >= 70
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {a.risk_score}/100
                            </span>
                          </span>
                          <span>•</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              a.status === 'NEW'
                                ? 'bg-rose-500/20 text-rose-300'
                                : a.status === 'ACKNOWLEDGED'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : a.status === 'ESCALATED'
                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                      </div>

                      {/* Right: Operational Actions (No Trash Can!) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 1-Click Video Focus */}
                        <button
                          onClick={() => handleFocusCamera(a.camera_id, a.bop_site)}
                          className="px-2.5 py-1.5 bg-sky-950/60 hover:bg-sky-900 text-sky-300 hover:text-white rounded-lg text-[10px] font-mono font-bold transition border border-sky-500/30 flex items-center gap-1 cursor-pointer"
                          title="Focus primary surveillance feed on this sensor"
                        >
                          <Eye className="w-3 h-3" />
                          <span>SENSOR</span>
                        </button>

                        {/* Acknowledge Action */}
                        {a.status === 'NEW' && (
                          <button
                            onClick={() => handleAcknowledgeAlert(a.alert_id)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition border border-slate-700 cursor-pointer"
                            title="Acknowledge receipt of this alert"
                          >
                            ACK
                          </button>
                        )}

                        {/* Escalate Action */}
                        {a.status !== 'ESCALATED' && a.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleEscalateAlert(a.alert_id)}
                            className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded-lg text-[10px] font-mono font-bold transition border border-amber-500/30 cursor-pointer"
                            title="Escalate to Sector Commander"
                          >
                            ESCALATE
                          </button>
                        )}

                        {/* Resolve Action */}
                        {a.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleResolveAlert(a.alert_id)}
                            className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900 text-emerald-300 rounded-lg text-[10px] font-mono font-bold transition border border-emerald-500/30 cursor-pointer"
                            title="Mark threat verified and contained"
                          >
                            RESOLVE
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: National Threat Distribution OR Checkpost Ground Sentinel */}
        <div className="space-y-6">
          {isSuperAdmin ? (
            /* Card 1: National Sector Threat Distribution (SuperAdmin Only) */
            <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Sector Threat Distribution
                </h3>
                <span className="text-[10px] font-mono text-slate-400">7 FRONTIERS</span>
              </div>

              <div className="space-y-2.5">
                {SECTOR_DEFINITIONS.filter((s) => s.id !== 'ALL').map((sec) => {
                  const data = sectorCounts[sec.id] || { total: 0, critical: 0 };
                  const pct = totalAlerts > 0 ? Math.round((data.total / totalAlerts) * 100) : 0;
                  const isElevated = data.critical > 0;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSector(selectedSector === sec.id ? 'ALL' : sec.id)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                        selectedSector === sec.id
                          ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                          : isElevated
                          ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
                          : 'bg-[#090d16] border-[#1e293b] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-200">{sec.label}</span>
                        <div className="flex items-center gap-2">
                          {data.critical > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold animate-pulse">
                              {data.critical} CRIT
                            </span>
                          )}
                          <span className="text-slate-400 font-bold">{data.total} alerts</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            data.critical > 0
                              ? 'bg-rose-500'
                              : data.total > 0
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(pct, data.total > 0 ? 12 : 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Card 1 (Officer): Checkpost Tactical Ground Readiness */
            <div className="bg-[#111a2e] border border-cyan-500/30 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  Checkpost Sentry Readiness
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 font-bold">
                  DEFCON NOMINAL
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#090d16] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ASSIGNED OUTPOST:</span>
                    <span className="text-white font-bold">{userBop || 'BOP ALPHA'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">PERIMETER SENTRIES:</span>
                    <span className="text-emerald-400 font-bold">ON DUTY (2 SQUADS)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ACOUSTIC SIREN:</span>
                    <span className="text-cyan-400 font-bold">ARMED & READY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">DELHI HQ LINK:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      CONNECTED 24/7
                    </span>
                  </div>
                </div>

                {/* Quick Sentry Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleMobilizePostSentry}
                    className="p-2.5 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>MOBILIZE PATROL</span>
                  </button>

                  <button
                    onClick={toggleSirenSound}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-amber-500/40 cursor-pointer"
                  >
                    {sirenTesting ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{sirenTesting ? 'MUTE SIREN' : 'TEST SIREN'}</span>
                  </button>
                </div>

                {/* Transmit SITREP to Delhi HQ Button */}
                <button
                  onClick={() => {
                    window.location.hash = '#evidence';
                  }}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>OPEN EVIDENCE & DISPATCH HUB →</span>
                </button>
              </div>
            </div>
          )}

          {/* Card 2: High-Risk Frontier Checkposts (BOPs) */}
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-sky-400" />
                Active Frontier Hotspots
              </h3>
              <span className="text-[10px] font-mono text-slate-400">BY RISK</span>
            </div>

            <div className="space-y-2">
              {highRiskCheckposts.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-slate-500">
                  All border checkposts currently reporting nominal conditions.
                </div>
              ) : (
                highRiskCheckposts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#090d16] border border-[#1e293b] hover:border-sky-500/40 rounded-xl flex items-center justify-between transition gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{item.bop}</div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                        <span>{item.sector}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">{item.count} Active Alarms</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFocusCamera(item.cameraId, item.bop)}
                      className="px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900 text-sky-300 hover:text-white rounded-lg text-[10px] font-mono font-bold transition border border-sky-500/30 shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>WATCH</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Defense Command Actions Hub */}
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="border-b border-[#1e293b] pb-2">
              <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Command Navigation
              </h3>
            </div>

            <div className="space-y-2 font-mono">
              <button
                onClick={() => setMapModalOpen(true)}
                className="w-full p-2.5 bg-[#090d16] hover:bg-slate-800/80 border border-[#1e293b] hover:border-sky-500/40 rounded-xl text-left transition flex items-center justify-between text-xs text-slate-200 group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                  <span>Interactive Situational Map</span>
                </div>
                <span className="text-[10px] text-sky-400">GIS VIEW →</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigateToIncidents) {
                    onNavigateToIncidents();
                  } else {
                    window.location.hash = '#incidents';
                  }
                }}
                className="w-full p-2.5 bg-[#090d16] hover:bg-slate-800/80 border border-[#1e293b] hover:border-rose-500/40 rounded-xl text-left transition flex items-center justify-between text-xs text-slate-200 group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>Incidents & SOP Dossiers</span>
                </div>
                <span className="text-[10px] text-rose-400">WAR ROOM →</span>
              </button>

              <button
                onClick={handleBroadcastQRT}
                className="w-full p-2.5 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/40 rounded-xl text-left transition flex items-center justify-between text-xs text-rose-200 group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-400 group-hover:animate-bounce transition-transform" />
                  <span className="font-bold">Dispatch National QRT</span>
                </div>
                <span className="text-[10px] text-amber-300 font-black">CODE RED →</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <IncidentDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        incidentId={selectedIncidentId}
        onUpdated={loadSOCData}
      />

      <SituationalMapModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        incidents={incidents}
        targetCamera={selectedCamera}
        onSelectIncident={(i: Incident) => handleOpenIncidentDetail(i.incident_id)}
      />


    </div>
  );
};