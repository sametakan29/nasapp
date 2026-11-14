'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Camera, Compass, Eye, Orbit } from 'lucide-react';
import { HourlyTelemetry, interpolateHorizon, LandingSite } from '@/lib/lunarScience';

export type CameraPreset = 'orbital' | 'lander' | 'topdown';

interface LunarViewport3DProps {
  site: LandingSite;
  current: HourlyTelemetry;
}

// Consistent vertical exaggeration factor applied to terrain rim height and Sun/Earth elevation tangents
// so grazing South Pole angles (0.2° - 8°) produce clear, physically consistent 3D crater shadows.
const VERTICAL_EXAG = 2.6;
const TERRAIN_SIZE = 96;
const TERRAIN_SEGMENTS = 150;
const RIM_RADIUS = 36;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts (azimuthDeg, elevationDeg) to a normalized 3D unit vector in Three.js world space:
 * North (0 deg) = -Z, East (90 deg) = +X, South (180 deg) = +Z, West (270 deg) = -X, Up = +Y.
 */
function azElevToVector3(
  azDeg: number,
  elevDeg: number,
  verticalExag = VERTICAL_EXAG
): THREE.Vector3 {
  const azRad = degToRad(azDeg);
  const clampedElev = Math.max(-20, Math.min(85, elevDeg));
  const tanExag = Math.tan(degToRad(clampedElev)) * verticalExag;
  const horiz = Math.cos(degToRad(clampedElev));
  const x = horiz * Math.sin(azRad);
  const z = -horiz * Math.cos(azRad);
  const y = horiz * tanExag;
  return new THREE.Vector3(x, y, z).normalize();
}

function deterministicNoise(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 0.21 + seed * 1.3) * Math.cos(z * 0.19 - seed * 0.7);
  const n2 = Math.sin((x + z) * 0.47 + seed) * 0.5;
  return (n + n2) * 0.5;
}

function populateSiteTerrainGeometry(geometry: THREE.BufferGeometry, site: LandingSite) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const seed = site.id === 'malapert' ? 1.1 : site.id === 'shackleton' ? 2.7 : 4.3;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // PlaneGeometry rotated -PI/2 around X puts local Y into world -Z
    const worldZ = -pos.getY(i);
    const r = Math.hypot(x, worldZ);

    // Azimuth: 0 = North (-Z), 90 = East (+X)
    const azDeg = ((Math.atan2(x, -worldZ) * 180) / Math.PI + 360) % 360;
    const maskElevDeg = interpolateHorizon(site.horizonMask, azDeg);

    // Target height at RIM_RADIUS matches tan(maskElevDeg) * VERTICAL_EXAG * RIM_RADIUS
    const targetRimHeight = RIM_RADIUS * Math.tan(degToRad(maskElevDeg)) * VERTICAL_EXAG;

    let height = 0;

    if (r > 5.5) {
      // Smoothly ramp from flat landing pad (r <= 5.5) up to the crater rim crest around r = RIM_RADIUS
      const t = Math.min(1, Math.max(0, (r - 5.5) / (RIM_RADIUS - 5.5)));
      const smoothRamp = t * t * (3 - 2 * t);

      // Outer slope gently rolls off beyond RIM_RADIUS while preserving silhouette
      const outerDecay =
        r > RIM_RADIUS ? Math.max(0.72, 1 - (r - RIM_RADIUS) * 0.015) : 1.0;

      // Micro-topography & small craterlets (zeroed near landing pad)
      const roughness =
        smoothRamp *
        (0.28 * deterministicNoise(x, worldZ, seed) +
          0.14 * deterministicNoise(x * 2.3, worldZ * 2.3, seed + 5));

      // Subtle ridge crest peaking right at RIM_RADIUS so horizon angle matches mask precisely
      const crestBoost = Math.exp(-Math.pow((r - RIM_RADIUS) / 6.5, 2)) * 0.14 * targetRimHeight;

      height = Math.max(0, targetRimHeight * smoothRamp * outerDecay + crestBoost + roughness);

      // For Shackleton, carve a deep PSR crater drop just beyond the southern rim interior (150-210 deg)
      if (site.id === 'shackleton' && r > RIM_RADIUS + 4 && azDeg > 135 && azDeg < 225) {
        const craterDepth = Math.min(6.5, (r - (RIM_RADIUS + 4)) * 0.65);
        height -= craterDepth;
      }
    } else {
      // Flat cleared regolith landing pad avoids grazing-angle self-shadow ripples
      height = 0;
    }

    pos.setZ(i, height);

    // Vertex shading: dark lunar regolith base with subtle highland brightness on elevated ridges
    const shade = Math.min(0.75, Math.max(0.24, 0.34 + height * 0.028 + 0.03 * deterministicNoise(x, worldZ, seed)));
    colors[i * 3] = shade * 0.96;
    colors[i * 3 + 1] = shade * 0.98;
    colors[i * 3 + 2] = shade * 1.04;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

export default function LunarViewport3D({ site, current }: LunarViewport3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbital');

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    terrainGeo: THREE.BufferGeometry;
    sunLight: THREE.DirectionalLight;
    sunMesh: THREE.Mesh;
    solarWingsPivot: THREE.Group;
    dishPivot: THREE.Group;
    beaconMesh: THREE.Mesh;
    beaconLight: THREE.PointLight;
    dteLineSolid: THREE.Line;
    dteLineDashed: THREE.Line;
    earthMesh: THREE.Mesh;
  } | null>(null);

  // Initialize Three.js WebGL Scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05080F');
    scene.fog = new THREE.FogExp2('#05080F', 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    camera.position.set(26, 17, 29);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 5;
    controls.maxDistance = 85;
    controls.target.set(0, 1.2, 0);
    controls.update();

    // Deep-space ambient + earthshine hemisphere fill so shadowed craters and lander remain legible
    const ambientLight = new THREE.AmbientLight('#1e293b', 0.45);
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight('#1e293b', '#090d16', 0.45);
    scene.add(hemiLight);

    // Dynamic Solar Directional Light (real-time shadow caster)
    const sunLight = new THREE.DirectionalLight('#fff5db', 3.1);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 190;
    sunLight.shadow.camera.left = -48;
    sunLight.shadow.camera.right = 48;
    sunLight.shadow.camera.top = 48;
    sunLight.shadow.camera.bottom = -48;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Starfield Dome
    const starPositions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.92 + 0.08); // upper hemisphere
      const r = 165 + Math.random() * 30;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: '#cbd5e1',
      size: 0.55,
      sizeAttenuation: true,
      fog: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Procedural Lunar South Pole Terrain Mesh
    const terrainGeo = new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    );
    populateSiteTerrainGeometry(terrainGeo, site);
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Subtle Compass Ring around Landing Pad
    const ringGeo = new THREE.RingGeometry(4.4, 4.55, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#0ea5e9',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const compassRing = new THREE.Mesh(ringGeo, ringMat);
    compassRing.rotation.x = -Math.PI / 2;
    compassRing.position.y = 0.06;
    scene.add(compassRing);

    // North Tick Marker (-Z)
    const northTick = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.9),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    northTick.position.set(0, 0.07, -4.9);
    scene.add(northTick);

    // CLPS Lander Procedural Model (scaled 1.25x for shadow readability)
    const landerGroup = new THREE.Group();
    landerGroup.scale.setScalar(1.25);

    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      emissive: '#451a03',
      emissiveIntensity: 0.25,
      roughness: 0.32,
      metalness: 0.82,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      emissive: '#1e293b',
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.65,
    });
    const darkCarbonMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.65,
      metalness: 0.4,
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: '#1d4ed8',
      emissive: '#1e3a8a',
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.7,
    });

    // Descent Stage Bus
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.95, 8), goldFoilMat);
    bus.position.y = 1.15;
    bus.castShadow = true;
    bus.receiveShadow = true;
    landerGroup.add(bus);

    // Upper Instrument Deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.38, 8), titaniumMat);
    deck.position.y = 1.8;
    deck.castShadow = true;
    landerGroup.add(deck);

    // 4 Landing Legs & Footpads
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const legPivot = new THREE.Group();
      legPivot.rotation.y = angle;

      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.35, 8), titaniumMat);
      strut.position.set(1.05, 0.58, 0);
      strut.rotation.z = -0.52;
      strut.castShadow = true;
      legPivot.add(strut);

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.08, 12), darkCarbonMat);
      pad.position.set(1.42, 0.04, 0);
      pad.castShadow = true;
      pad.receiveShadow = true;
      legPivot.add(pad);

      landerGroup.add(legPivot);
    }

    // Gimbaled Solar Wings Pivot (rotates toward Sun Azimuth)
    const solarWingsPivot = new THREE.Group();
    solarWingsPivot.position.y = 1.55;
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.68), solarPanelMat);
    leftWing.position.x = -1.7;
    leftWing.rotation.x = 0.2;
    leftWing.castShadow = true;
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.68), solarPanelMat);
    rightWing.position.x = 1.7;
    rightWing.rotation.x = 0.2;
    rightWing.castShadow = true;
    solarWingsPivot.add(leftWing, rightWing);
    landerGroup.add(solarWingsPivot);

    // High-Gain X-Band Dish Pivot (rotates toward Earth Azimuth)
    const dishPivot = new THREE.Group();
    dishPivot.position.set(0, 2.22, 0);
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), titaniumMat);
    dishMast.position.y = -0.18;
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.1, 0.16, 16),
      titaniumMat
    );
    dish.rotation.x = Math.PI / 2 - 0.15;
    dish.castShadow = true;
    dishPivot.add(dishMast, dish);
    landerGroup.add(dishPivot);

    // Pulsing Telemetry Beacon
    const beaconGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, 2.55, 0);
    landerGroup.add(beaconMesh);

    const beaconLight = new THREE.PointLight('#22d3ee', 2.2, 8);
    beaconLight.position.set(0, 2.65, 0);
    landerGroup.add(beaconLight);

    scene.add(landerGroup);

    // Sun Sky Sphere Indicator (fog disabled so sky bodies remain crisp)
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#fde047', fog: false })
    );
    scene.add(sunMesh);

    // Earth Sky Sphere Indicator
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', fog: false })
    );
    scene.add(earthMesh);

    // Earth DTE Vector Beams (Solid Cyan when locked, Dashed Red when terrain occluded)
    const dteOrigin = new THREE.Vector3(0, 2.775, 0);
    const dteInitEnd = new THREE.Vector3(0, 4, -55);

    const solidGeo = new THREE.BufferGeometry().setFromPoints([dteOrigin, dteInitEnd]);
    const solidMat = new THREE.LineBasicMaterial({
      color: '#06b6d4',
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    const dteLineSolid = new THREE.Line(solidGeo, solidMat);
    scene.add(dteLineSolid);

    const dashedGeo = new THREE.BufferGeometry().setFromPoints([dteOrigin, dteInitEnd]);
    const dashedMat = new THREE.LineDashedMaterial({
      color: '#ef4444',
      dashSize: 1.4,
      gapSize: 0.9,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    const dteLineDashed = new THREE.Line(dashedGeo, dashedMat);
    dteLineDashed.computeLineDistances();
    scene.add(dteLineDashed);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      terrainGeo,
      sunLight,
      sunMesh,
      solarWingsPivot,
      dishPivot,
      beaconMesh,
      beaconLight,
      dteLineSolid,
      dteLineDashed,
      earthMesh,
    };

    // Animation loop (beacon pulse + OrbitControls damping)
    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const pulse = 0.75 + 0.45 * Math.sin(t * 4.2);
      if (sceneRefs.current) {
        sceneRefs.current.beaconLight.intensity = 1.6 * pulse;
        sceneRefs.current.beaconMesh.scale.setScalar(0.88 + 0.22 * pulse);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(100, entry.contentRect.width);
        const h = Math.max(100, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      solidGeo.dispose();
      solidMat.dispose();
      dashedGeo.dispose();
      dashedMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update terrain geometry cleanly whenever landing site changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    populateSiteTerrainGeometry(refs.terrainGeo, site);
  }, [site]);

  // Update Sun shadow directional light, Earth DTE beam, and Lander telemetry visuals every hour tick
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    // 1. Solar Directional Light & Sun Sky Indicator
    const sunDir = azElevToVector3(current.sunAz, current.sunElev, VERTICAL_EXAG);
    refs.sunLight.position.copy(sunDir).multiplyScalar(92);
    refs.sunLight.target.position.set(0, 0, 0);
    refs.sunLight.target.updateMatrixWorld();

    // Keep dramatic rim shadow casting whenever Sun is above -0.5 deg; dim smoothly below true horizon
    const sunIntensity =
      current.sunElev >= 0
        ? 3.2
        : Math.max(0.15, 3.2 * (1 + current.sunElev / 2));
    refs.sunLight.intensity = sunIntensity;

    refs.sunMesh.position.copy(sunDir).multiplyScalar(78);
    (refs.sunMesh.material as THREE.MeshBasicMaterial).color.set(
      current.isSunVisible ? '#fde047' : '#fb923c'
    );

    // Orient lander solar wings and X-band dish toward live Sun & Earth azimuths
    refs.solarWingsPivot.rotation.y = Math.PI - degToRad(current.sunAz);

    // 2. Earth DTE Vector Beam & Dish Gimbal
    const earthDir = azElevToVector3(current.earthAz, current.earthElev, VERTICAL_EXAG);
    const beamStart = new THREE.Vector3(0, 2.775, 0);
    const beamEnd = earthDir.clone().multiplyScalar(66);

    refs.dishPivot.rotation.y = Math.PI - degToRad(current.earthAz);
    refs.earthMesh.position.copy(earthDir).multiplyScalar(74);
    (refs.earthMesh.material as THREE.MeshBasicMaterial).color.set(
      current.isEarthVisible ? '#38bdf8' : '#ef4444'
    );

    const points = [beamStart, beamEnd];
    refs.dteLineSolid.geometry.setFromPoints(points);
    refs.dteLineDashed.geometry.setFromPoints(points);
    refs.dteLineDashed.computeLineDistances();

    refs.dteLineSolid.visible = current.isEarthVisible;
    refs.dteLineDashed.visible = !current.isEarthVisible;

    // 3. Lander Status Beacon Color
    const beaconHex = current.criticalPowerAlert || current.timelineStatus === 'blackout'
      ? '#ef4444'
      : current.timelineStatus === 'partial'
        ? '#f59e0b'
        : '#22d3ee';
    (refs.beaconMesh.material as THREE.MeshBasicMaterial).color.set(beaconHex);
    refs.beaconLight.color.set(beaconHex);
  }, [current]);

  // Apply Camera Preset Transitions
  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    const refs = sceneRefs.current;
    if (!refs) return;

    if (preset === 'orbital') {
      refs.camera.position.set(26, 17, 29);
      refs.controls.target.set(0, 1.2, 0);
    } else if (preset === 'lander') {
      refs.camera.position.set(4.8, 2.8, 5.8);
      refs.controls.target.set(0, 1.6, -10);
    } else {
      refs.camera.position.set(0.01, 58, 0.01);
      refs.controls.target.set(0, 0, 0);
    }
    refs.controls.update();
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-800 bg-[#05080F]">
      {/* WebGL Mount Container */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Camera Preset Switcher Overlay */}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800/90 bg-[#080D1A]/85 p-1.5 backdrop-blur-md">
        <span className="px-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          CAM
        </span>
        <button
          type="button"
          onClick={() => handleSelectCameraPreset('orbital')}
          className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] transition ${
            cameraPreset === 'orbital'
              ? 'bg-cyan-500/25 font-semibold text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Orbit className="h-3 w-3" />
          Orbital View
        </button>
        <button
          type="button"
          onClick={() => handleSelectCameraPreset('lander')}
          className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] transition ${
            cameraPreset === 'lander'
              ? 'bg-cyan-500/25 font-semibold text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="h-3 w-3" />
          Lander POV
        </button>
        <button
          type="button"
          onClick={() => handleSelectCameraPreset('topdown')}
          className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] transition ${
            cameraPreset === 'topdown'
              ? 'bg-cyan-500/25 font-semibold text-cyan-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="h-3 w-3" />
          Top-Down Polar
        </button>
      </div>

      {/* Top-Right Site Coordinates & Shadow Status Overlay */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="rounded-lg border border-slate-800/90 bg-[#080D1A]/85 px-3 py-1.5 font-mono text-[10px] backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Compass className="h-3 w-3 text-cyan-400" />
            <span className="font-semibold">{site.name}</span>
          </div>
          <div className="mt-0.5 text-slate-400">
            {site.lat.toFixed(2)}° Lat, {site.lon.toFixed(2)}° Lon | Alt +{site.altKm.toFixed(1)} km
          </div>
        </div>

        <div
          className={`rounded border px-2.5 py-1 font-mono text-[10px] font-semibold backdrop-blur-md ${
            current.isSunVisible
              ? 'border-amber-500/40 bg-amber-950/60 text-amber-300'
              : 'border-red-500/50 bg-red-950/75 text-red-300'
          }`}
        >
          {current.isSunVisible ? 'DIRECT SOLAR ILLUMINATION' : 'TERRAIN SHADOW'}
        </div>
      </div>

      {/* Bottom-Left Controls Hint & DTE Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-md border border-slate-800/80 bg-[#080D1A]/80 px-2.5 py-1 font-mono text-[10px] text-slate-400 backdrop-blur-md">
        <span>Drag: Orbit | Scroll: Zoom | Right-Drag: Pan</span>
        <span className="text-slate-600">|</span>
        <span className={current.isEarthVisible ? 'text-cyan-300' : 'text-red-400'}>
          {current.isEarthVisible
            ? '━━ Cyan Beam: DTE X-Band Locked'
            : '┄┄ Red Dashed: Earth LOS Occluded'}
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-500">(Angles visually scaled)</span>
      </div>
    </div>
  );
}
