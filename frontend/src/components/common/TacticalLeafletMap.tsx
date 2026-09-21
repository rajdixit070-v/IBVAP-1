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
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Grid
} from 'lucide-react';
import { Camera } from '../../types/camera';
import { SecurityEvent } from '../../types/event';
import { GISLayer } from '../../services/gisService';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import { Tactical3DTerrainMap } from '../3d/Tactical3DTerrainMap';

export interface TacticalBorderSegment {
  name: string;
  sector: string;
  points: [number, number][];
  pillars?: { name: string; lat: number; lng: number }[];
}

export const TACTICAL_BORDER_SEGMENTS: TacticalBorderSegment[] = [
  {
    name: 'Punjab Frontier (Attari-Wagah / Ravi Zero-Line)',
    sector: 'Punjab Frontier',
    points: [
      [31.5750, 74.5770],
      [31.5880, 74.5755],
      [31.5980, 74.5742],
      [31.6020, 74.5736],
      [31.6048, 74.5731], // Wagah Zero-Line Joint Gate
      [31.6075, 74.5726],
      [31.6150, 74.5705],
      [31.6220, 74.5690],
      [31.6265, 74.5680], // Ravi Riverbed Confluence
      [31.6350, 74.5660],
      [31.6500, 74.5630],
      [31.6700, 74.5600]
    ],
    pillars: [
      { name: 'BP-101/0', lat: 31.5980, lng: 74.5742 },
      { name: 'BP-102/1', lat: 31.6020, lng: 74.5736 },
      { name: 'BP-102/2 (Zero Gate)', lat: 31.6048, lng: 74.5731 },
      { name: 'BP-103/0 (North OP)', lat: 31.6075, lng: 74.5726 },
      { name: 'BP-103/1', lat: 31.6150, lng: 74.5705 },
      { name: 'BP-104/0 (Ravi Creek)', lat: 31.6265, lng: 74.5680 }
    ]
  },
  {
    name: 'Punjab Hussainiwala Sector',
    sector: 'Punjab Frontier',
    points: [
      [31.0800, 74.6050],
      [31.1000, 74.6020],
      [31.1120, 74.6000],
      [31.1300, 74.5980]
    ],
    pillars: [
      { name: 'BP-HW-01', lat: 31.1000, lng: 74.6020 },
      { name: 'BP-HW-02', lat: 31.1120, lng: 74.6000 }
    ]
  },
  {
    name: 'Jammu Frontier (Samba - Suchetgarh - Uri)',
    sector: 'Jammu Frontier',
    points: [
      [32.5000, 75.2000],
      [32.5560, 75.1180],
      [32.6100, 74.7500],
      [32.8000, 74.5000],
      [33.5000, 74.2000],
      [34.0850, 74.0300]
    ],
    pillars: [
      { name: 'BP-JAMMU-01', lat: 32.5560, lng: 75.1180 },
      { name: 'BP-SUCHET-01', lat: 32.6100, lng: 74.7500 },
      { name: 'BP-URI-LOC', lat: 34.0850, lng: 74.0300 }
    ]
  },
  {
    name: 'Rajasthan Frontier (Tanot - Longewala - Munabao)',
    sector: 'Rajasthan Frontier',
    points: [
      [25.7200, 70.2400],
      [26.3000, 70.2800],
      [27.0500, 70.3000],
      [27.8000, 70.3500],
      [28.5000, 71.2000]
    ],
    pillars: [
      { name: 'BP-RAJ-609', lat: 27.0500, lng: 70.3000 },
      { name: 'BP-TANOT-01', lat: 27.8000, lng: 70.3500 },
      { name: 'BP-MUNABAO-01', lat: 25.7200, lng: 70.2400 }
    ]
  },
  {
    name: 'Gujarat Frontier (Sir Creek & Kutch)',
    sector: 'Gujarat Frontier',
    points: [
      [23.6500, 68.3500],
      [23.7500, 68.5000],
      [23.8200, 68.7800],
      [24.1000, 69.5000]
    ],
    pillars: [
      { name: 'BP-CREEK-01', lat: 23.6500, lng: 68.3500 },
      { name: 'BP-LAKHPAT-01', lat: 23.8200, lng: 68.7800 }
    ]
  },
  {
    name: 'Ladakh High Altitude Frontier',
    sector: 'Ladakh Frontier',
    points: [
      [33.7500, 78.6500],
      [34.2000, 78.4500],
      [34.7800, 78.2500],
      [35.3200, 77.9200]
    ],
    pillars: [
      { name: 'POST-PANGONG', lat: 33.7500, lng: 78.6500 },
      { name: 'POST-GALWAN', lat: 34.7800, lng: 78.2500 },
      { name: 'POST-DBO', lat: 35.3200, lng: 77.9200 }
    ]
  }
];

interface TacticalLeafletMapProps {
  cameras: Camera[];
  events?: SecurityEvent[];
  alerts?: any[];
  blindSpots?: any[];
  sites?: any[];
  bops?: any[];
  layers?: GISLayer[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedCameraId?: string;
  targetCoords?: [number, number] | null;
  initialLayer?: TileLayerType;
  onCameraSelect?: (camera: Camera) => void;
  onBopSelect?: (bop: any) => void;
  onInspectCamera?: (camera: Camera) => void;
  onLocationFound?: (lat: number, lng: number) => void;
  viewDimension?: '2d' | '3d';
  onDimensionChange?: (dim: '2d' | '3d') => void;
}

type TileLayerType = 'dark' | 'satellite' | 'streets' | 'topo';

export const TacticalLeafletMap: React.FC<TacticalLeafletMapProps> = ({
  cameras,
  events = [],
  alerts = [],
  blindSpots = [],
  sites: _sites = [],
  bops = [],
  layers: _layers = [],
  center = [31.6048, 74.5731],
  zoom = 13,
  height = '500px',
  selectedCameraId,
  targetCoords = null,
  initialLayer = 'satellite',
  viewDimension = '3d',
  onCameraSelect,
  onBopSelect,
  onInspectCamera,
  onLocationFound,
  onDimensionChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeDimension, setActiveDimension] = useState<'2d' | '3d'>(viewDimension || '3d');
  useEffect(() => {
    if (viewDimension) setActiveDimension(viewDimension);
  }, [viewDimension]);

  const handleSetDimension = useCallback((dim: '2d' | '3d') => {
    setActiveDimension(dim);
    onDimensionChange?.(dim);
  }, [onDimensionChange]);


  const [activeLayer, setActiveLayer] = useState<TileLayerType>(initialLayer || 'satellite');
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(zoom);
  const coordDisplayRef = useRef<HTMLSpanElement | null>(null);

  // Layer Visibility Toggles
  const [showBorderLayer, setShowBorderLayer] = useState<boolean>(true);
  const [showBopsLayer, setShowBopsLayer] = useState<boolean>(true);
  const [showCamerasLayer, setShowCamerasLayer] = useState<boolean>(true);
  const [showCoverageLayer, setShowCoverageLayer] = useState<boolean>(true);
  const [showThreatsLayer, setShowThreatsLayer] = useState<boolean>(true);
  const [showNodesGridLayer, setShowNodesGridLayer] = useState<boolean>(true);

  // Live Camera Stream Inspection State
  const [inspectedCamera, setInspectedCamera] = useState<Camera | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const hasInitialFitRef = useRef<boolean>(false);
  const lastValidCoordsRef = useRef<[number, number][]>([]);
  const prevCenterRef = useRef<[number, number]>(center);
  const prevZoomRef = useRef<number>(zoom);

  const tileUrls: Record<TileLayerType, { 
    base: string; 
    fallback?: string;
    labels?: string; 
    attribution: string;
    maxNativeZoom: number;
    maxZoom: number;
    subdomains?: string[] | string;
    fallbackSubdomains?: string[] | string;
  }> = {
    satellite: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      fallback: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; Esri &mdash; High-Resolution Satellite & Aerial Imagery',
      maxNativeZoom: 19,
      maxZoom: 22
    },
    topo: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      fallback: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; Esri &mdash; World Topographic Terrain Elevation',
      maxNativeZoom: 19,
      maxZoom: 22
    },
    streets: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      fallback: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; Esri &mdash; Tactical Road & Navigation GIS',
      maxNativeZoom: 19,
      maxZoom: 22
    },
    dark: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      fallback: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; Esri &mdash; Tactical Dark Canvas',
      maxNativeZoom: 16,
      maxZoom: 22
    }
  };

  const createTileLayerInstance = (layerType: TileLayerType): L.TileLayer => {
    const cfg = tileUrls[layerType];
    const tile = L.tileLayer(cfg.base, {
      minZoom: 3,
      maxZoom: 22,
      maxNativeZoom: cfg.maxNativeZoom,
      subdomains: cfg.subdomains || 'abc',
      attribution: cfg.attribution,
      crossOrigin: true,
      keepBuffer: 8,
      updateWhenZooming: true,
      updateWhenIdle: false
    });

    if (cfg.fallback) {
      tile.on('tileerror', (e: any) => {
        const img = e.tile as HTMLImageElement | undefined;
        if (img && !img.dataset.hasRetriedFallback && cfg.fallback) {
          img.dataset.hasRetriedFallback = '1';
          const coords = e.coords;
          if (coords) {
            const subs = cfg.fallbackSubdomains || ['a', 'b', 'c'];
            const sub = Array.isArray(subs) ? subs[Math.abs((coords.x + coords.y) % subs.length)] : subs;
            img.src = cfg.fallback
              .replace('{s}', String(sub))
              .replace('{z}', String(coords.z))
              .replace('{x}', String(coords.x))
              .replace('{y}', String(coords.y))
              .replace('{r}', '');
          }
        }
      });
    }

    return tile;
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Cleanse any existing Leaflet marker/cache on the container DOM element
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }
    mapContainerRef.current.innerHTML = '';

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      minZoom: 3,
      maxZoom: 22,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 100,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      closePopupOnClick: false
    });

    const cfg = tileUrls[activeLayer];
    const initialTile = createTileLayerInstance(activeLayer);
    initialTile.addTo(map);
    tileLayerRef.current = initialTile;

    if (cfg.labels) {
      const labelsTile = L.tileLayer(cfg.labels, {
        minZoom: 3,
        maxZoom: 22,
        maxNativeZoom: cfg.maxNativeZoom,
        subdomains: cfg.subdomains || 'abc',
        crossOrigin: true
      }).addTo(map);
      labelsLayerRef.current = labelsTile;
    }

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    map.on('zoomend', () => {
      setCurrentZoomLevel(Math.round(map.getZoom() * 10) / 10);
    });
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (coordDisplayRef.current) {
        coordDisplayRef.current.textContent = `📍 ${e.latlng.lat.toFixed(4)}°N, ${e.latlng.lng.toFixed(4)}°E`;
      }
    });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        delete (mapContainerRef.current as any)._leaflet_id;
        mapContainerRef.current.innerHTML = '';
      }
    };
  }, []);

  // When switching from 3D back to 2D, restore Leaflet container and invalidate size
  useEffect(() => {
    if (activeDimension === '2d' && mapInstanceRef.current && mapContainerRef.current) {
      const map = mapInstanceRef.current;
      const container = mapContainerRef.current;

      // Ensure leaflet-container class is always attached
      if (!container.classList.contains('leaflet-container')) {
        container.classList.add('leaflet-container');
      }

      const restore2DView = () => {
        if (!mapInstanceRef.current) return;
        (map as any)._sizeChanged = true;
        map.invalidateSize({ pan: false });
        const curCenter = map.getCenter() || center;
        const curZoom = map.getZoom() || zoom;
        map.setView(curCenter, curZoom, { animate: false });
      };

      // 1. Immediate call
      restore2DView();

      // 2. Next animation frame
      const raf = requestAnimationFrame(restore2DView);

      // 3. Settled timeouts
      const t1 = setTimeout(restore2DView, 80);
      const t2 = setTimeout(restore2DView, 250);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeDimension, center, zoom]);

  // High-performance tactical jump helper: 0-latency setView for distant targets (>0.25 deg), snappy pan (0.3s) for local targets
  const executeTacticalJump = useCallback((dest: [number, number], targetZoom: number = 16, forceInstant: boolean = false) => {
    const map = mapInstanceRef.current;
    if (!map || !dest || !dest[0] || !dest[1]) return;

    let curLat = dest[0];
    let curLng = dest[1];
    try {
      const live = map.getCenter();
      if (live) {
        curLat = live.lat;
        curLng = live.lng;
      }
    } catch (_) {}

    const dist = Math.hypot(curLat - dest[0], curLng - dest[1]);
    prevCenterRef.current = dest;
    prevZoomRef.current = targetZoom;

    if (forceInstant || dist > 0.25) {
      map.setView(dest, targetZoom, { animate: false });
    } else {
      map.panTo(dest, { animate: true, duration: 0.3 });
    }
  }, []);

  // Unified Tactical Teleportation & Jump Engine (ZERO conflicting animations, instantaneous response)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Prioritize targetCoords if set, otherwise center
    const dest: [number, number] | null = targetCoords || center;
    if (!dest || !dest[0] || !dest[1]) return;

    const targetZoom = targetCoords ? Math.max(map.getZoom?.() || 15, 16) : (zoom || 14);

    let curLat = dest[0];
    let curLng = dest[1];
    try {
      const liveCenter = map.getCenter();
      if (liveCenter) {
        curLat = liveCenter.lat;
        curLng = liveCenter.lng;
      }
    } catch (_) {}

    const latDiff = Math.abs(curLat - dest[0]);
    const lngDiff = Math.abs(curLng - dest[1]);
    const curZoom = map.getZoom?.() ?? prevZoomRef.current ?? targetZoom;
    const zoomDiff = Math.abs(curZoom - targetZoom);

    if (latDiff > 0.0001 || lngDiff > 0.0001 || zoomDiff > 0.1) {
      prevCenterRef.current = dest;
      prevZoomRef.current = targetZoom;

      const dist = Math.hypot(latDiff, lngDiff);
      // If jumping across sectors (> 0.25° or ~25km): INSTANT ZERO-LATENCY TELEPORT
      // No cosmic zoom out, no tile churn, no lag!
      if (dist > 0.25) {
        map.setView(dest, targetZoom, { animate: false });
      } else {
        map.panTo(dest, { animate: true, duration: 0.3 });
      }
    }
  }, [center[0], center[1], zoom, targetCoords?.[0], targetCoords?.[1]]);

  // Tile Layer Switcher
  const switchTileLayer = (layerType: TileLayerType) => {
    if (!mapInstanceRef.current) return;
    setActiveLayer(layerType);

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      mapInstanceRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    const cfg = tileUrls[layerType];
    const newTile = createTileLayerInstance(layerType);
    newTile.addTo(mapInstanceRef.current);
    newTile.bringToBack();
    tileLayerRef.current = newTile;

    if (cfg.labels) {
      const newLabels = L.tileLayer(cfg.labels, {
        minZoom: 3,
        maxZoom: 22,
        maxNativeZoom: cfg.maxNativeZoom,
        subdomains: cfg.subdomains || 'abc',
        crossOrigin: true
      }).addTo(mapInstanceRef.current);
      labelsLayerRef.current = newLabels;
    }
  };

  const handleOpenStream = useCallback((cam: Camera) => {
    setInspectedCamera(cam);
    if (onInspectCamera) onInspectCamera(cam);
    if (onCameraSelect) onCameraSelect(cam);
  }, [onInspectCamera, onCameraSelect]);

  // Map Rendering Pipeline: Border Fence, Pillars, Target Point, BOPs, Cameras, Hazards
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const validCoords: [number, number][] = [];

    // Pre-aggregate threats by camera_id and bop_site
    const cameraAlertsMap = new Map<string, any[]>();
    const bopAlertsMap = new Map<string, any[]>();
    alerts.forEach((alt: any) => {
      if (alt.status === 'RESOLVED') return;
      if (alt.camera_id) {
        const k = alt.camera_id.toLowerCase();
        const list = cameraAlertsMap.get(k) || [];
        list.push(alt);
        cameraAlertsMap.set(k, list);
      }
      if (alt.bop_site) {
        const k = alt.bop_site.toLowerCase();
        const list = bopAlertsMap.get(k) || [];
        list.push(alt);
        bopAlertsMap.set(k, list);
      }
    });

    // 1. Render International Border Zero-Line Fences & Border Pillars
    if (showBorderLayer) {
      TACTICAL_BORDER_SEGMENTS.forEach((segment) => {
        // Glowing Red Underline Halo
        L.polyline(segment.points, {
          color: '#ef4444',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round'
        }).addTo(group);

        // Core Amber Border Fence Line
        const borderLine = L.polyline(segment.points, {
          color: '#f59e0b',
          weight: 3.5,
          opacity: 0.95,
          dashArray: '8, 6'
        }).addTo(group);

        borderLine.bindTooltip(`
          <div style="font-family: monospace; font-size: 11px; font-weight: bold; color: #f59e0b;">
            🛡️ INTERNATIONAL BORDER ZERO-LINE<br/>
            <span style="color: #e2e8f0; font-size: 10px;">${segment.name}</span>
          </div>
        `, { sticky: true });

        // Tactical Border Pillars
        if (segment.pillars) {
          segment.pillars.forEach((pillar) => {
            const pillarIcon = L.divIcon({
              className: 'tactical-border-pillar',
              html: `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 3px;
                  background: rgba(15, 23, 42, 0.92);
                  border: 1px solid #f59e0b;
                  border-radius: 4px;
                  padding: 1px 5px;
                  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
                  white-space: nowrap;
                  font-family: monospace;
                  font-size: 9px;
                  font-weight: bold;
                  color: #fbbf24;
                  cursor: pointer;
                ">
                  <span>🚩</span>
                  <span>${pillar.name}</span>
                </div>
              `,
              iconSize: [90, 20],
              iconAnchor: [45, 10]
            });

            const pMarker = L.marker([pillar.lat, pillar.lng], { icon: pillarIcon, zIndexOffset: 90 });
            pMarker.bindPopup(`
              <div style="font-family: monospace; font-size: 11px; padding: 4px;">
                <strong style="color: #f59e0b; font-size: 12px;">🚩 BORDER PILLAR: ${pillar.name}</strong><br/>
                Sector: <strong>${segment.sector}</strong><br/>
                Coordinates: <strong>${pillar.lat.toFixed(5)}°N, ${pillar.lng.toFixed(5)}°E</strong><br/>
                Zero-Line Wire: <span style="color: #10b981; font-weight: bold;">MONITORED BOUNDARY FENCE</span>
              </div>
            `);
            pMarker.on('mouseover', () => pMarker.openPopup());
            pMarker.on('mouseout', () => pMarker.closePopup());
            pMarker.on('click', () => {
              executeTacticalJump([pillar.lat, pillar.lng], 17);
            });
            pMarker.addTo(group);
          });
        }
      });

      // If targetCoords is provided and not near predefined border, generate a localized boundary corridor
      if (targetCoords) {
        const isNearPreset = TACTICAL_BORDER_SEGMENTS.some(seg =>
          seg.points.some(pt => Math.hypot(pt[0] - targetCoords[0], pt[1] - targetCoords[1]) < 0.5)
        );
        if (!isNearPreset) {
          const d = 0.03;
          const localBorderPoints: [number, number][] = [
            [targetCoords[0] - d, targetCoords[1] + 0.001],
            [targetCoords[0], targetCoords[1]],
            [targetCoords[0] + d, targetCoords[1] - 0.001]
          ];
          L.polyline(localBorderPoints, {
            color: '#ef4444',
            weight: 7,
            opacity: 0.35,
            lineCap: 'round'
          }).addTo(group);

          const localLine = L.polyline(localBorderPoints, {
            color: '#f59e0b',
            weight: 3.5,
            opacity: 0.95,
            dashArray: '8, 6'
          }).addTo(group);

          localLine.bindTooltip(`
            <div style="font-family: monospace; font-size: 11px; font-weight: bold; color: #f59e0b;">
              🛡️ LOCAL SECTOR ZERO-LINE BOUNDARY<br/>
              <span style="color: #e2e8f0; font-size: 10px;">Target Inspection Sector</span>
            </div>
          `, { sticky: true });
        }
      }
    }

    // 2. Render Tactical Jump Target Pin if set
    if (targetCoords) {
      const targetIcon = L.divIcon({
        className: 'tactical-target-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 50%;
              border: 2px dashed #38bdf8;
              background: rgba(56, 189, 248, 0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 16px #38bdf8;
            ">
              <span style="font-size: 18px;">🎯</span>
            </div>
            <div style="
              margin-top: 2px;
              padding: 2px 6px;
              border-radius: 4px;
              background: rgba(15, 23, 42, 0.95);
              border: 1px solid #38bdf8;
              color: #38bdf8;
              font-family: monospace;
              font-size: 9px;
              font-weight: 800;
              white-space: nowrap;
            ">
              TARGET: ${targetCoords[0].toFixed(4)}°, ${targetCoords[1].toFixed(4)}°
            </div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 25]
      });

      const tMarker = L.marker(targetCoords, { icon: targetIcon, zIndexOffset: 500 }).addTo(group);
      tMarker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px; padding: 4px;">
          <strong style="color: #38bdf8; font-size: 12px;">🎯 TACTICAL JUMP TARGET POINT</strong><br/>
          Latitude: <strong>${targetCoords[0].toFixed(5)}° N</strong><br/>
          Longitude: <strong>${targetCoords[1].toFixed(5)}° E</strong><br/>
          Status: <span style="color: #34d399; font-weight: bold;">COORDINATES ACQUIRED</span><br/>
          <div style="margin-top: 6px; font-size: 10px; color: #94a3b8;">
            Zero-line boundary fence and surveillance sensors locked.
          </div>
        </div>
      `);
      tMarker.on('mouseover', () => tMarker.openPopup());
      tMarker.on('mouseout', () => tMarker.closePopup());
      tMarker.on('click', () => {
        executeTacticalJump(targetCoords, 17);
      });
    }

    // 3. Render Blind Spots (Red Hatched Polygons)
    if (blindSpots && blindSpots.length > 0) {
      blindSpots.forEach((spot: any) => {
        try {
          if (!spot.polygon_geojson) return;
          const parsed = JSON.parse(spot.polygon_geojson);
          let rawCoords = [];
          if (parsed.type === 'Polygon') {
            rawCoords = parsed.coordinates[0];
          } else if (parsed.coordinates) {
            rawCoords = parsed.coordinates[0] || parsed.coordinates;
          }
          if (rawCoords && rawCoords.length > 0) {
            const latLngs: [number, number][] = rawCoords.map((c: any) => [c[1], c[0]]);
            const poly = L.polygon(latLngs, {
              color: spot.risk_level === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillColor: spot.risk_level === 'CRITICAL' ? '#dc2626' : '#d97706',
              fillOpacity: 0.35,
              weight: 2,
              dashArray: '5, 5'
            }).addTo(group);

            poly.bindPopup(`
              <div style="font-family: monospace; font-size: 11px; padding: 4px;">
                <div style="color: #ef4444; font-weight: bold; font-size: 12px;">⚠️ VULNERABILITY BLIND SPOT</div>
                <div>ID: <strong>${spot.blind_spot_id}</strong></div>
                <div>Risk: <strong style="color: ${spot.risk_level === 'CRITICAL' ? '#f87171' : '#fbbf24'};">${spot.risk_level} (${spot.risk_score}/100)</strong></div>
                <div>Terrain: <strong>${spot.terrain_factor}</strong></div>
                <div>Border Distance: <strong>${spot.proximity_to_border_m}m</strong></div>
              </div>
            `);
            poly.on('mouseover', (e: any) => poly.openPopup(e.latlng));
            poly.on('mouseout', () => poly.closePopup());
            poly.on('click', (e: any) => {
              executeTacticalJump([e.latlng.lat, e.latlng.lng], 16);
            });
          }
        } catch (_) {}
      });
    }

    // 4. Group cameras by parent BOP with robust resilient matching
    const bopLocationMap = new Map<string, { lat: number; lng: number; bop: any }>();
    bops.forEach(b => {
      if (b.latitude && b.longitude) {
        if (b.bop_id) bopLocationMap.set(String(b.bop_id).toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
        if (b.id) bopLocationMap.set(String(b.id).toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
        if (b.name) bopLocationMap.set(String(b.name).toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
        if (b.code) bopLocationMap.set(String(b.code).toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
      }
    });

    const findBopForCamera = (cam: Camera) => {
      const bopKey = (cam.bop_site || (cam as any).bop_id || '').toLowerCase().trim();
      if (bopKey && bopLocationMap.has(bopKey)) {
        return bopLocationMap.get(bopKey);
      }
      if (bopKey) {
        for (const [k, v] of bopLocationMap.entries()) {
          if (bopKey.includes(k) || k.includes(bopKey)) {
            return v;
          }
        }
      }
      // If only 1 BOP is passed (Commander Scope Mode), automatically associate camera with this assigned BOP
      if (bops.length === 1 && bops[0].latitude && bops[0].longitude) {
        return { lat: bops[0].latitude, lng: bops[0].longitude, bop: bops[0] };
      }
      // Proximity check: if camera has lat/lng close to any BOP
      if (cam.latitude && cam.longitude) {
        for (const b of bops) {
          if (b.latitude && b.longitude) {
            const dist = Math.hypot(cam.latitude - b.latitude, cam.longitude - b.longitude);
            if (dist < 0.08) {
              return { lat: b.latitude, lng: b.longitude, bop: b };
            }
          }
        }
      }
      return undefined;
    };

    const bopCameraBuckets = new Map<string, Camera[]>();
    cameras.forEach(cam => {
      const bopInfo = findBopForCamera(cam);
      const bopKey = bopInfo ? String(bopInfo.bop.bop_id || bopInfo.bop.id || bopInfo.bop.name).toLowerCase() : (cam.bop_site || '').toLowerCase();
      const bucket = bopCameraBuckets.get(bopKey) || [];
      bucket.push(cam);
      bopCameraBuckets.set(bopKey, bucket);
    });

    // 5. Render BOPs
    if (showBopsLayer) {
      bops.forEach((bop) => {
        if (!bop.latitude || !bop.longitude) return;
        const bLat = bop.latitude;
        const bLng = bop.longitude;
        validCoords.push([bLat, bLng]);

        const bopThreats = bopAlertsMap.get(String(bop.name || '').toLowerCase()) || bopAlertsMap.get(String(bop.bop_id || '').toLowerCase()) || [];
        const hasThreat = bopThreats.length > 0;
        const bopKeys = [
          String(bop.bop_id || '').toLowerCase(),
          String(bop.id || '').toLowerCase(),
          String(bop.name || '').toLowerCase(),
          String(bop.code || '').toLowerCase()
        ].filter(Boolean);

        const connectedCams = cameras.filter(cam => {
          const camBop = String(cam.bop_site || (cam as any).bop_id || '').toLowerCase();
          if (bopKeys.some(k => camBop.includes(k) || k.includes(camBop))) return true;
          if (bops.length === 1) return true;
          if (cam.latitude && cam.longitude && bLat && bLng) {
            return Math.abs(cam.latitude - bLat) < 0.05 && Math.abs(cam.longitude - bLng) < 0.05;
          }
          return false;
        });

        if (hasThreat && showThreatsLayer) {
          const radarRing = L.circle([bLat, bLng], {
            radius: 400,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.18,
            weight: 2,
            dashArray: '4, 4'
          });
          radarRing.addTo(group);
        }

        const bopIcon = L.divIcon({
          className: 'tactical-bop-pin',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              gap: 5px;
              background: rgba(10, 16, 28, 0.95);
              border: 2px solid ${hasThreat ? '#ef4444' : '#10b981'};
              border-radius: 10px;
              padding: 4px 8px;
              box-shadow: 0 4px 14px ${hasThreat ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.4)'};
              cursor: pointer;
              user-select: none;
              white-space: nowrap;
            ">
              <span style="font-size: 13px;">${hasThreat ? '🚨' : '🛡️'}</span>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; font-weight: 800; font-family: monospace; color: ${hasThreat ? '#fca5a5' : '#a7f3d0'};">
                  ${bop.name}
                </span>
                <span style="font-size: 8px; font-family: monospace; color: #94a3b8;">
                  ${connectedCams.length} Cams • ${bop.operational_priority || 'NORMAL'}
                </span>
              </div>
            </div>
          `,
          iconSize: [120, 32],
          iconAnchor: [60, 16]
        });

        const bMarker = L.marker([bLat, bLng], { icon: bopIcon, zIndexOffset: 100 });
        bMarker.bindPopup(`
          <div style="font-family: inherit; min-width: 230px; padding: 6px 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-b: 1px solid #1e293b; padding-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: ${hasThreat ? '#ef4444' : '#34d399'};">
                <span>${hasThreat ? '🚨' : '🛡️'}</span>
                <span>${bop.name}</span>
              </div>
              <span style="font-size: 9px; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: ${bop.status === 'ACTIVE' ? '#065f46' : '#7f1d1d'}; color: #fff;">
                ${bop.status}
              </span>
            </div>

            <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin: 8px 0; line-height: 1.6;">
              <div>Sector: <strong style="color: #38bdf8;">${bop.location || bop.site_id || 'Frontier Sector'}</strong></div>
              <div>Live GPS: <strong style="color: #34d399;">${bLat.toFixed(4)}° N, ${bLng.toFixed(4)}° E</strong></div>
              <div>Surveillance Fleet: <strong style="color: #a5b4fc;">${connectedCams.length} Attached Sensors</strong></div>
            </div>
          </div>
        `);

        bMarker.on('mouseover', () => bMarker.openPopup());
        bMarker.on('mouseout', () => bMarker.closePopup());
        bMarker.on('click', () => {
          executeTacticalJump([bLat, bLng], 16);
          if (onBopSelect) onBopSelect(bop);
        });

        bMarker.addTo(group);
      });
    }

    // 6. Render Cameras
    if (showCamerasLayer) {
      const bopCameraOffsetIndex = new Map<string, number>();

      cameras.forEach((cam) => {
        const parentBopInfo = findBopForCamera(cam);
        const bopKey = parentBopInfo ? String(parentBopInfo.bop.bop_id || parentBopInfo.bop.id || parentBopInfo.bop.name).toLowerCase() : String(cam.bop_site || '').toLowerCase();

        let finalLat: number = cam.latitude ?? center[0];
        let finalLng: number = cam.longitude ?? center[1];

        if (parentBopInfo) {
          const siblings = bopCameraBuckets.get(bopKey) || [cam];
          const sibCount = siblings.length;
          const curIndex = bopCameraOffsetIndex.get(bopKey) || 0;
          bopCameraOffsetIndex.set(bopKey, curIndex + 1);

          const angle = (2 * Math.PI * curIndex) / Math.max(1, sibCount) - Math.PI / 2;
          const radialDistanceDeg = 0.0035;
          const offsetLat = radialDistanceDeg * Math.cos(angle);
          const offsetLng = (radialDistanceDeg / Math.cos((parentBopInfo.lat * Math.PI) / 180)) * Math.sin(angle);

          finalLat = parentBopInfo.lat + offsetLat;
          finalLng = parentBopInfo.lng + offsetLng;

          const leaderLine = L.polyline(
            [[parentBopInfo.lat, parentBopInfo.lng], [finalLat, finalLng]],
            {
              color: '#0284c7',
              weight: 1.5,
              opacity: 0.65,
              dashArray: '3, 4'
            }
          );
          leaderLine.addTo(group);
        }

        validCoords.push([finalLat, finalLng]);

        const isSelectedCam = cam.camera_id === selectedCameraId;
        const isOnline = cam.status === 'HEALTHY' || cam.status === 'ONLINE';
        const camThreats = cameraAlertsMap.get(cam.camera_id.toLowerCase()) || [];
        const hasThreat = camThreats.length > 0;
        const statusColor = hasThreat ? '#ef4444' : isOnline ? '#06b6d4' : '#f59e0b';

        // FOV Projection Cone
        if (showCoverageLayer) {
          const azimuth = 45;
          const rangeMeters = 200;
          const earthRadius = 6378137;
          const dLat = (rangeMeters / earthRadius) * (180 / Math.PI);
          const dLng = (rangeMeters / (earthRadius * Math.cos((Math.PI * finalLat) / 180))) * (180 / Math.PI);
          const rad1 = ((azimuth - 30) * Math.PI) / 180;
          const rad2 = ((azimuth + 30) * Math.PI) / 180;

          const fov = L.polygon(
            [
              [finalLat, finalLng],
              [finalLat + dLat * Math.cos(rad1), finalLng + dLng * Math.sin(rad1)],
              [finalLat + dLat * Math.cos(rad2), finalLng + dLng * Math.sin(rad2)]
            ],
            {
              color: statusColor,
              weight: 1.5,
              fillColor: statusColor,
              fillOpacity: 0.25,
              dashArray: isOnline ? undefined : '4, 4'
            }
          );
          fov.addTo(group);
        }

        // Camera Pin
        const cameraIcon = L.divIcon({
          className: 'tactical-camera-pin',
          html: `
            <div style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              transform: ${isSelectedCam ? 'scale(1.25)' : 'scale(1)'};
              transition: transform 0.2s ease;
            ">
              <div style="
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #090d16;
                border: 2px solid ${isSelectedCam ? '#38bdf8' : statusColor};
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 ${hasThreat ? '14px #ef4444' : isSelectedCam ? '14px #38bdf8' : '6px rgba(0,0,0,0.8)'};
              ">
                <span style="font-size: 13px;">${hasThreat ? '🚨' : '📹'}</span>
              </div>
              <div style="
                margin-top: 2px;
                padding: 1px 4px;
                border-radius: 4px;
                background: rgba(9, 13, 22, 0.95);
                border: 1px solid ${statusColor}88;
                color: ${hasThreat ? '#fca5a5' : '#e0f2fe'};
                font-family: monospace;
                font-size: 8px;
                font-weight: 700;
                white-space: nowrap;
              ">
                ${cam.camera_id}
              </div>
            </div>
          `,
          iconSize: [36, 44],
          iconAnchor: [18, 22]
        });

        const camMarker = L.marker([finalLat, finalLng], { icon: cameraIcon, zIndexOffset: 200 });
        camMarker.bindPopup(`
          <div style="font-family: inherit; min-width: 240px; padding: 6px 2px;">
            <div style="display: flex; items-center; justify-content: space-between; border-b: 1px solid #1e293b; padding-bottom: 6px;">
              <div>
                <div style="font-size: 12px; font-weight: 800; color: #38bdf8;">${cam.camera_name}</div>
                <div style="font-size: 9px; font-family: monospace; color: #94a3b8;">${cam.camera_id}</div>
              </div>
              <span style="font-size: 9px; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: ${hasThreat ? '#7f1d1d' : isOnline ? '#065f46' : '#78350f'}; color: #fff;">
                ${hasThreat ? '🚨 THREAT' : cam.status}
              </span>
            </div>

            <div style="font-size: 10px; font-family: monospace; color: #cbd5e1; margin: 8px 0; line-height: 1.6;">
              <div>Outpost: <strong style="color: #34d399;">${cam.bop_site || 'Border Post'}</strong></div>
              <div>GPS: <strong style="color: #38bdf8;">${finalLat.toFixed(5)}° N, ${finalLng.toFixed(5)}° E</strong></div>
              <div>Stream: <span style="color: #e2e8f0;">${cam.stream_type || 'main'} • ${cam.fps || 25} FPS</span></div>
            </div>

            <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 8px;">
              <button id="btn-stream-${cam.camera_id}" type="button" style="
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
              ">
                📹 LIVE STREAM
              </button>
            </div>
          </div>
        `, {
          maxWidth: 290,
          closeOnClick: false,
          autoClose: true,
          closeButton: true,
          className: 'tactical-hud-popup'
        });

        camMarker.on('popupopen', () => {
          const streamBtn = document.getElementById(`btn-stream-${cam.camera_id}`);
          if (streamBtn) {
            streamBtn.onclick = (e) => {
              e.stopPropagation();
              handleOpenStream(cam);
            };
          }
        });

        camMarker.on('mouseover', () => camMarker.openPopup());
        camMarker.on('mouseout', () => camMarker.closePopup());
        camMarker.on('click', () => {
          executeTacticalJump([finalLat, finalLng], 17);
          if (onCameraSelect) onCameraSelect(cam);
        });

        camMarker.addTo(group);
      });
    }

    
    // 7. Render Real-Time Alert & Threat Zero-Point Markers with Instant Fly-To
    if (showThreatsLayer) {
      const renderedThreatIds = new Set<string>();
      const allThreats = [...alerts, ...(events || [])];

      allThreats.forEach((th: any) => {
        const tid = th.alert_id || th.event_id || th.id;
        if (!tid || renderedThreatIds.has(tid) || th.status === 'RESOLVED') return;
        renderedThreatIds.add(tid);

        let thLat = th.latitude;
        let thLng = th.longitude;

        if (!thLat || !thLng) {
          if (th.camera_id) {
            const linkedCam = cameras.find((c: Camera) => c.camera_id.toLowerCase() === th.camera_id.toLowerCase());
            if (linkedCam?.latitude && linkedCam?.longitude) {
              thLat = linkedCam.latitude + 0.0006;
              thLng = linkedCam.longitude + 0.0006;
            }
          }
          if (!thLat && th.bop_site) {
            const linkedBop = bops.find((b: any) => (b.bop_id && b.bop_id.toLowerCase() === th.bop_site.toLowerCase()) || (b.name && b.name.toLowerCase() === th.bop_site.toLowerCase()));
            if (linkedBop?.latitude && linkedBop?.longitude) {
              thLat = linkedBop.latitude + 0.0009;
              thLng = linkedBop.longitude + 0.0009;
            }
          }
        }

        if (!thLat || !thLng) return;
        validCoords.push([thLat, thLng]);

        const isCritical = th.severity === 'CRITICAL' || th.priority === 'CRITICAL';
        const alertIcon = L.divIcon({
          className: 'tactical-threat-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                width: 32px; height: 32px; border-radius: 50%;
                background: #7f1d1d; border: 2px solid ${isCritical ? '#ef4444' : '#f59e0b'};
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 16px ${isCritical ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.7)'};
              ">
                <span style="font-size: 15px;">🚨</span>
              </div>
              <div style="
                margin-top: 2px; padding: 1px 5px; border-radius: 4px;
                background: rgba(15, 23, 42, 0.95); border: 1px solid #ef4444;
                color: #fca5a5; font-family: monospace; font-size: 8px; font-weight: 800;
                white-space: nowrap;
              ">
                ${th.title || th.event_type || 'ALERT'}
              </div>
            </div>
          `,
          iconSize: [80, 48],
          iconAnchor: [40, 24]
        });

        const thMarker = L.marker([thLat, thLng], { icon: alertIcon, zIndexOffset: 450 });
        thMarker.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; padding: 6px 2px; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 6px;">
              <strong style="color: #ef4444; font-size: 12px;">🚨 INTRUSION / ALERT</strong>
              <span style="background: #991b1b; color: white; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: bold;">
                ${th.severity || th.priority || 'HIGH'}
              </span>
            </div>
            <div>ID: <strong style="color: #38bdf8;">${tid}</strong></div>
            <div>Type: <strong>${th.title || th.event_type || 'Perimeter Alert'}</strong></div>
            <div>Sensor: <strong>${th.camera_id || th.bop_site || 'Zero-Line Wire'}</strong></div>
            <div>GPS: <strong>${thLat.toFixed(5)}°N, ${thLng.toFixed(5)}°E</strong></div>
            <button id="btn-fly-${tid}" type="button" style="
              width: 100%; margin-top: 8px; padding: 6px 8px;
              background: #dc2626; color: white; border: none; border-radius: 6px;
              font-size: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;
            ">
              🎯 FLY TO INCIDENT ZERO-POINT
            </button>
          </div>
        `);

        thMarker.on('mouseover', () => thMarker.openPopup());
        thMarker.on('mouseout', () => thMarker.closePopup());
        thMarker.on('click', () => {
          executeTacticalJump([thLat, thLng], 17);
        });

        thMarker.on('popupopen', () => {
          const flyBtn = document.getElementById(`btn-fly-${tid}`);
          if (flyBtn) {
            flyBtn.onclick = (e) => {
              e.stopPropagation();
              executeTacticalJump([thLat, thLng], 17);
            };
          }
        });

        thMarker.addTo(group);
      });
    }

    // 7. Render Tactical Surveillance Nodes Grid & MGRS Telemetry Mesh Network
    if (showNodesGridLayer) {
      const allNodeCoords: [number, number][] = [];
      cameras.forEach((c) => {
        if (c.latitude && c.longitude) allNodeCoords.push([c.latitude, c.longitude]);
      });
      bops.forEach((b: any) => {
        if (b.latitude && b.longitude) allNodeCoords.push([b.latitude, b.longitude]);
      });

      const baseLat = center ? center[0] : 31.6048;
      const baseLng = center ? center[1] : 74.5731;

      let minLat = baseLat - 0.08;
      let maxLat = baseLat + 0.08;
      let minLng = baseLng - 0.08;
      let maxLng = baseLng + 0.08;

      if (allNodeCoords.length > 0) {
        minLat = Math.min(...allNodeCoords.map(([lat]) => lat)) - 0.04;
        maxLat = Math.max(...allNodeCoords.map(([lat]) => lat)) + 0.04;
        minLng = Math.min(...allNodeCoords.map(([, lng]) => lng)) - 0.04;
        maxLng = Math.max(...allNodeCoords.map(([, lng]) => lng)) + 0.04;
      }

      const latStep = 0.02;
      for (let lat = Math.floor(minLat / latStep) * latStep; lat <= maxLat; lat += latStep) {
        L.polyline([[lat, minLng], [lat, maxLng]], {
          color: '#0284c7',
          weight: 0.8,
          opacity: 0.25,
          dashArray: '3, 6'
        }).addTo(group);
      }

      const lngStep = 0.02;
      for (let lng = Math.floor(minLng / lngStep) * lngStep; lng <= maxLng; lng += lngStep) {
        L.polyline([[minLat, lng], [maxLat, lng]], {
          color: '#0284c7',
          weight: 0.8,
          opacity: 0.25,
          dashArray: '3, 6'
        }).addTo(group);
      }

      if (allNodeCoords.length > 1) {
        for (let i = 0; i < allNodeCoords.length; i++) {
          const distances = allNodeCoords
            .map((pt, idx) => {
              if (idx === i) return { idx, d: Infinity, pt };
              const d = Math.hypot(pt[0] - allNodeCoords[i][0], pt[1] - allNodeCoords[i][1]);
              return { idx, d, pt };
            })
            .sort((a, b) => a.d - b.d);

          const nearest = distances.slice(0, 2);
          nearest.forEach((n) => {
            if (n.d < 0.15 && i < n.idx) {
              L.polyline([allNodeCoords[i], n.pt], {
                color: '#38bdf8',
                weight: 1.2,
                opacity: 0.35,
                dashArray: '4, 8'
              }).addTo(group);
            }
          });
        }
      }
    }

    lastValidCoordsRef.current = validCoords;

    // Do NOT pull map away to whole continent if explicit center was set!
    if (!hasInitialFitRef.current) {
      hasInitialFitRef.current = true;
      if (center) {
        map.setView(center, zoom);
      } else if (validCoords.length > 1) {
        map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [cameras, bops, _sites, alerts, showBorderLayer, showBopsLayer, showCamerasLayer, showCoverageLayer, showThreatsLayer, showNodesGridLayer, selectedCameraId, targetCoords, activeDimension]);

  const handleLiveLocate = useCallback(() => {
    setIsLocating(true);
    setGpsNotice('Acquiring real-time GPS signal...');

    const applyLocation = (latitude: number, longitude: number, accuracy: number, isFallback = false) => {
      setIsLocating(false);
      if (isFallback) {
        setGpsNotice(`GPS Locked: Outpost Zero-Line (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`);
      } else {
        setGpsNotice(`GPS Locked: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (±${Math.round(accuracy)}m)`);
      }
      setTimeout(() => setGpsNotice(null), 4500);

      const map = mapInstanceRef.current;
      if (!map) return;

      executeTacticalJump([latitude, longitude], 17);

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }

      const userGpsIcon = L.divIcon({
        className: 'custom-user-gps-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: #10b981;
              border: 3px solid #ffffff;
              box-shadow: 0 0 16px #10b981;
            "></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const uMarker = L.marker([latitude, longitude], { icon: userGpsIcon }).addTo(map);
      uMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <strong style="color: #10b981;">${isFallback ? 'OUTPOST ZERO-LINE POST' : 'CURRENT OPERATOR LOCATION'}</strong><br/>
          Lat: ${latitude.toFixed(5)}°<br/>
          Lng: ${longitude.toFixed(5)}°<br/>
          Accuracy: ±${Math.round(accuracy)} meters
        </div>
      `);
      uMarker.on('mouseover', () => uMarker.openPopup());
      uMarker.on('mouseout', () => uMarker.closePopup());
      uMarker.on('click', () => {
        executeTacticalJump([latitude, longitude], 17);
      });
      userMarkerRef.current = uMarker;

      if (onLocationFound) onLocationFound(latitude, longitude);
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      applyLocation(31.6048, 74.5731, 5, true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, false);
      },
      () => {
        applyLocation(31.6048, 74.5731, 10, true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
  const handleSetExactZoom = (targetZoom: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(targetZoom);
    setCurrentZoomLevel(targetZoom);
  };
  const handleFitAll = () => {
    if (mapInstanceRef.current && lastValidCoordsRef.current.length > 1) {
      mapInstanceRef.current.fitBounds(lastValidCoordsRef.current, { padding: [40, 40], maxZoom: 16 });
    }
  };
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      executeTacticalJump(center, zoom);
    }
  };

  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!mapInstanceRef.current) return;
    const panStep = 240;
    let dx = 0;
    let dy = 0;
    switch (direction) {
      case 'up':
        dy = -panStep;
        break;
      case 'down':
        dy = panStep;
        break;
      case 'left':
        dx = -panStep;
        break;
      case 'right':
        dx = panStep;
        break;
    }
    mapInstanceRef.current.panBy([dx, dy], { animate: true, duration: 0.2 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handlePan('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handlePan('down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePan('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlePan('right');
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 select-none" style={{ height }}>
      {/* Real Interactive Leaflet Container Wrapper - ALWAYS mounted to avoid reinitialization */}
      <div
        className={`absolute inset-0 w-full h-full z-0 ${
          activeDimension === '3d' ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        <div
          ref={mapContainerRef}
          className="leaflet-container w-full h-full outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* 3D Terrain Flythrough View Overlay */}
      {activeDimension === '3d' && (
        <div className="absolute inset-0 z-20 w-full h-full bg-slate-950">
          <Tactical3DTerrainMap
            cameras={cameras}
            bops={bops}
            events={events}
            alerts={alerts}
            center={center}
            targetCoords={targetCoords}
            zoom={zoom}
            height={height}
            selectedCameraId={selectedCameraId}
            onCameraSelect={onCameraSelect}
            onInspectCamera={onInspectCamera}
            onClose3D={() => handleSetDimension('2d')}
            onSwitchTo2D={() => handleSetDimension('2d')}
          />
        </div>
      )}

      {/* 2D HUD Controls & Interactive Layers */}
      {activeDimension === '2d' && (
        <>
          {/* GPS Notice Toast */}
          {gpsNotice && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-slate-900/95 border border-emerald-500 text-emerald-300 text-xs font-mono rounded-full shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto">
              <Locate className="w-3.5 h-3.5 text-emerald-400" />
              <span>{gpsNotice}</span>
            </div>
          )}

          {/* Top Integrated Tactical HUD Deck */}
          <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex flex-col gap-2 pointer-events-none">
            {/* Top Row: View & Dimension Switchers (Left) + Zoom & Pan Controls (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              {/* Left Group: 2D/3D Mode & Base Map Tiles */}
              <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto">
                {/* 2D vs 3D Dimension Switcher */}
                <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
                  <button
                    type="button"
                    onClick={() => handleSetDimension('2d')}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 bg-cyan-600 text-white shadow"
                  >
                    <span>🗺️</span>
                    <span>2D</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDimension('3d')}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <span>⛰️</span>
                    <span>3D Terrain</span>
                  </button>
                </div>

                {/* Map Base Tile Style Switcher */}
                <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
                  <button
                    type="button"
                    onClick={() => switchTileLayer('dark')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      activeLayer === 'dark' ? 'bg-cyan-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTileLayer('satellite')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      activeLayer === 'satellite' ? 'bg-cyan-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTileLayer('topo')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      activeLayer === 'topo' ? 'bg-cyan-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Topography & Elevation Relief"
                  >
                    Topo
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTileLayer('streets')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      activeLayer === 'streets' ? 'bg-cyan-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Roads & Border Infrastructure"
                  >
                    Streets
                  </button>
                </div>
              </div>

              {/* Right Group: Live Sentry Locate, Pan & Precision Zoom Bar */}
              <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-xl shadow-2xl pointer-events-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleLiveLocate}
                  disabled={isLocating}
                  title="Detect Live GPS Location & Pin Post"
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 cursor-pointer shadow-md"
                >
                  <Locate className={`w-3.5 h-3.5 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'My Post'}</span>
                </button>

                {/* Directional Pan Buttons (Left, Up, Down, Right) */}
                <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-700/80 shadow-md">
                  <button
                    type="button"
                    onClick={() => handlePan('left')}
                    title="Pan West ⬅️ (Left)"
                    className="px-2 py-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden md:inline">Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePan('up')}
                    title="Pan North ⬆️ (Up)"
                    className="px-2 py-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden md:inline">Up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePan('down')}
                    title="Pan South ⬇️ (Down)"
                    className="px-2 py-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden md:inline">Down</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePan('right')}
                    title="Pan East ➡️ (Right)"
                    className="px-2 py-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden md:inline">Right</span>
                  </button>
                </div>

                {/* Quick Zoom Buttons */}
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom In (+)"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer border border-slate-700/50"
                >
                  <ZoomIn className="w-4 h-4 text-sky-400" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom Out (-)"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer border border-slate-700/50"
                >
                  <ZoomOut className="w-4 h-4 text-sky-400" />
                </button>

                {/* Interactive Zoom Slider */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <span className="text-[10px] font-mono text-slate-400">🔍</span>
                  <input
                    type="range"
                    min="5"
                    max="22"
                    step="0.5"
                    value={currentZoomLevel}
                    onChange={(e) => handleSetExactZoom(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                    title={`Drag to zoom: ${currentZoomLevel.toFixed(1)}x`}
                  />
                </div>

                <span className="px-2 py-0.5 text-[11px] font-mono font-bold text-cyan-400 bg-slate-950/90 border border-slate-800 rounded-lg shadow-inner min-w-[55px] text-center">
                  {currentZoomLevel.toFixed(1)}x
                </span>

                <button
                  type="button"
                  onClick={handleFitAll}
                  title="Fit All Perimeter Nodes"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer border border-slate-700/50"
                >
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            </div>

            {/* Second Row: Tactical Layer Visibility Toggles (Left) + Tactical Zoom Presets (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              {/* Tactical Layer Visibility Toggles (Left) */}
              <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-xl flex-wrap pointer-events-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setShowBorderLayer(!showBorderLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showBorderLayer ? 'bg-amber-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                  title="Toggle International Border Zero-Line Fence & Pillars"
                >
                  <span>🛡️</span>
                  <span>Border Fence</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBopsLayer(!showBopsLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showBopsLayer ? 'bg-emerald-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>🛡️</span>
                  <span>BOPs ({bops.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCamerasLayer(!showCamerasLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showCamerasLayer ? 'bg-cyan-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>📹</span>
                  <span>Cameras ({cameras.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCoverageLayer(!showCoverageLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showCoverageLayer ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>📡</span>
                  <span>FOV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowThreatsLayer(!showThreatsLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showThreatsLayer ? 'bg-rose-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  <span>🚨</span>
                  <span>Radar Alerts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNodesGridLayer(!showNodesGridLayer)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    showNodesGridLayer ? 'bg-cyan-600 text-white shadow' : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                  title="Toggle Surveillance Nodes Grid & MGRS Telemetry Mesh"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Nodes Grid</span>
                </button>
              </div>

              {/* Tactical Quick-Zoom Presets (Right) */}
              <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 px-2 py-1 rounded-xl shadow-xl pointer-events-auto flex-wrap">
                <span className="text-[9px] font-mono text-slate-400 font-bold pr-1">ZOOM:</span>
                {[
                  { label: 'Sector (11x)', level: 11 },
                  { label: 'Post (14x)', level: 14 },
                  { label: 'Fence (17x)', level: 17 },
                  { label: 'Close-Up (19x)', level: 19 },
                  { label: 'Ultra (21.5x)', level: 21.5 }
                ].map((preset) => (
                  <button
                    key={preset.level}
                    type="button"
                    onClick={() => handleSetExactZoom(preset.level)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                      Math.abs(currentZoomLevel - preset.level) < 0.8
                        ? 'bg-cyan-600 text-white shadow font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title={`Jump to ${preset.label}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

      {/* Tactical D-Pad Pan Navigation Pad - Always Visible On-Screen */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col items-center p-2 bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl">
        <div className="text-[9px] font-mono text-cyan-400 font-bold mb-1.5 flex items-center gap-1.5 tracking-wider uppercase">
          <Compass className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
          <span>MAP PAN</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 w-24 h-24 items-center justify-items-center">
          <div />
          <button
            type="button"
            onClick={() => handlePan('up')}
            title="Pan North ⬆️ (Up)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition shadow-lg cursor-pointer active:scale-90"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />

          <button
            type="button"
            onClick={() => handlePan('left')}
            title="Pan West ⬅️ (Left)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition shadow-lg cursor-pointer active:scale-90"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map (Center 🎯)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-cyan-950 hover:bg-cyan-700 text-cyan-300 hover:text-white border border-cyan-400 transition shadow-lg cursor-pointer active:scale-90 text-[11px] font-mono font-bold"
          >
            ●
          </button>
          <button
            type="button"
            onClick={() => handlePan('right')}
            title="Pan East ➡️ (Right)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition shadow-lg cursor-pointer active:scale-90"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div />
          <button
            type="button"
            onClick={() => handlePan('down')}
            title="Pan South ⬇️ (Down)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 transition shadow-lg cursor-pointer active:scale-90"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <div />
        </div>
      </div>

      {/* Bottom Right Floating Telemetry Strip */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-xl transition cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Recenter</span>
        </button>

        <div className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-400 flex items-center gap-2 shadow-xl flex-wrap">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>BOPs: <strong className="text-emerald-400">{bops.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Cameras: <strong className="text-cyan-300">{cameras.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span ref={coordDisplayRef} className="text-emerald-400 font-bold">
            📍 {center[0].toFixed(4)}°N, {center[1].toFixed(4)}°E
          </span>
        </div>
      </div>
        </>
      )}

      {/* Live Stream Inspection Modal */}
      {inspectedCamera && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cctv className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="font-bold text-white text-sm">{inspectedCamera.camera_name}</span>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
                  {inspectedCamera.camera_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCamera(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <LiveVideoPlayer
                camera={inspectedCamera}
                className="w-full h-80 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
