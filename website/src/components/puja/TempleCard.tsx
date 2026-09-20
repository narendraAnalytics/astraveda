"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, MapPin } from "lucide-react";
import { rupees, type Temple } from "@/lib/puja";
import { themeFor } from "./pujaTheme";

// A bright temple card: pastel wash "art" with a floating glyph, the price
// shown INSIDE the card ("from ₹151 / person"), sevas count and an arrow.
export default function TempleCard({
  temple,
  index,
  onOpen,
}: {
  temple: Temple;
  index: number;
  onOpen: () => void;
}) {
  const th = themeFor(temple.slug);
  const from = temple.pujas.reduce(
    (min, p) => Math.min(min, p.price_per_person_paise),
    temple.pujas[0]?.price_per_person_paise ?? 0,
  );

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.06, ease: "easeOut" }}
      whileHover={{ y: -6 }}
      className="group text-left rounded-[26px] bg-white border overflow-hidden transition-shadow"
      style={{
        borderColor: `${th.accent}22`,
        boxShadow: `0 6px 24px ${th.accent}14`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 22px 46px ${th.accent}30`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 6px 24px ${th.accent}14`)}
    >
      <style>{`
        @keyframes av-puja-float { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
        @media (prefers-reduced-motion: reduce) { .av-puja-float { animation: none !important; } }
      `}</style>

      {/* art */}
      <div
        className="relative h-[150px] overflow-hidden flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}
      >
        <span aria-hidden className="absolute -right-8 -top-10 w-40 h-40 rounded-full" style={{ background: `${th.accent}12` }} />
        <span aria-hidden className="absolute -left-10 -bottom-14 w-44 h-44 rounded-full" style={{ background: `${th.accent2}14` }} />
        <span aria-hidden className="absolute inset-6 rounded-full border border-dashed" style={{ borderColor: `${th.accent}26` }} />
        <span
          className="av-puja-float relative text-[58px] leading-none drop-shadow-[0_10px_16px_rgba(0,0,0,.12)]"
          style={{ animation: "av-puja-float 5s ease-in-out infinite", animationDelay: `${(index % 4) * 0.5}s` }}
        >
          {th.glyph}
        </span>
        <span
          className="absolute left-4 top-4 text-[10.5px] font-extrabold uppercase tracking-[.08em] rounded-full px-3 py-1 bg-white/85 backdrop-blur"
          style={{ color: th.accent }}
        >
          {th.tradition}
        </span>
      </div>

      {/* body */}
      <div className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-[19px] font-medium text-[#3d2418] leading-snug">{temple.name}</h3>
        <p className="flex items-center gap-1.5 text-[12px] text-[#8b6f62] mt-1">
          <MapPin size={12} style={{ color: th.accent }} />
          {temple.deity} · {temple.city}, {temple.state}
        </p>
        <p className="text-[13px] leading-[1.6] text-[#6b5647] mt-3 line-clamp-2">{temple.about}</p>

        <div className="flex items-center gap-2.5 mt-4 pt-4 border-t" style={{ borderColor: `${th.accent}18` }}>
          <span className="text-[11.5px] font-bold rounded-full px-3 py-1.5" style={{ background: `${th.accent}14`, color: th.accent }}>
            {temple.pujas.length} seva{temple.pujas.length === 1 ? "" : "s"}
          </span>
          <span className="flex-1 text-[12.5px] text-[#8b6f62]">
            from <b className="text-[#3d2418] text-[14px]">{rupees(from)}</b> / person
          </span>
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform group-hover:rotate-12 group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.accent2})`, boxShadow: `0 6px 14px ${th.accent}44` }}
          >
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
