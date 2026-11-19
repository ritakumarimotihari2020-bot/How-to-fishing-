import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  FISH_SPECIES,
  getBaitById,
  getBoatById,
  getHookById,
  getLineById,
  getLocationById,
  getRodById,
} from './catalog';
import {
  BoatKinematicsState,
  WATER_LEVEL,
  calculateBiteRatePerSecond,
  createCaughtFishRecord,
  createFightState,
  getEligibleSpecies,
  getLocationSpawnPoints,
  getPierBounds,
  getTerrainHeight,
  getWalkableSurfaceY,
  getWaterDepth,
  getWaveAmplitude,
  getWaveHeight,
  isNavigableWaterForBoat,
  rollFishSpecimen,
  stepBoatKinematics,
  stepFishingFight,
} from './fishingLogic';
import {
  AnglerRig,
  BoatRig,
  FishModelRig,
  createAnglerModel,
  createBoatModel,
  createFishModel,
  createLighthouseModel,
  createPierModel,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { FishingAudioEngine } from './audio';
import {
  BoatId,
  CameraMode,
  CaughtFish,
  FightState,
  FishSpecies,
  FishingPhase,
  GameScreenState,
  HudSnapshot,
  LocationId,
  PlayerSave,
  SonarBlip,
  WeatherType,
} from './types';

// Scratch vectors to avoid per-frame allocations in animation loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface SwimmingFishAgent {
  species: FishSpecies;
  rig: FishModelRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  decisionTimer: number;
  tailPhase: number;
  curiousOfHook: boolean;
}

interface SplashParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface FishingEngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onFishCaught: (fish: CaughtFish) => void;
  onBaitConsumed: () => void;
  onTimeOfDaySync: (hour: number) => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class FishingEngine {
  private container: HTMLElement;
  private callbacks: FishingEngineCallbacks;
  public readonly audio: FishingAudioEngine;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;

  // Lighting & Atmosphere
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private sunOrb: THREE.Mesh;
  private starsPoints: THREE.Points;
  private fog: THREE.FogExp2;

  // Dynamic Water
  private waterMesh: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;

  // World Group (rebuilt on location change)
  private worldGroup: THREE.Group;
  private lighthouseBeam: THREE.Group | null = null;
  private lanternGlows: THREE.MeshStandardMaterial[] = [];

  // Actors
  private angler: AnglerRig;
  private boatRig: BoatRig;
  private boatState: BoatKinematicsState;
  private builtBoatId: BoatId;
  private builtBoatColor: string;

  // Fishing Line, Bobber, Hook & Hooked Fish
  private fishingLine: THREE.Line;
  private linePositions: Float32Array;
  private bobberGroup: THREE.Group;
  private hookMesh: THREE.Mesh;
  private hookedFishRig: FishModelRig | null = null;

  // Underwater Fish AI
  private fishGroup: THREE.Group;
  private fishAgents: SwimmingFishAgent[] = [];

  // Pooled Splash & Wake Particles + Rain Particles
  private splashPool: SplashParticle[] = [];
  private splashInstanced: THREE.InstancedMesh;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;
  private lightningFlash = 0;

  // Runtime State
  private save: PlayerSave;
  private screenState: GameScreenState = 'title';
  private mode: 'foot' | 'boat' = 'foot';
  private cameraMode: CameraMode = 'third_person';
  private playerPos = new THREE.Vector3(0, 1.5, 16);
  private playerYaw = Math.PI;
  private walkAnimDist = 0;

  // Camera Orbit State
  private camYawOffset = 0;
  private camPitch = 0.28;
  private camDistance = 7.4;
  private isDraggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraShakeTrauma = 0;

  // Input State
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 }; // joystick (-1..1)
  private actionHeld = false;
  private actionJustPressed = false;
  private actionJustReleased = false;

  // Fishing State Machine
  private fishingPhase: FishingPhase = 'idle';
  private castPower = 0;
  private castPowerDir = 1;
  private castArcTime = 0;
  private castArcDuration = 0.75;
  private castStartPos = new THREE.Vector3();
  private castTargetPos = new THREE.Vector3();
  private bobberPos = new THREE.Vector3();
  private hookPos = new THREE.Vector3();
  private biteTimer = 0;
  private biteWindowMax = 2.8;
  private pendingSpecimen: { species: FishSpecies; weightKg: number; lengthCm: number } | null = null;
  private fight: FightState | null = null;
  private statusMessage: string | null = null;
  private statusMessageTimer = 0;

  // Loop & Timing
  private elapsed = 0;
  private lastTime = 0;
  private hudEmitAccum = 0;
  private timeSyncAccum = 0;
  private frameId = 0;
  private disposed = false;

  // Bound event listeners for clean teardown
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, initialSave: PlayerSave, callbacks: FishingEngineCallbacks) {
    this.container = container;
    this.save = initialSave;
    this.callbacks = callbacks;
    this.audio = new FishingAudioEngine();
    this.audio.setSettings(initialSave.settings.masterVolume, initialSave.settings.muted);

    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(240, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // WebGL context safety
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0xa8d5e5, 0.0042);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.15, 520);

    // Mandatory RoomEnvironment PBR reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Sky Dome + Sun/Moon Orb + Stars
    const { skyMat, sunOrb, starsPoints } = this.createSkySystem();
    this.skyMat = skyMat;
    this.sunOrb = sunOrb;
    this.starsPoints = starsPoints;

    // Warm/Cool Studio-grade Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xaad9ff, 0x264454, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sunLight.position.set(60, 85, -45);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    const d = 65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    // Dynamic Custom GLSL Water Mesh
    const { waterMesh, waterMat } = this.createWaterSystem();
    this.waterMesh = waterMesh;
    this.waterMat = waterMat;
    this.scene.add(this.waterMesh);

    // World & Fish Containers
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.fishGroup = new THREE.Group();
    this.scene.add(this.fishGroup);

    // Angler & Active Boat
    const rod = getRodById(initialSave.equippedRodId);
    this.angler = createAnglerModel(rod.rodColor, this.textures);
    this.scene.add(this.angler.group);

    this.builtBoatId = initialSave.equippedBoatId;
    this.builtBoatColor = initialSave.boatUpgrades[this.builtBoatId].hullColor;
    this.boatRig = createBoatModel(this.builtBoatId, this.builtBoatColor, this.textures);
    this.scene.add(this.boatRig.group);

    const spawns = getLocationSpawnPoints(initialSave.locationId);
    this.playerPos.set(spawns.playerPos.x, spawns.playerPos.y, spawns.playerPos.z);
    this.playerYaw = spawns.playerPos.yaw;
    this.boatState = {
      x: spawns.boatPos.x,
      z: spawns.boatPos.z,
      yaw: spawns.boatPos.yaw,
      speed: 0,
      roll: 0,
      pitch: 0,
    };

    // Fishing Line + Bobber + Underwater Hook
    const { line, positions, bobberGroup, hookMesh } = this.createFishingRig();
    this.fishingLine = line;
    this.linePositions = positions;
    this.bobberGroup = bobberGroup;
    this.hookMesh = hookMesh;
    this.scene.add(this.fishingLine, this.bobberGroup, this.hookMesh);

    // Pooled Splash / Wake Particles
    const { splashInstanced, splashPool } = this.createSplashPool(160);
    this.splashInstanced = splashInstanced;
    this.splashPool = splashPool;
    this.scene.add(this.splashInstanced);

    // Rain Particles
    const { rainPoints, rainPositions } = this.createRainSystem(900);
    this.rainPoints = rainPoints;
    this.rainPositions = rainPositions;
    this.scene.add(this.rainPoints);

    // Build initial location world & fish schools
    this.rebuildLocationWorld(initialSave.locationId);
    this.updateAtmosphere(0);

    // Pre-warm shaders on real GPUs
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Input & Resize listeners
    this.bindInputListeners();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
    this.updateActorsIdle(0);
    this.updateTitleCamera(0);
    this.renderer.render(this.scene, this.camera);
    this.emitHudSnapshot();
    this.scheduleNextFrame();
  }

  private createSkySystem(): {
    skyMat: THREE.ShaderMaterial;
    sunOrb: THREE.Mesh;
    starsPoints: THREE.Points;
  } {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x1f6fa8) },
        uHorizonColor: { value: new THREE.Color(0xa8d5e5) },
        uBottomColor: { value: new THREE.Color(0x0b2a3e) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
        uSunGlow: { value: new THREE.Color(0xffe7b8) },
        uCloudCover: { value: 0.15 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunGlow;
        uniform float uCloudCover;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = dir.y;
          vec3 sky = h >= 0.0
            ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(uHorizonColor, uBottomColor, clamp(-h * 4.0, 0.0, 1.0));

          // Soft procedural sky clouds
          if (h > 0.02) {
            vec2 cuv = dir.xz / (h + 0.18) * 1.4;
            float c = noise(cuv * 2.0) * 0.6 + noise(cuv * 4.5 + 3.1) * 0.4;
            float cloudMask = smoothstep(0.68 - uCloudCover * 0.35, 0.92 - uCloudCover * 0.2, c) * smoothstep(0.02, 0.25, h);
            vec3 cloudCol = mix(vec3(0.95, 0.97, 1.0), uHorizonColor * 0.72, uCloudCover * 0.75);
            sky = mix(sky, cloudCol, cloudMask * (0.45 + uCloudCover * 0.45));
          }

          // Sun atmospheric halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          sky += uSunGlow * pow(sunDot, 16.0) * 0.35;
          sky += uSunGlow * pow(sunDot, 260.0) * 0.9;

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });

    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), skyMat);
    this.scene.add(skyDome);

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff5d6, fog: false }),
    );
    this.scene.add(sunOrb);

    // Night starfield
    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      const r = 370;
      starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPos[i * 3 + 1] = Math.cos(phi) * r;
      starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xdbeeff, size: 1.8, transparent: true, opacity: 0, fog: false }),
    );
    this.scene.add(starsPoints);

    return { skyMat, sunOrb, starsPoints };
  }

  private createWaterSystem(): { waterMesh: THREE.Mesh; waterMat: THREE.ShaderMaterial } {
    const waterGeo = new THREE.PlaneGeometry(460, 460, 88, 88);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWaveAmp: { value: 0.22 },
        uShallowColor: { value: new THREE.Color('#1fb6aa') },
        uDeepColor: { value: new THREE.Color('#0b4464') },
        uSkyColor: { value: new THREE.Color('#a8d5e5') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
        uSunColor: { value: new THREE.Color('#fff2d2') },
        uFogColor: { value: new THREE.Color('#a8d5e5') },
        uFogDensity: { value: 0.0042 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaveAmp;
        varying vec3 vWorldPos;
        varying float vWaveH;

        float calcWave(float x, float z, float t, float amp) {
          float w1 = sin(x * 0.085 + t * 1.35) * 0.52;
          float w2 = cos(z * 0.095 - t * 1.12) * 0.34;
          float w3 = sin((x + z) * 0.14 + t * 2.1) * 0.14;
          return (w1 + w2 + w3) * amp;
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float h = calcWave(wp.x, wp.z, uTime, uWaveAmp);
          wp.y += h;
          vWaveH = h;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uWaveAmp;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSkyColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;

        varying vec3 vWorldPos;
        varying float vWaveH;

        void main() {
          // Analytical normal + multi-angle non-repeating organic ripples attenuated with distance
          float x = vWorldPos.x;
          float z = vWorldPos.z;
          float t = uTime;
          float camDist = length(cameraPosition - vWorldPos);
          float distFade = 1.0 / (1.0 + camDist * 0.028);

          float dx = (cos(x * 0.085 + t * 1.35) * 0.085 * 0.52 + cos((x + z) * 0.14 + t * 2.1) * 0.14 * 0.14) * uWaveAmp;
          float dz = (-sin(z * 0.095 - t * 1.12) * 0.095 * 0.34 + cos((x + z) * 0.14 + t * 2.1) * 0.14 * 0.14) * uWaveAmp;

          // Non-aligned multi-directional capillary shimmer (fades smoothly with distance to avoid moire)
          float r1 = sin(x * 0.31 + z * 0.19 + t * 1.8) * 0.032;
          float r2 = cos(x * 0.23 - z * 0.41 + t * 2.3) * 0.026;
          float r3 = sin(x * 0.57 - z * 0.13 - t * 2.7) * 0.018;
          vec3 N = normalize(vec3(-(dx + (r1 + r3) * distFade), 1.0, -(dz + (r2 - r3) * distFade)));

          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

          // Smooth shallow-to-deep color ramp
          float depthGrad = smoothstep(8.0, 88.0, length(vWorldPos.xz - vec2(0.0, 26.0)));
          vec3 waterBase = mix(uShallowColor, uDeepColor, depthGrad);

          // Sun specular glitter
          vec3 H = normalize(normalize(uSunDir) + V);
          float spec = pow(max(dot(N, H), 0.0), 120.0) * 1.15;
          float broadSpec = pow(max(dot(N, H), 0.0), 18.0) * 0.22;

          // Organic crest foam
          float foam = smoothstep(uWaveAmp * 0.58, uWaveAmp * 0.96, vWaveH) * 0.32 * distFade;

          vec3 col = mix(waterBase, uSkyColor, clamp(fresnel * 0.76 + 0.12, 0.0, 0.88));
          col += uSunColor * (spec + broadSpec);
          col = mix(col, vec3(0.92, 0.97, 1.0), foam);

          // Exponential horizon fog match
          float fogFactor = 1.0 - exp(-pow(camDist * uFogDensity, 2.0));
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

          // Clear near shore/pier to spot swimming fish, opaque further out so seabed edges never show
          float distOpaque = smoothstep(26.0, 82.0, camDist);
          float alpha = mix(0.76, 0.99, clamp(fresnel * 0.65 + distOpaque * 0.85, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = WATER_LEVEL;
    return { waterMesh, waterMat };
  }

  private createFishingRig() {
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(18 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(getLineById(this.save.equippedLineId).color),
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.visible = false;
    line.frustumCulled = false;

    const bobberGroup = new THREE.Group();
    const topHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.25 }),
    );
    const botHalf = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }),
    );
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.4 }),
    );
    antenna.position.y = 0.16;
    const rippleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.36, 20),
      new THREE.MeshBasicMaterial({
        color: 0xe0f7ff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    rippleRing.rotation.x = -Math.PI / 2;
    rippleRing.position.y = 0.02;
    rippleRing.name = 'rippleRing';
    bobberGroup.add(topHalf, botHalf, antenna, rippleRing);
    bobberGroup.visible = false;

    // Underwater luminous bait + hook
    const hookMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(getBaitById(this.save.equippedBaitId).color),
        emissive: 0x332211,
        emissiveIntensity: 0.35,
        roughness: 0.35,
      }),
    );
    hookMesh.visible = false;

    return { line, positions, bobberGroup, hookMesh };
  }

  private createSplashPool(capacity: number) {
    const geo = new THREE.SphereGeometry(0.16, 6, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xeaf8ff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const splashInstanced = new THREE.InstancedMesh(geo, mat, capacity);
    splashInstanced.frustumCulled = false;
    const splashPool: SplashParticle[] = [];
    for (let i = 0; i < capacity; i++) {
      splashPool.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.1,
      });
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      splashInstanced.setMatrixAt(i, _dummy.matrix);
    }
    splashInstanced.instanceMatrix.needsUpdate = true;
    return { splashInstanced, splashPool };
  }

  private spawnSplashBurst(x: number, y: number, z: number, count: number, spread = 2.4, upSpeed = 3.8): void {
    let spawned = 0;
    for (let i = 0; i < this.splashPool.length && spawned < count; i++) {
      const p = this.splashPool[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.4;
        p.y = y + 0.08;
        p.z = z + (Math.random() - 0.5) * 0.4;
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * spread;
        p.vx = Math.cos(ang) * spd;
        p.vy = upSpeed * (0.55 + Math.random() * 0.65);
        p.vz = Math.sin(ang) * spd;
        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.35;
        p.size = 0.5 + Math.random() * 0.85;
        spawned++;
      }
    }
  }

  private createRainSystem(count: number) {
    const rainPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      rainPositions[i * 3 + 1] = Math.random() * 34;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcbe4f5,
      size: 0.28,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const rainPoints = new THREE.Points(geo, mat);
    rainPoints.visible = false;
    rainPoints.frustumCulled = false;
    return { rainPoints, rainPositions };
  }

  private rebuildLocationWorld(locationId: LocationId): void {
    // Clear previous location meshes
    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0];
      this.worldGroup.remove(child);
    }
    this.lighthouseBeam = null;
    this.lanternGlows = [];

    const loc = getLocationById(locationId);
    this.waterMat.uniforms.uShallowColor.value.set(loc.shallowColor);
    this.waterMat.uniforms.uDeepColor.value.set(loc.deepColor);

    // 1. Sculpted Terrain + Seabed Mesh with vertex-colored elevation bands
    const size = 340;
    const segs = 84;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);

    const seabedCol = new THREE.Color(locationId === 'blue_abyss' ? '#122c3c' : '#264446');
    const sandCol = new THREE.Color(locationId === 'emerald_cove' ? '#d7c49a' : '#8b836c');
    const grassCol = new THREE.Color(locationId === 'misty_lake' ? '#3d6338' : '#4a7040');
    const rockCol = new THREE.Color('#646b70');

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const h = getTerrainHeight(locationId, vx, vz);
      posAttr.setY(i, h);

      if (h < -1.5) {
        _color.copy(seabedCol);
      } else if (h < 1.8) {
        _color.copy(seabedCol).lerp(sandCol, THREE.MathUtils.clamp((h + 1.5) / 3.3, 0, 1));
      } else if (h < 7.5) {
        _color.copy(sandCol).lerp(grassCol, THREE.MathUtils.clamp((h - 1.8) / 3.5, 0, 1));
      } else {
        _color.copy(grassCol).lerp(rockCol, THREE.MathUtils.clamp((h - 7.5) / 8.0, 0, 1));
      }
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.sandMap,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.worldGroup.add(terrainMesh);

    // Deep abyssal seabed plane extending beneath entire water mesh (prevents any horizon cutout seam)
    const abyssFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshBasicMaterial({ color: seabedCol }),
    );
    abyssFloor.rotation.x = -Math.PI / 2;
    abyssFloor.position.y = -32;
    this.worldGroup.add(abyssFloor);

    // 2. Wooden Pier
    const pier = getPierBounds(locationId);
    const pierRig = createPierModel(pier.minX, pier.maxX, pier.minZ, pier.maxZ, pier.deckY, this.textures);
    this.worldGroup.add(pierRig.group);
    this.lanternGlows.push(...pierRig.lanternGlows);

    // 3. Signature Tall Landmark visible in the initial Spawn Vista
    if (locationId === 'emerald_cove' || locationId === 'blue_abyss') {
      const lh = createLighthouseModel();
      const lx = locationId === 'emerald_cove' ? -25 : -24;
      const lz = locationId === 'emerald_cove' ? -34 : -46;
      // Flat-topped rocky headland plateau extending cleanly below seabed so tower & cottage sit 100% flush
      const plateauY = 2.6;
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.rockMap,
        roughness: 0.9,
      });
      const islandRock = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 15.5, 16, 10), rockMat);
      islandRock.position.set(lx + 1.5, plateauY - 8.0, lz);
      islandRock.castShadow = true;
      islandRock.receiveShadow = true;
      this.worldGroup.add(islandRock);

      lh.group.position.set(lx, plateauY - 0.15, lz);
      this.worldGroup.add(lh.group);
      this.lighthouseBeam = lh.beamGroup;

      // Companion rocky coastal islet on forward-right with grounded coastal pine grove
      const isletPlateauY = 2.4;
      const islet = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 13.5, 16, 9), rockMat);
      islet.position.set(40, isletPlateauY - 8.0, -54);
      islet.castShadow = true;
      islet.receiveShadow = true;
      this.worldGroup.add(islet);

      const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.92 });
      const pineCrownMat = new THREE.MeshStandardMaterial({ color: 0x26593b, roughness: 0.85 });
      for (const [ox, oz, s] of [
        [-1.2, 0.5, 1.1],
        [2.2, -1.4, 0.88],
        [-2.8, -2.0, 0.78],
      ]) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 4.0 * s, 7), pineTrunkMat);
        trunk.position.set(40 + ox, isletPlateauY + 1.9 * s, -54 + oz);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6 * s, 7.2 * s, 7), pineCrownMat);
        crown.position.set(40 + ox, isletPlateauY + 6.0 * s, -54 + oz);
        this.worldGroup.add(trunk, crown);
      }
    } else if (locationId === 'salmon_river') {
      // Timber Canyon Suspension Bridge across the river ahead of spawn
      const bridgeGroup = new THREE.Group();
      const deckMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.woodMap,
        roughness: 0.85,
      });
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.88 });
      const span = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 52), deckMat);
      span.position.set(-28, 7.5, -8);
      span.castShadow = true;
      bridgeGroup.add(span);
      for (const bz of [-28, 12]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(6.2, 16, 1.4), towerMat);
        tower.position.set(-28, 8, bz);
        tower.castShadow = true;
        bridgeGroup.add(tower);
      }
      this.worldGroup.add(bridgeGroup);
    } else {
      // Misty Lake: Timber Lodge & Watchtower on opposite north shore
      const lodgeGroup = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.woodMap,
        roughness: 0.85,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x354b45, roughness: 0.72 });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 8), logMat);
      cabin.position.y = 3.25;
      cabin.castShadow = true;
      lodgeGroup.add(cabin);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 4.5, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 8.7;
      roof.castShadow = true;
      lodgeGroup.add(roof);
      const lx = -16;
      const lz = -78;
      lodgeGroup.position.set(lx, Math.max(1.2, getTerrainHeight(locationId, lx, lz)), lz);
      this.worldGroup.add(lodgeGroup);
    }

    // 4. Instanced Shoreline Trees (Conifers / Coastal Pines) & Boulders
    this.populateInstancedScenery(locationId);

    // 5. Underwater Reef Rocks & Swaying Kelp Forest
    this.populateUnderwaterScenery(locationId);

    // 6. Reset Player & Boat Spawn Points
    const spawns = getLocationSpawnPoints(locationId);
    this.mode = 'foot';
    this.playerPos.set(spawns.playerPos.x, spawns.playerPos.y, spawns.playerPos.z);
    this.playerYaw = spawns.playerPos.yaw;
    this.boatState = {
      x: spawns.boatPos.x,
      z: spawns.boatPos.z,
      yaw: spawns.boatPos.yaw,
      speed: 0,
      roll: 0,
      pitch: 0,
    };
    this.cancelFishing();

    // 7. Spawn Underwater 3D Fish AI School
    this.spawnFishAgents(locationId);
  }

  private populateInstancedScenery(locationId: LocationId): void {
    const treePositions: Array<{ x: number; y: number; z: number; scale: number; tint: number }> = [];
    const rockPositions: Array<{ x: number; y: number; z: number; scale: number; rotY: number }> = [];

    // Deterministic pseudo-random placement so worlds look intentionally composed
    let seed = locationId.length * 9173 + 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 420 && treePositions.length < 95; i++) {
      const x = (rand() - 0.5) * 240;
      const z = (rand() - 0.5) * 240;
      // Keep pier approach open
      if (Math.abs(x) < 11 && z > 2 && z < 48) continue;
      const h = getTerrainHeight(locationId, x, z);
      if (h > 2.2 && h < 22) {
        treePositions.push({
          x,
          y: h - 0.25,
          z,
          scale: 0.78 + rand() * 0.58,
          tint: 0.85 + rand() * 0.3,
        });
      }
    }

    for (let i = 0; i < 240 && rockPositions.length < 55; i++) {
      const x = (rand() - 0.5) * 220;
      const z = (rand() - 0.5) * 220;
      if (Math.abs(x) < 10 && z > 4 && z < 45) continue;
      const h = getTerrainHeight(locationId, x, z);
      if (h > -0.6 && h < 12) {
        rockPositions.push({
          x,
          y: h - 0.3,
          z,
          scale: 0.8 + rand() * 1.9,
          rotY: rand() * Math.PI * 2,
        });
      }
    }

    if (treePositions.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.6, 7);
      trunkGeo.translate(0, 1.8, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.92 });
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
      trunks.castShadow = true;

      const crownGeo = new THREE.ConeGeometry(2.1, 6.2, 7);
      crownGeo.translate(0, 5.2, 0);
      const crownMat = new THREE.MeshStandardMaterial({
        color: locationId === 'emerald_cove' ? 0x2d6b45 : 0x244d38,
        roughness: 0.85,
      });
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
      crowns.castShadow = true;

      const crownTopGeo = new THREE.ConeGeometry(1.45, 4.4, 7);
      crownTopGeo.translate(0, 7.6, 0);
      const crownsTop = new THREE.InstancedMesh(crownTopGeo, crownMat, treePositions.length);

      treePositions.forEach((t, idx) => {
        _dummy.position.set(t.x, t.y, t.z);
        _dummy.rotation.set(0, idx * 1.1, 0);
        _dummy.scale.setScalar(t.scale);
        _dummy.updateMatrix();
        trunks.setMatrixAt(idx, _dummy.matrix);
        crowns.setMatrixAt(idx, _dummy.matrix);
        crownsTop.setMatrixAt(idx, _dummy.matrix);
        _color.setRGB(t.tint, t.tint, t.tint);
        crowns.setColorAt(idx, _color);
        crownsTop.setColorAt(idx, _color);
      });
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      crownsTop.computeBoundingSphere();
      this.worldGroup.add(trunks, crowns, crownsTop);
    }

    if (rockPositions.length > 0) {
      const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.rockMap,
        roughness: 0.88,
      });
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      rockPositions.forEach((r, idx) => {
        _dummy.position.set(r.x, r.y, r.z);
        _dummy.rotation.set(0.2, r.rotY, 0.15);
        _dummy.scale.set(r.scale * 1.15, r.scale * 0.72, r.scale);
        _dummy.updateMatrix();
        rocks.setMatrixAt(idx, _dummy.matrix);
      });
      rocks.computeBoundingSphere();
      this.worldGroup.add(rocks);
    }
  }

  private populateUnderwaterScenery(locationId: LocationId): void {
    const reefSpots: Array<{ x: number; y: number; z: number; scale: number; tint: number }> = [];
    for (let i = 0; i < 65; i++) {
      const ang = (i / 65) * Math.PI * 2 + (i % 7) * 0.27;
      const dist = 16 + (i % 17) * 4.2;
      const x = Math.cos(ang) * dist;
      const z = -18 + Math.sin(ang) * dist;
      const depth = getWaterDepth(locationId, x, z);
      if (depth > 3.2 && depth < 18) {
        reefSpots.push({
          x,
          y: -depth + 0.25,
          z,
          scale: Math.min(depth * 0.26, 0.75 + (i % 4) * 0.35),
          tint: 0.75 + (i % 5) * 0.09,
        });
      }
    }
    if (reefSpots.length > 0) {
      // Organic low seabed reef boulders & coral clusters (never poking through water surface)
      const reefGeo = new THREE.DodecahedronGeometry(0.85, 0);
      const reefMat = new THREE.MeshStandardMaterial({
        color: locationId === 'blue_abyss' ? 0x1c5e56 : 0x2a6144,
        roughness: 0.88,
      });
      const reefMesh = new THREE.InstancedMesh(reefGeo, reefMat, reefSpots.length);
      reefSpots.forEach((k, idx) => {
        _dummy.position.set(k.x, k.y, k.z);
        _dummy.rotation.set(idx * 0.3, idx * 0.9, 0.15);
        _dummy.scale.set(k.scale * 1.4, k.scale * 0.75, k.scale * 1.15);
        _dummy.updateMatrix();
        reefMesh.setMatrixAt(idx, _dummy.matrix);
        _color.setRGB(k.tint * 0.35, k.tint * 0.65, k.tint * 0.52);
        reefMesh.setColorAt(idx, _color);
      });
      reefMesh.computeBoundingSphere();
      this.worldGroup.add(reefMesh);
    }
  }

  private spawnFishAgents(locationId: LocationId): void {
    while (this.fishGroup.children.length > 0) {
      this.fishGroup.remove(this.fishGroup.children[0]);
    }
    this.fishAgents = [];

    const pool = FISH_SPECIES.filter((s) => s.locations.includes(locationId));
    const speciesList = pool.length > 0 ? pool : FISH_SPECIES.slice(0, 4);

    for (let i = 0; i < 28; i++) {
      const species = speciesList[i % speciesList.length];
      const baseScale =
        species.bodyShape === 'shark'
          ? 2.2
          : species.bodyShape === 'marlin'
            ? 1.9
            : species.maxWeightKg > 40
              ? 1.45
              : 0.9 + (i % 4) * 0.16;

      // Pick valid underwater coordinates
      let fx = 0;
      let fz = -24;
      let depth = 6;
      for (let attempt = 0; attempt < 25; attempt++) {
        const tx = (Math.random() - 0.5) * 145;
        const tz = -85 + Math.random() * 115;
        const d = getWaterDepth(locationId, tx, tz);
        if (d > 2.2) {
          fx = tx;
          fz = tz;
          depth = d;
          break;
        }
      }

      const fy = -Math.min(depth - 0.8, 1.0 + Math.random() * Math.min(7, depth * 0.65));
      const rig = createFishModel(species, baseScale);
      rig.group.position.set(fx, fy, fz);
      this.fishGroup.add(rig.group);

      this.fishAgents.push({
        species,
        rig,
        x: fx,
        y: fy,
        z: fz,
        yaw: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 1.8,
        targetX: fx + (Math.random() - 0.5) * 24,
        targetY: fy,
        targetZ: fz + (Math.random() - 0.5) * 24,
        decisionTimer: 1 + Math.random() * 4,
        tailPhase: Math.random() * Math.PI * 2,
        curiousOfHook: false,
      });
    }
  }

  private bindInputListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.actionHeld = false;
    this.isDraggingCamera = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onWindowBlur();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.screenState !== 'playing') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.audio.unlock();

    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
    this.keys.add(code);

    if (code === 'Space' && !e.repeat) {
      this.triggerActionDown();
    } else if (code === 'KeyE' && !e.repeat) {
      this.toggleBoatBoarding();
    } else if (code === 'KeyV' && !e.repeat) {
      this.cycleCameraMode();
    } else if (code === 'KeyU' && !e.repeat) {
      this.toggleUnderwaterCamera();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'Space') {
      this.triggerActionUp();
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.screenState !== 'playing') return;
    this.audio.unlock();
    if (e.button === 0) {
      this.isDraggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDraggingCamera || this.screenState !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    const sens = 0.0045 * this.save.settings.cameraSensitivity;
    this.camYawOffset -= dx * sens;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, -0.18, 1.05);
  };

  private onPointerUp = (): void => {
    this.isDraggingCamera = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.screenState !== 'playing') return;
    this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.006, 4.0, 18.0);
  };

  // --- Public Control Bridge for React HUD & Mobile Controls ---

  public setScreenState(state: GameScreenState): void {
    this.screenState = state;
    this.audio.setPaused(state === 'paused');
    if (state !== 'playing') {
      this.keys.clear();
      this.actionHeld = false;
      this.isDraggingCamera = false;
    } else {
      this.audio.unlock();
      // Smoothly reset local camera look offset when entering playing state
      this.camYawOffset = 0;
      this.camPitch = 0.28;
    }
    this.emitHudSnapshot();
  }

  public syncSave(nextSave: PlayerSave): void {
    const prevLoc = this.save.locationId;
    const prevBoat = this.builtBoatId;
    const prevBoatColor = this.builtBoatColor;
    const prevRod = this.save.equippedRodId;
    const prevLine = this.save.equippedLineId;
    const prevBait = this.save.equippedBaitId;

    this.save = nextSave;
    this.audio.setSettings(nextSave.settings.masterVolume, nextSave.settings.muted);

    if (nextSave.locationId !== prevLoc) {
      this.rebuildLocationWorld(nextSave.locationId);
    }

    const nextColor = nextSave.boatUpgrades[nextSave.equippedBoatId].hullColor;
    if (nextSave.equippedBoatId !== prevBoat || nextColor !== prevBoatColor) {
      this.scene.remove(this.boatRig.group);
      this.builtBoatId = nextSave.equippedBoatId;
      this.builtBoatColor = nextColor;
      this.boatRig = createBoatModel(this.builtBoatId, this.builtBoatColor, this.textures);
      this.scene.add(this.boatRig.group);
    }

    if (nextSave.equippedRodId !== prevRod) {
      const rodCol = new THREE.Color(getRodById(nextSave.equippedRodId).rodColor);
      this.angler.rodBlankMats.forEach((m) => m.color.copy(rodCol));
    }

    if (nextSave.equippedLineId !== prevLine) {
      (this.fishingLine.material as THREE.LineBasicMaterial).color.set(
        getLineById(nextSave.equippedLineId).color,
      );
    }

    if (nextSave.equippedBaitId !== prevBait) {
      (this.hookMesh.material as THREE.MeshStandardMaterial).color.set(
        getBaitById(nextSave.equippedBaitId).color,
      );
    }

    this.emitHudSnapshot();
  }

  public setTouchJoystick(x: number, y: number): void {
    this.touchMove.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMove.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  public triggerActionDown(): void {
    if (this.screenState !== 'playing') return;
    this.audio.unlock();
    this.actionHeld = true;
    this.actionJustPressed = true;
  }

  public triggerActionUp(): void {
    this.actionHeld = false;
    this.actionJustReleased = true;
  }

  public cycleCameraMode(): void {
    if (this.cameraMode === 'third_person') {
      this.cameraMode = 'first_person';
      this.showStatus('First-Person Camera');
    } else if (this.cameraMode === 'first_person') {
      this.cameraMode = 'third_person';
      this.showStatus('Third-Person Camera');
    } else {
      this.cameraMode = 'third_person';
      this.showStatus('Third-Person Camera');
    }
    this.emitHudSnapshot();
  }

  public toggleUnderwaterCamera(): void {
    if (this.cameraMode === 'underwater') {
      this.cameraMode = 'third_person';
      this.showStatus('Surface Camera');
    } else {
      this.cameraMode = 'underwater';
      this.showStatus('Underwater Lure Camera');
    }
    this.emitHudSnapshot();
  }

  public toggleBoatBoarding(): void {
    if (this.screenState !== 'playing') return;
    if (this.fishingPhase !== 'idle') {
      this.cancelFishing();
    }
    if (this.mode === 'foot') {
      const distToBoat = Math.hypot(this.playerPos.x - this.boatState.x, this.playerPos.z - this.boatState.z);
      if (distToBoat <= 10.5) {
        this.mode = 'boat';
        this.showStatus(`Boarded ${getBoatById(this.save.equippedBoatId).name}`);
        this.emitHudSnapshot();
      } else {
        this.showStatus('Move closer to the boat to board');
      }
    } else {
      // Exit boat onto pier or shore if close enough
      const pier = getPierBounds(this.save.locationId);
      const distToPier = Math.hypot(
        this.boatState.x - (pier.maxX + 2),
        this.boatState.z - (pier.minZ + 4),
      );
      const shoreY = getWalkableSurfaceY(this.save.locationId, this.boatState.x, this.boatState.z + 4.5);
      if (distToPier <= 14) {
        this.mode = 'foot';
        this.boatState.speed = 0;
        this.playerPos.set(pier.maxX - 1.2, pier.deckY, pier.minZ + 3.5);
        this.playerYaw = Math.PI;
        this.showStatus('Stepped onto Pier');
      } else if (shoreY !== null) {
        this.mode = 'foot';
        this.boatState.speed = 0;
        this.playerPos.set(this.boatState.x, shoreY, this.boatState.z + 4.5);
        this.showStatus('Stepped onto Shore');
      } else {
        this.showStatus('Steer closer to the pier or shore to disembark');
      }
      this.emitHudSnapshot();
    }
  }

  public cancelFishing(): void {
    this.fishingPhase = 'idle';
    this.castPower = 0;
    this.fight = null;
    this.pendingSpecimen = null;
    this.fishingLine.visible = false;
    this.bobberGroup.visible = false;
    this.hookMesh.visible = false;
    if (this.hookedFishRig) {
      this.scene.remove(this.hookedFishRig.group);
      this.hookedFishRig = null;
    }
    this.emitHudSnapshot();
  }

  public showStatus(msg: string, seconds = 2.6): void {
    this.statusMessage = msg;
    this.statusMessageTimer = seconds;
  }

  private handleResize(): void {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  // --- Main Simulation & Render Loop ---

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.screenState !== 'paused') {
      this.elapsed += dt;
      this.updateAtmosphere(dt);
      this.updateWaterAndWeather(dt);
      this.updateFishAI(dt);
      this.updateSplashes(dt);

      if (this.screenState === 'title') {
        this.updateTitleCamera(dt);
        this.updateActorsIdle(dt);
      } else if (this.screenState === 'playing') {
        this.updateGameplay(dt);
        this.updateGameplayCamera(dt);
      }
    }

    this.renderer.render(this.scene, this.camera);

    // Clear single-frame edge flags
    this.actionJustPressed = false;
    this.actionJustReleased = false;

    this.scheduleNextFrame();
  }

  private updateAtmosphere(dt: number): void {
    // Advance time of day smoothly
    if (this.screenState === 'playing' && this.save.settings.timeCycleSpeed > 0) {
      // 1 full 24h day = ~12 minutes at 1x speed
      const nextHour = (this.save.timeOfDay + dt * 0.032 * this.save.settings.timeCycleSpeed) % 24;
      this.save = { ...this.save, timeOfDay: nextHour };
      this.timeSyncAccum += dt;
      if (this.timeSyncAccum > 4) {
        this.timeSyncAccum = 0;
        this.callbacks.onTimeOfDaySync(nextHour);
      }
    }

    const hour = this.save.timeOfDay;
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2; // 6:00 sunrise, 12:00 zenith, 18:00 sunset
    const sunElev = Math.sin(sunAngle);
    const sunHoriz = Math.cos(sunAngle);

    _v1.set(sunHoriz * 0.72, Math.max(-0.25, sunElev), -0.68).normalize();
    this.sunLight.position.copy(_v1).multiplyScalar(110);
    this.sunOrb.position.copy(_v1).multiplyScalar(320);
    this.sunOrb.visible = sunElev > -0.08;

    const weather = this.save.weather;
    const isRainy = weather === 'rainy';
    const isStormy = weather === 'stormy';
    const isCloudy = weather === 'cloudy' || isRainy || isStormy;

    // Storm lightning flashes
    if (isStormy && Math.random() < dt * 0.14) {
      this.lightningFlash = 1.0;
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);

    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.15, 0.35);
    const goldenFactor = Math.max(0, 1 - Math.abs(sunElev - 0.12) * 4.2) * (1 - (isStormy ? 0.8 : 0));

    // Sky palette blending (Day -> Golden Hour -> Deep Starry Night -> Overcast Storm)
    const topDay = new THREE.Color('#1c6ca8');
    const topNight = new THREE.Color('#061124');
    const topStorm = new THREE.Color('#202f3f');
    const topCol = topNight.clone().lerp(topDay, dayFactor);
    if (isCloudy) topCol.lerp(topStorm, isStormy ? 0.78 : isRainy ? 0.58 : 0.35);

    const loc = getLocationById(this.save.locationId);
    const horizDay = new THREE.Color(loc.fogDayColor);
    const horizGolden = new THREE.Color('#eba268');
    const horizNight = new THREE.Color('#0c2138');
    const horizStorm = new THREE.Color('#3b4d5c');
    const horizCol = horizNight.clone().lerp(horizDay, dayFactor);
    horizCol.lerp(horizGolden, goldenFactor * 0.75);
    if (isCloudy) horizCol.lerp(horizStorm, isStormy ? 0.75 : isRainy ? 0.55 : 0.32);

    this.skyMat.uniforms.uTopColor.value.copy(topCol);
    this.skyMat.uniforms.uHorizonColor.value.copy(horizCol);
    this.skyMat.uniforms.uSunDir.value.copy(_v1);
    this.skyMat.uniforms.uCloudCover.value = isStormy ? 0.92 : isRainy ? 0.75 : weather === 'cloudy' ? 0.55 : 0.16;

    // Horizon-matched FogExp2
    this.fog.color.copy(horizCol);
    this.fog.density = isStormy ? 0.0092 : isRainy ? 0.0068 : weather === 'cloudy' ? 0.005 : 0.0038;

    // Lighting warm/cool balance
    const weatherDim = isStormy ? 0.45 : isRainy ? 0.62 : weather === 'cloudy' ? 0.78 : 1.0;
    this.sunLight.intensity = Math.max(0.25, dayFactor * 2.35 * weatherDim) + this.lightningFlash * 3.5;
    this.sunLight.color.set('#fff3db').lerp(new THREE.Color('#ffad60'), goldenFactor * 0.75);
    if (dayFactor < 0.15) {
      this.sunLight.color.set('#8db4e0'); // Moonlit rim at night
    }
    this.hemiLight.intensity = 0.32 + dayFactor * 0.65 * weatherDim + this.lightningFlash * 0.6;
    this.hemiLight.color.copy(horizCol);

    // Night stars & lighthouse beam
    (this.starsPoints.material as THREE.PointsMaterial).opacity =
      (1 - dayFactor) * (isCloudy ? 0.15 : 0.88);
    if (this.lighthouseBeam) {
      this.lighthouseBeam.rotation.y += dt * 0.65;
      this.lighthouseBeam.visible = dayFactor < 0.65 || isStormy;
    }
    const lanternIntensity = 0.4 + (1 - dayFactor) * 2.4;
    for (const mat of this.lanternGlows) {
      mat.emissiveIntensity = lanternIntensity;
    }

    // Water shader atmosphere uniforms
    this.waterMat.uniforms.uSkyColor.value.copy(horizCol);
    this.waterMat.uniforms.uSunDir.value.copy(_v1);
    this.waterMat.uniforms.uSunColor.value.copy(this.sunLight.color);
    this.waterMat.uniforms.uFogColor.value.copy(horizCol);
    this.waterMat.uniforms.uFogDensity.value = this.fog.density;
  }

  private updateWaterAndWeather(dt: number): void {
    const loc = getLocationById(this.save.locationId);
    const waveAmp = getWaveAmplitude(loc.baseWaveAmp, this.save.weather);
    this.waterMat.uniforms.uTime.value = this.elapsed;
    this.waterMat.uniforms.uWaveAmp.value = waveAmp;

    // Rain particle drop update
    const raining = this.save.weather === 'rainy' || this.save.weather === 'stormy';
    this.rainPoints.visible = raining;
    if (raining) {
      const centerX = this.mode === 'boat' ? this.boatState.x : this.playerPos.x;
      const centerZ = this.mode === 'boat' ? this.boatState.z : this.playerPos.z;
      const dropSpeed = this.save.weather === 'stormy' ? 38 : 26;
      const windX = this.save.weather === 'stormy' ? 8 : 2.5;
      const count = this.rainPositions.length / 3;
      for (let i = 0; i < count; i++) {
        let rx = this.rainPositions[i * 3] + windX * dt;
        let ry = this.rainPositions[i * 3 + 1] - dropSpeed * dt;
        let rz = this.rainPositions[i * 3 + 2];
        if (ry < 0) {
          ry = 28 + Math.random() * 8;
          rx = centerX + (Math.random() - 0.5) * 76;
          rz = centerZ + (Math.random() - 0.5) * 76;
        }
        this.rainPositions[i * 3] = rx;
        this.rainPositions[i * 3 + 1] = ry;
        this.rainPositions[i * 3 + 2] = rz;
      }
      (this.rainPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private updateActorsIdle(dt: number): void {
    const loc = getLocationById(this.save.locationId);
    const waveAmp = getWaveAmplitude(loc.baseWaveAmp, this.save.weather);
    const boatWaveY = getWaveHeight(this.boatState.x, this.boatState.z, this.elapsed, waveAmp);

    this.boatRig.group.position.set(this.boatState.x, boatWaveY, this.boatState.z);
    this.boatRig.group.rotation.set(
      Math.sin(this.elapsed * 1.4) * 0.03 * (waveAmp / 0.2),
      this.boatState.yaw,
      Math.cos(this.elapsed * 1.1) * 0.04 * (waveAmp / 0.2),
    );
    this.angler.group.position.copy(this.playerPos);
    this.angler.group.rotation.y = this.playerYaw;
    this.angler.bodyGroup.visible = true;
    this.angler.rodGroup.rotation.x = -0.35 + Math.sin(this.elapsed * 1.5) * 0.03;
    void dt;
  }

  private updateTitleCamera(dt: number): void {
    // Cinematic orbital flyover over the bay, pier, boat, and lighthouse
    const angle = this.elapsed * 0.14 - 0.35;
    const radius = 32;
    const targetX = Math.sin(angle) * radius - 6;
    const targetZ = 10 + Math.cos(angle) * 24;
    const targetY = 11.5 + Math.sin(this.elapsed * 0.3) * 1.8;

    this.camera.position.set(targetX, targetY, targetZ);
    this.camera.lookAt(-6, 3.8, -6);
    void dt;
  }

  private updateGameplay(dt: number): void {
    const loc = getLocationById(this.save.locationId);
    const waveAmp = getWaveAmplitude(loc.baseWaveAmp, this.save.weather);

    // Gather unified movement input (WASD + Arrows + Mobile Joystick)
    let moveForward = -this.touchMove.y;
    let moveRight = this.touchMove.x;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;
    moveForward = THREE.MathUtils.clamp(moveForward, -1, 1);
    moveRight = THREE.MathUtils.clamp(moveRight, -1, 1);

    // Update Status Toast Timer
    if (this.statusMessageTimer > 0) {
      this.statusMessageTimer -= dt;
      if (this.statusMessageTimer <= 0) {
        this.statusMessage = null;
      }
    }

    if (this.mode === 'foot') {
      // Walking on Pier / Shoreline (locked while actively fighting or casting)
      const canWalk = this.fishingPhase === 'idle' || this.fishingPhase === 'waiting';
      if (canWalk && (Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05)) {
        if (this.fishingPhase === 'waiting') {
          this.cancelFishing();
        }
        const walkSpeed = 5.2;
        // Move relative to current camera yaw
        const camForwardYaw = this.playerYaw + this.camYawOffset;
        const fx = Math.sin(camForwardYaw);
        const fz = Math.cos(camForwardYaw);
        const rx = -fz;
        const rz = fx;

        const dx = (fx * moveForward + rx * moveRight) * walkSpeed * dt;
        const dz = (fz * moveForward + rz * moveRight) * walkSpeed * dt;
        const nextX = this.playerPos.x + dx;
        const nextZ = this.playerPos.z + dz;
        const nextY = getWalkableSurfaceY(this.save.locationId, nextX, nextZ);

        if (nextY !== null) {
          this.playerPos.set(nextX, nextY, nextZ);
          const stepDist = Math.hypot(dx, dz);
          this.walkAnimDist += stepDist * 4.5;
          // Smoothly turn angler toward travel direction
          const desiredYaw = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(desiredYaw - this.playerYaw), Math.cos(desiredYaw - this.playerYaw));
          this.playerYaw += diff * (1 - Math.exp(-10 * dt));
        }
      } else {
        // Gentle leg settle
        this.angler.leftLeg.rotation.x *= Math.exp(-12 * dt);
        this.angler.rightLeg.rotation.x *= Math.exp(-12 * dt);
      }

      this.angler.leftLeg.rotation.x = Math.sin(this.walkAnimDist) * 0.45;
      this.angler.rightLeg.rotation.x = -Math.sin(this.walkAnimDist) * 0.45;
      this.angler.group.position.copy(this.playerPos);
      this.angler.group.rotation.y = this.playerYaw;

      // Idle moored boat bobs on waves
      const boatWaveY = getWaveHeight(this.boatState.x, this.boatState.z, this.elapsed, waveAmp);
      this.boatRig.group.position.set(this.boatState.x, boatWaveY, this.boatState.z);
      this.boatRig.group.rotation.set(
        Math.sin(this.elapsed * 1.4) * 0.03,
        this.boatState.yaw,
        Math.cos(this.elapsed * 1.1) * 0.04,
      );
      this.audio.updateAmbience(this.save.weather, false, 0);
    } else {
      // Boat Driving Mode (if fishing, boat holds gentle drift; throttle cancels cast)
      const isDrivingInput = Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05;
      if (isDrivingInput && this.fishingPhase !== 'idle' && this.fishingPhase !== 'fighting') {
        this.cancelFishing();
      }
      const upgrades = this.save.boatUpgrades[this.save.equippedBoatId];
      this.boatState = stepBoatKinematics(
        this.boatState,
        {
          throttle: this.fishingPhase === 'fighting' ? 0 : moveForward,
          steer: this.fishingPhase === 'fighting' ? 0 : moveRight,
        },
        this.save.equippedBoatId,
        upgrades,
        this.save.locationId,
        dt,
      );

      const boatWaveY = getWaveHeight(this.boatState.x, this.boatState.z, this.elapsed, waveAmp);
      const bobPitch = Math.sin(this.elapsed * 1.6) * 0.025 * (waveAmp / 0.2);
      const bobRoll = Math.cos(this.elapsed * 1.3) * 0.032 * (waveAmp / 0.2);
      this.boatRig.group.position.set(this.boatState.x, boatWaveY, this.boatState.z);
      this.boatRig.group.rotation.set(
        this.boatState.pitch + bobPitch,
        this.boatState.yaw,
        this.boatState.roll + bobRoll,
      );

      // Spin propellers & spawn stern wake foam when moving
      const speedAbs = Math.abs(this.boatState.speed);
      for (const prop of this.boatRig.propellers) {
        prop.rotation.z += (2.5 + speedAbs * 2.2) * dt;
      }
      if (speedAbs > 2.0 && Math.random() < dt * 24) {
        const sternDist = getBoatById(this.save.equippedBoatId).lengthM * 0.48;
        const wx = this.boatState.x - Math.sin(this.boatState.yaw) * sternDist;
        const wz = this.boatState.z - Math.cos(this.boatState.yaw) * sternDist;
        this.spawnSplashBurst(wx, boatWaveY + 0.05, wz, 2, 1.3, 0.9);
      }

      // Position Angler on Boat (helm when driving, aft/bow deck when fishing)
      const offset =
        this.fishingPhase === 'idle' ? this.boatRig.playerSeatOffset : this.boatRig.fishingStandOffset;
      _v1.copy(offset).applyEuler(this.boatRig.group.rotation).add(this.boatRig.group.position);
      this.playerPos.copy(_v1);
      this.playerYaw = this.boatState.yaw;
      this.angler.group.position.copy(this.playerPos);
      this.angler.group.rotation.y = this.playerYaw;
      this.angler.leftLeg.rotation.x = 0;
      this.angler.rightLeg.rotation.x = 0;

      const maxSpd = getBoatById(this.save.equippedBoatId).maxSpeed;
      this.audio.updateAmbience(this.save.weather, true, Math.min(1, speedAbs / maxSpd));
    }

    // Show/hide angler body in First-Person mode so head never clips camera (rod stays visible!)
    this.angler.bodyGroup.visible = this.cameraMode !== 'first_person';

    // Step Fishing State Machine
    this.updateFishingMachine(dt, waveAmp);

    // Emit throttled HUD snapshot (~10Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private updateFishingMachine(dt: number, waveAmp: number): void {
    const rod = getRodById(this.save.equippedRodId);
    const hook = getHookById(this.save.equippedHookId);
    const upgrades = this.save.boatUpgrades[this.save.equippedBoatId];

    // Rod bend visual target (0 = straight, 1 = deep dramatic arch under tension)
    let targetBend = 0.05;
    let targetRodPitch = -0.32;

    if (this.fishingPhase === 'idle') {
      if (this.actionJustPressed) {
        // Begin charging cast
        this.fishingPhase = 'charging';
        this.castPower = 0.15;
        this.castPowerDir = 1;
        this.emitHudSnapshot();
      }
    } else if (this.fishingPhase === 'charging') {
      this.castPower += this.castPowerDir * dt * 1.15;
      if (this.castPower >= 1) {
        this.castPower = 1;
        this.castPowerDir = -1;
      } else if (this.castPower <= 0.15) {
        this.castPower = 0.15;
        this.castPowerDir = 1;
      }
      targetRodPitch = -0.32 - this.castPower * 0.72; // Pull rod back during windup

      if (this.actionJustReleased || !this.actionHeld) {
        // Cast forward along camera aim / player facing direction
        const aimYaw = this.playerYaw + this.camYawOffset;
        const castDist = 7 + this.castPower * (rod.castRangeM - 7);
        const dirX = Math.sin(aimYaw);
        const dirZ = Math.cos(aimYaw);
        const targetX = this.playerPos.x + dirX * castDist;
        const targetZ = this.playerPos.z + dirZ * castDist;

        // Verify target lands in water; if aimed at land, find nearest water spot forward
        if (getWaterDepth(this.save.locationId, targetX, targetZ) < 0.7) {
          this.showStatus('Aim toward open water to cast!');
          this.fishingPhase = 'idle';
          this.castPower = 0;
          this.emitHudSnapshot();
        } else {
          this.angler.rodTipMarker.getWorldPosition(this.castStartPos);
          this.castTargetPos.set(targetX, WATER_LEVEL, targetZ);
          this.castArcTime = 0;
          this.castArcDuration = 0.55 + this.castPower * 0.35;
          this.fishingPhase = 'casting';
          this.fishingLine.visible = true;
          this.bobberGroup.visible = true;
          this.hookMesh.visible = false;
          this.audio.playCastWhoosh();
          this.callbacks.onBaitConsumed();
          this.emitHudSnapshot();
        }
      }
    } else if (this.fishingPhase === 'casting') {
      this.castArcTime += dt;
      const t = Math.min(1, this.castArcTime / this.castArcDuration);
      this.bobberPos.lerpVectors(this.castStartPos, this.castTargetPos, t);
      this.bobberPos.y += Math.sin(t * Math.PI) * (3.2 + this.castPower * 4.5);
      this.bobberGroup.position.copy(this.bobberPos);
      targetRodPitch = 0.25 * Math.sin(t * Math.PI) - 0.25;

      if (t >= 1) {
        this.fishingPhase = 'waiting';
        this.bobberPos.copy(this.castTargetPos);
        const depth = getWaterDepth(this.save.locationId, this.bobberPos.x, this.bobberPos.z);
        this.hookPos.set(
          this.bobberPos.x,
          -Math.min(Math.max(1.2, depth * 0.45), 6.5),
          this.bobberPos.z,
        );
        this.hookMesh.position.copy(this.hookPos);
        this.hookMesh.visible = true;
        this.spawnSplashBurst(this.bobberPos.x, WATER_LEVEL, this.bobberPos.z, 10, 1.8, 2.5);
        this.audio.playSplash(0.55);
        this.showStatus('Line in water — waiting for a bite...');
        this.emitHudSnapshot();
      }
    } else if (this.fishingPhase === 'waiting') {
      // Clicking again while waiting reels line back in
      if (this.actionJustPressed) {
        this.cancelFishing();
        this.showStatus('Line retrieved');
        return;
      }

      const waveY = getWaveHeight(this.bobberPos.x, this.bobberPos.z, this.elapsed, waveAmp);
      this.bobberPos.y = waveY;
      this.bobberGroup.position.copy(this.bobberPos);

      // Gentle underwater hook sway
      this.hookPos.x = this.bobberPos.x + Math.sin(this.elapsed * 1.4) * 0.22;
      this.hookPos.z = this.bobberPos.z + Math.cos(this.elapsed * 1.1) * 0.22;
      this.hookMesh.position.copy(this.hookPos);

      // Pulse ripple ring on water surface
      const ring = this.bobberGroup.getObjectByName('rippleRing');
      if (ring) {
        const s = 1 + ((this.elapsed * 0.9) % 1) * 1.8;
        ring.scale.setScalar(s);
      }

      // Count nearby underwater fish AI investigating the lure
      let nearbyCount = 0;
      for (const f of this.fishAgents) {
        const d = Math.hypot(f.x - this.hookPos.x, f.z - this.hookPos.z);
        if (d < getBaitById(this.save.equippedBaitId).attractRadiusM) {
          nearbyCount++;
        }
      }

      const biteRate = calculateBiteRatePerSecond({
        baitId: this.save.equippedBaitId,
        hookId: this.save.equippedHookId,
        weather: this.save.weather,
        timeOfDay: this.save.timeOfDay,
        sonarLevel: upgrades.sonarLevel,
        nearbyFishCount: nearbyCount,
      });

      if (Math.random() < biteRate * dt) {
        const depth = getWaterDepth(this.save.locationId, this.bobberPos.x, this.bobberPos.z);
        this.pendingSpecimen = rollFishSpecimen({
          locationId: this.save.locationId,
          waterDepthM: depth,
          baitId: this.save.equippedBaitId,
        });
        this.fishingPhase = 'bite';
        this.biteWindowMax = hook.hookSetWindowSec;
        this.biteTimer = this.biteWindowMax;
        this.audio.playBiteAlert();
        this.spawnSplashBurst(this.bobberPos.x, WATER_LEVEL, this.bobberPos.z, 16, 2.4, 3.6);
        this.showStatus('FISH ON! Press SPACE or REEL to set the hook!', 2.5);
        this.emitHudSnapshot();
      }
    } else if (this.fishingPhase === 'bite') {
      this.biteTimer -= dt;
      // Bobber plunges frantically beneath waves!
      const waveY = getWaveHeight(this.bobberPos.x, this.bobberPos.z, this.elapsed, waveAmp);
      this.bobberGroup.position.set(
        this.bobberPos.x + Math.sin(this.elapsed * 32) * 0.14,
        waveY - 0.28 + Math.sin(this.elapsed * 24) * 0.1,
        this.bobberPos.z + Math.cos(this.elapsed * 28) * 0.14,
      );
      targetBend = 0.25;

      if (this.actionJustPressed || this.actionHeld) {
        // Hook Set! Transition to Tension & Reel Fight
        const spec = this.pendingSpecimen!;
        const initialDist = Math.hypot(
          this.bobberPos.x - this.playerPos.x,
          this.bobberPos.z - this.playerPos.z,
        );
        this.fight = createFightState(spec.species, spec.weightKg, spec.lengthCm, initialDist);
        this.fishingPhase = 'fighting';
        this.bobberGroup.visible = false;
        this.hookMesh.visible = false;

        // Spawn visible 3D hooked fish mesh at bobber!
        const scale = THREE.MathUtils.clamp(0.85 + Math.cbrt(spec.weightKg) * 0.34, 0.9, 3.1);
        this.hookedFishRig = createFishModel(spec.species, scale);
        this.hookedFishRig.group.position.set(this.bobberPos.x, -0.7, this.bobberPos.z);
        this.scene.add(this.hookedFishRig.group);

        this.cameraShakeTrauma = 0.35;
        this.spawnSplashBurst(this.bobberPos.x, WATER_LEVEL, this.bobberPos.z, 22, 3.0, 4.4);
        this.audio.playSplash(0.95);
        this.showStatus(`Hooked a ${spec.species.name}! Hold REEL — ease off during surges!`);
        this.emitHudSnapshot();
      } else if (this.biteTimer <= 0) {
        this.showStatus('Fish got away — react faster when the bobber plunges!');
        this.cancelFishing();
      }
    } else if (this.fishingPhase === 'fighting' && this.fight) {
      const res = stepFishingFight(
        this.fight,
        {
          reeling: this.actionHeld,
          rodId: this.save.equippedRodId,
          reelId: this.save.equippedReelId,
          lineId: this.save.equippedLineId,
        },
        dt,
      );
      this.fight = res.state;

      if (this.actionHeld) {
        this.angler.reelCrank.rotation.x += dt * 16;
        this.audio.playReelTick(this.fight.tension);
      }

      // Position hooked fish relative to angler based on fight distance & lateral pull
      const dirX = Math.sin(this.playerYaw + this.camYawOffset * 0.35);
      const dirZ = Math.cos(this.playerYaw + this.camYawOffset * 0.35);
      const sideX = -dirZ;
      const sideZ = dirX;
      const lateral = Math.sin(this.elapsed * 1.9) * (this.fight.isSurging ? 3.8 : 1.6) * this.fight.pullDirection;

      const fx = this.playerPos.x + dirX * this.fight.distanceM + sideX * lateral;
      const fz = this.playerPos.z + dirZ * this.fight.distanceM + sideZ * lateral;
      const waveY = getWaveHeight(fx, fz, this.elapsed, waveAmp);
      let fy = waveY - (this.fight.isSurging ? 0.45 : 0.85);
      if (this.fight.isJumping) {
        fy = waveY + Math.sin(this.fight.jumpProgress * Math.PI) * 2.6 - 0.2;
        if (this.fight.jumpProgress < 0.1 || this.fight.jumpProgress > 0.9) {
          this.spawnSplashBurst(fx, waveY, fz, 5, 2.2, 3.2);
        }
      } else if (this.fight.isSurging && Math.random() < dt * 16) {
        this.spawnSplashBurst(fx, waveY, fz, 3, 2.0, 2.4);
      }

      this.bobberPos.set(fx, fy, fz);

      if (this.hookedFishRig) {
        this.hookedFishRig.group.position.set(fx, fy, fz);
        // Point fish away when surging, toward angler when tired
        const targetYaw = this.fight.isSurging
          ? Math.atan2(fx - this.playerPos.x, fz - this.playerPos.z) + this.fight.pullDirection * 0.55
          : Math.atan2(this.playerPos.x - fx, this.playerPos.z - fz);
        this.hookedFishRig.group.rotation.y = targetYaw;
        this.hookedFishRig.group.rotation.x = this.fight.isJumping
          ? Math.cos(this.fight.jumpProgress * Math.PI) * -0.7
          : 0;
        this.hookedFishRig.tailPivot.rotation.y = Math.sin(this.elapsed * (this.fight.isSurging ? 28 : 14)) * 0.48;
      }

      targetBend = 0.2 + this.fight.tension * 0.95;
      targetRodPitch = -0.58 + this.fight.tension * 0.25;
      if (this.fight.tension > 0.78) {
        this.cameraShakeTrauma = Math.max(this.cameraShakeTrauma, (this.fight.tension - 0.75) * 0.65);
      }

      if (res.outcome === 'caught') {
        const caughtFish = createCaughtFishRecord(
          this.fight.species,
          this.fight.weightKg,
          this.fight.lengthCm,
          this.save.locationId,
        );
        this.audio.playCatchFanfare();
        this.spawnSplashBurst(fx, waveY, fz, 26, 3.2, 4.5);
        this.cancelFishing();
        this.callbacks.onFishCaught(caughtFish);
      } else if (res.outcome === 'line_break') {
        this.audio.playLineSnap();
        this.cameraShakeTrauma = 0.5;
        this.showStatus('LINE SNAPPED! Ease off reeling when tension enters the red zone.', 3.6);
        this.cancelFishing();
      } else if (res.outcome === 'escaped_slack') {
        this.audio.playLineSnap();
        this.showStatus('Hook slipped — keep light tension on the line!', 3.2);
        this.cancelFishing();
      } else if (res.outcome === 'escaped_far') {
        this.audio.playLineSnap();
        this.showStatus('Fish spooled all your line! Upgrade your reel & line for big game.', 3.4);
        this.cancelFishing();
      }
    }

    // Apply smooth physical rod pitch & multi-segment curve bend
    const rodDamp = 1 - Math.exp(-10 * dt);
    this.angler.rodGroup.rotation.x += (targetRodPitch - this.angler.rodGroup.rotation.x) * rodDamp;
    for (let i = 0; i < this.angler.rodSegments.length; i++) {
      const segBend = targetBend * (0.09 + i * 0.085);
      this.angler.rodSegments[i].rotation.x += (segBend - this.angler.rodSegments[i].rotation.x) * rodDamp;
    }

    // Update curved fishing line geometry from rod tip to bobber/fish
    if (this.fishingLine.visible) {
      this.angler.rodTipMarker.getWorldPosition(_v2);
      const endPos = this.fishingPhase === 'fighting' ? this.bobberPos : this.bobberGroup.position;
      const segs = 17;
      const sag = this.fishingPhase === 'fighting' ? (1 - (this.fight?.tension ?? 0.5)) * 0.4 : 0.75;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        _v3.lerpVectors(_v2, endPos, t);
        _v3.y -= Math.sin(t * Math.PI) * sag;
        this.linePositions[i * 3] = _v3.x;
        this.linePositions[i * 3 + 1] = _v3.y;
        this.linePositions[i * 3 + 2] = _v3.z;
      }
      (this.fishingLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private updateFishAI(dt: number): void {
    const hookActive = this.fishingPhase === 'waiting' || this.fishingPhase === 'bite';
    const attractRadius = getBaitById(this.save.equippedBaitId).attractRadiusM;

    for (const f of this.fishAgents) {
      f.decisionTimer -= dt;

      // Investigate baited hook if swimming within bait attraction radius!
      if (hookActive) {
        const distToHook = Math.hypot(f.x - this.hookPos.x, f.z - this.hookPos.z);
        if (distToHook < attractRadius) {
          f.curiousOfHook = true;
          const orbitAng = this.elapsed * 0.9 + f.tailPhase;
          const orbitR = this.fishingPhase === 'bite' ? 0.3 : 1.8;
          f.targetX = this.hookPos.x + Math.cos(orbitAng) * orbitR;
          f.targetY = this.hookPos.y;
          f.targetZ = this.hookPos.z + Math.sin(orbitAng) * orbitR;
        } else {
          f.curiousOfHook = false;
        }
      } else {
        f.curiousOfHook = false;
      }

      if (!f.curiousOfHook && f.decisionTimer <= 0) {
        f.decisionTimer = 3.0 + Math.random() * 5.0;
        const tx = f.x + (Math.random() - 0.5) * 32;
        const tz = f.z + (Math.random() - 0.5) * 32;
        const depth = getWaterDepth(this.save.locationId, tx, tz);
        if (depth > 2.2 && Math.abs(tx) < 130 && Math.abs(tz) < 130) {
          f.targetX = tx;
          f.targetZ = tz;
          f.targetY = -Math.min(depth - 0.8, 1.0 + Math.random() * Math.min(8, depth * 0.65));
        } else {
          // Steer back toward open deep water
          f.targetX = (Math.random() - 0.5) * 60;
          f.targetZ = -35 + (Math.random() - 0.5) * 40;
        }
      }

      const dx = f.targetX - f.x;
      const dy = f.targetY - f.y;
      const dz = f.targetZ - f.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const desiredYaw = Math.atan2(dx, dz);
        const diff = Math.atan2(Math.sin(desiredYaw - f.yaw), Math.cos(desiredYaw - f.yaw));
        f.yaw += diff * (1 - Math.exp(-3.2 * dt));
        const spd = f.curiousOfHook ? f.speed * 1.15 : f.speed;
        f.x += Math.sin(f.yaw) * spd * dt;
        f.z += Math.cos(f.yaw) * spd * dt;
      }
      f.y += dy * (1 - Math.exp(-1.5 * dt));

      // Keep fish underwater
      const curDepth = getWaterDepth(this.save.locationId, f.x, f.z);
      if (curDepth < 1.2) {
        f.targetZ = -30;
        f.y = -0.8;
      } else {
        f.y = THREE.MathUtils.clamp(f.y, -(curDepth - 0.5), -0.65);
      }

      f.tailPhase += dt * (7.5 + f.speed * 2.2);
      f.rig.group.position.set(f.x, f.y, f.z);
      f.rig.group.rotation.y = f.yaw;
      f.rig.tailPivot.rotation.y = Math.sin(f.tailPhase) * 0.36;
    }
  }

  private updateSplashes(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.splashPool.length; i++) {
      const p = this.splashPool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.splashInstanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(p.size * t);
      _dummy.updateMatrix();
      this.splashInstanced.setMatrixAt(i, _dummy.matrix);
    }
    if (anyChanged) {
      this.splashInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  private updateGameplayCamera(dt: number): void {
    const damp = 1 - Math.exp(-9.5 * dt);
    const baseYaw = this.playerYaw + this.camYawOffset;

    if (this.cameraMode === 'underwater') {
      // Dive beneath water to watch the underwater hook & approaching fish AI!
      const focus =
        this.fishingPhase === 'waiting' || this.fishingPhase === 'bite' || this.fishingPhase === 'fighting'
          ? this.fishingPhase === 'fighting'
            ? this.bobberPos
            : this.hookPos
          : _v4.set(
              this.playerPos.x + Math.sin(baseYaw) * 16,
              -2.5,
              this.playerPos.z + Math.cos(baseYaw) * 16,
            );
      _camPos.set(
        focus.x - Math.sin(baseYaw) * 5.2,
        Math.min(-0.85, focus.y + 0.6),
        focus.z - Math.cos(baseYaw) * 5.2,
      );
      _camTarget.copy(focus);
      this.camera.position.lerp(_camPos, damp);
      this.camera.lookAt(_camTarget);
      // Underwater aqua fog tint
      this.fog.color.set('#0c4c63');
      this.fog.density = 0.042;
      return;
    }

    if (this.cameraMode === 'first_person') {
      _camPos.set(this.playerPos.x, this.playerPos.y + 1.68, this.playerPos.z);
      const lookYaw = baseYaw;
      const lookPitch = THREE.MathUtils.clamp(-this.camPitch + 0.12, -0.75, 0.55);
      _camTarget.set(
        _camPos.x + Math.sin(lookYaw) * Math.cos(lookPitch) * 15,
        _camPos.y + Math.sin(lookPitch) * 15,
        _camPos.z + Math.cos(lookYaw) * Math.cos(lookPitch) * 15,
      );
      this.camera.position.lerp(_camPos, 1 - Math.exp(-18 * dt));
      this.camera.lookAt(_camTarget);
    } else {
      // Third-Person Chase / Angler Cam
      const dist = this.mode === 'boat' ? this.camDistance + (this.builtBoatId === 'luxury_yacht' ? 7.5 : 3.2) : this.camDistance;
      const heightOffset = this.mode === 'boat' ? 2.4 : 1.75;
      const horizDist = Math.cos(this.camPitch) * dist;
      const vertDist = Math.sin(this.camPitch) * dist + heightOffset;

      const anchorX = this.mode === 'boat' ? this.boatState.x : this.playerPos.x;
      const anchorY = this.mode === 'boat' ? this.boatRig.group.position.y + 1.2 : this.playerPos.y;
      const anchorZ = this.mode === 'boat' ? this.boatState.z : this.playerPos.z;

      _camPos.set(
        anchorX - Math.sin(baseYaw) * horizDist,
        Math.max(1.2, anchorY + vertDist),
        anchorZ - Math.cos(baseYaw) * horizDist,
      );

      // Keep camera above terrain
      const camGround = getTerrainHeight(this.save.locationId, _camPos.x, _camPos.z);
      if (_camPos.y < camGround + 1.4) {
        _camPos.y = camGround + 1.4;
      }

      if (this.fishingPhase === 'fighting' || this.fishingPhase === 'bite') {
        _camTarget.lerpVectors(this.playerPos, this.bobberPos, 0.45);
        _camTarget.y = Math.max(0.4, _camTarget.y);
      } else {
        _camTarget.set(
          anchorX + Math.sin(baseYaw) * 6,
          anchorY + 1.25,
          anchorZ + Math.cos(baseYaw) * 6,
        );
      }

      this.camera.position.lerp(_camPos, damp);
      this.camera.lookAt(_camTarget);
    }

    // Decaying trauma^2 camera shake on heavy strikes/tension
    if (this.cameraShakeTrauma > 0.005) {
      const shake = this.cameraShakeTrauma * this.cameraShakeTrauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.45;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.35;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 1.4);
    }

    // Dynamic FOV kick while speeding in boat
    const speedFov = this.mode === 'boat' ? Math.min(10, Math.abs(this.boatState.speed) * 0.42) : 0;
    const targetFov = 60 + speedFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHudSnapshot(): void {
    const distToBoat = Math.hypot(this.playerPos.x - this.boatState.x, this.playerPos.z - this.boatState.z);
    const pier = getPierBounds(this.save.locationId);
    const distToPier = Math.hypot(this.boatState.x - (pier.maxX + 2), this.boatState.z - (pier.minZ + 4));
    const shoreWalkable = getWalkableSurfaceY(this.save.locationId, this.boatState.x, this.boatState.z + 4.5) !== null;

    const refX =
      this.fishingPhase === 'waiting' || this.fishingPhase === 'bite' || this.fishingPhase === 'fighting'
        ? this.bobberPos.x
        : this.mode === 'boat'
          ? this.boatState.x
          : this.playerPos.x + Math.sin(this.playerYaw) * 14;
    const refZ =
      this.fishingPhase === 'waiting' || this.fishingPhase === 'bite' || this.fishingPhase === 'fighting'
        ? this.bobberPos.z
        : this.mode === 'boat'
          ? this.boatState.z
          : this.playerPos.z + Math.cos(this.playerYaw) * 14;

    const upgrades = this.save.boatUpgrades[this.save.equippedBoatId];
    const sonarRange = 28 + upgrades.sonarLevel * 12;
    const blips: SonarBlip[] = [];
    const anchorX = this.mode === 'boat' ? this.boatState.x : this.playerPos.x;
    const anchorZ = this.mode === 'boat' ? this.boatState.z : this.playerPos.z;

    for (const f of this.fishAgents) {
      const dx = f.x - anchorX;
      const dz = f.z - anchorZ;
      if (Math.hypot(dx, dz) <= sonarRange) {
        blips.push({
          x: dx / sonarRange,
          z: dz / sonarRange,
          depth: Math.abs(f.y),
          size: f.species.difficulty >= 7 ? 3 : f.species.difficulty >= 4 ? 2 : 1,
          speciesId: f.species.id,
        });
      }
    }

    const headingDeg = Math.round((((-this.playerYaw * 180) / Math.PI) % 360 + 360) % 360);
    const currentLineDist =
      this.fishingPhase === 'fighting' && this.fight
        ? this.fight.distanceM
        : this.fishingPhase === 'waiting' || this.fishingPhase === 'bite'
          ? Math.hypot(this.bobberPos.x - this.playerPos.x, this.bobberPos.z - this.playerPos.z)
          : 0;

    this.callbacks.onHudUpdate({
      mode: this.mode,
      canBoardBoat: this.mode === 'foot' && distToBoat <= 10.5,
      canExitBoat: this.mode === 'boat' && (distToPier <= 14 || shoreWalkable),
      boatSpeedKnots: Math.round(Math.abs(this.boatState.speed) * 1.94),
      headingDeg,
      waterDepthM: Number(getWaterDepth(this.save.locationId, refX, refZ).toFixed(1)),
      cameraMode: this.cameraMode,
      fishingPhase: this.fishingPhase,
      castPower: this.castPower,
      lineDistanceM: Number(currentLineDist.toFixed(1)),
      maxLineDistanceM: getLineById(this.save.equippedLineId).lengthM,
      tension: this.fight ? this.fight.tension : 0,
      fishStamina: this.fight ? this.fight.fishStamina : 1,
      fishSurging: this.fight ? this.fight.isSurging : false,
      hookedFishName: this.fight ? this.fight.species.name : null,
      hookedFishWeightEstimate: this.fight
        ? this.fight.weightKg > 50
          ? 'Massive'
          : this.fight.weightKg > 15
            ? 'Heavy'
            : this.fight.weightKg > 4
              ? 'Medium'
              : 'Light'
        : null,
      biteTimerRatio: this.fishingPhase === 'bite' ? Math.max(0, this.biteTimer / this.biteWindowMax) : 0,
      timeOfDay: this.save.timeOfDay,
      weather: this.save.weather,
      nearbyFishCount: blips.length,
      sonarBlips: blips.slice(0, 14),
      statusMessage: this.statusMessage,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);

    this.audio.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }
}
