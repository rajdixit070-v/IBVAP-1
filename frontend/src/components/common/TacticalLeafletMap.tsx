import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Compass,
  Radio,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Locate,
  X,
  Cctv,
  ShieldAlert,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Camera } from '../../types/camera';
import { SecurityEvent } from '../../types/event';
import { GISLayer } from '../../services/gisService';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';

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
  onInspectCamera?: (camera: Camera) => void;
  onLocationFound?: (lat: number, lng: number) => void;
}

type TileLayerType = 'dark' | 'satellite' | 'streets' | 'topo';

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
  onCameraSelect,
  onInspectCamera,
  onLocationFound
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<TileLayerType>('dark');
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(zoom);

  // Live Camera Stream & Alert Inspection State
  const [inspectedCamera, setInspectedCamera] = useState<Camera | null>(null);
  const [inspectedEvent, setInspectedEvent] = useState<SecurityEvent | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

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
      base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxNativeZoom: 19,
      maxZoom: 21
    },
    topo: {
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
      keyboard: true,
      keyboardPanDelta: 80,
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
            <div style="margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <button id="btn-zoom-site-${site.site_id}" type="button" style="width: 100%; padding: 5px 8px; background: #312e81; color: #c7d2fe; border: 1px solid #6366f1; border-radius: 6px; font-size: 10px; font-family: monospace; font-weight: bold; cursor: pointer;">
                🔍 ZOOM TO SITE (14x)
              </button>
            </div>
          </div>
        `);
        sMarker.on('popupopen', () => {
          const btn = document.getElementById(`btn-zoom-site-${site.site_id}`);
          if (btn) {
            btn.onclick = (e) => {
              e.stopPropagation();
              map.flyTo([sLat, sLng], 14, { animate: true, duration: 1.0 });
            };
          }
        });
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
            <div style="margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <button id="btn-zoom-bop-${bop.bop_id}" type="button" style="width: 100%; padding: 5px 8px; background: #064e3b; color: #a7f3d0; border: 1px solid #10b981; border-radius: 6px; font-size: 10px; font-family: monospace; font-weight: bold; cursor: pointer;">
                🔍 ZOOM TO BOP (15x)
              </button>
            </div>
          </div>
        `);
        bMarker.on('popupopen', () => {
          const btn = document.getElementById(`btn-zoom-bop-${bop.bop_id}`);
          if (btn) {
            btn.onclick = (e) => {
              e.stopPropagation();
              map.flyTo([bLat, bLng], 15, { animate: true, duration: 1.0 });
            };
          }
        });
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
            <div style="font-family: inherit; min-width: 220px; padding: 4px 0;">
              <div style="font-size: 13px; font-weight: bold; color: #38bdf8; margin-bottom: 2px; display: flex; align-items: center; justify-content: space-between;">
                <span>${cam.camera_name}</span>
                <span style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}66; font-family: monospace;">${cam.status}</span>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">
                ID: <span style="font-family: monospace; color: #cbd5e1;">${cam.camera_id}</span> • Sector: <span style="color: #cbd5e1;">${cam.sector || 'Sector-North'}</span>
              </div>
              <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>GPS Coords:</span>
                <span style="font-family: monospace; color: #34d399; font-weight: bold;">${lat.toFixed(5)}°, ${lng.toFixed(5)}°</span>
              </div>
              <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Ingestion Feed:</span>
                <span style="font-family: monospace; color: #38bdf8;">${cam.stream_type || 'main'} • ${cam.fps || 25} FPS</span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 6px; border-top: 1px solid #1e293b; padding-top: 6px;">
                <button id="btn-inspect-${cam.camera_id}" type="button" style="
                  flex: 1;
                  padding: 6px 8px;
                  background: #0284c7;
                  color: #ffffff;
                  border: none;
                  border-radius: 6px;
                  font-size: 10px;
                  font-family: monospace;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);
                ">
                  📹 LIVE STREAM
                </button>
                <button id="btn-zoom-${cam.camera_id}" type="button" style="
                  padding: 6px 8px;
                  background: #1e293b;
                  color: #38bdf8;
                  border: 1px solid #38bdf866;
                  border-radius: 6px;
                  font-size: 10px;
                  font-family: monospace;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                ">
                  🔍 ZOOM (18x)
                </button>
              </div>
            </div>
          `, { maxWidth: 280 });

          marker.on('popupopen', () => {
            const inspectBtn = document.getElementById(`btn-inspect-${cam.camera_id}`);
            if (inspectBtn) {
              inspectBtn.onclick = (e) => {
                e.stopPropagation();
                handleOpenStream(cam);
              };
            }
            const zoomBtn = document.getElementById(`btn-zoom-${cam.camera_id}`);
            if (zoomBtn) {
              zoomBtn.onclick = (e) => {
                e.stopPropagation();
                handleZoomToCamera(lat, lng);
              };
            }
          });

          if (isSelectedCam) {
            setTimeout(() => {
              try {
                marker.openPopup();
              } catch (_) {}
            }, 300);
          }

          marker.on('click', () => {
            if (onCameraSelect) onCameraSelect(cam);
          });
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
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
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
          <div style="font-family: inherit; min-width: 210px; padding: 2px 0;">
            <div style="color: #ef4444; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 4px;">
              <span>⚠️</span> REAL-TIME INTRUSION ALERT
            </div>
            <div style="font-size: 13px; font-weight: bold; color: #fff; margin-top: 4px;">
              ${evt.object_type?.toUpperCase()} DETECTED
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">
              Camera: <strong style="color: #38bdf8;">${evt.camera_id}</strong><br/>
              Risk Score: <strong style="color: #ef4444;">${evt.risk_score}/100</strong> • Level: <strong style="color: ${threatColor};">${evt.risk_level || (isCritical ? 'CRITICAL' : 'HIGH')}</strong><br/>
              Time: <span style="color: #cbd5e1;">${new Date(evt.started_at).toLocaleTimeString()}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <button id="btn-inspect-threat-${evt.event_id}" type="button" style="
                flex: 1;
                padding: 6px 8px;
                background: #dc2626;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                font-size: 10px;
                font-family: monospace;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4);
              ">
                🚨 INSPECT ALERT
              </button>
              <button id="btn-zoom-threat-${evt.event_id}" type="button" style="
                padding: 6px 8px;
                background: #1e293b;
                color: #f87171;
                border: 1px solid #f8717166;
                border-radius: 6px;
                font-size: 10px;
                font-family: monospace;
                font-weight: bold;
                cursor: pointer;
              ">
                🔍 ZOOM (18x)
              </button>
            </div>
          </div>
        `, { maxWidth: 260 });

        threatMarker.on('popupopen', () => {
          const inspectBtn = document.getElementById(`btn-inspect-threat-${evt.event_id}`);
          if (inspectBtn) {
            inspectBtn.onclick = (e) => {
              e.stopPropagation();
              setInspectedEvent(evt);
            };
          }
          const zoomBtn = document.getElementById(`btn-zoom-threat-${evt.event_id}`);
          if (zoomBtn) {
            zoomBtn.onclick = (e) => {
              e.stopPropagation();
              map.flyTo([lat, lng], 18, { animate: true, duration: 1.0 });
            };
          }
        });

        // Direct touch / click on marker also opens inspection
        threatMarker.on('click', () => {
          setInspectedEvent(evt);
        });

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

  const handleOpenStream = useCallback((cam: Camera) => {
    setInspectedCamera(cam);
    if (onInspectCamera) onInspectCamera(cam);
    if (onCameraSelect) onCameraSelect(cam);
  }, [onInspectCamera, onCameraSelect]);

  const handleZoomToCamera = useCallback((lat: number, lng: number) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
    }
  }, []);

  const handleLiveLocate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setGpsNotice('Acquiring real-time GPS signal...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsNotice(`GPS Signal Locked: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (±${Math.round(accuracy)}m)`);
        setTimeout(() => setGpsNotice(null), 4500);

        const map = mapInstanceRef.current;
        if (!map) return;

        map.flyTo([latitude, longitude], 17, { animate: true, duration: 1.5 });

        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        const userGpsIcon = L.divIcon({
          className: 'custom-user-gps-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #10b981;
                border: 3px solid #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 22px #10b981, 0 0 40px rgba(16, 185, 129, 0.6);
                animation: pulse 1.2s infinite;
              ">
                <span style="color: #fff; font-size: 11px; font-weight: bold;">📍</span>
              </div>
              <div style="
                background: rgba(6, 78, 59, 0.95);
                border: 1px solid #10b981;
                border-radius: 6px;
                padding: 2px 6px;
                margin-top: 4px;
                font-family: monospace;
                font-size: 10px;
                font-weight: bold;
                color: #a7f3d0;
                white-space: nowrap;
                box-shadow: 0 4px 10px rgba(0,0,0,0.6);
              ">
                YOUR LIVE GPS (±${Math.round(accuracy)}m)
              </div>
            </div>
          `,
          iconSize: [140, 50],
          iconAnchor: [70, 12]
        });

        const marker = L.marker([latitude, longitude], { icon: userGpsIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 190px; padding: 4px 0;">
            <div style="font-size: 12px; font-weight: bold; color: #10b981; margin-bottom: 4px;">
              📡 Live Real-Time GPS Position
            </div>
            <div style="font-size: 11px; color: #e2e8f0; margin-bottom: 3px;">
              Latitude: <strong style="color: #34d399; font-family: monospace;">${latitude.toFixed(6)}°</strong>
            </div>
            <div style="font-size: 11px; color: #e2e8f0; margin-bottom: 4px;">
              Longitude: <strong style="color: #34d399; font-family: monospace;">${longitude.toFixed(6)}°</strong>
            </div>
            <div style="font-size: 10px; color: #94a3b8;">
              Device Accuracy: ±${Math.round(accuracy)} meters
            </div>
          </div>
        `);
        marker.addTo(map);
        userMarkerRef.current = marker;
        marker.openPopup();

        if (onLocationFound) {
          onLocationFound(latitude, longitude);
        }
      },
      (err) => {
        setIsLocating(false);
        setGpsNotice(`GPS Error: ${err.message || 'Location unavailable'}`);
        setTimeout(() => setGpsNotice(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onLocationFound]);

  const handleZoomIn = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn(0.5);
  };

  const handleZoomOut = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut(0.5);
  };

  const handlePresetZoom = (targetZoom: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(targetZoom, { animate: true });
  };

  const handlePan = (dx: number, dy: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.panBy([dx, dy], { animate: true, duration: 0.25 });
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
    <div className="relative isolate rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#070b14] z-0" style={{ height }}>
      {/* Map Container Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left Layer Control Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
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
        <button
          type="button"
          onClick={() => switchTileLayer('topo')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
            activeLayer === 'topo'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Topographic
        </button>
      </div>

      {/* GPS Notice Toast */}
      {gpsNotice && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-slate-900/95 border border-emerald-500 text-emerald-300 text-xs font-mono rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <Locate className="w-3.5 h-3.5 text-emerald-400" />
          <span>{gpsNotice}</span>
        </div>
      )}

      {/* Top Right Tactical Zoom Controls, Live GPS Button & Zoom Level Readout */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
        <button
          type="button"
          onClick={handleLiveLocate}
          disabled={isLocating}
          title="Detect My Real-Time GPS Location & Zoom Map"
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
            isLocating
              ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500 animate-pulse'
              : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 shadow-md'
          }`}
        >
          <Locate className={`w-3.5 h-3.5 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'Live GPS'}</span>
        </button>

        {/* Quick Zoom Presets */}
        <div className="hidden md:flex items-center gap-1 border-l border-r border-slate-700/80 px-1.5 mx-0.5">
          {[
            { label: '5x Nat', zoom: 5, desc: 'National Overview' },
            { label: '9x Sec', zoom: 9, desc: 'Sector Level' },
            { label: '13x Base', zoom: 13, desc: 'Base Perimeter' },
            { label: '17x Tac', zoom: 17, desc: 'Tactical Close-Up' }
          ].map((preset) => (
            <button
              key={preset.zoom}
              type="button"
              onClick={() => handlePresetZoom(preset.zoom)}
              title={preset.desc}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition cursor-pointer ${
                Math.round(currentZoomLevel) === preset.zoom
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

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
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
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

      {/* Bottom Left Tactical Directional Pan Navigation D-Pad */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-2xl shadow-2xl select-none">
        <div className="text-[9px] font-mono font-bold text-slate-400 mb-1 tracking-wider uppercase flex items-center gap-1">
          <Compass className="w-3 h-3 text-cyan-400" />
          <span>PAN NAV</span>
        </div>
        <div className="grid grid-cols-3 gap-1 w-24 h-24 place-items-center">
          <div></div>
          <button
            type="button"
            onClick={() => handlePan(0, -120)}
            title="Pan Up (North) [↑]"
            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg transition shadow cursor-pointer active:scale-90"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div></div>

          <button
            type="button"
            onClick={() => handlePan(-120, 0)}
            title="Pan Left (West) [←]"
            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg transition shadow cursor-pointer active:scale-90"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map View"
            className="w-7 h-7 flex items-center justify-center bg-slate-950/80 hover:bg-indigo-600 text-cyan-400 hover:text-white border border-slate-700/80 hover:border-indigo-400 rounded-lg transition shadow cursor-pointer active:scale-90"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handlePan(120, 0)}
            title="Pan Right (East) [→]"
            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg transition shadow cursor-pointer active:scale-90"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div></div>
          <button
            type="button"
            onClick={() => handlePan(0, 120)}
            title="Pan Down (South) [↓]"
            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-lg transition shadow cursor-pointer active:scale-90"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div></div>
        </div>
      </div>

      {/* Touch-to-Inspect Live Camera Video Stream Modal Overlay */}
      {inspectedCamera && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-[#090d16] border border-cyan-500/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-950/80 border border-cyan-500/40 rounded-lg text-cyan-400">
                  <Cctv className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-mono">{inspectedCamera.camera_name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                      inspectedCamera.status === 'ONLINE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                    }`}>
                      {inspectedCamera.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {inspectedCamera.camera_id} • Sector: {inspectedCamera.sector || 'N/A'} • BOP: {inspectedCamera.bop_site || 'N/A'} • GPS: {inspectedCamera.latitude?.toFixed(4)}°, {inspectedCamera.longitude?.toFixed(4)}°
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inspectedCamera.latitude && inspectedCamera.longitude && (
                  <button
                    type="button"
                    onClick={() => {
                      const lat = inspectedCamera.latitude!;
                      const lng = inspectedCamera.longitude!;
                      setInspectedCamera(null);
                      handleZoomToCamera(lat, lng);
                    }}
                    className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom on Map (18x)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedCamera(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Stream Player */}
            <div className="p-4 bg-black flex-1 overflow-hidden flex flex-col justify-center items-center min-h-[380px]">
              <LiveVideoPlayer camera={inspectedCamera} autoPlay showControls={true} />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <span>Stream: <strong className="text-slate-200">{inspectedCamera.stream_type || 'main'}</strong></span>
                <span>•</span>
                <span>FPS: <strong className="text-emerald-400">{inspectedCamera.fps || 25} FPS</strong></span>
                <span>•</span>
                <span>Resolution: <strong className="text-slate-200">{inspectedCamera.resolution || '1080p'}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCamera(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition cursor-pointer"
              >
                Close Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Touch-to-Inspect Real-Time Alert Dossier Modal Overlay */}
      {inspectedEvent && (() => {
        const associatedCam = cameras.find(c => c.camera_id === inspectedEvent.camera_id) || {
          camera_id: inspectedEvent.camera_id,
          camera_name: `Tactical Node ${inspectedEvent.camera_id}`,
          sector: 'Frontier Perimeter',
          status: 'ONLINE' as const,
          rtsp_url: '',
          stream_type: 'main',
          fps: 25,
          resolution: '1080p'
        } as Camera;

        const isCritical = inspectedEvent.risk_level === 'CRITICAL' || inspectedEvent.risk_score >= 80;

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
            <div className="relative w-full max-w-4xl bg-[#090d16] border border-red-500/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
              {/* Alert Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/95 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-950 text-red-400 border border-red-500/40 animate-pulse' : 'bg-amber-950 text-amber-400 border border-amber-500/40'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">
                        TACTICAL THREAT DOSSIER: {inspectedEvent.event_id}
                      </h3>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                        isCritical
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/60 animate-pulse'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                      }`}>
                        {inspectedEvent.risk_level || (isCritical ? 'CRITICAL' : 'HIGH RISK')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Target: <span className="text-white font-bold">{inspectedEvent.object_type?.toUpperCase() || 'UNKNOWN INTRUDER'}</span> • Camera: <span className="text-cyan-300">{inspectedEvent.camera_id}</span> • Time: {new Date(inspectedEvent.started_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {associatedCam.latitude && associatedCam.longitude && (
                    <button
                      type="button"
                      onClick={() => {
                        const lat = associatedCam.latitude!;
                        const lng = associatedCam.longitude!;
                        setInspectedEvent(null);
                        handleZoomToCamera(lat, lng);
                      }}
                      className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" />
                      <span>Zoom Alert (18x)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectedEvent(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Video Stream Player with Threat Overlay */}
              <div className="p-4 bg-black flex-1 overflow-hidden flex flex-col justify-center items-center min-h-[380px] relative">
                <LiveVideoPlayer camera={associatedCam} autoPlay showControls={true} />
                <div className="absolute top-6 left-6 z-10 px-3 py-1 bg-red-950/80 border border-red-500 text-red-300 text-xs font-mono rounded flex items-center gap-1.5 backdrop-blur-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>TARGET LOCK • RISK {inspectedEvent.risk_score}/100</span>
                </div>
              </div>

              {/* Threat Telemetry Breakdown Footer */}
              <div className="px-5 py-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-4">
                  <div>
                    Risk Score: <strong className="text-rose-400 font-bold">{inspectedEvent.risk_score}/100</strong>
                  </div>
                  <span>•</span>
                  <div>
                    Confidence: <strong className="text-emerald-400 font-bold">{Math.round(((inspectedEvent as any).last_bbox?.confidence ?? (inspectedEvent as any).confidence ?? 0.95) * 100)}%</strong>
                  </div>
                  <span>•</span>
                  <div>
                    Status: <strong className="text-amber-300">{inspectedEvent.status || 'VERIFYING'}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const camToInspect = associatedCam;
                      setInspectedEvent(null);
                      setInspectedCamera(camToInspect);
                    }}
                    className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-300 rounded-lg text-xs font-mono transition cursor-pointer"
                  >
                    Switch to Camera Controls
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedEvent(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition cursor-pointer"
                  >
                    Acknowledge & Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
