"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";
import { TOOL_IMAGES } from "@/lib/site";

const TOOLS = [
  {
    image: TOOL_IMAGES.kundli,
    title: "My Kundli",
    price: "₹15",
    desc: "Self-hosted Vimshottari Dasha birth chart with 16 divisional views, computed with Swiss Ephemeris.",
    accent: "#8F29DD",
    accent2: "#A72BE6",
  },
  {
    image: TOOL_IMAGES.palm,
    title: "Palm Reading",
    price: "₹40",
    desc: "Hasta Samudrika insights from a live camera scan or a guided 4-step questionnaire.",
    accent: "#D0447E",
    accent2: "#F0629A",
  },
  {
    image: TOOL_IMAGES.face,
    title: "Face Reading",
    price: "₹45",
    desc: "Mukha Samudrika personality insights from a selfie, read by AI vision.",
    accent: "#2FA7A0",
    accent2: "#4FD3C4",
  },
  {
    image: TOOL_IMAGES.aura,
    title: "Aura Scan",
    price: "₹60",
    desc: "A selfie and a short energy quiz reveal your aura's colour palette and a 7-chakra reading.",
    accent: "#8B5CF6",
    accent2: "#B79CFF",
  },
  {
    image: TOOL_IMAGES.dream,
    title: "Dream Interpreter",
    price: "₹30",
    desc: "Describe a dream in your own words and get a structured Vedic interpretation.",
    accent: "#5B5FEF",
    accent2: "#8B8FFF",
  },
  {
    image: TOOL_IMAGES.vastu,
    title: "Vastu AI",
    price: "₹150",
    desc: "A room photo plus your 8-direction input returns a score, element balance, and non-demolition remedies.",
    accent: "#C1653D",
    accent2: "#E28F63",
  },
  {
    image: TOOL_IMAGES.ask,
    title: "Ask AstraVeda",
    price: "₹99",
    desc: "A real outbound AI voice call — book now or schedule a slot for a live spoken reading.",
    accent: "#A72BE6",
    accent2: "#D26BFF",
  },
  {
    image: TOOL_IMAGES.puja,
    title: "Puja & Temples",
    price: "₹100–450",
    desc: "Book real temples and puja types with live capacity tracking and a QR e-pass.",
    accent: "#C18426",
    accent2: "#F0B94F",
  },
];

export default function Services() {
  return (
    <section
      id="toolkit"
      data-nav-theme="light"
      className="relative bg-[#FFFAF2] py-24 sm:py-28 px-6 sm:px-9"
    >
      <div className="max-w-[1200px] mx-auto">
        <Reveal className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#8F29DD]/25 bg-[#8F29DD]/[.06] text-[#8F29DD] text-[13px] font-medium tracking-[.02em] mb-5">
            Your Complete Toolkit
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(30px,4vw,44px)] leading-[1.1] text-[#1B1730] font-medium mb-4">
            Every reading, one app,
            <br />
            <span
              className="italic bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #8F29DD, #D0447E, #E9BE6C)",
              }}
            >
              powered by real AI
            </span>
          </h2>
          <p className="text-[15.5px] leading-[1.65] text-[#5B5570]">
            No third-party astrology API — every chart is computed on our own
            Swiss Ephemeris engine, then written into a natural-language
            reading by AI.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-14 pt-9">
          {TOOLS.map((tool, i) => (
            <Reveal key={tool.title} delay={i * 0.06} y={22} className="h-full">
              <div
                className="group relative h-full flex flex-col items-center gap-3 text-center pt-14 pb-6 px-5 rounded-[26px] transition-all duration-300 ease-out hover:-translate-y-2"
                style={{
                  background: `linear-gradient(165deg, ${tool.accent}1F 0%, ${tool.accent2}10 45%, #FFFFFF 100%)`,
                  border: `1px solid ${tool.accent}30`,
                  boxShadow: `0 4px 18px ${tool.accent}14`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 22px 44px ${tool.accent}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 4px 18px ${tool.accent}14`;
                }}
              >
                <motion.div
                  className="absolute -top-9 w-[76px] h-[76px] rounded-full p-[3px]"
                  style={{
                    background: `linear-gradient(135deg, ${tool.accent}, ${tool.accent2})`,
                    boxShadow: `0 8px 24px ${tool.accent}55`,
                  }}
                  animate={{ y: [0, -7, 0], rotate: [0, 3, -3, 0] }}
                  transition={{
                    duration: 5.5 + (i % 3),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.35,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-[#FFFAF2] p-[3px] overflow-hidden">
                    <img
                      src={tool.image}
                      alt={tool.title}
                      className="w-full h-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                </motion.div>

                <h3 className="text-[17px] font-semibold text-[#1B1730] mt-2">
                  {tool.title}
                </h3>

                <span
                  className="text-[12px] font-semibold px-3 py-1 rounded-full whitespace-nowrap text-white"
                  style={{
                    background: `linear-gradient(90deg, ${tool.accent}, ${tool.accent2})`,
                  }}
                >
                  {tool.price}
                </span>

                <p className="text-[13.5px] leading-[1.6] text-[#5B5570] flex-1">
                  {tool.desc}
                </p>

                <span
                  className="pointer-events-none absolute inset-x-6 bottom-3 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${tool.accent}, transparent)`,
                  }}
                />
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-[#C1653D] bg-[#C1653D]/[.08] border border-[#C1653D]/20">
            🪔 Virtual Puja — Free
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-[#8F29DD] bg-[#8F29DD]/[.08] border border-[#8F29DD]/20">
            🌤 Daily Horoscope — Free
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-[#2FA7A0] bg-[#2FA7A0]/[.08] border border-[#2FA7A0]/20">
            🌐 7 Languages Supported
          </span>
        </Reveal>
      </div>
    </section>
  );
}
