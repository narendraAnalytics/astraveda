"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Landmark, Globe2, Layers } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";
import { useI18n } from "@/i18n/I18nProvider";
import { LANGUAGES } from "@/i18n/languages";

// Numbers/icons/accents are language-neutral; labels/subtitles come from the dictionary.
// Order matches d.trust.stats: [0] no 3rd-party APIs, [1] charts, [2] languages, [3] temples.
type Accent = { from: string; to: string; wash: string; glow: string };
const ACCENTS: Accent[] = [
  { from: "#8F29DD", to: "#D6336C", wash: "rgba(143,41,221,.16)", glow: "rgba(143,41,221,.3)" },
  { from: "#D6336C", to: "#FF8A5C", wash: "rgba(214,51,108,.13)", glow: "rgba(214,51,108,.28)" },
  { from: "#0f8a7e", to: "#3fa66b", wash: "rgba(15,138,126,.14)", glow: "rgba(15,138,126,.28)" },
  { from: "#D9820F", to: "#F0B24A", wash: "rgba(240,178,74,.2)", glow: "rgba(217,130,15,.3)" },
];
const ICONS = [ShieldCheck, Layers, Globe2, Landmark];
const VALUES = ["0", "16+", "7", "6"];

function StatNumber({ value, accent, className }: { value: string; accent: Accent; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? parseInt(match[1], 10) : null;
  const suffix = match ? match[2] : "";
  const [display, setDisplay] = useState(reduceMotion || target === null ? value : "0");

  useEffect(() => {
    if (!isInView || reduceMotion || target === null) {
      setDisplay(value);
      return;
    }
    let start: number | null = null;
    const duration = 1300;
    let frame: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(`${Math.round(eased * target)}${suffix}`);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, reduceMotion, target, suffix, value]);

  return (
    <div
      ref={ref}
      className={`font-[family-name:var(--font-display)] font-semibold leading-[.95] bg-clip-text text-transparent ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
    >
      {display}
    </div>
  );
}

// Frosted-glass bento tile with a cursor-tracked spotlight and a soft "breath" lift.
function Tile({
  accent,
  className,
  children,
}: {
  accent: Accent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group relative h-full overflow-hidden rounded-[28px] border border-white/80 backdrop-blur-xl transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.012] ${className ?? ""}`}
      style={{
        background: `linear-gradient(155deg, ${accent.wash} 0%, rgba(255,255,255,.82) 58%, rgba(255,255,255,.92) 100%)`,
        boxShadow: `0 14px 40px -18px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,.9)`,
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(320px circle at var(--mx,50%) var(--my,50%), ${accent.glow}, transparent 70%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function IconChip({ Icon, accent, size = 44 }: { Icon: (typeof ICONS)[number]; accent: Accent; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl text-white transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
        boxShadow: `0 10px 22px -6px ${accent.glow}`,
      }}
    >
      <Icon size={size * 0.5} strokeWidth={1.9} />
    </span>
  );
}

export default function TrustStats() {
  const { d } = useI18n();
  const reduce = useReducedMotion();
  const S = d.trust.stats;

  return (
    <section
      data-nav-theme="light"
      className="relative overflow-hidden px-4 py-20 sm:px-9 sm:py-28"
      style={{
        background:
          "linear-gradient(180deg,#FFFAF2 0%,#F6EFFF 40%,#FFEFF4 78%,#FFF6EA 100%)",
      }}
    >
      {/* Soft pastel blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-28 top-16 h-[380px] w-[380px] rounded-full blur-3xl" style={{ background: "rgba(190,160,255,.42)", animation: "av-float 13s ease-in-out infinite" }} />
        <span className="absolute -right-24 bottom-10 h-[400px] w-[400px] rounded-full blur-3xl" style={{ background: "rgba(255,180,150,.4)", animation: "av-float2 15s ease-in-out infinite" }} />
        <span className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "rgba(150,225,205,.3)", animation: "av-float 17s ease-in-out infinite" }} />
      </div>

      <div className="relative mx-auto max-w-[1100px]">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-[clamp(30px,4.2vw,50px)] font-medium leading-[1.1] text-[#1B1730]">
            {d.trust.title}
          </h2>
          <p className="text-[15.5px] leading-[1.65] text-[#5B5570]">{d.trust.body}</p>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 md:grid-rows-2">
          {/* Hero tile — the headline promise */}
          <Reveal y={24} className="col-span-2 h-full md:row-span-2">
            <Tile accent={ACCENTS[0]} className="min-h-[300px] md:min-h-[440px]">
              <div className="flex h-full flex-col justify-between gap-8 p-7 sm:p-10">
                <div className="flex items-center justify-between">
                  <IconChip Icon={ICONS[0]} accent={ACCENTS[0]} size={56} />
                  <span aria-hidden className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                </div>
                <div>
                  <StatNumber value={VALUES[0]} accent={ACCENTS[0]} className="text-[clamp(110px,15vw,190px)]" />
                  <div className="mt-3 text-[20px] font-semibold text-[#1B1730] sm:text-[22px]">{S[0].label}</div>
                  <div className="mt-2 max-w-[380px] text-[14.5px] leading-[1.6] text-[#5B5570]">{S[0].sub}</div>
                </div>
              </div>
              {/* Orbiting ring decoration */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-dashed border-[#8F29DD]/25"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 60, ease: "linear", repeat: Infinity }}
              />
              <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle,rgba(214,51,108,.18),transparent 70%)" }} />
            </Tile>
          </Reveal>

          {/* Charts — wide tile with a filling 16-cell grid */}
          <Reveal delay={0.08} y={24} className="col-span-2 h-full">
            <Tile accent={ACCENTS[1]} className="min-h-[190px]">
              <div className="flex h-full flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <IconChip Icon={ICONS[1]} accent={ACCENTS[1]} />
                    <div className="text-[16px] font-semibold text-[#1B1730]">{S[1].label}</div>
                  </div>
                  <StatNumber value={VALUES[1]} accent={ACCENTS[1]} className="text-[clamp(56px,7vw,84px)]" />
                  <div className="mt-2 max-w-[300px] text-[13px] leading-[1.55] text-[#5B5570]">{S[1].sub}</div>
                </div>
                <div aria-hidden className="grid shrink-0 grid-cols-8 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="h-4 w-4 rounded-md sm:h-5 sm:w-5"
                      style={{ background: `linear-gradient(135deg, ${ACCENTS[1].from}, ${ACCENTS[1].to})` }}
                      initial={{ opacity: 0.12, scale: 0.7 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ delay: reduce ? 0 : 0.25 + i * 0.05, duration: 0.4, ease: "easeOut" }}
                    />
                  ))}
                </div>
              </div>
            </Tile>
          </Reveal>

          {/* Languages */}
          <Reveal delay={0.16} y={24} className="col-span-1 h-full">
            <Tile accent={ACCENTS[2]} className="min-h-[220px]">
              <div className="flex h-full flex-col gap-3 p-5 sm:p-6">
                <IconChip Icon={ICONS[2]} accent={ACCENTS[2]} />
                <StatNumber value={VALUES[2]} accent={ACCENTS[2]} className="text-[clamp(48px,6vw,68px)]" />
                <div className="text-[15px] font-semibold text-[#1B1730]">{S[2].label}</div>
                <div className="mt-auto flex flex-wrap gap-1.5" title={S[2].sub}>
                  <span className="sr-only">{S[2].sub}</span>
                  {LANGUAGES.map((l) => (
                    <span
                      key={l.code}
                      aria-hidden
                      className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold text-[#1B1730]"
                      style={{ background: `linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})` }}
                    >
                      {l.badge}
                    </span>
                  ))}
                </div>
              </div>
            </Tile>
          </Reveal>

          {/* Temples */}
          <Reveal delay={0.24} y={24} className="col-span-1 h-full">
            <Tile accent={ACCENTS[3]} className="min-h-[220px]">
              <div className="flex h-full flex-col gap-3 p-5 sm:p-6">
                <IconChip Icon={ICONS[3]} accent={ACCENTS[3]} />
                <StatNumber value={VALUES[3]} accent={ACCENTS[3]} className="text-[clamp(48px,6vw,68px)]" />
                <div className="text-[15px] font-semibold text-[#1B1730]">{S[3].label}</div>
                <div className="text-[12.5px] leading-[1.5] text-[#5B5570]">{S[3].sub}</div>
              </div>
            </Tile>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
