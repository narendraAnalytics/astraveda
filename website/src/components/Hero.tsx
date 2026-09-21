"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Languages as LanguagesIcon, PhoneCall } from "lucide-react";
import { HERO_VIDEOS, VIDEO_URL } from "@/lib/site";
import AuthAwareLink from "./auth/AuthAwareLink";
import { useI18n } from "@/i18n/I18nProvider";

export default function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);
  const { d } = useI18n();
  const STATS = [
    { value: "16+", label: d.hero.statCharts, Icon: Sparkles },
    { value: "7", label: d.hero.statLanguages, Icon: LanguagesIcon },
    { value: "12/min", label: d.hero.statConsult, Icon: PhoneCall },
  ];
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

  return (
    <div
      id="home"
      data-nav-theme="dark"
      className="av-scene relative w-full min-h-[840px] overflow-hidden font-[family-name:var(--font-body)]"
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
            <span className="text-[14px]">✦</span> {d.hero.badge}
          </div>

          <h1 className="font-[family-name:var(--font-display)] font-medium text-[clamp(40px,5.4vw,68px)] leading-[1.06] text-[#FFF7E6] mb-[22px] tracking-[.005em]">
            {d.hero.titleA}
            <br />
            {d.hero.titleB ? `${d.hero.titleB} ` : ""}
            <span className="text-[#F4D28A] italic">{d.hero.titleStars}</span>
            {d.hero.titleC ? ` ${d.hero.titleC}` : ""}
          </h1>

          <p className="text-[clamp(16px,1.5vw,19px)] text-[rgba(255,247,230,.9)] font-medium mb-[14px] tracking-[.01em]">
            {d.hero.tagline}
          </p>

          <p className="text-[15.5px] leading-[1.65] text-[rgba(255,247,230,.68)] mb-9 max-w-[480px]">
            {d.hero.body}
          </p>

          <div className="av-cta-row flex items-center gap-4 flex-wrap">
            <AuthAwareLink
              signedOutHref="/sign-in"
              signedInHref="/readings"
              className="inline-flex items-center gap-[10px] px-[30px] py-4 rounded-[100px] font-semibold text-[15.5px] text-[#241505] shadow-[0_8px_28px_rgba(244,210,138,.4)]"
              style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
            >
              {d.hero.cta} <span>→</span>
            </AuthAwareLink>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center gap-[10px] px-7 py-4 rounded-[100px] border border-[rgba(255,247,230,.3)] backdrop-blur-md font-medium text-[15.5px] text-[#FFF7E6] bg-[rgba(255,247,230,.06)]"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[rgba(255,247,230,.6)] text-[9px]">
                ▶
              </span>{" "}
              {d.hero.watch}
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
              aria-label={d.hero.closeVideo}
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
