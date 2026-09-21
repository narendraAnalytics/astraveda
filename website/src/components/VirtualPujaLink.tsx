"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Pointer } from "lucide-react";

// Homepage pill that opens /virtual-puja, with an attention-grabbing animated
// hand that repeatedly "taps" it (plus a synced ripple + glow). Static under
// Reduce Motion.
const CYCLE = 2.6; // seconds per tap loop
const TAP_AT = 0.42; // fraction of the loop where the finger lands

export default function VirtualPujaLink() {
  const reduced = useReducedMotion();

  return (
    <span className="relative inline-flex">
      {/* soft pulsing halo */}
      {!reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(255,150,60,.5), transparent)" }}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.12, 0.96] }}
          transition={{ duration: CYCLE, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <a
        href="/virtual-puja"
        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-[#C1653D] bg-[#FFF3E6] border border-[#C1653D]/30 transition hover:bg-[#FFE7CC] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(193,101,61,.25)]"
      >
        {/* diya flame that flickers */}
        <motion.span
          aria-hidden
          className="inline-block"
          animate={reduced ? undefined : { rotate: [-4, 4, -3, 3, -4], scale: [1, 1.12, 1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          🪔
        </motion.span>
        Virtual Puja — Free
        <span className="ml-0.5 rounded-full bg-[#C1653D] px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-white">
          Try
        </span>
      </a>

      {!reduced && (
        <>
          {/* ripple where the finger lands */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute right-6 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-[#C1653D]"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 0.2, 2.6, 2.6], opacity: [0, 0.85, 0, 0] }}
            transition={{ duration: CYCLE, repeat: Infinity, times: [0, TAP_AT, TAP_AT + 0.3, 1], ease: "easeOut" }}
          />
          {/* the tapping hand */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -bottom-5 right-3 text-[#8A3F1C] drop-shadow-[0_3px_4px_rgba(90,40,10,.35)]"
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
            }}
          >
            <Pointer size={30} strokeWidth={1.8} fill="#FFF3E6" />
          </motion.span>
        </>
      )}
    </span>
  );
}
