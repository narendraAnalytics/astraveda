"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Pointer } from "lucide-react";

// A homepage pill link with an attention-grabbing animated hand that repeatedly
// "taps" it (plus a synced ripple + glow + a wiggling emoji). Each pill passes its
// own colours; `delay` offsets the loop so two hands never tap in lockstep.
// Static under Reduce Motion.
const CYCLE = 2.6; // seconds per tap loop
const TAP_AT = 0.42; // fraction of the loop where the finger lands

export type TapHandTheme = {
  color: string; // text + ripple + tag (hex)
  bg: string; // pill fill
  hoverBg: string;
  ink: string; // the hand
  glow: string; // halo + hover shadow (rgba)
};

export default function TapHandLink({
  href,
  emoji,
  label,
  tag,
  theme,
  delay = 0,
}: {
  href: string;
  emoji: string;
  label: string;
  tag: string;
  theme: TapHandTheme;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const vars = {
    "--th-bg": theme.bg,
    "--th-hbg": theme.hoverBg,
    "--th-glow": theme.glow,
  } as React.CSSProperties;

  return (
    <span className="relative inline-flex" style={vars}>
      {/* soft pulsing halo */}
      {!reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${theme.glow}, transparent)` }}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.12, 0.96] }}
          transition={{ duration: CYCLE, repeat: Infinity, ease: "easeInOut", delay }}
        />
      )}

      <a
        href={href}
        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium bg-[var(--th-bg)] transition hover:bg-[var(--th-hbg)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_var(--th-glow)]"
        style={{ color: theme.color, border: `1px solid ${theme.color}4d` }}
      >
        <motion.span
          aria-hidden
          className="inline-block"
          animate={reduced ? undefined : { rotate: [-4, 4, -3, 3, -4], scale: [1, 1.12, 1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay }}
        >
          {emoji}
        </motion.span>
        {label}
        <span
          className="ml-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-white"
          style={{ background: theme.color }}
        >
          {tag}
        </span>
      </a>

      {!reduced && (
        <>
          {/* ripple where the finger lands */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute right-6 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: theme.color }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 0.2, 2.6, 2.6], opacity: [0, 0.85, 0, 0] }}
            transition={{ duration: CYCLE, repeat: Infinity, times: [0, TAP_AT, TAP_AT + 0.3, 1], ease: "easeOut", delay }}
          />
          {/* the tapping hand */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -bottom-5 right-3 drop-shadow-[0_3px_4px_rgba(40,20,60,.3)]"
            style={{ color: theme.ink }}
            animate={{
              x: [14, 14, 0, 0, 14, 14],
              y: [16, 16, 2, 2, 16, 16],
              scale: [1, 1, 0.9, 0.9, 1, 1],
              rotate: [-6, -6, 0, 0, -6, -6],
            }}
            transition={{
              duration: CYCLE,
              repeat: Infinity,
              times: [0, 0.12, TAP_AT, TAP_AT + 0.1, 0.72, 1],
              ease: "easeInOut",
              delay,
            }}
          >
            <Pointer size={30} strokeWidth={1.8} fill={theme.bg} />
          </motion.span>
        </>
      )}
    </span>
  );
}
