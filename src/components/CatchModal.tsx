import React from 'react';
import { CaughtFish } from '../game/types';
import { getSpeciesById } from '../game/catalog';
import { FishIllustration } from './FishIllustration';

interface CatchModalProps {
  fish: CaughtFish;
  aquariumCount: number;
  isNewRecord: boolean;
  onDecision: (destination: 'bag' | 'aquarium' | 'release') => void;
}

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-slate-300',
  Uncommon: 'text-teal-300',
  Rare: 'text-sky-300',
  Epic: 'text-amber-300',
  Legendary: 'text-amber-400',
};

export const CatchModal: React.FC<CatchModalProps> = ({
  fish,
  aquariumCount,
  isNewRecord,
  onDecision,
}) => {
  const species = getSpeciesById(fish.speciesId);
  const aquariumFull = aquariumCount >= 16;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="catch-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-amber-400/35 p-6 shadow-2xl"
        style={{ backgroundColor: '#091b2c' }}
      >
        <div className="flex items-center justify-between text-xs font-semibold mb-1">
          <span className={RARITY_COLORS[fish.rarity] ?? 'text-slate-200'}>
            {fish.rarity} Catch
          </span>
          {isNewRecord && <span className="text-amber-400">Personal Record</span>}
        </div>

        <h2 id="catch-modal-title" className="font-display text-2xl font-bold text-white">
          {species.name}
        </h2>
        <p className="text-xs italic text-slate-400 mb-4">{species.scientificName}</p>

        {/* Fish Visual Showcase */}
        <div className="rounded-lg bg-[#061320] border border-sky-300/15 py-5 px-4 flex items-center justify-center mb-4">
          <FishIllustration species={species} className="w-56 h-28" />
        </div>

        {/* Tabular Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <div className="rounded-lg bg-[#0d2438] p-2.5">
            <div className="text-[11px] text-slate-400">Weight</div>
            <div className="font-mono-num text-base font-bold text-white mt-0.5">
              {fish.weightKg.toFixed(2)} kg
            </div>
          </div>
          <div className="rounded-lg bg-[#0d2438] p-2.5">
            <div className="text-[11px] text-slate-400">Length</div>
            <div className="font-mono-num text-base font-bold text-white mt-0.5">
              {fish.lengthCm} cm
            </div>
          </div>
          <div className="rounded-lg bg-[#0d2438] p-2.5">
            <div className="text-[11px] text-slate-400">Market Value</div>
            <div className="font-mono-num text-base font-bold text-amber-400 mt-0.5">
              ${fish.value}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onDecision('bag')}
            className="py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
          >
            Keep (${fish.value})
          </button>
          <button
            type="button"
            disabled={aquariumFull}
            onClick={() => onDecision('aquarium')}
            className="py-2.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-45 text-white font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
          >
            {aquariumFull ? 'Tank Full' : 'Aquarium'}
          </button>
          <button
            type="button"
            onClick={() => onDecision('release')}
            className="py-2.5 px-3 rounded-lg bg-[#143047] hover:bg-[#1c405e] text-sky-100 font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
          >
            Release (+{Math.round(fish.xp * 1.4)} XP)
          </button>
        </div>
      </div>
    </div>
  );
};
