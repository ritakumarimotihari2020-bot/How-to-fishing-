import React from 'react';
import { X, MapPin, Sun, Cloud, CloudRain, CloudLightning } from 'lucide-react';
import { FISH_SPECIES, LOCATIONS } from '../game/catalog';
import { LocationId, PlayerSave, WeatherType } from '../game/types';

interface WorldModalProps {
  save: PlayerSave;
  onClose: () => void;
  onSelectLocation: (locId: LocationId) => void;
  onSelectWeather: (weather: WeatherType) => void;
  onSelectTimeOfDay: (hour: number) => void;
}

const WEATHERS: Array<{ id: WeatherType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'sunny', label: 'Sunny', icon: Sun },
  { id: 'cloudy', label: 'Cloudy', icon: Cloud },
  { id: 'rainy', label: 'Rainy', icon: CloudRain },
  { id: 'stormy', label: 'Stormy', icon: CloudLightning },
];

const TIME_PRESETS = [
  { label: 'Dawn (6:30)', hour: 6.5 },
  { label: 'Midday (12:00)', hour: 12.0 },
  { label: 'Sunset (18:15)', hour: 18.25 },
  { label: 'Night (22:30)', hour: 22.5 },
];

export const WorldModal: React.FC<WorldModalProps> = ({
  save,
  onClose,
  onSelectLocation,
  onSelectWeather,
  onSelectTimeOfDay,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(3, 12, 22, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Fishing Locations and Weather"
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-xl border border-sky-300/25 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#081827' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-300/15">
          <div>
            <h2 className="font-display text-xl font-bold text-white">World Map, Weather &amp; Time</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Travel across oceans, rivers, and alpine lakes or adjust live weather conditions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close World Map"
            className="w-9 h-9 rounded-lg bg-[#10293e] hover:bg-[#193b57] text-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto marine-scroll flex-1 space-y-6">
          {/* Fishing Locations */}
          <div>
            <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2.5">Fishing Destinations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LOCATIONS.map((loc) => {
                const active = save.locationId === loc.id;
                const locked = save.level < loc.unlockLevel;
                const localFish = FISH_SPECIES.filter((f) => f.locations.includes(loc.id))
                  .slice(0, 4)
                  .map((f) => f.name)
                  .join(', ');

                return (
                  <div
                    key={loc.id}
                    className={`rounded-lg p-4 border ${
                      active ? 'border-amber-400 bg-[#112c43]' : 'border-sky-300/15 bg-[#0c2134]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="flex items-center gap-1.5 font-display font-bold text-base text-white">
                          <MapPin className="w-4 h-4 text-teal-400" />
                          {loc.name}
                        </div>
                        <div className="text-xs text-sky-200/80">
                          {loc.subtitle} · {loc.waterType}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 mb-2.5">{loc.description}</p>
                    <div className="text-[11px] text-slate-300 mb-3">
                      <span className="text-slate-400">Notable fish:</span> {localFish}
                    </div>
                    <button
                      type="button"
                      disabled={active || locked}
                      onClick={() => {
                        onSelectLocation(loc.id);
                        onClose();
                      }}
                      className={`w-full py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        active
                          ? 'bg-slate-800 text-amber-300'
                          : locked
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {active ? 'Current Location' : locked ? `Unlocks at Level ${loc.unlockLevel}` : 'Travel Here'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Weather Selector */}
          <div>
            <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2">Weather Conditions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEATHERS.map((w) => {
                const Icon = w.icon;
                const active = save.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectWeather(w.id)}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-[#14334d] text-amber-300'
                        : 'border-sky-300/15 bg-[#0c2134] text-slate-200 hover:border-sky-300/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day Presets */}
          <div>
            <h3 className="text-xs font-bold text-sky-300 tracking-wide mb-2">Time of Day</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_PRESETS.map((tp) => (
                <button
                  key={tp.label}
                  type="button"
                  onClick={() => onSelectTimeOfDay(tp.hour)}
                  className="py-2.5 px-3 rounded-lg border border-sky-300/15 bg-[#0c2134] hover:border-amber-400/60 hover:bg-[#133049] text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  {tp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
