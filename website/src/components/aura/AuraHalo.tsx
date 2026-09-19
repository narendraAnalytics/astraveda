"use client";

import { useReducedMotion } from "framer-motion";

// The "aura portrait" — a layered radial glow in the detected aura colours
// behind a circular selfie. Pure SVG + a slow CSS breathing pulse, ported
// from the mobile app's aura-halo.tsx (Reanimated -> CSS keyframes).
export default function AuraHalo({
  photoUrl,
  colors,
  size = 260,
}: {
  photoUrl: string | null;
  colors: string[]; // hex, dominant first
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const palette = colors.length ? colors : ["#8b45d6"];
  const photo = size * 0.62;
  const c = size / 2;

  return (
    <div style={{ width: size, height: size, position: "relative" }} className="flex items-center justify-center">
      <style>{`
        @keyframes av-aura-pulse {
          0%, 100% { transform: scale(1); opacity: 0.82; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={reduceMotion ? undefined : { animation: "av-aura-pulse 3.4s ease-in-out infinite" }}
      >
        <svg width={size} height={size}>
          <defs>
            {palette.map((hex, i) => (
              <radialGradient key={i} id={`aura-g${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor={hex} stopOpacity="0" />
                <stop offset="0.5" stopColor={hex} stopOpacity={i === 0 ? 0.5 : 0.34} />
                <stop offset="1" stopColor={hex} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {palette.map((_, i) => (
            <circle
              key={i}
              cx={c + (i === 1 ? -size * 0.08 : i === 2 ? size * 0.08 : 0)}
              cy={c + (i === 2 ? size * 0.06 : 0)}
              r={c - i * (size * 0.06)}
              fill={`url(#aura-g${i})`}
            />
          ))}
        </svg>
      </div>

      <div
        className="relative overflow-hidden rounded-full border-[3px] border-white/90"
        style={{ width: photo, height: photo }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: `${palette[0]}33` }} />
        )}
      </div>
    </div>
  );
}
