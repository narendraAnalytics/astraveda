"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { Sparkles, Languages as LanguagesIcon, PhoneCall } from "lucide-react";
import { HERO_VIDEOS, VIDEO_URL } from "@/lib/site";

const FEATURE_STRIP = [
  { icon: "✦", title: "Kundli & Charts", sub: "16 Divisional Views" },
  { icon: "✋", title: "Palmistry", sub: "AI Hand Analysis" },
  { icon: "◎", title: "Face Reading", sub: "Personality Insights" },
  { icon: "⌂", title: "Vastu AI", sub: "Home Harmony" },
  { icon: "❁", title: "Past Life", sub: "Karmic Decode" },
  { icon: "♥", title: "Matchmaking", sub: "Soul Connections" },
  { icon: "🔔", title: "Puja & Temples", sub: "Live & Personalized" },
];

const STATS = [
  { value: "16+", label: "Divisional Charts", Icon: Sparkles },
  { value: "6", label: "Languages", Icon: LanguagesIcon },
  { value: "12/min", label: "Live Consultation", Icon: PhoneCall },
];

type FeatureCardData = { icon: string; title: string; sub: string };

function FeatureCard({ f, i }: { f: FeatureCardData; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 300, damping: 22, mass: 0.6 });
  const rotateY = useSpring(tiltY, { stiffness: 300, damping: 22, mass: 0.6 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    tiltX.set((0.5 - py) * 14);
    tiltY.set((px - 0.5) * 14);
  };

  const handlePointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6, scale: 1.03 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ rotateX, rotateY, transformPerspective: 700 }}
      transition={{
        layout: { type: "spring", stiffness: 260, damping: 26 },
        opacity: { duration: 0.6, ease: "easeOut", delay: 0.15 + i * 0.07 },
        y: { duration: 0.6, ease: "easeOut", delay: 0.15 + i * 0.07 },
        scale: { duration: 0.3, ease: "easeOut" },
      }}
      className="av-feature-card group relative flex flex-col items-center gap-2.5 text-center px-3 py-5 rounded-2xl border border-[rgba(244,210,138,.16)] bg-[rgba(255,247,230,.045)] backdrop-blur-2xl transition-colors duration-300 ease-out hover:border-[rgba(244,210,138,.4)] hover:bg-[rgba(255,247,230,.09)] hover:shadow-[0_16px_36px_rgba(0,0,0,.35)] cursor-pointer"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(244,210,138,.5), transparent 40%, transparent 60%, rgba(244,210,138,.35))",
          padding: 1,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <span
        className="flex items-center justify-center w-10 h-10 rounded-full text-lg text-[#F4D28A] bg-[rgba(244,210,138,.1)] border border-[rgba(244,210,138,.25)] transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6"
        style={{ transform: "translateZ(24px)" }}
      >
        {f.icon}
      </span>
      <div
        className="text-[13px] sm:text-[13.5px] font-semibold text-[#FFF7E6]"
        style={{ transform: "translateZ(16px)" }}
      >
        {f.title}
      </div>
      <div
        className="text-[11px] sm:text-[11.5px] text-[rgba(255,247,230,.62)]"
        style={{ transform: "translateZ(10px)" }}
      >
        {f.sub}
      </div>
      <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(244,210,138,.5)] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </motion.div>
  );
}

export default function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);
  const [cards, setCards] = useState(FEATURE_STRIP);
  const [activeVideo, setActiveVideo] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const handleVideoEnded = () => {
    setActiveVideo((prev) => (prev + 1) % HERO_VIDEOS.length);
  };

  useEffect(() => {
    HERO_VIDEOS.forEach((_, idx) => {
      const el = videoRefs.current[idx];
      if (!el) return;
      if (idx === activeVideo) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  }, [activeVideo]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const id = setInterval(() => {
      setCards((prev) => [...prev.slice(1), prev[0]]);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      id="home"
      data-nav-theme="dark"
      className="av-scene relative w-full min-h-[920px] overflow-hidden font-[family-name:var(--font-body)]"
    >
      {/* Background video slideshow (crossfade) */}
      {HERO_VIDEOS.map((src, idx) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[idx] = el;
          }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out"
          style={{
            objectPosition: "62% 20%",
            transform: "scale(1.08)",
            opacity: idx === activeVideo ? 1 : 0,
            zIndex: idx === activeVideo ? 1 : 0,
          }}
          autoPlay={idx === 0}
          muted
          playsInline
          preload="auto"
          onEnded={idx === activeVideo ? handleVideoEnded : undefined}
        >
          <source src={src} type="video/webm" />
        </video>
      ))}

      {/* Gradient overlay for legibility */}
      <div
        className="av-overlay absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(115deg, rgba(8,11,42,.88) 0%, rgba(8,11,42,.72) 26%, rgba(16,24,61,.32) 46%, rgba(16,24,61,.08) 62%, transparent 78%)",
        }}
      />

      {/* Twinkling particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <span
          className="absolute rounded-full"
          style={{
            top: "14%",
            left: "8%",
            width: 5,
            height: 5,
            background: "#F4D28A",
            boxShadow: "0 0 8px 2px rgba(244,210,138,.7)",
            animation: "av-twinkle 3.2s ease-in-out infinite",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            top: "26%",
            left: "20%",
            width: 3,
            height: 3,
            background: "#FFF7E6",
            boxShadow: "0 0 6px 2px rgba(255,247,230,.6)",
            animation: "av-twinkle 4s ease-in-out infinite .6s",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            top: "60%",
            left: "12%",
            width: 4,
            height: 4,
            background: "#D98BA8",
            boxShadow: "0 0 8px 2px rgba(217,139,168,.6)",
            animation: "av-twinkle 3.6s ease-in-out infinite 1.1s",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            top: "40%",
            left: "30%",
            width: 60,
            height: 60,
            border: "1px solid rgba(244,210,138,.25)",
            animation: "av-float 9s ease-in-out infinite",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            top: "70%",
            left: "26%",
            width: 34,
            height: 34,
            border: "1px solid rgba(109,75,195,.3)",
            animation: "av-float2 7s ease-in-out infinite",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            top: "10%",
            left: "38%",
            width: 2,
            height: 2,
            background: "#FFF7E6",
            boxShadow: "0 0 5px 2px rgba(255,247,230,.7)",
            animation: "av-twinkle 5s ease-in-out infinite .3s",
          }}
        />
      </div>

      {/* Hero copy */}
      <div className="av-hero-wrap relative z-[5] max-w-[1360px] mx-auto flex items-center min-h-[760px] px-7 pt-24 sm:pt-28">
        <div className="av-hero-copy max-w-[600px] pt-5">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[100px] border border-[rgba(244,210,138,.35)] backdrop-blur-md text-[#F4D28A] text-[13px] font-medium tracking-[.02em] mb-[26px] bg-[rgba(244,210,138,.1)]">
            <span className="text-[14px]">✦</span> Step into a Brighter 2026
          </div>

          <h1 className="font-[family-name:var(--font-display)] font-medium text-[clamp(40px,5.4vw,68px)] leading-[1.06] text-[#FFF7E6] mb-[22px] tracking-[.005em]">
            Your Journey,
            <br />
            Written in the <span className="text-[#F4D28A] italic">Stars</span>
          </h1>

          <p className="text-[clamp(16px,1.5vw,19px)] text-[rgba(255,247,230,.9)] font-medium mb-[14px] tracking-[.01em]">
            AI-Powered Astrology. Ancient Wisdom. A Better You.
          </p>

          <p className="text-[15.5px] leading-[1.65] text-[rgba(255,247,230,.68)] mb-9 max-w-[480px]">
            Discover your future, understand your karmas, and unlock life&apos;s
            opportunities with personalized AI-driven astrological insights and
            spiritual guidance.
          </p>

          <div className="av-cta-row flex items-center gap-4 flex-wrap">
            <a
              href="#"
              className="inline-flex items-center gap-[10px] px-[30px] py-4 rounded-[100px] font-semibold text-[15.5px] text-[#241505] shadow-[0_8px_28px_rgba(244,210,138,.4)]"
              style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
            >
              Explore Your Horoscope <span>→</span>
            </a>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center gap-[10px] px-7 py-4 rounded-[100px] border border-[rgba(255,247,230,.3)] backdrop-blur-md font-medium text-[15.5px] text-[#FFF7E6] bg-[rgba(255,247,230,.06)]"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[rgba(255,247,230,.6)] text-[9px]">
                ▶
              </span>{" "}
              Watch Video
            </button>
          </div>

          <div className="av-stats flex items-center gap-9 mt-14 pt-[26px] border-t border-[rgba(255,247,230,.14)]">
            {STATS.map((s) => (
              <div key={s.label} className="group flex items-center gap-3 cursor-pointer">
                <span className="flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-full text-[#F4D28A] bg-[rgba(244,210,138,.1)] border border-[rgba(244,210,138,.25)] transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6">
                  <s.Icon size={16} strokeWidth={2} />
                </span>
                <div>
                  <div className="font-[family-name:var(--font-display)] text-[26px] text-[#F4D28A] font-semibold leading-none">
                    {s.value}
                  </div>
                  <div className="text-[12px] text-[rgba(255,247,230,.6)] mt-1">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature strip */}
      <div className="relative z-[6] max-w-[1360px] mx-auto mt-8 px-7 pb-8">
        <div className="av-feature-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {cards.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>

      {/* Video lightbox */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute -top-10 right-0 text-[#FFF7E6] text-2xl leading-none"
              aria-label="Close video"
            >
              ✕
            </button>
            <video
              className="w-full rounded-2xl shadow-2xl"
              controls
              autoPlay
              playsInline
            >
              <source src={VIDEO_URL} type="video/webm" />
            </video>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .av-nav-links { display: none !important; }
          .av-hero-copy { max-width: 100% !important; padding: 0 24px !important; text-align: left; }
          .av-hero-wrap { padding-top: 132px !important; align-items: flex-start !important; }
          .av-scene { min-height: 760px !important; }
          .av-overlay { background: linear-gradient(180deg, rgba(8,11,42,.72) 0%, rgba(8,11,42,.55) 30%, rgba(16,24,61,.4) 55%, rgba(8,11,42,.85) 100%) !important; }
          .av-stats { flex-wrap: wrap !important; }
        }
        @media (max-width: 560px) {
          .av-cta-row { flex-direction: column !important; align-items: stretch !important; }
          .av-cta-row a, .av-cta-row button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
    </div>
  );
}
