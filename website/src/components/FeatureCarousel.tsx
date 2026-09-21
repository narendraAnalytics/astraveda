"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import AuthAwareLink from "./auth/AuthAwareLink";
import Reveal from "./Reveal";
import { useI18n } from "@/i18n/I18nProvider";
import { SHOWCASE } from "@/lib/site";

const N = SHOWCASE.length;
const STEP = 360 / N;
const SPIN_DEG_PER_MS = 0.0055; // ~5.5° / second drift

// Angle → nearest-to-front distance in -180..180
const wrap180 = (a: number) => ((((a % 360) + 360) % 360) + 180) % 360 - 180;

// Bright, per-card glow so each card floats on its own colour.
const GLOWS = [
  "rgba(240,160,60,.45)",
  "rgba(224,90,140,.42)",
  "rgba(40,170,150,.4)",
  "rgba(214,110,50,.42)",
  "rgba(150,110,230,.45)",
  "rgba(232,100,120,.42)",
  "rgba(240,140,50,.45)",
];

export default function FeatureCarousel() {
  const { d } = useI18n();
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sceneRef, { margin: "-10% 0px -10% 0px" });

  const rot = useMotionValue(0);
  const faceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hovering = useRef(false);
  const dragging = useRef(false);
  const idleUntil = useRef(0);
  const moved = useRef(0);
  const spin = useRef<ReturnType<typeof animate> | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  // Depth cue: cards fade/desaturate as they swing away from the front.
  // Written straight to the DOM (no React state) so it stays 60fps, and never
  // rendered on the server — no hydration surface.
  const applyDepth = useCallback((deg: number) => {
    faceRefs.current.forEach((el, i) => {
      if (!el) return;
      const f = (Math.cos((wrap180(i * STEP + deg) * Math.PI) / 180) + 1) / 2;
      el.style.opacity = String(0.5 + 0.5 * f);
      el.style.filter = `saturate(${0.7 + 0.3 * f}) brightness(${0.93 + 0.07 * f})`;
    });
    const idx = ((Math.round(-deg / STEP) % N) + N) % N;
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActive(idx);
    }
  }, []);

  useMotionValueEvent(rot, "change", applyDepth);
  useEffect(() => applyDepth(rot.get()), [applyDepth, rot]);

  useAnimationFrame((_, delta) => {
    if (reduce || !inView || hovering.current || dragging.current || spin.current) return;
    if (performance.now() < idleUntil.current) return;
    rot.set(rot.get() - delta * SPIN_DEG_PER_MS);
  });

  const spinTo = useCallback(
    (target: number) => {
      spin.current?.stop();
      idleUntil.current = performance.now() + 2200;
      if (reduce) {
        spin.current = null;
        rot.set(target);
        return;
      }
      const c = animate(rot, target, {
        type: "spring",
        stiffness: 70,
        damping: 17,
        onComplete: () => {
          if (spin.current === c) spin.current = null;
        },
      });
      spin.current = c;
    },
    [reduce, rot]
  );

  const go = (dir: 1 | -1) =>
    spinTo((Math.round(rot.get() / STEP) - dir) * STEP);

  const goTo = (i: number) => {
    const base = -i * STEP;
    const k = Math.round((rot.get() - base) / 360);
    spinTo(base + k * 360);
  };

  const title = d.explore.title;
  const brand = "AstraVeda";
  const at = title.indexOf(brand);
  const before = at >= 0 ? title.slice(0, at) : title;
  const after = at >= 0 ? title.slice(at + brand.length) : "";

  return (
    <section
      id="explore"
      data-nav-theme="light"
      className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-9 font-[family-name:var(--font-body)]"
      style={{
        background:
          "linear-gradient(180deg,#FFF3E2 0%,#FFEEF5 42%,#F3EEFF 78%,#FFFAF2 100%)",
      }}
    >
      {/* Bright ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className="absolute -left-24 top-10 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ background: "rgba(255,190,120,.5)", animation: "av-float 11s ease-in-out infinite" }}
        />
        <span
          className="absolute -right-20 top-24 h-[380px] w-[380px] rounded-full blur-3xl"
          style={{ background: "rgba(255,160,205,.45)", animation: "av-float2 13s ease-in-out infinite" }}
        />
        <span
          className="absolute left-1/3 bottom-0 h-[340px] w-[340px] rounded-full blur-3xl"
          style={{ background: "rgba(180,150,255,.4)", animation: "av-float 15s ease-in-out infinite" }}
        />
        {[
          ["12%", "22%", 5, "#E9BE6C", "3.4s", "0s"],
          ["86%", "16%", 4, "#D6336C", "4.2s", ".7s"],
          ["8%", "70%", 4, "#8F29DD", "3.8s", "1.2s"],
          ["92%", "64%", 5, "#E9BE6C", "4.6s", ".3s"],
          ["50%", "8%", 3, "#8F29DD", "5s", "1.6s"],
        ].map(([left, top, size, color, dur, delay], i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: left as string,
              top: top as string,
              width: size as number,
              height: size as number,
              background: color as string,
              boxShadow: `0 0 10px 2px ${color as string}`,
              animation: `av-twinkle ${dur} ease-in-out infinite ${delay}`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-6 max-w-2xl text-center sm:mb-10">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D6336C]/25 bg-white/60 px-4 py-1.5 text-[13px] font-medium tracking-[.02em] text-[#B4246A] backdrop-blur-md">
            <span className="text-[14px]">✦</span> {d.hero.badge}
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(34px,5vw,58px)] font-medium leading-[1.06] text-[#1B1730]">
            {before}
            <span
              className="italic bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg,#8F29DD,#D6336C,#E9A23B)",
              }}
            >
              {at >= 0 ? brand : ""}
            </span>
            {after}
          </h2>
        </Reveal>

        {/* 3D ring */}
        <motion.div
          ref={sceneRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={d.explore.title}
          className="relative mx-auto h-[330px] cursor-grab select-none active:cursor-grabbing sm:h-[500px] [--w:200px] [--r:305px] sm:[--w:290px] sm:[--r:430px]"
          style={{ perspective: 1700, touchAction: "pan-y" }}
          onPointerDown={() => {
            moved.current = 0;
          }}
          onPanStart={() => {
            dragging.current = true;
            spin.current?.stop();
            spin.current = null;
          }}
          onPan={(_, info) => {
            moved.current += Math.abs(info.delta.x);
            rot.set(rot.get() + info.delta.x * 0.32);
          }}
          onPanEnd={(_, info) => {
            dragging.current = false;
            spinTo(
              Math.round((rot.get() + info.velocity.x * 0.1) / STEP) * STEP
            );
          }}
          onClickCapture={(e) => {
            // A drag must never count as a click on a card link.
            if (moved.current > 6) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {/* Floor glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-1 left-1/2 h-14 w-[70%] -translate-x-1/2 rounded-[50%] blur-2xl sm:bottom-2"
            style={{
              background:
                "radial-gradient(ellipse,rgba(143,41,221,.32),rgba(214,51,108,.16) 55%,transparent 75%)",
            }}
          />

          <div
            className="absolute inset-0"
            style={{
              transformStyle: "preserve-3d",
              transform: "translateZ(calc(var(--r) * -1)) rotateX(-7deg)",
            }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: "preserve-3d", rotateY: rot }}
            >
              {SHOWCASE.map((item, i) => {
                const f = d.hero.features[i];
                return (
                  <div
                    key={i}
                    className="absolute left-1/2 top-1/2 h-[var(--w)] w-[var(--w)] [margin-left:calc(var(--w)/-2)] [margin-top:calc(var(--w)/-2)] [backface-visibility:hidden]"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: `rotateY(${(i * STEP).toFixed(4)}deg) translateZ(var(--r))`,
                    }}
                  >
                    <div
                      className="group relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_translateZ(var(--lift,0px))] hover:[--lift:46px]"
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") hovering.current = true;
                      }}
                      onPointerMove={(e) => {
                        if (e.pointerType !== "mouse") return;
                        const el = e.currentTarget;
                        const r = el.getBoundingClientRect();
                        const px = (e.clientX - r.left) / r.width;
                        const py = (e.clientY - r.top) / r.height;
                        el.style.setProperty("--rx", `${((0.5 - py) * 16).toFixed(2)}deg`);
                        el.style.setProperty("--ry", `${((px - 0.5) * 18).toFixed(2)}deg`);
                        el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
                        el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
                      }}
                      onPointerLeave={(e) => {
                        hovering.current = false;
                        const el = e.currentTarget;
                        el.style.setProperty("--rx", "0deg");
                        el.style.setProperty("--ry", "0deg");
                      }}
                    >
                      {/* Card face: art + glare + holo foil (flattened plane) */}
                      <div
                        ref={(el) => {
                          faceRefs.current[i] = el;
                        }}
                        className="absolute inset-0 transition-[filter] duration-300"
                      >
                        <div
                          aria-hidden
                          className="absolute inset-[6%] rounded-[12%] transition-shadow duration-500 group-hover:[box-shadow:0_40px_70px_-10px_var(--glow)]"
                          style={
                            {
                              "--glow": GLOWS[i % GLOWS.length],
                              boxShadow: `0 26px 50px -18px ${GLOWS[i % GLOWS.length]}`,
                            } as React.CSSProperties
                          }
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.img}
                          alt=""
                          draggable={false}
                          loading="lazy"
                          className="relative h-full w-full object-contain"
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
                          style={{
                            background:
                              "radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.95),transparent 55%)",
                            WebkitMaskImage: `url(${item.img})`,
                            maskImage: `url(${item.img})`,
                            WebkitMaskSize: "100% 100%",
                            maskSize: "100% 100%",
                          }}
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-color-dodge transition-opacity duration-300 group-hover:opacity-50"
                          style={{
                            background:
                              "linear-gradient(115deg,transparent 30%,rgba(255,170,230,.7) 43%,rgba(160,210,255,.7) 50%,rgba(255,235,150,.7) 57%,transparent 70%)",
                            backgroundSize: "260% 100%",
                            backgroundPosition: "var(--gx,50%) 50%",
                            WebkitMaskImage: `url(${item.img})`,
                            maskImage: `url(${item.img})`,
                            WebkitMaskSize: "100% 100%",
                            maskSize: "100% 100%",
                          }}
                        />
                      </div>

                      {/* Floating arrow chip — its own depth layer */}
                      {item.href && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute right-[9%] top-[9%] flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[#B4246A] opacity-0 shadow-[0_10px_24px_rgba(180,36,106,.35)] backdrop-blur-md transition-all duration-300 group-hover:opacity-100 [transform:translateZ(0px)] group-hover:[transform:translateZ(70px)_scale(1.05)]"
                        >
                          <ArrowUpRight size={18} strokeWidth={2.4} />
                        </span>
                      )}

                      {item.href ? (
                        <AuthAwareLink
                          signedOutHref="/sign-in"
                          signedInHref={item.href}
                          aria-label={`${f.title} — ${f.sub}`}
                          draggable={false}
                          className="absolute inset-[4%] rounded-[12%]"
                          style={{ transform: "translateZ(2px)" }}
                        />
                      ) : (
                        <span
                          role="img"
                          aria-label={`${f.title} — ${f.sub}`}
                          className="absolute inset-[4%]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="mt-2 flex flex-col items-center gap-4 sm:mt-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#8F29DD]/20 bg-white/80 text-[#8F29DD] shadow-[0_8px_22px_rgba(143,41,221,.15)] backdrop-blur-md transition hover:scale-105 hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2" role="tablist">
              {SHOWCASE.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={d.hero.features[i].title}
                  onClick={() => goTo(i)}
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === active ? 28 : 10,
                    background:
                      i === active
                        ? "linear-gradient(90deg,#8F29DD,#D6336C)"
                        : "rgba(143,41,221,.22)",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#8F29DD]/20 bg-white/80 text-[#8F29DD] shadow-[0_8px_22px_rgba(143,41,221,.15)] backdrop-blur-md transition hover:scale-105 hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <p className="text-[13px] tracking-[.02em] text-[#5B5570]">{d.explore.hint}</p>
        </div>
      </div>
    </section>
  );
}
