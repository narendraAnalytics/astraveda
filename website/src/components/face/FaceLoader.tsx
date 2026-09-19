"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function FaceLoader({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative w-[100px] h-[100px] flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-dashed"
          style={{ borderColor: "#0f8a7e55" }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
        />
        <span className="text-[38px]">🧑‍🦱</span>
      </div>
      <p className="text-[14px] text-[#5B5570]">
        {label}
        {dots}
      </p>
    </div>
  );
}
