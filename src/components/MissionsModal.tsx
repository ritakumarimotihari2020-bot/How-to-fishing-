import React, { useState } from 'react';
import { X, Gift, CheckCircle2, Award } from 'lucide-react';
import { ACHIEVEMENTS, DAILY_REWARDS, MISSIONS } from '../game/catalog';
import { canClaimDailyReward, getMissionProgress } from '../game/economy';
import { PlayerSave } from '../game/types';

interface MissionsModalProps {
  save: PlayerSave;
  initialTab?: 'missions' | 'daily' | 'achievements';
  onClose: () => void;
  onClaimMission: (missionId: string) => void;
  onClaimDaily: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  save,
  initialTab = 'missions',
  onClose,
  onClaimMission,
  onClaimDaily,
}) => {
  const [tab, setTab] = useState<'missions' | 'daily' | 'achievements'>(initialTab);
  const dailyReady = canClaimDailyReward(save);
  const currentDayIdx = save.dailyStreak % DAILY_REWARDS.length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Missions, Daily Rewards, and Achievements"
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <h2 className="font-display text-xl font-bold text-white">Missions, Daily Rewards &amp; Achievements</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Missions"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-sky-300/10">
          {(
            [
              { id: 'missions', label: 'Missions' },
              { id: 'daily', label: dailyReady ? 'Daily Rewards (Ready!)' : 'Daily Rewards' },
              { id: 'achievements', label: `Achievements (${save.unlockedAchievements.length}/${ACHIEVEMENTS.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                tab === t.id ? 'bg-amber-500 text-slate-950' : 'bg-[#0e2336] text-slate-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto marine-scroll flex-1">
          {tab === 'missions' && (
            <div className="space-y-3">
              {MISSIONS.map((m) => {
                const prog = getMissionProgress(save, m);
                const claimed = save.claimedMissions.includes(m.id);
                const done = prog >= m.targetValue;
                const pct = Math.min(100, Math.round((prog / m.targetValue) * 100));

                return (
                  <div
                    key={m.id}
                    className="rounded-lg p-4 border border-sky-300/15 bg-[#0c2134] flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-display font-bold text-base text-white">{m.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono-num text-xs text-sky-200">
                          {Math.min(prog, m.targetValue)} / {m.targetValue}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono-num text-xs text-amber-300 mb-1.5">
                        +${m.rewardMoney} · +{m.rewardXp} XP
                      </div>
                      <button
                        type="button"
                        disabled={claimed || !done}
                        onClick={() => onClaimMission(m.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                          claimed
                            ? 'bg-slate-800 text-teal-300'
                            : done
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {claimed ? 'Claimed' : done ? 'Claim Reward' : 'In Progress'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'daily' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-sky-300/10">
                <div>
                  <div className="font-display font-bold text-base text-white">7-Day Angler Check-In</div>
                  <div className="text-xs text-slate-400">
                    Current Streak: <span className="font-mono-num text-amber-300">{save.dailyStreak} days</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!dailyReady}
                  onClick={onClaimDaily}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  <Gift className="w-4 h-4" />
                  {dailyReady ? `Claim Day ${currentDayIdx + 1}` : 'Claimed Today'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DAILY_REWARDS.map((r, idx) => {
                  const isNext = idx === currentDayIdx && dailyReady;
                  const isPast = idx < currentDayIdx || (idx === currentDayIdx && !dailyReady && save.dailyStreak > 0);
                  return (
                    <div
                      key={r.day}
                      className={`rounded-lg p-3 border text-center ${
                        isNext
                          ? 'border-amber-400 bg-[#14304a]'
                          : isPast
                            ? 'border-teal-400/40 bg-[#0a2333]'
                            : 'border-sky-300/15 bg-[#0c2134]'
                      }`}
                    >
                      <div className="font-mono-num text-xs text-sky-300 mb-1">Day {r.day}</div>
                      <div className="text-xs font-bold text-white">{r.label}</div>
                      {isPast && <div className="text-[11px] text-teal-300 mt-1">Collected</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'achievements' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = save.unlockedAchievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`rounded-lg p-4 border flex items-start gap-3 ${
                      unlocked ? 'border-amber-400/50 bg-[#112c42]' : 'border-sky-300/15 bg-[#0b1f31] opacity-75'
                    }`}
                  >
                    {unlocked ? (
                      <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    ) : (
                      <Award className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-display font-bold text-sm text-white">{ach.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{ach.description}</div>
                      <div className="font-mono-num text-xs text-amber-300 mt-1.5">
                        Bonus +${ach.rewardMoney} {unlocked ? '· Unlocked' : ''}
                      </div>
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
