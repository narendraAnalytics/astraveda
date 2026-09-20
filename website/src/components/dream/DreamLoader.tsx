"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A crescent moon with a slowly orbiting star, over a soft indigo halo —
// "reading the dream" as a night-sky moment rather than a generic spinner.
export default function DreamLoader({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-7">
      <style>{`
        @keyframes av-dream-orbit { to { transform: rotate(360deg); } }
        @keyframes av-dream-halo { 0%,100% { transform:scale(.94); opacity:.6;} 50% { transform:scale(1.1); opacity:1;} }
      `}</style>
      <div className="relative w-[120px] h-[120px] flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(109,40,217,.55) 0%, rgba(79,70,229,.3) 45%, transparent 72%)",
            ...(reduceMotion ? {} : { animation: "av-dream-halo 3s ease-in-out infinite" }),
          }}
        />
        <div
          className="absolute inset-0"
          style={reduceMotion ? undefined : { animation: "av-dream-orbit 6s linear infinite" }}
        >
          <span className="absolute left-1/2 -top-0.5 -translate-x-1/2 text-[14px] text-[#6d28d9]">✦</span>
        </div>
        <span className="relative text-[44px]">🌙</span>
      </div>
      <p className="text-[14px] text-[#4a4870]">
        {label}
        {dots}
      </p>
    </div>
  );
}
