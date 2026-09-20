"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A glowing diya — the bright, warm loader for the whole /puja section.
export default function PujaLoader({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <style>{`
        @keyframes av-diya-glow { 0%,100% { transform: scale(.9); opacity:.6; } 50% { transform: scale(1.18); opacity:1; } }
        @keyframes av-diya-flick { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-4px) rotate(2deg); } }
      `}</style>
      <div className="relative w-[110px] h-[110px] flex items-center justify-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,196,90,.75) 0%, rgba(255,160,90,.35) 45%, transparent 72%)",
            ...(reduce ? {} : { animation: "av-diya-glow 2.2s ease-in-out infinite" }),
          }}
        />
        <span className="relative text-[52px]" style={reduce ? undefined : { animation: "av-diya-flick 1.6s ease-in-out infinite" }}>
          🪔
        </span>
      </div>
      <p className="text-[14px] text-[#8b6f62]">
        {label}
        {dots}
      </p>
    </div>
  );
}
