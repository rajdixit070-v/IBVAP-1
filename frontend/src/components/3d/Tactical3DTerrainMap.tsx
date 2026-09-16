import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Eye,
  X,
  Cctv,
  ChevronUp,
  ChevronDown
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

// 3D Cutout Diorama Block Dimensions
const BLOCK_SIZE = 220;
const TERRAIN_RES = 96;
const BASE_ELEVATION = -15; // Cutout base depth for geological rock sides
const LAT_SPAN = 0.14; // ~15.5 km
const LNG_SPAN = 0.14; // ~13.5 km

// Procedural Mountain Massif matching the reference image:
// High rugged mountain range at the back and flanks, opening to a wide terracotta valley plain in the center foreground
function getTerrainHeight(x: number, z: number): number {
  const nx = x / (BLOCK_SIZE * 0.5);
  const nz = z / (BLOCK_SIZE * 0.5);

  const valleyDist = Math.hypot(nx * 1.5, nz - 0.25);
  const mountainFactor = Math.min(1.0, Math.max(0.08, valleyDist * 1.15));

  // Multi-octave mountain ridges
  let h = 0;
  // Octave 1: Major alpine massif
  h += Math.sin(x * 0.022 + 1.2) * Math.cos(z * 0.022 - 0.5) * 16;
  // Octave 2: Sharp alpine ridges & mountain spine
  const ridge1 = Math.pow(Math.abs(Math.sin(x * 0.045 + z * 0.035)), 1.35) * 32;
  const ridge2 = Math.pow(Math.abs(Math.cos(x * 0.06 - z * 0.045)), 1.25) * 18;
  h += ridge1 + ridge2;
  // Octave 3: Craggy ravines & rock gullies
  h += Math.sin(x * 0.11 + Math.cos(z * 0.09)) * 5.5;
  // Octave 4: Fine rock detail
  h += Math.cos(x * 0.22 - z * 0.18) * 1.8;

  // Apply mountain massif envelope
  h = (h + 8) * mountainFactor;

  // Center valley floor
  if (valleyDist < 0.45) {
    const vBlend = Math.cos((valleyDist / 0.45) * (Math.PI / 2));
    h = h * (1 - vBlend * 0.85) + 3.0 * (vBlend * 0.85);
  }

  return Math.max(1.5, h);
}

// In-memory Texture Cache for Instant 0ms Style Switching
const textureCache = new Map<string, THREE.CanvasTexture>();

// High-Performance Terrain Texture Generator Supporting Satellite, Dark Mode, and Topo
function generateTerrainTexture(style: TerrainMapStyle): THREE.CanvasTexture {
  if (textureCache.has(style)) {
    return textureCache.get(style)!;
  }

  const size = 384; // Fast generation, crisp rendering
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Pre-sample heights
  const heights = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const z = ((py / size) - 0.5) * BLOCK_SIZE;
    for (let px = 0; px < size; px++) {
      const x = ((px / size) - 0.5) * BLOCK_SIZE;
      heights[py * size + px] = getTerrainHeight(x, z);
    }
  }

  // Sunlight vector from upper-left (NW at 48 degrees)
  const sunX = -0.58;
  const sunY = 0.72;
  const sunZ = -0.38;
  const sunLen = Math.hypot(sunX, sunY, sunZ);
  const lx = sunX / sunLen;
  const ly = sunY / sunLen;
  const lz = sunZ / sunLen;

  for (let py = 0; py < size; py++) {
    const z = ((py / size) - 0.5) * BLOCK_SIZE;
    const pyUp = Math.min(size - 1, py + 1);
    const pyDown = Math.max(0, py - 1);

    for (let px = 0; px < size; px++) {
      const x = ((px / size) - 0.5) * BLOCK_SIZE;
      const pxRight = Math.min(size - 1, px + 1);
      const pxLeft = Math.max(0, px - 1);

      const h = heights[py * size + px];
      const hR = heights[py * size + pxRight];
      const hL = heights[py * size + pxLeft];
      const hU = heights[pyUp * size + px];
      const hD = heights[pyDown * size + px];

      const dx = (hR - hL) / 1.5;
      const dz = (hU - hD) / 1.5;
      const nLen = Math.hypot(dx, 1.0, dz);
      const nx = -dx / nLen;
      const ny = 1.0 / nLen;
      const nz = -dz / nLen;

      // Lambertian sunlight relief shading
      const dot = Math.max(0.18, nx * lx + ny * ly + nz * lz);
      const sunShade = 0.42 + dot * 0.58;

      let r = 50, g = 65, b = 40;

      if (style === 'dark') {
        // TACTICAL DARK OPS THEME (Obsidian rock with glowing contour elevation rings)
        const darkShade = 0.35 + dot * 0.65;
        if (h < 9.5) {
          // Low plain: deep slate obsidian
          r = 10 * darkShade; g = 18 * darkShade; b = 30 * darkShade;
        } else if (h < 22) {
          // Mid foothills
          r = 16 * darkShade; g = 26 * darkShade; b = 42 * darkShade;
        } else if (h < 38) {
          // Alpine slopes: charcoal granite
          r = 24 * darkShade; g = 38 * darkShade; b = 60 * darkShade;
        } else {
          // Summits & Crests: frosted blue-cyan rock
          const crestFactor = 0.55 + dot * 0.45;
          r = 45 * crestFactor; g = 90 * crestFactor; b = 145 * crestFactor;
        }

        // Topographic elevation contour lines (cyan major, teal minor)
        const majorContour = Math.abs(h % 18);
        const minorContour = Math.abs(h % 6);
        if (majorContour < 0.45 || majorContour > 17.55) {
          r = 14; g = 165; b = 233; // bright cyan
        } else if (minorContour < 0.28 || minorContour > 5.72) {
          r = 16; g = 120; b = 150; // emerald/teal
        }

      } else if (style === 'topo') {
        // TOPOGRAPHIC RELIEF THEME
        if (h < 8) {
          r = 25 * sunShade; g = 110 * sunShade; b = 75 * sunShade;
        } else if (h < 20) {
          r = 45 * sunShade; g = 145 * sunShade; b = 65 * sunShade;
        } else if (h < 35) {
          r = 195 * sunShade; g = 140 * sunShade; b = 50 * sunShade;
        } else if (h < 46) {
          r = 145 * sunShade; g = 115 * sunShade; b = 95 * sunShade;
        } else {
          r = 230; g = 238; b = 245;
        }
        if (Math.abs(Math.round(h) - h) < 0.08) {
          r = Math.min(255, r * 1.3); g = Math.min(255, g * 1.3); b = Math.min(255, b * 1.3);
        }

      } else {
        // PHOTOREALISTIC SATELLITE THEME (matching reference photo)
        if (h < 9.5) {
          // Warm terracotta/ochre agricultural valley plain
          const noise = (Math.sin(x * 0.4) * Math.cos(z * 0.4)) * 0.15;
          r = (188 + noise * 30) * sunShade;
          g = (128 + noise * 25) * sunShade;
          b = (78 + noise * 20) * sunShade;

          if (Math.sin(x * 0.3 + z * 0.25) > 0.4) {
            r = 65 * sunShade; g = 88 * sunShade; b = 48 * sunShade;
          }
        } else if (h < 22) {
          // Transition to lush green mountain forest
          const blend = (h - 9.5) / 12.5;
          const forestR = 34 * sunShade, forestG = 76 * sunShade, forestB = 32 * sunShade;
          const terraR = 175 * sunShade, terraG = 120 * sunShade, terraB = 70 * sunShade;
          r = terraR * (1 - blend) + forestR * blend;
          g = terraG * (1 - blend) + forestG * blend;
          b = terraB * (1 - blend) + forestB * blend;
        } else if (h < 38) {
          // Dense high mountain greenery & evergreen ridges
          r = (32 + Math.sin(x * 0.5) * 8) * sunShade;
          g = (74 + Math.cos(z * 0.5) * 12) * sunShade;
          b = (30 + Math.sin(x * 0.2 + z * 0.3) * 6) * sunShade;
          if (ny < 0.65) {
            r = 85 * sunShade; g = 80 * sunShade; b = 68 * sunShade;
          }
        } else {
          // Alpine crags & mountain summits
          const rockNoise = Math.sin(x * 0.6) * 10;
          r = (98 + rockNoise) * sunShade;
          g = (95 + rockNoise) * sunShade;
          b = (82 + rockNoise) * sunShade;
          if (dot > 0.65) {
            r = Math.min(240, r * 1.35); g = Math.min(240, g * 1.32); b = Math.min(225, b * 1.25);
          }
        }
      }

      const idx = (py * size + px) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  textureCache.set(style, texture);
  return texture;
}

// Generate Geological Rock Strata Texture for the 3D Diorama Skirt (Cutout Sides)
function generateGeologicalStrataTexture(isDark: boolean): THREE.CanvasTexture {
  const cacheKey = isDark ? 'strata_dark' : 'strata_light';
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    const v = y / h;
    const bandFreq1 = Math.sin(v * 28.0) * 0.5 + 0.5;
    const bandFreq2 = Math.sin(v * 64.0 + Math.cos(v * 12.0) * 2.0) * 0.5 + 0.5;
    const bandFreq3 = Math.sin(v * 110.0) * 0.5 + 0.5;

    for (let x = 0; x < w; x++) {
      const u = x / w;
      const grain = (Math.sin(u * 80.0 + v * 30.0) + Math.cos(u * 120.0 - v * 40.0)) * 0.12;

      let r = 0, g = 0, b = 0;

      if (isDark) {
        // Dark Obsidian / Slate Geological Strata
        const baseVal = 18 + v * 12;
        const layerVal = baseVal + bandFreq1 * 14 + bandFreq2 * 8 + bandFreq3 * 5 + grain * 10;
        r = layerVal * 0.8;
        g = layerVal * 0.95;
        b = layerVal * 1.35;
        if (bandFreq1 > 0.88) {
          r += 10; g += 25; b += 45;
        }
      } else {
        // Sedimentary Rock Strata (Warm Sandstone, Siltstone, and Clay layers matching reference image)
        const baseR = 120 + bandFreq1 * 40 + bandFreq2 * 25 + grain * 20;
        const baseG = 85 + bandFreq1 * 28 + bandFreq2 * 18 + grain * 15;
        const baseB = 58 + bandFreq1 * 18 + bandFreq2 * 12 + grain * 10;
        r = baseR;
        g = baseG;
        b = baseB;
        if (bandFreq2 > 0.8) {
          r *= 0.82; g *= 0.82; b *= 0.85;
        }
      }

      const idx = (y * w + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(4, 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  textureCache.set(cacheKey, texture);
  return texture;
}

export const Tactical3DTerrainMap: React.FC<Tactical3DTerrainMapProps> = ({
  cameras,
  bops = [],
  alerts = [],
  center = [31.6048, 74.5731],
  targetCoords = null,
  height = '540px',
  selectedCameraId,
  initialStyle = 'satellite',
  autoFlythrough = true,
  onCameraSelect,
  onInspectCamera,
  onClose3D,
  onSwitchTo2D
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dioramaGroupRef = useRef<THREE.Group | null>(null);
  const dynamicMarkersGroupRef = useRef<THREE.Group | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const skirtMeshRef = useRef<THREE.Mesh | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sweepConesRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const labelRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Controls & Style State for UI
  const [currentStyle, setCurrentStyle] = useState<TerrainMapStyle>(initialStyle);
  const [isPlayingOrbit, setIsPlayingOrbit] = useState<boolean>(autoFlythrough);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(1.0);
  const [activeCamDetails, setActiveCamDetails] = useState<Camera | null>(null);
  const [inspectedCam, setInspectedCam] = useState<Camera | null>(null);
  const [currentVantage, setCurrentVantage] = useState<'overview' | 'aerial' | 'ridge' | 'fence'>('overview');

  // Fast animation refs (ZERO React re-renders in the 60fps loop)
  const isPlayingOrbitRef = useRef<boolean>(autoFlythrough);
  const orbitSpeedRef = useRef<number>(1.0);
  const camerasRef = useRef<Camera[]>(cameras);
  const alertsRef = useRef<any[]>(alerts);
  const centerRef = useRef<[number, number]>(center);
  const selectedCameraIdRef = useRef<string | undefined>(selectedCameraId);

  // Sync state changes with refs
  useEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

  // Camera Orbit & Vantage State (framing the full 3D diorama block)
  const orbitAnglesRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4, // 45 degree isometric perspective
    phi: Math.PI / 3.4, // ~53 degree elevated angle from above
    radius: 275 // Framed so the complete 220x220 mountain block is fully visible
  });
  const targetOrbitAnglesRef = useRef<{ phi: number; radius: number }>({
    phi: Math.PI / 3.4,
    radius: 275
  });
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 8, 0));
  const desiredLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 8, 0));

  const isUserDraggingRef = useRef<boolean>(false);
  const dragButtonRef = useRef<number>(0);
  const previousPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert GPS (lat, lng) to local coordinates on the 3D block
  const gpsTo3D = useCallback((lat: number, lng: number): [number, number, number] => {
    const curCenter = centerRef.current;
    const dLng = lng - curCenter[1];
    const dLat = lat - curCenter[0];
    const x = (dLng / LNG_SPAN) * (BLOCK_SIZE * 0.75);
    const z = -(dLat / LAT_SPAN) * (BLOCK_SIZE * 0.75);
    const clampedX = Math.max(-BLOCK_SIZE / 2 + 10, Math.min(BLOCK_SIZE / 2 - 10, x));
    const clampedZ = Math.max(-BLOCK_SIZE / 2 + 10, Math.min(BLOCK_SIZE / 2 - 10, z));
    const y = getTerrainHeight(clampedX, clampedZ);
    return [clampedX, y, clampedZ];
  }, []);

  // Jump to Vantage Presets - Smoothly swoops to perspective and KEEPS auto-orbiting!
  const handleJumpVantage = (mode: 'overview' | 'aerial' | 'ridge' | 'fence') => {
    setCurrentVantage(mode);

    if (mode === 'overview') {
      desiredLookAtRef.current.set(0, 8, 0);
      targetOrbitAnglesRef.current = { phi: Math.PI / 3.4, radius: 275 };
    } else if (mode === 'aerial') {
      desiredLookAtRef.current.set(0, 6, 0);
      targetOrbitAnglesRef.current = { phi: Math.PI / 4.4, radius: 240 };
    } else if (mode === 'ridge') {
      desiredLookAtRef.current.set(0, 12, 0);
      targetOrbitAnglesRef.current = { phi: Math.PI / 3.2, radius: 190 };
    } else if (mode === 'fence') {
      desiredLookAtRef.current.set(10, 6, 0);
      targetOrbitAnglesRef.current = { phi: Math.PI / 3.8, radius: 120 };
    }

    // Keep orbit running so map keeps rotating smoothly!
    isPlayingOrbitRef.current = true;
    setIsPlayingOrbit(true);
  };

  const handleManualZoom = (delta: number) => {
    const newRad = Math.max(90, Math.min(480, targetOrbitAnglesRef.current.radius + delta));
    targetOrbitAnglesRef.current.radius = newRad;
    orbitAnglesRef.current.radius = newRad;
  };

  const handleManualTilt = (dir: 'up' | 'down') => {
    const step = 0.1;
    let newPhi = orbitAnglesRef.current.phi;
    if (dir === 'up') {
      newPhi = Math.max(0.08, newPhi - step);
    } else {
      newPhi = Math.min(Math.PI / 2.05, newPhi + step);
    }
    targetOrbitAnglesRef.current.phi = newPhi;
    orbitAnglesRef.current.phi = newPhi;
  };

  const handleToggleOrbit = () => {
    const next = !isPlayingOrbitRef.current;
    isPlayingOrbitRef.current = next;
    setIsPlayingOrbit(next);
  };

  const handleToggleSpeed = () => {
    const next = orbitSpeedRef.current === 1.0 ? 2.0 : orbitSpeedRef.current === 2.0 ? 0.5 : 1.0;
    orbitSpeedRef.current = next;
    setOrbitSpeed(next);
  };

  // Rebuild Dynamic Markers (Fences, Towers, Radars, Beacons) in 0.5ms WITHOUT tearing down Three.js
  const rebuildDynamicMarkers = useCallback(() => {
    const parentGroup = dynamicMarkersGroupRef.current;
    if (!parentGroup) return;

    // Dispose old children
    while (parentGroup.children.length > 0) {
      const obj = parentGroup.children[0];
      parentGroup.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) (obj as any).material.forEach((m: any) => m.dispose());
        else (obj as any).material.dispose();
      }
    }

    const cones: THREE.Mesh[] = [];

    // 1. Tactical Border Fence & Holographic Boundary
    TACTICAL_BORDER_SEGMENTS.forEach((seg) => {
      const fencePoints: THREE.Vector3[] = [];
      seg.points.forEach(([lat, lng]) => {
        const [x, , z] = gpsTo3D(lat, lng);
        const y = getTerrainHeight(x, z) + 0.45;
        fencePoints.push(new THREE.Vector3(x, y, z));
      });

      if (fencePoints.length > 1) {
        const fenceCurve = new THREE.CatmullRomCurve3(fencePoints);
        const tubeGeo = new THREE.TubeGeometry(fenceCurve, 54, 0.45, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        parentGroup.add(tubeMesh);

        // Holographic Laser Plane
        const wallGeo = new THREE.BufferGeometry();
        const wallVerts: number[] = [];
        for (let i = 0; i < fencePoints.length - 1; i++) {
          const p1 = fencePoints[i];
          const p2 = fencePoints[i + 1];
          wallVerts.push(p1.x, p1.y, p1.z);
          wallVerts.push(p1.x, p1.y + 3.8, p1.z);
          wallVerts.push(p2.x, p2.y, p2.z);

          wallVerts.push(p2.x, p2.y, p2.z);
          wallVerts.push(p1.x, p1.y + 3.8, p1.z);
          wallVerts.push(p2.x, p2.y + 3.8, p2.z);
        }
        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVerts, 3));
        const wallMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide
        });
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        parentGroup.add(wallMesh);
      }

      // Border Pillars with Caps
      seg.pillars?.forEach((pil) => {
        const [px, , pz] = gpsTo3D(pil.lat, pil.lng);
        const py = getTerrainHeight(px, pz);
        const pilGeo = new THREE.BoxGeometry(0.9, 3.8, 0.9);
        const pilMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 });
        const pilMesh = new THREE.Mesh(pilGeo, pilMat);
        pilMesh.position.set(px, py + 1.9, pz);
        parentGroup.add(pilMesh);

        const capGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 8);
        const capMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const capMesh = new THREE.Mesh(capGeo, capMat);
        capMesh.position.set(px, py + 4.0, pz);
        parentGroup.add(capMesh);
      });
    });

    // 2. Sentry Towers & Green Map Pins & Radar Sweep Cones
    const curAlerts = alertsRef.current;
    const curCameras = camerasRef.current;
    const curSelected = selectedCameraIdRef.current;

    const threatsSet = new Set(
      curAlerts.filter((a) => a.status !== 'RESOLVED' && a.camera_id).map((a) => a.camera_id.toLowerCase())
    );

    curCameras.forEach((cam) => {
      const lat = cam.latitude || centerRef.current[0];
      const lng = cam.longitude || centerRef.current[1];
      const [cx, , cz] = gpsTo3D(lat, lng);
      const cy = getTerrainHeight(cx, cz);

      const hasThreat = threatsSet.has(cam.camera_id.toLowerCase());
      const isSelected = curSelected === cam.camera_id;
      const beaconColor = hasThreat ? 0xef4444 : isSelected ? 0x38bdf8 : cam.status === 'ONLINE' ? 0x00e676 : 0xf59e0b;

      // Sentry Watchtower Legs
      const towerHeight = 7.0;
      const legGeo = new THREE.CylinderGeometry(0.35, 0.6, towerHeight, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
      const towerMesh = new THREE.Mesh(legGeo, legMat);
      towerMesh.position.set(cx, cy + towerHeight / 2, cz);
      parentGroup.add(towerMesh);

      // Rotating Radar Head
      const headGeo = new THREE.SphereGeometry(0.75, 10, 10);
      const headMat = new THREE.MeshStandardMaterial({ color: beaconColor, metalness: 0.7, roughness: 0.2 });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(cx, cy + towerHeight + 0.8, cz);
      parentGroup.add(headMesh);

      // Glowing Green 3D Map Pin (matching reference photo)
      const stemGeo = new THREE.CylinderGeometry(0.18, 0.18, 5.0, 6);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.position.set(cx, cy + 2.5, cz);
      parentGroup.add(stemMesh);

      const pinGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const pinMat = new THREE.MeshStandardMaterial({
        color: beaconColor,
        emissive: beaconColor,
        emissiveIntensity: 0.6,
        roughness: 0.15
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(cx, cy + 5.5, cz);
      parentGroup.add(pinMesh);

      const pupilGeo = new THREE.SphereGeometry(0.65, 8, 8);
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
      pupilMesh.position.set(cx, cy + 5.5, cz + 0.95);
      parentGroup.add(pupilMesh);

      // Green Radar Coverage FOV Cone
      const fovHeight = 20;
      const fovRadius = 13;
      const fovGeo = new THREE.ConeGeometry(fovRadius, fovHeight, 16, 1, true);
      fovGeo.rotateX(Math.PI / 2.25);
      const fovMat = new THREE.MeshBasicMaterial({
        color: hasThreat ? 0xef4444 : 0x10b981,
        transparent: true,
        opacity: hasThreat ? 0.32 : 0.22,
        side: THREE.DoubleSide
      });
      const fovMesh = new THREE.Mesh(fovGeo, fovMat);
      fovMesh.position.set(cx, cy + towerHeight, cz - 4);
      parentGroup.add(fovMesh);
      cones.push(fovMesh);
    });

    // 3. Active Threat Distress Laser Beacons
    curAlerts.forEach((alt) => {
      if (alt.status === 'RESOLVED') return;
      const tLat = alt.latitude || centerRef.current[0] + 0.006;
      const tLng = alt.longitude || centerRef.current[1] + 0.006;
      const [tx, , tz] = gpsTo3D(tLat, tLng);
      const ty = getTerrainHeight(tx, tz);

      const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 55, 8);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(tx, ty + 27.5, tz);
      parentGroup.add(beamMesh);

      const shockGeo = new THREE.RingGeometry(1.5, 4.0, 16);
      shockGeo.rotateX(-Math.PI / 2);
      const shockMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
      const shockMesh = new THREE.Mesh(shockGeo, shockMat);
      shockMesh.position.set(tx, ty + 0.2, tz);
      parentGroup.add(shockMesh);
    });

    // 6. Render 3D Tactical Target Pin & Beacon if targetCoords is set
    if (targetCoords) {
      const [tx, , tz] = gpsTo3D(targetCoords[0], targetCoords[1]);
      const ty = getTerrainHeight(tx, tz);

      // Cyan Vertical Target Pillar Beam
      const tBeamGeo = new THREE.CylinderGeometry(0.4, 0.4, 60, 8);
      const tBeamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
      const tBeamMesh = new THREE.Mesh(tBeamGeo, tBeamMat);
      tBeamMesh.position.set(tx, ty + 30, tz);
      parentGroup.add(tBeamMesh);

      // Concentric Target Ground Rings
      const ringGeo1 = new THREE.RingGeometry(1.5, 4.0, 24);
      ringGeo1.rotateX(-Math.PI / 2);
      const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      ring1.position.set(tx, ty + 0.3, tz);
      parentGroup.add(ring1);

      const ringGeo2 = new THREE.RingGeometry(5.0, 7.5, 24);
      ringGeo2.rotateX(-Math.PI / 2);
      const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      ring2.position.set(tx, ty + 0.25, tz);
      parentGroup.add(ring2);

      // Glowing Sphere Marker Pin
      const headGeo = new THREE.SphereGeometry(2.2, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2
      });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(tx, ty + 12, tz);
      parentGroup.add(headMesh);
    }

    sweepConesRef.current = cones;
  }, [gpsTo3D, targetCoords]);

  // Main Three.js Scene Setup & Lifetime Loop (Runs ONCE on mount, NEVER destroyed during drag/zoom/orbit)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const heightPx = container.clientHeight || 540;

    const isDark = currentStyle === 'dark';

    // 1. Scene with Dark Atmosphere
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isDark ? 0x030712 : 0x0e0e12);
    scene.fog = new THREE.FogExp2(isDark ? 0x030712 : 0x0e0e12, 0.0012);

    // 2. Perspective Camera
    const camera = new THREE.PerspectiveCamera(44, width / heightPx, 1, 1500);
    cameraRef.current = camera;

    // 3. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.45 : 1.35;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(isDark ? 0x0c1e36 : 0xffffff, isDark ? 1.4 : 0.95);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(isDark ? 0x38bdf8 : 0xfff3e0, isDark ? 1.8 : 1.85);
    sunLight.position.set(-140, 220, -110);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const skyFill = new THREE.DirectionalLight(0x94a3b8, 0.55);
    skyFill.position.set(100, 150, 100);
    scene.add(skyFill);

    // 5. 3D Cutout Diorama Terrain Group
    const dioramaGroup = new THREE.Group();
    scene.add(dioramaGroup);
    dioramaGroupRef.current = dioramaGroup;

    // Top Terrain Mesh
    const terrainGeo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE, TERRAIN_RES, TERRAIN_RES);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const terrainTexture = generateTerrainTexture(currentStyle);
    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: isDark ? 0.75 : 0.85,
      metalness: isDark ? 0.2 : 0.08
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    dioramaGroup.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // 6. 3D Cutout Geological Skirt / Vertical Cross-Section Walls (matching image sides)
    const strataTexture = generateGeologicalStrataTexture(isDark);
    const skirtMat = new THREE.MeshStandardMaterial({
      map: strataTexture,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    const half = BLOCK_SIZE / 2;
    const skirtVerts: number[] = [];
    const skirtUvs: number[] = [];

    const addWallSegment = (x1: number, z1: number, x2: number, z2: number, u1: number, u2: number) => {
      const y1 = getTerrainHeight(x1, z1);
      const y2 = getTerrainHeight(x2, z2);
      const yBase = BASE_ELEVATION;

      skirtVerts.push(x1, y1, z1,  x1, yBase, z1,  x2, y2, z2);
      skirtUvs.push(u1, 1,  u1, 0,  u2, 1);

      skirtVerts.push(x2, y2, z2,  x1, yBase, z1,  x2, yBase, z2);
      skirtUvs.push(u2, 1,  u1, 0,  u2, 0);
    };

    const edgeSteps = TERRAIN_RES;
    const stepSize = BLOCK_SIZE / edgeSteps;

    // Side 1: South Edge (z = +half)
    for (let i = 0; i < edgeSteps; i++) {
      const x1 = -half + i * stepSize;
      const x2 = x1 + stepSize;
      addWallSegment(x1, half, x2, half, i / edgeSteps, (i + 1) / edgeSteps);
    }
    // Side 2: East Edge (x = +half)
    for (let i = 0; i < edgeSteps; i++) {
      const z1 = half - i * stepSize;
      const z2 = z1 - stepSize;
      addWallSegment(half, z1, half, z2, i / edgeSteps, (i + 1) / edgeSteps);
    }
    // Side 3: North Edge (z = -half)
    for (let i = 0; i < edgeSteps; i++) {
      const x1 = half - i * stepSize;
      const x2 = x1 - stepSize;
      addWallSegment(x1, -half, x2, -half, i / edgeSteps, (i + 1) / edgeSteps);
    }
    // Side 4: West Edge (x = -half)
    for (let i = 0; i < edgeSteps; i++) {
      const z1 = -half + i * stepSize;
      const z2 = z1 + stepSize;
      addWallSegment(-half, z1, -half, z2, i / edgeSteps, (i + 1) / edgeSteps);
    }

    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtVerts, 3));
    skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUvs, 2));
    skirtGeo.computeVertexNormals();
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    dioramaGroup.add(skirtMesh);
    skirtMeshRef.current = skirtMesh;

    // Bottom Base Plate
    const baseGeo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
    baseGeo.rotateX(Math.PI / 2);
    const baseMat = new THREE.MeshBasicMaterial({ color: isDark ? 0x020617 : 0x1f1610 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = BASE_ELEVATION;
    dioramaGroup.add(baseMesh);

    // 7. Dedicated Dynamic Markers Group (Fences, Towers, Pins, Cones, Beacons)
    const dynamicGroup = new THREE.Group();
    dioramaGroup.add(dynamicGroup);
    dynamicMarkersGroupRef.current = dynamicGroup;

    // Initial build of dynamic markers
    rebuildDynamicMarkers();

    // 8. Bulletproof Pointer Event Handling (Touch + Mouse unified with Pointer Capture)
    const domElement = renderer.domElement;
    domElement.style.touchAction = 'none'; // Prevent browser gesture interference

    const onPointerDown = (e: PointerEvent) => {
      // Ignore if click originated on floating buttons or cards
      if ((e.target as HTMLElement)?.closest('button, a, input, select')) return;

      isUserDraggingRef.current = true;
      dragButtonRef.current = e.button;
      previousPointerPosRef.current = { x: e.clientX, y: e.clientY };

      try {
        domElement.setPointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isUserDraggingRef.current) return;
      const deltaX = e.clientX - previousPointerPosRef.current.x;
      const deltaY = e.clientY - previousPointerPosRef.current.y;
      previousPointerPosRef.current = { x: e.clientX, y: e.clientY };

      if (dragButtonRef.current === 0) {
        // Orbit / Rotate (Touch or Left Click)
        targetOrbitAnglesRef.current.phi = Math.max(0.08, Math.min(Math.PI / 2.05, targetOrbitAnglesRef.current.phi + deltaY * 0.007));
        orbitAnglesRef.current.phi = targetOrbitAnglesRef.current.phi;
        orbitAnglesRef.current.theta -= deltaX * 0.007;
      } else if (dragButtonRef.current === 2) {
        // Pan (Right Click)
        const panSpeed = 0.18;
        desiredLookAtRef.current.x -= deltaX * panSpeed;
        desiredLookAtRef.current.z += deltaY * panSpeed;
        targetLookAtRef.current.x = desiredLookAtRef.current.x;
        targetLookAtRef.current.z = desiredLookAtRef.current.z;
      }
    };

    const onPointerRelease = (e: PointerEvent) => {
      isUserDraggingRef.current = false;
      try {
        domElement.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const newRad = Math.max(90, Math.min(480, targetOrbitAnglesRef.current.radius + e.deltaY * 0.08));
      targetOrbitAnglesRef.current.radius = newRad;
      orbitAnglesRef.current.radius = newRad;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // Attach primary pointer events on canvas
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerRelease);
    domElement.addEventListener('pointercancel', onPointerRelease);
    domElement.addEventListener('lostpointercapture', onPointerRelease);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', onContextMenu);

    // Global safety release listeners
    const globalRelease = () => {
      isUserDraggingRef.current = false;
    };
    window.addEventListener('pointerup', globalRelease);
    window.addEventListener('pointercancel', globalRelease);
    window.addEventListener('mouseup', globalRelease);
    window.addEventListener('touchend', globalRelease);
    window.addEventListener('touchcancel', globalRelease);

    const clock = new THREE.Clock();
    const projVector = new THREE.Vector3();

    // 9. Continuous 60 FPS Elevated Overview Orbit Loop with Smooth Lerp
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Rotate green radar FOV sweep cones
      const cones = sweepConesRef.current;
      for (let i = 0; i < cones.length; i++) {
        cones[i].rotation.z += delta * 0.35;
      }

      // Smoothly interpolate radius, phi, and lookAt to desired vantage targets
      const curRadius = orbitAnglesRef.current.radius;
      const targetRadius = targetOrbitAnglesRef.current.radius;
      orbitAnglesRef.current.radius += (targetRadius - curRadius) * 0.08;

      const curPhi = orbitAnglesRef.current.phi;
      const targetPhi = targetOrbitAnglesRef.current.phi;
      orbitAnglesRef.current.phi += (targetPhi - curPhi) * 0.08;

      targetLookAtRef.current.lerp(desiredLookAtRef.current, 0.08);

      // Auto flythrough continuous orbit
      if (isPlayingOrbitRef.current && !isUserDraggingRef.current) {
        orbitAnglesRef.current.theta += delta * 0.09 * orbitSpeedRef.current;
      }

      const { theta, phi, radius } = orbitAnglesRef.current;
      const target = targetLookAtRef.current;

      const cx = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const cy = target.y + radius * Math.cos(phi);
      const cz = target.z + radius * Math.sin(phi) * Math.cos(theta);

      camera.position.set(cx, cy, cz);
      camera.lookAt(target);

      // Project Location Label Badges (white badge with vertical leader line)
      const curCams = camerasRef.current;
      const curCenter = centerRef.current;
      const curW = container.clientWidth || width;
      const curH = container.clientHeight || heightPx;

      for (let i = 0; i < curCams.length; i++) {
        const cam = curCams[i];
        const el = labelRefsMap.current.get(cam.camera_id);
        if (!el) continue;

        const lat = cam.latitude || curCenter[0];
        const lng = cam.longitude || curCenter[1];
        const [px, , pz] = gpsTo3D(lat, lng);
        const py = getTerrainHeight(px, pz) + 6.8;

        projVector.set(px, py, pz).project(camera);

        if (projVector.z < 1.0 && projVector.z > -1.0) {
          const sx = ((projVector.x + 1) * curW) / 2;
          const sy = ((-projVector.y + 1) * curH) / 2;
          el.style.display = 'block';
          el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
        } else {
          el.style.display = 'none';
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerRelease);
      domElement.removeEventListener('pointercancel', onPointerRelease);
      domElement.removeEventListener('lostpointercapture', onPointerRelease);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('contextmenu', onContextMenu);

      window.removeEventListener('pointerup', globalRelease);
      window.removeEventListener('pointercancel', globalRelease);
      window.removeEventListener('mouseup', globalRelease);
      window.removeEventListener('touchend', globalRelease);
      window.removeEventListener('touchcancel', globalRelease);

      terrainGeo.dispose();
      terrainMat.dispose();
      skirtGeo.dispose();
      skirtMat.dispose();
      baseGeo.dispose();
      baseMat.dispose();
      renderer.dispose();
    };
  }, [rebuildDynamicMarkers, gpsTo3D]);

  // Secondary effect: update dynamic markers whenever cameras, alerts, selected camera, or target coords updates (ZERO Three.js tear-down)
  useEffect(() => {
    rebuildDynamicMarkers();
  }, [cameras, alerts, selectedCameraId, center, targetCoords, rebuildDynamicMarkers]);

  // Smoothly swoop 3D camera vantage to focus on targetCoords when jumped
  useEffect(() => {
    if (!targetCoords) return;
    const [tx, , tz] = gpsTo3D(targetCoords[0], targetCoords[1]);
    const ty = getTerrainHeight(tx, tz);
    desiredLookAtRef.current.set(tx, ty + 6, tz);
    targetOrbitAnglesRef.current = { phi: Math.PI / 3.6, radius: 160 };
    isPlayingOrbitRef.current = true;
    setIsPlayingOrbit(true);
  }, [targetCoords?.[0], targetCoords?.[1], gpsTo3D]);

  // Tertiary effect: Instant style change without rebuilding geometry or scene graph
  useEffect(() => {
    if (!terrainMeshRef.current || !sceneRef.current) return;
    const isDark = currentStyle === 'dark';
    const mat = terrainMeshRef.current.material as THREE.MeshStandardMaterial;
    mat.map = generateTerrainTexture(currentStyle);
    mat.roughness = isDark ? 0.75 : 0.85;
    mat.metalness = isDark ? 0.2 : 0.08;
    mat.needsUpdate = true;

    if (skirtMeshRef.current) {
      const skirtMat = skirtMeshRef.current.material as THREE.MeshStandardMaterial;
      skirtMat.map = generateGeologicalStrataTexture(isDark);
      skirtMat.needsUpdate = true;
    }

    sceneRef.current.background = new THREE.Color(isDark ? 0x030712 : 0x0e0e12);
    if (sceneRef.current.fog) {
      sceneRef.current.fog.color = new THREE.Color(isDark ? 0x030712 : 0x0e0e12);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(isDark ? 0x0c1e36 : 0xffffff);
      ambientLightRef.current.intensity = isDark ? 1.4 : 0.95;
    }
    if (sunLightRef.current) {
      sunLightRef.current.color.setHex(isDark ? 0x38bdf8 : 0xfff3e0);
      sunLightRef.current.intensity = isDark ? 1.8 : 1.85;
    }
  }, [currentStyle]);

  const handleSelectCam = (cam: Camera) => {
    setActiveCamDetails(cam);
    if (onCameraSelect) onCameraSelect(cam);
  };

  const threatsSet = new Set(
    alerts.filter((a) => a.status !== 'RESOLVED' && a.camera_id).map((a) => a.camera_id.toLowerCase())
  );

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 select-none rounded-xl border border-slate-800" style={{ height }}>
      {/* 3D WebGL Diorama Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing z-0" />

      {/* Floating White Text Badges with Thin Leader Line (matching reference image) */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {cameras.map((cam) => {
          const hasThreat = threatsSet.has(cam.camera_id.toLowerCase());
          const isSelected = selectedCameraId === cam.camera_id;
          return (
            <div
              key={cam.camera_id}
              ref={(el) => {
                if (el) labelRefsMap.current.set(cam.camera_id, el);
                else labelRefsMap.current.delete(cam.camera_id);
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                display: 'none',
                willChange: 'transform'
              }}
              className="pointer-events-auto flex flex-col items-center"
            >
              {/* White Rectangular Label Box */}
              <button
                type="button"
                onClick={() => handleSelectCam(cam)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded shadow-xl transition cursor-pointer border text-xs font-semibold ${
                  hasThreat
                    ? 'bg-rose-600 text-white border-rose-700 animate-bounce'
                    : isSelected
                    ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                    : 'bg-white/95 hover:bg-white text-slate-900 border-slate-300 shadow-md hover:scale-105'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[140px]">{cam.camera_name || cam.camera_id}</span>
              </button>

              {/* Vertical Leader Line connecting badge to 3D pin on ground */}
              <div className="w-[1.5px] h-4 bg-white/80 shadow-sm" />
            </div>
          );
        })}
      </div>

      {/* UNIFIED COMMAND DECK: FIXED IN ONE POSITION AT THE TOP (NO CLUTTER, NO OVERLAPS) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-xl shadow-2xl overflow-x-auto"
      >
        {/* Section 1: Dimension (2D / 3D) and Visual Styles (Satellite / Dark / Topo) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dimension Switcher */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={onSwitchTo2D || onClose3D}
              className="px-2.5 py-1 rounded-md text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
            >
              <span>🗺️</span>
              <span>2D Radar</span>
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-600 text-white shadow transition cursor-pointer flex items-center gap-1"
            >
              <span>⛰️</span>
              <span>3D Diorama</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-700 hidden sm:block" />

          {/* Visual Style Switcher */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStyle('satellite')}
              className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'satellite' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Photorealistic Satellite Terrain"
            >
              <span>🛰️</span>
              <span>Satellite</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStyle('dark')}
              className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'dark' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Tactical Dark Mode Terrain"
            >
              <span>🌌</span>
              <span>Dark Ops</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStyle('topo')}
              className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                currentStyle === 'topo' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Topographic Elevation Relief"
            >
              <span>🗺️</span>
              <span>Topo</span>
            </button>
          </div>
        </div>

        {/* Section 2: Vantage Presets (Responsive) */}
        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => handleJumpVantage('overview')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
              currentVantage === 'overview' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Whole Terrain Block Overview"
          >
            <span>🦅</span>
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpVantage('aerial')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
              currentVantage === 'aerial' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="60 Degree Aerial 3D Angle"
          >
            <span>📐</span>
            <span>60° Aerial</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpVantage('ridge')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
              currentVantage === 'ridge' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🏔️</span>
            <span>Ridge</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpVantage('fence')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
              currentVantage === 'fence' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🛡️</span>
            <span>Border</span>
          </button>
        </div>

        {/* Section 3: Camera Tilt, Orbit Animation, Zoom & Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tilt Controls */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => handleManualTilt('up')}
              className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer flex items-center gap-0.5 text-xs font-mono font-semibold"
              title="Tilt Camera Up (Top-Down)"
            >
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tilt Up</span>
            </button>
            <button
              type="button"
              onClick={() => handleManualTilt('down')}
              className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer flex items-center gap-0.5 text-xs font-mono font-semibold"
              title="Tilt Camera Down (Horizon)"
            >
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tilt Down</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-700 hidden sm:block" />

          {/* Orbit Toggle */}
          <button
            type="button"
            onClick={handleToggleOrbit}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer shadow ${
              isPlayingOrbit ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlayingOrbit ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlayingOrbit ? 'Pause' : 'Orbit'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSpeed}
            className="px-2 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-xs font-mono font-bold text-slate-300 hover:text-white transition cursor-pointer"
            title="Toggle Orbit Speed (0.5x / 1.0x / 2.0x)"
          >
            {orbitSpeed}x
          </button>

          {/* Zoom In / Out */}
          <button
            type="button"
            onClick={() => handleManualZoom(-20)}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => handleManualZoom(20)}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4 text-emerald-400" />
          </button>

          {onClose3D && (
            <button
              type="button"
              onClick={onClose3D}
              title="Close 3D View"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Right: Clean Telemetry Strip */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <div className="px-3 py-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-2 shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Nodes: <strong className="text-emerald-400">{cameras.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>BOPs: <strong className="text-emerald-400">{bops.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Drag to orbit 3D block</span>
        </div>
      </div>

      {/* Selected Camera Stream Card Overlay */}
      {activeCamDetails && (
        <div className="absolute bottom-14 left-3 right-3 sm:left-auto sm:right-3 sm:w-84 z-20 bg-slate-900/95 border border-emerald-500/50 p-3.5 rounded-xl shadow-2xl backdrop-blur-md flex flex-col gap-2 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Cctv className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white truncate max-w-[170px]">{activeCamDetails.camera_name}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveCamDetails(null)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">CAMERA ID:</span>
              <strong className="text-emerald-300">{activeCamDetails.camera_id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">SECTOR:</span>
              <span className="text-slate-200">{activeCamDetails.bop_site || 'Border Post'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">STATUS:</span>
              <span className={activeCamDetails.status === 'ONLINE' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {activeCamDetails.status}
              </span>
            </div>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 relative">
            <LiveVideoPlayer camera={activeCamDetails} autoPlay showControls={false} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setInspectedCam(activeCamDetails);
                if (onInspectCamera) onInspectCamera(activeCamDetails);
              }}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>INSPECT LIVE FEED</span>
            </button>
          </div>
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
