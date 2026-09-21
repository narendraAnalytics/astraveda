"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ZODIAC } from "@/lib/horoscope";

// Horizontal sign picker — 12 pastel-gradient glyph chips; the chosen one lifts,
// fills with its gradient and gets a ring that slides between signs.
export default function SignStrip({
  selected,
  mine,
  onPick,
}: {
  selected: string | null;
  mine: string | null;
  onPick: (name: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (selected) refs.current[selected]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div
      className="relative -mx-4 sm:mx-0"
      style={{
        maskImage: "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
      }}
    >
      <div
        role="tablist"
        aria-label="Zodiac signs"
        className="flex snap-x gap-1.5 overflow-x-auto px-6 pb-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center"
      >
        {ZODIAC.map((z, i) => {
          const active = z.name === selected;
          const [g0, g1] = z.gradient;
          return (
            <motion.button
              key={z.name}
              ref={(el) => {
                refs.current[z.name] = el;
              }}
              role="tab"
              aria-selected={active}
              onClick={() => onPick(z.name)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, type: "spring", damping: 18 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.94 }}
              className="relative flex shrink-0 snap-center flex-col items-center gap-1.5 px-1.5 outline-none"
            >
              <motion.span
                className="relative grid h-[58px] w-[58px] place-items-center rounded-full text-[27px] leading-none"
                animate={{ scale: active ? 1.12 : 1, y: active ? -3 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                style={{
                  background: active ? `linear-gradient(135deg, ${g0}, ${g1})` : `linear-gradient(135deg, ${g0}30, ${g1}1f)`,
                  color: active ? "#fff" : g1,
                  boxShadow: active ? `0 12px 26px ${g1}66` : `inset 0 0 0 1px ${g1}2e`,
                }}
              >
                {z.glyph}
                {"︎"}
                {active && (
                  <motion.span
                    layoutId="strip-ring"
                    className="absolute -inset-[5px] rounded-full border-2"
                    style={{ borderColor: `${g1}88` }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {mine === z.name && (
                  <span
                    className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#FFD75E] text-[8px] font-bold text-[#6b4a00] ring-2 ring-white"
                    title="Your birth-chart sign"
                  >
                    ★
                  </span>
                )}
              </motion.span>
              <span className="text-[11.5px] font-medium" style={{ color: active ? g1 : "#6b6480" }}>
                {z.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
