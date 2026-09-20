"use client";

import { motion } from "framer-motion";
import { ELEMENT_GLYPH, ELEMENT_HEX, ELEMENT_STATE_RANK, type VastuElement } from "@/lib/vastu";

const STATE_LABEL: Record<string, string> = {
  strong: "Strong",
  balanced: "Balanced",
  weak: "Weak",
  afflicted: "Afflicted",
};

// The Panchabhuta balance — one tinted meter per element that fills on mount.
export default function ElementBars({ elements }: { elements: VastuElement[] }) {
  return (
    <div className="space-y-4">
      {elements.map((e, i) => {
        const hex = ELEMENT_HEX[e.element] ?? "#a2896f";
        const pct = (ELEMENT_STATE_RANK[e.state] ?? 0.5) * 100;
        return (
          <div key={e.element}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="w-7 h-7 rounded-[9px] flex items-center justify-center text-[14px] flex-shrink-0"
                style={{ background: `${hex}1f`, border: `1px solid ${hex}40` }}
              >
                {ELEMENT_GLYPH[e.element] ?? "•"}
              </span>
              <span className="flex-1 text-[13.5px] font-bold text-[#4a3626]">{e.element}</span>
              <span
                className="text-[10.5px] font-extrabold uppercase tracking-[.05em] rounded-full px-2 py-0.5"
                style={{ background: `${hex}1a`, color: hex }}
              >
                {STATE_LABEL[e.state] ?? e.state}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#f0e6d8] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${hex}aa, ${hex})` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.08, ease: "easeOut" }}
              />
            </div>
            {e.note && <p className="text-[12.5px] leading-[1.55] text-[#6e5747] mt-1.5">{e.note}</p>}
          </div>
        );
      })}
    </div>
  );
}
