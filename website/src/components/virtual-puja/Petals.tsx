"use client";

import { memo } from "react";
import { motion } from "framer-motion";

export type PetalSpec = {
  id: number;
  x: number; // start x, vw
  sway: number[]; // x drift keyframes, px
  size: number;
  color: string;
  delay: number;
  duration: number;
  spin: number;
  tilt: number;
  kind: "petal" | "rose";
};

const COLORS = ["#FFA51F", "#FF7A1A", "#FFB93B", "#F0457C", "#FF6F9C", "#FFF6E6", "#E8320E"];

let uid = 0;

/** Built inside a click handler (never during render), so Math.random is safe. */
export function makePetals(count = 64): PetalSpec[] {
  return Array.from({ length: count }, () => {
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      id: uid++,
      x: 8 + Math.random() * 84,
      sway: [0, dir * (30 + Math.random() * 50), -dir * (20 + Math.random() * 60), dir * (10 + Math.random() * 40)],
      size: 12 + Math.random() * 16,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 1.4,
      duration: 5.5 + Math.random() * 4.5,
      spin: dir * (240 + Math.random() * 500),
      tilt: 40 + Math.random() * 140,
      kind: Math.random() > 0.72 ? "rose" : "petal",
    };
  });
}

function PetalShape({ color, kind }: { color: string; kind: "petal" | "rose" }) {
  if (kind === "rose") {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <circle cx="12" cy="12" r="11" fill={color} />
        <path d="M12 4c5 0 8 4 6 8s-7 6-10 2 0-10 4-10z" fill="rgba(0,0,0,.16)" />
        <path d="M12 8c3 0 4 3 2 5s-5 1-5-1 1-4 3-4z" fill="rgba(255,255,255,.28)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 32" width="100%" height="100%">
      <path d="M12 1C20 8 23 18 12 31 1 18 4 8 12 1z" fill={color} />
      <path d="M12 3c2 9 1 17 0 26" stroke="rgba(0,0,0,.18)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function Petal({ p }: { p: PetalSpec }) {
  return (
    <motion.div
      className="absolute top-0 will-change-transform"
      style={{ left: `${p.x}vw`, width: p.size, height: p.size * (p.kind === "rose" ? 1 : 1.3) }}
      initial={{ y: "-8vh", opacity: 0, rotateZ: 0, rotateX: 0 }}
      animate={{
        y: "108vh",
        x: p.sway,
        opacity: [0, 1, 1, 1, 0],
        rotateZ: p.spin,
        rotateX: [0, p.tilt, -p.tilt, p.tilt, 0],
      }}
      transition={{
        delay: p.delay,
        duration: p.duration,
        ease: "linear",
        x: { duration: p.duration, ease: "easeInOut", delay: p.delay },
        opacity: { duration: p.duration, times: [0, 0.08, 0.5, 0.85, 1], delay: p.delay },
        rotateX: { duration: p.duration * 0.8, repeat: 1, ease: "easeInOut", delay: p.delay },
      }}
    >
      <PetalShape color={p.color} kind={p.kind} />
    </motion.div>
  );
}

const PetalBurst = memo(function PetalBurst({ petals }: { petals: PetalSpec[] }) {
  return (
    <>
      {petals.map((p) => (
        <Petal key={p.id} p={p} />
      ))}
    </>
  );
});

export default PetalBurst;
