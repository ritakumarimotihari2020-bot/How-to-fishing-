import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FISH_SPECIES, getSpeciesById } from '../game/catalog';
import { CaughtFish, PlayerSave } from '../game/types';
import { FishIllustration } from './FishIllustration';

interface AquariumModalProps {
  save: PlayerSave;
  onClose: () => void;
  onSellFromAquarium: (uid: string) => void;
}

interface SwimSprite {
  fish: CaughtFish;
  x: number;
  y: number;
  vx: number;
  phase: number;
  scale: number;
}

export const AquariumModal: React.FC<AquariumModalProps> = ({
  save,
  onClose,
  onSellFromAquarium,
}) => {
  const [tab, setTab] = useState<'tank' | 'collection'>('tank');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live animated reef tank canvas for all kept aquarium fish
  useEffect(() => {
    if (tab !== 'tank') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 780;
    const h = 320;
    canvas.width = w;
    canvas.height = h;

    const sprites: SwimSprite[] = save.aquarium.map((fish, i) => ({
      fish,
      x: 80 + ((i * 137) % (w - 160)),
      y: 65 + ((i * 63) % (h - 135)),
      vx: (i % 2 === 0 ? 1 : -1) * (24 + (i % 4) * 10),
      phase: i * 1.1,
      scale: Math.min(1.45, Math.max(0.62, 0.55 + Math.cbrt(fish.weightKg) * 0.17)),
    }));

    const bubbles = Array.from({ length: 24 }, (_, i) => ({
      x: (i * 39 + 20) % w,
      y: (i * 29) % h,
      r: 1.5 + (i % 4) * 0.9,
      spd: 14 + (i % 5) * 6,
    }));

    let rafId = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;

      // Water backdrop gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0f5c7a');
      bg.addColorStop(0.55, '#093750');
      bg.addColorStop(1, '#062033');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Sunlit volumetric caustic rays
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const rx = 80 + i * 130 + Math.sin(t * 0.6 + i) * 24;
        const grad = ctx.createLinearGradient(rx, 0, rx + 50, h);
        grad.addColorStop(0, 'rgba(130, 232, 245, 0.14)');
        grad.addColorStop(1, 'rgba(130, 232, 245, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rx - 22, 0);
        ctx.lineTo(rx + 28, 0);
        ctx.lineTo(rx + 85, h);
        ctx.lineTo(rx + 15, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Sandy seabed + swaying kelp
      ctx.fillStyle = '#a38f6b';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h - 28);
      ctx.quadraticCurveTo(w * 0.35, h - 42, w * 0.65, h - 24);
      ctx.quadraticCurveTo(w * 0.85, h - 14, w, h - 32);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      for (let k = 0; k < 12; k++) {
        const kx = 45 + k * 65;
        const kh = 45 + (k % 3) * 26;
        const sway = Math.sin(t * 1.8 + k) * 9;
        ctx.strokeStyle = k % 2 === 0 ? '#1e7858' : '#268b67';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(kx, h - 24);
        ctx.quadraticCurveTo(kx + sway, h - 24 - kh * 0.5, kx + sway * 1.4, h - 24 - kh);
        ctx.stroke();
      }

      // Bubbles
      ctx.fillStyle = 'rgba(205, 244, 255, 0.45)';
      for (const b of bubbles) {
        b.y -= b.spd * dt;
        if (b.y < -10) b.y = h - 22;
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(t * 2 + b.y * 0.04) * 3, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated swimming trophy fish
      for (const s of sprites) {
        const sp = getSpeciesById(s.fish.speciesId);
        s.x += s.vx * dt;
        s.phase += dt * 4.5;
        if (s.x < 65 && s.vx < 0) s.vx *= -1;
        if (s.x > w - 65 && s.vx > 0) s.vx *= -1;
        const bobY = s.y + Math.sin(s.phase * 0.55) * 6;
        const facing = s.vx >= 0 ? 1 : -1;

        ctx.save();
        ctx.translate(s.x, bobY);
        ctx.scale(facing * s.scale, s.scale);

        // Tail wag
        const wag = Math.sin(s.phase * 2.2) * 5;
        ctx.fillStyle = sp.finColor;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(-42, -13 + wag);
        ctx.lineTo(-34, 0);
        ctx.lineTo(-42, 13 + wag);
        ctx.closePath();
        ctx.fill();

        // Dorsal fin
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(sp.bodyShape === 'shark' ? 2 : 8, sp.bodyShape === 'shark' ? -26 : -19);
        ctx.lineTo(14, -9);
        ctx.closePath();
        ctx.fill();

        // Body
        ctx.fillStyle = sp.bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, sp.bodyShape === 'deep' ? 17 : 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = sp.bellyColor;
        ctx.beginPath();
        ctx.ellipse(2, 5, 21, 6, 0, 0, Math.PI);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(17, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#07111a';
        ctx.beginPath();
        ctx.arc(18, -3, 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [tab, save.aquarium]);

  const discoveredCount = Object.keys(save.stats.speciesCaughtCounts).length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Aquarium and Fish Collection"
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Living Aquarium &amp; Fish Encyclopedia</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Species Discovered: <span className="font-mono-num text-teal-300">{discoveredCount}/{FISH_SPECIES.length}</span> ·
              Aquarium Tank: <span className="font-mono-num text-amber-300">{save.aquarium.length}/16</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Aquarium"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-sky-300/10">
          <button
            type="button"
            onClick={() => setTab('tank')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'tank' ? 'bg-amber-500 text-slate-950' : 'bg-[#0e2336] text-slate-300 hover:text-white'
            }`}
          >
            Live Aquarium ({save.aquarium.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('collection')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'collection' ? 'bg-amber-500 text-slate-950' : 'bg-[#0e2336] text-slate-300 hover:text-white'
            }`}
          >
            Species Collection ({discoveredCount}/{FISH_SPECIES.length})
          </button>
        </div>

        <div className="p-5 overflow-y-auto marine-scroll flex-1">
          {tab === 'tank' ? (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-teal-400/30 bg-[#051d2e] relative">
                <canvas ref={canvasRef} className="w-full h-56 sm:h-72 block object-cover" />
                {save.aquarium.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                    <div className="rounded-lg px-4 py-3 bg-[#071a29]/90 border border-sky-300/20 text-sm text-sky-100">
                      Your reef aquarium is empty. Select &ldquo;Aquarium&rdquo; after landing a fish to watch it swim here!
                    </div>
                  </div>
                )}
              </div>

              {save.aquarium.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {save.aquarium.map((fish) => {
                    const sp = getSpeciesById(fish.speciesId);
                    return (
                      <div
                        key={fish.uid}
                        className="rounded-lg p-3 border border-sky-300/15 bg-[#0c2134] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FishIllustration species={sp} className="w-14 h-9 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{sp.name}</div>
                            <div className="text-xs font-mono-num text-slate-400">
                              {fish.weightKg.toFixed(2)} kg · {fish.lengthCm} cm
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSellFromAquarium(fish.uid)}
                          className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                        >
                          Sell ${fish.value}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FISH_SPECIES.map((sp) => {
                const caught = save.stats.speciesCaughtCounts[sp.id] ?? 0;
                const best = save.stats.speciesBestWeight[sp.id] ?? 0;
                return (
                  <div
                    key={sp.id}
                    className={`rounded-lg p-3.5 border ${
                      caught > 0 ? 'border-teal-400/35 bg-[#0d2438]' : 'border-sky-300/10 bg-[#091a2a] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-amber-300 font-semibold">{sp.rarity}</span>
                      <span className="font-mono-num text-slate-400">Diff {sp.difficulty}/10</span>
                    </div>
                    <div className="flex items-center justify-center py-2">
                      <FishIllustration species={sp} className="w-28 h-14" />
                    </div>
                    <div className="font-display font-bold text-sm text-white">{sp.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{sp.description}</div>
                    <div className="mt-2.5 pt-2 border-t border-sky-300/10 flex items-center justify-between text-xs font-mono-num">
                      <span className="text-sky-200">Caught: {caught}</span>
                      <span className="text-teal-300">{best > 0 ? `Best ${best.toFixed(2)}kg` : 'Undiscovered'}</span>
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
