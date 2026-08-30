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
  Smartphone
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

  useEffect(() => {
    if (isOpen) {
      loadLiveIncidents();
    }
  }, [isOpen]);

  const loadLiveIncidents = async () => {
    try {
      const data = await incidentService.getIncidents({ limit: 30 });
      setLiveIncidents(data);
    } catch (e) {
      console.error('Failed to load map incidents', e);
    }
  };

  const filteredCameras = cameras.filter((cam) => {
    const hasInc = liveIncidents.some((i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED');
    if (activeFilter === 'INCIDENT') return hasInc;
    if (activeFilter === 'ONLINE') return cam.status === 'ONLINE' || cam.status === 'HEALTHY';
    return true;
  });

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

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Filter:</span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  activeFilter === 'ALL' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({cameras.length})
              </button>
              <button
                onClick={() => setActiveFilter('INCIDENT')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  activeFilter === 'INCIDENT' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Active Threats
              </button>
              <button
                onClick={() => setActiveFilter('ONLINE')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  activeFilter === 'ONLINE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Online
              </button>
            </div>
          </div>
        </div>

        {/* Main Interactive Tactical Grid Display */}
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
                (i) => i.camera_id === cam.camera_id && i.status !== 'CLOSED' && i.status !== 'FALSE_ALARM'
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
                      ? 'bg-rose-950/50 border-rose-500 shadow-lg shadow-rose-500/20 animate-pulse'
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
                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold font-mono tracking-wider shadow"
                      >
                        THREAT
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
                  <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                    <span>{cam.bop_site || 'BOP Alpha'}</span>
                    <span className="text-slate-500">{cam.fps || 25} FPS</span>
                  </div>

                  {/* Lat / Long Coordinates */}
                  <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">
                    LOC: {cam.latitude ? cam.latitude.toFixed(4) : '32.7241'}° N, {cam.longitude ? cam.longitude.toFixed(4) : '74.8512'}° E
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Camera Stream Preview Strip */}
          {selectedCam && (
            <div className="relative z-10 mt-3 p-3 bg-[#0f172a] border border-sky-500/40 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
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
          <div className="relative z-10 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0f172a]/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-800 mt-2">
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
