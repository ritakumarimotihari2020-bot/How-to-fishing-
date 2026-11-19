import React, { useRef, useState } from 'react';
import {
  Anchor,
  Backpack,
  Camera,
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  Eye,
  Fish,
  Pause,
  ShoppingBag,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getBaitById,
  getBoatById,
  getLocationById,
  getRodById,
} from '../game/catalog';
import { xpForLevel } from '../game/economy';
import { HudSnapshot, PlayerSave } from '../game/types';

interface GameHudProps {
  save: PlayerSave;
  hud: HudSnapshot;
  showTouchControls: boolean;
  onOpenModal: (modal: 'shop' | 'inventory' | 'aquarium' | 'missions' | 'world' | 'settings') => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onToggleUnderwater: () => void;
  onToggleBoat: () => void;
  onActionDown: () => void;
  onActionUp: () => void;
  onCancelCast: () => void;
  onJoystickMove: (x: number, y: number) => void;
}

function formatClock(hourFloat: number): string {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.floor((hourFloat - Math.floor(hourFloat)) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  save,
  hud,
  showTouchControls,
  onOpenModal,
  onTogglePause,
  onToggleMute,
  onCycleCamera,
  onToggleUnderwater,
  onToggleBoat,
  onActionDown,
  onActionUp,
  onCancelCast,
  onJoystickMove,
}) => {
  const loc = getLocationById(save.locationId);
  const rod = getRodById(save.equippedRodId);
  const bait = getBaitById(save.equippedBaitId);
  const baitCount = save.baitCounts[save.equippedBaitId] ?? 0;
  const boat = getBoatById(save.equippedBoatId);
  const xpReq = xpForLevel(save.level);
  const xpPct = Math.min(100, Math.round((save.xp / xpReq) * 100));

  // Virtual Joystick state for Android/Mobile
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);

  const handleJoyStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    updateJoyFromPointer(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoyFromPointer(e.clientX, e.clientY);
  };

  const handleJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const updateJoyFromPointer = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });
    onJoystickMove(dx / maxR, dy / maxR);
  };

  const WeatherIcon =
    hud.weather === 'stormy'
      ? CloudLightning
      : hud.weather === 'rainy'
        ? CloudRain
        : hud.weather === 'cloudy'
          ? Cloud
          : Sun;

  const isFighting = hud.fishingPhase === 'fighting';
  const isBiting = hud.fishingPhase === 'bite';
  const isCharging = hud.fishingPhase === 'charging';
  const isWaiting = hud.fishingPhase === 'waiting';
  const tensionPct = Math.round(hud.tension * 100);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* TOP PERIMETER BAR */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Angler Status & World Readout (Solid translucent nautical backing, zero backdrop-blur) */}
        <div
          className="pointer-events-auto rounded-lg px-3.5 py-2.5 border border-sky-300/20 shadow-lg max-w-[60vw] sm:max-w-xs"
          style={{ backgroundColor: 'rgba(7, 20, 34, 0.86)' }}
        >
          <div className="flex items-baseline justify-between gap-4">
            <div className="font-mono-num text-xl sm:text-2xl font-bold text-amber-400 leading-none">
              ${save.money.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-sky-200 whitespace-nowrap">
              Lv. <span className="font-mono-num text-white">{save.level}</span>
            </div>
          </div>

          {/* Slim XP progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 mb-2">
            <div
              className="h-full bg-teal-400 transition-transform origin-left duration-200"
              style={{ width: `${xpPct}%` }}
            />
          </div>

          {/* Clean unboxed metadata row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-300">
            <span className="font-semibold text-white truncate max-w-[130px]">{loc.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono-num">
              <WeatherIcon className="w-3.5 h-3.5 text-amber-300" />
              {formatClock(hud.timeOfDay)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-teal-300">{hud.waterDepthM}m deep</span>
          </div>
        </div>

        {/* Top-Right: Compact Tool & Menu Buttons */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2 max-w-[196px] sm:max-w-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('shop');
            }}
            aria-label="Open Market and Shop"
            title="Market & Tackle Shop"
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] active:bg-[#0d253a] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Shop</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('inventory');
            }}
            aria-label="Open Tackle Box and Bag"
            title="Inventory & Tackle"
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Backpack className="w-4 h-4 text-sky-300" />
            <span className="hidden md:inline">Bag</span>
            {save.fishBag.length > 0 && (
              <span className="font-mono-num text-amber-300">{save.fishBag.length}</span>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('aquarium');
            }}
            aria-label="Open Aquarium and Fish Collection"
            title="Aquarium & Fish Log"
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Fish className="w-4 h-4 text-teal-300" />
            <span className="hidden md:inline">Aquarium</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('missions');
            }}
            aria-label="Open Missions and Daily Rewards"
            title="Missions & Rewards"
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span className="hidden lg:inline">Missions</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('world');
            }}
            aria-label="Open Locations and Weather"
            title="Map & Weather"
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Compass className="w-4 h-4 text-sky-300" />
            <span className="hidden lg:inline">Map</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            aria-label="Toggle First-Person and Third-Person Camera"
            title="Switch Camera (V)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Camera className="w-4 h-4 text-sky-200" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleUnderwater();
            }}
            aria-label="Toggle Underwater Lure Camera"
            title="Underwater Lure Cam (U)"
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border inline-flex items-center justify-center transition-colors cursor-pointer ${
              hud.cameraMode === 'underwater'
                ? 'border-teal-400 text-teal-200 bg-[#0d3b4d]'
                : 'border-sky-300/20 text-slate-100 hover:bg-[#14334d]'
            }`}
            style={
              hud.cameraMode === 'underwater' ? undefined : { backgroundColor: 'rgba(7, 20, 34, 0.88)' }
            }
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={save.settings.muted ? 'Unmute Audio' : 'Mute Audio'}
            title="Mute (M)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            {save.settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-200" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            aria-label="Pause Game"
            title="Pause (Esc)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-sky-300/20 text-slate-100 hover:bg-[#14334d] inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
          >
            <Pause className="w-4 h-4 text-slate-100" />
          </button>
        </div>
      </div>

      {/* UPPER-CENTER CONTEXTUAL STATUS / BITE ALERT (keeps central viewport clear) */}
      <div className="flex flex-col items-center gap-2 mt-2 mb-auto pointer-events-none">
        {isBiting && (
          <div
            className="px-5 py-2.5 rounded-lg border-2 border-amber-400 text-center shadow-xl"
            style={{ backgroundColor: 'rgba(14, 24, 38, 0.94)' }}
          >
            <div className="font-display text-lg font-extrabold text-amber-400 tracking-wide">
              FISH STRIKE! SET THE HOOK!
            </div>
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 mx-auto">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(hud.biteTimerRatio * 100)}%` }}
              />
            </div>
          </div>
        )}

        {hud.statusMessage && !isBiting && (
          <div
            className="px-3.5 py-1.5 rounded-md border border-sky-300/25 text-xs font-medium text-sky-100"
            style={{ backgroundColor: 'rgba(7, 20, 34, 0.86)' }}
          >
            {hud.statusMessage}
          </div>
        )}
      </div>

      {/* ACTIVE FISHING GAUGES (shown above bottom controls cleanly on mobile & desktop) */}
      {(isFighting || isCharging || isWaiting) && (
        <div className="pointer-events-auto flex flex-col items-center gap-2 w-full max-w-md mx-auto mb-2.5">
          {isFighting && (
            <div
              className="w-full rounded-lg p-3 border border-sky-300/25 shadow-xl"
              style={{ backgroundColor: 'rgba(7, 20, 34, 0.92)' }}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-display font-bold text-white text-sm">
                  {hud.hookedFishName} ({hud.hookedFishWeightEstimate})
                </span>
                <span className="font-mono-num text-sky-200">
                  {hud.lineDistanceM}m remaining
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={hud.fishSurging ? 'text-rose-400 font-bold' : 'text-teal-300 font-semibold'}>
                  {hud.fishSurging ? 'FISH SURGING — EASE OFF!' : 'SAFE TO REEL'}
                </span>
                <span className="font-mono-num text-slate-200">Tension {tensionPct}%</span>
              </div>
              <div className="w-full h-3.5 bg-slate-900 rounded-md overflow-hidden border border-slate-700 relative">
                <div
                  className={`h-full transition-all duration-75 ${
                    hud.tension > 0.78
                      ? 'bg-rose-500'
                      : hud.tension > 0.52
                        ? 'bg-amber-400'
                        : 'bg-teal-400'
                  }`}
                  style={{ width: `${tensionPct}%` }}
                />
                <div className="absolute top-0 bottom-0 left-[78%] w-0.5 bg-white/70" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                <span>Fish Stamina</span>
                <span className="font-mono-num">{Math.round(hud.fishStamina * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${Math.round(hud.fishStamina * 100)}%` }}
                />
              </div>
            </div>
          )}

          {isCharging && (
            <div
              className="w-56 rounded-lg p-2.5 border border-amber-400/50 text-center"
              style={{ backgroundColor: 'rgba(7, 20, 34, 0.9)' }}
            >
              <div className="text-xs font-semibold text-amber-300 mb-1">
                Cast Power · <span className="font-mono-num">{Math.round(hud.castPower * 100)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(hud.castPower * 100)}%` }}
                />
              </div>
            </div>
          )}

          {isWaiting && (
            <div
              className="rounded-lg px-3 py-1.5 border border-sky-300/20 flex items-center gap-2.5 text-xs text-sky-100"
              style={{ backgroundColor: 'rgba(7, 20, 34, 0.88)' }}
            >
              <span className="font-mono-num">{hud.lineDistanceM}m out</span>
              <span aria-hidden="true">·</span>
              <span>Waiting for bite...</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCancelCast();
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
              >
                Retrieve
              </button>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM PERIMETER CLUSTER */}
      <div className="flex items-end justify-between gap-2 sm:gap-3">
        {/* Bottom-Left: Mobile Virtual Joystick OR Fish Finder Sonar */}
        <div className="pointer-events-auto flex items-end shrink-0">
          {showTouchControls ? (
            <div
              ref={joyBaseRef}
              onPointerDown={handleJoyStart}
              onPointerMove={handleJoyMove}
              onPointerUp={handleJoyEnd}
              onPointerCancel={handleJoyEnd}
              aria-label="Movement Joystick"
              className="relative w-26 h-26 rounded-full border-2 border-sky-300/35 flex items-center justify-center touch-none"
              style={{ backgroundColor: 'rgba(7, 20, 34, 0.76)' }}
            >
              <div className="w-10 h-10 rounded-full border border-sky-200/30 bg-sky-400/20 pointer-events-none" />
              <div
                className="absolute w-11 h-11 rounded-full bg-sky-300/90 border-2 border-white shadow-md pointer-events-none"
                style={{
                  transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
                }}
              />
            </div>
          ) : (
            /* Fish Finder Sonar Mini-Display */
            <div
              className="hidden sm:flex items-center gap-3 rounded-lg p-2.5 border border-sky-300/20"
              style={{ backgroundColor: 'rgba(7, 20, 34, 0.86)' }}
            >
              <svg viewBox="-50 -50 100 100" className="w-16 h-16 shrink-0" aria-label="Fish Finder Sonar">
                <circle cx="0" cy="0" r="46" fill="#061926" stroke="#2c6f8a" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="30" fill="none" stroke="#1b4d63" strokeWidth="1" />
                <circle cx="0" cy="0" r="15" fill="none" stroke="#1b4d63" strokeWidth="1" />
                <line x1="-46" y1="0" x2="46" y2="0" stroke="#163c4f" strokeWidth="1" />
                <line x1="0" y1="-46" x2="0" y2="46" stroke="#163c4f" strokeWidth="1" />
                {hud.sonarBlips.map((b, idx) => (
                  <circle
                    key={idx}
                    cx={b.x * 40}
                    cy={b.z * 40}
                    r={b.size === 3 ? 4.2 : b.size === 2 ? 3 : 2.2}
                    fill={b.size === 3 ? '#f59e0b' : '#2dd4bf'}
                  />
                ))}
                <circle cx="0" cy="0" r="3" fill="#ffffff" />
              </svg>
              <div className="text-xs leading-tight pr-1">
                <div className="font-semibold text-sky-100">
                  {hud.mode === 'boat' ? boat.name : 'On Foot'}
                </div>
                <div className="text-slate-400 mt-0.5 font-mono-num">
                  {hud.mode === 'boat'
                    ? `${hud.boatSpeedKnots} kn · HDG ${hud.headingDeg}°`
                    : `${hud.nearbyFishCount} fish on sonar`}
                </div>
                <div className="text-teal-300/90 mt-1 truncate max-w-[140px]">
                  {rod.name} · {bait.name} ({baitCount})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Right: Boat Boarding + Primary Cast/Reel Action (stacked on narrow mobile, horizontal on desktop) */}
        <div className="pointer-events-auto flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
          {(hud.canBoardBoat || hud.mode === 'boat') && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleBoat();
              }}
              className="h-10 sm:h-12 px-3.5 sm:px-4 rounded-lg border border-sky-300/30 bg-[#0d2a42] hover:bg-[#153e5e] text-sky-100 font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Anchor className="w-4 h-4 text-sky-300" />
              <span>{hud.mode === 'boat' ? 'Exit Boat' : 'Board Boat'}</span>
              <span className="hidden sm:inline text-sky-300/80">[E]</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.blur();
              onActionDown();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onActionUp();
            }}
            onPointerLeave={() => {
              if (isCharging || isFighting) onActionUp();
            }}
            aria-label={isFighting ? 'Hold to Reel Fish' : isBiting ? 'Set Hook' : 'Hold to Cast Line'}
            className={`h-13 sm:h-14 min-w-[112px] sm:min-w-[138px] px-4 sm:px-5 rounded-xl font-display font-bold text-sm sm:text-base tracking-wide shadow-lg transition-colors cursor-pointer select-none whitespace-nowrap ${
              isBiting
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-white'
                : isFighting
                  ? 'bg-teal-400 hover:bg-teal-300 active:bg-teal-500 text-slate-950'
                  : isWaiting
                    ? 'bg-[#12324a] hover:bg-[#1a4361] text-sky-100 border border-sky-300/30'
                    : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950'
            }`}
          >
            {isBiting
              ? 'SET HOOK!'
              : isFighting
                ? 'HOLD REEL'
                : isCharging
                  ? 'RELEASE!'
                  : isWaiting
                    ? 'RETRIEVE'
                    : showTouchControls
                      ? 'CAST LINE'
                      : 'CAST [SPACE]'}
          </button>
        </div>
      </div>
    </div>
  );
};
