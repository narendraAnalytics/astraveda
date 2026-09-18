"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Fixed positions around the 140px ring (center 70,70, radius 62), computed
// once ahead of time — NOT with Math.sin/cos at render, since Node's and the
// browser's math libraries can round transcendental functions differently in
// their last few decimal digits, which React flags as a hydration mismatch
// on the resulting inline style.
const GLYPHS: { glyph: string; left: number; top: number }[] = [
  { glyph: "♈", left: 62, top: -2 },
  { glyph: "♉", left: 93, top: 6.31 },
  { glyph: "♊", left: 115.69, top: 29 },
  { glyph: "♋", left: 124, top: 60 },
  { glyph: "♌", left: 115.69, top: 91 },
  { glyph: "♍", left: 93, top: 113.69 },
  { glyph: "♎", left: 62, top: 122 },
  { glyph: "♏", left: 31, top: 113.69 },
  { glyph: "♐", left: 8.31, top: 91 },
  { glyph: "♑", left: 0, top: 60 },
  { glyph: "♒", left: 8.31, top: 29 },
  { glyph: "♓", left: 31, top: 6.31 },
];

export default function ZodiacLoader({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative w-[140px] h-[140px]">
        <motion.div
          className="absolute inset-0"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        >
          {GLYPHS.map((g) => (
            <span
              key={g.glyph}
              className="absolute text-[16px] text-[#C18426]"
              style={{ left: g.left, top: g.top }}
            >
              {g.glyph}
            </span>
          ))}
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center text-[24px] text-[#D6336C]">
          ✦
        </div>
      </div>
      <p className="text-[14px] text-[#5B5570]">
        {label}
        {dots}
      </p>
    </div>
  );
}
