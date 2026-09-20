"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Clock, MapPin, Sun } from "lucide-react";

import { useTemples } from "@/hooks/use-temples";
import { rupees, type PujaItem } from "@/lib/puja";
import CapacityBar from "@/components/puja/CapacityBar";
import { themeFor, type TempleTheme } from "@/components/puja/pujaTheme";

export default function TempleView() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { items, loading } = useTemples();
  const temple = useMemo(() => items.find((t) => t.id === id), [items, id]);

  if (loading && !temple) {
    return <div className="h-[260px] rounded-[30px] bg-[#FFF3E0] animate-pulse" />;
  }
  if (!temple) {
    return (
      <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
        <p className="text-[36px] mb-2">🛕</p>
        <p className="text-[14px] text-[#8b6f62] mb-4">That temple could not be found.</p>
        <button type="button" onClick={() => router.push("/puja")} className="text-[13.5px] font-bold text-[#C2571F]">
          ← All temples
        </button>
      </div>
    );
  }

  const th = themeFor(temple.slug);

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/puja")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8b6f62] hover:text-[#3d2418] transition-colors mb-4"
      >
        <span aria-hidden>←</span> All temples
      </button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-[32px] px-6 sm:px-10 py-9 border"
        style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})`, borderColor: `${th.accent}26`, boxShadow: `0 20px 50px ${th.accent}1c` }}
      >
        <span aria-hidden className="absolute -right-14 -top-16 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.8), transparent 68%)" }} />
        <span aria-hidden className="absolute right-10 top-1/2 -translate-y-1/2 text-[92px] sm:text-[120px] opacity-90 select-none drop-shadow-[0_14px_22px_rgba(0,0,0,.12)]">
          {th.glyph}
        </span>
        <div className="relative max-w-[560px] pr-20 sm:pr-40">
          <span
            className="inline-block text-[10.5px] font-extrabold uppercase tracking-[.08em] rounded-full px-3 py-1 bg-white/85 mb-3"
            style={{ color: th.accent }}
          >
            {th.tradition}
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,40px)] leading-[1.1] font-medium text-[#3d2418]">
            {temple.name}
          </h1>
          <p className="flex items-center gap-1.5 text-[13px] text-[#6b5647] mt-2">
            <MapPin size={13} style={{ color: th.accent }} />
            {temple.deity} · {temple.city}, {temple.state}
          </p>
          {temple.about && <p className="text-[14.5px] leading-[1.75] text-[#5c4a3d] mt-4">{temple.about}</p>}
        </div>
      </motion.div>

      <h2 className="flex items-center gap-2.5 mt-9 mb-4 font-[family-name:var(--font-display)] text-[23px] font-medium text-[#3d2418]">
        <span className="w-1 h-6 rounded-full" style={{ background: `linear-gradient(${th.accent}, ${th.accent2})` }} />
        Choose a seva
      </h2>

      <div className="grid md:grid-cols-2 gap-5">
        {temple.pujas.map((p, i) => (
          <SevaCard
            key={p.id}
            puja={p}
            theme={th}
            index={i}
            onBook={() => router.push(`/puja/book?pujaId=${p.id}&templeId=${temple.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function SevaCard({ puja, theme: th, index, onBook }: { puja: PujaItem; theme: TempleTheme; index: number; onBook: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.07 }}
      whileHover={{ y: -4 }}
      className="flex flex-col rounded-[24px] bg-white border p-5 sm:p-6"
      style={{ borderColor: `${th.accent}22`, boxShadow: `0 6px 22px ${th.accent}12` }}
    >
      <div className="flex items-start gap-3">
        <h3 className="flex-1 font-[family-name:var(--font-display)] text-[19px] font-medium text-[#3d2418] leading-snug">{puja.name}</h3>
        <div className="text-right flex-shrink-0 rounded-[14px] px-3 py-2" style={{ background: `${th.accent}10` }}>
          <p className="text-[19px] font-black leading-none" style={{ color: th.accent }}>
            {rupees(puja.price_per_person_paise)}
          </p>
          <p className="text-[10px] font-semibold text-[#8b6f62] mt-1">per person</p>
        </div>
      </div>

      {puja.description && <p className="text-[13.5px] leading-[1.65] text-[#6b5647] mt-3">{puja.description}</p>}
      {puja.benefits && (
        <p className="flex items-start gap-2 text-[12.5px] italic text-[#8a5a2a] mt-3">
          <Sun size={13} className="mt-0.5 flex-shrink-0" style={{ color: th.accent2 }} />
          {puja.benefits}
        </p>
      )}

      <div className="mt-4">
        <CapacityBar booked={puja.booked_today} capacity={puja.daily_capacity} />
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: `${th.accent}18` }}>
        {puja.duration_note ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8b6f62]">
            <Clock size={13} /> {puja.duration_note}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onBook}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full font-bold text-[13.5px] text-white transition-all hover:brightness-105 hover:gap-3"
          style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.accent2})`, boxShadow: `0 8px 20px ${th.accent}40` }}
        >
          Book <ArrowRight size={15} />
        </button>
      </div>
    </motion.div>
  );
}
