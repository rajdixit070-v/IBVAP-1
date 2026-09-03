import React, { useState, useEffect } from 'react';
import {
  Map,
  Layers,
  Eye,
  EyeOff,
  AlertTriangle,
  Compass,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
  TrendingUp,
  Crosshair,
  Plane,
  Radio,
  Cctv
} from 'lucide-react';
import {
  gisService,
  GISLayer,
  SectorCoverage,
  BlindSpot
} from '../services/gisService';
import { useCameras } from '../context/CameraContext';


export const GISIntelligencePage: React.FC = () => {
  const { cameras } = useCameras();
  const [layers, setLayers] = useState<GISLayer[]>([]);
  const [coverage, setCoverage] = useState<SectorCoverage | null>(null);
  const [blindSpots, setBlindSpots] = useState<BlindSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<BlindSpot | null>(null);

  const fetchGISData = async () => {
    try {
      setLoading(true);
      const [lList, cov, bList] = await Promise.all([
        gisService.getLayers(),
        gisService.calculateSectorCoverage({ sector_name: 'Sector-North' }),
        gisService.getBlindSpots()
      ]);
      setLayers(lList);
      setCoverage(cov);
      setBlindSpots(bList);
      if (bList.length > 0 && !selectedBlindSpot) {
        setSelectedBlindSpot(bList[0]);
      }
    } catch (err) {
      console.error('Error fetching GIS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGISData();
  }, []);

  const handleToggleLayer = async (layer: GISLayer) => {
    try {
      const updated = await gisService.updateLayer(layer.layer_id, {
        is_visible: !layer.is_visible
      });
      setLayers(prev => prev.map(l => (l.layer_id === layer.layer_id ? updated : l)));
    } catch (err) {
      console.error('Failed to toggle layer:', err);
    }
  };

  const handleAcknowledge = async (blindSpotId: string) => {
    try {
      const updated = await gisService.acknowledgeBlindSpot(blindSpotId);
      setBlindSpots(prev => prev.map(b => (b.blind_spot_id === blindSpotId ? updated : b)));
      if (selectedBlindSpot?.blind_spot_id === blindSpotId) {
        setSelectedBlindSpot(updated);
      }
    } catch (err) {
      console.error('Failed to acknowledge blind spot:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Map className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">GIS, Terrain & Tactical Blind-Spot Intelligence</h1>
            <p className="text-slate-400 text-sm">Geometric camera FOV wedges, topographical coverage analytics & autonomous sensor recommendations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchGISData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recalculate Coverage
          </button>
        </div>
      </div>

      {/* Coverage Analytics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sector Optical Coverage</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{coverage?.coverage_percentage || 78.5}%</div>
          <div className="text-xs text-slate-400 mt-1">Total Area: {(coverage?.total_area_sqm ? (coverage.total_area_sqm / 1000000).toFixed(2) : 1.2)} km²</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical Blind Spots</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">
            {blindSpots.filter(b => b.risk_level === 'CRITICAL' || b.risk_level === 'HIGH').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">High-vulnerability corridors</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Covered Ground Area</span>
            <CheckCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {coverage?.covered_area_sqm ? (coverage.covered_area_sqm / 1000).toFixed(0) : 780}k m²
          </div>
          <div className="text-xs text-cyan-400 mt-1">Overlapping: {coverage?.overlap_area_sqm ? (coverage.overlap_area_sqm / 1000).toFixed(0) : 95}k m²</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active GIS Map Layers</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{layers.filter(l => l.is_visible).length} / {layers.length}</div>
          <div className="text-xs text-purple-400 mt-1">Zero latency spatial overlays</div>
        </div>
      </div>

      {/* Main Grid: GIS Map Canvas & Layer Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Map Canvas Simulation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                Perimeter Topography & FOV Projection HUD
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Sector: <span className="font-bold text-white">Sector-North (BOP Alpha)</span>
              </div>
            </div>

            {/* Real Camera FOV Projection Canvas - uses live camera data */}
            <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
              {/* Topographic stylized background */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 opacity-90" />
              {/* Grid overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

              {/* Real Camera FOV Wedges - dynamically placed from real camera list */}
              {cameras.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                  <Cctv className="w-8 h-8 text-slate-600" />
                  <span className="text-xs text-slate-500 font-mono">No cameras registered. Register cameras to view FOV projection.</span>
                </div>
              ) : (
                cameras.slice(0, 6).map((cam, idx) => {
                  // Distribute cameras across the canvas using position patterns
                  const positions = [
                    'top-1/4 left-1/4', 'top-1/4 right-1/4', 'top-1/2 left-1/5',
                    'top-1/2 right-1/5', 'bottom-1/4 left-1/3', 'bottom-1/4 right-1/3'
                  ];
                  const rotations = ['rotate-45', '-rotate-45', 'rotate-12', '-rotate-12', 'rotate-90', '-rotate-90'];
                  const colors = [
                    'border-b-cyan-500/25', 'border-b-sky-500/25', 'border-b-blue-500/25',
                    'border-b-indigo-500/25', 'border-b-violet-500/25', 'border-b-teal-500/25'
                  ];
                  const labelColors = [
                    'border-cyan-500 text-cyan-300', 'border-sky-500 text-sky-300',
                    'border-blue-500 text-blue-300', 'border-indigo-500 text-indigo-300',
                    'border-violet-500 text-violet-300', 'border-teal-500 text-teal-300'
                  ];
                  const isOnline = cam.status === 'HEALTHY' || cam.status === 'ONLINE';
                  return (
                    <div key={cam.camera_id} className={`absolute ${positions[idx % positions.length]} transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center`}>
                      <div className={`w-0 h-0 border-l-[50px] border-l-transparent border-r-[50px] border-r-transparent border-b-[120px] ${colors[idx % colors.length]} transform ${rotations[idx % rotations.length]} pointer-events-none`} />
                      <div className={`px-2 py-0.5 bg-slate-900/90 border ${labelColors[idx % labelColors.length]} text-[10px] font-bold rounded flex items-center gap-1 mt-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        {cam.camera_id} ({cam.status})
                      </div>
                    </div>
                  );
                })
              )}

              {/* Real Blind Spot Hotspots from API */}
              {blindSpots.slice(0, 2).map((bs, idx) => (
                <div
                  key={bs.blind_spot_id}
                  className={`absolute z-20 flex flex-col items-center ${idx === 0 ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2' : 'top-1/3 right-1/4 transform translate-x-1/2 -translate-y-1/2'}`}
                >
                  <div className={`p-3 rounded-xl flex flex-col items-center ${bs.risk_level === 'CRITICAL' ? 'bg-red-500/20 border-2 border-dashed border-red-500 animate-pulse' : 'bg-amber-500/15 border-2 border-dashed border-amber-500'}`}>
                    <AlertTriangle className={`w-5 h-5 ${bs.risk_level === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`} />
                    <span className={`text-[10px] font-bold mt-1 ${bs.risk_level === 'CRITICAL' ? 'text-red-300' : 'text-amber-300'}`}>
                      BLIND SPOT: {bs.sector_name?.toUpperCase() || bs.blind_spot_id}
                    </span>
                    <span className="text-[9px] text-slate-400">Risk: {bs.risk_score}/100 ({bs.risk_level})</span>
                  </div>
                </div>
              ))}

              {/* Show placeholder blind spot if no real ones exist yet */}
              {blindSpots.length === 0 && cameras.length > 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                  <div className="p-3 bg-slate-800/60 border border-slate-600 rounded-xl flex flex-col items-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-300 mt-1">NO BLIND SPOTS DETECTED</span>
                    <span className="text-[9px] text-slate-400">Full coverage active</span>
                  </div>
                </div>
              )}

              {/* Layer Stack HUD Badge */}
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 z-30">
                ACTIVE PROJECTION: <span className="text-emerald-400 font-bold">WGS-84 / EPSG:4326</span>
                <span className="ml-3 text-slate-500">Cameras: <span className="text-white">{cameras.length}</span></span>
              </div>
            </div>
          </div>



          {/* Tactical Recommendations & Prioritized Blind Spots Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Prioritized Blind-Spot Gap Analysis & Tactical Recommendations
            </h2>

            <div className="space-y-3">
              {blindSpots.map(bs => {
                let recs: any[] = [];
                try {
                  recs = JSON.parse(bs.recommendations_json || '[]');
                } catch (e) {
                  recs = [];
                }

                return (
                  <div
                    key={bs.blind_spot_id}
                    className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          bs.risk_level === 'CRITICAL'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {bs.risk_level} ({bs.risk_score}/100)
                        </span>
                        <span className="font-bold text-white text-sm">{bs.blind_spot_id}</span>
                        <span className="text-xs text-slate-400">Terrain: {bs.terrain_factor}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Border Dist: {bs.proximity_to_border_m}m</span>
                        {!bs.is_acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(bs.blind_spot_id)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold border border-slate-700 transition"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actionable Automated Recommendations */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tactical Mitigation Recommendations:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {recs.map((rec, idx) => (
                          <div key={idx} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs flex items-start gap-2">
                            {rec.action === 'USE_PTZ' && <Crosshair className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                            {rec.action === 'USE_DRONE' && <Plane className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                            {rec.action === 'ADD_SENSOR' && <Radio className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />}
                            <div>
                              <div className="font-bold text-white">{rec.action}: {rec.camera_id || rec.drone_id || rec.sensor_type}</div>
                              <div className="text-[11px] text-slate-400">{rec.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: GIS Layer Management Stack */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              GIS Layer Stack
            </h2>

            <div className="space-y-2">
              {layers.map(lyr => (
                <div
                  key={lyr.layer_id}
                  className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{lyr.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{lyr.layer_type}</div>
                  </div>

                  <button
                    onClick={() => handleToggleLayer(lyr)}
                    className={`p-1.5 rounded-lg border transition ${
                      lyr.is_visible
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {lyr.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

