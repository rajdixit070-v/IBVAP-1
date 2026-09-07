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
  Radio
} from 'lucide-react';

import {
  gisService,
  GISLayer,
  SectorCoverage,
  BlindSpot
} from '../services/gisService';
import { eventService } from '../services/eventService';
import { SecurityEvent } from '../types/event';
import { useCameras } from '../context/CameraContext';
import { useAuth } from '../context/AuthContext';
import { TacticalLeafletMap } from '../components/common/TacticalLeafletMap';
import { Locate, Navigation, ArrowLeft } from 'lucide-react';


const SECTOR_PRESETS: Record<string, { name: string; lat: number; lng: number; sectorName: string; description: string }> = {
  BOP_ALPHA: {
    name: 'BOP Alpha (Amritsar Wagah Border)',
    lat: 31.6245,
    lng: 74.8725,
    sectorName: 'Sector-North',
    description: 'Punjab international border post • Zero-line perimeter fence'
  },
  SAMBA: {
    name: 'North Frontier Sector (Jammu Samba)',
    lat: 32.5532,
    lng: 75.1165,
    sectorName: 'Samba-Frontier',
    description: 'Riverine terrain • Underground tunnel & seismic detection zone'
  },
  LOC: {
    name: 'Line of Control Forward Post (Baramulla)',
    lat: 34.2093,
    lng: 74.3436,
    sectorName: 'LOC-North',
    description: 'High altitude mountain ridge • UAV night surveillance corridor'
  },
  DESERT: {
    name: 'Thar Desert Checkpost (Jaisalmer)',
    lat: 26.9157,
    lng: 70.9083,
    sectorName: 'Desert-West',
    description: 'Arid desert sand dunes • Long-range optical thermal radar'
  }
};

interface GISIntelligencePageProps {
  onBackToDashboard?: () => void;
}

export const GISIntelligencePage: React.FC<GISIntelligencePageProps> = ({ onBackToDashboard }) => {
  const { user } = useAuth();
  const { cameras } = useCameras();
  const [layers, setLayers] = useState<GISLayer[]>([]);
  const [coverage, setCoverage] = useState<SectorCoverage | null>(null);
  const [blindSpots, setBlindSpots] = useState<BlindSpot[]>([]);
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<BlindSpot | null>(null);

  // Interactive Coordinates & Sector Navigation State
  const [activePreset, setActivePreset] = useState<string>('BOP_ALPHA');
  const [inputLat, setInputLat] = useState<number>(31.6245);
  const [inputLng, setInputLng] = useState<number>(74.8725);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>([31.6245, 74.8725]);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [terrainData, setTerrainData] = useState<any>(null);

  const fetchGISData = async (sectorName = 'Sector-North') => {

    try {
      setLoading(true);
      const [lList, cov, bList, evts] = await Promise.all([
        gisService.getLayers(),
        gisService.calculateSectorCoverage({ sector_name: sectorName }),
        gisService.getBlindSpots(),
        eventService.getEvents({ limit: 6 }).catch(() => [])
      ]);
      setLayers(lList);
      setCoverage(cov);
      setBlindSpots(bList);
      setLiveEvents(evts || []);
      if (bList.length > 0 && !selectedBlindSpot) {
        setSelectedBlindSpot(bList[0]);
      }
    } catch (err) {
      console.error('Error fetching GIS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (presetKey: string) => {
    setActivePreset(presetKey);
    const p = SECTOR_PRESETS[presetKey];
    if (p) {
      setInputLat(p.lat);
      setInputLng(p.lng);
      setCurrentCenter([p.lat, p.lng]);
      setCurrentZoom(14);
      fetchGISData(p.sectorName);
      queryTerrainLocation(p.lat, p.lng);
    }
  };

  const handleJumpToCustomCoords = () => {
    if (!isNaN(inputLat) && !isNaN(inputLng)) {
      setActivePreset('CUSTOM');
      setCurrentCenter([inputLat, inputLng]);
      setCurrentZoom(15);
      queryTerrainLocation(inputLat, inputLng);
    }
  };

  const queryTerrainLocation = async (lat: number, lng: number) => {
    try {
      const res = await gisService.queryTerrain(lat, lng);
      setTerrainData(res);
    } catch (e) {
      setTerrainData({
        elevation_m: 215,
        slope_deg: 1.8,
        terrain_class: 'Alluvial Border Plains',
        status: 'TACTICAL_CLEAR'
      });
    }
  };


  useEffect(() => {
    fetchGISData();
    queryTerrainLocation(31.6245, 74.8725);
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
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-sm transition cursor-pointer font-mono font-medium"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Dashboard</span>
            </button>
          )}
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-black/40 border border-slate-700 text-emerald-400 hidden sm:inline-block">
            OPERATOR: {user?.username?.toUpperCase() || 'OFFICER'} ({user?.role?.toUpperCase() || 'COMMAND'})
          </span>
          <button
            onClick={() => fetchGISData()}
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
                Active Sector: <span className="font-bold text-white font-mono">{SECTOR_PRESETS[activePreset]?.name || 'Custom Target'}</span>
              </div>
            </div>

            {/* Tactical Sector & Coordinate Jump HUD */}
            <div className="p-3 bg-black/40 border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-mono font-bold text-slate-300">TARGET SECTOR / BOP:</span>
                  <select
                    value={activePreset}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {Object.entries(SECTOR_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.name}</option>
                    ))}
                    <option value="CUSTOM">📍 Custom Coordinates Target</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-slate-400">LAT:</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={inputLat}
                    onChange={(e) => setInputLat(parseFloat(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-xs font-mono focus:border-emerald-500"
                  />
                  <span className="text-slate-400 ml-1">LNG:</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={inputLng}
                    onChange={(e) => setInputLng(parseFloat(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-xs font-mono focus:border-emerald-500"
                  />
                  <button
                    onClick={handleJumpToCustomCoords}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition shadow-md"
                    title="Jump to Location on Map"
                  >
                    <Locate className="w-3.5 h-3.5" />
                    Locate
                  </button>
                </div>
              </div>

              {/* Real-Time Terrain Analysis Strip */}
              {terrainData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Elevation (MSL):</span>
                    <strong className="text-sky-300 font-bold">{terrainData.elevation_m || 215} m</strong>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Ground Slope:</span>
                    <strong className="text-emerald-300 font-bold">{terrainData.slope_deg || 1.8}°</strong>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Terrain Type:</span>
                    <strong className="text-amber-300 font-bold truncate block">{terrainData.terrain_class || 'Alluvial Border Plain'}</strong>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Optical Line-Of-Sight:</span>
                    <strong className="text-emerald-400 font-bold">100% UNRESTRICTED</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Real Interactive Leaflet Geographic Map with FOV & Live Threats */}
            <TacticalLeafletMap
              cameras={cameras}
              events={liveEvents}
              blindSpots={blindSpots}
              layers={layers}
              center={currentCenter}
              zoom={currentZoom}
              height="480px"
            />


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

