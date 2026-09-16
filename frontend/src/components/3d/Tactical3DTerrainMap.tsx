import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import {
  X,
  Cctv,
  RotateCw,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Plane,
  Eye
} from 'lucide-react';
import { Camera } from '../../types/camera';
import { SecurityEvent } from '../../types/event';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import { TACTICAL_BORDER_SEGMENTS } from '../common/TacticalLeafletMap';

export type TerrainMapStyle = 'satellite' | 'dark' | 'topo';

export interface Tactical3DTerrainMapProps {
  cameras: Camera[];
  bops?: any[];
  events?: SecurityEvent[];
  alerts?: any[];
  center?: [number, number];
  targetCoords?: [number, number] | null;
  zoom?: number;
  height?: string;
  selectedCameraId?: string;
  initialStyle?: TerrainMapStyle;
  autoFlythrough?: boolean;
  onCameraSelect?: (cam: Camera) => void;
  onInspectCamera?: (cam: Camera) => void;
  onClose3D?: () => void;
  onSwitchTo2D?: () => void;
}

// Global Terrarium DEM elevation tiles (AWS Open Data / Mapzen) - high resolution physical elevation
const DEM_TERRARIUM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// High-resolution Satellite imagery (ESRI World Imagery) - photorealistic global coverage
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// OpenTopoMap contours and shaded elevation
const TOPO_TILES = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

// CartoDB Dark Matter for Night Operations & Thermal Radar
const DARK_TILES = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';

/**
 * Builds a MapLibre GL style specification for 3D Terrain with physical elevation and imagery
 */
function buildMapStyle(styleType: TerrainMapStyle): maplibregl.StyleSpecification {
  const sources: Record<string, any> = {
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [DEM_TERRARIUM_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15
    }
  };

  const layers: any[] = [];

  if (styleType === 'satellite') {
    sources['base-imagery'] = {
      type: 'raster',
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri, DigitalGlobe, GeoEye'
    };
    layers.push({
      id: 'base-imagery-layer',
      type: 'raster',
      source: 'base-imagery',
      paint: { 'raster-opacity': 1.0 }
    });
  } else if (styleType === 'topo') {
    sources['base-topo'] = {
      type: 'raster',
      tiles: [TOPO_TILES],
      tileSize: 256,
      maxzoom: 17,
      attribution: '© OpenTopoMap, SRTM'
    };
    layers.push({
      id: 'base-topo-layer',
      type: 'raster',
      source: 'base-topo',
      paint: { 'raster-opacity': 1.0 }
    });
  } else {
    // dark
    sources['base-dark'] = {
      type: 'raster',
      tiles: [DARK_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© CARTO, OpenStreetMap'
    };
    layers.push({
      id: 'base-dark-layer',
      type: 'raster',
      source: 'base-dark',
      paint: { 'raster-opacity': 0.95 }
    });
  }

  // Add realistic 3D Mountain Hillshade for natural lighting & shadows
  layers.push({
    id: 'terrain-hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
      'hillshade-shadow-color': styleType === 'dark' ? '#000000' : '#0a101f',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': styleType === 'dark' ? '#06b6d4' : '#38bdf8',
      'hillshade-illumination-direction': 315,
      'hillshade-exaggeration': styleType === 'dark' ? 0.8 : 0.65
    }
  });

  return {
    version: 8,
    sources,
    layers,
    sky: {
      'sky-color': styleType === 'dark' ? '#020617' : '#0f172a',
      'sky-horizon-blend': 0.5,
      'horizon-color': styleType === 'dark' ? '#090d16' : '#1e293b',
      'horizon-fog-blend': 0.75,
      'fog-color': styleType === 'dark' ? '#050811' : '#0f172a',
      'fog-ground-blend': 0.65
    }
  };
}

/**
 * Computes a fan polygon representing camera surveillance field of view
 */
function generateFovPolygon(lat: number, lng: number, azimuthDeg = 45, fovDeg = 65, rangeMeters = 240) {
  const earthRadius = 6378137;
  const dLat = (rangeMeters / earthRadius) * (180 / Math.PI);
  const dLng = (rangeMeters / (earthRadius * Math.cos((Math.PI * lat) / 180))) * (180 / Math.PI);

  const coordinates: [number, number][] = [[lng, lat]];
  const halfFov = fovDeg / 2;
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const angle = azimuthDeg - halfFov + (fovDeg * i) / steps;
    const rad = (angle * Math.PI) / 180;
    const ptLat = lat + dLat * Math.cos(rad);
    const ptLng = lng + dLng * Math.sin(rad);
    coordinates.push([ptLng, ptLat]);
  }
  coordinates.push([lng, lat]);
  return coordinates;
}

export const Tactical3DTerrainMap: React.FC<Tactical3DTerrainMapProps> = ({
  cameras,
  bops = [],
  events: _events = [],
  alerts = [],
  center = [31.6048, 74.5731],
  targetCoords = null,
  zoom = 15,
  height = '540px',
  selectedCameraId,
  initialStyle = 'satellite',
  autoFlythrough = false,
  onCameraSelect,
  onInspectCamera,
  onClose3D,
  onSwitchTo2D
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const flythroughAnimRef = useRef<number | null>(null);

  // HUD & Interaction States
  const [currentStyle, setCurrentStyle] = useState<TerrainMapStyle>(initialStyle);
  const [isFlythroughActive, setIsFlythroughActive] = useState<boolean>(autoFlythrough);
  const [pitchAngle, setPitchAngle] = useState<number>(62);
  const [bearingAngle, setBearingAngle] = useState<number>(25);
  const [activeCamDetails, setActiveCamDetails] = useState<Camera | null>(null);
  const [inspectedCam, setInspectedCam] = useState<Camera | null>(null);
  const [showFovLayer, setShowFovLayer] = useState<boolean>(true);
  const [showBorderWire, setShowBorderWire] = useState<boolean>(true);
  const [terrainExaggeration] = useState<number>(1.85);

  // Map center coordinates [lng, lat]
  const initialLngLat = useMemo<[number, number]>(() => {
    if (targetCoords && targetCoords[0] && targetCoords[1]) {
      return [targetCoords[1], targetCoords[0]];
    }
    return [center[1], center[0]];
  }, [center, targetCoords]);

  // Set up MapLibre instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapStyle(currentStyle),
      center: initialLngLat,
      zoom: Math.max(12.5, (zoom || 15) - 1.2),
      pitch: pitchAngle,
      bearing: bearingAngle,
      maxPitch: 85,
      canvasContextAttributes: { antialias: true }
    });

    mapRef.current = map;

    // Navigation control for standard zoom/compass
    const navControl = new maplibregl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: true
    });
    map.addControl(navControl, 'top-right');

    map.on('load', () => {
      // 1. Enable 3D Terrain Elevation
      try {
        if (map.getSource('terrain-dem')) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration });
        }
      } catch (e) {
        console.warn('Terrain DEM initialization note:', e);
      }

      // 2. Add Border Fence GeoJSON Layers
      try {
        const borderGeoJson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: TACTICAL_BORDER_SEGMENTS.map(seg => ({
            type: 'Feature',
            properties: {
              name: seg.name,
              sector: seg.sector
            },
            geometry: {
              type: 'LineString',
              coordinates: seg.points.map(([lat, lng]: [number, number]) => [lng, lat])
            }
          }))
        };

        map.addSource('border-segments', {
          type: 'geojson',
          data: borderGeoJson
        });

        map.addLayer({
          id: 'border-wire-casing',
          type: 'line',
          source: 'border-segments',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
            visibility: showBorderWire ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#000000',
            'line-width': 4.5,
            'line-opacity': 0.7
          }
        });

        map.addLayer({
          id: 'border-wire-line',
          type: 'line',
          source: 'border-segments',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
            visibility: showBorderWire ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#ef4444',
            'line-width': 2.5,
            'line-dasharray': [3, 2]
          }
        });

        map.addLayer({
          id: 'border-wire-glow',
          type: 'line',
          source: 'border-segments',
          layout: {
            visibility: showBorderWire ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#f87171',
            'line-width': 8,
            'line-opacity': 0.35,
            'line-blur': 4
          }
        });
      } catch (e) {
        console.warn('Border wire layer note:', e);
      }

      // 3. Add FOV Cones GeoJSON Layer
      try {
        const fovFeatures: GeoJSON.Feature[] = cameras
          .filter(c => c.latitude && c.longitude && c.status !== 'OFFLINE')
          .map(c => ({
            type: 'Feature',
            properties: {
              camera_id: c.camera_id,
              camera_name: c.camera_name,
              status: c.status
            },
            geometry: {
              type: 'Polygon',
              coordinates: [generateFovPolygon(c.latitude!, c.longitude!, 45, 60, 220)]
            }
          }));

        map.addSource('camera-fovs', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: fovFeatures
          }
        });

        map.addLayer({
          id: 'camera-fov-fill',
          type: 'fill',
          source: 'camera-fovs',
          layout: {
            visibility: showFovLayer ? 'visible' : 'none'
          },
          paint: {
            'fill-color': '#06b6d4',
            'fill-opacity': 0.22
          }
        });

        map.addLayer({
          id: 'camera-fov-stroke',
          type: 'line',
          source: 'camera-fovs',
          layout: {
            visibility: showFovLayer ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 1.5,
            'line-dasharray': [2, 2]
          }
        });
      } catch (e) {
        console.warn('Camera FOV layer note:', e);
      }
    });

    // Update bearing and pitch state on user interaction
    map.on('rotate', () => setBearingAngle(Math.round(map.getBearing())));
    map.on('pitch', () => setPitchAngle(Math.round(map.getPitch())));

    return () => {
      if (flythroughAnimRef.current) {
        cancelAnimationFrame(flythroughAnimRef.current);
      }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Style Switching
  const handleSwitchStyle = (newStyle: TerrainMapStyle) => {
    setCurrentStyle(newStyle);
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(buildMapStyle(newStyle));

    map.once('style.load', () => {
      try {
        if (map.getSource('terrain-dem')) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration });
        }
      } catch (e) {
        console.warn('Re-applying terrain note:', e);
      }
    });
  };

  // Toggle FOV Layer Visibility
  const handleToggleFov = () => {
    const next = !showFovLayer;
    setShowFovLayer(next);
    const map = mapRef.current;
    if (!map) return;
    const vis = next ? 'visible' : 'none';
    if (map.getLayer('camera-fov-fill')) map.setLayoutProperty('camera-fov-fill', 'visibility', vis);
    if (map.getLayer('camera-fov-stroke')) map.setLayoutProperty('camera-fov-stroke', 'visibility', vis);
  };

  // Toggle Border Wire Visibility
  const handleToggleBorderWire = () => {
    const next = !showBorderWire;
    setShowBorderWire(next);
    const map = mapRef.current;
    if (!map) return;
    const vis = next ? 'visible' : 'none';
    if (map.getLayer('border-wire-casing')) map.setLayoutProperty('border-wire-casing', 'visibility', vis);
    if (map.getLayer('border-wire-line')) map.setLayoutProperty('border-wire-line', 'visibility', vis);
    if (map.getLayer('border-wire-glow')) map.setLayoutProperty('border-wire-glow', 'visibility', vis);
  };

  // Render 3D CCTV Camera Markers & BOP Outposts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // 1. Render BOP Outpost Towers
    bops.forEach(b => {
      const lat = b.latitude;
      const lng = b.longitude;
      if (!lat || !lng) return;

      const el = document.createElement('div');
      el.className = 'tactical-3d-bop-marker';
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;">
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(6, 78, 59, 0.85);
            border: 1.5px solid #10b981;
            box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
            padding: 3px 8px;
            border-radius: 8px;
            backdrop-filter: blur(4px);
          ">
            <span style="font-size: 11px;">🛡️</span>
            <span style="font-size: 11px; font-weight: 800; color: #ffffff; font-family: monospace; letter-spacing: 0.5px;">
              ${b.name}
            </span>
          </div>
          <div style="width: 2px; height: 12px; background: #10b981;"></div>
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></div>
        </div>
      `;

      el.onclick = () => {
        map.flyTo({
          center: [lng, lat],
          zoom: 16,
          pitch: 65,
          duration: 1200
        });
      };

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 2. Render 3D CCTV Camera Pins
    cameras.forEach(cam => {
      const lat = cam.latitude ?? center[0];
      const lng = cam.longitude ?? center[1];
      if (!lat || !lng) return;

      const isOnline = cam.status === 'ONLINE' || cam.status === 'HEALTHY';
      const hasThreat = alerts.some(a => a.camera_id?.toLowerCase() === cam.camera_id?.toLowerCase());
      const isSelected = cam.camera_id === selectedCameraId;

      const color = hasThreat ? '#ef4444' : isOnline ? '#06b6d4' : '#f59e0b';

      const el = document.createElement('div');
      el.className = 'tactical-3d-cam-marker';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;">
          ${hasThreat ? `
            <div style="
              position: absolute;
              top: -6px;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              border: 2px dashed #ef4444;
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
              opacity: 0.7;
            "></div>
          ` : ''}
          <div style="
            width: ${isSelected ? '32px' : '26px'};
            height: ${isSelected ? '32px' : '26px'};
            border-radius: 50%;
            background: #090e17;
            border: 2px solid ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 ${isSelected ? '18px' : '10px'} ${color};
            transition: all 0.2s ease;
          ">
            <span style="font-size: ${isSelected ? '14px' : '11px'};">📹</span>
          </div>
          <div style="width: 2px; height: 10px; background: ${color}; opacity: 0.8;"></div>
          <div style="
            background: rgba(3, 7, 18, 0.88);
            border: 1px solid ${color};
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-family: monospace;
            color: #e2e8f0;
            font-weight: bold;
            white-space: nowrap;
            margin-top: -2px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
          ">
            ${cam.camera_name || cam.camera_id}
          </div>
        </div>
      `;

      el.onclick = (e) => {
        e.stopPropagation();
        setActiveCamDetails(cam);
        if (onCameraSelect) onCameraSelect(cam);

        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 16),
          pitch: 65,
          duration: 1200
        });
      };

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [cameras, bops, alerts, selectedCameraId, center]);

  // Center / Target Coords Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetCoords && targetCoords[0] && targetCoords[1]) {
      map.flyTo({
        center: [targetCoords[1], targetCoords[0]],
        zoom: zoom ? Math.max(14, zoom - 1) : 15.5,
        pitch: 65,
        duration: 1400
      });
    } else if (center && center[0] && center[1]) {
      map.flyTo({
        center: [center[1], center[0]],
        zoom: zoom ? Math.max(13, zoom - 1) : 15,
        pitch: 62,
        duration: 1200
      });
    }
  }, [center, targetCoords, zoom]);

  // Automated Drone Flythrough Patrol Animation Loop
  useEffect(() => {
    if (!isFlythroughActive) {
      if (flythroughAnimRef.current) {
        cancelAnimationFrame(flythroughAnimRef.current);
        flythroughAnimRef.current = null;
      }
      return;
    }

    const loop = () => {
      const map = mapRef.current;
      if (map) {
        const curBearing = map.getBearing();
        const nextBearing = (curBearing + 0.12) % 360;
        map.setBearing(nextBearing);
      }
      flythroughAnimRef.current = requestAnimationFrame(loop);
    };

    flythroughAnimRef.current = requestAnimationFrame(loop);

    return () => {
      if (flythroughAnimRef.current) {
        cancelAnimationFrame(flythroughAnimRef.current);
        flythroughAnimRef.current = null;
      }
    };
  }, [isFlythroughActive]);

  // D-Pad Directional Pan Actions
  const handlePan = (dx: number, dy: number) => {
    const map = mapRef.current;
    if (map) {
      map.panBy([dx, dy], { duration: 200 });
    }
  };

  // Recenter / Reset View
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: initialLngLat,
      zoom: 15.5,
      pitch: 65,
      bearing: 25,
      duration: 1200
    });
  };

  // Quick Tilt Toggle (0° Top-Down vs 65° 3D Oblique)
  const handleToggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const currentPitch = map.getPitch();
    const newPitch = currentPitch > 30 ? 0 : 65;
    map.easeTo({ pitch: newPitch, duration: 600 });
    setPitchAngle(newPitch);
  };

  // Rotate Bearing Actions
  const handleRotate = (deg: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() + deg, duration: 400 });
  };

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 font-sans" style={{ height }}>
      {/* 3D WebGL MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full outline-none" />

      {/* Top Left: 2D/3D Mode & Style Switcher */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Dimension Switcher */}
          <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-2xl">
            <button
              type="button"
              onClick={() => {
                if (onSwitchTo2D) onSwitchTo2D();
                if (onClose3D) onClose3D();
              }}
              className="px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Switch to 2D Leaflet Radar View"
            >
              <span>🗺️</span>
              <span>2D RADAR</span>
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 bg-cyan-600 text-white shadow"
              title="Active: Realistic 3D Physical Mountain Terrain"
            >
              <span>⛰️</span>
              <span>3D TERRAIN</span>
            </button>
          </div>

          {/* Realistic Style Switchers */}
          <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-2xl">
            <button
              type="button"
              onClick={() => handleSwitchStyle('satellite')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'satellite'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="High-Resolution Satellite Orthophoto 3D Terrain"
            >
              <span>🛰️</span>
              <span className="hidden sm:inline">SATELLITE</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchStyle('topo')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'topo'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Topographic Elevation Contour 3D Terrain"
            >
              <span>⛰️</span>
              <span className="hidden sm:inline">TOPO</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchStyle('dark')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'dark'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Tactical Cyber Night Ops"
            >
              <span>🛡️</span>
              <span className="hidden sm:inline">DARK OPS</span>
            </button>
          </div>
        </div>

        {/* Tactical Overlays Ribbon */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg self-start">
          <button
            type="button"
            onClick={handleToggleFov}
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition cursor-pointer border ${
              showFovLayer
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50'
                : 'bg-transparent text-slate-500 border-slate-800'
            }`}
          >
            FOV CONES
          </button>
          <button
            type="button"
            onClick={handleToggleBorderWire}
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition cursor-pointer border ${
              showBorderWire
                ? 'bg-red-950/70 text-red-300 border-red-500/50'
                : 'bg-transparent text-slate-500 border-slate-800'
            }`}
          >
            ZERO-LINE WIRE
          </button>
          <button
            type="button"
            onClick={handleToggleTilt}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition cursor-pointer bg-slate-800 text-sky-300 hover:text-white border border-slate-700"
            title="Toggle between 65° 3D Oblique and 0° Top-Down view"
          >
            {pitchAngle > 30 ? '📐 3D (65°)' : '🗺️ 2D (0°)'}
          </button>
        </div>
      </div>

      {/* Top Right: Telemetry Badge & Drone Flythrough */}
      <div className="absolute top-3 right-14 z-10 flex items-center gap-2">
        {/* Drone Flythrough / Patrol Orbit Button */}
        <button
          type="button"
          onClick={() => setIsFlythroughActive(!isFlythroughActive)}
          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer shadow-xl ${
            isFlythroughActive
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-slate-700'
          }`}
          title="Toggle automated 3D perimeter patrol orbit"
        >
          <Plane className="w-4 h-4" />
          <span>{isFlythroughActive ? 'FLYTHROUGH ACTIVE' : 'DRONE FLYTHROUGH'}</span>
        </button>

        {/* Live Surveillance Telemetry Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl text-xs font-mono text-slate-300 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>CAMERAS: <strong className="text-emerald-400">{cameras.length}</strong></span>
          <span className="text-slate-600">|</span>
          <span>ELEVATION: <strong className="text-cyan-300">{terrainExaggeration}x DEM</strong></span>
        </div>
      </div>

      {/* Bottom Left: Permanent 3D Tactical D-Pad Pan & Recenter */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-2xl shadow-2xl">
        <span className="text-[9px] font-mono text-cyan-400 font-bold tracking-wider">3D D-PAD PAN</span>
        <div className="grid grid-cols-3 gap-1">
          <div />
          <button
            type="button"
            onClick={() => handlePan(0, -220)}
            className="w-7 h-7 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer border border-slate-700 active:scale-90"
            title="Pan North / Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />

          <button
            type="button"
            onClick={() => handlePan(-220, 0)}
            className="w-7 h-7 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer border border-slate-700 active:scale-90"
            title="Pan West / Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            className="w-7 h-7 bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer border border-cyan-500/50 active:scale-90"
            title="Recenter Outpost View"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handlePan(220, 0)}
            className="w-7 h-7 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer border border-slate-700 active:scale-90"
            title="Pan East / Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div />
          <button
            type="button"
            onClick={() => handlePan(0, 220)}
            className="w-7 h-7 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer border border-slate-700 active:scale-90"
            title="Pan South / Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <div />
        </div>
      </div>

      {/* Bottom Right: Quick Rotation & Altitude Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-xl">
        <button
          type="button"
          onClick={() => handleRotate(-30)}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
          title="Rotate 30° Left"
        >
          <RotateCw className="w-4 h-4 transform -scale-x-100" />
        </button>
        <button
          type="button"
          onClick={() => {
            const map = mapRef.current;
            if (map) map.easeTo({ bearing: 0, duration: 400 });
          }}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1"
          title="Reset to True North (0°)"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{bearingAngle}° N</span>
        </button>
        <button
          type="button"
          onClick={() => handleRotate(30)}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
          title="Rotate 30° Right"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Active Camera Clicked HUD Details Card */}
      {activeCamDetails && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-84 sm:w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3.5 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-cyan-950 text-cyan-400 rounded border border-cyan-800">
                <Cctv className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white font-mono">{activeCamDetails.camera_name}</h4>
                <span className="text-[10px] text-slate-400 font-mono">{activeCamDetails.camera_id}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveCamDetails(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">OUTPOST:</span>
              <strong className="text-emerald-300 truncate block">{activeCamDetails.bop_site || 'Border Post'}</strong>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">STATUS:</span>
              <strong className={activeCamDetails.status === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'}>
                {activeCamDetails.status}
              </strong>
            </div>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 relative">
            <LiveVideoPlayer camera={activeCamDetails} autoPlay showControls={false} />
          </div>

          <button
            type="button"
            onClick={() => {
              setInspectedCam(activeCamDetails);
              if (onInspectCamera) onInspectCamera(activeCamDetails);
            }}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md border border-emerald-400"
          >
            <Eye className="w-4 h-4" />
            <span>INSPECT FULL LIVE FEED</span>
          </button>
        </div>
      )}

      {/* Full Live Stream Inspection Modal */}
      {inspectedCam && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cctv className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="font-bold text-white text-sm">{inspectedCam.camera_name}</span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  {inspectedCam.camera_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCam(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <LiveVideoPlayer camera={inspectedCam} className="w-full h-84 rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tactical3DTerrainMap;
