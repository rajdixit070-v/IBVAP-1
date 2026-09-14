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
  Cctv
} from 'lucide-react';
import { Camera } from '../../types/camera';
import { SecurityEvent } from '../../types/event';
import { GISLayer } from '../../services/gisService';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';

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
  onCameraSelect?: (camera: Camera) => void;
  onBopSelect?: (bop: any) => void;
  onInspectCamera?: (camera: Camera) => void;
  onLocationFound?: (lat: number, lng: number) => void;
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
  onCameraSelect,
  onBopSelect,
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
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);

  // Layer Visibility Toggles
  const [showBorderLayer, setShowBorderLayer] = useState<boolean>(true);
  const [showBopsLayer, setShowBopsLayer] = useState<boolean>(true);
  const [showCamerasLayer, setShowCamerasLayer] = useState<boolean>(true);
  const [showCoverageLayer, setShowCoverageLayer] = useState<boolean>(true);
  const [showThreatsLayer, setShowThreatsLayer] = useState<boolean>(true);

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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

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

    map.on('zoomend', () => {
      setCurrentZoomLevel(Math.round(map.getZoom() * 10) / 10);
    });
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords([e.latlng.lat, e.latlng.lng]);
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
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fly to target location when props change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center) return;

    const latDiff = Math.abs((prevCenterRef.current?.[0] ?? 0) - center[0]);
    const lngDiff = Math.abs((prevCenterRef.current?.[1] ?? 0) - center[1]);
    const zoomDiff = Math.abs((prevZoomRef.current ?? 0) - zoom);

    if (latDiff > 0.0001 || lngDiff > 0.0001 || zoomDiff > 0.1) {
      prevCenterRef.current = center;
      prevZoomRef.current = zoom;
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center[0], center[1], zoom]);

  // Tile Layer Switcher
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
              pMarker.openPopup();
              map.flyTo([pillar.lat, pillar.lng], 17, { animate: true, duration: 1.2 });
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
      `, { closeOnClick: false });
      tMarker.on('mouseover', () => tMarker.openPopup());
      tMarker.on('mouseout', () => tMarker.closePopup());
      tMarker.on('click', () => {
        tMarker.openPopup();
        map.flyTo(targetCoords, 17, { animate: true, duration: 1.2 });
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
              poly.openPopup(e.latlng);
              map.flyTo(e.latlng, 16, { animate: true, duration: 1.2 });
            });
          }
        } catch (_) {}
      });
    }

    // 4. Group cameras by parent BOP
    const bopLocationMap = new Map<string, { lat: number; lng: number; bop: any }>();
    bops.forEach(b => {
      if (b.latitude && b.longitude) {
        bopLocationMap.set(b.bop_id.toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
        bopLocationMap.set(b.name.toLowerCase(), { lat: b.latitude, lng: b.longitude, bop: b });
      }
    });

    const bopCameraBuckets = new Map<string, Camera[]>();
    cameras.forEach(cam => {
      const bopKey = (cam.bop_site || (cam as any).bop_id || '').toLowerCase();
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

        const bopThreats = bopAlertsMap.get(bop.name.toLowerCase()) || bopAlertsMap.get(bop.bop_id.toLowerCase()) || [];
        const hasThreat = bopThreats.length > 0;
        const connectedCams = bopCameraBuckets.get(bop.bop_id.toLowerCase()) || bopCameraBuckets.get(bop.name.toLowerCase()) || [];

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
          bMarker.openPopup();
          map.flyTo([bLat, bLng], 16, { animate: true, duration: 1.2 });
          if (onBopSelect) onBopSelect(bop);
        });

        bMarker.addTo(group);
      });
    }

    // 6. Render Cameras
    if (showCamerasLayer) {
      const bopCameraOffsetIndex = new Map<string, number>();

      cameras.forEach((cam) => {
        const bopKey = (cam.bop_site || (cam as any).bop_id || '').toLowerCase();
        const parentBopInfo = bopLocationMap.get(bopKey);

        let finalLat = cam.latitude;
        let finalLng = cam.longitude;

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
        } else if (!finalLat || !finalLng) {
          finalLat = center[0];
          finalLng = center[1];
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
        camMarker.on('click', () => {
          camMarker.openPopup();
          map.flyTo([finalLat, finalLng], 17, { animate: true, duration: 1.2 });
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
        thMarker.on('click', () => {
          thMarker.openPopup();
          map.flyTo([thLat, thLng], 17, { animate: true, duration: 1.2 });
        });

        thMarker.on('popupopen', () => {
          const flyBtn = document.getElementById(`btn-fly-${tid}`);
          if (flyBtn) {
            flyBtn.onclick = (e) => {
              e.stopPropagation();
              map.flyTo([thLat, thLng], 17, { animate: true, duration: 1.2 });
            };
          }
        });

        thMarker.addTo(group);
      });
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
  }, [cameras, bops, _sites, alerts, showBorderLayer, showBopsLayer, showCamerasLayer, showCoverageLayer, showThreatsLayer, selectedCameraId, targetCoords]);

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

      map.flyTo([latitude, longitude], 17, { animate: true, duration: 1.5 });

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
      `, { closeOnClick: false });
      uMarker.on('mouseover', () => uMarker.openPopup());
      uMarker.on('mouseout', () => uMarker.closePopup());
      uMarker.on('click', () => {
        uMarker.openPopup();
        map.flyTo([latitude, longitude], 17, { animate: true, duration: 1.2 });
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

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitAll = () => {
    if (mapInstanceRef.current && lastValidCoordsRef.current.length > 1) {
      mapInstanceRef.current.fitBounds(lastValidCoordsRef.current, { padding: [40, 40], maxZoom: 16 });
    }
  };
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, { duration: 1.0 });
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 select-none" style={{ height }}>
      {/* Real Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} />

      {/* Top Left: Map Style & Interactive Layer Filters */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Style Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
          <button
            type="button"
            onClick={() => switchTileLayer('dark')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
              activeLayer === 'dark' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => switchTileLayer('satellite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
              activeLayer === 'satellite' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => switchTileLayer('topo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
              activeLayer === 'topo' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Topo
          </button>
        </div>

        {/* Tactical Layer Visibility Toggles */}
        <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-xl flex-wrap">
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
        </div>
      </div>

      {/* GPS Notice Toast */}
      {gpsNotice && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-slate-900/95 border border-emerald-500 text-emerald-300 text-xs font-mono rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <Locate className="w-3.5 h-3.5 text-emerald-400" />
          <span>{gpsNotice}</span>
        </div>
      )}

      {/* Top Right Zoom Controls & Telemetry */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
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
          <span className="text-emerald-400 font-bold">
            📍 {cursorCoords ? `${cursorCoords[0].toFixed(4)}°N, ${cursorCoords[1].toFixed(4)}°E` : `${center[0].toFixed(4)}°N, ${center[1].toFixed(4)}°E`}
          </span>
        </div>
      </div>

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
