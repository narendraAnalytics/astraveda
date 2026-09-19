"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A luminous pulsing glow — reads more "reading energy" than a generic
// spinner (per 2026 aura-app research), distinct from Kundali/Palm/Face's
// rotating-ring loaders.
export default function AuraLoader({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <style>{`
        @keyframes av-aura-glow {
          0%, 100% { transform: scale(0.92); opacity: 0.55; filter: blur(2px); }
          50% { transform: scale(1.12); opacity: 1; filter: blur(0px); }
        }
      `}</style>
      <div className="relative w-[100px] h-[100px] flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, #c026d3 0%, #7c3aed 45%, transparent 72%)",
            ...(reduceMotion ? { opacity: 0.85 } : { animation: "av-aura-glow 2.4s ease-in-out infinite" }),
          }}
        />
        <span className="relative text-[34px]">✨</span>
      </div>
      <p className="text-[14px] text-[#5f4a7a]">
        {label}
        {dots}
      </p>
    </div>
  );
}
