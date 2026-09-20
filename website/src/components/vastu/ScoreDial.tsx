"use client";

import { useEffect, useState } from "react";
import { scoreBand } from "@/lib/vastu";

const SIZE = 184;
const STROKE = 13;
const R = SIZE / 2 - STROKE;
const C = Math.round(2 * Math.PI * R * 100) / 100;

// Circular 0–100 gauge. The arc sweeps in via a CSS stroke-dashoffset transition
// after mount; the number counts up alongside it. Band colour = green/amber/red.
export default function ScoreDial({ score, verdict }: { score: number; verdict: string }) {
  const [shown, setShown] = useState(0);
  const band = scoreBand(score);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(score);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#efe3d3" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={band.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - shown / 100)}
            style={{ filter: `drop-shadow(0 0 6px ${band.color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[46px] font-black leading-none tracking-tight" style={{ color: band.color }}>
            {shown}
          </span>
          <span className="text-[11px] font-bold tracking-[.06em] text-[#a2896f] uppercase mt-1">Vastu score</span>
        </div>
      </div>
      <span
        className="mt-4 text-[11px] font-extrabold tracking-[.06em] uppercase rounded-full px-3 py-1 text-white"
        style={{ background: band.color }}
      >
        {band.label}
      </span>
      {verdict && <p className="text-[13.5px] leading-[1.6] text-[#5a4636] text-center mt-3 max-w-[300px]">{verdict}</p>}
    </div>
  );
}
