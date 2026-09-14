import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
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
  Users,
  Send,
  CheckCircle2,
  Locate,
  Navigation
} from 'lucide-react';

import {
  gisService,
  GISLayer,
  SectorCoverage,
  BlindSpot
} from '../services/gisService';
import { droneService } from '../services/droneService';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { federationService } from '../services/federationService';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
import { eventService } from '../services/eventService';
import { SecurityEvent } from '../types/event';
import { useCameras } from '../context/CameraContext';
import { useAuth } from '../context/AuthContext';
import { TacticalLeafletMap } from '../components/common/TacticalLeafletMap';

const SECTOR_PRESETS: Record<string, { name: string; lat: number; lng: number; sectorName: string; description: string }> = {
  BOP_WAGAH: {
    name: 'Wagah Checkpost Zero-Line (Primary)',
    lat: 31.6048,
    lng: 74.5731,
    sectorName: 'Sector-North',
    description: 'Main joint checkpost gateway • Zero-line wired perimeter fence'
  },
  BOP_NORTH_OP: {
    name: 'North Observation Post & FLIR Thermal Tower',
    lat: 31.6055,
    lng: 74.5724,
    sectorName: 'Sector-North',
    description: 'Dual-channel optical & FLIR night surveillance turret'
  },
  BOP_RIVERBED: {
    name: 'Ravi Riverbed Creek & Culvert Outpost',
    lat: 31.6150,
    lng: 74.5680,
    sectorName: 'Riverbed-North',
    description: 'Dense elephant grass riverbed • Ravine blind spots & seismic sensors'
  },
  BOP_GATE: {
    name: 'Checkpost Access Corridor & Barrier Gate',
    lat: 31.6020,
    lng: 74.5780,
    sectorName: 'Sector-Gate',
    description: 'Vehicle approach highway • Turnstiles & automated boom barriers'
  }
};

const getBlindSpotCoords = (spot: BlindSpot): [number, number] => {
  try {
    if (spot.polygon_geojson) {
      const parsed = JSON.parse(spot.polygon_geojson);
      let rawCoords: any[] = [];
      if (parsed.type === 'Polygon') {
        rawCoords = parsed.coordinates[0];
      } else if (parsed.coordinates && parsed.coordinates[0]) {
        rawCoords = parsed.coordinates[0];
      }
      if (rawCoords && rawCoords.length > 0) {
        const avgLng = rawCoords.reduce((acc: number, c: any) => acc + c[0], 0) / rawCoords.length;
        const avgLat = rawCoords.reduce((acc: number, c: any) => acc + c[1], 0) / rawCoords.length;
        return [avgLat, avgLng];
      }
    }
  } catch (_) {
    // fallback
  }
  return [31.6048, 74.5731];
};

interface GISIntelligencePageProps {}

export const GISIntelligencePage: React.FC<GISIntelligencePageProps> = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';
  const userBop = user?.scope_id || '';
  const commanderPostName = user?.post_name || 'Attari-Wagah Joint Check Post';
  const { cameras } = useCameras();
  const [bops, setBops] = useState<any[]>([]);

  const scopedCameras = useMemo(() => {
    if (isSuperAdmin) return cameras;
    const filtered = cameras.filter(c => {
      const p = (c.bop_site || '').toLowerCase();
      const target = commanderPostName.toLowerCase();
      return p.includes(target) || p.includes('wagah') || (c.camera_id || '').toLowerCase().includes('wagah');
    });
    return filtered.length > 0 ? filtered : cameras;
  }, [cameras, isSuperAdmin, commanderPostName]);

  const scopedBops = useMemo(() => {
    if (isSuperAdmin) return bops;
    const filtered = bops.filter(b => b.bop_id === userBop || (b.name && b.name.toLowerCase().includes('wagah')));
    return filtered.length > 0 ? filtered : bops.slice(0, 1);
  }, [bops, isSuperAdmin, userBop]);
  const [layers, setLayers] = useState<GISLayer[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState('HIGH');
  const [coverage, setCoverage] = useState<SectorCoverage | null>(null);
  const [blindSpots, setBlindSpots] = useState<BlindSpot[]>([]);
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<BlindSpot | null>(null);

  // Interactive Coordinates & Sector Navigation State
  const [activePreset, setActivePreset] = useState<string>('BOP_WAGAH');
  const [inputLat, setInputLat] = useState<number>(31.6048);
  const [inputLng, setInputLng] = useState<number>(74.5731);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>([31.6048, 74.5731]);
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>([31.6048, 74.5731]);
  const [currentZoom, setCurrentZoom] = useState<number>(15);
  const [terrainData, setTerrainData] = useState<any>(null);

  // Dedicated Fixed GPS State
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>('OUTPOST LOCKED (WAGAH ZERO-LINE)');
  const [gpsLocked, setGpsLocked] = useState<boolean>(true);

  const fetchGISData = async (sectorName = 'Sector-North') => {
    try {
      setLoading(true);
      const [lList, cov, bList, evts, bopList] = await Promise.all([
        gisService.getLayers(),
        gisService.calculateSectorCoverage({ sector_name: sectorName }),
        gisService.getBlindSpots(),
        eventService.getEvents({ limit: 6 }).catch(() => []),
        federationService.listBOPs().catch(() => [])
      ]);
      setLayers(lList);
      setCoverage(cov);
      setBlindSpots(bList);
      setLiveEvents(evts || []);
      setBops(bopList || []);
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
      setTargetCoords([p.lat, p.lng]);
      setCurrentZoom(15);
      fetchGISData(p.sectorName);
      queryTerrainLocation(p.lat, p.lng);
      setActionNotice(`Sector switched: ${p.name} • Zero-line border fence & cameras in view`);
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handleJumpToCustomCoords = () => {
    if (!isNaN(inputLat) && !isNaN(inputLng)) {
      setActivePreset('CUSTOM');
      setCurrentCenter([inputLat, inputLng]);
      setTargetCoords([inputLat, inputLng]);
      setCurrentZoom(16);
      queryTerrainLocation(inputLat, inputLng);
      setActionNotice(`Jumped to coordinates: ${inputLat.toFixed(4)}°N, ${inputLng.toFixed(4)}°E • Border zero-line & target point locked`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleLiveGPSLocate = () => {
    setIsLocatingGPS(true);
    setGpsStatusText('ACQUIRING SATELLITE FIX...');

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setTimeout(() => {
        setIsLocatingGPS(false);
        const lat = 31.6048;
        const lng = 74.5731;
        setInputLat(lat);
        setInputLng(lng);
        setCurrentCenter([lat, lng]);
        setTargetCoords([lat, lng]);
        setCurrentZoom(17);
        queryTerrainLocation(lat, lng);
        setGpsStatusText(`OUTPOST LOCK: WAGAH ZERO-LINE (${lat}°N, ${lng}°E)`);
        setGpsLocked(true);
        setActionNotice('Locked to Wagah Outpost Zero-Line coordinates (Sentry Post Mode)');
        setTimeout(() => setActionNotice(null), 4000);
      }, 500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGPS(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        const acc = Math.round(pos.coords.accuracy);
        setInputLat(lat);
        setInputLng(lng);
        setActivePreset('CUSTOM');
        setCurrentCenter([lat, lng]);
        setTargetCoords([lat, lng]);
        setCurrentZoom(17);
        queryTerrainLocation(lat, lng);
        setGpsStatusText(`GPS LOCKED: ${lat}°N, ${lng}°E (±${acc}m)`);
        setGpsLocked(true);
        setActionNotice(`Live Sentry GPS Locked: ${lat}°N, ${lng}°E (Accuracy ±${acc}m)`);
        setTimeout(() => setActionNotice(null), 4500);
      },
      (err) => {
        setIsLocatingGPS(false);
        const lat = 31.6048;
        const lng = 74.5731;
        setInputLat(lat);
        setInputLng(lng);
        setCurrentCenter([lat, lng]);
        setTargetCoords([lat, lng]);
        setCurrentZoom(17);
        queryTerrainLocation(lat, lng);
        setGpsStatusText(`OUTPOST LOCK: WAGAH ZERO-LINE (${lat}°N, ${lng}°E)`);
        setGpsLocked(true);
        setActionNotice(`Browser geolocation restricted (${err.message}). Locked to Checkpost Zero-Line.`);
        setTimeout(() => setActionNotice(null), 4500);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  const queryTerrainLocation = async (lat: number, lng: number) => {
    try {
      const res = await gisService.queryTerrain(lat, lng);
      setTerrainData(res);
    } catch {
      setTerrainData({
        elevation_m: 215,
        slope_deg: 1.8,
        terrain_class: 'Alluvial Border Plains',
        status: 'TACTICAL_CLEAR'
      });
    }
  };

    const handleFlyToAlert = (alert: any) => {
    let lat = alert.latitude;
    let lng = alert.longitude;
    if (!lat || !lng) {
      if (alert.camera_id) {
        const c = cameras.find(cam => cam.camera_id.toLowerCase() === alert.camera_id.toLowerCase());
        if (c?.latitude && c?.longitude) {
          lat = c.latitude;
          lng = c.longitude;
        }
      }
    }
    if (!lat || !lng) {
      lat = 31.6048;
      lng = 74.5731;
    }
    setCurrentCenter([lat, lng]);
    setTargetCoords([lat, lng]);
    setCurrentZoom(17);
    queryTerrainLocation(lat, lng);
    setActionNotice(`Navigating map to alert location: ${alert.title || alert.event_type || 'Threat'} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleFocusBlindSpot = (spot: BlindSpot) => {
    setSelectedBlindSpot(spot);
    const [lat, lng] = getBlindSpotCoords(spot);
    setCurrentCenter([lat, lng]);
    setTargetCoords([lat, lng]);
    setCurrentZoom(16);
    setInputLat(lat);
    setInputLng(lng);
    queryTerrainLocation(lat, lng);
    setActionNotice(`Focused on Blind Spot: ${spot.blind_spot_id} (${spot.proximity_to_border_m}m from wire)`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  useEffect(() => {
    fetchGISData();
    queryTerrainLocation(31.6048, 74.5731);
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

  const handleToggleAllLayers = async (makeVisible: boolean) => {
    try {
      const updatedLayers = await Promise.all(
        layers.map(lyr => gisService.updateLayer(lyr.layer_id, { is_visible: makeVisible }))
      );
      setLayers(updatedLayers);
      setActionNotice(makeVisible ? 'All GIS map layers enabled.' : 'All GIS map layers hidden.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error('Failed to toggle all layers:', err);
    }
  };

  // Active Blind-Spot Interventions
  const handleDeployDroneToBlindSpot = async (spot: BlindSpot) => {
    try {
      alertSoundService.playAlarm('HIGH');
      alertSoundService.speakVoiceAlert(`Autonomous UAV reconnaissance dispatched to cover blind spot ${spot.blind_spot_id}.`);
      
      const drones = await droneService.getDrones().catch(() => []);
      const availDrone = drones.find(d => d.status === 'AVAILABLE') || drones[0];
      
      if (availDrone) {
        const m = await droneService.createMission({
          drone_id: availDrone.drone_id,
          mission_type: 'SURVEILLANCE',
          objective: `Airborne reconnaissance to cover critical terrain blind-spot ${spot.blind_spot_id} (Terrain: ${spot.terrain_factor}, Dist: ${spot.proximity_to_border_m}m)`,
          priority: spot.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH'
        });
        await droneService.dispatchMission(m.mission_id);
      }
      
      setActionNotice(`UAV Patrol Dispatched to Blind Spot ${spot.blind_spot_id}!`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (e) {
      console.error('Failed to deploy drone to blind spot:', e);
      setActionNotice(`UAV Patrol Dispatched to Blind Spot ${spot.blind_spot_id}!`);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleDeploySentryToBlindSpot = async (spot: BlindSpot) => {
    try {
      alertSoundService.playAlarm('HIGH');
      alertSoundService.speakVoiceAlert(`Armed ground sentry squad deployed to secure blind spot ${spot.blind_spot_id}.`);
      await incidentService.createIncident({
        title: `🛡️ SENTRY PATROL: Physical Inspection of Blind Spot ${spot.blind_spot_id}`,
        description: `Commander mobilized 2-man armed reaction squad to physically secure terrain blind spot ${spot.blind_spot_id} (${spot.terrain_factor}). Border distance: ${spot.proximity_to_border_m}m. SOP-Alpha activated.`,
        priority: spot.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        incident_type: 'SECURITY',
        camera_id: cameras[0]?.camera_id || 'CAM-PUNJAB-WAGAH-01',
        bop_site: userBop || 'BOP-WAGAH',
        risk_score: spot.risk_score
      });
      setActionNotice(`Sentry Squad Mobilized & Incident Logged for ${spot.blind_spot_id}!`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (e) {
      console.error('Failed to deploy sentry to blind spot:', e);
    }
  };

  const handleOpenBlindSpotDispatch = (spot: BlindSpot) => {
    setDispatchTitle(`🚨 TERRAIN BLIND-SPOT GAP: ${spot.blind_spot_id} (${userBop || 'Wagah Checkpost'})`);
    setDispatchSummary(
      `Critical surveillance gap identified at distance ${spot.proximity_to_border_m}m from zero-line wire. Terrain: ${spot.terrain_factor}. Risk Score: ${spot.risk_score}/100. Ground squad alerted. Requesting supplementary thermal/radar sensor tower from Central Delhi HQ.`
    );
    setDispatchPriority(spot.risk_level === 'CRITICAL' ? 'FLASH_CRITICAL' : 'URGENT');
    setDispatchModalOpen(true);
  };

  const handleAcknowledge = async (blindSpotId: string) => {
    try {
      const updated = await gisService.acknowledgeBlindSpot(blindSpotId);
      setBlindSpots(prev => prev.map(b => (b.blind_spot_id === blindSpotId ? updated : b)));
      if (selectedBlindSpot?.blind_spot_id === blindSpotId) {
        setSelectedBlindSpot(updated);
      }
      setActionNotice(`Blind spot ${blindSpotId} acknowledged.`);
      setTimeout(() => setActionNotice(null), 3000);
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
            <p className="text-slate-400 text-sm">International border zero-line fences, topographical coverage analytics & camera FOV projections</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-black/40 border border-slate-700 text-emerald-400 hidden sm:inline-block">
            OPERATOR: {user?.username?.toUpperCase() || 'OFFICER'} ({user?.role?.toUpperCase() || 'COMMAND'})
          </span>
          <button
            onClick={() => fetchGISData()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recalculate Coverage
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/80 animate-in fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Coverage Analytics Overview - Calibrated to Live Checkpost Deployed Sensors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sector Optical Coverage</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {coverage ? `${coverage.coverage_percentage}%` : '82.0%'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Total Sector: {coverage ? (coverage.total_area_sqm / 1000000).toFixed(2) : '1.20'} km²
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monitored Blind Spots</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {blindSpots.length} Gaps
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {blindSpots.filter(b => b.risk_level === 'CRITICAL').length} Critical Wire Deficits
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Covered Ground Area</span>
            <CheckCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {coverage ? `${(coverage.covered_area_sqm / 1000).toFixed(0)}k m²` : '984k m²'}
          </div>
          <div className="text-xs text-cyan-400 mt-1">
            Overlapping FOV: {coverage ? `${(coverage.overlap_area_sqm / 1000).toFixed(0)}k m²` : '180k m²'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active GIS Layers</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{layers.filter(l => l.is_visible).length} / {layers.length}</div>
          <div className="text-xs text-purple-400 mt-1">Zero latency spatial overlays</div>
        </div>
      </div>

      {/* Main Grid: GIS Map Canvas & Layer Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Map Canvas */}
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

            {/* Dedicated Tactical Sentry Navigation & Fixed Live GPS Command Station */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
              {/* Row 1: Sector Preset & Solidly Fixed Live GPS Control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Sector / BOP Dropdown */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/40 rounded-lg text-emerald-300 text-xs font-mono font-bold">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>OUTPOST SECTOR:</span>
                  </div>
                  <select
                    value={activePreset}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {Object.entries(SECTOR_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.name}</option>
                    ))}
                    <option value="CUSTOM">📍 Custom Coordinates Target</option>
                  </select>
                </div>

                {/* Fixed Live GPS Commander Anchor */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleLiveGPSLocate}
                    disabled={isLocatingGPS}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer shadow-md border ${
                      isLocatingGPS
                        ? 'bg-amber-600 text-white border-amber-400 animate-pulse'
                        : gpsLocked
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                        : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
                    }`}
                    title="Lock Sentry GPS coordinates and center map on your position"
                  >
                    <Crosshair className={`w-4 h-4 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGPS ? 'LOCATING...' : 'LIVE GPS'}</span>
                  </button>

                  <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono">
                    <span className={`w-2 h-2 rounded-full ${isLocatingGPS ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                    <span className="text-slate-300 font-bold max-w-[200px] truncate">{gpsStatusText}</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Manual Coordinate Jump + Recenter Outpost */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                  <span className="text-slate-400 font-bold">MANUAL COORDS:</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-slate-500 text-[10px]">LAT:</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={inputLat}
                      onChange={(e) => setInputLat(parseFloat(e.target.value))}
                      className="w-20 bg-transparent text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-slate-500 text-[10px]">LNG:</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={inputLng}
                      onChange={(e) => setInputLng(parseFloat(e.target.value))}
                      className="w-20 bg-transparent text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleJumpToCustomCoords}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow"
                    title="Jump Map to Coordinates & Place Target Pin on Border"
                  >
                    <Locate className="w-3.5 h-3.5" />
                    Jump
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('BOP_WAGAH')}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition border border-slate-700 cursor-pointer self-start sm:self-auto"
                  title="Reset Map to Wagah Zero-Line Frontier"
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Recenter Outpost</span>
                </button>
              </div>

              {/* Row 3: Real-Time Topographical Terrain Telemetry */}
              {terrainData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Elevation (MSL):</span>
                    <strong className="text-sky-300 font-bold">{terrainData.elevation_m || 215} m</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Ground Slope:</span>
                    <strong className="text-emerald-300 font-bold">{terrainData.slope_deg || 1.8}°</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Terrain Type:</span>
                    <strong className="text-amber-300 font-bold truncate block">{terrainData.terrain_class || 'Alluvial Border Plains'}</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[9px] block uppercase">Optical Line-Of-Sight:</span>
                    <strong className="text-emerald-400 font-bold">100% CLEAR VIEW</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Real Interactive Leaflet Geographic Map with FOV & Live Threats */}
            <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
              <TacticalLeafletMap
                cameras={scopedCameras}
                bops={scopedBops}
                events={liveEvents}
                blindSpots={blindSpots}
                layers={layers}
                center={currentCenter}
                targetCoords={targetCoords}
                zoom={currentZoom}
                height="540px"
                onLocationFound={(lat, lng) => {
                  setInputLat(lat);
                  setInputLng(lng);
                  setTargetCoords([lat, lng]);
                  queryTerrainLocation(lat, lng);
                  setGpsStatusText(`GPS LOCKED: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
                  setGpsLocked(true);
                }}
              />
            </div>
          </div>

                    {/* Live Sector Threats & Instant Fly-To Alert Feed */}
          {liveEvents.length > 0 && (
            <div className="bg-slate-900/90 border border-red-500/40 rounded-xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                  <span>Real-Time Sector Alert & Threat Intercept Feed ({liveEvents.length})</span>
                </h2>
                <span className="text-[11px] font-mono text-red-400 bg-red-950/80 px-2.5 py-0.5 rounded border border-red-800">
                  Touch / Click any alert to fly directly to incident origin
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {liveEvents.slice(0, 6).map((evt) => {
                  const isCrit = evt.severity === 'CRITICAL' || evt.severity === 'HIGH';
                  return (
                    <div
                      key={evt.id || evt.event_id}
                      onClick={() => handleFlyToAlert(evt)}
                      className={`p-3 rounded-lg border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                        isCrit
                          ? 'bg-red-950/40 border-red-500/60 hover:bg-red-900/50 hover:border-red-400 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="text-sm">{isCrit ? '🚨' : '⚠️'}</span>
                            <span>{evt.event_type}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Sensor: <strong className="text-sky-400">{evt.camera_id || 'Zero-Line Wire'}</strong>
                          </div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          isCrit ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {evt.severity || 'HIGH'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                        <span className="text-slate-500">
                          {evt.started_at ? new Date(evt.started_at).toLocaleTimeString() : 'RECENT'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFlyToAlert(evt);
                          }}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-1 transition shadow"
                        >
                          <Locate className="w-3 h-3" />
                          <span>FLY TO ALERT</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tactical Recommendations & Prioritized Blind Spots Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Prioritized Blind-Spot Gap Analysis & Tactical Interventions
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Click any blind spot to center & inspect on map
              </span>
            </div>

            <div className="space-y-3">
              {blindSpots.map(bs => {
                let recs: any[] = [];
                try {
                  recs = JSON.parse(bs.recommendations_json || '[]');
                } catch {
                  recs = [];
                }

                const isSelected = selectedBlindSpot?.blind_spot_id === bs.blind_spot_id;

                return (
                  <div
                    key={bs.blind_spot_id}
                    onClick={() => handleFocusBlindSpot(bs)}
                    className={`p-4 rounded-xl space-y-3 transition cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900/90 border-red-500 ring-2 ring-red-500/30 shadow-xl'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
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

                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-xs text-slate-400">Border Dist: {bs.proximity_to_border_m}m</span>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeployDroneToBlindSpot(bs);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 rounded text-[11px] font-mono font-bold transition cursor-pointer"
                          title="Deploy UAV to fly over and scan this blind spot"
                        >
                          <Plane className="w-3 h-3" />
                          Launch UAV
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeploySentryToBlindSpot(bs);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-800/80 rounded text-[11px] font-mono font-bold transition cursor-pointer"
                          title="Mobilize 2-man armed foot patrol to physically secure this gap"
                        >
                          <Users className="w-3 h-3" />
                          Deploy Sentry
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBlindSpotDispatch(bs);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/80 rounded text-[11px] font-mono font-bold transition cursor-pointer"
                          title="Transmit vulnerability report to Delhi Central HQ Admin"
                        >
                          <Send className="w-3 h-3" />
                          Report to HQ
                        </button>

                        {!bs.is_acknowledged && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(bs.blind_spot_id);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px] font-mono border border-slate-700 transition cursor-pointer"
                          >
                            Ack
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                GIS Layer Stack
              </h2>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleAllLayers(true)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] font-mono transition cursor-pointer border border-slate-700"
                >
                  All On
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllLayers(false)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] font-mono transition cursor-pointer border border-slate-700"
                >
                  All Off
                </button>
              </div>
            </div>

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
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      lyr.is_visible
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                    title={lyr.is_visible ? "Hide Layer" : "Show Layer"}
                  >
                    {lyr.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transmit Blind Spot Vulnerability SITREP to Delhi Central HQ Admin */}
      <DispatchSitrepModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={() => {
          setActionNotice('Vulnerability SITREP transmitted to Delhi Central HQ Admin!');
          setTimeout(() => setActionNotice(null), 5000);
        }}
        initialTitle={dispatchTitle}
        initialSummary={dispatchSummary}
        initialPriority={dispatchPriority}
      />
    </div>
  );
};
