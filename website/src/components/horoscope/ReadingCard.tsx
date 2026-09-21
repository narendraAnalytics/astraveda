"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Hash, Moon, Palette, Smile, Sparkles } from "lucide-react";
import { colorSwatch, elementAccent, luckyNumberFor, type Horoscope, type ZodiacSign } from "@/lib/horoscope";

// Bright pastel wash per widget tile (kept fixed so the four tiles read as a set,
// whatever the sign's own colour is).
const TILES = [
  { key: "lucky_color", label: "Lucky colour", Icon: Palette, from: "#FFE3EC", to: "#FFC7D9", ink: "#B8305F" },
  { key: "lucky_number", label: "Lucky number", Icon: Hash, from: "#FFF0CC", to: "#FFE099", ink: "#9A6A00" },
  { key: "mood", label: "Mood", Icon: Smile, from: "#DDF5E8", to: "#B9EBD1", ink: "#1F7A4D" },
  { key: "best_time", label: "Best time", Icon: Clock, from: "#DDEBFF", to: "#BBD6FF", ink: "#2A5FA8" },
] as const;

// Fixed sparkle spots around the glyph badge (stable, hydration-safe).
const SPARKS: [number, number, number][] = [
  [-6, 10, 0],
  [96, 4, 0.7],
  [102, 82, 1.3],
  [-10, 78, 0.4],
];

function Words({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const step = Math.min(0.03, 1.4 / Math.max(words.length, 1));
  return (
    <p className="text-[16.5px] leading-[1.8] text-[#2b2540]">
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="mr-[.28em] inline-block"
          initial={reduced ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.25 + i * step, duration: 0.45 }}
        >
          {w}
        </motion.span>
      ))}
    </p>
  );
}

export default function ReadingCard({ sign, reading }: { sign: ZodiacSign; reading: Horoscope }) {
  const reduced = useReducedMotion();
  const [g0, g1] = sign.gradient;
  const accent = elementAccent(sign.element);

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={sign.name}
        initial={{ opacity: 0, x: 36, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -36, scale: 0.98 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[32px] p-6 sm:p-9"
        style={{
          background: `linear-gradient(155deg, ${g0}33 0%, #ffffff 52%, ${g1}1f 100%)`,
          border: `1px solid ${g1}33`,
          boxShadow: `0 24px 60px ${g1}26, 0 2px 0 #fff inset`,
        }}
      >
        {/* soft corner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${g0}66, transparent 70%)` }}
        />

        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
          <div className="relative">
            <motion.div
              className="grid h-[104px] w-[104px] place-items-center rounded-[30px] text-[58px] leading-none text-white"
              style={{ background: `linear-gradient(135deg, ${g0}, ${g1})`, boxShadow: `0 18px 40px ${g1}66` }}
              animate={reduced ? undefined : { y: [0, -7, 0], rotate: [0, 2.5, -2.5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              {sign.glyph}
              {"︎"}
            </motion.div>
            {!reduced &&
              SPARKS.map(([x, y, d], i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute text-[14px]"
                  style={{ left: `${x}%`, top: `${y}%`, color: g1 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.4], rotate: 45 }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: d }}
                >
                  ✦
                </motion.span>
              ))}
          </div>

          <div className="text-center sm:text-left">
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,44px)] font-medium leading-none text-[#1B1730]">
              {sign.name}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[#6b6480]">{sign.dates}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span
                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={{ background: `${accent}1f`, color: accent }}
              >
                {sign.element}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] font-medium text-[#5B5570] ring-1 ring-black/5">
                Ruled by {sign.ruler}
              </span>
              {reading.source === "fallback" && (
                <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-[12px] font-medium text-[#8a6100]">
                  General guidance
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-7 rounded-2xl bg-white/70 p-5 ring-1 ring-black/5 backdrop-blur sm:p-6">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.12em]" style={{ color: g1 }}>
            <Sparkles size={14} /> Today&apos;s guidance
          </div>
          <Words text={reading.guidance} />
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map(({ key, label, Icon, from, to, ink }, i) => {
            const raw = (reading[key] as string) || "";
            const value = raw || (key === "lucky_number" ? luckyNumberFor(sign.name, reading.date) : "—");
            const swatch = key === "lucky_color" ? colorSwatch(value, g1) : null;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.08, type: "spring", damping: 16 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl p-4"
                style={{
                  background: `linear-gradient(145deg, ${from}, ${to})`,
                  boxShadow: `0 10px 24px ${to}88`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-[.1em]" style={{ color: ink }}>
                    {label}
                  </span>
                  <Icon size={15} style={{ color: ink }} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  {swatch && (
                    <motion.span
                      className="h-6 w-6 shrink-0 rounded-full ring-2 ring-white"
                      style={{ background: swatch, boxShadow: `0 0 14px ${swatch}99` }}
                      animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
                      transition={{ duration: 2.6, repeat: Infinity }}
                    />
                  )}
                  <span className="text-[15px] font-bold leading-tight text-[#1B1730]">{value}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {(reading.tithi || reading.nakshatra) && (
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-[#5B5570] sm:justify-start">
            <Moon size={14} style={{ color: g1 }} />
            {reading.tithi && <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-black/5">Tithi · {reading.tithi}</span>}
            {reading.nakshatra && (
              <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-black/5">Nakshatra · {reading.nakshatra}</span>
            )}
          </div>
        )}
      </motion.article>
    </AnimatePresence>
  );
}
