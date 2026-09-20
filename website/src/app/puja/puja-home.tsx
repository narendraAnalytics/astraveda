"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bookmark, Search } from "lucide-react";

import { useTemples } from "@/hooks/use-temples";
import TempleCard from "@/components/puja/TempleCard";
import { themeFor, TRADITIONS, SAFFRON_GRADIENT, type Tradition } from "@/components/puja/pujaTheme";

const FLOATERS = [
  { glyph: "🪔", left: "6%", top: "18%", delay: 0, size: 28 },
  { glyph: "🌼", left: "88%", top: "14%", delay: 0.8, size: 26 },
  { glyph: "🪷", left: "80%", top: "68%", delay: 1.4, size: 30 },
  { glyph: "🔔", left: "12%", top: "72%", delay: 2, size: 24 },
];

export default function PujaHome() {
  const router = useRouter();
  const { items, loading, error } = useTemples();
  const [query, setQuery] = useState("");
  const [tradition, setTradition] = useState<Tradition | "All">("All");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (tradition !== "All" && themeFor(t.slug).tradition !== tradition) return false;
      if (!q) return true;
      return [t.name, t.deity, t.city, t.state].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, query, tradition]);

  return (
    <div>
      {/* Bright marigold header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-[32px] px-6 sm:px-10 py-9 sm:py-11 border border-[#F3C98F]/60 shadow-[0_20px_50px_rgba(224,147,47,.2)]"
        style={{ background: "linear-gradient(135deg,#FFF3D9 0%,#FFE0BC 55%,#FFCFC2 100%)" }}
      >
        <style>{`
          @keyframes av-puja-drift { 0%,100% { transform: translateY(0) scale(1); opacity:.85; } 50% { transform: translateY(-12px) scale(1.08); opacity:1; } }
          @media (prefers-reduced-motion: reduce) { .av-puja-drift { animation: none !important; } }
        `}</style>
        <span aria-hidden className="absolute -right-16 -top-20 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.75), transparent 68%)" }} />
        <span aria-hidden className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,214,160,.7), transparent 68%)" }} />
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            aria-hidden
            className="av-puja-drift absolute hidden sm:block"
            style={{ left: f.left, top: f.top, fontSize: f.size, animation: `av-puja-drift ${4.5 + i}s ease-in-out ${f.delay}s infinite` }}
          >
            {f.glyph}
          </span>
        ))}

        <div className="relative text-center max-w-[560px] mx-auto">
          <span className="inline-flex items-center gap-2 text-[11.5px] font-bold tracking-[.14em] uppercase text-[#B5651D] mb-3">
            <span className="w-6 h-px bg-[#B5651D]/50" /> Seva · Puja · Darshan <span className="w-6 h-px bg-[#B5651D]/50" />
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(30px,4.6vw,44px)] leading-[1.1] font-medium text-[#5c1620]">
            Temples &amp; Puja
          </h1>
          <p className="text-[14.5px] leading-[1.7] text-[#7a4a35] mt-3">
            Book a seva at a sacred temple in your name, and receive a QR e-pass to show on the day.
          </p>
          <button
            type="button"
            onClick={() => router.push("/puja/bookings")}
            className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full font-semibold text-[13.5px] text-white shadow-[0_10px_24px_rgba(224,87,79,.3)] hover:brightness-105 transition-all"
            style={{ background: SAFFRON_GRADIENT }}
          >
            <Bookmark size={15} /> My bookings
          </button>
        </div>
      </motion.div>

      {/* Search + tradition filter */}
      <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C79A63]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a temple, deity or city…"
            className="w-full h-12 rounded-full border border-[#F0D9BC] bg-white pl-11 pr-4 text-[14.5px] text-[#3d2418] placeholder:text-[#B9A48E] focus:border-[#E0932F] focus:outline-none focus:ring-4 focus:ring-[#E0932F]/15 shadow-[0_4px_14px_rgba(224,147,47,.08)]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(["All", ...TRADITIONS] as const).map((t) => {
            const on = tradition === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTradition(t)}
                className={`flex-shrink-0 h-10 px-4 rounded-full text-[12.5px] font-bold border transition-all ${
                  on ? "text-white border-transparent shadow-[0_8px_18px_rgba(224,147,47,.32)]" : "bg-white border-[#F0D9BC] text-[#8b6f62] hover:border-[#E0932F]/60"
                }`}
                style={on ? { background: SAFFRON_GRADIENT } : undefined}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Temples */}
      <div className="mt-6">
        {loading && items.length === 0 ? (
          <div className="grid sm:grid-cols-2 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[330px] rounded-[26px] bg-[#FFF3E0] animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
            <p className="text-[36px] mb-2">🛕</p>
            <p className="text-[14px] text-[#8b6f62]">{error ?? "No temples available right now."}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
            <p className="text-[36px] mb-2">🔍</p>
            <p className="text-[14px] text-[#8b6f62]">No temple matches that search. Try another name, deity or city.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {shown.map((t, i) => (
              <TempleCard key={t.id} temple={t} index={i} onOpen={() => router.push(`/puja/temple?id=${t.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
