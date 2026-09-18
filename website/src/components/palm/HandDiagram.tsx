"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MOUNTS, type LineKey, type Mount } from "@/lib/palm";

const GOLD = "#C18426";
const ROSE = "#C0356F";

// Same viewBox/paths as the mobile app's hand-diagram.tsx — a clean schematic
// right palm, ported 1:1 so the two apps draw an identical hand.
const PALM_OUTLINE =
  "M55 96 C50 60 52 30 60 22 C68 16 74 22 74 40 L76 88 " +
  "M78 86 L80 24 C81 14 90 14 92 24 L96 88 " +
  "M100 88 L104 20 C105 10 114 10 116 20 L118 90 " +
  "M124 92 L132 34 C134 24 143 26 142 38 L136 96 " +
  "M40 150 C34 120 40 96 60 92 C96 86 150 86 176 104 " +
  "C198 118 202 150 196 186 C190 232 158 262 116 262 " +
  "C74 262 46 220 40 150 Z";

const LINES: Record<LineKey, { d: string; len: number }> = {
  heart: { d: "M58 116 C90 96 140 96 186 120", len: 150 },
  head: { d: "M60 140 C100 150 150 156 178 150", len: 130 },
  life: { d: "M64 108 C66 150 84 210 104 246", len: 175 },
  fate: { d: "M120 250 C120 200 122 150 118 116", len: 140 },
};

const MOUNT_POS: Record<Mount, { x: number; y: number }> = {
  Jupiter: { x: 66, y: 104 },
  Saturn: { x: 100, y: 100 },
  Sun: { x: 134, y: 104 },
  Mercury: { x: 168, y: 118 },
  Mars: { x: 120, y: 168 },
  Venus: { x: 78, y: 212 },
  Moon: { x: 174, y: 210 },
};

export default function HandDiagram({
  lines,
  mounts,
  size = 240,
}: {
  lines: Partial<Record<LineKey, string>>;
  mounts: Mount[];
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;
  const height = (size * 280) / 240;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={height} viewBox="0 0 240 280">
        <path
          d={PALM_OUTLINE}
          fill="#FDEEF3"
          stroke="#EAB9CD"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {(["heart", "head", "life", "fate"] as LineKey[]).map((k, i) => {
          const { d, len } = LINES[k];
          const answer = lines[k];
          const known = !!answer && answer !== "Not sure";
          return (
            <motion.path
              key={k}
              d={d}
              stroke={known ? GOLD : "#D8C3B3"}
              strokeWidth={known ? 3 : 1.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={known ? len : "3 5"}
              initial={known && animate ? { strokeDashoffset: len } : { strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.72, delay: 0.2 + i * 0.14, ease: "easeOut" }}
            />
          );
        })}
        {MOUNTS.map((m) => {
          const { x, y } = MOUNT_POS[m];
          const selected = mounts.includes(m);
          return (
            <g key={m}>
              {selected && (
                <motion.circle
                  cx={x}
                  cy={y}
                  fill={ROSE}
                  initial={{ r: 9, opacity: 0.35 }}
                  animate={animate ? { r: [9, 14, 9], opacity: [0.35, 0.08, 0.35] } : undefined}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={selected ? 5.5 : 3}
                fill={selected ? ROSE : "#E3CDBD"}
                stroke={selected ? "#fff" : "none"}
                strokeWidth={selected ? 1.5 : 0}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3.5 mt-2.5 justify-center">
        <Legend color={GOLD} label="Your lines" />
        <Legend color="#D8C3B3" label="Not sure" dashed />
        <Legend color={ROSE} label="Strong mounts" dot />
      </div>
    </div>
  );
}

function Legend({ color, label, dashed, dot }: { color: string; label: string; dashed?: boolean; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={dot ? "w-[9px] h-[9px] rounded-full" : "w-4 h-[3px] rounded-full"}
        style={{ backgroundColor: color, opacity: dashed ? 0.6 : 1 }}
      />
      <span className="text-[10px] font-semibold text-[#8B6F62]">{label}</span>
    </span>
  );
}
