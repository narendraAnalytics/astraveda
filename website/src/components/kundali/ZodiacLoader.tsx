"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

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
          {GLYPHS.map((g, i) => {
            const angle = (i / GLYPHS.length) * 2 * Math.PI;
            const r = 62;
            const x = 70 + r * Math.sin(angle);
            const y = 70 - r * Math.cos(angle);
            return (
              <span
                key={g}
                className="absolute text-[16px] text-[#F4D28A]"
                style={{ left: x - 8, top: y - 10 }}
              >
                {g}
              </span>
            );
          })}
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center text-[24px] text-[#8F29DD]">
          ✦
        </div>
      </div>
      <p className="text-[14px] text-[rgba(255,247,230,.75)]">
        {label}
        {dots}
      </p>
    </div>
  );
}
