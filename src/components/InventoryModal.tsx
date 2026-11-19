import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  BAITS,
  BOATS,
  HOOKS,
  LINES,
  REELS,
  RODS,
  getSpeciesById,
} from '../game/catalog';
import { GearCategory } from '../game/economy';
import { BoatId, PlayerSave } from '../game/types';
import { FishIllustration } from './FishIllustration';

interface InventoryModalProps {
  save: PlayerSave;
  onClose: () => void;
  onEquipGear: (category: GearCategory, id: string) => void;
  onSelectBait: (baitId: string) => void;
  onSelectBoat: (boatId: BoatId) => void;
  onMoveToAquarium: (uid: string) => void;
  onSellFish: (uid: string) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  save,
  onClose,
  onEquipGear,
  onSelectBait,
  onSelectBoat,
  onMoveToAquarium,
  onSellFish,
}) => {
  const [tab, setTab] = useState<'tackle' | 'cooler'>('tackle');

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Inventory and Tackle Box"
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <h2 className="font-display text-xl font-bold text-white">Tackle Box &amp; Fish Cooler</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Inventory"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-sky-300/10">
          <button
            type="button"
            onClick={() => setTab('tackle')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'tackle' ? 'bg-amber-500 text-slate-950' : 'bg-[#0e2336] text-slate-300 hover:text-white'
            }`}
          >
            Equipped Tackle &amp; Bait
          </button>
          <button
            type="button"
            onClick={() => setTab('cooler')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'cooler' ? 'bg-amber-500 text-slate-950' : 'bg-[#0e2336] text-slate-300 hover:text-white'
            }`}
          >
            Fish Cooler ({save.fishBag.length})
          </button>
        </div>

        <div className="p-5 overflow-y-auto marine-scroll flex-1 space-y-5">
          {tab === 'tackle' ? (
            <>
              {/* Bait Selector */}
              <div>
                <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2">Active Bait</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BAITS.map((bait) => {
                    const qty = save.baitCounts[bait.id] ?? 0;
                    const active = save.equippedBaitId === bait.id;
                    return (
                      <button
                        key={bait.id}
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => onSelectBait(bait.id)}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-40 ${
                          active
                            ? 'border-amber-400 bg-[#12304a]'
                            : 'border-sky-300/15 bg-[#0c2134] hover:border-sky-300/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span className="truncate">{bait.name}</span>
                          <span className="font-mono-num text-teal-300">x{qty}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Radius {bait.attractRadiusM}m
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Owned Rods / Reels / Lines / Hooks */}
              {(
                [
                  { label: 'Fishing Rods', cat: 'rod' as const, list: RODS, owned: save.ownedRodIds, eq: save.equippedRodId },
                  { label: 'Reels', cat: 'reel' as const, list: REELS, owned: save.ownedReelIds, eq: save.equippedReelId },
                  { label: 'Fishing Lines', cat: 'line' as const, list: LINES, owned: save.ownedLineIds, eq: save.equippedLineId },
                  { label: 'Hooks', cat: 'hook' as const, list: HOOKS, owned: save.ownedHookIds, eq: save.equippedHookId },
                ]
              ).map((group) => (
                <div key={group.cat}>
                  <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2">{group.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.list
                      .filter((item) => group.owned.includes(item.id))
                      .map((item) => {
                        const active = group.eq === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onEquipGear(group.cat, item.id)}
                            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                              active
                                ? 'border-amber-400 bg-[#12304a] text-amber-300'
                                : 'border-sky-300/15 bg-[#0c2134] text-slate-200 hover:border-sky-300/40'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}

              {/* Active Boat */}
              <div>
                <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2">Active Boat</h3>
                <div className="flex flex-wrap gap-2">
                  {BOATS.filter((b) => save.ownedBoatIds.includes(b.id)).map((boat) => {
                    const active = save.equippedBoatId === boat.id;
                    return (
                      <button
                        key={boat.id}
                        type="button"
                        onClick={() => onSelectBoat(boat.id)}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-[#12304a] text-amber-300'
                            : 'border-sky-300/15 bg-[#0c2134] text-slate-200 hover:border-sky-300/40'
                        }`}
                      >
                        {boat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : save.fishBag.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No fish in your cooler yet. Catch fish to store, display in your aquarium, or sell at market.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {save.fishBag.map((fish) => {
                const sp = getSpeciesById(fish.speciesId);
                return (
                  <div
                    key={fish.uid}
                    className="rounded-lg p-3 border border-sky-300/15 bg-[#0c2134] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FishIllustration species={sp} className="w-16 h-10 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{sp.name}</div>
                        <div className="text-xs font-mono-num text-slate-400">
                          {fish.weightKg.toFixed(2)} kg · ${fish.value}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={save.aquarium.length >= 16}
                        onClick={() => onMoveToAquarium(fish.uid)}
                        className="px-2.5 py-1.5 rounded bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                      >
                        Tank
                      </button>
                      <button
                        type="button"
                        onClick={() => onSellFish(fish.uid)}
                        className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Sell
                      </button>
                    </div>
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
