"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ChevronRight, Plus } from "lucide-react";

import { listPujaOrders, listTemples, rupees, type PujaOrder } from "@/lib/puja";
import { ApiError } from "@/lib/api";
import { themeFor, SAFFRON_GRADIENT } from "@/components/puja/pujaTheme";

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const STATUS: Record<PujaOrder["status"], { text: string; bg: string; fg: string }> = {
  confirmed: { text: "Confirmed", bg: "#e4f3e9", fg: "#2f8f5b" },
  created: { text: "Payment pending", bg: "#fdf0dc", fg: "#b9771a" },
  cancelled: { text: "Cancelled", bg: "#fdecea", fg: "#c0392b" },
};

export default function BookingsList() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [orders, setOrders] = useState<PujaOrder[]>([]);
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        setOrders(await listPujaOrders(await getToken()));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your bookings.");
      } finally {
        setLoading(false);
      }
      listTemples()
        .then((ts) => setSlugs(Object.fromEntries(ts.map((t) => [t.name, t.slug]))))
        .catch(() => undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/puja")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8b6f62] hover:text-[#3d2418] transition-colors mb-4"
      >
        <span aria-hidden>←</span> All temples
      </button>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-medium text-[#3d2418]">My bookings</h1>
          <p className="text-[13.5px] text-[#8b6f62] mt-1">Your sevas and e-passes, all in one place.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/puja")}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[13.5px] text-white shadow-[0_10px_24px_rgba(224,87,79,.28)] hover:brightness-105 transition-all"
          style={{ background: SAFFRON_GRADIENT }}
        >
          <Plus size={16} /> New booking
        </button>
      </div>

      {error && <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3 mb-5">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[92px] rounded-[22px] bg-[#FFF3E0] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
          <p className="text-[38px] mb-2">🪔</p>
          <h2 className="text-[16px] font-semibold text-[#3d2418]">No bookings yet</h2>
          <p className="text-[13.5px] text-[#8b6f62] mt-2 max-w-[340px] mx-auto">Book a seva at a temple and your e-pass will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => {
            const th = themeFor(slugs[o.temple_name] ?? "");
            const st = STATUS[o.status] ?? STATUS.created;
            return (
              <motion.button
                key={o.id}
                type="button"
                onClick={() => router.push(`/puja/slip?id=${o.id}`)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.05 }}
                whileHover={{ y: -3 }}
                className="w-full flex items-center gap-4 text-left rounded-[22px] bg-white border p-4 transition-shadow hover:shadow-[0_16px_34px_rgba(224,147,47,.2)]"
                style={{ borderColor: `${th.accent}24` }}
              >
                <span
                  className="w-14 h-14 rounded-[18px] flex items-center justify-center text-[28px] flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}
                >
                  {th.glyph}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-[#3d2418] truncate">{o.puja_name}</span>
                  <span className="block text-[12.5px] text-[#8b6f62] truncate">
                    {o.temple_name} · {prettyDate(o.preferred_date)}
                  </span>
                  <span className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10.5px] font-extrabold tracking-[.06em] rounded-full px-2.5 py-0.5" style={{ background: st.bg, color: st.fg }}>
                      {st.text}
                    </span>
                    {o.booking_code && <span className="text-[11.5px] font-bold tracking-[.08em]" style={{ color: th.accent }}>{o.booking_code}</span>}
                  </span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block text-[15px] font-black text-[#3d2418]">{rupees(o.amount_paise)}</span>
                  <span className="block text-[11px] text-[#8b6f62]">
                    {o.num_devotees} devotee{o.num_devotees === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronRight size={17} className="text-[#D8BD97] flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
