import React, { useState } from 'react';
import { X, DollarSign, Anchor, Wrench } from 'lucide-react';
import {
  BAITS,
  BOATS,
  BOAT_HULL_COLORS,
  HOOKS,
  LINES,
  REELS,
  RODS,
  getSpeciesById,
} from '../game/catalog';
import { GearCategory, getBoatUpgradeCost } from '../game/economy';
import { BoatId, PlayerSave } from '../game/types';
import { FishIllustration } from './FishIllustration';

interface ShopModalProps {
  save: PlayerSave;
  onClose: () => void;
  onSellFish: (uid: string) => void;
  onSellAllFish: () => void;
  onBuyOrEquipGear: (category: GearCategory, id: string) => void;
  onBuyBait: (baitId: string) => void;
  onBuyOrEquipBoat: (boatId: BoatId) => void;
  onUpgradeBoat: (boatId: BoatId, stat: 'engineLevel' | 'hullLevel' | 'sonarLevel') => void;
  onSetBoatColor: (boatId: BoatId, hex: string) => void;
}

type ShopTab = 'market' | 'rods' | 'reels' | 'lines' | 'hooks' | 'baits' | 'boats';

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onClose,
  onSellFish,
  onSellAllFish,
  onBuyOrEquipGear,
  onBuyBait,
  onBuyOrEquipBoat,
  onUpgradeBoat,
  onSetBoatColor,
}) => {
  const [tab, setTab] = useState<ShopTab>('market');
  const bagTotalValue = save.fishBag.reduce((s, f) => s + f.value, 0);

  const tabs: Array<{ id: ShopTab; label: string }> = [
    { id: 'market', label: `Market (${save.fishBag.length})` },
    { id: 'rods', label: 'Rods' },
    { id: 'reels', label: 'Reels' },
    { id: 'lines', label: 'Lines' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'baits', label: 'Baits' },
    { id: 'boats', label: 'Boats & Yard' },
  ];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Fishing Market and Tackle Shop"
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Harbor Market &amp; Tackle Shop</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Balance: <span className="font-mono-num font-bold text-amber-400">${save.money.toLocaleString()}</span> · Angler Lv.{' '}
              <span className="font-mono-num text-sky-200">{save.level}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Shop"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-sky-300/10 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#0e2336] text-slate-300 hover:text-white hover:bg-[#16344f]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto marine-scroll flex-1">
          {tab === 'market' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-sky-300/10">
                <div className="text-sm text-slate-300">
                  Sell fresh catches from your cooler for cash to upgrade rods, reels, and boats.
                </div>
                <button
                  type="button"
                  disabled={save.fishBag.length === 0}
                  onClick={onSellAllFish}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer whitespace-nowrap"
                >
                  <DollarSign className="w-4 h-4" />
                  Sell All (${bagTotalValue.toLocaleString()})
                </button>
              </div>

              {save.fishBag.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Your fish cooler is currently empty. Cast your line and catch fish to sell here!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {save.fishBag.map((fish) => {
                    const sp = getSpeciesById(fish.speciesId);
                    return (
                      <div
                        key={fish.uid}
                        className="flex items-center justify-between gap-3 rounded-lg p-3 border border-sky-300/15 bg-[#0c2236]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FishIllustration species={sp} className="w-16 h-10 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-white truncate">{sp.name}</div>
                            <div className="text-xs text-slate-400 font-mono-num">
                              {fish.weightKg.toFixed(2)} kg · {fish.lengthCm} cm · {fish.rarity}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSellFish(fish.uid)}
                          className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-num font-bold text-xs cursor-pointer shrink-0"
                        >
                          Sell ${fish.value}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'rods' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RODS.map((rod) => {
                const owned = save.ownedRodIds.includes(rod.id);
                const equipped = save.equippedRodId === rod.id;
                const locked = !owned && save.level < rod.unlockLevel;
                const canAfford = save.money >= rod.price;
                return (
                  <div
                    key={rod.id}
                    className={`rounded-lg p-4 border ${
                      equipped ? 'border-amber-400/70 bg-[#102b42]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display font-bold text-base text-white">{rod.name}</h3>
                      <span className="font-mono-num text-xs text-amber-300">
                        {owned ? (equipped ? 'Equipped' : 'Owned') : `$${rod.price}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{rod.description}</p>
                    <div className="text-xs text-sky-200 font-mono-num mb-3">
                      Cast {rod.castRangeM}m · Control {Math.round(rod.tensionControl * 100)}% · Max {rod.maxFishKg}kg
                    </div>
                    <button
                      type="button"
                      disabled={equipped || locked || (!owned && !canAfford)}
                      onClick={() => onBuyOrEquipGear('rod', rod.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        equipped
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : owned
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : locked
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {equipped
                        ? 'Equipped'
                        : owned
                          ? 'Equip Rod'
                          : locked
                            ? `Unlocks at Level ${rod.unlockLevel}`
                            : `Buy for $${rod.price}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'reels' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REELS.map((reel) => {
                const owned = save.ownedReelIds.includes(reel.id);
                const equipped = save.equippedReelId === reel.id;
                const locked = !owned && save.level < reel.unlockLevel;
                const canAfford = save.money >= reel.price;
                return (
                  <div
                    key={reel.id}
                    className={`rounded-lg p-4 border ${
                      equipped ? 'border-amber-400/70 bg-[#102b42]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display font-bold text-base text-white">{reel.name}</h3>
                      <span className="font-mono-num text-xs text-amber-300">
                        {owned ? (equipped ? 'Equipped' : 'Owned') : `$${reel.price}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{reel.description}</p>
                    <div className="text-xs text-sky-200 font-mono-num mb-3">
                      Retrieve {reel.reelSpeed} m/s · Drag {Math.round(reel.dragStrength * 100)}%
                    </div>
                    <button
                      type="button"
                      disabled={equipped || locked || (!owned && !canAfford)}
                      onClick={() => onBuyOrEquipGear('reel', reel.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        equipped
                          ? 'bg-slate-800 text-slate-400'
                          : owned
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : locked || !canAfford
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {equipped
                        ? 'Equipped'
                        : owned
                          ? 'Equip Reel'
                          : locked
                            ? `Unlocks at Level ${reel.unlockLevel}`
                            : `Buy for $${reel.price}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'lines' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LINES.map((line) => {
                const owned = save.ownedLineIds.includes(line.id);
                const equipped = save.equippedLineId === line.id;
                const locked = !owned && save.level < line.unlockLevel;
                const canAfford = save.money >= line.price;
                return (
                  <div
                    key={line.id}
                    className={`rounded-lg p-4 border ${
                      equipped ? 'border-amber-400/70 bg-[#102b42]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display font-bold text-base text-white">{line.name}</h3>
                      <span className="font-mono-num text-xs text-amber-300">
                        {owned ? (equipped ? 'Equipped' : 'Owned') : `$${line.price}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{line.description}</p>
                    <div className="text-xs text-sky-200 font-mono-num mb-3">
                      Strength {line.maxTensionKg}kg · Spool {line.lengthM}m
                    </div>
                    <button
                      type="button"
                      disabled={equipped || locked || (!owned && !canAfford)}
                      onClick={() => onBuyOrEquipGear('line', line.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        equipped
                          ? 'bg-slate-800 text-slate-400'
                          : owned
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : locked || !canAfford
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {equipped
                        ? 'Equipped'
                        : owned
                          ? 'Equip Line'
                          : locked
                            ? `Unlocks at Level ${line.unlockLevel}`
                            : `Buy for $${line.price}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'hooks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HOOKS.map((hook) => {
                const owned = save.ownedHookIds.includes(hook.id);
                const equipped = save.equippedHookId === hook.id;
                const locked = !owned && save.level < hook.unlockLevel;
                const canAfford = save.money >= hook.price;
                return (
                  <div
                    key={hook.id}
                    className={`rounded-lg p-4 border ${
                      equipped ? 'border-amber-400/70 bg-[#102b42]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display font-bold text-base text-white">{hook.name}</h3>
                      <span className="font-mono-num text-xs text-amber-300">
                        {owned ? (equipped ? 'Equipped' : 'Owned') : `$${hook.price}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{hook.description}</p>
                    <div className="text-xs text-sky-200 font-mono-num mb-3">
                      Bite Rate +{Math.round((hook.biteBonus - 1) * 100)}% · Window {hook.hookSetWindowSec}s
                    </div>
                    <button
                      type="button"
                      disabled={equipped || locked || (!owned && !canAfford)}
                      onClick={() => onBuyOrEquipGear('hook', hook.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        equipped
                          ? 'bg-slate-800 text-slate-400'
                          : owned
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : locked || !canAfford
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {equipped
                        ? 'Equipped'
                        : owned
                          ? 'Equip Hook'
                          : locked
                            ? `Unlocks at Level ${hook.unlockLevel}`
                            : `Buy for $${hook.price}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'baits' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BAITS.map((bait) => {
                const count = save.baitCounts[bait.id] ?? 0;
                const canAfford = save.money >= bait.price;
                return (
                  <div key={bait.id} className="rounded-lg p-4 border border-sky-300/15 bg-[#0c2134]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm inline-block shrink-0"
                          style={{ backgroundColor: bait.color }}
                        />
                        <h3 className="font-display font-bold text-base text-white">{bait.name}</h3>
                      </div>
                      <span className="font-mono-num text-xs text-teal-300">Owned: {count}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{bait.description}</p>
                    <div className="text-xs text-sky-200 font-mono-num mb-3">
                      Attract Radius {bait.attractRadiusM}m · Rarity x{bait.rarityBoost}
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyBait(bait.id)}
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Buy {bait.packSize} Pack — ${bait.price}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'boats' && (
            <div className="space-y-4">
              {BOATS.map((boat) => {
                const owned = save.ownedBoatIds.includes(boat.id);
                const equipped = save.equippedBoatId === boat.id;
                const locked = !owned && save.level < boat.unlockLevel;
                const canAfford = save.money >= boat.price;
                const upg = save.boatUpgrades[boat.id];

                return (
                  <div
                    key={boat.id}
                    className={`rounded-lg p-4 border ${
                      equipped ? 'border-amber-400/70 bg-[#102b42]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Anchor className="w-4 h-4 text-sky-300" />
                          <h3 className="font-display font-bold text-lg text-white">{boat.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-xl">{boat.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={equipped || locked || (!owned && !canAfford)}
                        onClick={() => onBuyOrEquipBoat(boat.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                          equipped
                            ? 'bg-slate-800 text-slate-300'
                            : owned
                              ? 'bg-teal-600 hover:bg-teal-500 text-white'
                              : locked || !canAfford
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        {equipped
                          ? 'Active Vessel'
                          : owned
                            ? 'Launch Vessel'
                            : locked
                              ? `Unlocks Lv.${boat.unlockLevel}`
                              : `Buy $${boat.price.toLocaleString()}`}
                      </button>
                    </div>

                    <div className="text-xs font-mono-num text-sky-200 mb-3">
                      Top Speed {Math.round(boat.maxSpeed * (1 + (upg.engineLevel - 1) * 0.16) * 1.94)} kn · Length{' '}
                      {boat.lengthM}m · Stability {boat.stability.toFixed(1)}x
                    </div>

                    {owned && (
                      <div className="pt-3 border-t border-sky-300/15 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Boat Performance Upgrades */}
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            Upgrades
                          </div>
                          <div className="space-y-1.5">
                            {(
                              [
                                { key: 'engineLevel', label: 'Outboard Engine' },
                                { key: 'hullLevel', label: 'Reinforced Hull' },
                                { key: 'sonarLevel', label: 'Fish Finder Sonar' },
                              ] as const
                            ).map((item) => {
                              const lv = upg[item.key];
                              const cost = getBoatUpgradeCost(lv);
                              return (
                                <div key={item.key} className="flex items-center justify-between text-xs bg-[#081928] px-3 py-1.5 rounded">
                                  <span className="text-slate-200">
                                    {item.label} <span className="font-mono-num text-teal-300">Lv.{lv}/4</span>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={lv >= 4 || save.money < cost}
                                    onClick={() => onUpgradeBoat(boat.id, item.key)}
                                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold cursor-pointer"
                                  >
                                    {lv >= 4 ? 'MAX' : `$${cost}`}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Hull Paint Customization */}
                        <div>
                          <div className="text-xs font-semibold text-slate-300 mb-2">Hull Paint Finish</div>
                          <div className="flex flex-wrap gap-2">
                            {BOAT_HULL_COLORS.map((c) => {
                              const active = upg.hullColor.toLowerCase() === c.hex.toLowerCase();
                              return (
                                <button
                                  key={c.hex}
                                  type="button"
                                  onClick={() => onSetBoatColor(boat.id, c.hex)}
                                  title={c.name}
                                  aria-label={`Paint ${boat.name} ${c.name}`}
                                  className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 cursor-pointer ${
                                    active
                                      ? 'border-amber-400 bg-[#163754] text-white font-semibold'
                                      : 'border-sky-300/20 bg-[#081928] text-slate-300 hover:text-white'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-sm border border-white/30"
                                    style={{ backgroundColor: c.hex }}
                                  />
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
