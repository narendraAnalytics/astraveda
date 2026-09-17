"use client";

import { Apple, PlayCircle } from "lucide-react";
import Reveal from "./Reveal";

export default function DownloadCTA() {
  return (
    <section
      data-nav-theme="light"
      className="relative bg-[#FFFAF2] px-6 sm:px-9 pt-20 sm:pt-24 pb-24 sm:pb-28"
    >
      <Reveal className="max-w-[1100px] mx-auto">
        <div
          className="relative overflow-hidden rounded-[28px] px-8 sm:px-16 py-14 sm:py-16 text-center"
          style={{
            background:
              "linear-gradient(135deg,#1B0F3D 0%,#8F29DD 45%,#D0447E 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-80"
            style={{
              background:
                "radial-gradient(55% 75% at 18% 105%, rgba(244,210,138,.35), transparent 70%), radial-gradient(45% 60% at 90% -10%, rgba(167,43,230,.45), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(28px,3.6vw,40px)] leading-[1.15] text-white font-medium mb-4">
              Your stars are one tap away
            </h2>
            <p className="text-[15px] leading-[1.7] text-white/80 max-w-[480px] mx-auto mb-9">
              Download AstraVeda and get your first Kundli reading, daily
              horoscope, and cosmic guidance — free to start.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full font-semibold text-[14.5px] text-[#241505] shadow-[0_8px_22px_rgba(0,0,0,.25)] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
              >
                <Apple size={20} /> App Store
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full font-medium text-[14.5px] text-white border border-white/35 bg-white/10 backdrop-blur-md transition-colors duration-300 hover:bg-white/[.18]"
              >
                <PlayCircle size={20} /> Google Play
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
