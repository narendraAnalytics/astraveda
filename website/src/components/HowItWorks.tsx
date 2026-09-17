"use client";

import { CalendarClock, ScanFace, Wand2, Languages } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";

const CYCLE = 4.4;

const STEPS = [
  {
    icon: CalendarClock,
    title: "Share your details",
    desc: "Enter your birth details, snap a selfie, or describe a dream — whatever the reading needs.",
  },
  {
    icon: ScanFace,
    title: "AI reads the signal",
    desc: "Gemini Vision extracts features from photos; our own Swiss Ephemeris engine computes your chart.",
  },
  {
    icon: Wand2,
    title: "Sarvam writes it up",
    desc: "The computed facts become a natural, human-sounding reading — never a generic template.",
  },
  {
    icon: Languages,
    title: "Read it your way",
    desc: "Get your reading in one of 7 languages, or ask a follow-up on a live AI voice call.",
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      data-nav-theme="dark"
      className="relative bg-[#08113A] py-24 sm:py-28 px-6 sm:px-9 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(143,41,221,.16), transparent 70%)",
        }}
      />

      <div className="relative max-w-[1100px] mx-auto">
        <Reveal className="max-w-2xl mx-auto text-center mb-16 sm:mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(244,210,138,.3)] bg-[rgba(244,210,138,.08)] text-[#F4D28A] text-[13px] font-medium tracking-[.02em] mb-5">
            How It Works
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(30px,4vw,44px)] leading-[1.1] text-[#FFF7E6] font-medium mb-4">
            From your details to a reading,
            <br />
            <span className="italic text-[#F4D28A]">in seconds</span>
          </h2>
        </Reveal>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px overflow-visible">
            <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[rgba(244,210,138,.3)] to-transparent" />
            {!reduceMotion && (
              <motion.div
                className="absolute top-1/2 h-[3px] w-[9%] -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(244,210,138,.95), transparent)",
                  boxShadow: "0 0 14px 3px rgba(244,210,138,.75)",
                }}
                animate={{ left: ["-9%", "100%"] }}
                transition={{ duration: CYCLE, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const frac = i / (STEPS.length - 1);
            const t0 = Math.max(0, frac - 0.05);
            const t2 = Math.min(1, frac + 0.05);
            return (
              <Reveal key={step.title} delay={i * 0.12} y={24}>
                <div className="relative flex flex-col items-center text-center gap-4">
                  <motion.span
                    className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-[#08113A] border border-[rgba(244,210,138,.35)] text-[#F4D28A]"
                    initial={false}
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            scale: [1, 1, 1.16, 1, 1],
                            boxShadow: [
                              "0 0 0 6px rgba(8,11,58,1)",
                              "0 0 0 6px rgba(8,11,58,1)",
                              "0 0 0 6px rgba(8,11,58,1), 0 0 22px 6px rgba(244,210,138,.6)",
                              "0 0 0 6px rgba(8,11,58,1)",
                              "0 0 0 6px rgba(8,11,58,1)",
                            ],
                          }
                    }
                    style={reduceMotion ? { boxShadow: "0 0 0 6px rgba(8,11,58,1)" } : undefined}
                    transition={
                      reduceMotion
                        ? undefined
                        : {
                            duration: CYCLE,
                            repeat: Infinity,
                            times: [0, t0, frac, t2, 1],
                            ease: "easeInOut",
                          }
                    }
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </motion.span>
                  <div className="text-[12px] font-semibold tracking-[.12em] text-[rgba(244,210,138,.6)]">
                    STEP {i + 1}
                  </div>
                  <h3 className="text-[16.5px] font-semibold text-[#FFF7E6]">
                    {step.title}
                  </h3>
                  <p className="text-[13.5px] leading-[1.6] text-[rgba(255,247,230,.65)] max-w-[220px]">
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
