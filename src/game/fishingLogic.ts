import {
  FISH_SPECIES,
  getBaitById,
  getBoatById,
  getHookById,
  getLineById,
  getReelById,
  getRodById,
} from './catalog';
import {
  BoatId,
  BoatUpgrades,
  CaughtFish,
  FightState,
  FishSpecies,
  LocationId,
  WeatherType,
} from './types';

export const WATER_LEVEL = 0;

/**
 * Deterministic terrain elevation for each location.
 * Negative values are underwater seabed depth; positive values are land.
 * Pier deck is handled separately via `isOnPier`.
 */
export function getTerrainHeight(locationId: LocationId, x: number, z: number): number {
  const ripple =
    Math.sin(x * 0.045) * Math.cos(z * 0.045) * 1.4 +
    Math.sin(x * 0.11 + z * 0.08) * 0.45;

  if (locationId === 'emerald_cove') {
    // South (+Z > 24) is sandy beach & headland cliffs; North (-Z) opens to deep bay/ocean.
    const coveCurve = Math.cos(x * 0.022) * 11;
    const shoreZ = 22 + coveCurve;
    const distFromShore = z - shoreZ;
    if (distFromShore > 0) {
      // Beach sloping smoothly up to coastal bluffs
      const beachSlope = distFromShore * 0.24;
      const headland = Math.max(0, Math.abs(x) - 38) * 0.35;
      return beachSlope + headland + ripple * 0.35;
    } else {
      // Gentle turquoise shallows dropping into deep ocean reef
      const seaDist = -distFromShore;
      const reefBump = Math.sin(x * 0.07) * Math.cos(z * 0.07) * 1.2;
      return -Math.min(28, seaDist * 0.22 + 0.5) + reefBump * 0.4;
    }
  }

  if (locationId === 'misty_lake') {
    // Circular alpine lake centered around (0, -18), radius ~68m; south bank around z=+34
    const cx = x;
    const cz = z + 22;
    const dist = Math.hypot(cx, cz);
    const lakeRadius = 62 + Math.sin(Math.atan2(cz, cx) * 4) * 6;
    const delta = dist - lakeRadius;
    if (delta > 0) {
      return delta * 0.36 + ripple * 0.5;
    }
    return -Math.min(18, -delta * 0.28 + 0.6) + ripple * 0.25;
  }

  if (locationId === 'salmon_river') {
    // Winding mountain river running East-West along centerZ(x)
    const centerZ = Math.sin(x * 0.028) * 14 - 8;
    const halfWidth = 22 + Math.cos(x * 0.04) * 4;
    const distFromCenter = Math.abs(z - centerZ);
    const bankDelta = distFromCenter - halfWidth;
    if (bankDelta > 0) {
      return bankDelta * 0.42 + ripple * 0.55;
    }
    const depthFactor = 1 - distFromCenter / halfWidth;
    return -(1.2 + depthFactor * 11.5) + ripple * 0.2;
  }

  // 'blue_abyss': Open ocean with a compact volcanic reef island / wooden dock platform at south (+Z ~ 36)
  const islandDist = Math.hypot(x, z - 44);
  if (islandDist < 22) {
    const h = (22 - islandDist) * 0.32;
    return h - 0.8 + ripple * 0.3;
  }
  // Distant twin sea stacks on the horizon
  const stackA = Math.hypot(x + 95, z + 80);
  if (stackA < 24) return (24 - stackA) * 0.75 - 2;
  const stackB = Math.hypot(x - 105, z + 65);
  if (stackB < 20) return (20 - stackB) * 0.65 - 2;

  return -Math.min(34, 8 + Math.max(0, islandDist - 22) * 0.28) + ripple * 0.35;
}

export interface PierBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  deckY: number;
}

export function getPierBounds(locationId: LocationId): PierBounds {
  if (locationId === 'salmon_river') {
    return { minX: -4.2, maxX: 4.2, minZ: 6, maxZ: 22, deckY: 1.45 };
  }
  if (locationId === 'misty_lake') {
    return { minX: -4.2, maxX: 4.2, minZ: 18, maxZ: 43, deckY: 1.45 };
  }
  if (locationId === 'blue_abyss') {
    return { minX: -4.4, maxX: 4.4, minZ: 10, maxZ: 31, deckY: 1.55 };
  }
  // emerald_cove
  return { minX: -4.2, maxX: 4.2, minZ: 10, maxZ: 38, deckY: 1.5 };
}

export function isOnPier(locationId: LocationId, x: number, z: number): boolean {
  const p = getPierBounds(locationId);
  return x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ;
}

/**
 * Walkable surface elevation for player on foot, or null if impassable/deep water.
 */
export function getWalkableSurfaceY(locationId: LocationId, x: number, z: number): number | null {
  if (isOnPier(locationId, x, z)) {
    return getPierBounds(locationId).deckY;
  }
  const h = getTerrainHeight(locationId, x, z);
  // Allow wading slightly into ankle-deep water (down to -0.15m) and climbing up to 7.5m
  if (h >= -0.15 && h <= 7.5) {
    return Math.max(0.05, h);
  }
  return null;
}

export function getWaterDepth(locationId: LocationId, x: number, z: number): number {
  const h = getTerrainHeight(locationId, x, z);
  return Math.max(0, WATER_LEVEL - h);
}

export function isNavigableWaterForBoat(locationId: LocationId, x: number, z: number): boolean {
  if (Math.abs(x) > 175 || Math.abs(z) > 175) return false;
  // Keep boat out of pier footprint
  const p = getPierBounds(locationId);
  if (x >= p.minX - 2.6 && x <= p.maxX + 2.6 && z >= p.minZ - 2.4 && z <= p.maxZ + 2.4) {
    return false;
  }
  return getWaterDepth(locationId, x, z) >= 1.25;
}

/**
 * Wave height function shared between CPU buoyancy/bobber math and Water GLSL shader.
 */
export function getWaveAmplitude(baseAmp: number, weather: WeatherType): number {
  switch (weather) {
    case 'sunny':
      return baseAmp * 0.85;
    case 'cloudy':
      return baseAmp * 1.15;
    case 'rainy':
      return baseAmp * 1.45;
    case 'stormy':
      return baseAmp * 2.15;
  }
}

export function getWaveHeight(x: number, z: number, time: number, amplitude: number): number {
  const w1 = Math.sin(x * 0.085 + time * 1.35) * 0.52;
  const w2 = Math.cos(z * 0.095 - time * 1.12) * 0.34;
  const w3 = Math.sin((x + z) * 0.14 + time * 2.1) * 0.14;
  return (w1 + w2 + w3) * amplitude;
}

/**
 * Spawn coordinates for player on pier and initial docked boat right beside the pier.
 */
export function getLocationSpawnPoints(locationId: LocationId): {
  playerPos: { x: number; y: number; z: number; yaw: number };
  boatPos: { x: number; z: number; yaw: number };
} {
  const pier = getPierBounds(locationId);
  const playerZ = pier.minZ + 5.5;
  return {
    playerPos: {
      x: 0,
      y: pier.deckY,
      z: playerZ,
      yaw: Math.PI, // Facing North (-Z) directly out over the open water & landmark vista
    },
    boatPos: {
      x: pier.maxX + 4.8,
      z: pier.minZ + 1.5,
      yaw: Math.PI,
    },
  };
}

export interface BoatKinematicsState {
  x: number;
  z: number;
  yaw: number;
  speed: number; // m/s forward (+), reverse (-)
  roll: number;
  pitch: number;
}

export interface BoatInput {
  throttle: number; // -1..1
  steer: number; // -1 (left) .. 1 (right)
}

export function stepBoatKinematics(
  state: BoatKinematicsState,
  input: BoatInput,
  boatId: BoatId,
  upgrades: BoatUpgrades,
  locationId: LocationId,
  dt: number,
): BoatKinematicsState {
  const spec = getBoatById(boatId);
  const engineBoost = 1 + (upgrades.engineLevel - 1) * 0.16;
  const maxSpeed = spec.maxSpeed * engineBoost;
  const maxReverse = maxSpeed * 0.35;
  const accel = maxSpeed * 0.65;
  const waterDrag = 1.65;

  let speed = state.speed;
  if (Math.abs(input.throttle) > 0.05) {
    speed += input.throttle * accel * dt;
  } else {
    // Natural hydrodynamic drag
    const drag = Math.exp(-waterDrag * dt);
    speed *= drag;
    if (Math.abs(speed) < 0.05) speed = 0;
  }
  speed = Math.max(-maxReverse, Math.min(maxSpeed, speed));

  // Steering works slightly even at low speed (outboard thrust vectoring), strongest while moving
  const steerEffectiveness = 0.35 + 0.65 * Math.min(1, Math.abs(speed) / (maxSpeed * 0.45));
  const reverseSign = speed < -0.2 ? -1 : 1;
  const yaw = state.yaw - input.steer * spec.turnRate * steerEffectiveness * reverseSign * dt;

  // Forward direction in Three.js where yaw=0 faces +Z, yaw=PI faces -Z
  const dirX = Math.sin(yaw);
  const dirZ = Math.cos(yaw);

  let nextX = state.x + dirX * speed * dt;
  let nextZ = state.z + dirZ * speed * dt;

  if (!isNavigableWaterForBoat(locationId, nextX, nextZ)) {
    // Slide check along axes to avoid getting stuck
    if (isNavigableWaterForBoat(locationId, nextX, state.z)) {
      nextZ = state.z;
      speed *= 0.4;
    } else if (isNavigableWaterForBoat(locationId, state.x, nextZ)) {
      nextX = state.x;
      speed *= 0.4;
    } else {
      nextX = state.x;
      nextZ = state.z;
      speed = -speed * 0.25;
    }
  }

  const targetRoll = -input.steer * Math.min(1, Math.abs(speed) / maxSpeed) * (0.18 / spec.stability);
  const targetPitch = -Math.max(0, speed / maxSpeed) * (0.09 / spec.stability);
  const damp = 1 - Math.exp(-6 * dt);

  return {
    x: nextX,
    z: nextZ,
    yaw,
    speed,
    roll: state.roll + (targetRoll - state.roll) * damp,
    pitch: state.pitch + (targetPitch - state.pitch) * damp,
  };
}

/**
 * Compute fish species pool & specimen roll for a cast location/depth/bait.
 */
export function getEligibleSpecies(locationId: LocationId, waterDepthM: number): FishSpecies[] {
  const byLocation = FISH_SPECIES.filter((s) => s.locations.includes(locationId));
  const byDepth = byLocation.filter(
    (s) => waterDepthM >= Math.max(0.8, s.minDepthM - 1.5) && waterDepthM <= s.maxDepthM + 8,
  );
  return byDepth.length > 0 ? byDepth : byLocation;
}

export function calculateBiteRatePerSecond(params: {
  baitId: string;
  hookId: string;
  weather: WeatherType;
  timeOfDay: number;
  sonarLevel: number;
  nearbyFishCount: number;
}): number {
  const bait = getBaitById(params.baitId);
  const hook = getHookById(params.hookId);
  // Dawn/Dusk feeding boost
  const isGolden =
    (params.timeOfDay >= 5 && params.timeOfDay <= 8.5) ||
    (params.timeOfDay >= 17 && params.timeOfDay <= 20.5);
  const timeMult = isGolden ? 1.25 : 1.0;
  const weatherMult =
    params.weather === 'rainy'
      ? 1.22
      : params.weather === 'cloudy'
        ? 1.12
        : params.weather === 'stormy'
          ? 1.05
          : 1.0;
  const sonarMult = 1 + (params.sonarLevel - 1) * 0.08;
  const schoolMult = 0.75 + Math.min(4, params.nearbyFishCount) * 0.18;
  // Base rate ~0.22/sec -> average wait ~3.5-6 seconds for lively gameplay
  return 0.22 * hook.biteBonus * (0.9 + bait.rarityBoost * 0.1) * timeMult * weatherMult * sonarMult * schoolMult;
}

export function rollFishSpecimen(params: {
  locationId: LocationId;
  waterDepthM: number;
  baitId: string;
  rng?: () => number;
}): { species: FishSpecies; weightKg: number; lengthCm: number } {
  const rand = params.rng ?? Math.random;
  const bait = getBaitById(params.baitId);
  const pool = getEligibleSpecies(params.locationId, params.waterDepthM);

  const weights = pool.map((sp) => {
    const prefersBait = sp.preferredBaits.includes(params.baitId) ? 2.6 : 0.75;
    const rarityBase =
      sp.rarity === 'Common'
        ? 4.0
        : sp.rarity === 'Uncommon'
          ? 2.6
          : sp.rarity === 'Rare'
            ? 1.45 * bait.rarityBoost
            : sp.rarity === 'Epic'
              ? 0.85 * bait.rarityBoost
              : 0.45 * bait.rarityBoost;
    return prefersBait * rarityBase;
  });

  const totalW = weights.reduce((a, b) => a + b, 0);
  let pick = rand() * totalW;
  let chosen = pool[0];
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      chosen = pool[i];
      break;
    }
  }

  // Skew distribution slightly toward realistic mid weights with rare trophy rolls
  const sizeRoll = Math.pow(rand(), 1.35);
  const weightKg = Number(
    (chosen.minWeightKg + (chosen.maxWeightKg - chosen.minWeightKg) * sizeRoll).toFixed(2),
  );
  const lengthCm = Math.round(
    chosen.minLengthCm + (chosen.maxLengthCm - chosen.minLengthCm) * (0.15 + sizeRoll * 0.85),
  );

  return { species: chosen, weightKg, lengthCm };
}

export function calculateFishValueAndXp(
  species: FishSpecies,
  weightKg: number,
): { value: number; xp: number } {
  const sizeRatio =
    (weightKg - species.minWeightKg) / Math.max(0.1, species.maxWeightKg - species.minWeightKg);
  const rarityMult =
    species.rarity === 'Common'
      ? 1.0
      : species.rarity === 'Uncommon'
        ? 1.25
        : species.rarity === 'Rare'
          ? 1.6
          : species.rarity === 'Epic'
            ? 2.1
            : 2.8;
  const value = Math.max(15, Math.round(weightKg * species.baseValue * (0.7 + sizeRatio * 0.55) * rarityMult));
  const xp = Math.max(15, Math.round(species.xpReward * (0.75 + sizeRatio * 0.75)));
  return { value, xp };
}

export function createCaughtFishRecord(
  species: FishSpecies,
  weightKg: number,
  lengthCm: number,
  locationId: LocationId,
  nowMs = Date.now(),
): CaughtFish {
  const { value, xp } = calculateFishValueAndXp(species, weightKg);
  return {
    uid: `fish_${nowMs}_${Math.floor(Math.random() * 100000)}`,
    speciesId: species.id,
    weightKg,
    lengthCm,
    value,
    xp,
    rarity: species.rarity,
    locationId,
    caughtAt: nowMs,
  };
}

export function createFightState(
  species: FishSpecies,
  weightKg: number,
  lengthCm: number,
  initialDistanceM: number,
): FightState {
  const clampedDist = Math.max(8, initialDistanceM);
  return {
    species,
    weightKg,
    lengthCm,
    distanceM: clampedDist,
    maxDistanceM: clampedDist + 24,
    tension: 0.28,
    fishStamina: 1.0,
    surgeTimer: 1.6 + Math.random() * 1.4,
    isSurging: false,
    slackTimer: 0,
    pullDirection: Math.random() < 0.5 ? -1 : 1,
    jumpCooldown: 2.5,
    isJumping: false,
    jumpProgress: 0,
  };
}

export interface FightStepResult {
  state: FightState;
  outcome: 'ongoing' | 'caught' | 'line_break' | 'escaped_slack' | 'escaped_far';
}

/**
 * Pure simulation step for the interactive tension & reel fight.
 * Reeling pulls the fish closer and increases line tension; letting off relieves tension
 * while surging fish pull line back out. Heavy tackle mitigates tension spikes.
 */
export function stepFishingFight(
  prev: FightState,
  input: { reeling: boolean; rodId: string; reelId: string; lineId: string },
  dt: number,
  rng: () => number = Math.random,
): FightStepResult {
  const rod = getRodById(input.rodId);
  const reel = getReelById(input.reelId);
  const line = getLineById(input.lineId);

  const s: FightState = { ...prev };

  // Fish surge AI toggle
  s.surgeTimer -= dt;
  if (s.surgeTimer <= 0) {
    s.isSurging = !s.isSurging;
    if (s.isSurging) {
      s.surgeTimer = 0.9 + rng() * (0.65 + s.species.difficulty * 0.14);
      s.pullDirection = rng() < 0.5 ? -1 : 1;
    } else {
      s.surgeTimer = 1.4 + rng() * 1.8;
    }
  }

  // Acrobatic jump animation for energetic fish
  if (s.isJumping) {
    s.jumpProgress += dt * 1.45;
    if (s.jumpProgress >= 1) {
      s.isJumping = false;
      s.jumpProgress = 0;
    }
  } else {
    s.jumpCooldown -= dt;
    if (s.jumpCooldown <= 0 && s.isSurging && s.species.difficulty >= 4) {
      s.isJumping = true;
      s.jumpProgress = 0;
      s.jumpCooldown = 4.2 + rng() * 3.5;
    }
  }

  // Weight-to-tackle ratio determines fight pressure
  const weightRatio = Math.min(2.4, s.weightKg / Math.max(8, line.maxTensionKg * 0.85));
  const fishPullPower =
    (1.2 + s.species.difficulty * 0.42 + weightRatio * 1.4) *
    (0.45 + 0.55 * s.fishStamina) *
    (s.isSurging ? 1.75 : 0.65);

  const playerPullPower = reel.reelSpeed * (0.85 + rod.tensionControl * 0.15);

  if (input.reeling) {
    s.slackTimer = Math.max(0, s.slackTimer - dt * 2);
    // Tension rises faster when fish is surging or heavier than line rating
    const tensionGain =
      (s.isSurging ? 0.52 : 0.14) *
      (0.75 + weightRatio * 0.55) /
      (rod.tensionControl * reel.dragStrength * 0.85);
    s.tension += tensionGain * dt;

    // Net distance pulled inward
    const netPull = Math.max(0.4, playerPullPower - fishPullPower * 0.68);
    s.distanceM -= netPull * dt;

    // Fighting tires the fish out
    s.fishStamina = Math.max(0.15, s.fishStamina - (0.095 + (s.isSurging ? 0.07 : 0.02)) * dt);
  } else {
    // Releasing reel drops tension smoothly; fish runs outward slightly
    const tensionDrop = 0.42 * reel.dragStrength;
    s.tension = Math.max(0.02, s.tension - tensionDrop * dt);
    const runOut = fishPullPower * (s.isSurging ? 0.72 : 0.22);
    s.distanceM += runOut * dt;

    // If line stays completely slack for too long, hook can slip
    if (s.tension < 0.08) {
      s.slackTimer += dt;
    } else {
      s.slackTimer = Math.max(0, s.slackTimer - dt);
    }
  }

  // Outcomes
  if (s.tension >= 1.0) {
    s.tension = 1.0;
    return { state: s, outcome: 'line_break' };
  }
  if (s.distanceM <= 1.2) {
    s.distanceM = 0;
    return { state: s, outcome: 'caught' };
  }
  if (s.slackTimer >= 4.5) {
    return { state: s, outcome: 'escaped_slack' };
  }
  if (s.distanceM >= Math.min(line.lengthM, s.maxDistanceM)) {
    return { state: s, outcome: 'escaped_far' };
  }

  return { state: s, outcome: 'ongoing' };
}
