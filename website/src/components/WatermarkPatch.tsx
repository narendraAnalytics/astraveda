"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LOGO_URL } from "@/lib/site";

// Our generated videos (intro + both hero clips) carry a small sparkle watermark fixed at
// ~(90.6%, 83.3%) of the 16:9 frame in every frame. This frosted disc + lotus mark covers it.
// It must live INSIDE `CoverStage` so it shares the video's coordinate space.
export function WatermarkPatch() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="absolute flex aspect-square items-center justify-center overflow-hidden rounded-full border border-[#F4D28A]/70 backdrop-blur-[16px]"
      style={{
        left: "90.6%",
        top: "83.3%",
        width: "6.9%",
        x: "-50%",
        y: "-50%",
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,250,240,.72), rgba(255,236,200,.5))",
        boxShadow: "0 0 26px rgba(244,210,138,.55), inset 0 0 12px rgba(255,255,255,.5)",
      }}
      animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="" className="h-full w-full scale-[1.45] object-contain" />
    </motion.div>
  );
}

// A 16:9 box that covers its container exactly like `object-cover` (with an optional
// object-position), so a video and its WatermarkPatch stay locked together at any size.
// The parent must be `position:absolute/relative` with `container-type: size`
// (Tailwind: `[container-type:size]`) so the cq units resolve to the parent's box.
export function CoverStage({
  children,
  posX = 0.5,
  posY = 0.5,
  className = "",
}: {
  children: React.ReactNode;
  posX?: number;
  posY?: number;
  className?: string;
}) {
  const sw = "max(100cqw, 177.78cqh)";
  const sh = "max(56.25cqw, 100cqh)";
  return (
    <div
      className={`absolute ${className}`}
      style={{
        width: sw,
        height: sh,
        left: `calc((100cqw - ${sw}) * ${posX})`,
        top: `calc((100cqh - ${sh}) * ${posY})`,
      }}
    >
      {children}
    </div>
  );
}
