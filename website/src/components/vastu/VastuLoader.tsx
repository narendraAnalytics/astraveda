"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A slowly rotating compass rose with a steadier inner needle — "studying the
// space" as a directional sweep, distinct from the other tools' loaders.
export default function VastuLoader({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-7">
      <style>{`
        @keyframes av-vastu-spin { to { transform: rotate(360deg); } }
        @keyframes av-vastu-needle { 0%,100% { transform: rotate(-18deg);} 50% { transform: rotate(28deg);} }
      `}</style>
      <div className="relative w-[130px] h-[130px]">
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed border-[#c2571f]/40"
          style={reduceMotion ? undefined : { animation: "av-vastu-spin 14s linear infinite" }}
        />
        <div className="absolute inset-[14px] rounded-full border border-[#c2571f]/25 bg-[radial-gradient(circle,#fff7ef,#fbeee2)]" />
        {["N", "E", "S", "W"].map((d, i) => (
          <span
            key={d}
            className="absolute text-[10px] font-black text-[#a4622f]"
            style={{
              left: i === 1 ? "auto" : i === 3 ? 4 : "50%",
              right: i === 1 ? 4 : "auto",
              top: i === 0 ? 0 : i === 2 ? "auto" : "50%",
              bottom: i === 2 ? 0 : "auto",
              transform: i === 0 || i === 2 ? "translateX(-50%)" : "translateY(-50%)",
            }}
          >
            {d}
          </span>
        ))}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={reduceMotion ? undefined : { animation: "av-vastu-needle 3.2s ease-in-out infinite" }}
        >
          <div className="w-[5px] h-[70px] rounded-full" style={{ background: "linear-gradient(180deg,#c2571f 50%,#e0932f 50%)" }} />
        </div>
        <div className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4a2f20] ring-2 ring-white" />
      </div>
      <p className="text-[14px] text-[#7a5a3f]">
        {label}
        {dots}
      </p>
    </div>
  );
}
