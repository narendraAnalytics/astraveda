"use client";

import { motion } from "framer-motion";
import { ZODIAC } from "@/lib/horoscope";

// "All signs" — 12 bright cards; tap one to switch the reading above.
export default function SignGrid({
  selected,
  mine,
  onPick,
}: {
  selected: string | null;
  mine: string | null;
  onPick: (name: string) => void;
}) {
  return (
    <section className="mt-12">
      <h3 className="mb-4 text-center font-[family-name:var(--font-display)] text-[26px] font-medium text-[#1B1730]">
        All signs
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {ZODIAC.map((z, i) => {
          const active = z.name === selected;
          const [g0, g1] = z.gradient;
          return (
            <motion.button
              key={z.name}
              onClick={() => {
                onPick(z.name);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 4) * 0.06, type: "spring", damping: 18 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.97 }}
              className="group relative flex flex-col items-center gap-2 rounded-[22px] p-4 text-center outline-none"
              style={{
                background: `linear-gradient(160deg, ${g0}${active ? "40" : "26"} 0%, #fff 70%)`,
                border: `1.5px solid ${active ? g1 : `${g1}2e`}`,
                boxShadow: active ? `0 16px 34px ${g1}44` : `0 6px 18px ${g1}18`,
              }}
            >
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl text-[30px] leading-none text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                style={{ background: `linear-gradient(135deg, ${g0}, ${g1})`, boxShadow: `0 8px 18px ${g1}55` }}
              >
                {z.glyph}
                {"︎"}
              </span>
              <span className="text-[15px] font-semibold text-[#1B1730]">{z.name}</span>
              <span className="text-[11.5px] text-[#6b6480]">{z.dates}</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: g1 }}>
                {z.element}
              </span>
              {mine === z.name && (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-[#FFD75E] px-2 py-0.5 text-[9.5px] font-bold text-[#6b4a00]">
                  ★ You
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="grid-active"
                  className="absolute inset-0 rounded-[22px] ring-2"
                  style={{ ["--tw-ring-color" as string]: `${g1}66` }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
