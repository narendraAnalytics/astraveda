"use client";

import { motion } from "framer-motion";

// "N of C booked · M left" with a thin bar that fills on mount. Turns coral
// when the last few places are going.
export default function CapacityBar({
  booked,
  capacity,
  label = "today",
}: {
  booked: number;
  capacity: number;
  label?: string;
}) {
  const pct = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : 0;
  const remaining = Math.max(0, capacity - booked);
  const tight = remaining <= Math.max(3, capacity * 0.15);

  return (
    <div>
      <div className="h-[6px] rounded-full bg-[#F6E6CE] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tight ? "linear-gradient(90deg,#F0793E,#E2574F)" : "linear-gradient(90deg,#F3B54A,#E0932F)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className="text-[11.5px] text-[#8b6f52] mt-1.5">
        <b className="text-[#6e4a20]">{booked}</b> of {capacity} booked {label}
        <span className="mx-1.5 text-[#d8bd97]">·</span>
        <b className={tight ? "text-[#D9483B]" : "text-[#6e4a20]"}>{remaining} left</b>
      </p>
    </div>
  );
}
