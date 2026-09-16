import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OutpostData {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  isHQ?: boolean;
  color: number;
}

const OUTPOSTS: OutpostData[] = [
  { id: 'hq', name: 'New Delhi HQ', code: 'C2-DELHI', lat: 28.6139, lon: 77.2090, isHQ: true, color: 0x00f5ff },
  { id: 'wagah', name: 'Wagah Border Post', code: 'BOP-WAGAH', lat: 31.6053, lon: 74.5721, color: 0x10b981 },
  { id: 'uri', name: 'Uri / LoC Outpost', code: 'BOP-URI', lat: 34.0850, lon: 74.0300, color: 0x38bdf8 },
  { id: 'ladakh', name: 'Galwan / DBO Post', code: 'BOP-GALWAN', lat: 34.3500, lon: 78.2000, color: 0x06b6d4 },
  { id: 'thar', name: 'Jaisalmer Desert Post', code: 'BOP-THAR', lat: 26.9157, lon: 70.9083, color: 0xf59e0b },
  { id: 'kutch', name: 'Sir Creek Marine Post', code: 'BOP-KUTCH', lat: 23.7000, lon: 68.7000, color: 0x14b8a6 },
  { id: 'sikkim', name: 'Nathu La Pass Post', code: 'BOP-SIKKIM', lat: 27.3860, lon: 88.8310, color: 0x6366f1 },
  { id: 'dawki', name: 'Dawki Eastern Outpost', code: 'BOP-DAWKI', lat: 25.1800, lon: 92.0200, color: 0x10b981 },
];

// Convert Lat/Lon (degrees) to 3D Cartesian coordinates on sphere of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export const TacticalGlobe3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020611, 0.025);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.4, 6.2);

    // 3. Renderer with high-DPI & Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 4. Realistic Space Lighting
    // Ambient light: subtle deep cosmic starlight
    const ambientLight = new THREE.AmbientLight(0x132a48, 1.1);
    scene.add(ambientLight);

    // Direct Sunlight: Bright white-gold sunlight casting across day hemisphere
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.8);
    sunLight.position.set(6, 3, 5);
    scene.add(sunLight);

    // Subtle atmospheric blue rim light from the dark side
    const rimLight = new THREE.DirectionalLight(0x00d2ff, 1.3);
    rimLight.position.set(-6, -2, -4);
    scene.add(rimLight);

    // 5. Texture Loader
    const textureLoader = new THREE.TextureLoader();
    const dayTexture = textureLoader.load('/textures/earth_day.jpg');
    const cloudsTexture = textureLoader.load('/textures/earth_clouds.png');
    const normalTexture = textureLoader.load('/textures/earth_normal.jpg');
    const specularTexture = textureLoader.load('/textures/earth_specular.jpg');

    // 6. Master Earth Group (Allows smooth unified 360° mouse rotation)
    const GLOBE_RADIUS = 2.4;
    const earthGroup = new THREE.Group();
    // Tilt to show India / Asian subcontinent majestically toward viewer
    earthGroup.rotation.x = 0.28;
    earthGroup.rotation.y = -1.45;
    scene.add(earthGroup);

    // 7. Photorealistic Earth Surface Mesh
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.9, 0.9),
      specularMap: specularTexture,
      specular: new THREE.Color(0x336699),
      shininess: 25,
      emissive: new THREE.Color(0x020914),
      emissiveIntensity: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 8. Realistic 3D Cloud Layer (Floating above Earth with independent rotation)
    const CLOUD_RADIUS = GLOBE_RADIUS * 1.015;
    const cloudsGeo = new THREE.SphereGeometry(CLOUD_RADIUS, 64, 64);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    // 9. Realistic Rayleigh Atmospheric Glow (Outer Fresnel Rim Shader)
    const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.15;
    const atmosphereGeo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 48, 48);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform vec3 color;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float rim = pow(0.68 - dot(vNormal, viewDir), 2.5);
          gl_FragColor = vec4(color, rim * 0.95);
        }
      `,
      uniforms: {
        color: { value: new THREE.Color(0x38bdf8) },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthGroup.add(atmosphereMesh);

    // 10. Tactical Border Beacons & Ground Pulse Rings
    const beaconPulseRings: { mesh: THREE.Mesh; scale: number; speed: number }[] = [];
    const outpostPositions: { [id: string]: THREE.Vector3 } = {};

    OUTPOSTS.forEach((outpost) => {
      const pos = latLonToVector3(outpost.lat, outpost.lon, GLOBE_RADIUS);
      outpostPositions[outpost.id] = pos;

      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(pos);

      // Normal vector pointing straight out from sphere surface
      const normal = pos.clone().normalize();
      beaconGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Glowing Vertical Beacon Cylinder
      const cylHeight = outpost.isHQ ? 0.35 : 0.24;
      const cylGeo = new THREE.CylinderGeometry(
        outpost.isHQ ? 0.022 : 0.014,
        outpost.isHQ ? 0.03 : 0.018,
        cylHeight,
        16
      );
      cylGeo.translate(0, cylHeight / 2, 0);
      const cylMat = new THREE.MeshBasicMaterial({
        color: outpost.color,
        transparent: true,
        opacity: 0.9,
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      beaconGroup.add(cylMesh);

      // Glowing Tip Sphere Cap
      const tipRadius = outpost.isHQ ? 0.05 : 0.035;
      const tipGeo = new THREE.SphereGeometry(tipRadius, 16, 16);
      tipGeo.translate(0, cylHeight, 0);
      const tipMat = new THREE.MeshBasicMaterial({
        color: outpost.isHQ ? 0xffffff : outpost.color,
      });
      const tipMesh = new THREE.Mesh(tipGeo, tipMat);
      beaconGroup.add(tipMesh);

      // Animated Expanding Ground Target Rings
      const ringGeo = new THREE.RingGeometry(0.025, 0.065, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: outpost.color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      beaconGroup.add(ringMesh);

      beaconPulseRings.push({
        mesh: ringMesh,
        scale: Math.random() * 2,
        speed: outpost.isHQ ? 1.8 : 1.2,
      });

      earthGroup.add(beaconGroup);
    });

    // 11. Defense Laser Arcs & Traveling Data Packets
    const hqPos = outpostPositions['hq'];
    const pulseSpheres: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; speed: number; offset: number }[] = [];

    OUTPOSTS.filter((o) => !o.isHQ).forEach((outpost, idx) => {
      const outPos = outpostPositions[outpost.id];
      if (!outPos || !hqPos) return;

      // Arc midpoint elevated gracefully above the clouds
      const mid = new THREE.Vector3().addVectors(outPos, hqPos).multiplyScalar(0.5);
      const dist = outPos.distanceTo(hqPos);
      const altitude = GLOBE_RADIUS + 0.38 + dist * 0.45;
      mid.normalize().multiplyScalar(altitude);

      const curve = new THREE.QuadraticBezierCurve3(outPos, mid, hqPos);
      const points = curve.getPoints(40);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);

      const arcMat = new THREE.LineBasicMaterial({
        color: outpost.color,
        transparent: true,
        opacity: 0.65,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      earthGroup.add(arcLine);

      // Glowing Data Pulse Traveling Sphere
      const pulseGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.95,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      earthGroup.add(pulseMesh);

      pulseSpheres.push({
        mesh: pulseMesh,
        curve,
        speed: 0.45 + (idx % 3) * 0.15,
        offset: idx * 0.25,
      });
    });

    // 12. Orbiting 3D Recon Satellite with Scanning Radar
    const satelliteGroup = new THREE.Group();
    // Satellite Chassis
    const satBodyGeo = new THREE.BoxGeometry(0.09, 0.08, 0.14);
    const satBodyMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.85,
      roughness: 0.2,
    });
    const satBody = new THREE.Mesh(satBodyGeo, satBodyMat);
    satelliteGroup.add(satBody);

    // Solar Panel Arrays
    const wingGeo = new THREE.BoxGeometry(0.35, 0.006, 0.1);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.7,
      roughness: 0.3,
    });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.24, 0, 0);
    satelliteGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.24, 0, 0);
    satelliteGroup.add(rightWing);

    // Downward Scanning Wireframe Radar Cone
    const coneHeight = 1.35;
    const coneGeo = new THREE.ConeGeometry(0.55, coneHeight, 16, 1, true);
    coneGeo.translate(0, -coneHeight / 2, 0);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    });
    const radarCone = new THREE.Mesh(coneGeo, coneMat);
    satelliteGroup.add(radarCone);

    scene.add(satelliteGroup);

    // 13. Deep Cosmic Starfield
    const starCount = 2200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 35 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      // Subtle star color temperature variation (cool blue, diamond white, warm amber)
      const colorType = Math.random();
      if (colorType > 0.8) {
        starColors[i * 3] = 0.55;
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 1.0;
      } else if (colorType > 0.6) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.88;
        starColors[i * 3 + 2] = 0.7;
      } else {
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.98;
        starColors[i * 3 + 2] = 1.0;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 14. Mouse & Touch Drag Interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let velocityX = 0;
    let velocityY = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      previousMousePosition = { x: clientX, y: clientY };
      velocityX = 0;
      velocityY = 0;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - previousMousePosition.x;
      const deltaY = clientY - previousMousePosition.y;

      velocityX = deltaX * 0.005;
      velocityY = deltaY * 0.005;

      earthGroup.rotation.y += velocityX;
      earthGroup.rotation.x = Math.max(-1.1, Math.min(1.1, earthGroup.rotation.x + velocityY));

      previousMousePosition = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 15. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const orbitRadius = GLOBE_RADIUS + 1.4;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Earth & Atmosphere gentle rotation
      if (!isDragging) {
        earthGroup.rotation.y += 0.0011 + velocityX;
        earthGroup.rotation.x = Math.max(-1.1, Math.min(1.1, earthGroup.rotation.x + velocityY));
        velocityX *= 0.94;
        velocityY *= 0.94;
      }

      // Clouds independent rotation (creates realistic 3D parallax depth)
      cloudsMesh.rotation.y += 0.0005;

      // Slow cosmic starfield rotation
      starField.rotation.y += 0.00015;

      // Animate Beacon Ground Pulse Rings
      beaconPulseRings.forEach((ring) => {
        ring.scale += 0.026 * ring.speed;
        if (ring.scale > 3.2) ring.scale = 0.2;
        const currentScale = ring.scale;
        ring.mesh.scale.set(currentScale, currentScale, currentScale);
        const mat = ring.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.85 * (1 - currentScale / 3.2));
      });

      // Animate Defense Laser Data Pulse Spheres
      pulseSpheres.forEach((p) => {
        const t = (elapsed * p.speed + p.offset) % 1.0;
        const pos = p.curve.getPoint(t);
        p.mesh.position.copy(pos);
      });

      // Animate Orbiting Recon Satellite
      const orbitSpeed = 0.32;
      const orbitAngle = elapsed * orbitSpeed;
      const satX = Math.cos(orbitAngle) * orbitRadius;
      const satZ = Math.sin(orbitAngle) * orbitRadius;
      const satY = Math.sin(orbitAngle * 1.4) * 0.95;

      satelliteGroup.position.set(satX, satY, satZ);
      satelliteGroup.lookAt(0, 0, 0);

      // Pulse Radar Cone scanning wireframe opacity
      coneMat.opacity = 0.22 + 0.22 * Math.sin(elapsed * 4.5);

      renderer.render(scene, camera);
    };

    animate();

    // 16. Complete Memory Disposal & Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);

      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('resize', handleResize);

      earthGeo.dispose();
      earthMat.dispose();
      cloudsGeo.dispose();
      cloudsMat.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      dayTexture.dispose();
      cloudsTexture.dispose();
      normalTexture.dispose();
      specularTexture.dispose();
      starGeo.dispose();
      starMat.dispose();
      satBodyGeo.dispose();
      satBodyMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      coneGeo.dispose();
      coneMat.dispose();

      pulseSpheres.forEach((p) => {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
      });

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden select-none"
    />
  );
};

export default TacticalGlobe3D;
