import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyBaitPack,
  buyOrEquipBoat,
  buyOrEquipGear,
  canClaimDailyReward,
  claimDailyReward,
  claimMissionReward,
  consumeEquippedBait,
  createInitialSave,
  loadSaveFromStorage,
  moveFishFromBagToAquarium,
  persistSaveToStorage,
  recordFishCatch,
  sellAllFishInBag,
  sellFishFromBag,
  setBoatHullColor,
  upgradeBoatStat,
} from './economy';
import { createCaughtFishRecord } from './fishingLogic';
import { getSpeciesById } from './catalog';

test('catching, keeping, aquarium transfer, and selling fish updates money, XP, and achievements', () => {
  let save = createInitialSave();
  const initialMoney = save.money;

  const bass = createCaughtFishRecord(getSpeciesById('largemouth_bass'), 4.2, 52, 'emerald_cove', 1000);
  const res1 = recordFishCatch(save, bass, 'bag');
  save = res1.save;

  assert.equal(save.fishBag.length, 1);
  assert.equal(save.stats.totalCaught, 1);
  assert.equal(res1.isNewRecord, true);
  assert.ok(res1.newlyUnlocked.includes('ach_novice'), 'first catch unlocks Rookie Angler');

  const moneyAfterAch = save.money;
  assert.ok(moneyAfterAch > initialMoney, 'achievement reward adds funds');

  const sale = sellFishFromBag(save, bass.uid);
  save = sale.save;
  assert.equal(save.fishBag.length, 0);
  assert.equal(sale.earned, bass.value);
  assert.equal(save.money, moneyAfterAch + bass.value);

  // Catch another and transfer from bag to aquarium
  const snapper = createCaughtFishRecord(getSpeciesById('red_snapper'), 6.0, 62, 'emerald_cove', 2000);
  save = recordFishCatch(save, snapper, 'bag').save;
  save = moveFishFromBagToAquarium(save, snapper.uid);
  assert.equal(save.fishBag.length, 0);
  assert.equal(save.aquarium.length, 1);

  // Catch 2 more and sell all
  const carp = createCaughtFishRecord(getSpeciesById('common_carp'), 5.5, 58, 'misty_lake', 3000);
  save = recordFishCatch(save, carp, 'bag').save;
  const bulk = sellAllFishInBag(save);
  assert.equal(bulk.count, 1);
  assert.equal(bulk.earned, carp.value);
  assert.equal(bulk.save.fishBag.length, 0);
});

test('shop purchases enforce unlock levels and funds, and allow boat upgrades & colors', () => {
  let save = createInitialSave();
  // Level 1 cannot buy Level 2 rod
  const failLevel = buyOrEquipGear(save, 'rod', 'carbon_pro');
  assert.equal(failLevel.ok, false);

  save = { ...save, level: 5, money: 5000 };
  const buyRod = buyOrEquipGear(save, 'rod', 'carbon_pro');
  assert.equal(buyRod.ok, true);
  save = buyRod.save;
  assert.equal(save.equippedRodId, 'carbon_pro');
  assert.ok(save.ownedRodIds.includes('carbon_pro'));

  const buyBait = buyBaitPack(save, 'deep_jig');
  assert.equal(buyBait.ok, true);
  save = buyBait.save;
  assert.equal(save.baitCounts['deep_jig'], 8);

  const buyBoat = buyOrEquipBoat(save, 'speed_boat');
  assert.equal(buyBoat.ok, true);
  save = buyBoat.save;
  assert.equal(save.equippedBoatId, 'speed_boat');

  const upg = upgradeBoatStat(save, 'speed_boat', 'engineLevel');
  assert.equal(upg.ok, true);
  save = upg.save;
  assert.equal(save.boatUpgrades.speed_boat.engineLevel, 2);

  save = setBoatHullColor(save, 'speed_boat', '#b83c35');
  assert.equal(save.boatUpgrades.speed_boat.hullColor, '#b83c35');
});

test('missions, daily rewards, bait consumption, and localStorage persistence work reliably', () => {
  let save = createInitialSave();

  // Claim daily reward once per day
  assert.equal(canClaimDailyReward(save, '2026-11-19'), true);
  const daily = claimDailyReward(save, '2026-11-19');
  assert.equal(daily.ok, true);
  save = daily.save;
  assert.equal(save.dailyStreak, 1);
  assert.equal(canClaimDailyReward(save, '2026-11-19'), false);

  // Catch 2 fish to complete m_first_catch mission
  const f1 = createCaughtFishRecord(getSpeciesById('largemouth_bass'), 2.1, 40, 'emerald_cove', 100);
  const f2 = createCaughtFishRecord(getSpeciesById('largemouth_bass'), 3.1, 46, 'emerald_cove', 200);
  save = recordFishCatch(save, f1, 'bag').save;
  save = recordFishCatch(save, f2, 'bag').save;

  const claim = claimMissionReward(save, 'm_first_catch');
  assert.equal(claim.ok, true);
  save = claim.save;
  assert.ok(save.claimedMissions.includes('m_first_catch'));

  // Bait never soft-locks
  save = { ...save, equippedBaitId: 'worm', baitCounts: { ...save.baitCounts, worm: 1 } };
  save = consumeEquippedBait(save);
  assert.ok(save.baitCounts.worm >= 1);

  // Mock localStorage round-trip
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  persistSaveToStorage(save, mockStorage);
  const restored = loadSaveFromStorage(mockStorage);
  assert.equal(restored.money, save.money);
  assert.equal(restored.dailyStreak, 1);
  assert.equal(restored.stats.totalCaught, 2);
});
