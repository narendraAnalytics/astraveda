"use client";

// Naivedya offering — a three-beat choreography at the deity's feet:
//   1. Each offering drops in one after another (arc + bounce + a sparkle on landing)
//   2. The row glides together toward the centre with a warm flash
//   3. The finished plate blooms in — overshoot, light shimmer sweep, ring pulse,
//      twinkling sparkles — then rests with a slow float.
// Timings are absolute (seconds from mount) so every item converges together.

import { motion, useReducedMotion } from "framer-motion";

const IMG = "https://res.cloudinary.com/dkqbzwicr/image/upload/w_220,f_auto,q_auto";
export const NAIVEDYA_ITEMS = [
  { id: "apple", src: `${IMG}/v1789965517/applenivedaya_nt817k.png` },
  { id: "banana", src: `${IMG}/v1789965517/bannanivedya_alhwjq.png` },
  { id: "coconut", src: "/naivedya/coconut.webp" }, // background-removed (original had a baked-in checkerboard)
  { id: "grapes", src: "/naivedya/grapes.webp" }, // background-removed (original had a baked-in checkerboard)
  { id: "honey", src: `${IMG}/v1789965516/honeynivedya_h8awty.png` },
];
// Background-removed copy of the "all in plate" photo (the original has a baked-in checkerboard).
export const NAIVEDYA_PLATE = "/naivedya/plate.webp";

const N = NAIVEDYA_ITEMS.length;
const STEP = 0.4; // gap between offerings landing
const LAND = 0.55; // how long one offering takes to land
const HOLD = (N - 1) * STEP + 0.95; // row complete, admired
const MERGE = 0.55; // glide-together duration
const CONVERGED = HOLD + MERGE; // moment everything meets
const TOTAL = CONVERGED + 0.4;

/** When (ms) each offering lands + when it all merges — used to time the chimes. */
export const NAIVEDYA_CHIME_MS = NAIVEDYA_ITEMS.map((_, i) => Math.round((i * STEP + 0.32) * 1000));
export const NAIVEDYA_MERGE_MS = Math.round(CONVERGED * 1000);

const ITEM_W = "clamp(26px, calc(var(--u) * .17), 58px)";
const PLATE_W = "clamp(92px, calc(var(--u) * .52), 200px)";

const Star = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 0l2.2 9.8L24 12l-9.8 2.2L12 24l-2.2-9.8L0 12l9.8-2.2z" fill="#fff3c4" />
  </svg>
);

// Fixed positions (% of plate box) so the twinkles are stable and hydration-safe.
const TWINKLES: [number, number, number][] = [
  [6, 18, 0],
  [94, 24, 0.5],
  [14, 92, 1.1],
  [88, 88, 0.3],
  [50, -8, 0.8],
  [-6, 56, 1.4],
  [106, 58, 0.15],
];

export default function Naivedya() {
  const reduced = !!useReducedMotion();

  const plate = (
    <div className="relative" style={{ width: PLATE_W }}>
      <motion.div
        animate={reduced ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: CONVERGED + 0.8 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NAIVEDYA_PLATE}
          alt="Naivedya offering"
          draggable={false}
          className="block w-full h-auto drop-shadow-[0_10px_16px_rgba(0,0,0,.6)]"
        />
        {/* light sweep, clipped to the plate's own silhouette */}
        {!reduced && (
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              WebkitMaskImage: `url(${NAIVEDYA_PLATE})`,
              maskImage: `url(${NAIVEDYA_PLATE})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              background:
                "linear-gradient(105deg, transparent 38%, rgba(255,255,255,.8) 50%, transparent 62%) no-repeat",
              backgroundSize: "260% 100%",
            }}
            initial={{ backgroundPositionX: "130%" }}
            animate={{ backgroundPositionX: ["130%", "-30%"] }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: CONVERGED + 0.15, repeat: Infinity, repeatDelay: 5.5 }}
          />
        )}
      </motion.div>
      {!reduced &&
        TWINKLES.map(([x, y, d], i) => (
          <motion.span
            key={i}
            className="absolute block h-[clamp(8px,calc(var(--u)*.05),16px)] w-[clamp(8px,calc(var(--u)*.05),16px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_6px_rgba(255,214,120,.95)]"
            style={{ left: `${x}%`, top: `${y}%` }}
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: 90 }}
            transition={{ duration: 1.6, delay: CONVERGED + 0.2 + d, repeat: Infinity, repeatDelay: 1.6 }}
          >
            <Star className="h-full w-full" />
          </motion.span>
        ))}
    </div>
  );

  if (reduced) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        {plate}
      </motion.div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* warm pool of light under everything */}
      <motion.div
        aria-hidden
        className="absolute -inset-x-10 -inset-y-5 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,214,120,.5), transparent)" }}
        animate={{ opacity: [0.35, 0.9, 0.5, 1, 0.6] }}
        transition={{ duration: TOTAL, times: [0, 0.3, 0.6, CONVERGED / TOTAL, 1] }}
      />

      {/* Beat 1 + 2: the row (drop in one by one → glide together) */}
      <div className="relative flex items-end gap-[clamp(2px,calc(var(--u)*.02),8px)]">
        {NAIVEDYA_ITEMS.map((it, i) => {
          const delay = i * STEP;
          const d = TOTAL - delay;
          const t = (abs: number) => (abs - delay) / d;
          const shift = `${-(i - (N - 1) / 2) * 104}%`;
          return (
            <motion.div
              key={it.id}
              className="relative"
              style={{ width: ITEM_W }}
              initial={{ opacity: 0, y: -46, x: "0%", scale: 0.3, rotate: i % 2 ? 14 : -14 }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                y: [-46, 0, 0, -4, -8],
                x: ["0%", "0%", "0%", shift, shift],
                scale: [0.3, 1, 1, 0.78, 0.55],
                rotate: [i % 2 ? 14 : -14, 0, 0, 0, 0],
              }}
              transition={{
                delay,
                duration: d,
                times: [0, t(delay + LAND), t(HOLD), t(CONVERGED), 1],
                ease: ["backOut", "linear", "easeInOut", "easeIn"],
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.src}
                alt={it.id}
                draggable={false}
                className="block h-auto w-full drop-shadow-[0_5px_8px_rgba(0,0,0,.55)]"
              />
              {/* landing sparkle */}
              <motion.span
                aria-hidden
                className="absolute -bottom-1 left-1/2 block h-[70%] w-[70%] -translate-x-1/2 drop-shadow-[0_0_8px_rgba(255,214,120,.95)]"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.25, 0], opacity: [0, 1, 0], rotate: 60 }}
                transition={{ delay: delay + LAND * 0.75, duration: 0.55, ease: "easeOut" }}
              >
                <Star className="h-full w-full" />
              </motion.span>
            </motion.div>
          );
        })}
      </div>

      {/* gold tray line under the row, dissolving as the row merges */}
      <motion.div
        aria-hidden
        className="mt-[2px] h-[clamp(5px,calc(var(--u)*.04),12px)] rounded-[50%]"
        style={{
          width: "112%",
          background: "linear-gradient(#ffe9a8,#c58a22 60%,#8f6316)",
          boxShadow: "0 6px 14px rgba(0,0,0,.55)",
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 1, 0.3], opacity: [1, 1, 1, 0] }}
        transition={{ duration: TOTAL, times: [0, 0.14, CONVERGED / TOTAL, 1] }}
      />

      {/* merge flash + ring pulse at the meeting point */}
      <motion.span
        aria-hidden
        className="absolute bottom-[10%] left-1/2 block h-[150%] w-[150%] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,240,190,.95), rgba(255,200,90,.3) 45%, transparent 70%)" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0.2, 1.1, 1.5], opacity: [0, 0.95, 0] }}
        transition={{ delay: CONVERGED - 0.1, duration: 0.7, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="absolute bottom-[8%] left-1/2 block aspect-square w-[70%] -translate-x-1/2 rounded-full border-2 border-[#ffd67a]"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2.4], opacity: [0.9, 0] }}
        transition={{ delay: CONVERGED, duration: 1.1, ease: "easeOut" }}
      />

      {/* Beat 3: the plate blooms in */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, scale: 0.4, y: 16 }}
        animate={{ opacity: [0, 1, 1], scale: [0.4, 1.09, 1], y: [16, -4, 0] }}
        transition={{ delay: CONVERGED - 0.05, duration: 0.85, times: [0, 0.6, 1], ease: "easeOut" }}
      >
        {plate}
      </motion.div>
    </div>
  );
}
