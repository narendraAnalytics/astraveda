"use client";

import { Mic, PhoneCall, Clock3 } from "lucide-react";
import Reveal from "./Reveal";

export default function VoiceSpotlight() {
  return (
    <section
      id="ask-astraveda"
      data-nav-theme="light"
      className="relative bg-[#FFFAF2] py-24 sm:py-28 px-6 sm:px-9 overflow-hidden"
    >
      <div className="max-w-[1200px] mx-auto">
        <div
          className="relative rounded-[32px] overflow-hidden px-7 sm:px-14 py-14 sm:py-20"
          style={{
            background: "linear-gradient(135deg,#1B0F3A 0%,#3B1667 55%,#5A1E8C 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(45% 60% at 85% 20%, rgba(244,210,138,.18), transparent 70%)",
            }}
          />

          <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-10 md:gap-16">
            <Reveal>
              <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 mx-auto md:mx-0">
                {/* Rotating conic-gradient orb glow */}
                <span
                  className="absolute inset-0 rounded-full av-orb-spin opacity-70"
                  style={{
                    background:
                      "conic-gradient(from 0deg, rgba(244,210,138,.55), transparent 25%, transparent 50%, rgba(167,43,230,.45) 65%, transparent 85%, rgba(244,210,138,.55))",
                    filter: "blur(6px)",
                  }}
                />
                <span className="absolute inset-[6px] rounded-full bg-[#2A1650]" />

                <span className="absolute inset-0 rounded-full border border-[rgba(244,210,138,.35)] av-pulse-ring" />
                <span
                  className="absolute inset-3 rounded-full border border-[rgba(244,210,138,.25)] av-pulse-ring"
                  style={{ animationDelay: ".7s" }}
                />

                {/* Mini waveform bars around the mic */}
                <div className="absolute inset-0" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="absolute left-1/2 top-1/2 w-[3px] rounded-full bg-[#F4D28A] av-voice-bar"
                      style={{
                        height: 10,
                        transform: `rotate(${(i - 2) * 26}deg) translateY(-46px)`,
                        animationDelay: `${i * 0.15}s`,
                        opacity: 0.75,
                      }}
                    />
                  ))}
                </div>

                <span className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[rgba(244,210,138,.14)] border border-[rgba(244,210,138,.4)] text-[#F4D28A] av-mic-breathe">
                  <Mic size={30} strokeWidth={1.8} />
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="text-center md:text-left">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(244,210,138,.35)] bg-[rgba(244,210,138,.1)] text-[#F4D28A] text-[13px] font-medium tracking-[.02em] mb-5">
                  Ask AstraVeda · ₹99
                </span>
                <h2 className="font-[family-name:var(--font-display)] text-[clamp(28px,3.6vw,40px)] leading-[1.15] text-[#FFF7E6] font-medium mb-4">
                  A real phone call with your
                  <br className="hidden md:block" /> AI astrologer
                </h2>
                <p className="text-[15px] leading-[1.7] text-[rgba(255,247,230,.72)] max-w-[520px] mx-auto md:mx-0 mb-8">
                  No chat window, no waiting room — AstraVeda places an actual
                  outbound voice call, confirms your birth details, and
                  delivers your reading live on the same call. Call now or
                  schedule an IST time slot.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-[14.5px] text-[#241505] shadow-[0_8px_24px_rgba(244,210,138,.35)]"
                    style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
                  >
                    <PhoneCall size={16} /> Call Me Now
                  </a>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[rgba(255,247,230,.3)] font-medium text-[14.5px] text-[#FFF7E6] bg-[rgba(255,247,230,.06)]"
                  >
                    <Clock3 size={16} /> Schedule a Time
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes av-pulse-ring {
          0% { transform: scale(1); opacity: .8; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .av-pulse-ring { animation: av-pulse-ring 2.6s ease-out infinite; }

        @keyframes av-orb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .av-orb-spin { animation: av-orb-spin 8s linear infinite; }

        @keyframes av-mic-breathe {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(244,210,138,0); }
          50% { transform: scale(1.06); box-shadow: 0 0 22px rgba(244,210,138,.45); }
        }
        .av-mic-breathe { animation: av-mic-breathe 3.2s ease-in-out infinite; }

        @keyframes av-voice-bar {
          0%, 100% { height: 7px; opacity: .5; }
          50% { height: 18px; opacity: 1; }
        }
        .av-voice-bar { animation: av-voice-bar 1.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .av-pulse-ring, .av-orb-spin, .av-mic-breathe, .av-voice-bar {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
