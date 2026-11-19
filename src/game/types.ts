export type GameScreenState = 'title' | 'playing' | 'paused';

export type LocationId = 'emerald_cove' | 'misty_lake' | 'salmon_river' | 'blue_abyss';
export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy';
export type CameraMode = 'third_person' | 'first_person' | 'underwater';
export type BoatId = 'small_skiff' | 'speed_boat' | 'luxury_yacht';
export type FishRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type FishingPhase =
  | 'idle'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'fighting'
  | 'caught'
  | 'escaped';

export interface FishSpecies {
  id: string;
  name: string;
  scientificName: string;
  rarity: FishRarity;
  locations: LocationId[];
  preferredBaits: string[];
  minWeightKg: number;
  maxWeightKg: number;
  minLengthCm: number;
  maxLengthCm: number;
  minDepthM: number;
  maxDepthM: number;
  difficulty: number; // 1 to 10
  baseValue: number; // $ per kg base
  xpReward: number;
  bodyColor: string;
  bellyColor: string;
  finColor: string;
  accentColor: string;
  bodyShape: 'slim' | 'classic' | 'deep' | 'shark' | 'marlin' | 'catfish';
  description: string;
}

export interface CaughtFish {
  uid: string;
  speciesId: string;
  weightKg: number;
  lengthCm: number;
  value: number;
  xp: number;
  rarity: FishRarity;
  locationId: LocationId;
  caughtAt: number;
  isRecord?: boolean;
}

export interface RodItem {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  castRangeM: number;
  tensionControl: number; // reduces tension spike rate (0.8 - 1.5)
  maxFishKg: number;
  rodColor: string;
  description: string;
}

export interface ReelItem {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  reelSpeed: number; // m/s pull base
  dragStrength: number; // tension mitigation
  description: string;
}

export interface LineItem {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  maxTensionKg: number;
  lengthM: number;
  color: string;
  description: string;
}

export interface HookItem {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  biteBonus: number; // multiplier 1.0 - 1.45
  hookSetWindowSec: number;
  description: string;
}

export interface BaitItem {
  id: string;
  name: string;
  price: number;
  packSize: number;
  attractRadiusM: number;
  rarityBoost: number;
  color: string;
  description: string;
}

export interface BoatSpec {
  id: BoatId;
  name: string;
  price: number;
  unlockLevel: number;
  maxSpeed: number;
  turnRate: number;
  stability: number;
  lengthM: number;
  beamM: number;
  defaultColor: string;
  description: string;
}

export interface BoatUpgrades {
  engineLevel: number; // 1..4
  hullLevel: number; // 1..4
  sonarLevel: number; // 1..4
  hullColor: string;
}

export interface LocationSpec {
  id: LocationId;
  name: string;
  subtitle: string;
  waterType: 'Ocean Bay' | 'Alpine Lake' | 'Mountain River' | 'Open Ocean';
  unlockLevel: number;
  shallowColor: string;
  deepColor: string;
  fogDayColor: string;
  baseWaveAmp: number;
  description: string;
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  targetType: 'catch_count' | 'catch_weight' | 'catch_species' | 'earn_money' | 'location_catch';
  targetValue: number;
  targetSpeciesId?: string;
  targetLocationId?: LocationId;
  rewardMoney: number;
  rewardXp: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardMoney: number;
  check: (stats: PlayerStats, save: PlayerSave) => boolean;
}

export interface PlayerStats {
  totalCaught: number;
  totalEarned: number;
  heaviestCatchKg: number;
  heaviestSpeciesId: string | null;
  speciesCaughtCounts: Record<string, number>;
  speciesBestWeight: Record<string, number>;
  locationCatches: Record<LocationId, number>;
}

export interface GameSettings {
  masterVolume: number; // 0..1
  muted: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  cameraSensitivity: number; // 0.5..2.0
  touchControlsMode: 'auto' | 'always' | 'off';
  timeCycleSpeed: number; // 0 (paused), 1 (normal), 3 (fast)
}

export interface PlayerSave {
  version: number;
  money: number;
  level: number;
  xp: number;
  locationId: LocationId;
  weather: WeatherType;
  timeOfDay: number; // 0..24 hours
  equippedRodId: string;
  equippedReelId: string;
  equippedLineId: string;
  equippedHookId: string;
  equippedBaitId: string;
  equippedBoatId: BoatId;
  ownedRodIds: string[];
  ownedReelIds: string[];
  ownedLineIds: string[];
  ownedHookIds: string[];
  ownedBoatIds: BoatId[];
  baitCounts: Record<string, number>;
  boatUpgrades: Record<BoatId, BoatUpgrades>;
  fishBag: CaughtFish[];
  aquarium: CaughtFish[];
  claimedMissions: string[];
  unlockedAchievements: string[];
  dailyStreak: number;
  lastDailyClaimDate: string | null; // YYYY-MM-DD
  stats: PlayerStats;
  settings: GameSettings;
}

export interface SonarBlip {
  x: number; // -1..1 relative
  z: number; // -1..1 relative
  depth: number;
  size: number;
  speciesId: string;
}

export interface HudSnapshot {
  mode: 'foot' | 'boat';
  canBoardBoat: boolean;
  canExitBoat: boolean;
  boatSpeedKnots: number;
  headingDeg: number;
  waterDepthM: number;
  cameraMode: CameraMode;
  fishingPhase: FishingPhase;
  castPower: number; // 0..1
  lineDistanceM: number;
  maxLineDistanceM: number;
  tension: number; // 0..1
  fishStamina: number; // 0..1
  fishSurging: boolean;
  hookedFishName: string | null;
  hookedFishWeightEstimate: string | null;
  biteTimerRatio: number; // 0..1
  timeOfDay: number;
  weather: WeatherType;
  nearbyFishCount: number;
  sonarBlips: SonarBlip[];
  statusMessage: string | null;
}

export interface FightState {
  species: FishSpecies;
  weightKg: number;
  lengthCm: number;
  distanceM: number;
  maxDistanceM: number;
  tension: number; // 0..1
  fishStamina: number; // 0..1
  surgeTimer: number;
  isSurging: boolean;
  slackTimer: number;
  pullDirection: number; // -1..1 lateral swim
  jumpCooldown: number;
  isJumping: boolean;
  jumpProgress: number;
}
