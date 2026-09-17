"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Landmark, Globe2, Layers } from "lucide-react";
import { useInView, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";

const STATS = [
  {
    icon: ShieldCheck,
    value: "0",
    label: "Third-party astrology APIs",
    sub: "Every chart is computed in-house — nothing outsourced",
    featured: true,
  },
  {
    icon: Layers,
    value: "16+",
    label: "Divisional charts",
    sub: "Full Vimshottari Dasha, computed on our own Swiss Ephemeris engine",
  },
  {
    icon: Globe2,
    value: "7",
    label: "Languages",
    sub: "English, Hindi, Odia, Tamil, Telugu, Marathi & Kannada",
  },
  {
    icon: Landmark,
    value: "6",
    label: "Real temples",
    sub: "13 puja types with live daily capacity tracking",
  },
];

function StatNumber({ value }: { value: string }) {
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
    const duration = 1100;
    let frame: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(`${Math.round(progress * target)}${suffix}`);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, reduceMotion, target, suffix, value]);

  return (
    <div
      ref={ref}
      className="font-[family-name:var(--font-display)] text-[28px] text-[#F4D28A] font-semibold leading-none"
    >
      {display}
    </div>
  );
}

export default function TrustStats() {
  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden py-20 sm:py-24 px-6 sm:px-9"
      style={{
        background:
          "radial-gradient(120% 90% at 12% -10%, rgba(143,41,221,.22), transparent 55%), radial-gradient(90% 70% at 100% 110%, rgba(244,210,138,.14), transparent 60%), #0A0F33",
      }}
    >
      {/* faint starfield */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <span className="absolute rounded-full" style={{ top: "12%", left: "6%", width: 3, height: 3, background: "#F4D28A", boxShadow: "0 0 7px 2px rgba(244,210,138,.6)", animation: "av-twinkle 3.4s ease-in-out infinite" }} />
        <span className="absolute rounded-full" style={{ top: "22%", left: "85%", width: 2, height: 2, background: "#FFF7E6", boxShadow: "0 0 6px 2px rgba(255,247,230,.55)", animation: "av-twinkle 4.2s ease-in-out infinite .5s" }} />
        <span className="absolute rounded-full" style={{ top: "78%", left: "18%", width: 2, height: 2, background: "#D9B8F4", boxShadow: "0 0 6px 2px rgba(217,184,244,.5)", animation: "av-twinkle 3.8s ease-in-out infinite 1s" }} />
        <span className="absolute rounded-full" style={{ top: "68%", left: "92%", width: 3, height: 3, background: "#F4D28A", boxShadow: "0 0 7px 2px rgba(244,210,138,.5)", animation: "av-twinkle 5s ease-in-out infinite .8s" }} />
      </div>

      <div className="relative max-w-[1100px] mx-auto">
        <Reveal className="max-w-xl mx-auto text-center mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(26px,3.2vw,36px)] leading-[1.15] text-[#FFF7E6] font-medium mb-3">
            Built to be trusted, not just tried
          </h2>
          <p className="text-[14.5px] leading-[1.65] text-[rgba(255,247,230,.65)]">
            Every payment, wallet balance, and order is verified server-side —
            never trusted from the client.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal
                key={s.label}
                delay={i * 0.08}
                y={20}
                className={s.featured ? "col-span-2" : "col-span-1"}
              >
                <div
                  className={`group relative h-full flex flex-col ${
                    s.featured
                      ? "sm:flex-row sm:items-center sm:text-left"
                      : "items-center text-center"
                  } gap-3 px-5 py-7 rounded-2xl border border-[rgba(244,210,138,.16)] bg-[rgba(255,247,230,.045)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[rgba(244,210,138,.4)] hover:bg-[rgba(255,247,230,.08)] hover:shadow-[0_18px_38px_rgba(0,0,0,.35)]`}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(244,210,138,.5), transparent 45%, transparent 55%, rgba(143,41,221,.4))",
                      padding: 1,
                      WebkitMask:
                        "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                    }}
                  />
                  <span
                    className={`relative flex items-center justify-center ${
                      s.featured ? "w-14 h-14" : "w-11 h-11"
                    } shrink-0 rounded-full bg-[rgba(244,210,138,.1)] border border-[rgba(244,210,138,.25)] text-[#F4D28A] transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6`}
                  >
                    <Icon size={s.featured ? 24 : 20} strokeWidth={1.8} />
                  </span>
                  <div className={s.featured ? "" : "contents"}>
                    <StatNumber value={s.value} />
                    <div className="text-[13.5px] font-semibold text-[#FFF7E6] mt-1">
                      {s.label}
                    </div>
                    <div className="text-[11.5px] leading-[1.5] text-[rgba(255,247,230,.55)] mt-1">
                      {s.sub}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
