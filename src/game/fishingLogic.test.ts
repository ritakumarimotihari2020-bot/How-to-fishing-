import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBiteRatePerSecond,
  calculateFishValueAndXp,
  createFightState,
  getLocationSpawnPoints,
  getTerrainHeight,
  getWalkableSurfaceY,
  getWaterDepth,
  getWaveAmplitude,
  getWaveHeight,
  isNavigableWaterForBoat,
  isOnPier,
  rollFishSpecimen,
  stepBoatKinematics,
  stepFishingFight,
} from './fishingLogic';
import { getSpeciesById } from './catalog';

test('spawn points place player on pier and boat in navigable water for all 4 locations', () => {
  const locations = ['emerald_cove', 'misty_lake', 'salmon_river', 'blue_abyss'] as const;
  for (const loc of locations) {
    const spawns = getLocationSpawnPoints(loc);
    assert.equal(isOnPier(loc, spawns.playerPos.x, spawns.playerPos.z), true, `${loc} player should spawn on pier`);
    assert.ok(
      getWalkableSurfaceY(loc, spawns.playerPos.x, spawns.playerPos.z) !== null,
      `${loc} player spawn must be walkable`,
    );
    assert.equal(
      isNavigableWaterForBoat(loc, spawns.boatPos.x, spawns.boatPos.z),
      true,
      `${loc} boat must spawn in navigable water`,
    );
  }
});

test('terrain transitions from shore land to deep water cleanly', () => {
  assert.ok(getTerrainHeight('emerald_cove', 0, 50) > 1, 'south beach should be above water');
  assert.ok(getWaterDepth('emerald_cove', 0, -40) > 5, 'north bay should be deep water');
});

test('wave amplitude scales with weather and produces smooth bounded waves', () => {
  const sunny = getWaveAmplitude(0.25, 'sunny');
  const stormy = getWaveAmplitude(0.25, 'stormy');
  assert.ok(stormy > sunny * 2);
  const h = getWaveHeight(12, -18, 3.5, stormy);
  assert.ok(Math.abs(h) <= stormy + 0.01);
});

test('boat kinematics accelerates forward, steers, and stays in navigable water', () => {
  const spawn = getLocationSpawnPoints('emerald_cove').boatPos;
  let state = { x: spawn.x, z: spawn.z, yaw: spawn.yaw, speed: 0, roll: 0, pitch: 0 };
  const upgrades = { engineLevel: 2, hullLevel: 1, sonarLevel: 1, hullColor: '#ffffff' };

  for (let i = 0; i < 40; i++) {
    state = stepBoatKinematics(state, { throttle: 1, steer: 0.2 }, 'small_skiff', upgrades, 'emerald_cove', 0.05);
  }
  assert.ok(state.speed > 5, 'boat should accelerate forward');
  assert.ok(state.z < spawn.z, 'boat facing north (-Z) should move north');
  assert.equal(isNavigableWaterForBoat('emerald_cove', state.x, state.z), true);
});

test('fish specimen rolling respects species weight/length ranges and calculates positive value', () => {
  const specimen = rollFishSpecimen({
    locationId: 'blue_abyss',
    waterDepthM: 20,
    baitId: 'chum',
    rng: () => 0.72,
  });
  assert.ok(specimen.weightKg >= specimen.species.minWeightKg);
  assert.ok(specimen.weightKg <= specimen.species.maxWeightKg);
  assert.ok(specimen.lengthCm >= specimen.species.minLengthCm);
  assert.ok(specimen.lengthCm <= specimen.species.maxLengthCm);

  const { value, xp } = calculateFishValueAndXp(specimen.species, specimen.weightKg);
  assert.ok(value > 0 && xp > 0);
});

test('bite probability responds to hooks, weather, and nearby schools', () => {
  const base = calculateBiteRatePerSecond({
    baitId: 'worm',
    hookId: 'hook_standard',
    weather: 'sunny',
    timeOfDay: 13,
    sonarLevel: 1,
    nearbyFishCount: 1,
  });
  const boosted = calculateBiteRatePerSecond({
    baitId: 'chum',
    hookId: 'hook_apex',
    weather: 'rainy',
    timeOfDay: 6.5,
    sonarLevel: 4,
    nearbyFishCount: 4,
  });
  assert.ok(boosted > base * 2, 'upgraded gear, rain, dawn, and schools should boost bite rate');
});

test('fishing fight catches fish when reeling smartly and breaks line if over-tensioned', () => {
  const bass = getSpeciesById('largemouth_bass');
  let fight = createFightState(bass, 2.4, 42, 12);
  let caught = false;

  // Smart reeling: release briefly when tension > 0.78
  for (let i = 0; i < 400; i++) {
    const res = stepFishingFight(
      fight,
      {
        reeling: fight.tension < 0.78,
        rodId: 'fiberglass_classic',
        reelId: 'reel_basic',
        lineId: 'line_mono',
      },
      0.05,
      () => 0.5,
    );
    fight = res.state;
    if (res.outcome === 'caught') {
      caught = true;
      break;
    }
    assert.notEqual(res.outcome, 'line_break', 'controlled reeling on bass should not snap line');
  }
  assert.equal(caught, true, 'smart reeling should land the bass');

  // Reckless constant reeling on a Great White Shark with starter line snaps the line
  const shark = getSpeciesById('great_white_shark');
  let sharkFight = createFightState(shark, 320, 400, 28);
  sharkFight.isSurging = true;
  sharkFight.surgeTimer = 10;
  let broke = false;
  for (let i = 0; i < 200; i++) {
    const res = stepFishingFight(
      sharkFight,
      {
        reeling: true,
        rodId: 'fiberglass_classic',
        reelId: 'reel_basic',
        lineId: 'line_mono',
      },
      0.05,
      () => 0.5,
    );
    sharkFight = res.state;
    if (res.outcome === 'line_break') {
      broke = true;
      break;
    }
  }
  assert.equal(broke, true, 'starter mono line should snap under nonstop shark surge');
});
