import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, Radio } from 'lucide-react';
import { Camera } from '../../types/camera';

import { SecurityEvent } from '../../types/event';

interface TacticalLeafletMapProps {
  cameras: Camera[];
  events?: SecurityEvent[];
  blindSpots?: any[];
  sites?: any[];
  bops?: any[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onCameraSelect?: (camera: Camera) => void;
}

type TileLayerType = 'dark' | 'satellite' | 'streets';

export const TacticalLeafletMap: React.FC<TacticalLeafletMapProps> = ({
  cameras,
  events = [],
  blindSpots = [],
  sites = [],
  bops = [],
  center = [31.6245, 74.8725],
  zoom = 13,
  height = '500px',
  onCameraSelect
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<TileLayerType>('dark');

  // Reliable, 100% Free & Open Esri Global Tiles (Zero API Key required, zero rate-limit watermarks)
  const tileUrls: Record<TileLayerType, { base: string; labels?: string; attribution: string }> = {
    dark: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Dark Tactical Canvas'
    },
    satellite: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; High-Resolution Satellite'
    },
    streets: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Topographical Terrain'
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const cfg = tileUrls[activeLayer];
    const initialTile = L.tileLayer(cfg.base, {
      maxZoom: 19,
      attribution: cfg.attribution
    }).addTo(map);

    tileLayerRef.current = initialTile;

    if (cfg.labels) {
      const labelsTile = L.tileLayer(cfg.labels, {
        maxZoom: 19
      }).addTo(map);
      labelsLayerRef.current = labelsTile;
    }

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    mapInstanceRef.current = map;

  }, []);

  // Dynamically fly to new center and zoom when coordinates update
  useEffect(() => {
    if (!mapInstanceRef.current || !center) return;
    mapInstanceRef.current.flyTo(center, zoom, { duration: 1.2 });
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
      maxZoom: 19,
      attribution: cfg.attribution
    }).addTo(mapInstanceRef.current);
    newTile.bringToBack();
    tileLayerRef.current = newTile;

    if (cfg.labels) {
      const newLabels = L.tileLayer(cfg.labels, {
        maxZoom: 19
      }).addTo(mapInstanceRef.current);
      labelsLayerRef.current = newLabels;
    }
  };


  // Render Overlays: Cameras, FOV Cones, Blind Spots, and Live Threats
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const validCoords: [number, number][] = [];

    // 0. Render Tactical Border Sites (HQ Command Bunkers)
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

    // 0.1 Render Border Outposts (BOPs)
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

    // 1. Render Cameras & FOV Cones
    cameras.forEach((cam, idx) => {
      // Default to Punjab/Jammu border offset if lat/lng is missing
      const lat = cam.latitude ?? (center[0] + (idx * 0.003 - 0.006));

      const lng = cam.longitude ?? (center[1] + (idx * 0.004 - 0.008));
      validCoords.push([lat, lng]);

      const isOnline = cam.status === 'HEALTHY' || cam.status === 'ONLINE';
      const statusColor = isOnline ? '#10b981' : '#ef4444';

      // FOV Cone geometry (60-degree wedge ~150 meters out)
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

      // Custom Camera Pin Icon
      const cameraIcon = L.divIcon({
        className: 'custom-camera-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid ${statusColor};
            border-radius: 8px;
            padding: 3px 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            white-space: nowrap;
            font-family: monospace;
            cursor: pointer;
          ">
            <span style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${statusColor};
              display: inline-block;
              box-shadow: 0 0 8px ${statusColor};
            "></span>
            <span style="font-size: 11px; font-weight: bold; color: #fff;">${cam.camera_id}</span>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12]
      });

      const marker = L.marker([lat, lng], { icon: cameraIcon });
      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 180px; padding: 4px 0;">
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
          <div style="font-size: 10px; color: #cbd5e1; display: flex; justify-content: space-between;">
            <span>GPS:</span>
            <span style="font-family: monospace;">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
          </div>
        </div>
      `);

      if (onCameraSelect) {
        marker.on('click', () => onCameraSelect(cam));
      }
      marker.addTo(group);
    });

    // 2. Render Real Live Threat Events (Pulsing Target Reticle)
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

    // 3. Render Blind Spots
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

    // Fit Bounds if multiple coordinates exist
    if (validCoords.length > 1) {
      map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 16 });
    }
  }, [cameras, events, blindSpots, sites, bops, center]);


  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(center, zoom, { animate: true });
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
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
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
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
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
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
            activeLayer === 'streets'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Street
        </button>
      </div>

      {/* Bottom Right Floating HUD */}
      <div className="absolute bottom-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-xl transition"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Recenter Border</span>
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
