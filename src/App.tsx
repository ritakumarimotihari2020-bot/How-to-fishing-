import { useCallback, useEffect, useRef, useState } from 'react';
import { FishingEngine } from './game/FishingEngine';
import {
  GearCategory,
  buyBaitPack,
  buyOrEquipBoat,
  buyOrEquipGear,
  claimDailyReward,
  claimMissionReward,
  consumeEquippedBait,
  createInitialSave,
  loadSaveFromStorage,
  moveFishFromBagToAquarium,
  persistSaveToStorage,
  recordFishCatch,
  sellAllFishInBag,
  sellFishFromAquarium,
  sellFishFromBag,
  setBoatHullColor,
  updateSettings,
  updateWorldEnvironment,
  upgradeBoatStat,
} from './game/economy';
import {
  BoatId,
  CaughtFish,
  GameScreenState,
  GameSettings,
  HudSnapshot,
  LocationId,
  PlayerSave,
  WeatherType,
} from './game/types';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { CatchModal } from './components/CatchModal';
import { ShopModal } from './components/ShopModal';
import { InventoryModal } from './components/InventoryModal';
import { AquariumModal } from './components/AquariumModal';
import { MissionsModal } from './components/MissionsModal';
import { WorldModal } from './components/WorldModal';
import { PauseModal, SettingsModal } from './components/SettingsPauseModals';

type ActiveModal =
  | null
  | 'shop'
  | 'inventory'
  | 'aquarium'
  | 'missions'
  | 'daily'
  | 'world'
  | 'settings';

const INITIAL_HUD: HudSnapshot = {
  mode: 'foot',
  canBoardBoat: true,
  canExitBoat: false,
  boatSpeedKnots: 0,
  headingDeg: 0,
  waterDepthM: 4.5,
  cameraMode: 'third_person',
  fishingPhase: 'idle',
  castPower: 0,
  lineDistanceM: 0,
  maxLineDistanceM: 45,
  tension: 0,
  fishStamina: 1,
  fishSurging: false,
  hookedFishName: null,
  hookedFishWeightEstimate: null,
  biteTimerRatio: 0,
  timeOfDay: 10.2,
  weather: 'sunny',
  nearbyFishCount: 0,
  sonarBlips: [],
  statusMessage: null,
};

function isCoarseTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    window.innerWidth < 768
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FishingEngine | null>(null);

  const [save, setSave] = useState<PlayerSave>(() => loadSaveFromStorage());
  const saveRef = useRef(save);
  saveRef.current = save;

  const [screenState, setScreenState] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [pendingCatch, setPendingCatch] = useState<CaughtFish | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isNarrowOrTouch, setIsNarrowOrTouch] = useState<boolean>(() => isCoarseTouchDevice());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Persist save whenever player state updates
  useEffect(() => {
    persistSaveToStorage(save);
    engineRef.current?.syncSave(save);
  }, [save]);

  // Sync document.body.dataset.state & engine screenState
  useEffect(() => {
    document.body.dataset.state = screenState;
    engineRef.current?.setScreenState(screenState);
  }, [screenState]);

  // Track responsive touch/narrow viewport for auto mobile controls
  useEffect(() => {
    const onResize = () => setIsNarrowOrTouch(isCoarseTouchDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mount Three.js WebGLRenderer ONCE inside isolated sibling ref container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new FishingEngine(mountEl, saveRef.current, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onFishCaught: (fish) => {
        setPendingCatch(fish);
      },
      onBaitConsumed: () => {
        setSave((prev) => consumeEquippedBait(prev));
      },
      onTimeOfDaySync: (hour) => {
        setSave((prev) => ({ ...prev, timeOfDay: hour }));
      },
    });

    engineRef.current = engine;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      document.body.dataset.state = 'playing';
      engine.setScreenState('playing');
    } else {
      document.body.dataset.state = 'title';
      engine.setScreenState('title');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Start Game handler (Title -> Playing)
  const handleStartGame = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.dataset.state = 'playing';
    setActiveModal(null);
    setScreenState('playing');
    engineRef.current?.setScreenState('playing');
  }, []);

  // Global keyboard shortcuts (Enter/Space on Title, Esc/P Pause, M Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (screenState === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !activeModal) {
          e.preventDefault();
          handleStartGame();
        } else if (e.code === 'Escape' && activeModal) {
          setActiveModal(null);
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (activeModal) {
          setActiveModal(null);
        } else if (!pendingCatch) {
          setScreenState((s) => (s === 'paused' ? 'playing' : 'paused'));
        }
      } else if (e.code === 'KeyP' && !activeModal && !pendingCatch) {
        e.preventDefault();
        setScreenState((s) => (s === 'paused' ? 'playing' : 'paused'));
      } else if (e.code === 'KeyM' && !e.repeat) {
        setSave((prev) => updateSettings(prev, { muted: !prev.settings.muted }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenState, activeModal, pendingCatch, handleStartGame]);

  // Catch decision handler
  const handleCatchDecision = useCallback(
    (destination: 'bag' | 'aquarium' | 'release') => {
      if (!pendingCatch) return;
      const res = recordFishCatch(saveRef.current, pendingCatch, destination);
      setSave(res.save);
      setPendingCatch(null);
      if (res.leveledUp) {
        showToast(`Level Up! You reached Angler Level ${res.save.level}!`);
      } else if (res.newlyUnlocked.length > 0) {
        showToast('Achievement Unlocked! Cash bonus added.');
      } else if (destination === 'aquarium') {
        showToast('Fish added to your Living Aquarium!');
      } else if (destination === 'release') {
        showToast(`Released fish for +${Math.round(pendingCatch.xp * 1.4)} XP!`);
      }
    },
    [pendingCatch, showToast],
  );

  // Market & Shop Handlers
  const handleSellFish = useCallback(
    (uid: string) => {
      const res = sellFishFromBag(saveRef.current, uid);
      if (res.earned > 0) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast(`Sold fish for $${res.earned}`);
      }
    },
    [showToast],
  );

  const handleSellAllFish = useCallback(() => {
    const res = sellAllFishInBag(saveRef.current);
    if (res.earned > 0) {
      setSave(res.save);
      engineRef.current?.audio.playCoinChime();
      showToast(`Sold ${res.count} fish for $${res.earned.toLocaleString()}!`);
    }
  }, [showToast]);

  const handleBuyOrEquipGear = useCallback(
    (category: GearCategory, id: string) => {
      const res = buyOrEquipGear(saveRef.current, category, id);
      if (res.ok) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
      } else if (res.reason) {
        showToast(res.reason);
      }
    },
    [showToast],
  );

  const handleBuyBait = useCallback(
    (baitId: string) => {
      const res = buyBaitPack(saveRef.current, baitId);
      if (res.ok) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast('Bait added and equipped!');
      } else if (res.reason) {
        showToast(res.reason);
      }
    },
    [showToast],
  );

  const handleBuyOrEquipBoat = useCallback(
    (boatId: BoatId) => {
      const res = buyOrEquipBoat(saveRef.current, boatId);
      if (res.ok) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast('Boat ready at the dock!');
      } else if (res.reason) {
        showToast(res.reason);
      }
    },
    [showToast],
  );

  const handleUpgradeBoat = useCallback(
    (boatId: BoatId, stat: 'engineLevel' | 'hullLevel' | 'sonarLevel') => {
      const res = upgradeBoatStat(saveRef.current, boatId, stat);
      if (res.ok) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast('Boat upgraded!');
      } else if (res.reason) {
        showToast(res.reason);
      }
    },
    [showToast],
  );

  const handleSetBoatColor = useCallback((boatId: BoatId, hex: string) => {
    setSave((prev) => setBoatHullColor(prev, boatId, hex));
  }, []);

  const handleMoveToAquarium = useCallback(
    (uid: string) => {
      setSave((prev) => moveFishFromBagToAquarium(prev, uid));
      showToast('Moved fish to Aquarium');
    },
    [showToast],
  );

  const handleSellFromAquarium = useCallback(
    (uid: string) => {
      const res = sellFishFromAquarium(saveRef.current, uid);
      if (res.earned > 0) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast(`Sold aquarium fish for $${res.earned}`);
      }
    },
    [showToast],
  );

  const handleClaimMission = useCallback(
    (missionId: string) => {
      const res = claimMissionReward(saveRef.current, missionId);
      if (res.ok) {
        setSave(res.save);
        engineRef.current?.audio.playCoinChime();
        showToast('Mission reward claimed!');
      }
    },
    [showToast],
  );

  const handleClaimDaily = useCallback(() => {
    const res = claimDailyReward(saveRef.current);
    if (res.ok) {
      setSave(res.save);
      engineRef.current?.audio.playCoinChime();
      showToast(`Daily Reward Claimed: ${res.rewardLabel}`);
    }
  }, [showToast]);

  const handleSelectLocation = useCallback(
    (locationId: LocationId) => {
      setSave((prev) => updateWorldEnvironment(prev, { locationId }));
      showToast('Arrived at new fishing grounds!');
    },
    [showToast],
  );

  const handleSelectWeather = useCallback((weather: WeatherType) => {
    setSave((prev) => updateWorldEnvironment(prev, { weather }));
  }, []);

  const handleSelectTimeOfDay = useCallback((timeOfDay: number) => {
    setSave((prev) => updateWorldEnvironment(prev, { timeOfDay }));
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSave((prev) => updateSettings(prev, patch));
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = createInitialSave();
    setSave(fresh);
    persistSaveToStorage(fresh);
    showToast('Progress reset to a fresh angler profile');
  }, [showToast]);

  const showTouchControls =
    save.settings.touchControlsMode === 'always' ||
    (save.settings.touchControlsMode === 'auto' && isNarrowOrTouch);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#06131f]">
      {/* Dedicated Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        className="fixed inset-0 w-full h-full"
      />

      {/* Title Screen Overlay */}
      {screenState === 'title' && (
        <TitleScreen
          save={save}
          onStartGame={handleStartGame}
          onOpenSettings={() => setActiveModal('settings')}
          onOpenDaily={() => setActiveModal('daily')}
        />
      )}

      {/* Active Gameplay HUD */}
      {screenState === 'playing' && !activeModal && !pendingCatch && (
        <GameHud
          save={save}
          hud={hud}
          showTouchControls={showTouchControls}
          onOpenModal={(m) => setActiveModal(m)}
          onTogglePause={() => setScreenState('paused')}
          onToggleMute={() => setSave((prev) => updateSettings(prev, { muted: !prev.settings.muted }))}
          onCycleCamera={() => engineRef.current?.cycleCameraMode()}
          onToggleUnderwater={() => engineRef.current?.toggleUnderwaterCamera()}
          onToggleBoat={() => engineRef.current?.toggleBoatBoarding()}
          onActionDown={() => engineRef.current?.triggerActionDown()}
          onActionUp={() => engineRef.current?.triggerActionUp()}
          onCancelCast={() => engineRef.current?.cancelFishing()}
          onJoystickMove={(x, y) => engineRef.current?.setTouchJoystick(x, y)}
        />
      )}

      {/* Catch Result Modal */}
      {pendingCatch && (
        <CatchModal
          fish={pendingCatch}
          aquariumCount={save.aquarium.length}
          isNewRecord={
            pendingCatch.weightKg > (save.stats.speciesBestWeight[pendingCatch.speciesId] ?? 0)
          }
          onDecision={handleCatchDecision}
        />
      )}

      {/* Pause Overlay */}
      {screenState === 'paused' && !activeModal && (
        <PauseModal
          save={save}
          onResume={() => setScreenState('playing')}
          onOpenInventory={() => setActiveModal('inventory')}
          onOpenSettings={() => setActiveModal('settings')}
          onReturnTitle={() => {
            setActiveModal(null);
            setScreenState('title');
          }}
        />
      )}

      {/* Feature Modals */}
      {activeModal === 'shop' && (
        <ShopModal
          save={save}
          onClose={() => setActiveModal(null)}
          onSellFish={handleSellFish}
          onSellAllFish={handleSellAllFish}
          onBuyOrEquipGear={handleBuyOrEquipGear}
          onBuyBait={handleBuyBait}
          onBuyOrEquipBoat={handleBuyOrEquipBoat}
          onUpgradeBoat={handleUpgradeBoat}
          onSetBoatColor={handleSetBoatColor}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryModal
          save={save}
          onClose={() => setActiveModal(null)}
          onEquipGear={handleBuyOrEquipGear}
          onSelectBait={(baitId) => setSave((prev) => ({ ...prev, equippedBaitId: baitId }))}
          onSelectBoat={(boatId) => setSave((prev) => ({ ...prev, equippedBoatId: boatId }))}
          onMoveToAquarium={handleMoveToAquarium}
          onSellFish={handleSellFish}
        />
      )}

      {activeModal === 'aquarium' && (
        <AquariumModal
          save={save}
          onClose={() => setActiveModal(null)}
          onSellFromAquarium={handleSellFromAquarium}
        />
      )}

      {(activeModal === 'missions' || activeModal === 'daily') && (
        <MissionsModal
          save={save}
          initialTab={activeModal === 'daily' ? 'daily' : 'missions'}
          onClose={() => setActiveModal(null)}
          onClaimMission={handleClaimMission}
          onClaimDaily={handleClaimDaily}
        />
      )}

      {activeModal === 'world' && (
        <WorldModal
          save={save}
          onClose={() => setActiveModal(null)}
          onSelectLocation={handleSelectLocation}
          onSelectWeather={handleSelectWeather}
          onSelectTimeOfDay={handleSelectTimeOfDay}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={save.settings}
          onClose={() => setActiveModal(null)}
          onUpdateSettings={handleUpdateSettings}
          onResetSave={handleResetSave}
        />
      )}

      {/* Non-intrusive Feedback Toast */}
      {toast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg border border-amber-400/50 text-xs sm:text-sm font-semibold text-amber-200 shadow-xl pointer-events-none"
          style={{ backgroundColor: 'rgba(8, 24, 39, 0.94)' }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
