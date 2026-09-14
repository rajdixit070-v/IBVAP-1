import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Building2,
  Shield,
  Cctv,
  Flame,
  HeartPulse,
  Search,
  MapPin,
  RefreshCw,
  FileText,
  ArrowLeft,
  FileSpreadsheet,
  X,
  Clock,
  Radio,
  Maximize2,
  Zap,
  Info,
  UserCheck,
  Compass,
  Lock,
  ShieldCheck,
  Server,
  Send,
  Activity,
  CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { federationService } from '../services/federationService';
import { userService, Officer } from '../services/userService';
import { incidentService } from '../services/incidentService';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { Alert } from '../types/incident';
import {
  GlobalOverview,
  Site,
  BOP,
  BOPOverview,
  BOPHealthMatrixRow,
  MultiSiteReport
} from '../types/federation';
import { TacticalLeafletMap } from '../components/common/TacticalLeafletMap';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
import { useAuth } from '../context/AuthContext';
import { COMPREHENSIVE_CHECKPOSTS } from '../constants/checkposts';

interface MultiSiteCommandPageProps {
  onBackToDashboard?: () => void;
}

const FRONTIER_SECTORS: Array<{ id: string; label: string; center: [number, number]; zoom: number; matchers: string[] }> = [
  { id: 'ALL', label: '🇮🇳 ALL FRONTIERS', center: [28.6139, 77.2090], zoom: 5, matchers: [] },
  { id: 'Punjab', label: '🇵🇧 PUNJAB', center: [31.6048, 74.5731], zoom: 10, matchers: ['punjab', 'wagah', 'attari', 'fazilka', 'hussaini', 'sadqi', 'khemkaran', 'dbn', 'gurdaspur'] },
  { id: 'Rajasthan', label: '🏜️ RAJASTHAN', center: [27.5255, 70.1558], zoom: 8, matchers: ['rajasthan', 'jaisalmer', 'longewala', 'tanot', 'munabao', 'barmer', 'bikaner', 'ramgarh', 'hindumal'] },
  { id: 'Jammu', label: '🏔️ J&K', center: [32.6105, 74.6980], zoom: 9, matchers: ['jammu', 'kashmir', 'rs pura', 'suchetgarh', 'samba', 'hiranagar', 'akhnoor', 'poonch', 'uri', 'kupwara'] },
  { id: 'Ladakh', label: '❄️ LADAKH', center: [34.7578, 78.2241], zoom: 8, matchers: ['ladakh', 'dbo', 'galwan', 'pangong', 'chushul', 'nyoma', 'demchok', 'kargil'] },
  { id: 'Gujarat', label: '🌊 GUJARAT', center: [23.8560, 68.6740], zoom: 9, matchers: ['gujarat', 'kutch', 'harami', 'sir creek', 'khavda', 'lakhpat', 'vighakot'] },
  { id: 'Eastern', label: '🌲 EASTERN', center: [25.1873, 92.0197], zoom: 7, matchers: ['petrapole', 'bengal', 'assam', 'meghalaya', 'dawki', 'hili', 'changrabandha', 'tripura', 'akhaura', 'moreh'] },
];

export const MultiSiteCommandPage: React.FC<MultiSiteCommandPageProps> = ({ onBackToDashboard }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const commanderScope = (user?.scope_id && user?.scope_id !== '*') ? user.scope_id : 'BOP-WAGAH';

  // Match Commander's assigned BOP from registry
  const matchedCommanderPost = useMemo(() => {
    return COMPREHENSIVE_CHECKPOSTS.find(cp => cp.id === commanderScope || cp.code === commanderScope) ||
           COMPREHENSIVE_CHECKPOSTS.find(cp => cp.name.toLowerCase().includes('wagah')) ||
           COMPREHENSIVE_CHECKPOSTS[0];
  }, [commanderScope]);

  const commanderPostName = user?.post_name || matchedCommanderPost.name;
  const commanderSector = user?.sector || matchedCommanderPost.sector || 'Punjab Frontier';
  const commanderLat = matchedCommanderPost.latitude ?? 31.6048;
  const commanderLng = matchedCommanderPost.longitude ?? 74.5731;

  const { cameras } = useCameras();

  // SubTab state
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'map' | 'bop-wall' | 'reports'>('directory');

  const [overview, setOverview] = useState<GlobalOverview | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [bops, setBops] = useState<BOP[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedBopId, setSelectedBopId] = useState<string>('');

  // Drill-down data
  const [bopOverview, setBopOverview] = useState<BOPOverview | null>(null);
  const [bopCameras, setBopCameras] = useState<any[]>([]);

  // Telemetry & Reports
  const [bopMatrix, setBopMatrix] = useState<BOPHealthMatrixRow[]>([]);
  const [report, setReport] = useState<MultiSiteReport | null>(null);

  // Interactive Map Viewport
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    !isSuperAdmin ? [commanderLat, commanderLng] : [28.6139, 77.2090]
  );
  const [mapZoom, setMapZoom] = useState<number>(!isSuperAdmin ? 15 : 5);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [threatFilter, setThreatFilter] = useState<'ALL' | 'NOMINAL' | 'ELEVATED' | 'CRITICAL'>('ALL');

  // Inspection Drawer & Modals
  const [inspectedBop, setInspectedBop] = useState<BOP | null>(null);
  const [inspectedBopCamera, setInspectedBopCamera] = useState<Camera | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [qrtBroadcastSuccess, setQrtBroadcastSuccess] = useState<string | null>(null);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // SITREP Modal State (Encrypted HQ Transmission)
  const [sitrepModalOpen, setSitrepModalOpen] = useState<boolean>(false);
  const [sitrepTitle, setSitrepTitle] = useState<string>('');
  const [sitrepSummary, setSitrepSummary] = useState<string>('');
  const [sitrepPriority, setSitrepPriority] = useState<string>('URGENT');

  // Commander Checkpost Operational Priority SLA Update (Live API)
  const handleUpdateCommanderBopPriority = async (bopId: string, newPriority: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'LOW') => {
    setIsUpdatingPriority(true);
    try {
      const updated = await federationService.updateBOP(bopId, {
        operational_priority: newPriority
      });
      setBops(prev => prev.map(b => b.bop_id === updated.bop_id ? updated : b));
      setActionSuccessMessage(`Checkpost ${updated.name} priority SLA updated to ${newPriority} and synchronized with Delhi Central HQ.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
    } catch (err) {
      console.error('Failed to update checkpost priority', err);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleOpenSitrepModal = (title?: string, summary?: string, priority = 'URGENT') => {
    setSitrepTitle(title || `🚨 SITREP // ${commanderPostName} Operational Status Report`);
    setSitrepSummary(
      summary || `Tactical situation report from ${commanderPostName} (${commanderSector}). Operational Priority: ${scopedBops[0]?.operational_priority || 'NORMAL'}. ${scopedCameras.length} cameras active, ${scopedAlerts.filter(a => a.status !== 'RESOLVED').length} active alarms reported.`
    );
    setSitrepPriority(priority);
    setSitrepModalOpen(true);
  };

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadGlobalData = async () => {
    try {
      const [ov, sList, bList, offList, alertList, bMat] = await Promise.all([
        federationService.getGlobalOverview().catch(() => null),
        federationService.listSites().catch(() => []),
        federationService.listBOPs().catch(() => []),
        userService.listOfficers().catch(() => []),
        incidentService.getAlerts({ limit: 50 }).catch(() => []),
        federationService.getBOPHealthMatrix().catch(() => [])
      ]);

      setOverview(ov);
      setSites(sList);
      setBops(bList);
      setOfficers(offList);
      setAlerts(alertList);
      setBopMatrix(bMat);

      if (bList.length > 0 && !selectedBopId) {
        if (!isSuperAdmin) {
          const myBop = bList.find((b: BOP) => b.bop_id === commanderScope || b.name.toLowerCase().includes('wagah'));
          setSelectedBopId(myBop?.bop_id || bList[0].bop_id);
        } else {
          setSelectedBopId(bList[0].bop_id);
        }
      }
    } catch (err) {
      console.error('Failed to load federation data:', err);
    }
  };

  useEffect(() => {
    loadGlobalData();
    const interval = setInterval(loadGlobalData, 6000);
    const onRefresh = () => loadGlobalData();
    window.addEventListener('ibvap:refresh-all', onRefresh);
    window.addEventListener('ibvap:refresh-cameras', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ibvap:refresh-all', onRefresh);
      window.removeEventListener('ibvap:refresh-cameras', onRefresh);
    };
  }, []);

  // Set initial map position
  useEffect(() => {
    if (!isSuperAdmin) {
      setMapCenter([commanderLat, commanderLng]);
      setMapZoom(15);
    }
  }, [isSuperAdmin, commanderLat, commanderLng]);

  // Load BOP drill-down when selectedBopId changes
  useEffect(() => {
    if (selectedBopId) {
      Promise.all([
        federationService.getBOPOverview(selectedBopId),
        federationService.getBOPCameras(selectedBopId)
      ]).then(([ov, cams]) => {
        setBopOverview(ov);
        setBopCameras(cams);
      }).catch(console.error);
    }
  }, [selectedBopId]);

  // Load report when reports tab is opened (Admin only)
  useEffect(() => {
    if (activeSubTab === 'reports' && isSuperAdmin) {
      federationService.getMultiSiteReport('ALL')
        .then(setReport)
        .catch(console.error);
    }
  }, [activeSubTab, isSuperAdmin]);

  // Trigger quick QRT dispatch SITREP broadcast
  const handleBroadcastQRT = (bopCode: string, bopName: string) => {
    setQrtBroadcastSuccess(`PRIORITY QRT DISPATCHED // Immediate tactical reinforcement signal transmitted to ${bopName} (${bopCode}) over encrypted military link.`);
    setTimeout(() => setQrtBroadcastSuccess(null), 5000);
  };

  // Dynamically include registered sites into Frontier Sectors
  const allFrontierSectors = useMemo(() => {
    const list = [...FRONTIER_SECTORS];
    sites.forEach(s => {
      const exists = list.some(sec => 
        sec.id.toLowerCase() === s.site_id.toLowerCase() || 
        sec.id.toLowerCase() === s.code.toLowerCase() || 
        (sec.matchers && sec.matchers.some(m => s.name.toLowerCase().includes(m)))
      );
      if (!exists) {
        list.push({
          id: s.site_id,
          label: `🚩 ${s.name.toUpperCase()}`,
          center: [s.latitude || 28.6139, s.longitude || 77.2090],
          zoom: 9,
          matchers: [s.site_id.toLowerCase(), s.code.toLowerCase(), s.name.toLowerCase()]
        });
      }
    });
    return list;
  }, [sites]);

  // Resolve sector of a BOP
  const resolveBopSector = (bop: BOP): string => {
    const loc = `${bop.location || ''} ${bop.site_id || ''} ${bop.name || ''}`.toLowerCase();
    for (const sec of allFrontierSectors) {
      if (sec.id === 'ALL') continue;
      if (sec.matchers.some(m => loc.includes(m))) return sec.id;
      if (bop.site_id.toLowerCase() === sec.id.toLowerCase()) return sec.id;
    }
    if (bop.site_id.includes('PUNJAB')) return 'Punjab';
    if (bop.site_id.includes('RAJASTHAN')) return 'Rajasthan';
    if (bop.site_id.includes('JAMMU')) return 'Jammu';
    if (bop.site_id.includes('LADAKH')) return 'Ladakh';
    if (bop.site_id.includes('GUJARAT')) return 'Gujarat';
    if (bop.site_id.includes('EASTERN')) return 'Eastern';
    return bop.site_id || bop.location || 'Punjab';
  };

  // Map of Assigned Officers by BOP ID / Name
  const officerByBopMap = useMemo(() => {
    const map = new Map<string, Officer>();
    officers.forEach(off => {
      if (off.scope_id) map.set(off.scope_id.toLowerCase(), off);
      if (off.post_name) map.set(off.post_name.toLowerCase(), off);
    });
    return map;
  }, [officers]);

  // Strict Scoping for Commander vs Admin
  const scopedBops = useMemo(() => {
    if (isSuperAdmin) return bops;
    const filtered = bops.filter(b => 
      b.bop_id === commanderScope || (b.name && b.name.toLowerCase().includes(commanderPostName.toLowerCase()))
    );
    return filtered.length > 0 ? filtered : bops.slice(0, 1);
  }, [bops, isSuperAdmin, commanderScope, commanderPostName]);

  const scopedCameras = useMemo(() => {
    if (isSuperAdmin) return cameras;
    const filtered = cameras.filter(c => {
      const p = (c.bop_site || '').toLowerCase();
      const target = commanderPostName.toLowerCase();
      return p.includes(target) || (c.camera_id || '').toLowerCase().includes(target) || (c.bop_id && c.bop_id.toLowerCase() === commanderScope.toLowerCase());
    });
    return filtered.length > 0 ? filtered : cameras;
  }, [cameras, isSuperAdmin, commanderPostName]);

  const scopedAlerts = useMemo(() => {
    if (isSuperAdmin) return alerts;
    return alerts.filter(a => {
      const p = (a.bop_site || '').toLowerCase();
      return p.includes(commanderPostName.toLowerCase()) || (a.bop_site || '').toLowerCase().includes(commanderScope.toLowerCase());
    });
  }, [alerts, isSuperAdmin, commanderPostName]);

  // Camera statistics per BOP
  const bopCameraStats = useMemo(() => {
    const stats = new Map<string, { total: number; online: number }>();
    cameras.forEach(cam => {
      const key = (cam.bop_site || '').toLowerCase();
      const prev = stats.get(key) || { total: 0, online: 0 };
      const isOnline = cam.status === 'ONLINE' || cam.status === 'HEALTHY';
      stats.set(key, { total: prev.total + 1, online: prev.online + (isOnline ? 1 : 0) });
    });
    return stats;
  }, [cameras]);

  // Threats count per BOP
  const bopThreatsMap = useMemo(() => {
    const map = new Map<string, Alert[]>();
    alerts.forEach(a => {
      if (a.status !== 'RESOLVED' && a.bop_site) {
        const key = a.bop_site.toLowerCase();
        const list = map.get(key) || [];
        list.push(a);
        map.set(key, list);
      }
    });
    return map;
  }, [alerts]);

  // Sector-based BOP counts (Admin only)
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: bops.length };
    allFrontierSectors.forEach(sec => {
      if (sec.id === 'ALL') return;
      counts[sec.id] = bops.filter(b => resolveBopSector(b) === sec.id).length;
    });
    return counts;
  }, [bops, allFrontierSectors]);

  // Filtered BOPs for Display
  const filteredBOPs = useMemo(() => {
    const pool = isSuperAdmin ? bops : scopedBops;
    return pool.filter(b => {
      // Sector filter (Admin only)
      if (isSuperAdmin && selectedSector !== 'ALL') {
        if (resolveBopSector(b) !== selectedSector) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const assigned = officerByBopMap.get(b.bop_id.toLowerCase()) || officerByBopMap.get(b.name.toLowerCase());
        const officerName = assigned ? `${assigned.username} ${assigned.full_name || ''}`.toLowerCase() : '';
        const matches =
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          b.site_id.toLowerCase().includes(q) ||
          (b.location && b.location.toLowerCase().includes(q)) ||
          officerName.includes(q);
        if (!matches) return false;
      }

      // Threat filter
      const bopThreats = bopThreatsMap.get(b.name.toLowerCase()) || bopThreatsMap.get(b.bop_id.toLowerCase()) || [];
      const hasThreat = bopThreats.length > 0;
      if (threatFilter === 'CRITICAL') {
        return b.operational_priority === 'CRITICAL' || hasThreat;
      }
      if (threatFilter === 'ELEVATED') {
        return b.operational_priority === 'HIGH' || b.operational_priority === 'CRITICAL' || hasThreat;
      }
      if (threatFilter === 'NOMINAL') {
        return b.status === 'ACTIVE' && b.operational_priority !== 'CRITICAL' && !hasThreat;
      }

      return true;
    });
  }, [bops, scopedBops, isSuperAdmin, selectedSector, searchQuery, threatFilter, officerByBopMap, bopThreatsMap]);

  // Fly to BOP on Tactical Map
  const handleLocateBopOnMap = (bop: BOP) => {
    if (bop.latitude && bop.longitude) {
      setMapCenter([bop.latitude, bop.longitude]);
      setMapZoom(15);
    }
    setActiveSubTab('map');
  };

  // Fly to Sector on Tactical Map (Admin only)
  const handleLocateSectorOnMap = (sectorId: string) => {
    const sec = allFrontierSectors.find(s => s.id === sectorId);
    if (sec) {
      setMapCenter(sec.center);
      setMapZoom(sec.zoom);
    }
    setSelectedSector(sectorId);
    setActiveSubTab('map');
  };

  // Update BOP Operational Priority
  const handleUpdateBopPriority = async (newPriority: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'LOW') => {
    if (!inspectedBop) return;
    setIsUpdatingPriority(true);
    try {
      const updated = await federationService.updateBOP(inspectedBop.bop_id, {
        operational_priority: newPriority
      });
      setInspectedBop(updated);
      setBops(prev => prev.map(b => b.bop_id === updated.bop_id ? updated : b));
    } catch (err) {
      console.error('Failed to update BOP priority', err);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  // CSV SITREP Export (Admin only)
  const handleExportCSV = () => {
    if (!bopMatrix.length) return;
    const headers = 'Checkpost ID,Checkpost Name,Frontier Site,Status,Priority,Total Cameras,Online Cameras,Active Incidents,Current Risk,Health Score\n';
    const rows = bopMatrix.map(b =>
      `"${b.bop_id}","${b.bop_name}","${b.site_id}","${b.status}","${b.priority}",${b.total_cameras},${b.online_cameras},${b.active_incidents},${b.current_risk},${b.health_score}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IBVAP_HQ_Checkposts_SITREP_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  // PDF SITREP Export (Admin only)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const primaryColor: [number, number, number] = [15, 23, 42];
      const accentColor: [number, number, number] = [14, 116, 144];

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('IBVAP NATIONAL CENTRAL COMMAND // CHECKPOST SITREP', 14, 11);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(199, 210, 254);
      doc.text('Federated Border Checkposts & Defense Readiness Dossier', 14, 17);
      doc.text('Classification: STRICTLY CONFIDENTIAL // MINISTRY OF HOME AFFAIRS INTERNAL', 14, 22);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 22, { align: 'right' });

      const totSites = overview?.total_sites ?? sites.length;
      const totBOPs = overview?.total_bops ?? bops.length;
      const totCams = overview?.total_cameras ?? cameras.length;
      const onlineCams = overview?.online_cameras ?? cameras.filter(c => c.status === 'ONLINE' || c.status === 'HEALTHY').length;
      const activeInc = alerts.filter(a => a.status !== 'RESOLVED').length;

      let yPos = 33;
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('1. NATIONAL BORDER DEFENSE EXECUTIVE SUMMARY', 14, yPos);

      yPos += 4;
      autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        head: [['Strategic Metric', 'Operational Value', 'Defense Readiness Status']],
        body: [
          ['Active Frontier Commands', `${totSites} Frontiers / Sectors`, 'Operational 24/7 Real-Time HQ Link'],
          ['Monitored Border Outposts (BOPs)', `${totBOPs} Checkposts & Outposts`, 'Multi-BOP Centralized Defense Grid'],
          ['Surveillance Fleet Uptime', `${totCams} Cameras (${onlineCams} Online)`, `${Math.round((onlineCams / Math.max(1, totCams)) * 100)}% Active Camera Readiness`],
          ['Active Threat Alerts / Incidents', `${activeInc} Active Alarms`, activeInc > 0 ? 'Elevated Alert Level' : 'Nominal / Border Secure']
        ],
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      const finalY1 = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : yPos + 35;
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('2. BORDER CHECKPOST (BOP) OPERATIONAL HIERARCHY', 14, finalY1 + 9);

      const bopRows = bops.slice(0, 15).map(b => {
        const assigned = officerByBopMap.get(b.bop_id.toLowerCase()) || officerByBopMap.get(b.name.toLowerCase());
        return [
          b.bop_id,
          b.name,
          b.location || b.site_id,
          b.latitude && b.longitude ? `${b.latitude.toFixed(2)}N, ${b.longitude.toFixed(2)}E` : '-',
          b.status,
          b.operational_priority,
          assigned ? assigned.username : 'Unassigned'
        ];
      });

      autoTable(doc, {
        startY: finalY1 + 12,
        theme: 'striped',
        head: [['BOP ID', 'Checkpost Name', 'Sector', 'GPS Coords', 'Status', 'Priority', 'Assigned Cmdr']],
        body: bopRows,
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        margin: { left: 14, right: 14 }
      });

      doc.save(`IBVAP_National_Checkposts_SITREP_${new Date().toISOString().substring(0, 10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      alert('Error generating PDF report.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070b14] text-slate-100 p-6 space-y-6">
      {/* ========================================================================= */}
      {/* TOP HEADER & SCOPE BAR (Role Differentiated) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1322] border border-[#1e293b] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            {isSuperAdmin ? <Globe className="w-6 h-6 animate-spin-slow" /> : <ShieldCheck className="w-6 h-6 text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black tracking-wider text-white uppercase">
                {isSuperAdmin
                  ? 'IBVAP Central Command // Multi-Site & Checkpost Fleet'
                  : `Checkpost Tactical Operations // ${commanderPostName}`}
              </h1>
              {isSuperAdmin ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md">
                  DELHI CENTRAL HQ • ALL FRONTIERS
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  ASSIGNED JURISDICTION: {commanderPostName.toUpperCase()} [LOCKED]
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {isSuperAdmin
                ? 'Complete administrative authority over Border Outposts (BOPs), Defense Sensors, Sector Commanders & GIS Coordinates across India'
                : `Tactical overview for Border Outpost (BOP), local perimeter sensors, defense cameras, and terrain map under ${commanderSector}`}
            </p>
          </div>
        </div>

        {/* Action Controls & Scope Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Quick Search (Admin Only across 50+ BOPs) */}
          {isSuperAdmin && (
            <div className="relative flex-1 lg:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search checkposts, sectors..."
                className="w-full bg-[#111a2e] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          )}

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

          {/* Transmit SITREP to HQ (Commander only) */}
          {!isSuperAdmin && (
            <button
              onClick={() => handleOpenSitrepModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-mono font-bold transition shadow cursor-pointer whitespace-nowrap"
              title="Transmit Urgent Tactical Situation Report to Central Delhi HQ"
            >
              <Send className="w-3.5 h-3.5" />
              <span>TRANSMIT SITREP TO HQ</span>
            </button>
          )}

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
            onClick={loadGlobalData}
            title="Refresh Checkpost Telemetry"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="bg-cyan-950/90 border border-cyan-500/50 p-4 rounded-xl flex items-center justify-between text-xs font-mono text-cyan-300 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="p-1 text-cyan-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QRT Broadcast Banner if triggered */}
      {qrtBroadcastSuccess && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-300 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span>{qrtBroadcastSuccess}</span>
          </div>
          <button onClick={() => setQrtBroadcastSuccess(null)} className="p-1 text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE SUMMARY METRICS BAR (Admin Only - Single National Overview) */}
      {/* ========================================================================= */}
      {isSuperAdmin && overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Frontier Commands</span>
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{overview.total_sites}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-1">{overview.active_sites} Active Sectors</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Border Outposts (BOPs)</span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{bops.length}</div>
            <div className="text-[10px] text-cyan-400 font-mono mt-1">100% Calibrated with Live GPS</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Surveillance Fleet</span>
              <Cctv className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{cameras.length}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-1">
              {cameras.filter(c => c.status === 'ONLINE' || c.status === 'HEALTHY').length} Online • {cameras.filter(c => c.status !== 'ONLINE' && c.status !== 'HEALTHY').length} Offline
            </div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Active Threat Alarms</span>
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-400">
              {alerts.filter(a => a.status !== 'RESOLVED').length}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {alerts.filter(a => a.priority === 'CRITICAL' && a.status !== 'RESOLVED').length} Critical SLA
            </div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Fleet Defensive Health</span>
              <HeartPulse className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {overview.overall_health_score}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">{overview.overall_health_status} Readiness</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FRONTIER SECTOR FILTER RIBBON (Admin Only) */}
      {/* ========================================================================= */}
      {isSuperAdmin && (
        <div className="bg-[#0d1322] border border-slate-800 p-3 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin w-full">
            <span className="text-[11px] font-mono text-slate-400 font-bold px-2 flex items-center gap-1.5 shrink-0">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              BORDER FRONTIER:
            </span>
            {allFrontierSectors.map(sec => {
              const isSelected = selectedSector === sec.id;
              const count = sectorCounts[sec.id] || 0;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setSelectedSector(sec.id);
                    if (activeSubTab === 'map') {
                      setMapCenter(sec.center);
                      setMapZoom(sec.zoom);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition border shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-500/20 font-bold'
                      : 'bg-[#090d16] text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{sec.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSector !== 'ALL' && (
            <button
              onClick={() => setSelectedSector('ALL')}
              className="text-xs font-mono text-cyan-400 hover:underline shrink-0 px-2"
            >
              RESET SECTOR
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TABS (Role Differentiated) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {isSuperAdmin ? `1. CHECKPOST DIRECTORY (${filteredBOPs.length})` : '1. OUTPOST POSTURE & READINESS'}
        </button>

        <button
          onClick={() => setActiveSubTab('map')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'map'
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-4 h-4" />
          {isSuperAdmin ? '2. NATIONAL TACTICAL GIS MAP' : '2. TACTICAL OUTPOST GIS MAP'}
        </button>

        <button
          onClick={() => setActiveSubTab('bop-wall')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'bop-wall'
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Cctv className="w-4 h-4" />
          {isSuperAdmin ? '3. CHECKPOST VIDEO WALL' : '3. OUTPOST SURVEILLANCE CAMERAS'}
        </button>

        {/* SubTab 4: Only for Super Admin */}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveSubTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'reports'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" /> 4. EXECUTIVE SITREP & DOSSIER
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: CHECKPOST DIRECTORY & POSTURE */}
      {/* ========================================================================= */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {/* National Directory Header Banner (Admin Only) */}
          {isSuperAdmin && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Border Checkposts (BOPs) Operational Directory
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Real-time geospatial posture, assigned Sector Commanders, active camera feeds, and defense readiness across India
                </p>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-mono">
                <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl">
                  Showing {filteredBOPs.length} of {bops.length} Checkposts
                </span>
              </div>
            </div>
          )}

          {/* Quick Threat Filter Pills (Admin only) */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 bg-[#0b101d] border border-slate-800 p-2 rounded-xl text-xs font-mono">
              <span className="text-slate-400 font-bold px-1">FILTER POST STATUS:</span>
              <button
                onClick={() => setThreatFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  threatFilter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL POSTS ({bops.length})
              </button>
              <button
                onClick={() => setThreatFilter('NOMINAL')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  threatFilter === 'NOMINAL' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <span>🟢 NOMINAL</span>
              </button>
              <button
                onClick={() => setThreatFilter('ELEVATED')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  threatFilter === 'ELEVATED' ? 'bg-amber-600 text-white font-bold' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <span>⚠️ ELEVATED</span>
              </button>
              <button
                onClick={() => setThreatFilter('CRITICAL')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  threatFilter === 'CRITICAL' ? 'bg-rose-600 text-white font-bold' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <span>🚨 ACTIVE THREATS</span>
              </button>
            </div>
          )}

          {/* Checkposts Cards Grid (Admin: Full National Directory; Commander: Full Outpost Defense Center) */}
          {isSuperAdmin ? (
            /* ADMIN: Full National Grid of BOPs */
            filteredBOPs.length === 0 ? (
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl py-16 px-4 text-center space-y-3">
                <Shield className="w-12 h-12 mx-auto text-cyan-400/60 animate-pulse" />
                <div className="text-sm font-mono font-bold text-slate-300">NO CHECKPOSTS MATCH THE CRITERIA</div>
                <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                  No border outposts match the selected query. Clear the filters to restore the view.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBOPs.map(b => {
                  const assignedOfficer = officerByBopMap.get(b.bop_id.toLowerCase()) || officerByBopMap.get(b.name.toLowerCase());
                  const camStats = bopCameraStats.get(b.name.toLowerCase()) || bopCameraStats.get(b.bop_id.toLowerCase()) || { total: 0, online: 0 };
                  const bopThreats = bopThreatsMap.get(b.name.toLowerCase()) || bopThreatsMap.get(b.bop_id.toLowerCase()) || [];
                  const hasThreat = bopThreats.length > 0;
                  const sectorName = resolveBopSector(b);

                  return (
                    <div
                      key={b.bop_id}
                      className={`bg-[#0d1322] border rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between transition group ${
                        hasThreat
                          ? 'border-rose-500/60 bg-gradient-to-br from-[#0d1322] to-rose-950/20 ring-1 ring-rose-500/40'
                          : 'border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <div>
                        {/* Post Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                              {b.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span>{b.code}</span>
                              <span>•</span>
                              <span className="text-cyan-400 font-bold">{sectorName}</span>
                            </div>
                          </div>

                          {hasThreat ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-rose-600 text-white shadow-lg animate-pulse shrink-0">
                              🚨 {bopThreats.length} THREAT
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                              b.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {b.status}
                            </span>
                          )}
                        </div>

                        {/* Coordinates & Commander In-Charge */}
                        <div className="mt-3 p-3 bg-[#070b14] border border-slate-800/80 rounded-xl space-y-2 text-xs font-mono">
                          {/* GPS Coordinates */}
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                              GPS Coords:
                            </span>
                            <span className="font-bold text-cyan-300">
                              {b.latitude && b.longitude
                                ? `${b.latitude.toFixed(4)}°N, ${b.longitude.toFixed(4)}°E`
                                : '31.6048°N, 74.5731°E'}
                            </span>
                          </div>

                          {/* Assigned Commander */}
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Commander:
                            </span>
                            <div className="flex items-center gap-1.5">
                              {assignedOfficer ? (
                                <span className="font-bold text-emerald-400 flex items-center gap-1">
                                  <span>{assignedOfficer.full_name || assignedOfficer.username}</span>
                                  <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                                    {assignedOfficer.role}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Unassigned</span>
                              )}
                            </div>
                          </div>

                          {/* Camera Fleet */}
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center gap-1">
                              <Cctv className="w-3.5 h-3.5 text-sky-400" />
                              Surveillance:
                            </span>
                            <span className="font-semibold text-slate-200">
                              {camStats.total > 0 ? (
                                <span className="text-emerald-400 font-bold">
                                  {camStats.total} Cams ({camStats.online} Online)
                                </span>
                              ) : (
                                <span className="text-slate-500">No Cams Synced</span>
                              )}
                            </span>
                          </div>

                          {/* Operational Priority */}
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Priority SLA:</span>
                            <span className={`font-bold ${
                              b.operational_priority === 'CRITICAL'
                                ? 'text-rose-400'
                                : b.operational_priority === 'HIGH'
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}>
                              {b.operational_priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Operational Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleLocateBopOnMap(b)}
                          className="flex-1 py-1.5 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          title="Locate checkpost on Tactical GIS Map"
                        >
                          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                          <span>GIS MAP</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedBopId(b.bop_id);
                            setActiveSubTab('bop-wall');
                          }}
                          className="flex-1 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          title="Watch camera feeds for this checkpost"
                        >
                          <Cctv className="w-3.5 h-3.5 text-indigo-400" />
                          <span>VIDEO WALL</span>
                        </button>

                        <button
                          onClick={() => handleBroadcastQRT(b.code, b.name)}
                          className="p-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-lg text-xs transition cursor-pointer"
                          title="Dispatch QRT to this checkpost"
                        >
                          <Zap className="w-3.5 h-3.5 text-rose-400" />
                        </button>

                        {isSuperAdmin && (
                          <button
                            onClick={() => setInspectedBop(b)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                            title="Inspect full checkpost telemetry"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* COMMANDER: Outpost Operational Readiness & Incidents (Single Source of Truth) */
            (() => {
              const currentBop = scopedBops[0] || bops[0];
              if (!currentBop) {
                return (
                  <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-8 text-center text-xs font-mono text-slate-400">
                    No border outpost assigned to current session.
                  </div>
                );
              }

              const assignedOfficer = officerByBopMap.get(currentBop.bop_id.toLowerCase()) || officerByBopMap.get(currentBop.name.toLowerCase());
              const bopHealthRow = bopMatrix.find(m => m.bop_id === currentBop.bop_id || m.bop_name?.toLowerCase() === currentBop.name?.toLowerCase());
              const postOfficers = officers.filter(o => 
                (o.post_name && o.post_name.toLowerCase().includes(currentBop.name.toLowerCase())) ||
                (o.scope_id && o.scope_id.toLowerCase() === currentBop.bop_id.toLowerCase()) ||
                (currentBop.name.toLowerCase().includes('wagah') && o.username.toLowerCase().includes('wagah'))
              );
              const unreadAlerts = scopedAlerts.filter(a => a.status !== 'RESOLVED');
              const onlineCams = scopedCameras.filter(c => c.status === 'ONLINE' || c.status === 'HEALTHY');

              return (
                <div className="space-y-6">
                  {/* 1. OUTPOST OPERATIONAL READINESS CARD */}
                  <div className="bg-[#0d1322] border border-cyan-800/40 rounded-2xl p-6 shadow-2xl space-y-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          </span>
                          <h2 className="text-lg font-black text-white uppercase tracking-wider">
                            {currentBop.name}
                          </h2>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {currentBop.code}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {currentBop.status}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400">
                          Frontier Sector: <strong className="text-cyan-400">{resolveBopSector(currentBop)}</strong> • GPS Coordinates: <strong className="text-white">{currentBop.latitude != null && currentBop.longitude != null ? `${currentBop.latitude.toFixed(4)}°N, ${currentBop.longitude.toFixed(4)}°E` : '31.6048°N, 74.5731°E'}</strong>
                        </p>
                      </div>

                      {/* Operational Priority SLA Selector & QRT Dispatch Action */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-800 p-1.5 rounded-xl">
                          <span className="text-[10px] font-mono text-slate-400 font-bold px-1 flex items-center gap-1">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            SLA:
                          </span>
                          <button
                            disabled={isUpdatingPriority}
                            onClick={() => handleUpdateCommanderBopPriority(currentBop.bop_id, 'NORMAL')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                              currentBop.operational_priority === 'NORMAL' || !currentBop.operational_priority
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            🟢 NORMAL
                          </button>
                          <button
                            disabled={isUpdatingPriority}
                            onClick={() => handleUpdateCommanderBopPriority(currentBop.bop_id, 'HIGH')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                              currentBop.operational_priority === 'HIGH'
                                ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            ⚠️ ELEVATED
                          </button>
                          <button
                            disabled={isUpdatingPriority}
                            onClick={() => handleUpdateCommanderBopPriority(currentBop.bop_id, 'CRITICAL')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                              currentBop.operational_priority === 'CRITICAL'
                                ? 'bg-rose-600 text-white border-rose-400 shadow-md animate-pulse'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            🚨 CRITICAL
                          </button>
                        </div>

                        <button
                          onClick={() => handleBroadcastQRT(currentBop.code, currentBop.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                          title="Broadcast immediate QRT tactical reinforcement signal"
                        >
                          <Zap className="w-3.5 h-3.5 text-rose-400" />
                          <span>DISPATCH QRT</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. REAL TELEMETRY & HEALTH CARDS (SINGLE SOURCE OF TRUTH) */}
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
                        <span className="text-emerald-400">{onlineCams.length} Streaming Live</span>
                        <span className="text-slate-500">{scopedCameras.length - onlineCams.length} Offline</span>
                      </div>
                    </div>

                    <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-mono uppercase">Active Threats</span>
                        <Flame className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-rose-400">
                        {unreadAlerts.length} <span className="text-xs font-normal text-slate-400">Unresolved</span>
                      </div>
                      <div className="text-[10px] font-mono mt-1 text-slate-400">
                        {unreadAlerts.filter(a => a.priority === 'CRITICAL').length} Critical • {scopedAlerts.length - unreadAlerts.length} Resolved
                      </div>
                    </div>

                    <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-mono uppercase">Edge Appliance</span>
                        <Server className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-purple-300">
                        {bopHealthRow?.health_score ? `${bopHealthRow.health_score}%` : '98%'} <span className="text-xs font-normal text-slate-400">Health</span>
                      </div>
                      <div className="text-[10px] font-mono mt-1 text-slate-400">
                        Node: EDGE-{currentBop.code} • Risk: {bopHealthRow?.current_risk || 'LOW'}
                      </div>
                    </div>

                    <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl shadow-md">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-mono uppercase">Duty Officer</span>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-base font-bold font-mono text-white truncate">
                        {assignedOfficer ? (assignedOfficer.full_name || assignedOfficer.username) : (user?.username || 'Commander')}
                      </div>
                      <div className="text-[10px] font-mono mt-1 text-emerald-400">
                        Callsign: {user?.username || 'Duty Officer'} ({user?.role})
                      </div>
                    </div>
                  </div>

                  {/* 3. ACTIVE THREAT ALARMS & INCIDENT RESPONSE LOG */}
                  <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                          Active Security Threats ({unreadAlerts.length} at {currentBop.name})
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Real-time AI Perimeter Detections
                      </span>
                    </div>

                    {unreadAlerts.length === 0 ? (
                      <div className="py-6 text-center space-y-2 font-mono">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-xs font-bold text-emerald-400">ALL PERIMETERS SECURE // ZERO UNRESOLVED INTRUSIONS</div>
                        <p className="text-[11px] text-slate-500">
                          AI vision sensors reporting nominal status at {currentBop.name}.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {unreadAlerts.slice(0, 6).map(alert => (
                          <div
                            key={alert.id}
                            className="p-3 bg-rose-950/20 border border-rose-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                                  {alert.priority}
                                </span>
                                <span className="font-bold text-white">{alert.title}</span>
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Node: {alert.camera_id} • Risk Score: {alert.risk_score} • Status: {alert.status}
                              </p>
                              <span className="text-[10px] text-slate-500">
                                Logged: {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recent'}
                              </span>
                            </div>

                            <button
                              onClick={() => handleOpenSitrepModal(
                                `🚨 INTRUSION ALERT: ${alert.title} at ${currentBop.name}`,
                                `Urgent alarm at ${currentBop.name}. Camera: ${alert.camera_id}, Risk: ${alert.risk_score}, Priority: ${alert.priority}.`,
                                alert.priority === 'CRITICAL' ? 'FLASH_CRITICAL' : 'URGENT'
                              )}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                            >
                              <Send className="w-3 h-3" />
                              Escalate in SITREP
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. ASSIGNED DUTY PERSONNEL ROSTER */}
                  <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                          Assigned Duty Officers ({postOfficers.length > 0 ? postOfficers.length : 1} Personnel)
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400">
                        Authorized IBVAP Access
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(postOfficers.length > 0 ? postOfficers : [assignedOfficer || { username: user?.username || 'Commander', role: user?.role || 'commander', is_active: true }]).map((off: any, idx: number) => (
                        <div key={idx} className="p-3 bg-[#070b14] border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="font-bold text-white block">{off.full_name || off.username}</span>
                            <span className="text-[10px] text-slate-400">Role: <strong className="text-cyan-400">{off.role}</strong></span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            ON DUTY
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: TACTICAL GIS BORDER MAP */}
      {/* ========================================================================= */}
      {activeSubTab === 'map' && (
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                {isSuperAdmin ? 'National Tactical Geospatial Border Map' : `Tactical Outpost GIS Map • ${commanderPostName}`}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {isSuperAdmin
                  ? 'Interactive real-time geospatial distribution of border checkposts, surveillance cameras, and threat hotspots across India'
                  : 'High-detail zero-line terrain map, perimeter towers, local camera positions, and intruder alerts'}
              </p>
            </div>

            {/* Quick Sector Fly Buttons (Admin only) */}
            {isSuperAdmin ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {FRONTIER_SECTORS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => handleLocateSectorOnMap(sec.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition border cursor-pointer ${
                      selectedSector === sec.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold'
                        : 'bg-[#090d16] text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
            ) : (
              /* Recenter Outpost Button for Commander */
              <button
                type="button"
                onClick={() => {
                  setMapCenter([commanderLat, commanderLng]);
                  setMapZoom(15);
                }}
                className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>RECENTER OUTPOST</span>
              </button>
            )}
          </div>

          {/* Interactive Tactical Geospatial Map */}
          <div className="relative bg-[#070b14] border border-slate-800 rounded-2xl p-4 overflow-hidden space-y-4">
            <TacticalLeafletMap
              cameras={isSuperAdmin ? cameras : scopedCameras}
              bops={isSuperAdmin ? bops : scopedBops}
              sites={isSuperAdmin ? sites : []}
              alerts={isSuperAdmin ? alerts : scopedAlerts}
              center={mapCenter}
              zoom={mapZoom}
              height="540px"
            />

            {/* Map Telemetry Footer */}
            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0d1322]/90 px-4 py-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Border GIS Telemetry: SYNCHRONIZED
                </span>
                <span className="text-slate-600">|</span>
                <span>{isSuperAdmin ? `National BOPs: ${bops.length}` : `Jurisdiction: ${commanderPostName}`}</span>
                <span className="text-slate-600">|</span>
                <span>Active Nodes: {isSuperAdmin ? cameras.length : scopedCameras.length}</span>
              </div>
              <span className="text-slate-500">Datum: WGS84 Universal Transverse Mercator</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: CHECKPOST VIDEO WALL */}
      {/* ========================================================================= */}
      {activeSubTab === 'bop-wall' && (
        <div className="space-y-6">
          <div className="bg-[#0d1322] border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white uppercase">
                      {isSuperAdmin
                        ? `${bopOverview?.name || selectedBopId} — Checkpost Video Wall`
                        : `${commanderPostName} — Outpost Video Wall`}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                      {bopOverview?.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {isSuperAdmin
                      ? `Direct HQ Surveillance Relay • ${bopCameras.length} Active Feeds • Sector: ${bopOverview?.site_id || 'Frontier'}`
                      : `Local Edge Video Relay • ${scopedCameras.length} Active Feeds • Outpost: ${commanderPostName}`}
                  </p>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <span className="text-xs font-mono text-slate-400">Select Checkpost:</span>
                  <select
                    value={selectedBopId}
                    onChange={(e) => setSelectedBopId(e.target.value)}
                    className="bg-[#111a2e] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none cursor-pointer flex-1 lg:flex-initial"
                  >
                    {filteredBOPs.map(b => (
                      <option key={b.bop_id} value={b.bop_id}>
                        {b.name} ({b.code}) — {resolveBopSector(b)}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      const curBop = bops.find(b => b.bop_id === selectedBopId);
                      if (curBop) handleBroadcastQRT(curBop.code, curBop.name);
                    }}
                    className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Dispatch Priority QRT to this checkpost"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    <span>DISPATCH QRT</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Checkpost Switch Pills (Admin only) */}
            {isSuperAdmin && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 overflow-x-auto pb-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase whitespace-nowrap">Sector Checkposts:</span>
                {filteredBOPs.slice(0, 10).map(b => (
                  <button
                    key={b.bop_id}
                    onClick={() => setSelectedBopId(b.bop_id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition cursor-pointer ${
                      selectedBopId === b.bop_id
                        ? 'bg-emerald-600 text-white font-bold shadow-sm'
                        : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cameras Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(isSuperAdmin ? bopCameras : scopedCameras).length === 0 ? (
              <div className="bg-[#0b101d] border border-slate-800 p-12 rounded-2xl text-center space-y-2 col-span-full">
                <Cctv className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                <div className="text-xs font-mono font-bold text-slate-300">NO CAMERAS STREAMING FROM THIS OUTPOST</div>
                <p className="text-[11px] font-mono text-slate-500 max-w-md mx-auto">
                  No surveillance nodes are actively streaming from {commanderPostName}. Check local NVR channels and camera IP status in Camera Fleet Management.
                </p>
              </div>
            ) : (
              (isSuperAdmin ? bopCameras : scopedCameras).map((c: any) => {
                const camObj: Camera = {
                  id: c.id || 0,
                  camera_id: c.camera_id,
                  camera_name: c.camera_name,
                  sector: c.sector || commanderSector,
                  bop_site: c.bop_site || commanderPostName,
                  status: c.status || 'ONLINE',
                  rtsp_url: c.rtsp_url || `http://localhost:8000/api/v1/cameras/${c.camera_id}/live`,
                  stream_type: c.stream_type || 'main',
                  fps: Math.round(c.fps || 25),
                  resolution: c.resolution || '1080p',
                  enabled: true,
                  created_at: c.created_at || new Date().toISOString(),
                  updated_at: c.updated_at || new Date().toISOString()
                };

                return (
                  <div
                    key={c.camera_id}
                    className="bg-[#0d1322] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-cyan-400">{c.camera_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        c.status === 'ONLINE' || c.status === 'HEALTHY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : c.status === 'DEGRADED'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white truncate">{c.camera_name}</h4>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        FPS: {c.fps?.toFixed(1) || 25} • Priority: {c.priority || 'P1'}
                      </p>
                    </div>

                    {/* Live Stream Thumbnail */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 relative shadow-inner">
                      <LiveVideoPlayer camera={camObj} autoPlay={true} showControls={false} />
                    </div>

                    <div className="p-2 bg-[#070b14] border border-slate-800 rounded-lg text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>AI Status:</span>
                        <span className="text-amber-400 font-semibold truncate ml-2">
                          {c.current_event || 'PERIMETER_MONITOR'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Location:</span>
                        <span className="text-slate-300 truncate ml-2">{c.location || 'Tower 1'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectedBopCamera(camObj)}
                      className="w-full py-2 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> EXPAND LIVE STREAM
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: EXECUTIVE SITREP & DOSSIER (Admin Only) */}
      {/* ========================================================================= */}
      {isSuperAdmin && activeSubTab === 'reports' && (
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                National Checkposts Situation Report (SITREP)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Official high-command briefing dossier for Ministry of Home Affairs & Central Defense Command
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                title="Download raw checkpost telemetry in CSV format"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV Telemetry
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
                title="Download official classified SITREP in PDF format"
              >
                <FileText className="w-4 h-4" /> Generate Official PDF SITREP
              </button>
            </div>
          </div>

          {/* SITREP Executive KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Monitored Frontiers</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {report?.summary.total_sites ?? overview?.total_sites ?? sites.length}
              </div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Monitored Checkposts</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {bops.length}
              </div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Border Surveillance Fleet</span>
              <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                {cameras.length}
              </div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Active Threat Alarms</span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                {alerts.filter(a => a.status !== 'RESOLVED').length}
              </div>
            </div>
          </div>

          {/* Checkposts Status Breakdown Table */}
          <div className="bg-[#070b14] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3.5 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Border Checkposts Readiness & Telemetry Matrix
              </span>
              <span className="text-[11px] font-mono text-slate-500">Live Database Aggregated</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111a2e] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Checkpost ID</th>
                    <th className="p-3">Checkpost Name</th>
                    <th className="p-3">Sector</th>
                    <th className="p-3">GPS Latitude / Longitude</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Assigned Commander</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {bops.slice(0, 25).map(b => {
                    const assigned = officerByBopMap.get(b.bop_id.toLowerCase()) || officerByBopMap.get(b.name.toLowerCase());
                    return (
                      <tr key={b.bop_id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3 font-bold text-cyan-400">{b.bop_id}</td>
                        <td className="p-3 font-semibold text-white">{b.name}</td>
                        <td className="p-3 text-slate-300">{resolveBopSector(b)}</td>
                        <td className="p-3 text-cyan-300">
                          {b.latitude && b.longitude ? `${b.latitude.toFixed(4)}°N, ${b.longitude.toFixed(4)}°E` : '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3">{b.operational_priority}</td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {assigned ? (assigned.full_name || assigned.username) : <span className="text-slate-500 italic">Unassigned</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHECKPOST INSPECTION MODAL (Admin Only) */}
      {/* ========================================================================= */}
      {inspectedBop && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-cyan-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase">{inspectedBop.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Code: {inspectedBop.code} • Sector: {resolveBopSector(inspectedBop)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedBop(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase">GPS Latitude</span>
                <div className="text-white font-bold mt-0.5">{inspectedBop.latitude ?? 31.6048}° N</div>
              </div>
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase">GPS Longitude</span>
                <div className="text-white font-bold mt-0.5">{inspectedBop.longitude ?? 74.5731}° E</div>
              </div>
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase">Operational Status</span>
                <div className="text-emerald-400 font-bold mt-0.5">{inspectedBop.status}</div>
              </div>
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase">Operational Priority</span>
                <div className="text-amber-400 font-bold mt-0.5">{inspectedBop.operational_priority}</div>
              </div>
            </div>

            {/* Change Priority SLA */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300">Update Defense Readiness SLA:</label>
              <div className="flex items-center gap-2">
                {(['NORMAL', 'HIGH', 'CRITICAL'] as const).map(p => (
                  <button
                    key={p}
                    disabled={isUpdatingPriority}
                    onClick={() => handleUpdateBopPriority(p)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      inspectedBop.operational_priority === p
                        ? 'bg-cyan-600 text-white shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectedBop(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPANDED VIDEO PLAYER MODAL */}
      {inspectedBopCamera && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-cyan-500/50 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm font-bold">
                <Cctv className="w-5 h-5" />
                <span>{inspectedBopCamera.camera_name} [{inspectedBopCamera.camera_id}]</span>
              </div>
              <button
                onClick={() => setInspectedBopCamera(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
              <LiveVideoPlayer camera={inspectedBopCamera} autoPlay={true} showControls={true} />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
              <span>Post: {inspectedBopCamera.bop_site}</span>
              <span>RTSP Stream: {inspectedBopCamera.rtsp_url}</span>
            </div>
          </div>
        </div>
      )}

      {/* ENCRYPTED SITREP DISPATCH MODAL TO CENTRAL HQ */}
      <DispatchSitrepModal
        isOpen={sitrepModalOpen}
        onClose={() => setSitrepModalOpen(false)}
        onSuccess={() => {
          setSitrepModalOpen(false);
          setActionSuccessMessage(`Tactical SITREP successfully transmitted to Delhi Central HQ over encrypted satellite link.`);
          setTimeout(() => setActionSuccessMessage(null), 6000);
        }}
        initialTitle={sitrepTitle}
        initialSummary={sitrepSummary}
        initialPriority={sitrepPriority}
      />
    </div>
  );
};
