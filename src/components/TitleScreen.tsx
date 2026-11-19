import React from 'react';
import { Play, Settings, Gift } from 'lucide-react';
import { PlayerSave } from '../game/types';
import { canClaimDailyReward } from '../game/economy';
import { getLocationById } from '../game/catalog';

interface TitleScreenProps {
  save: PlayerSave;
  onStartGame: () => void;
  onOpenSettings: () => void;
  onOpenDaily: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  save,
  onStartGame,
  onOpenSettings,
  onOpenDaily,
}) => {
  const hasProgress = save.stats.totalCaught > 0 || save.level > 1;
  const dailyReady = canClaimDailyReward(save);
  const loc = getLocationById(save.locationId);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 md:p-14 pointer-events-none"
      style={{
        background:
          'linear-gradient(95deg, rgba(5, 16, 28, 0.88) 0%, rgba(5, 16, 28, 0.62) 38%, rgba(5, 16, 28, 0.08) 72%, rgba(5, 16, 28, 0) 100%)',
      }}
    >
      {/* Top quiet session metadata */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium tracking-wide text-sky-200/80 hud-stroke">
          {loc.name} · Level {save.level} · ${save.money.toLocaleString()}
        </div>
      </div>

      {/* Left-third negative-space Title Lockup & Primary Actions */}
      <div className="max-w-lg pointer-events-auto my-auto">
        {/* Custom Inline SVG Marine Crest Emblem */}
        <svg
          viewBox="0 0 360 118"
          className="w-full max-w-[360px] h-auto mb-3 drop-shadow-[0_4px_14px_rgba(3,10,18,0.85)]"
          role="img"
          aria-label="Ultimate Fishing Simulator 3D"
        >
          {/* Compass / Hook Crest */}
          <g transform="translate(4, 10)">
            <circle cx="34" cy="36" r="30" fill="#091d30" stroke="#e5a93c" strokeWidth="2.4" />
            <circle cx="34" cy="36" r="24" fill="none" stroke="#3ea4ba" strokeWidth="1.2" strokeDasharray="3 3" />
            {/* Stylized leaping fish & hook */}
            <path
              d="M 18 42 Q 30 22 49 30 Q 43 37 49 44 Q 32 48 18 42 Z"
              fill="#3ec4b8"
              stroke="#071522"
              strokeWidth="1.6"
            />
            <path
              d="M 34 12 L 34 45 A 7 7 0 0 1 20 45"
              fill="none"
              stroke="#f2c464"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="42" cy="32" r="1.8" fill="#071522" />
          </g>

          {/* Wordmark */}
          <text
            x="80"
            y="36"
            fill="#f2c464"
            fontFamily="Outfit, sans-serif"
            fontWeight="700"
            fontSize="14"
            letterSpacing="4.5"
          >
            ULTIMATE
          </text>
          <text
            x="78"
            y="72"
            fill="#f8fafc"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="36"
            letterSpacing="-0.5"
          >
            FISHING SIM
          </text>
          <text
            x="80"
            y="96"
            fill="#8ecae0"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="600"
            fontSize="14"
            letterSpacing="3.2"
          >
            3D EXPEDITION
          </text>
        </svg>

        <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed mb-7 max-w-md hud-stroke">
          Explore sunlit oceans, alpine lakes, and canyon rivers. Captain custom boats, track underwater fish AI, and master realistic line tension.
        </p>

        {/* Up to 3 clean menu actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStartGame}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-display font-bold text-base tracking-wide shadow-[0_6px_22px_rgba(245,158,11,0.35)] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <Play className="w-5 h-5 fill-current" />
            {hasProgress ? 'Continue Fishing' : 'Start Fishing'}
          </button>

          {dailyReady && (
            <button
              type="button"
              onClick={onOpenDaily}
              className="inline-flex items-center gap-2 px-4 py-3.5 rounded-lg bg-[#0d273c] hover:bg-[#143753] border border-amber-400/50 text-amber-200 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Gift className="w-4 h-4 text-amber-400" />
              Daily Reward
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-4 py-3.5 rounded-lg bg-[#0a1d2e] hover:bg-[#122e46] border border-sky-300/25 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings className="w-4 h-4 text-sky-300" />
            Settings
          </button>
        </div>
      </div>

      {/* Single flat borderless control hint line */}
      <div className="text-xs sm:text-sm text-slate-300/90 font-medium tracking-wide hud-stroke">
        WASD / Joystick Move · Drag Look · E Board Boat · Space / Reel Cast &amp; Fight · V Camera · U Underwater · Esc Pause
      </div>
    </div>
  );
};
