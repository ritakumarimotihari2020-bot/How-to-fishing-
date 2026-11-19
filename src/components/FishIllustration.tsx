import React from 'react';
import { FishSpecies } from '../game/types';

interface FishIllustrationProps {
  species: FishSpecies;
  className?: string;
}

export const FishIllustration: React.FC<FishIllustrationProps> = ({ species, className = 'w-28 h-16' }) => {
  const isShark = species.bodyShape === 'shark';
  const isMarlin = species.bodyShape === 'marlin';
  const isDeep = species.bodyShape === 'deep';
  const isCatfish = species.bodyShape === 'catfish';

  return (
    <svg viewBox="0 0 160 80" className={className} aria-hidden="true">
      {/* Caudal tail fin */}
      <path
        d={
          isShark
            ? 'M 36 40 L 8 14 L 22 40 L 12 60 Z'
            : 'M 38 40 L 10 18 L 24 40 L 10 62 Z'
        }
        fill={species.finColor}
        stroke="#08131d"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Dorsal fin */}
      <path
        d={
          isShark
            ? 'M 72 24 L 86 6 L 98 25 Z'
            : isMarlin
              ? 'M 54 27 Q 76 6 106 24 L 96 32 L 54 32 Z'
              : 'M 56 26 Q 78 10 100 26 Z'
        }
        fill={species.finColor}
        stroke="#08131d"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Ventral fin */}
      <path
        d="M 62 52 L 50 64 L 74 56 Z"
        fill={species.finColor}
        stroke="#08131d"
        strokeWidth="1.8"
      />

      {/* Marlin Spear Bill */}
      {isMarlin && (
        <path
          d="M 124 38 L 156 36 L 124 43 Z"
          fill={species.accentColor}
          stroke="#08131d"
          strokeWidth="1.5"
        />
      )}

      {/* Primary Body */}
      <path
        d={
          isDeep
            ? 'M 32 40 Q 74 10 128 38 Q 134 40 128 44 Q 74 72 32 40 Z'
            : isShark
              ? 'M 28 40 Q 76 18 134 39 Q 128 50 96 54 Q 62 54 28 40 Z'
              : 'M 30 40 Q 74 16 128 39 Q 132 41 126 44 Q 74 64 30 40 Z'
        }
        fill={species.bodyColor}
        stroke="#08131d"
        strokeWidth="2.2"
      />

      {/* Counter-shaded Belly */}
      <path
        d={
          isDeep
            ? 'M 42 45 Q 80 64 122 44 Q 82 50 42 45 Z'
            : 'M 40 44 Q 78 58 122 44 Q 80 48 40 44 Z'
        }
        fill={species.bellyColor}
        opacity="0.88"
      />

      {/* Lateral Accent Stripe */}
      <path
        d="M 46 39 Q 84 35 116 39"
        fill="none"
        stroke={species.accentColor}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Pectoral Fin */}
      <path
        d="M 90 44 L 74 58 L 100 49 Z"
        fill={species.finColor}
        stroke="#08131d"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Catfish Barbels */}
      {isCatfish && (
        <g stroke={species.finColor} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M 124 43 Q 136 48 144 55" />
          <path d="M 122 45 Q 132 54 136 62" />
        </g>
      )}

      {/* Gill Line & Eye */}
      <path
        d="M 106 33 Q 102 41 106 49"
        fill="none"
        stroke="#08131d"
        strokeWidth="1.6"
        opacity="0.6"
      />
      <circle cx="116" cy="36" r="4" fill="#f8fafc" stroke="#08131d" strokeWidth="1.5" />
      <circle cx="117" cy="36" r="2.1" fill="#091119" />
      <circle cx="117.8" cy="35.1" r="0.8" fill="#ffffff" />
    </svg>
  );
};
