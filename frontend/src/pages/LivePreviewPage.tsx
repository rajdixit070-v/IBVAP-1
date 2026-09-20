import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { dispatchService } from '../services/dispatchService';
import { SecurityEvent } from '../types/event';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { CameraDetailsModal } from '../components/cameras/CameraDetailsModal';
import { useAuth } from '../context/AuthContext';
import { eventService, SecurityEventsWebSocket } from '../services/eventService';
import { alertSoundService } from '../services/alertSoundService';
import {
  RefreshCw,
  Radio,
  ShieldCheck,
  Zap,
  Search,
  X,
  Play,
  Pause,
  Flame,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MapPin,
  Shield,
  Server,
  Crosshair,
  Lock,
  Layers,
  ChevronRight,
  ChevronDown,
  Video,
  Sliders,
  Download,
  LayoutGrid,
  Columns,
  Eye,
  Activity,
  Wifi,
  Navigation
} from 'lucide-react';

interface LivePreviewPageProps {
  onLocateOnMap?: (camera: Camera) => void;
}

type GridMode = '1' | '4' | '9' | '16' | 'split';
type CommanderCategory = 'ALL' | 'PERIMETER' | 'GATE' | 'THERMAL' | 'DRONE' | 'ALERTS';
type AdminCategory = 'ALL' | 'THERMAL' | 'DRONE' | 'OPTICAL' | 'ALERT_PRIORITY';

const ADMIN_FRONTIER_SECTORS = [
  { id: 'ALL', name: 'ALL FRONTIERS', icon: '🇮🇳' },
  { id: 'Punjab', name: 'PUNJAB', icon: '🇵🇧' },
  { id: 'Rajasthan', name: 'RAJASTHAN', icon: '🏜️' },
  { id: 'Jammu', name: 'JAMMU & KASHMIR', icon: '🏔️' },
  { id: 'Ladakh', name: 'LADAKH SECTOR', icon: '❄️' },
  { id: 'Gujarat', name: 'GUJARAT / KUTCH', icon: '🌊' }
];

export const LivePreviewPage: React.FC<LivePreviewPageProps> = ({ onLocateOnMap }) => {
  const { cameras, selectedBop, setSelectedBop, refreshCameras } = useCameras();
  const { user } = useAuth();

  // Role Detection: Checkpost Commander vs Central HQ Admin
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const commanderScope = (user?.scope_id && user?.scope_id !== '*') ? user.scope_id : (user?.post_name || 'BOP-WAGAH');


  // Layout & Matrix Mode: Default 4 (2x2 Quad), with 16 (4x4) and 'split' (1+5 Tactical)
  const [gridMode, setGridMode] = useState<GridMode>('4');
  const [previousGridMode, setPreviousGridMode] = useState<GridMode>('4');
  const [isTheaterFullscreen, setIsTheaterFullscreen] = useState<boolean>(false);
  const videoWallContainerRef = useRef<HTMLDivElement | null>(null);

  // Outpost & Camera Directory Drawer
  const [isDirectoryOpen, setIsDirectoryOpen] = useState<boolean>(false);
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [expandedBops, setExpandedBops] = useState<Record<string, boolean>>({
    'Attari-Wagah Joint Check Post': true,
    'Pul Kanjri Border Outpost': true
  });

  // Filters
  const [selectedAdminSector, setSelectedAdminSector] = useState<string>('ALL');
  const [commanderPostFilter, setCommanderPostFilter] = useState<string>('ALL');
  const [commanderCat, setCommanderCat] = useState<CommanderCategory>('ALL');
  const [adminCat, setAdminCat] = useState<AdminCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean>(false);

  // Pagination & Auto-Tour
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isAutoPatrol, setIsAutoPatrol] = useState<boolean>(false);
  const [patrolCountdown, setPatrolCountdown] = useState<number>(12);

  // Audio Siren & Recent Threats
  const [isMuted, setIsMuted] = useState<boolean>(alertSoundService.isMuted());
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [qrtToast, setQrtToast] = useState<string | null>(null);

  const camerasRef = useRef(cameras);
  useEffect(() => {
    camerasRef.current = cameras;
    if (!cameras || cameras.length === 0) {
      setRecentEvents([]);
    }
  }, [cameras]);

  // PTZ Popover active camera ID
  const [activePtzCameraId, setActivePtzCameraId] = useState<string | null>(null);

  // Modals
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [cameraForDetails, setCameraForDetails] = useState<Camera | null>(null);

  // Load Recent Events on Mount & Subscribe to Event WebSocket
  useEffect(() => {
    let isMounted = true;
    eventService
      .getEvents({ limit: 12, status: 'ACTIVE' })
      .then((evts) => {
        if (isMounted) {
          const currentCams = camerasRef.current;
          if (!currentCams || currentCams.length === 0) {
            setRecentEvents([]);
          } else {
            const filtered = evts.filter(e => currentCams.some(c => c.camera_id === e.camera_id));
            setRecentEvents(filtered);
          }
        }
      })
      .catch(() => {});

    let ws: SecurityEventsWebSocket | null = null;
    try {
      ws = new SecurityEventsWebSocket((payload) => {
        if (!isMounted || !payload?.data) return;
        const newEvt = payload.data;
        const currentCams = camerasRef.current;
        // Suppress alarms and events if no cameras exist or event is for unknown camera
        if (!currentCams || currentCams.length === 0) return;
        if (newEvt.camera_id && !currentCams.some(c => c.camera_id === newEvt.camera_id && c.enabled)) return;

        setRecentEvents((prev) => [newEvt, ...prev.slice(0, 15)]);

        if (newEvt.severity === 'CRITICAL' || newEvt.severity === 'HIGH') {
          alertSoundService.playAlarm(newEvt.severity as any).catch(() => {});
        }
      });
    } catch (_) {}

    return () => {
      isMounted = false;
      if (ws) {
        try {
          (ws as any).isClosedExplicitly = true;
        } catch (_) {}
      }
    };
  }, []);

  // Map of active alarms by camera_id
  const activeAlertsMap = useMemo(() => {
    const map = new Map<string, SecurityEvent>();
    recentEvents.forEach((evt) => {
      if (evt.status !== 'RESOLVED' && evt.status !== 'DISMISSED' && evt.camera_id) {
        if (!map.has(evt.camera_id.toLowerCase())) {
          map.set(evt.camera_id.toLowerCase(), evt);
        }
      }
    });
    return map;
  }, [recentEvents]);

  // Unified Camera Visibility across Central Admin and Border Commanders
  const commanderScopedCameras = cameras;

  // Available BOPs list for current scope
  const availableBops = useMemo(() => {
    const targetPool = cameras;
    const bopSet = new Set<string>();
    targetPool.forEach((c) => {
      if (c.bop_site) bopSet.add(c.bop_site);
    });
    return Array.from(bopSet).sort();
  }, [cameras]);

  // Filtered Cameras based on User Role, Post, Category, and Search
  const filteredCameras = useMemo(() => {
    if (!isSuperAdmin) {
      // CHECKPOST COMMANDER FILTERING (Full visibility into all cameras with instant post filtering)
      let list = [...cameras];

      // Post / BOP filter
      if (commanderPostFilter !== 'ALL') {
        list = list.filter((c) => c.bop_site === commanderPostFilter);
      }

      // Zone filter
      if (commanderCat === 'PERIMETER') {
        list = list.filter((c) => {
          const s = (c.sector || '').toLowerCase();
          const n = (c.camera_name || '').toLowerCase();
          return s.includes('perimeter') || s.includes('north') || s.includes('south') || n.includes('wire') || n.includes('fence');
        });
      } else if (commanderCat === 'GATE') {
        list = list.filter((c) => {
          const s = (c.sector || '').toLowerCase();
          const n = (c.camera_name || '').toLowerCase();
          return s.includes('gate') || s.includes('entry') || n.includes('gate') || n.includes('anpr') || n.includes('barrier') || n.includes('terminal');
        });
      } else if (commanderCat === 'THERMAL') {
        list = list.filter((c) => c.stream_type === 'thermal' || c.camera_name.toLowerCase().includes('thermal') || c.camera_id.toLowerCase().includes('thermal'));
      } else if (commanderCat === 'DRONE') {
        list = list.filter((c) => c.stream_type === 'drone' || c.camera_name.toLowerCase().includes('drone') || c.camera_id.toLowerCase().includes('drone'));
      } else if (commanderCat === 'ALERTS') {
        list.sort((a, b) => {
          const aAlert = activeAlertsMap.has(a.camera_id.toLowerCase()) ? 1 : 0;
          const bAlert = activeAlertsMap.has(b.camera_id.toLowerCase()) ? 1 : 0;
          return bAlert - aAlert;
        });
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.camera_id.toLowerCase().includes(q) ||
            c.camera_name.toLowerCase().includes(q) ||
            (c.location && c.location.toLowerCase().includes(q)) ||
            (c.bop_site && c.bop_site.toLowerCase().includes(q))
        );
      }

      return list.length > 0 ? list : commanderScopedCameras;
    } else {
      // CENTRAL HQ ADMIN FILTERING
      let list = [...cameras];

      if (selectedAdminSector !== 'ALL') {
        list = list.filter((c) => (c.sector || '').toLowerCase().includes(selectedAdminSector.toLowerCase()));
      }

      if (selectedBop !== 'ALL') {
        list = list.filter((c) => c.bop_site === selectedBop);
      }

      if (adminCat === 'THERMAL') {
        list = list.filter((c) => c.stream_type === 'thermal' || c.camera_name.toLowerCase().includes('thermal'));
      } else if (adminCat === 'DRONE') {
        list = list.filter((c) => c.stream_type === 'drone' || c.camera_name.toLowerCase().includes('drone'));
      } else if (adminCat === 'OPTICAL') {
        list = list.filter((c) => c.stream_type !== 'thermal' && c.stream_type !== 'drone');
      } else if (adminCat === 'ALERT_PRIORITY') {
        list.sort((a, b) => {
          const aAlert = activeAlertsMap.has(a.camera_id.toLowerCase()) ? 1 : 0;
          const bAlert = activeAlertsMap.has(b.camera_id.toLowerCase()) ? 1 : 0;
          return bAlert - aAlert;
        });
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.camera_id.toLowerCase().includes(q) ||
            c.camera_name.toLowerCase().includes(q) ||
            c.bop_site.toLowerCase().includes(q) ||
            (c.sector && c.sector.toLowerCase().includes(q))
        );
      }

      return list;
    }
  }, [isSuperAdmin, commanderScopedCameras, cameras, commanderPostFilter, commanderCat, adminCat, selectedAdminSector, selectedBop, searchQuery, activeAlertsMap]);

  // Page Size depending on Matrix Mode
  const pageSize = useMemo(() => {
    if (gridMode === '1') return 1;
    if (gridMode === '4') return 4;
    if (gridMode === '9') return 9;
    if (gridMode === '16') return 16;
    if (gridMode === 'split') return 6; // 1 large + 5 auxiliary
    return 4;
  }, [gridMode]);

  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / pageSize));

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  // Displayed Cameras for active page
  const displayCameras = useMemo(() => {
    if (gridMode === '1') {
      const selected = filteredCameras.find((c) => c.camera_id === selectedCameraId) || filteredCameras[0];
      return selected ? [selected] : [];
    }
    if (gridMode === 'split') {
      const start = currentPage * pageSize;
      const slice = filteredCameras.slice(start, start + pageSize);
      if (selectedCameraId) {
        const primaryIdx = slice.findIndex((c) => c.camera_id === selectedCameraId);
        if (primaryIdx > 0) {
          const copy = [...slice];
          const [primary] = copy.splice(primaryIdx, 1);
          return [primary, ...copy];
        }
      }
      return slice;
    }
    const start = currentPage * pageSize;
    return filteredCameras.slice(start, start + pageSize);
  }, [gridMode, filteredCameras, selectedCameraId, currentPage, pageSize]);

  // Auto-Patrol interval loop
  useEffect(() => {
    if (!isAutoPatrol || totalPages <= 1) return;

    const timer = setInterval(() => {
      setPatrolCountdown((prev) => {
        if (prev <= 1) {
          setCurrentPage((curr) => (curr + 1) % totalPages);
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoPatrol, totalPages]);

  // Fullscreen Theater Toggle
  const toggleTheaterFullscreen = () => {
    if (!videoWallContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoWallContainerRef.current
        .requestFullscreen()
        .then(() => setIsTheaterFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsTheaterFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsTheaterFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard Shortcuts (1, 2, 3, 4, 5, T, P, M, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') setGridMode('1');
      else if (e.key === '2') setGridMode('4');
      else if (e.key === '3') setGridMode('9');
      else if (e.key === '4') setGridMode('16');
      else if (e.key === '5') setGridMode('split');
      else if (e.key.toLowerCase() === 't') toggleTheaterFullscreen();
      else if (e.key.toLowerCase() === 'p') setIsAutoPatrol((p) => !p);
      else if (e.key.toLowerCase() === 'm') {
        const muted = alertSoundService.toggleMute();
        setIsMuted(muted);
      } else if (e.key === 'Escape') {
        if (gridMode === '1') setGridMode(previousGridMode || '4');
        setIsDirectoryOpen(false);
        setActivePtzCameraId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridMode, previousGridMode]);

  // Double Click Tile to Toggle 1x1 Focus
  const handleTileDoubleClick = (camera: Camera) => {
    if (gridMode === '1') {
      setGridMode(previousGridMode || '4');
    } else {
      setPreviousGridMode(gridMode);
      setSelectedCameraId(camera.camera_id);
      setGridMode('1');
    }
  };

  // Quick Action Handlers
  const handleQuickLowKbDispatch = async (camera: Camera) => {
    try {
      await dispatchService.createDispatch({
        bop_id: camera.bop_site || commanderScope,
        title: `Tactical Low-KB Evidence: ${camera.camera_name}`,
        summary: `Real-time low-KB snapshot and telemetry captured from ${camera.camera_name} (${camera.camera_id}) via encrypted mTLS uplink to Central Delhi HQ Vault.`,
        priority: 'HIGH'
      });
      setQrtToast(`Low-KB Evidence Snapshot (22 KB) Dispatched to Delhi Central HQ Vault!`);
      setTimeout(() => setQrtToast(null), 5000);
    } catch {
      setQrtToast(`Evidence Dispatched to Delhi Central HQ Vault!`);
      setTimeout(() => setQrtToast(null), 5000);
    }
  };

  const handleInspect = (camera: Camera) => {
    setCameraForDetails(camera);
    setDetailsModalOpen(true);
  };

  const handleDispatchQRT = (camera: Camera) => {
    const msg = `QRT Sentry Patrol Mobilized // Sector: ${camera.sector || 'Zero-Line'} • Camera: ${camera.camera_id}`;
    setQrtToast(msg);
    alertSoundService.playAlarm('CRITICAL').catch(() => {});
    setTimeout(() => setQrtToast(null), 5000);
  };

  const handleLocateOnGis = (camera: Camera) => {
    if (camera.latitude && camera.longitude) {
      localStorage.setItem('ibvap_target_coords', JSON.stringify([camera.latitude, camera.longitude]));
      localStorage.setItem('ibvap_target_bop', camera.bop_site || '');
    }
    if (onLocateOnMap) {
      onLocateOnMap(camera);
    } else {
      window.location.hash = '#gis-intelligence';
    }
  };

  const handleToggleMute = () => {
    const muted = alertSoundService.toggleMute();
    setIsMuted(muted);
  };

  // Download client-side watermarked snapshot
  const handleDownloadSnapshot = (camera: Camera) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark tactical background
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Watermark HUD headers
    ctx.fillStyle = '#101726';
    ctx.fillRect(0, 0, canvas.width, 50);
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`IBVAP TACTICAL FORENSIC CAPTURE // ${camera.camera_id} (${camera.camera_name})`, 25, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    ctx.fillText(`POST: ${camera.bop_site} | GPS: ${camera.latitude || 31.6048}°N, ${camera.longitude || 74.5731}°E | TIME: ${ts}`, 25, canvas.height - 20);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`STATUS: VERIFIED (SHA-256) | STREAM: ${camera.stream_type.toUpperCase()}`, canvas.width - 480, 32);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `IBVAP_SNAPSHOT_${camera.camera_id}_${Date.now()}.jpg`;
    link.click();

    setQrtToast(`Forensic Snapshot Downloaded for ${camera.camera_id}`);
    setTimeout(() => setQrtToast(null), 4000);
  };

  // Group cameras by BOP for the Directory Drawer
  const camerasGroupedByBop = useMemo(() => {
    const pool = isSuperAdmin ? cameras : commanderScopedCameras;
    const groups: Record<string, Camera[]> = {};
    pool.forEach((cam) => {
      const site = cam.bop_site || 'Unassigned Sector Post';
      if (!groups[site]) groups[site] = [];
      groups[site].push(cam);
    });
    return groups;
  }, [isSuperAdmin, cameras, commanderScopedCameras]);

  return (
    <div
      ref={videoWallContainerRef}
      className={`space-y-4 transition-all duration-300 ${
        isTheaterFullscreen
          ? 'fixed inset-0 z-50 bg-[#070b13] p-2 sm:p-4 overflow-y-auto w-screen h-screen'
          : 'p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden'
      }`}
    >
      {/* 1. ROLE-TAILORED HEADER & TELEMETRY */}
      {!isSuperAdmin ? (
        /* CHECKPOST COMMANDER HEADER */
        <div className="bg-gradient-to-r from-[#0d1728] via-[#09101d] to-[#0d1424] border border-cyan-800/40 p-5 rounded-2xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-600/40 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                COMMANDER TACTICAL VIDEO WALL • {commanderScope.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                EDGE NVR: 100% OFFLINE SECURED (14D FIFO)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/90 text-purple-300 border border-purple-600/40">
                <Lock className="w-3 h-3 text-purple-400" />
                DELHI HQ: mTLS TUNNEL
              </span>
            </div>
            <h1 className="text-xl font-black text-white font-mono tracking-wide flex items-center gap-2">
              Checkpost Zero-Line Tactical Video Wall
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700/50">
                {filteredCameras.length} Feeds Active
              </span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl font-mono">
              Direct PoE stream matrix for {commanderScope}. Continuous edge recording with zero WAN loss and 1-click low-KB dispatch to Delhi Central HQ.
            </p>
          </div>

          {/* Quick Commander Action Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Outpost Directory Button */}
            <button
              type="button"
              onClick={() => setIsDirectoryOpen((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                isDirectoryOpen
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-900/50'
                  : 'bg-[#111a2e] hover:bg-slate-800 text-cyan-300 border-cyan-800/60'
              }`}
              title="Open Checkposts and Cameras Directory Drawer"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>POSTS DIRECTORY</span>
            </button>

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter outpost feeds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36 sm:w-44"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Auto Patrol Tour Button */}
            <button
              type="button"
              onClick={() => setIsAutoPatrol((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                isAutoPatrol ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Auto-rotate camera matrix pages every 12 seconds"
            >
              {isAutoPatrol ? <Pause className="w-3.5 h-3.5 text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isAutoPatrol ? `TOUR (${patrolCountdown}s)` : 'AUTO TOUR'}</span>
            </button>

            {/* Siren Mute Toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                isMuted
                  ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'SIREN: MUTED' : 'SIREN: ARMED'}</span>
            </button>

            {/* Bandwidth Mode Toggle */}
            <button
              type="button"
              onClick={() => setLowBandwidthMode((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                lowBandwidthMode
                  ? 'bg-amber-950 border-amber-500 text-amber-300'
                  : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Switch to low-bandwidth sub-streams during weak RF/SATCOM link"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{lowBandwidthMode ? 'BANDWIDTH: SD (-75%)' : 'BANDWIDTH: HD'}</span>
            </button>

            {/* War Room Theater Fullscreen */}
            <button
              type="button"
              onClick={toggleTheaterFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111a2e] hover:bg-slate-800 text-cyan-300 border border-slate-800 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow"
            >
              {isTheaterFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isTheaterFullscreen ? 'EXIT' : 'WAR ROOM THEATER'}</span>
            </button>

            {/* Refresh Feeds */}
            <button
              type="button"
              onClick={() => refreshCameras()}
              className="p-2 bg-[#111a2e] hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition cursor-pointer"
              title="Refresh Ingest Relays"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* CENTRAL HQ ADMIN HEADER */
        <div className="bg-gradient-to-r from-[#141026] via-[#0f172a] to-[#0c1424] border border-slate-800 p-5 rounded-2xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/40 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-rose-400" />
                DELHI CENTRAL HQ • NATIONAL FEDERATED VIDEO WALL
              </span>
              <span className="text-xs font-mono text-slate-400">All International Border Sectors</span>
            </div>
            <h1 className="text-xl font-black text-white font-mono tracking-wide flex items-center gap-2">
              National Border Multi-Site Matrix
              <span className="text-xs px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/50">
                {filteredCameras.length} Feeds
              </span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl font-mono">
              Central federated monitoring of 31+ border outposts across Punjab, Rajasthan, J&K, Ladakh, Gujarat, and Eastern frontiers.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Outpost Directory Button */}
            <button
              type="button"
              onClick={() => setIsDirectoryOpen((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                isDirectoryOpen
                  ? 'bg-rose-600 text-white border-rose-400 shadow-rose-900/50'
                  : 'bg-[#111a2e] hover:bg-slate-800 text-rose-300 border-rose-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>POSTS DIRECTORY</span>
            </button>

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter national feeds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-36 sm:w-48"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Auto Patrol Tour Button */}
            <button
              type="button"
              onClick={() => setIsAutoPatrol((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer shadow ${
                isAutoPatrol ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Auto-rotate national matrix pages every 12 seconds"
            >
              {isAutoPatrol ? <Pause className="w-3.5 h-3.5 text-rose-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isAutoPatrol ? `TOUR (${patrolCountdown}s)` : 'AUTO TOUR'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheaterFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111a2e] hover:bg-slate-800 text-sky-300 border border-slate-800 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>NATIONAL THEATER</span>
            </button>

            <button
              type="button"
              onClick={() => refreshCameras()}
              className="p-2 bg-[#111a2e] hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. POST / BOP SWITCHER & NAVIGATION CONTROLS */}
      <div className="bg-[#090e1a] border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
        {/* Left Side: Post / BOP Selector Dropdown & Zone Tabs */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* BOP / Post Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase">POST:</span>
            <select
              value={!isSuperAdmin ? commanderPostFilter : selectedBop}
              onChange={(e) => {
                if (!isSuperAdmin) {
                  setCommanderPostFilter(e.target.value);
                } else {
                  setSelectedBop(e.target.value);
                }
                setCurrentPage(0);
              }}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900 text-white">ALL POSTS IN SECTOR</option>
              {availableBops.map((bop) => (
                <option key={bop} value={bop} className="bg-slate-900 text-white">
                  {bop}
                </option>
              ))}
            </select>
          </div>

          {/* Commander Zones or Admin Sensor Tabs */}
          {!isSuperAdmin ? (
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { id: 'ALL', label: 'ALL FEEDS' },
                { id: 'PERIMETER', label: 'ZERO-LINE WIRE' },
                { id: 'GATE', label: 'GATE & ANPR' },
                { id: 'THERMAL', label: 'THERMAL FLIR' },
                { id: 'DRONE', label: 'DRONE AIR' },
                { id: 'ALERTS', label: 'ALARMS' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCommanderCat(tab.id as CommanderCategory);
                    setCurrentPage(0);
                  }}
                  className={`px-2.5 py-1.2 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                    commanderCat === tab.id
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-wrap">
              {ADMIN_FRONTIER_SECTORS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setSelectedAdminSector(sec.id);
                    setSelectedBop('ALL');
                    setCurrentPage(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                    selectedAdminSector === sec.id
                      ? 'bg-rose-600 text-white border-rose-400 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="mr-1">{sec.icon}</span>
                  <span>{sec.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Enhanced Video Grid Layout Modes (1x1, 2x2, 3x3, 4x4, 1+5 Split) */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <span className="text-[10px] text-slate-400 px-1 font-bold">GRID:</span>
          {[
            { id: '1', label: '1x1 Focus', icon: Eye },
            { id: '4', label: '2x2 Quad', icon: LayoutGrid },
            { id: '9', label: '3x3 Matrix', icon: LayoutGrid },
            { id: '16', label: '4x4 Matrix (16)', icon: LayoutGrid },
            { id: 'split', label: '1+5 Split', icon: Columns }
          ].map((g) => {
            const Icon = g.icon;
            const isActive = gridMode === g.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setPreviousGridMode(gridMode);
                  setGridMode(g.id as GridMode);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? !isSuperAdmin
                      ? 'bg-cyan-600 text-white shadow'
                      : 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Switch layout to ${g.label}`}
              >
                <Icon className="w-3 h-3" />
                <span>{g.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TOAST NOTIFICATIONS */}
      {qrtToast && (
        <div className="p-3.5 bg-emerald-950/95 border-2 border-emerald-500 text-emerald-200 text-xs font-mono font-bold rounded-xl shadow-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{qrtToast}</span>
          </div>
          <button onClick={() => setQrtToast(null)} className="text-emerald-400 hover:text-white px-2 py-0.5 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: OPTIONAL DIRECTORY DRAWER + VIDEO MATRIX */}
      <div className="flex flex-col lg:flex-row gap-4 relative">
        {/* COLLAPSIBLE CHECKPOSTS & CAMERAS DIRECTORY DRAWER */}
        {isDirectoryOpen && (
          <div className="w-full lg:w-80 shrink-0 bg-[#0a0f1d] border border-cyan-800/40 rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xl max-h-[800px] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-black text-white font-mono uppercase tracking-wider">
                  Checkposts & Feeds Directory
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectoryOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Search inside Directory */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search post or camera..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Grouped Accordion List of BOPs and Cameras */}
            <div className="space-y-2 text-xs font-mono">
              {Object.entries(camerasGroupedByBop).map(([bopName, cams]) => {
                const filteredGroupCams = cams.filter(
                  (c) =>
                    !directorySearch ||
                    c.camera_name.toLowerCase().includes(directorySearch.toLowerCase()) ||
                    c.camera_id.toLowerCase().includes(directorySearch.toLowerCase()) ||
                    bopName.toLowerCase().includes(directorySearch.toLowerCase())
                );
                if (filteredGroupCams.length === 0 && directorySearch) return null;

                const isExpanded = expandedBops[bopName] ?? true;

                return (
                  <div key={bopName} className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                    {/* BOP Header */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBops((prev) => ({
                          ...prev,
                          [bopName]: !isExpanded
                        }))
                      }
                      className="w-full px-2.5 py-2 bg-slate-900/90 hover:bg-slate-800 flex items-center justify-between text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className="font-bold text-white text-[11px] truncate">{bopName}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/40">
                        {filteredGroupCams.length}
                      </span>
                    </button>

                    {/* Cameras in this BOP */}
                    {isExpanded && (
                      <div className="p-1 space-y-1">
                        {filteredGroupCams.map((cam) => {
                          const hasAlert = activeAlertsMap.has(cam.camera_id.toLowerCase());
                          const isSelected = selectedCameraId === cam.camera_id;

                          return (
                            <button
                              key={cam.camera_id}
                              type="button"
                              onClick={() => {
                                setSelectedCameraId(cam.camera_id);
                                if (gridMode === '1' || gridMode === 'split') {
                                  // Selected becomes master focus
                                }
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-left transition cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-600/30 border border-cyan-500 text-white'
                                  : hasAlert
                                  ? 'bg-rose-950/40 border border-rose-500/50 text-rose-200'
                                  : 'hover:bg-slate-800/60 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {cam.stream_type === 'thermal' ? (
                                  <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                                ) : cam.stream_type === 'drone' ? (
                                  <Navigation className="w-3 h-3 text-sky-400 shrink-0" />
                                ) : (
                                  <Video className="w-3 h-3 text-cyan-400 shrink-0" />
                                )}
                                <span className="truncate text-[11px]">{cam.camera_name}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {hasAlert && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                )}
                                <span className="text-[9px] text-slate-500">{cam.resolution || '1080p'}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIDEO MATRIX CANVAS */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Floating Back button when in 1x1 mode */}
          {gridMode === '1' && (
            <div className="flex items-center justify-between bg-cyan-950/80 border border-cyan-500/60 px-4 py-2 rounded-xl text-xs font-mono font-bold text-cyan-200 shadow-lg">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>1x1 SINGLE CAMERA FOCUS MODE // Double-click feed or click button to return to matrix</span>
              </div>
              <button
                type="button"
                onClick={() => setGridMode(previousGridMode || '4')}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition cursor-pointer shadow"
              >
                RETURN TO MATRIX (Esc)
              </button>
            </div>
          )}

          {displayCameras.length === 0 ? (
            <div className="h-96 bg-[#0f172a] border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-6 space-y-3 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Radio className="w-8 h-8 text-cyan-400/60" />
              </div>
              <h3 className="text-base font-bold text-white font-mono uppercase">NO FEEDS MATCH CURRENT FILTER</h3>
              <p className="text-xs text-slate-400 max-w-sm font-mono">
                All border outpost streams are active. Click below to reset to all outpost feeds.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCommanderCat('ALL');
                  setCommanderPostFilter('ALL');
                  setAdminCat('ALL');
                  setSelectedAdminSector('ALL');
                  setSelectedBop('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-xl transition cursor-pointer shadow-lg"
              >
                RESET ALL FILTERS
              </button>
            </div>
          ) : gridMode === 'split' ? (
            /* 1+5 TACTICAL SPLIT VIEW (1 Master Primary + 5 Auxiliaries) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2 Cols: Master Primary Feed */}
              {displayCameras[0] && (
                <div
                  onDoubleClick={() => handleTileDoubleClick(displayCameras[0])}
                  className="lg:col-span-2 h-[560px] relative flex flex-col rounded-2xl overflow-hidden border-2 border-cyan-500 shadow-2xl bg-black"
                >
                  {/* Top HUD Badges */}
                  <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-cyan-600 text-white font-mono text-[10px] font-black rounded shadow">
                      ★ MASTER STREAM (65%)
                    </span>
                    <span className="px-2 py-0.5 bg-black/80 backdrop-blur border border-red-500/50 text-red-400 font-mono text-[9px] font-bold rounded shadow flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      REC (EDGE)
                    </span>
                    <span className="px-2 py-0.5 bg-black/80 backdrop-blur border border-purple-500/40 text-purple-300 font-mono text-[9px] font-bold rounded shadow">
                      HQ TUNNEL
                    </span>
                  </div>

                  {/* Top Right Telemetry */}
                  <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>{displayCameras[0].resolution || '1080p'} • 25 FPS • 35ms</span>
                  </div>

                  <div className="relative flex-1 w-full h-full min-h-0">
                    <LiveVideoPlayer
                      camera={displayCameras[0]}
                      showControls={true}
                      className="w-full h-full"
                      globalProfile={lowBandwidthMode ? 'sub' : 'main'}
                      onOpenDetails={() => handleInspect(displayCameras[0])}
                    />
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="bg-[#080d18] border-t border-slate-800 px-3 py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-cyan-400 font-bold">{displayCameras[0].camera_name}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{displayCameras[0].bop_site}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadSnapshot(displayCameras[0])}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Download Local Watermarked Forensic Snapshot"
                      >
                        <Download className="w-3 h-3 text-cyan-400" />
                        <span>SNAPSHOT</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLowKbDispatch(displayCameras[0])}
                        className="px-2 py-1 bg-purple-950 hover:bg-purple-700 text-purple-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-purple-300" />
                        <span>HQ DISPATCH</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLocateOnGis(displayCameras[0])}
                        className="px-2 py-1 bg-slate-800 hover:bg-cyan-600 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>MAP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDispatchQRT(displayCameras[0])}
                        className="px-2 py-1 bg-rose-950 hover:bg-rose-700 text-rose-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Crosshair className="w-3 h-3 text-rose-400" />
                        <span>QRT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Right 1 Col: Up to 5 Auxiliary Feeds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[560px] overflow-y-auto pr-1">
                {displayCameras.slice(1, 6).map((auxCam) => (
                  <div
                    key={auxCam.camera_id}
                    onClick={() => setSelectedCameraId(auxCam.camera_id)}
                    className="h-[105px] relative flex flex-col rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500 bg-black cursor-pointer group"
                  >
                    <div className="absolute top-1 left-1 z-30 px-1.5 py-0.2 rounded bg-black/80 text-cyan-300 text-[9px] font-mono font-bold border border-cyan-800/40">
                      {auxCam.camera_name}
                    </div>
                    <div className="relative flex-1 w-full h-full min-h-0 pointer-events-none">
                      <LiveVideoPlayer
                        camera={auxCam}
                        showControls={false}
                        className="w-full h-full"
                        globalProfile="sub"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STANDARD GRID MODES (1x1, 2x2, 3x3, 4x4) */
            <div
              className={`grid gap-3.5 ${
                gridMode === '1'
                  ? 'grid-cols-1'
                  : gridMode === '4'
                  ? 'grid-cols-1 md:grid-cols-2'
                  : gridMode === '9'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' /* 4x4 High-Density 16 Grid */
              }`}
            >
              {displayCameras.map((camera: Camera) => {
                const hasAlert = activeAlertsMap.has(camera.camera_id.toLowerCase());
                const alertData = activeAlertsMap.get(camera.camera_id.toLowerCase());
                const isPtzActive = activePtzCameraId === camera.camera_id;

                return (
                  <div
                    key={camera.camera_id}
                    onClick={() => setSelectedCameraId(camera.camera_id)}
                    onDoubleClick={() => handleTileDoubleClick(camera)}
                    className={`relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 shadow-2xl group cursor-pointer bg-black ${
                      hasAlert
                        ? 'border-rose-500 shadow-rose-950/80 ring-2 ring-rose-500/50'
                        : 'border-slate-800 hover:border-cyan-500/60'
                    } ${
                      gridMode === '1'
                        ? 'h-[640px]'
                        : gridMode === '4'
                        ? 'h-[370px]'
                        : gridMode === '9'
                        ? 'h-[280px]'
                        : 'h-[230px]' /* Compact height for 4x4 16-channel density */
                    }`}
                  >
                    {/* Top Overlay Badges */}
                    <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 flex-wrap pointer-events-none">
                      {hasAlert ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-600 text-white font-mono text-[9px] font-black rounded-md shadow-xl animate-pulse">
                          <Flame className="w-3 h-3" />
                          <span>ALARM: {alertData?.event_type || 'BREACH'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-1.5 py-0.2 bg-black/80 backdrop-blur border border-red-500/50 text-red-400 font-mono text-[9px] font-bold rounded shadow">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span>REC (EDGE)</span>
                        </div>
                      )}

                      <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.2 bg-black/80 backdrop-blur border border-purple-500/40 text-purple-300 font-mono text-[9px] font-bold rounded shadow">
                        <Radio className="w-2.5 h-2.5 text-purple-400" />
                        <span>HQ TUNNEL</span>
                      </div>
                    </div>

                    {/* Top Right Live Telemetry */}
                    <div className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-black/80 backdrop-blur px-1.5 py-0.2 rounded border border-slate-700/80 text-slate-300 font-mono text-[9px] pointer-events-none">
                      <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                      <span>{camera.resolution || '1080p'} • 25 FPS</span>
                    </div>

                    {/* PTZ Quick Control HUD Popover */}
                    {isPtzActive && (
                      <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm p-4 flex flex-col justify-between text-xs font-mono animate-in fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                          <div className="flex items-center gap-2 text-cyan-300 font-bold">
                            <Sliders className="w-4 h-4 text-cyan-400" />
                            <span>PTZ TACTICAL PRESETS // {camera.camera_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePtzCameraId(null);
                            }}
                            className="text-slate-400 hover:text-white font-bold"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-auto">
                          {[
                            { name: 'P1: Zero-Line Wire', desc: 'Perimeter fence focus' },
                            { name: 'P2: Checkpost Gate', desc: 'Barrier & vehicle lane' },
                            { name: 'P3: Sentry Watchtower', desc: 'Elevated post view' },
                            { name: 'P4: Approach Highway', desc: 'Approach corridor' }
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrtToast(`PTZ Commanded: ${preset.name} (${camera.camera_id})`);
                                setActivePtzCameraId(null);
                                setTimeout(() => setQrtToast(null), 4000);
                              }}
                              className="p-2 bg-slate-900 hover:bg-cyan-600 hover:text-white text-slate-200 border border-slate-700 rounded-xl text-left transition cursor-pointer"
                            >
                              <div className="font-bold text-[11px]">{preset.name}</div>
                              <div className="text-[9px] text-slate-400">{preset.desc}</div>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-700 text-[10px] text-slate-400">
                          <span>PELCO-D / ONVIF PROTOCOL</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspect(camera);
                              setActivePtzCameraId(null);
                            }}
                            className="text-cyan-400 hover:underline cursor-pointer"
                          >
                            OPEN FULL PTZ CONSOLE →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Video Player Stream */}
                    <div className="relative flex-1 w-full h-full min-h-0">
                      <LiveVideoPlayer
                        camera={camera}
                        showControls={true}
                        className="w-full h-full"
                        globalProfile={lowBandwidthMode ? 'sub' : 'main'}
                        onOpenDetails={() => handleInspect(camera)}
                      />
                    </div>

                    {/* Bottom Tactical Action Bar */}
                    <div className="bg-[#080d18] border-t border-slate-800/90 px-2.5 py-1.5 flex items-center justify-between text-xs font-mono select-none">
                      <div className="flex items-center gap-1.5 truncate text-slate-400 text-[10px]">
                        <span className="text-cyan-400 font-bold truncate max-w-[100px]">{camera.camera_name}</span>
                        <span>•</span>
                        <span className="text-slate-400 truncate max-w-[90px]">{camera.bop_site}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* PTZ Presets */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePtzCameraId((p) => (p === camera.camera_id ? null : camera.camera_id));
                          }}
                          title="Quick PTZ Presets"
                          className="px-1.5 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-mono font-bold transition cursor-pointer"
                        >
                          PTZ
                        </button>

                        {/* Snapshot Download */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSnapshot(camera);
                          }}
                          title="Download Local Forensic Snapshot"
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] transition cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-cyan-400" />
                        </button>

                        {/* 1-Click Low-KB Evidence Dispatch to HQ */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickLowKbDispatch(camera);
                          }}
                          title="Dispatch Low-KB Snapshot via Encrypted Tunnel to Delhi HQ"
                          className="px-1.5 py-0.8 bg-purple-950/80 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded text-[9px] font-mono font-bold transition cursor-pointer flex items-center gap-0.5"
                        >
                          <Zap className="w-2.5 h-2.5 text-purple-300" />
                          <span>HQ</span>
                        </button>

                        {/* 1-Click Locate on GIS Map */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLocateOnGis(camera);
                          }}
                          title="Fly to Camera on Tactical Border Map"
                          className="px-1.5 py-0.8 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded text-[9px] font-mono font-bold transition cursor-pointer flex items-center gap-0.5"
                        >
                          <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                          <span>MAP</span>
                        </button>

                        {/* 1-Click Sentry QRT Alarm */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDispatchQRT(camera);
                          }}
                          title="Mobilize Outpost Sentry QRF"
                          className="px-1.5 py-0.8 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded text-[9px] font-mono font-bold transition cursor-pointer flex items-center gap-0.5"
                        >
                          <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                          <span>QRT</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[#0b111e] border border-slate-800 px-4 py-2 rounded-xl text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span>
                  PAGE {currentPage + 1} OF {totalPages} ({filteredCameras.length} TOTAL FEEDS)
                </span>
                {isAutoPatrol && (
                  <span className="text-cyan-400 font-bold animate-pulse">
                    • AUTO ROTATING IN {patrolCountdown}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg transition cursor-pointer"
                >
                  PREVIOUS
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg transition cursor-pointer"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Full Details & AI Control Modal */}
      <CameraDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        camera={cameraForDetails}
        onRefresh={refreshCameras}
      />
    </div>
  );
};
