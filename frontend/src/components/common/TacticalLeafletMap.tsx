import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, Radio, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Camera } from '../../types/camera';

import { SecurityEvent } from '../../types/event';

import { GISLayer } from '../../services/gisService';

interface TacticalLeafletMapProps {
  cameras: Camera[];
  events?: SecurityEvent[];
  blindSpots?: any[];
  sites?: any[];
  bops?: any[];
  layers?: GISLayer[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedCameraId?: string;
  onCameraSelect?: (camera: Camera) => void;
}

type TileLayerType = 'dark' | 'satellite' | 'streets';

export const TacticalLeafletMap: React.FC<TacticalLeafletMapProps> = ({
  cameras,
  events = [],
  blindSpots = [],
  sites = [],
  bops = [],
  layers = [],
  center = [31.6245, 74.8725],
  zoom = 13,
  height = '500px',
  selectedCameraId,
  onCameraSelect
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<TileLayerType>('dark');
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(zoom);

  const hasInitialFitRef = useRef<boolean>(false);
  const lastValidCoordsRef = useRef<[number, number][]>([]);
  const prevCenterRef = useRef<[number, number]>(center);
  const prevZoomRef = useRef<number>(zoom);

  // Reliable, 100% Free & Open Global Tiles (Zero API Key required, zero rate-limit watermarks)
  const tileUrls: Record<TileLayerType, { 
    base: string; 
    labels?: string; 
    attribution: string;
    maxNativeZoom: number;
    maxZoom: number;
    subdomains?: string[];
  }> = {
    dark: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Dark Tactical Canvas',
      maxNativeZoom: 16,
      maxZoom: 21
    },
    satellite: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri World Imagery',
      maxNativeZoom: 19,
      maxZoom: 21
    },
    streets: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri World Topo Map',
      maxNativeZoom: 19,
      maxZoom: 21
    }
  };

  // Helper to check layer visibility from GIS Layer Stack
  const isLayerVisible = (layerType: string, defaultVal = true) => {
    if (!layers || layers.length === 0) return defaultVal;
    const l = layers.find(x => x.layer_type === layerType || x.layer_id?.toUpperCase().includes(layerType));
    return l ? l.is_visible : defaultVal;
  };

  // Initialize Leaflet Map with smooth fractional zooming & high zoom support
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      minZoom: 3,
      maxZoom: 22,
      zoomSnap: 0.25,           // Fractional zoom steps (silky-smooth)
      zoomDelta: 0.5,            // Precise step for +/- controls
      wheelPxPerZoomLevel: 100,  // Smooth mouse scroll speed
      wheelDebounceTime: 30,     // Quick responsive zoom response
      zoomControl: false,        // Using sleek tactical HUD zoom controls
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      bounceAtZoomLimits: false
    });

    const cfg = tileUrls[activeLayer];
    const initialTile = L.tileLayer(cfg.base, {
      minZoom: 3,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom,
      subdomains: cfg.subdomains || 'abc',
      attribution: cfg.attribution
    }).addTo(map);

    tileLayerRef.current = initialTile;

    if (cfg.labels) {
      const labelsTile = L.tileLayer(cfg.labels, {
        minZoom: 3,
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfg.maxNativeZoom
      }).addTo(map);
      labelsLayerRef.current = labelsTile;
    }

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    // Track live zoom level changes for HUD readout
    map.on('zoomend', () => {
      setCurrentZoomLevel(Math.round(map.getZoom() * 10) / 10);
    });

    // Invalidate size on initial mount after small layout delay
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // ResizeObserver to automatically adjust on window or modal resize
    let ro: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    mapInstanceRef.current = map;

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamically fly to new center and zoom ONLY when parent explicitly changes target location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;

    const latDiff = Math.abs((prevCenterRef.current?.[0] ?? 0) - center[0]);
    const lngDiff = Math.abs((prevCenterRef.current?.[1] ?? 0) - center[1]);
    const zoomDiff = Math.abs((prevZoomRef.current ?? 0) - zoom);

    // Only initiate flyTo if coordinates or zoom prop genuinely changed from parent
    if (latDiff > 0.0001 || lngDiff > 0.0001 || zoomDiff > 0.1) {
      prevCenterRef.current = center;
      prevZoomRef.current = zoom;
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center[0], center[1], zoom]);

  // Handle Tile Switch
  const switchTileLayer = (layerType: TileLayerType) => {
    if (!mapInstanceRef.current) return;
    setActiveLayer(layerType);

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    if (labelsLayerRef.current) {
      mapInstanceRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    const cfg = tileUrls[layerType];
    const newTile = L.tileLayer(cfg.base, {
      minZoom: 3,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom,
      subdomains: cfg.subdomains || 'abc',
      attribution: cfg.attribution
    }).addTo(mapInstanceRef.current);
    newTile.bringToBack();
    tileLayerRef.current = newTile;

    if (cfg.labels) {
      const newLabels = L.tileLayer(cfg.labels, {
        minZoom: 3,
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfg.maxNativeZoom
      }).addTo(mapInstanceRef.current);
      labelsLayerRef.current = newLabels;
    }
  };


  // Render Overlays: Cameras, FOV Cones, Blind Spots, Border Fence, and Live Threats
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const validCoords: [number, number][] = [];

    // 0. Render Tactical Perimeter Boundary Fence Line
    if (isLayerVisible('BOUNDARY', true)) {
      const boundaryCoords: [number, number][] = [
        [center[0] + 0.015, center[1] - 0.018],
        [center[0] + 0.008, center[1] - 0.009],
        [center[0], center[1]],
        [center[0] - 0.007, center[1] + 0.010],
        [center[0] - 0.016, center[1] + 0.021],
      ];
      const fenceLine = L.polyline(boundaryCoords, {
        color: '#ef4444',
        weight: 3,
        dashArray: '8, 8',
        opacity: 0.85
      });
      fenceLine.bindPopup(`
        <div style="font-family: inherit; min-width: 170px;">
          <div style="color: #ef4444; font-weight: bold; font-size: 11px;">🛑 ZERO-LINE PERIMETER FENCE</div>
          <div style="font-size: 10px; color: #cbd5e1; margin-top: 3px;">
            Smart Border Buffer Zone • Optical & Seismic Tripwires Armed
          </div>
        </div>
      `);
      fenceLine.addTo(group);
    }

    // 0.1 Render Tactical Border Sites (HQ Command Bunkers)
    if (isLayerVisible('SITES', true)) {
      sites.forEach((site) => {
        if (!site.latitude || !site.longitude) return;
        const sLat = site.latitude;
        const sLng = site.longitude;
        validCoords.push([sLat, sLng]);

        const siteIcon = L.divIcon({
          className: 'custom-site-marker',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 5px;
              background: rgba(15, 23, 42, 0.95);
              border: 1.5px solid #6366f1;
              border-radius: 8px;
              padding: 4px 8px;
              box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
              white-space: nowrap;
              font-family: monospace;
              cursor: pointer;
            ">
              <span style="font-size: 11px;">🏛️</span>
              <div>
                <div style="font-size: 10px; font-weight: bold; color: #a5b4fc;">SITE: ${site.code || site.name}</div>
              </div>
            </div>
          `,
          iconSize: [95, 28],
          iconAnchor: [47, 14]
        });

        const sMarker = L.marker([sLat, sLng], { icon: siteIcon });
        sMarker.bindPopup(`
          <div style="font-family: inherit; min-width: 180px;">
            <div style="color: #818cf8; font-weight: bold; font-size: 12px;">${site.name}</div>
            <div style="font-size: 10px; color: #94a3b8; margin: 3px 0;">Tactical Border Site • ${site.code}</div>
            <div style="font-size: 10px; color: #e2e8f0; display: flex; justify-content: space-between;">
              <span>Status:</span> <strong style="color: #34d399;">${site.status || 'OPERATIONAL'}</strong>
            </div>
            <div style="font-size: 10px; color: #e2e8f0; display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Health Score:</span> <strong style="color: #38bdf8;">${site.health_score ?? 100}%</strong>
            </div>
          </div>
        `);
        sMarker.addTo(group);
      });
    }

    // 0.2 Render Border Outposts (BOPs)
    if (isLayerVisible('SITES', true)) {
      bops.forEach((bop) => {
        if (!bop.latitude || !bop.longitude) return;
        const bLat = bop.latitude;
        const bLng = bop.longitude;
        validCoords.push([bLat, bLng]);

        const bopIcon = L.divIcon({
          className: 'custom-bop-marker',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: rgba(15, 23, 42, 0.95);
              border: 1.5px solid #10b981;
              border-radius: 8px;
              padding: 3px 7px;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
              white-space: nowrap;
              font-family: monospace;
              cursor: pointer;
            ">
              <span style="font-size: 10px;">🛰️</span>
              <span style="font-size: 10px; font-weight: bold; color: #6ee7b7;">${bop.name}</span>
            </div>
          `,
          iconSize: [85, 24],
          iconAnchor: [42, 12]
        });

        const bMarker = L.marker([bLat, bLng], { icon: bopIcon });
        bMarker.bindPopup(`
          <div style="font-family: inherit; min-width: 170px;">
            <div style="color: #34d399; font-weight: bold; font-size: 12px;">${bop.name}</div>
            <div style="font-size: 10px; color: #94a3b8; margin: 3px 0;">Border Outpost (BOP)</div>
            <div style="font-size: 10px; color: #e2e8f0; display: flex; justify-content: space-between;">
              <span>Priority:</span> <strong style="color: #fbbf24;">${bop.priority || 'HIGH'}</strong>
            </div>
            <div style="font-size: 10px; color: #e2e8f0; display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Cameras:</span> <strong style="color: #38bdf8;">${bop.total_cameras ?? 0} active</strong>
            </div>
          </div>
        `);
        bMarker.addTo(group);
      });
    }

    // 1. Render Cameras & FOV Cones
    const showCameras = isLayerVisible('CAMERAS', true);
    const showCoverage = isLayerVisible('COVERAGE', true);

    if (showCameras || showCoverage) {
      cameras.forEach((cam, idx) => {
        // Default to Punjab/Jammu border offset if lat/lng is missing
        const lat = cam.latitude ?? (center[0] + (idx * 0.003 - 0.006));

        const lng = cam.longitude ?? (center[1] + (idx * 0.004 - 0.008));
        validCoords.push([lat, lng]);

        const isOnline = cam.status === 'HEALTHY' || cam.status === 'ONLINE';
        const statusColor = isOnline ? '#10b981' : '#ef4444';

        // FOV Cone geometry (60-degree wedge ~150 meters out)
        if (showCoverage) {
          const azimuth = 45 + idx * 35; // Heading angle
          const rangeMeters = 150;
          const earthRadius = 6378137;
          const dLat = (rangeMeters / earthRadius) * (180 / Math.PI);
          const dLng = (rangeMeters / (earthRadius * Math.cos((Math.PI * lat) / 180))) * (180 / Math.PI);

          const rad1 = ((azimuth - 30) * Math.PI) / 180;
          const rad2 = ((azimuth + 30) * Math.PI) / 180;

          const p1: [number, number] = [lat, lng];
          const p2: [number, number] = [lat + dLat * Math.cos(rad1), lng + dLng * Math.sin(rad1)];
          const p3: [number, number] = [lat + dLat * Math.cos(rad2), lng + dLng * Math.sin(rad2)];

          // FOV Polygon
          const fovCone = L.polygon([p1, p2, p3], {
            color: isOnline ? '#06b6d4' : '#64748b',
            weight: 1,
            fillColor: isOnline ? '#06b6d4' : '#64748b',
            fillOpacity: 0.18,
            dashArray: isOnline ? undefined : '4, 4'
          });
          fovCone.addTo(group);
        }

        if (showCameras) {
          const isSelectedCam = cam.camera_id === selectedCameraId;

          // Custom Camera Pin Icon
          const cameraIcon = L.divIcon({
            className: 'custom-camera-marker',
            html: `
              <div style="
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(15, 23, 42, 0.95);
                border: ${isSelectedCam ? '2px solid #38bdf8' : `1px solid ${statusColor}`};
                border-radius: 8px;
                padding: 3px 6px;
                box-shadow: ${isSelectedCam ? '0 0 16px rgba(56, 189, 248, 0.8), 0 4px 12px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.6)'};
                white-space: nowrap;
                font-family: monospace;
                cursor: pointer;
                transform: ${isSelectedCam ? 'scale(1.12)' : 'scale(1)'};
                transition: all 0.2s ease-in-out;
              ">
                <span style="
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: ${statusColor};
                  display: inline-block;
                  box-shadow: 0 0 8px ${statusColor};
                "></span>
                <span style="font-size: 11px; font-weight: bold; color: ${isSelectedCam ? '#38bdf8' : '#fff'};">${cam.camera_id}</span>
              </div>
            `,
            iconSize: [84, 26],
            iconAnchor: [42, 13]
          });

          const marker = L.marker([lat, lng], { icon: cameraIcon });
          marker.bindPopup(`
            <div style="font-family: inherit; min-width: 190px; padding: 4px 0;">
              <div style="font-size: 12px; font-weight: bold; color: #38bdf8; margin-bottom: 2px;">
                ${cam.camera_name}
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">
                ID: ${cam.camera_id} • Sector: ${cam.sector || 'Sector-North'}
              </div>
              <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Status:</span>
                <span style="color: ${statusColor}; font-weight: bold;">${cam.status}</span>
              </div>
              <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>GPS:</span>
                <span style="font-family: monospace; color: #34d399;">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
              </div>
              <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between;">
                <span>FPS:</span>
                <span style="font-family: monospace;">${cam.fps || 0} FPS</span>
              </div>
            </div>
          `);

          if (isSelectedCam) {
            setTimeout(() => {
              try {
                marker.openPopup();
              } catch (_) {}
            }, 300);
          }

          if (onCameraSelect) {
            marker.on('click', () => onCameraSelect(cam));
          }
          marker.addTo(group);
        }
      });
    }

    // 2. Render Real Live Threat Events (Pulsing Target Reticle)
    if (isLayerVisible('INCIDENTS', true)) {
      events.slice(0, 5).forEach((evt, idx) => {
        const cam = cameras.find(c => c.camera_id === evt.camera_id);
        const lat = cam?.latitude ? cam.latitude + (idx * 0.0008 + 0.0004) : center[0] + 0.001;
        const lng = cam?.longitude ? cam.longitude + (idx * 0.0008 + 0.0004) : center[1] + 0.001;
        validCoords.push([lat, lng]);

        const isCritical = evt.risk_level === 'CRITICAL' || evt.risk_score >= 80;
        const threatColor = isCritical ? '#ef4444' : '#f59e0b';

        const threatIcon = L.divIcon({
          className: 'custom-threat-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: ${threatColor};
                border: 2px solid #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 15px ${threatColor};
                animation: pulse 1.5s infinite;
              ">
                <span style="color: #fff; font-size: 12px; font-weight: bold;">🎯</span>
              </div>
              <div style="
                margin-top: 4px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid ${threatColor};
                border-radius: 4px;
                padding: 2px 6px;
                color: #fff;
                font-size: 9px;
                font-family: monospace;
                white-space: nowrap;
              ">
                ${evt.object_type?.toUpperCase() || 'TARGET'} (${evt.camera_id})
              </div>
            </div>
          `,
          iconSize: [90, 48],
          iconAnchor: [45, 12]
        });

        const threatMarker = L.marker([lat, lng], { icon: threatIcon });
        threatMarker.bindPopup(`
          <div style="font-family: inherit; min-width: 170px;">
            <div style="color: #ef4444; font-weight: bold; font-size: 11px;">
              ⚠️ REAL-TIME INTRUSION ALERT
            </div>
            <div style="font-size: 12px; font-weight: bold; color: #fff; margin-top: 2px;">
              ${evt.object_type?.toUpperCase()} DETECTED
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
              Camera: <strong>${evt.camera_id}</strong><br/>
              Risk Score: <strong style="color: #ef4444;">${evt.risk_score}/100</strong><br/>
              Time: ${new Date(evt.started_at).toLocaleTimeString()}
            </div>
          </div>
        `);
        threatMarker.addTo(group);
      });
    }

    // 3. Render Blind Spots
    if (isLayerVisible('BLIND_SPOTS', true)) {
      blindSpots.slice(0, 2).forEach((bs, idx) => {
        const bsLat = center[0] + (idx === 0 ? 0.003 : -0.003);
        const bsLng = center[1] + (idx === 0 ? 0.005 : -0.005);
        validCoords.push([bsLat, bsLng]);

        const circle = L.circle([bsLat, bsLng], {
          radius: 120,
          color: '#f97316',
          fillColor: '#ea580c',
          fillOpacity: 0.15,
          dashArray: '6, 6'
        });
        circle.bindPopup(`
          <div style="font-family: inherit;">
            <span style="color: #f97316; font-weight: bold; font-size: 11px;">TACTICAL BLIND SPOT</span>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">
              Sector: ${bs.sector_name || 'Sector-North'}<br/>
              Risk Score: ${bs.risk_score}/100<br/>
              Status: Uncovered by Optical Mesh
            </div>
          </div>
        `);
        circle.addTo(group);
      });
    }

    lastValidCoordsRef.current = validCoords;

    // Fit Bounds ONLY on initial load when coordinates first become available,
    // so background polling updates never yank the user's view or undo manual zoom!
    if (!hasInitialFitRef.current && validCoords.length > 1) {
      map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 16 });
      hasInitialFitRef.current = true;
    }
  }, [cameras, events, blindSpots, sites, bops, center, layers]);

  const handleZoomIn = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn(0.5);
  };

  const handleZoomOut = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut(0.5);
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(center, zoom, { duration: 0.8 });
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    if (lastValidCoordsRef.current && lastValidCoordsRef.current.length > 1) {
      mapInstanceRef.current.fitBounds(lastValidCoordsRef.current, { padding: [40, 40], maxZoom: 16 });
    } else {
      mapInstanceRef.current.flyTo(center, zoom, { duration: 0.8 });
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#070b14]" style={{ height }}>
      {/* Map Container Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left Layer Control Badge */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
        <button
          type="button"
          onClick={() => switchTileLayer('dark')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
            activeLayer === 'dark'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Tactical Dark
        </button>
        <button
          type="button"
          onClick={() => switchTileLayer('satellite')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
            activeLayer === 'satellite'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => switchTileLayer('streets')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
            activeLayer === 'streets'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Street
        </button>
      </div>

      {/* Top Right Tactical Zoom Controls & Zoom Level Readout */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 bg-slate-950/80 border border-slate-800 rounded-lg">
          ZOOM {currentZoomLevel.toFixed(1)}x
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <ZoomIn className="w-4 h-4 text-sky-400" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <ZoomOut className="w-4 h-4 text-sky-400" />
        </button>
        <button
          type="button"
          onClick={handleFitAll}
          title="Fit All Perimeter Nodes"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Maximize2 className="w-4 h-4 text-indigo-400" />
        </button>
      </div>

      {/* Bottom Right Floating HUD */}
      <div className="absolute bottom-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-xl transition cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Recenter</span>
        </button>
        <button
          type="button"
          onClick={handleFitAll}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-xl transition cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Fit Perimeter</span>
        </button>
        <div className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-400 flex items-center gap-1.5 shadow-xl">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Cameras: <strong className="text-white">{cameras.length}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Threats: <strong className="text-red-400">{events.length}</strong></span>
        </div>
      </div>
    </div>
  );
};
