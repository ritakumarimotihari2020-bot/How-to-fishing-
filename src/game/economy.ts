import {
  ACHIEVEMENTS,
  BAITS,
  BOATS,
  DAILY_REWARDS,
  HOOKS,
  LINES,
  MISSIONS,
  REELS,
  RODS,
  getBaitById,
  getBoatById,
  getHookById,
  getLineById,
  getReelById,
  getRodById,
} from './catalog';
import {
  BoatId,
  CaughtFish,
  GameSettings,
  LocationId,
  MissionDef,
  PlayerSave,
  WeatherType,
} from './types';

export const SAVE_STORAGE_KEY = 'ultimate_fishing_sim_3d_save_v1';

export function xpForLevel(level: number): number {
  return Math.round(120 * Math.pow(level, 1.42));
}

export function createInitialSave(): PlayerSave {
  return {
    version: 1,
    money: 250,
    level: 1,
    xp: 0,
    locationId: 'emerald_cove',
    weather: 'sunny',
    timeOfDay: 10.2,
    equippedRodId: RODS[0].id,
    equippedReelId: REELS[0].id,
    equippedLineId: LINES[0].id,
    equippedHookId: HOOKS[0].id,
    equippedBaitId: BAITS[0].id,
    equippedBoatId: 'small_skiff',
    ownedRodIds: [RODS[0].id],
    ownedReelIds: [REELS[0].id],
    ownedLineIds: [LINES[0].id],
    ownedHookIds: [HOOKS[0].id],
    ownedBoatIds: ['small_skiff'],
    baitCounts: {
      worm: 20,
      shrimp: 6,
      minnow: 4,
      crankbait: 2,
      deep_jig: 0,
      chum: 0,
    },
    boatUpgrades: {
      small_skiff: { engineLevel: 1, hullLevel: 1, sonarLevel: 1, hullColor: '#edf2f7' },
      speed_boat: { engineLevel: 1, hullLevel: 1, sonarLevel: 1, hullColor: '#1a4971' },
      luxury_yacht: { engineLevel: 1, hullLevel: 1, sonarLevel: 1, hullColor: '#edf2f7' },
    },
    fishBag: [],
    aquarium: [],
    claimedMissions: [],
    unlockedAchievements: [],
    dailyStreak: 0,
    lastDailyClaimDate: null,
    stats: {
      totalCaught: 0,
      totalEarned: 0,
      heaviestCatchKg: 0,
      heaviestSpeciesId: null,
      speciesCaughtCounts: {},
      speciesBestWeight: {},
      locationCatches: {
        emerald_cove: 0,
        misty_lake: 0,
        salmon_river: 0,
        blue_abyss: 0,
      },
    },
    settings: {
      masterVolume: 0.65,
      muted: false,
      graphicsQuality: 'high',
      cameraSensitivity: 1.0,
      touchControlsMode: 'auto',
      timeCycleSpeed: 1,
    },
  };
}

export function loadSaveFromStorage(storage?: Pick<Storage, 'getItem'>): PlayerSave {
  const fallback = createInitialSave();
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return fallback;
    const raw = store.getItem(SAVE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerSave>;
    return {
      ...fallback,
      ...parsed,
      baitCounts: { ...fallback.baitCounts, ...(parsed.baitCounts ?? {}) },
      boatUpgrades: {
        small_skiff: { ...fallback.boatUpgrades.small_skiff, ...(parsed.boatUpgrades?.small_skiff ?? {}) },
        speed_boat: { ...fallback.boatUpgrades.speed_boat, ...(parsed.boatUpgrades?.speed_boat ?? {}) },
        luxury_yacht: { ...fallback.boatUpgrades.luxury_yacht, ...(parsed.boatUpgrades?.luxury_yacht ?? {}) },
      },
      stats: {
        ...fallback.stats,
        ...(parsed.stats ?? {}),
        speciesCaughtCounts: { ...(parsed.stats?.speciesCaughtCounts ?? {}) },
        speciesBestWeight: { ...(parsed.stats?.speciesBestWeight ?? {}) },
        locationCatches: {
          ...fallback.stats.locationCatches,
          ...(parsed.stats?.locationCatches ?? {}),
        },
      },
      settings: { ...fallback.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function persistSaveToStorage(save: PlayerSave, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    store.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function addXp(save: PlayerSave, xpGain: number): { save: PlayerSave; leveledUp: boolean } {
  let level = save.level;
  let xp = save.xp + Math.max(0, Math.round(xpGain));
  let leveledUp = false;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    leveledUp = true;
  }
  return {
    save: { ...save, level, xp },
    leveledUp,
  };
}

export function evaluateAchievements(save: PlayerSave): {
  save: PlayerSave;
  newlyUnlocked: string[];
} {
  const newlyUnlocked: string[] = [];
  let bonusMoney = 0;

  for (const ach of ACHIEVEMENTS) {
    if (!save.unlockedAchievements.includes(ach.id) && ach.check(save.stats, save)) {
      newlyUnlocked.push(ach.id);
      bonusMoney += ach.rewardMoney;
    }
  }

  if (newlyUnlocked.length === 0) {
    return { save, newlyUnlocked };
  }

  return {
    save: {
      ...save,
      money: save.money + bonusMoney,
      unlockedAchievements: [...save.unlockedAchievements, ...newlyUnlocked],
      stats: {
        ...save.stats,
        totalEarned: save.stats.totalEarned + bonusMoney,
      },
    },
    newlyUnlocked,
  };
}

export function recordFishCatch(
  save: PlayerSave,
  fish: CaughtFish,
  destination: 'bag' | 'aquarium' | 'release',
): { save: PlayerSave; leveledUp: boolean; newlyUnlocked: string[]; isNewRecord: boolean } {
  const prevBest = save.stats.speciesBestWeight[fish.speciesId] ?? 0;
  const isNewRecord = fish.weightKg > prevBest;
  const fishWithRecord: CaughtFish = { ...fish, isRecord: isNewRecord };

  const xpGain = destination === 'release' ? Math.round(fish.xp * 1.4) : fish.xp;
  const nextBag = destination === 'bag' ? [fishWithRecord, ...save.fishBag] : save.fishBag;
  const nextAquarium =
    destination === 'aquarium'
      ? [fishWithRecord, ...save.aquarium].slice(0, 16)
      : save.aquarium;

  const isHeaviest = fish.weightKg > save.stats.heaviestCatchKg;

  const updated: PlayerSave = {
    ...save,
    fishBag: nextBag,
    aquarium: nextAquarium,
    stats: {
      ...save.stats,
      totalCaught: save.stats.totalCaught + 1,
      heaviestCatchKg: isHeaviest ? fish.weightKg : save.stats.heaviestCatchKg,
      heaviestSpeciesId: isHeaviest ? fish.speciesId : save.stats.heaviestSpeciesId,
      speciesCaughtCounts: {
        ...save.stats.speciesCaughtCounts,
        [fish.speciesId]: (save.stats.speciesCaughtCounts[fish.speciesId] ?? 0) + 1,
      },
      speciesBestWeight: {
        ...save.stats.speciesBestWeight,
        [fish.speciesId]: Math.max(prevBest, fish.weightKg),
      },
      locationCatches: {
        ...save.stats.locationCatches,
        [fish.locationId]: (save.stats.locationCatches[fish.locationId] ?? 0) + 1,
      },
    },
  };

  const xpRes = addXp(updated, xpGain);
  const achRes = evaluateAchievements(xpRes.save);

  return {
    save: achRes.save,
    leveledUp: xpRes.leveledUp,
    newlyUnlocked: achRes.newlyUnlocked,
    isNewRecord,
  };
}

export function consumeEquippedBait(save: PlayerSave): PlayerSave {
  const id = save.equippedBaitId;
  const current = save.baitCounts[id] ?? 0;
  if (id === 'worm' && current <= 1) {
    // Never soft-lock the player without starter worms
    return {
      ...save,
      baitCounts: { ...save.baitCounts, worm: 5 },
    };
  }
  const nextCount = Math.max(0, current - 1);
  const nextCounts = { ...save.baitCounts, [id]: nextCount };
  let nextEquipped = id;
  if (nextCount === 0) {
    // Fallback to any bait with stock, or worms
    const available = BAITS.find((b) => (nextCounts[b.id] ?? 0) > 0);
    if (available) {
      nextEquipped = available.id;
    } else {
      nextCounts.worm = 5;
      nextEquipped = 'worm';
    }
  }
  return {
    ...save,
    equippedBaitId: nextEquipped,
    baitCounts: nextCounts,
  };
}

export function sellFishFromBag(save: PlayerSave, fishUid: string): { save: PlayerSave; earned: number } {
  const target = save.fishBag.find((f) => f.uid === fishUid);
  if (!target) return { save, earned: 0 };
  const nextSave: PlayerSave = {
    ...save,
    money: save.money + target.value,
    fishBag: save.fishBag.filter((f) => f.uid !== fishUid),
    stats: {
      ...save.stats,
      totalEarned: save.stats.totalEarned + target.value,
    },
  };
  return { save: nextSave, earned: target.value };
}

export function sellAllFishInBag(save: PlayerSave): { save: PlayerSave; earned: number; count: number } {
  if (save.fishBag.length === 0) return { save, earned: 0, count: 0 };
  const earned = save.fishBag.reduce((sum, f) => sum + f.value, 0);
  const count = save.fishBag.length;
  const nextSave: PlayerSave = {
    ...save,
    money: save.money + earned,
    fishBag: [],
    stats: {
      ...save.stats,
      totalEarned: save.stats.totalEarned + earned,
    },
  };
  return { save: nextSave, earned, count };
}

export function moveFishFromBagToAquarium(save: PlayerSave, fishUid: string): PlayerSave {
  const target = save.fishBag.find((f) => f.uid === fishUid);
  if (!target || save.aquarium.length >= 16) return save;
  const next: PlayerSave = {
    ...save,
    fishBag: save.fishBag.filter((f) => f.uid !== fishUid),
    aquarium: [target, ...save.aquarium],
  };
  return evaluateAchievements(next).save;
}

export function sellFishFromAquarium(save: PlayerSave, fishUid: string): { save: PlayerSave; earned: number } {
  const target = save.aquarium.find((f) => f.uid === fishUid);
  if (!target) return { save, earned: 0 };
  return {
    save: {
      ...save,
      money: save.money + target.value,
      aquarium: save.aquarium.filter((f) => f.uid !== fishUid),
      stats: {
        ...save.stats,
        totalEarned: save.stats.totalEarned + target.value,
      },
    },
    earned: target.value,
  };
}

export type GearCategory = 'rod' | 'reel' | 'line' | 'hook';

export function buyOrEquipGear(
  save: PlayerSave,
  category: GearCategory,
  itemId: string,
): { save: PlayerSave; ok: boolean; reason?: string } {
  const item =
    category === 'rod'
      ? getRodById(itemId)
      : category === 'reel'
        ? getReelById(itemId)
        : category === 'line'
          ? getLineById(itemId)
          : getHookById(itemId);

  const ownedList =
    category === 'rod'
      ? save.ownedRodIds
      : category === 'reel'
        ? save.ownedReelIds
        : category === 'line'
          ? save.ownedLineIds
          : save.ownedHookIds;

  const isOwned = ownedList.includes(itemId);
  if (isOwned) {
    return {
      ok: true,
      save: {
        ...save,
        ...(category === 'rod' ? { equippedRodId: itemId } : {}),
        ...(category === 'reel' ? { equippedReelId: itemId } : {}),
        ...(category === 'line' ? { equippedLineId: itemId } : {}),
        ...(category === 'hook' ? { equippedHookId: itemId } : {}),
      },
    };
  }

  if (save.level < item.unlockLevel) {
    return { save, ok: false, reason: `Requires Level ${item.unlockLevel}` };
  }
  if (save.money < item.price) {
    return { save, ok: false, reason: 'Not enough funds' };
  }

  return {
    ok: true,
    save: {
      ...save,
      money: save.money - item.price,
      ...(category === 'rod'
        ? { ownedRodIds: [...save.ownedRodIds, itemId], equippedRodId: itemId }
        : {}),
      ...(category === 'reel'
        ? { ownedReelIds: [...save.ownedReelIds, itemId], equippedReelId: itemId }
        : {}),
      ...(category === 'line'
        ? { ownedLineIds: [...save.ownedLineIds, itemId], equippedLineId: itemId }
        : {}),
      ...(category === 'hook'
        ? { ownedHookIds: [...save.ownedHookIds, itemId], equippedHookId: itemId }
        : {}),
    },
  };
}

export function buyBaitPack(
  save: PlayerSave,
  baitId: string,
): { save: PlayerSave; ok: boolean; reason?: string } {
  const bait = getBaitById(baitId);
  if (save.money < bait.price) {
    return { save, ok: false, reason: 'Not enough funds' };
  }
  return {
    ok: true,
    save: {
      ...save,
      money: save.money - bait.price,
      equippedBaitId: baitId,
      baitCounts: {
        ...save.baitCounts,
        [baitId]: (save.baitCounts[baitId] ?? 0) + bait.packSize,
      },
    },
  };
}

export function buyOrEquipBoat(
  save: PlayerSave,
  boatId: BoatId,
): { save: PlayerSave; ok: boolean; reason?: string } {
  const boat = getBoatById(boatId);
  if (save.ownedBoatIds.includes(boatId)) {
    return { ok: true, save: { ...save, equippedBoatId: boatId } };
  }
  if (save.level < boat.unlockLevel) {
    return { save, ok: false, reason: `Requires Level ${boat.unlockLevel}` };
  }
  if (save.money < boat.price) {
    return { save, ok: false, reason: 'Not enough funds' };
  }
  const next: PlayerSave = {
    ...save,
    money: save.money - boat.price,
    ownedBoatIds: [...save.ownedBoatIds, boatId],
    equippedBoatId: boatId,
  };
  return { ok: true, save: evaluateAchievements(next).save };
}

export function getBoatUpgradeCost(currentLevel: number): number {
  return currentLevel * 280;
}

export function upgradeBoatStat(
  save: PlayerSave,
  boatId: BoatId,
  stat: 'engineLevel' | 'hullLevel' | 'sonarLevel',
): { save: PlayerSave; ok: boolean; reason?: string } {
  const current = save.boatUpgrades[boatId][stat];
  if (current >= 4) return { save, ok: false, reason: 'Max level reached' };
  const cost = getBoatUpgradeCost(current);
  if (save.money < cost) return { save, ok: false, reason: 'Not enough funds' };
  return {
    ok: true,
    save: {
      ...save,
      money: save.money - cost,
      boatUpgrades: {
        ...save.boatUpgrades,
        [boatId]: {
          ...save.boatUpgrades[boatId],
          [stat]: current + 1,
        },
      },
    },
  };
}

export function setBoatHullColor(save: PlayerSave, boatId: BoatId, hex: string): PlayerSave {
  return {
    ...save,
    boatUpgrades: {
      ...save.boatUpgrades,
      [boatId]: {
        ...save.boatUpgrades[boatId],
        hullColor: hex,
      },
    },
  };
}

export function getMissionProgress(save: PlayerSave, mission: MissionDef): number {
  switch (mission.targetType) {
    case 'catch_count':
      return save.stats.totalCaught;
    case 'catch_weight':
      return Math.floor(save.stats.heaviestCatchKg);
    case 'catch_species':
      return mission.targetSpeciesId ? save.stats.speciesCaughtCounts[mission.targetSpeciesId] ?? 0 : 0;
    case 'earn_money':
      return save.stats.totalEarned;
    case 'location_catch':
      return mission.targetLocationId ? save.stats.locationCatches[mission.targetLocationId] ?? 0 : 0;
  }
}

export function claimMissionReward(
  save: PlayerSave,
  missionId: string,
): { save: PlayerSave; ok: boolean } {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission || save.claimedMissions.includes(missionId)) {
    return { save, ok: false };
  }
  const progress = getMissionProgress(save, mission);
  if (progress < mission.targetValue) {
    return { save, ok: false };
  }
  const withMoney: PlayerSave = {
    ...save,
    money: save.money + mission.rewardMoney,
    claimedMissions: [...save.claimedMissions, missionId],
    stats: {
      ...save.stats,
      totalEarned: save.stats.totalEarned + mission.rewardMoney,
    },
  };
  return { save: addXp(withMoney, mission.rewardXp).save, ok: true };
}

export function getTodayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function canClaimDailyReward(save: PlayerSave, todayIso = getTodayIsoDate()): boolean {
  return save.lastDailyClaimDate !== todayIso;
}

export function claimDailyReward(
  save: PlayerSave,
  todayIso = getTodayIsoDate(),
): { save: PlayerSave; ok: boolean; rewardLabel?: string } {
  if (!canClaimDailyReward(save, todayIso)) {
    return { save, ok: false };
  }
  const nextDayIndex = save.dailyStreak % DAILY_REWARDS.length;
  const reward = DAILY_REWARDS[nextDayIndex];
  const nextSave: PlayerSave = {
    ...save,
    money: save.money + reward.money,
    dailyStreak: save.dailyStreak + 1,
    lastDailyClaimDate: todayIso,
    baitCounts: {
      ...save.baitCounts,
      [reward.baitId]: (save.baitCounts[reward.baitId] ?? 0) + reward.baitCount,
    },
    stats: {
      ...save.stats,
      totalEarned: save.stats.totalEarned + reward.money,
    },
  };
  return { save: nextSave, ok: true, rewardLabel: reward.label };
}

export function updateSettings(save: PlayerSave, patch: Partial<GameSettings>): PlayerSave {
  return {
    ...save,
    settings: { ...save.settings, ...patch },
  };
}

export function updateWorldEnvironment(
  save: PlayerSave,
  patch: { locationId?: LocationId; weather?: WeatherType; timeOfDay?: number },
): PlayerSave {
  return {
    ...save,
    ...patch,
  };
}

export function isBoatOwned(save: PlayerSave, boatId: BoatId): boolean {
  return save.ownedBoatIds.includes(boatId);
}

export function getAllBoatsCatalog() {
  return BOATS;
}
