import React, { useState } from 'react';
import { X, Play, Settings, Home, Backpack, RotateCcw } from 'lucide-react';
import { GameSettings, PlayerSave } from '../game/types';

interface PauseModalProps {
  save: PlayerSave;
  onResume: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  save,
  onResume,
  onOpenInventory,
  onOpenSettings,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Game Paused"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-sky-300/25 p-6 shadow-2xl"
        style={{ backgroundColor: '#081929' }}
      >
        <h2 className="font-display text-2xl font-bold text-white text-center mb-1">Game Paused</h2>
        <p className="text-xs text-slate-400 text-center mb-5">
          Progress saves automatically to local storage
        </p>

        {/* Compact session metrics */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <div className="rounded-lg bg-[#0d2438] p-2">
            <div className="text-[11px] text-slate-400">Caught</div>
            <div className="font-mono-num text-base font-bold text-white">{save.stats.totalCaught}</div>
          </div>
          <div className="rounded-lg bg-[#0d2438] p-2">
            <div className="text-[11px] text-slate-400">Level</div>
            <div className="font-mono-num text-base font-bold text-teal-300">{save.level}</div>
          </div>
          <div className="rounded-lg bg-[#0d2438] p-2">
            <div className="text-[11px] text-slate-400">Balance</div>
            <div className="font-mono-num text-base font-bold text-amber-400">${save.money}</div>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Fishing
          </button>

          <button
            type="button"
            onClick={onOpenInventory}
            className="w-full py-2.5 rounded-lg bg-[#102b42] hover:bg-[#173b59] text-slate-100 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Backpack className="w-4 h-4 text-sky-300" />
            Tackle Box &amp; Cooler
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 rounded-lg bg-[#102b42] hover:bg-[#173b59] text-slate-100 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-sky-300" />
            Settings
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 rounded-lg bg-[#0c2032] hover:bg-[#14304a] border border-sky-300/15 text-slate-300 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  settings: GameSettings;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onResetSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onUpdateSettings,
  onResetSave,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div
        className="w-full max-w-md rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <h2 className="font-display text-xl font-bold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Volume */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
              <label htmlFor="settings-volume">Master Volume</label>
              <span className="font-mono-num text-amber-300">
                {settings.muted ? 'Muted' : `${Math.round(settings.masterVolume * 100)}%`}
              </span>
            </div>
            <input
              id="settings-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.masterVolume}
              onChange={(e) =>
                onUpdateSettings({ masterVolume: parseFloat(e.target.value), muted: false })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Camera Sensitivity */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1.5">
              <label htmlFor="settings-cam-sens">Camera Look Sensitivity</label>
              <span className="font-mono-num text-sky-300">{settings.cameraSensitivity.toFixed(1)}x</span>
            </div>
            <input
              id="settings-cam-sens"
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.cameraSensitivity}
              onChange={(e) => onUpdateSettings({ cameraSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          {/* Mobile Touch Controls */}
          <div>
            <div className="text-xs font-semibold text-slate-200 mb-1.5">Mobile Joystick &amp; Touch HUD</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'always', label: 'Always On' },
                  { id: 'off', label: 'Off' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ touchControlsMode: opt.id })}
                  className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    settings.touchControlsMode === opt.id
                      ? 'border-amber-400 bg-[#14334d] text-amber-300'
                      : 'border-sky-300/15 bg-[#0c2134] text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day/Night Cycle Speed */}
          <div>
            <div className="text-xs font-semibold text-slate-200 mb-1.5">Day / Night Cycle Speed</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 0, label: 'Frozen' },
                { val: 1, label: 'Realistic' },
                { val: 3, label: 'Fast (3x)' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => onUpdateSettings({ timeCycleSpeed: opt.val })}
                  className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    settings.timeCycleSpeed === opt.val
                      ? 'border-amber-400 bg-[#14334d] text-amber-300'
                      : 'border-sky-300/15 bg-[#0c2134] text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Save */}
          <div className="pt-3 border-t border-sky-300/15">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full py-2 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Saved Progress
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetSave();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
