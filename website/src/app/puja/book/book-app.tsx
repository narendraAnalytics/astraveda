"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { Calendar, Check, ChevronDown, Minus, Plus, ShieldCheck } from "lucide-react";

import {
  NAKSHATRAS,
  confirmPuja,
  createPujaCheckout,
  pendingPujaCheckout,
  pujaAvailability,
  rupees,
  type Availability,
} from "@/lib/puja";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useTemples } from "@/hooks/use-temples";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import CapacityBar from "@/components/puja/CapacityBar";
import PujaLoader from "@/components/puja/PujaLoader";
import { themeFor } from "@/components/puja/pujaTheme";

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" });

export default function BookApp() {
  const router = useRouter();
  const params = useSearchParams();
  const pujaId = params.get("pujaId");
  const templeId = params.get("templeId");
  const { getToken } = useAuth();
  const { user } = useUser();
  const { wallet, refresh: refreshWallet } = useWallet();
  const { items, loading } = useTemples();

  const temple = useMemo(() => items.find((t) => t.id === templeId), [items, templeId]);
  const puja = useMemo(() => temple?.pujas.find((p) => p.id === pujaId), [temple, pujaId]);
  const th = themeFor(temple?.slug ?? "");

  const [devoteeName, setDevoteeName] = useState("");
  const [date, setDate] = useState("");
  const [numDevotees, setNumDevotees] = useState(1);
  const [gotra, setGotra] = useState("");
  const [nakshatra, setNakshatra] = useState<string | null>(null);
  const [nakOpen, setNakOpen] = useState(false);
  const [phone, setPhone] = useState("");

  const [avail, setAvail] = useState<Availability | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; puja_order_id: string } | null>(null);

  // default the date to tomorrow (client-only, avoids a server/client mismatch)
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDate(toISO(d));
  }, []);

  useEffect(() => {
    if (user && !devoteeName) setDevoteeName(user.fullName ?? user.firstName ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!pujaId || !date) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await pujaAvailability(pujaId, date);
        if (!cancelled) setAvail(a);
      } catch {
        if (!cancelled) setAvail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pujaId, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { pending } = await pendingPujaCheckout(await getToken());
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    async (payment: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const order = await confirmPuja(payment, await getToken());
        router.replace(`/puja/slip?id=${order.id}`);
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Couldn't confirm your booking.");
      }
    },
    [getToken, router],
  );

  if (loading && !puja) return <PujaLoader label="Opening the seva" />;
  if (!puja || !temple) {
    return (
      <div className="text-center rounded-[26px] bg-white border border-[#F0D9BC] p-12">
        <p className="text-[36px] mb-2">🛕</p>
        <p className="text-[14px] text-[#8b6f62] mb-4">That seva could not be found.</p>
        <button type="button" onClick={() => router.push("/puja")} className="text-[13.5px] font-bold text-[#C2571F]">
          ← All temples
        </button>
      </div>
    );
  }
  if (busy) return <PujaLoader label="Preparing your booking" />;

  const remaining = avail?.remaining ?? puja.daily_capacity - puja.booked_today;
  const maxDevotees = Math.max(1, Math.min(20, remaining));
  const total = puja.price_per_person_paise * numDevotees;
  const canBook = devoteeName.trim().length >= 2 && !!date && numDevotees >= 1 && numDevotees <= remaining;

  const startCheckout = async (method: "card" | "wallet") => {
    setPayOpen(false);
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const co = await createPujaCheckout(
        {
          puja_id: puja.id,
          devotee_name: devoteeName.trim(),
          gotra: gotra.trim() || null,
          nakshatra,
          phone: phone.trim() || null,
          num_devotees: numDevotees,
          preferred_date: date,
        },
        token,
        method,
      );
      if (co.method === "wallet") {
        refreshWallet();
        await finish({ payment_id: co.payment_id });
        return;
      }
      setBusy(false);
      await openRazorpayCheckout({
        keyId: co.key_id,
        orderId: co.order_id,
        amountPaise: co.amount_paise,
        name: `${puja.name} · ${temple.name}`,
        description: "AstraVeda puja booking",
        onSuccess: (r) =>
          finish({
            payment_id: co.payment_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
          }),
        onDismiss: () => undefined,
      });
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && (err.status === 409 || err.status === 402)) setError(err.message);
      else if (err instanceof ApiError && err.status === 503) setError("Payments are not available right now.");
      else setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8b6f62] hover:text-[#3d2418] transition-colors mb-4"
      >
        <span aria-hidden>←</span> Back
      </button>

      {resumable && (
        <button
          type="button"
          onClick={() => finish({ payment_id: resumable.payment_id })}
          className="w-full flex items-center gap-3 text-left rounded-[16px] p-3.5 mb-4 bg-[#eaf7ee] border border-[#bfe3cb]"
        >
          <Check size={18} className="text-[#2f8f5b] flex-shrink-0" />
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold text-[#1f6b45]">Payment received</span>
            <span className="block text-[12px] text-[#3f7a5c]">Tap to finish this booking — no charge.</span>
          </span>
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] px-6 sm:px-9 py-7 border mb-6"
        style={{ background: `linear-gradient(135deg, ${th.from}, ${th.to})`, borderColor: `${th.accent}26` }}
      >
        <span aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 text-[70px] opacity-90 select-none">
          {th.glyph}
        </span>
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em]" style={{ color: th.accent }}>
          Book a seva
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(24px,3.4vw,32px)] font-medium text-[#3d2418] mt-1 pr-20">
          {puja.name}
        </h1>
        <p className="text-[13px] text-[#6b5647] mt-1">
          {temple.name} · {temple.city}
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* form */}
        <div className="rounded-[26px] bg-white border p-5 sm:p-7 space-y-6" style={{ borderColor: `${th.accent}20`, boxShadow: `0 6px 24px ${th.accent}10` }}>
          <div>
            <Label>Devotee name</Label>
            <input
              type="text"
              value={devoteeName}
              onChange={(e) => setDevoteeName(e.target.value)}
              placeholder="Name for the sankalp"
              className={INPUT}
              style={inputFocus(th.accent)}
            />
          </div>

          <div>
            <Label>Preferred date</Label>
            <div className="relative">
              <input
                type="date"
                value={date}
                min={toISO(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className={`${INPUT} pr-11`}
                style={inputFocus(th.accent)}
              />
              <Calendar size={17} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: th.accent }} />
            </div>
            {avail && (
              <div className="mt-3">
                <CapacityBar booked={avail.booked} capacity={avail.capacity} label="on this date" />
              </div>
            )}
          </div>

          <div>
            <Label>Number of devotees</Label>
            <div className="inline-flex items-center gap-4 rounded-full border border-[#F0D9BC] bg-[#FFFBF3] p-1.5">
              <button
                type="button"
                onClick={() => setNumDevotees((n) => Math.max(1, n - 1))}
                className="w-10 h-10 rounded-full bg-white border border-[#F0D9BC] flex items-center justify-center text-[#7a1f2b] hover:bg-[#FFF3E0] transition-colors"
                aria-label="Fewer devotees"
              >
                <Minus size={16} />
              </button>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={numDevotees}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-8 text-center text-[20px] font-black text-[#3d2418]"
                >
                  {numDevotees}
                </motion.span>
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setNumDevotees((n) => Math.min(maxDevotees, n + 1))}
                className="w-10 h-10 rounded-full bg-white border border-[#F0D9BC] flex items-center justify-center text-[#7a1f2b] hover:bg-[#FFF3E0] transition-colors"
                aria-label="More devotees"
              >
                <Plus size={16} />
              </button>
            </div>
            <span className="ml-3 text-[12.5px] text-[#8b6f62]">{rupees(puja.price_per_person_paise)} each</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>
                Gotra <Opt />
              </Label>
              <input
                type="text"
                value={gotra}
                onChange={(e) => setGotra(e.target.value)}
                placeholder="e.g. Kashyapa"
                className={INPUT}
                style={inputFocus(th.accent)}
              />
            </div>
            <div>
              <Label>
                Phone <Opt />
              </Label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For booking updates"
                className={INPUT}
                style={inputFocus(th.accent)}
              />
            </div>
          </div>

          <div>
            <Label>
              Nakshatra <Opt />
            </Label>
            <button
              type="button"
              onClick={() => setNakOpen((v) => !v)}
              className="w-full h-12 rounded-[14px] border border-[#F0D9BC] bg-white px-4 flex items-center justify-between text-[14.5px] hover:border-[#E0932F]/60 transition-colors"
            >
              <span className={nakshatra ? "text-[#3d2418]" : "text-[#B9A48E]"}>{nakshatra ?? "Select your birth star"}</span>
              <ChevronDown size={18} className={`transition-transform ${nakOpen ? "rotate-180" : ""}`} style={{ color: th.accent }} />
            </button>
            <AnimatePresence initial={false}>
              {nakOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-3">
                    {[null, ...NAKSHATRAS].map((n) => {
                      const on = nakshatra === n;
                      return (
                        <button
                          key={n ?? "none"}
                          type="button"
                          onClick={() => {
                            setNakshatra(n);
                            setNakOpen(false);
                          }}
                          className={`h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-all ${
                            on ? "text-white border-transparent" : "bg-white border-[#F0D9BC] text-[#6b5647] hover:border-[#E0932F]/60"
                          }`}
                          style={on ? { background: `linear-gradient(135deg, ${th.accent}, ${th.accent2})` } : undefined}
                        >
                          {n ?? "Don't know"}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {remaining <= 0 && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3">
              This seva is fully booked for that date. Pick another day.
            </p>
          )}
          {error && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3">{error}</p>
          )}
        </div>

        {/* order summary — the price lives here, inside the card */}
        <aside
          className="lg:sticky lg:top-28 rounded-[26px] border p-6 bg-white"
          style={{ borderColor: `${th.accent}26`, boxShadow: `0 14px 36px ${th.accent}18` }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] mb-4" style={{ color: th.accent }}>
            Your booking
          </p>
          <dl className="space-y-3 text-[13.5px]">
            <Row k="Seva" v={puja.name} />
            <Row k="Temple" v={temple.name} />
            <Row k="Date" v={date ? prettyDate(date) : "—"} />
            <Row k="Devotees" v={`${numDevotees} × ${rupees(puja.price_per_person_paise)}`} />
          </dl>
          <div className="mt-5 pt-5 border-t border-dashed" style={{ borderColor: `${th.accent}33` }}>
            <div className="flex items-end justify-between">
              <span className="text-[12.5px] font-semibold text-[#8b6f62]">Total</span>
              <motion.span
                key={total}
                initial={{ scale: 1.15, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[30px] font-black leading-none text-[#3d2418]"
              >
                {rupees(total)}
              </motion.span>
            </div>
          </div>
          <button
            type="button"
            disabled={!canBook}
            onClick={() => {
              setError(null);
              setPayOpen(true);
            }}
            className="w-full mt-6 h-13 py-3.5 rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-45 disabled:shadow-none transition-all hover:brightness-105"
            style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.accent2})`, boxShadow: `0 12px 28px ${th.accent}44` }}
          >
            <Check size={17} /> Book &amp; pay · {rupees(total)}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#8b6f62] mt-3">
            <ShieldCheck size={13} /> Secure payment via Razorpay or wallet
          </p>
        </aside>
      </div>

      <PayMethodSheet
        open={payOpen}
        amountPaise={total}
        balancePaise={wallet?.balance_paise ?? null}
        onPick={(method) => startCheckout(method)}
        onAddMoney={() => router.push("/wallet")}
        onClose={() => setPayOpen(false)}
      />
    </div>
  );
}

const INPUT =
  "w-full h-12 rounded-[14px] border border-[#F0D9BC] bg-white px-4 text-[14.5px] text-[#3d2418] placeholder:text-[#B9A48E] focus:outline-none focus:ring-4";
const inputFocus = (accent: string) => ({ ["--tw-ring-color" as string]: `${accent}22` }) as React.CSSProperties;

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12.5px] font-semibold text-[#6b5647] mb-2">{children}</label>;
}
function Opt() {
  return <span className="font-medium text-[#B9A48E]"> · optional</span>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[#8b6f62]">{k}</dt>
      <dd className="text-right font-semibold text-[#3d2418]">{v}</dd>
    </div>
  );
}
