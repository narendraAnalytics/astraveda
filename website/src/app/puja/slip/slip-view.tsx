"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { QRCodeSVG } from "qrcode.react";
import { Bookmark, Check, Download, Plus } from "lucide-react";

import { getPujaOrder, listTemples, rupees, type PujaOrder } from "@/lib/puja";
import PujaLoader from "@/components/puja/PujaLoader";
import { themeFor } from "@/components/puja/pujaTheme";

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Petals that drift down once when a booking is confirmed. Integer-derived
// positions so server and client render identically.
const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: 4 + ((i * 37) % 92),
  delay: ((i * 13) % 10) / 10,
  dur: 2.4 + ((i * 7) % 9) / 10,
  glyph: i % 3 === 0 ? "🌼" : i % 3 === 1 ? "🏵️" : "🌸",
}));

export default function SlipView() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { getToken, isLoaded } = useAuth();

  const [order, setOrder] = useState<PujaOrder | null>(null);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    if (!isLoaded || !id) return;
    (async () => {
      try {
        const o = await getPujaOrder(id, await getToken());
        setOrder(o);
        // theme by temple: match the order's temple name against the catalog
        listTemples()
          .then((ts) => setSlug(ts.find((t) => t.name === o.temple_name)?.slug ?? ""))
          .catch(() => undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load this booking.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, id]);

  useEffect(() => {
    const t = setTimeout(() => setFresh(false), 4200);
    return () => clearTimeout(t);
  }, []);

  if (error && !order) {
    return (
      <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
        <p className="text-[14px] text-[#8b6f62] mb-4">{error}</p>
        <button type="button" onClick={() => router.push("/puja/bookings")} className="text-[13.5px] font-bold text-[#C2571F]">
          ← My bookings
        </button>
      </div>
    );
  }
  if (!order) return <PujaLoader label="Opening your e-pass" />;

  const th = themeFor(slug);
  const confirmed = order.status === "confirmed";

  return (
    <div className="max-w-[520px] mx-auto">
      <style>{`
        @keyframes av-petal { 0% { transform: translateY(-30px) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(560px) rotate(300deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .av-petal { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          #av-slip, #av-slip * { visibility: visible !important; }
          #av-slip { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {fresh && confirmed && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[600px] overflow-hidden z-[60]">
          {PETALS.map((p, i) => (
            <span
              key={i}
              className="av-petal absolute text-[22px]"
              style={{ left: `${p.left}%`, top: 0, animation: `av-petal ${p.dur}s ease-in ${p.delay}s 1 both` }}
            >
              {p.glyph}
            </span>
          ))}
        </div>
      )}

      <div className="text-center mb-6 print:hidden">
        {confirmed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white shadow-[0_12px_28px_rgba(63,166,107,.4)]"
            style={{ background: "linear-gradient(135deg,#3fa66b,#5fd08d)" }}
          >
            <Check size={30} strokeWidth={3} />
          </motion.div>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-medium text-[#3d2418]">
          {confirmed ? "Your seva is booked" : "Booking pending"}
        </h1>
        <p className="text-[13.5px] text-[#8b6f62] mt-1">
          {confirmed ? "Show this e-pass at the temple counter on the day." : "This booking isn't confirmed yet."}
        </p>
      </div>

      {/* the e-pass */}
      <motion.div
        id="av-slip"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="rounded-[28px] bg-white border overflow-hidden"
        style={{ borderColor: `${th.accent}30`, boxShadow: `0 24px 56px ${th.accent}26` }}
      >
        <div className="relative px-6 py-6 overflow-hidden" style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}>
          <span aria-hidden className="absolute right-5 top-1/2 -translate-y-1/2 text-[64px] opacity-90 select-none">
            {th.glyph}
          </span>
          <p className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: th.accent }}>
            ॐ &nbsp;AstraVeda · Puja booking
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-medium text-[#3d2418] mt-2 pr-16">{order.temple_name}</h2>
          <p className="text-[12.5px] text-[#6b5647] mt-0.5">
            {order.deity} · {order.temple_city}
          </p>
        </div>

        {/* perforation */}
        <div className="relative h-0">
          <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#FFF8EE] border" style={{ borderColor: `${th.accent}30` }} />
          <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#FFF8EE] border" style={{ borderColor: `${th.accent}30` }} />
          <div className="mx-6 border-t-2 border-dashed" style={{ borderColor: `${th.accent}30` }} />
        </div>

        <div className="px-6 pt-6 pb-6">
          <div className="flex flex-col items-center">
            <div className="p-3.5 rounded-[20px] bg-white border" style={{ borderColor: `${th.accent}26` }}>
              <QRCodeSVG value={order.booking_code || order.id} size={148} fgColor="#2b1a1d" bgColor="#ffffff" level="M" />
            </div>
            <p className="text-[26px] font-black tracking-[.14em] mt-4" style={{ color: th.accent }}>
              {order.booking_code}
            </p>
            <p className="text-[11.5px] text-[#8b6f62] mt-1">Show this at the temple counter</p>
          </div>

          <dl className="mt-6 space-y-2.5 text-[13.5px]">
            <Row k="Puja / Seva" v={order.puja_name} />
            <Row k="Date" v={prettyDate(order.preferred_date)} />
            <Row k="Devotee" v={order.devotee_name} />
            {order.gotra && <Row k="Gotra" v={order.gotra} />}
            {order.nakshatra && <Row k="Nakshatra" v={order.nakshatra} />}
            <Row k="Devotees" v={String(order.num_devotees)} />
            <Row k="Amount paid" v={rupees(order.amount_paise)} />
          </dl>

          <div
            className="mt-5 flex items-center justify-center gap-2 rounded-full py-2 text-[12px] font-bold"
            style={confirmed ? { background: "#e4f3e9", color: "#2f8f5b" } : { background: "#f0e6d8", color: "#8a6f5a" }}
          >
            <Check size={14} /> {confirmed ? "Confirmed" : order.status}
            {order.confirmed_at ? ` · ${prettyDate(order.confirmed_at.slice(0, 10))}` : ""}
          </div>
        </div>
      </motion.div>

      <div className="mt-6 flex flex-col gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-12 rounded-full font-bold text-[14px] text-white flex items-center justify-center gap-2 hover:brightness-105 transition-all"
          style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.accent2})`, boxShadow: `0 10px 26px ${th.accent}40` }}
        >
          <Download size={16} /> Save as PDF
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/puja/bookings")}
            className="h-12 rounded-full font-semibold text-[13.5px] bg-white border border-[#F0D9BC] text-[#6b5647] flex items-center justify-center gap-2 hover:bg-[#FFF3E0] transition-colors"
          >
            <Bookmark size={15} /> My bookings
          </button>
          <button
            type="button"
            onClick={() => router.push("/puja")}
            className="h-12 rounded-full font-semibold text-[13.5px] bg-white border border-[#F0D9BC] text-[#6b5647] flex items-center justify-center gap-2 hover:bg-[#FFF3E0] transition-colors"
          >
            <Plus size={15} /> Book another
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[#8b6f62]">{k}</dt>
      <dd className="text-right font-semibold text-[#3d2418]">{v}</dd>
    </div>
  );
}
