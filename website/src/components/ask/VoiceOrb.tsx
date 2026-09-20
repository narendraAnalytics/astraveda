"use client";

import { Mic, PhoneCall, CheckCircle2, PhoneMissed, CalendarClock } from "lucide-react";
import { useReducedMotion } from "framer-motion";

export type OrbState = "idle" | "calling" | "booked" | "done" | "missed";

const TONE: Record<OrbState, { core: string; glow: string; ring: string; bar: string }> = {
  idle: { core: "#2A1650", glow: "rgba(244,210,138,.55)", ring: "rgba(244,210,138,.4)", bar: "#F4D28A" },
  calling: { core: "#1d3d2c", glow: "rgba(74,222,128,.55)", ring: "rgba(74,222,128,.5)", bar: "#86efac" },
  booked: { core: "#2A1650", glow: "rgba(196,181,253,.55)", ring: "rgba(196,181,253,.45)", bar: "#c4b5fd" },
  done: { core: "#1d3d2c", glow: "rgba(74,222,128,.4)", ring: "rgba(74,222,128,.35)", bar: "#86efac" },
  missed: { core: "#4a1d1d", glow: "rgba(248,113,113,.45)", ring: "rgba(248,113,113,.4)", bar: "#fca5a5" },
};

const BARS = 28;

// The 2026 "voice orb": a rotating conic glow, pulsing ripples and a ring of
// waveform bars that breathe around a centre glyph. `calling` speeds everything
// up and turns it live-green; `missed`/`done` settle it. Pure CSS keyframes and
// integer angles — no trig at render, so no hydration mismatch.
export default function VoiceOrb({ state = "idle", size = 176 }: { state?: OrbState; size?: number }) {
  const reduce = useReducedMotion();
  const t = TONE[state];
  const live = state === "calling";
  const radius = Math.round(size * 0.365);
  const Icon = state === "calling" ? PhoneCall : state === "done" ? CheckCircle2 : state === "missed" ? PhoneMissed : state === "booked" ? CalendarClock : Mic;

  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
      <style>{`
        @keyframes av-ask-spin { to { transform: rotate(360deg); } }
        @keyframes av-ask-ripple { 0% { transform: scale(.82); opacity: .75; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes av-ask-bar { 0%,100% { height: 5px; opacity:.45; } 50% { height: var(--h); opacity: 1; } }
        @keyframes av-ask-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes av-ask-ring { 0%,100% { transform: rotate(0); } 10%,30%,50% { transform: rotate(-16deg); } 20%,40%,60% { transform: rotate(16deg); } 70% { transform: rotate(0); } }
        @media (prefers-reduced-motion: reduce) { .av-ask-anim { animation: none !important; } }
      `}</style>

      {/* rotating conic glow */}
      <span
        aria-hidden
        className="av-ask-anim absolute inset-0 rounded-full opacity-80"
        style={{
          background: `conic-gradient(from 0deg, ${t.glow}, transparent 25%, transparent 50%, rgba(167,43,230,.5) 65%, transparent 85%, ${t.glow})`,
          filter: "blur(8px)",
          animation: reduce ? undefined : `av-ask-spin ${live ? 3.5 : 9}s linear infinite`,
        }}
      />
      <span aria-hidden className="absolute rounded-full" style={{ inset: size * 0.05, background: t.core }} />

      {/* ripples */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="av-ask-anim absolute inset-0 rounded-full border"
          style={{
            borderColor: t.ring,
            animation: reduce ? undefined : `av-ask-ripple ${live ? 1.9 : 3.4}s ease-out ${i * (live ? 0.6 : 1.1)}s infinite`,
          }}
        />
      ))}

      {/* waveform ring */}
      <div aria-hidden className="absolute inset-0">
        {Array.from({ length: BARS }, (_, i) => {
          const h = 10 + ((i * 7) % 5) * 4 + (live ? 6 : 0);
          return (
            <span
              key={i}
              className="av-ask-anim absolute left-1/2 top-1/2 w-[3px] rounded-full"
              style={{
                background: t.bar,
                height: 5,
                marginLeft: -1.5,
                transform: `rotate(${Math.round((360 / BARS) * i * 100) / 100}deg) translateY(-${radius}px)`,
                transformOrigin: "50% 0",
                ["--h" as string]: `${h}px`,
                animation: reduce ? undefined : `av-ask-bar ${live ? 0.7 : 1.5}s ease-in-out ${((i * 53) % 10) / 10 * 1.2}s infinite`,
              }}
            />
          );
        })}
      </div>

      <span
        className="av-ask-anim relative flex items-center justify-center rounded-full border"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: "rgba(255,255,255,.08)",
          borderColor: t.ring,
          color: t.bar,
          boxShadow: `0 0 ${live ? 34 : 20}px ${t.glow}`,
          animation: reduce ? undefined : `av-ask-breathe ${live ? 1.2 : 3.2}s ease-in-out infinite`,
        }}
      >
        <Icon
          size={Math.round(size * 0.17)}
          strokeWidth={1.8}
          className="av-ask-anim"
          style={live && !reduce ? { animation: "av-ask-ring 1.6s ease-in-out infinite" } : undefined}
        />
      </span>
    </div>
  );
}
