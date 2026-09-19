import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useCameras } from '../../context/CameraContext';
import { Camera } from '../../types/camera';
import { Incident, Alert } from '../../types/incident';
import { BOP, Site } from '../../types/federation';
import { incidentService } from '../../services/incidentService';
import { federationService } from '../../services/federationService';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import {
  Layers,
  Eye,
  Crosshair,
  Laptop,
  Plane,
  Smartphone,
  Map as MapIcon,
  LayoutGrid,
  MapPin,
  ShieldAlert,
  Compass,
  Search,
  RotateCcw
} from 'lucide-react';
import { TacticalLeafletMap } from '../common/TacticalLeafletMap';
import { COMPREHENSIVE_CHECKPOSTS } from '../../constants/checkposts';

interface SituationalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents?: Incident[];
  alerts?: Alert[];
  bops?: BOP[];
  sites?: Site[];
  selectedSector?: string;
  onSelectIncident?: (inc: Incident) => void;
  onInspectCamera?: (cam: Camera) => void;
  targetCamera?: Camera | null;
  targetBop?: string | null;
}

const FRONTIER_JUMPS: Array<{ id: string; label: string; coords: [number, number]; zoom: number }> = [
  { id: 'ALL', label: '🇮🇳 ALL BORDERS', coords: [28.6139, 77.2090], zoom: 5 },
  { id: 'Punjab', label: '🇵🇧 PUNJAB', coords: [31.6048, 74.5731], zoom: 10 },
  { id: 'Rajasthan', label: '🏜️ RAJASTHAN', coords: [27.5255, 70.1558], zoom: 8 },
  { id: 'Jammu', label: '🏔️ J&K', coords: [32.6105, 74.6980], zoom: 9 },
  { id: 'Ladakh', label: '❄️ LADAKH', coords: [34.7578, 78.2241], zoom: 8 },
  { id: 'Gujarat', label: '🌊 GUJARAT', coords: [23.8560, 68.6740], zoom: 9 },
  { id: 'Eastern', label: '🌲 EASTERN', coords: [25.1873, 92.0197], zoom: 7 },
];

export const SituationalMapModal: React.FC<SituationalMapModalProps> = ({
  isOpen,
  onClose,
  incidents = [],
  alerts = [],
  bops: initialBops = [],
  sites: initialSites = [],
  selectedSector: initialSector = 'ALL',
  onSelectIncident,
  onInspectCamera,
  targetCamera,
  targetBop
}) => {
  const { cameras } = useCameras();
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>(incidents);
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>(alerts);
  const [bops, setBops] = useState<BOP[]>(initialBops);
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [selectedCam, setSelectedCam] = useState<Camera | null>(targetCamera || null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INCIDENT' | 'ONLINE'>('ALL');
  const [viewMode, setViewMode] = useState<'map' | '3d' | 'grid'>('map');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map viewport control
  const [activeSector, setActiveSector] = useState<string>(initialSector);
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState<number>(5);

  useEffect(() => {
    if (targetCamera && targetCamera.latitude && targetCamera.longitude) {
      setSelectedCam(targetCamera);
      setMapCenter([targetCamera.latitude, targetCamera.longitude]);
      setMapZoom(14);
    } else if (targetBop && bops.length > 0) {
      const match = bops.find((b) => b.bop_id.toLowerCase() === targetBop.toLowerCase() || b.name.toLowerCase() === targetBop.toLowerCase());
      if (match && match.latitude && match.longitude) {
        setMapCenter([match.latitude, match.longitude]);
        setMapZoom(14);
      }
    }
  }, [targetCamera, targetBop, bops]);

  useEffect(() => {
    if (isOpen) {
      loadLiveIncidents();
      if (bops.length === 0) {
        federationService.listBOPs().then((data) => setBops(data || [])).catch(() => {});
      }
      if (sites.length === 0) {
        federationService.listSites().then((data) => setSites(data || [])).catch(() => {});
      }
      const interval = setInterval(loadLiveIncidents, 3500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadLiveIncidents = async () => {
    try {
      const [incData, alertData] = await Promise.all([
        incidentService.getIncidents({ limit: 40 }),
        incidentService.getAlerts({ limit: 60 })
      ]);
      setLiveIncidents(incData);
      setLiveAlerts(alertData);
    } catch (e) {
      console.error('Failed to load map incidents', e);
    }
  };

  const handleSectorJump = (jump: typeof FRONTIER_JUMPS[0]) => {
    setActiveSector(jump.id);
    setMapCenter(jump.coords);
    setMapZoom(jump.zoom);
  };

  // Fallback to comprehensive border posts if cameras are empty so Nodes Grid is always active
  const allAvailableNodes: Camera[] = cameras.length > 0 ? cameras : COMPREHENSIVE_CHECKPOSTS.map((chk) => ({
    camera_id: chk.id,
    camera_name: `${chk.name} Sentinel Cam`,
    latitude: chk.latitude || 31.6048,
    longitude: chk.longitude || 74.5731,
    bop_site: chk.name,
    sector: chk.sector,
    status: 'ONLINE',
    stream_type: 'main',
    site_id: chk.code,
    resolution: '4K Tactical IR',
    fps: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as Camera));

  const filteredCameras = allAvailableNodes.filter((cam) => {
    const hasInc = liveIncidents.some((i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'RESOLVED');
    const hasAlert = liveAlerts.some((a) => a.camera_id === cam.camera_id && a.status !== 'RESOLVED');
    if (activeFilter === 'INCIDENT' && !(hasInc || hasAlert)) return false;
    if (activeFilter === 'ONLINE' && !(cam.status === 'ONLINE' || cam.status === 'HEALTHY')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = cam.camera_id.toLowerCase().includes(q);
      const matchName = cam.camera_name.toLowerCase().includes(q);
      const matchBop = (cam.bop_site || '').toLowerCase().includes(q);
      const matchSector = (cam.sector || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchBop && !matchSector) return false;
    }
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="National Border GIS Situational Tactical Matrix"
      subtitle="Geospatial distribution of Border Outposts (BOPs), Defense Sensors, and Live Border Threat Vectors"
      maxWidth="6xl"
    >
      <div className="space-y-3.5">
        {/* Frontier Sector Quick Jump Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[10px] font-mono text-slate-400 font-bold px-1.5 flex items-center gap-1 shrink-0">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            JUMP SECTOR:
          </span>
          {FRONTIER_JUMPS.map((jump) => {
            const isSelected = activeSector === jump.id;
            return (
              <button
                key={jump.id}
                onClick={() => handleSectorJump(jump)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition border shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-500/20 font-bold'
                    : 'bg-[#090d16] text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                {jump.label}
              </button>
            );
          })}
        </div>

        {/* Map Header & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d131f] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-300">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-white uppercase tracking-wider">
              {activeSector === 'ALL' ? 'INDIAN BORDER SECURITY GRID' : `${activeSector.toUpperCase()} SECTOR CORRIDOR`}
            </span>
            <span className="text-slate-600">//</span>
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {mapCenter[0].toFixed(4)}° N, {mapCenter[1].toFixed(4)}° E
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Nodes in Grid or Map */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search nodes, BOPs, sectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-6 py-1 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 w-44 sm:w-52"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  viewMode === 'map' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                GIS Radar
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  viewMode === '3d' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⛰️</span>
                3D Terrain
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Nodes Grid ({filteredCameras.length})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400">Filter:</span>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                    activeFilter === 'ALL' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({allAvailableNodes.length})
                </button>
                <button
                  onClick={() => setActiveFilter('INCIDENT')}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                    activeFilter === 'INCIDENT' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Threats
                </button>
                <button
                  onClick={() => setActiveFilter('ONLINE')}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                    activeFilter === 'ONLINE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Online
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Display: Real Leaflet Map View, 3D Terrain View OR Grid View */}
        {viewMode === 'map' || viewMode === '3d' ? (
          <TacticalLeafletMap
            key="situational-tactical-map"
            cameras={filteredCameras}
            bops={bops}
            sites={sites}
            alerts={liveAlerts}
            onCameraSelect={(cam) => setSelectedCam(cam)}
            center={mapCenter}
            targetCoords={mapCenter}
            zoom={mapZoom}
            selectedCameraId={selectedCam?.camera_id}
            viewDimension={viewMode === '3d' ? '3d' : '2d'}
            onDimensionChange={(dim) => setViewMode(dim === '3d' ? '3d' : 'map')}
            height="min(500px, 60vh)"
          />
        ) : (
          /* Main Interactive Tactical Grid Display */
          <div className="relative w-full min-h-[440px] max-h-[520px] overflow-y-auto bg-[#070b12] border border-[#1e293b] rounded-2xl p-4">
            {filteredCameras.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-3">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <div className="text-sm font-bold text-white font-mono">No Surveillance Nodes Found</div>
                <div className="text-xs text-slate-400 font-mono mt-1 max-w-sm">
                  No perimeter cameras or outposts matched the current filter or search criteria.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCameras.map((cam: Camera) => {
                  const activeInc = liveIncidents.find(
                    (i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'RESOLVED' && i.status !== 'FALSE_ALARM'
                  );
                  const activeAlert = liveAlerts.find(
                    (a) => a.camera_id === cam.camera_id && a.status !== 'RESOLVED'
                  );
                  const isSelected = selectedCam?.camera_id === cam.camera_id;

                  const url = cam.rtsp_url || '';
                  const st = cam.stream_type || '';
                  let MarkerIcon = Crosshair;
                  let markerColor = (activeInc || activeAlert) ? 'text-rose-400 animate-spin' : 'text-sky-400';
                  if (st === 'drone' || url.startsWith('udp://') || url.startsWith('rtmp://')) {
                    MarkerIcon = Plane;
                    if (!activeInc && !activeAlert) markerColor = 'text-purple-400';
                  } else if (st === 'webcam' || url.startsWith('webcam://')) {
                    MarkerIcon = Laptop;
                    if (!activeInc && !activeAlert) markerColor = 'text-cyan-400';
                  } else if (st === 'android' || url.includes(':8080') || url.includes(':4747')) {
                    MarkerIcon = Smartphone;
                    if (!activeInc && !activeAlert) markerColor = 'text-emerald-400';
                  }

                  return (
                    <div
                      key={cam.camera_id}
                      onClick={() => {
                        setSelectedCam(cam);
                        setMapCenter([cam.latitude || 31.6048, cam.longitude || 74.5731]);
                        setMapZoom(16);
                        setViewMode('map');
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer relative group flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-400 shadow-xl shadow-sky-500/20'
                          : (activeInc || activeAlert)
                          ? 'bg-rose-950/70 border-rose-500 shadow-xl shadow-rose-500/30 ring-1 ring-rose-500'
                          : 'bg-[#0f172a]/80 border-slate-800 hover:border-slate-700 hover:bg-[#131d35]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <MarkerIcon className={`w-3.5 h-3.5 ${markerColor}`} />
                            <span className="text-[11px] font-mono font-bold text-slate-200">{cam.camera_id}</span>
                          </div>

                          {(activeInc || activeAlert) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeInc && onSelectIncident) onSelectIncident(activeInc);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-black font-mono tracking-wider shadow-lg animate-pulse"
                            >
                              🚨 THREAT
                            </button>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 ${
                                cam.status === 'ONLINE' || cam.status === 'HEALTHY'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : cam.status === 'MAINTENANCE'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {cam.status || 'OFFLINE'}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-white truncate">{cam.camera_name}</div>
                        
                        {/* Live Video Preview in Grid Tile */}
                        <div className="my-2 aspect-video bg-black rounded-lg overflow-hidden border border-slate-800/80 relative shadow-inner">
                          <LiveVideoPlayer camera={cam} autoPlay showControls={false} />
                        </div>

                        {(activeInc || activeAlert) && (
                          <div className="mt-1.5 p-1.5 bg-rose-900/50 border border-rose-500/40 rounded-lg text-[10px] font-mono text-rose-200">
                            <div className="font-bold flex items-center justify-between">
                              <span>{activeInc?.title || activeAlert?.title || 'Target Detected'}</span>
                              <span className="text-rose-300 font-black">Score: {activeInc?.risk_score || activeAlert?.risk_score || 85}/100</span>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-mono mt-1.5 flex items-center justify-between">
                          <span>{cam.bop_site || 'BOP Alpha'}</span>
                          <span className="text-slate-500">{cam.sector || 'Sector Alpha'}</span>
                        </div>

                        {/* Lat / Long Coordinates */}
                        <div className="text-[9px] text-cyan-400 font-mono mt-1 flex items-center gap-1 font-semibold truncate">
                          <span>📍 GPS:</span>
                          <span>{cam.latitude ? cam.latitude.toFixed(4) : '31.6048'}° N, {cam.longitude ? cam.longitude.toFixed(4) : '74.5731'}° E</span>
                        </div>
                      </div>

                      {/* Action Button: Locate on Map */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCam(cam);
                          setMapCenter([cam.latitude || 31.6048, cam.longitude || 74.5731]);
                          setMapZoom(16);
                          setViewMode('map');
                        }}
                        className="mt-2.5 w-full py-1.5 px-2 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                      >
                        <MapPin className="w-3 h-3 text-cyan-200" />
                        <span>LOCATE ON GIS MAP</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Selected Camera Stream Preview Strip */}
        {selectedCam && (
          <div className="p-3 bg-[#0f172a] border border-cyan-500/40 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-28 h-18 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800">
                <LiveVideoPlayer camera={selectedCam} autoPlay showControls={false} />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{selectedCam.camera_name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                    {selectedCam.camera_id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Sector: {selectedCam.sector || 'National Border'} // BOP: {selectedCam.bop_site || 'N/A'} // GPS: {selectedCam.latitude?.toFixed(4) || '31.6048'}° N, {selectedCam.longitude?.toFixed(4) || '74.5731'}° E
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onInspectCamera && (
                <button
                  onClick={() => {
                    onInspectCamera(selectedCam);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect Camera
                </button>
              )}
              <button
                onClick={() => setSelectedCam(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Dismiss Preview
              </button>
            </div>
          </div>
        )}

        {/* Map Footer Bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0d131f] px-4 py-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Zero-Line GIS Grid: SYNCHRONIZED
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400">Total BOPs: {bops.length}</span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-400">Sensors Deployed: {cameras.length}</span>
            <span className="text-slate-600">|</span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Active Alarms: {liveAlerts.filter(a => a.status !== 'RESOLVED').length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition shadow-md cursor-pointer"
          >
            Close GIS Map
          </button>
        </div>
      </div>
    </Modal>
  );
};
