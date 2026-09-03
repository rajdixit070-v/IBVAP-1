import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useCameras } from '../../context/CameraContext';
import { Camera } from '../../types/camera';
import { Incident } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import {
  Layers,
  Eye,
  Crosshair,
  Laptop,
  Plane,
  Smartphone,
  Map as MapIcon,
  LayoutGrid
} from 'lucide-react';


interface SituationalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents?: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onInspectCamera?: (cam: Camera) => void;
}

export const SituationalMapModal: React.FC<SituationalMapModalProps> = ({
  isOpen,
  onClose,
  incidents = [],
  onSelectIncident,
  onInspectCamera
}) => {
  const { cameras } = useCameras();
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>(incidents);
  const [selectedCam, setSelectedCam] = useState<Camera | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INCIDENT' | 'ONLINE'>('ALL');
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');

  useEffect(() => {
    if (isOpen) {
      loadLiveIncidents();
      const interval = setInterval(loadLiveIncidents, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadLiveIncidents = async () => {
    try {
      const data = await incidentService.getIncidents({ limit: 40 });
      setLiveIncidents(data);
    } catch (e) {
      console.error('Failed to load map incidents', e);
    }
  };

  const filteredCameras = cameras.filter((cam) => {
    const hasInc = liveIncidents.some((i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'RESOLVED');
    if (activeFilter === 'INCIDENT') return hasInc;
    if (activeFilter === 'ONLINE') return cam.status === 'ONLINE' || cam.status === 'HEALTHY';
    return true;
  });

  // Calculate geospatial coordinate bounds for projection
  const validCams = filteredCameras.filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number');
  const minLat = validCams.length > 0 ? Math.min(...validCams.map(c => c.latitude!)) - 0.006 : 32.72;
  const maxLat = validCams.length > 0 ? Math.max(...validCams.map(c => c.latitude!)) + 0.006 : 32.74;
  const minLon = validCams.length > 0 ? Math.min(...validCams.map(c => c.longitude!)) - 0.008 : 74.84;
  const maxLon = validCams.length > 0 ? Math.max(...validCams.map(c => c.longitude!)) + 0.008 : 74.87;
  const latSpan = maxLat - minLat || 0.02;
  const lonSpan = maxLon - minLon || 0.03;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tactical Border Situational Awareness GIS Map"
      subtitle="Interactive Geospatial distribution of Border Outposts (BOPs), Multi-sensor Video Nodes, and Live Tactical Incidents"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Map Header & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d131f] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-white">NORTH SECTOR TACTICAL CORRIDOR</span>
            <span className="text-slate-500">//</span>
            <span className="text-emerald-400">32.7241° N, 74.8512° E</span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  viewMode === 'map' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Radar Map
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Nodes Grid
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
                  All ({cameras.length})
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

        {/* Main Display: Radar Map View OR Grid View */}
        {viewMode === 'map' ? (
          <div className="relative w-full h-[420px] bg-[#060a12] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl p-4">
            {/* Grid Lines & Concentric Radar Rings */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 via-transparent to-rose-500/5 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-sky-500/10 rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-sky-500/15 rounded-full pointer-events-none flex items-center justify-center">
              <div className="w-24 h-24 border border-sky-500/20 rounded-full" />
            </div>

            {/* Zero-Line Perimeter Border Ribbon */}
            <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-rose-500/40 -translate-y-1/2 flex items-center justify-between px-4 text-[9px] font-mono text-rose-400/80 pointer-events-none z-0">
              <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-rose-500/30">ZERO-LINE BORDER PERIMETER</span>
              <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-rose-500/30">SECTOR ALPHA PATROL CORRIDOR</span>
            </div>

            {/* Camera Pins Plotted at GPS Coordinates */}
            {filteredCameras.map((cam, idx) => {
              const activeInc = liveIncidents.find(
                (i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'RESOLVED' && i.status !== 'FALSE_ALARM'
              );
              const isSelected = selectedCam?.camera_id === cam.camera_id;
              const isOnline = cam.status === 'ONLINE' || cam.status === 'HEALTHY';

              // Project coordinates or fall back to distributed positions
              let posX = 50;
              let posY = 50;
              if (cam.latitude && cam.longitude) {
                posX = Math.max(10, Math.min(90, ((cam.longitude - minLon) / lonSpan) * 100));
                posY = Math.max(12, Math.min(88, 100 - ((cam.latitude - minLat) / latSpan) * 100));
              } else {
                const spreadPositions = [
                  [20, 30], [35, 65], [50, 25], [65, 70], [80, 35], [25, 75], [75, 60]
                ];
                const p = spreadPositions[idx % spreadPositions.length];
                posX = p[0];
                posY = p[1];
              }

              return (
                <div
                  key={cam.camera_id}
                  onClick={() => setSelectedCam(cam)}
                  style={{ left: `${posX}%`, top: `${posY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {/* FOV Wedge cone */}
                  <div
                    className={`w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[60px] pointer-events-none absolute -top-12 -left-3.5 transform origin-bottom transition-opacity ${
                      activeInc
                        ? 'border-b-rose-500/25 rotate-12 opacity-80'
                        : isOnline
                        ? 'border-b-cyan-500/20 rotate-45 opacity-60 group-hover:opacity-100'
                        : 'border-b-slate-700/20 opacity-30'
                    }`}
                  />

                  {/* Threat Ping Halos */}
                  {activeInc && (
                    <div className="w-12 h-12 rounded-full bg-rose-500/30 blur-sm animate-ping absolute -inset-3 pointer-events-none" />
                  )}

                  {/* Main Pin Icon */}
                  <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shadow-lg ${
                      isSelected
                        ? 'bg-sky-400 border-white text-slate-950 scale-125 ring-4 ring-sky-400/40'
                        : activeInc
                        ? 'bg-rose-600 border-rose-300 text-white animate-pulse ring-4 ring-rose-500/40'
                        : isOnline
                        ? 'bg-cyan-600 border-cyan-400 text-white hover:scale-115'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                    <span
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black ${
                        isOnline ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  {/* Tooltip Badge */}
                  <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-slate-700 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap opacity-90 group-hover:opacity-100 transition shadow-xl pointer-events-none flex flex-col items-center">
                    <span className="font-bold text-white flex items-center gap-1">
                      {cam.camera_id}
                      {activeInc && <span className="text-rose-400 font-black">🚨 ALERT</span>}
                    </span>
                    <span className="text-[9px] text-slate-400">{cam.camera_name}</span>
                  </div>
                </div>
              );
            })}

            {/* Bottom HUD Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-mono text-slate-300 flex items-center gap-4 z-10">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE NODES
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                ACTIVE THREATS ({liveIncidents.length})
              </span>
              <span className="text-slate-500">PROJECTION: WGS-84 / EPSG:4326</span>
            </div>
          </div>
        ) : (
          /* Main Interactive Tactical Grid Display */
          <div className="relative w-full min-h-[380px] bg-[#070b12] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col justify-between">

          {/* Radar Background Lines & Crosshair */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 via-transparent to-rose-500/5 pointer-events-none"></div>
          
          {/* Center Coordinates Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-sky-500/10 rounded-full pointer-events-none flex items-center justify-center">
            <div className="w-32 h-32 border border-sky-500/20 rounded-full"></div>
          </div>

          {/* Camera & Sensor Nodes Map */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 my-2">
            {filteredCameras.map((cam: Camera) => {
              const activeInc = liveIncidents.find(
                (i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'RESOLVED' && i.status !== 'FALSE_ALARM'
              );
              const isSelected = selectedCam?.camera_id === cam.camera_id;

              const url = cam.rtsp_url || '';
              const st = cam.stream_type || '';
              let MarkerIcon = Crosshair;
              let markerColor = activeInc ? 'text-rose-400 animate-spin' : 'text-sky-400';
              if (st === 'drone' || url.startsWith('udp://') || url.startsWith('rtmp://')) {
                MarkerIcon = Plane;
                if (!activeInc) markerColor = 'text-purple-400';
              } else if (st === 'webcam' || url.startsWith('webcam://')) {
                MarkerIcon = Laptop;
                if (!activeInc) markerColor = 'text-cyan-400';
              } else if (st === 'android' || url.includes(':8080') || url.includes(':4747')) {
                MarkerIcon = Smartphone;
                if (!activeInc) markerColor = 'text-emerald-400';
              }

              return (
                <div
                  key={cam.camera_id}
                  onClick={() => setSelectedCam(cam)}
                  className={`p-3 rounded-xl border transition cursor-pointer relative group ${
                    isSelected
                      ? 'bg-sky-950/60 border-sky-400 shadow-xl shadow-sky-500/20'
                      : activeInc
                      ? 'bg-rose-950/70 border-rose-500 shadow-xl shadow-rose-500/30 ring-1 ring-rose-500'
                      : 'bg-[#0f172a]/80 border-slate-800 hover:border-slate-700 hover:bg-[#131d35]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <MarkerIcon className={`w-3.5 h-3.5 ${markerColor}`} />
                      <span className="text-[11px] font-mono font-bold text-slate-200">{cam.camera_id}</span>
                    </div>

                    {activeInc ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(activeInc);
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
                  
                  {activeInc && (
                    <div className="mt-1.5 p-1.5 bg-rose-900/50 border border-rose-500/40 rounded-lg text-[10px] font-mono text-rose-200">
                      <div className="font-bold flex items-center justify-between">
                        <span>{activeInc.title || 'Target Detected'}</span>
                        <span className="text-rose-300 font-black">Score: {activeInc.risk_score}/100</span>
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
                    <span>{cam.latitude ? cam.latitude.toFixed(4) : '32.7241'}° N, {cam.longitude ? cam.longitude.toFixed(4) : '74.8512'}° E</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


        {/* Selected Camera Stream Preview Strip */}
        {selectedCam && (
          <div className="p-3 bg-[#0f172a] border border-sky-500/40 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-28 h-18 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800">
                <LiveVideoPlayer camera={selectedCam} autoPlay showControls={false} />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{selectedCam.camera_name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded border border-sky-500/30">
                    {selectedCam.camera_id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Sector: {selectedCam.sector || 'North Boundary'} // RTSP: {selectedCam.rtsp_url ? 'CONFIGURED' : 'SYNTHETIC'}
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
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect Camera
                </button>
              )}
              <button
                onClick={() => setSelectedCam(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Dismiss Preview
              </button>
            </div>
          </div>
        )}

        {/* Map Footer Bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0d131f] px-4 py-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Border Zero-Line Fencing: ACTIVE
            </span>
            <span className="text-slate-600">|</span>
            <span>Terrain: Riverbed & Mountain Corridor</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sky-400 font-bold">Total Nodes: {cameras.length}</span>
            <span className="text-rose-400 font-bold">Active Incidents: {liveIncidents.length}</span>
          </div>
        </div>


        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition shadow-md"
          >
            Close Tactical Map
          </button>
        </div>
      </div>
    </Modal>
  );
};
