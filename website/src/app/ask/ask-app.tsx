"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  PhoneCall,
  PhoneMissed,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";

import {
  CONSULT_PRICE,
  TOPICS,
  TOPIC_LABEL,
  confirmConsult,
  createConsultCheckout,
  deleteConsult,
  getConsult,
  getConsultSlots,
  listConsults,
  pendingConsultCheckout,
  type ConsultBody,
  type ConsultSummary,
  type Consultation,
  type PaymentProof,
  type SlotDay,
  type Topic,
} from "@/lib/consult";
import type { Place } from "@/lib/kundali";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import PlaceAutocomplete from "@/components/kundali/PlaceAutocomplete";
import VoiceOrb, { type OrbState } from "@/components/ask/VoiceOrb";

const PURPLE = "#8f29dd";
const GRADIENT = "linear-gradient(135deg,#3a0ca3,#8f29dd,#a72be6)";
const GOLD_GRADIENT = "linear-gradient(180deg,#F7DDA2,#E9BE6C)";
const PRICE = CONSULT_PRICE / 100; // ₹ — display only; the server sets the real amount

type Status = "loading" | "landing" | "submitting" | "result";

const SAMPLE_QUESTIONS = [
  "When will my career situation improve?",
  "Is this a good year for marriage?",
  "What should I focus on for my health?",
  "Will my finances become stable?",
];

const STEPS = [
  { icon: PhoneCall, title: "We call your number", body: "A real phone call from AstraVeda's AI astrologer." },
  { icon: CheckCircle2, title: "Details confirmed first", body: "The astrologer reads back your birth details before starting." },
  { icon: Sun, title: "Your Vedic reading", body: "Ask your question and get guidance on the call — about 5–8 minutes." },
];

const STATUS_COPY: Record<
  Consultation["status"],
  { title: string; body: string; orb: OrbState; tint: string }
> = {
  created: { title: "Getting ready", body: "Your booking is being set up.", orb: "booked", tint: "#8a87a8" },
  paid: { title: "Booked", body: "Your call is scheduled. We'll ring you at the time you picked.", orb: "booked", tint: PURPLE },
  calling: { title: "Calling you now", body: "Pick up when your phone rings — it's AstraVeda's AI astrologer.", orb: "calling", tint: "#2f8f5b" },
  completed: { title: "Consultation complete", body: "Here's a summary of your call.", orb: "done", tint: "#2f8f5b" },
  callback_requested: { title: "Call-back requested", body: "You asked to be called back — we'll try again shortly.", orb: "booked", tint: "#c07a1e" },
  missed: { title: "We couldn't reach you", body: "The call didn't connect. Book again when you're ready.", orb: "missed", tint: "#c0392b" },
  failed: {
    title: "Call could not be placed",
    body: "Something went wrong. Card payments will be refunded by our team; wallet payments are already refunded.",
    orb: "missed",
    tint: "#c0392b",
  },
};

const STATUS_PILL: Record<ConsultSummary["status"], { text: string; tint: string }> = {
  created: { text: "Pending", tint: "#8a87a8" },
  paid: { text: "Scheduled", tint: PURPLE },
  calling: { text: "Calling now", tint: "#2f8f5b" },
  completed: { text: "Completed", tint: "#2f8f5b" },
  callback_requested: { text: "Call-back", tint: "#c07a1e" },
  missed: { text: "Missed", tint: "#c0392b" },
  failed: { text: "Failed", tint: "#c0392b" },
};

export default function AskApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<Consultation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // wizard
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [cc, setCc] = useState("+91");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [question, setQuestion] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [when, setWhen] = useState<"now" | "scheduled">(searchParams.get("when") === "scheduled" ? "scheduled" : "now");
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDay[]>([]);
  const [slotDay, setSlotDay] = useState(0);

  const [payOpen, setPayOpen] = useState(false);
  const [resumable, setResumable] = useState<{ payment_id: string; booking: ConsultBody } | null>(null);
  const [history, setHistory] = useState<ConsultSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const digits = phone.replace(/[^\d]/g, "");
  const phoneOk = digits.length >= 7;
  const step0Ok = name.trim().length >= 2 && phoneOk;
  const canSubmit = step0Ok && (when === "now" || !!slotIso);

  const buildBody = useCallback(
    (): ConsultBody => ({
      caller_name: name.trim(),
      phone_e164: `${cc}${digits}`,
      consultation_topic: topic,
      user_question: question.trim(),
      birth_date: birthDate || null,
      birth_time: birthTime && !unknownTime ? birthTime : null,
      unknown_time: unknownTime,
      birth_place: place?.label ?? "",
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      timezone: place?.timezone ?? null,
      booking_type: when,
      slot: when === "scheduled" ? slotIso : null,
    }),
    [name, cc, digits, topic, question, birthDate, birthTime, unknownTime, place, when, slotIso],
  );

  // Prefill the caller's name from Clerk once it loads.
  useEffect(() => {
    if (!name && user) setName(user.firstName ?? user.username ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load: ?id → that call; otherwise the landing page.
  useEffect(() => {
    if (!authLoaded) return;
    if (!consultId) {
      setResult(null);
      setStatus("landing");
      return;
    }
    setStatus("loading");
    (async () => {
      try {
        setResult(await getConsult(consultId, await getToken()));
        setStatus("result");
      } catch {
        setError("Couldn't load that call. It may have been deleted.");
        setStatus("landing");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, consultId]);

  // Landing extras: slots, resume banner, call history.
  useEffect(() => {
    if (status !== "landing") return;
    let cancelled = false;
    (async () => {
      try {
        const s = await getConsultSlots();
        if (!cancelled) setSlots(s);
      } catch {
        // slots are optional until "Pick a time"
      }
      const token = await getToken();
      try {
        const { pending } = await pendingConsultCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
      try {
        const rows = await listConsults(token);
        if (!cancelled) setHistory(rows);
      } catch {
        // history is a bonus
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // While the call is being placed, refresh its status so the page goes live
  // → complete without a reload (webhook writes the outcome on the backend).
  const resultId = result?.id;
  const resultStatus = result?.status;
  useEffect(() => {
    if (!resultId || (resultStatus !== "calling" && resultStatus !== "paid")) return;
    const id = setInterval(async () => {
      try {
        const c = await getConsult(resultId, await getToken());
        setResult(c);
      } catch {
        // keep the last known state
      }
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId, resultStatus]);

  const runConfirm = useCallback(
    async (payment: PaymentProof | { payment_id: string }) => {
      setResumable(null);
      setError(null);
      setStatus("submitting");
      try {
        const c = await confirmConsult(payment, await getToken());
        setResult(c);
        setStatus("result");
      } catch (err) {
        if (err instanceof ApiError && err.status === 402)
          setError('We couldn\'t confirm your payment. Try again from "Payment received".');
        else setError(err instanceof Error ? err.message : "Couldn't place your call.");
        setStatus("landing");
      }
    },
    [getToken],
  );

  const payAndGo = useCallback(
    async (method: "card" | "wallet") => {
      setPayOpen(false);
      setError(null);
      try {
        const token = await getToken();
        const checkout = await createConsultCheckout(buildBody(), token, method);
        if (checkout.method === "wallet") {
          refreshWallet();
          await runConfirm({ payment_id: checkout.payment_id });
          return;
        }
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Ask AstraVeda · ${name.trim()}`,
          description: "AstraVeda voice consultation",
          onSuccess: (r) =>
            runConfirm({
              payment_id: checkout.payment_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            }),
          onDismiss: () => undefined,
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 402 || err.status === 422)) setError(err.message);
        else if (err instanceof ApiError && err.status === 503) setError("Voice consultations are not available right now.");
        else setError(err instanceof Error ? err.message : "Couldn't start checkout.");
      }
    },
    [buildBody, getToken, name, refreshWallet, runConfirm],
  );

  const handleDelete = useCallback(
    async (c: ConsultSummary) => {
      if (!window.confirm("Remove this call from your history?")) return;
      setDeletingId(c.id);
      try {
        await deleteConsult(c.id, await getToken());
        setHistory((prev) => prev.filter((x) => x.id !== c.id));
      } catch {
        setError("Couldn't delete that call. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [getToken],
  );

  const backToLanding = () => {
    setResult(null);
    setStep(0);
    setSlotIso(null);
    setQuestion("");
    setStatus("landing");
    if (consultId) router.push("/ask");
  };

  // ---- loading / submitting
  if (status === "loading") {
    return (
      <div className="py-24">
        <VoiceOrb state="idle" size={150} />
      </div>
    );
  }
  if (status === "submitting") {
    return (
      <div className="py-16 text-center">
        <VoiceOrb state="calling" size={190} />
        <p className="mt-8 text-[15px] font-semibold text-[#514f7a]">Setting up your call…</p>
      </div>
    );
  }

  // ---- result
  if (status === "result" && result) {
    return <Result result={result} onNew={backToLanding} fromHistory={Boolean(consultId)} />;
  }

  // ---- landing (hero + wizard + history)
  return (
    <div className="max-w-[820px] mx-auto">
      <Hero />

      <section id="book" className="mt-6 scroll-mt-28">
        {resumable && (
          <button
            type="button"
            onClick={() => runConfirm({ payment_id: resumable.payment_id })}
            className="w-full flex items-center gap-3 text-left rounded-[16px] p-3.5 mb-4 bg-[#eaf7ee] border border-[#bfe3cb]"
          >
            <Check size={18} className="text-[#2f8f5b] flex-shrink-0" />
            <span className="flex-1">
              <span className="block text-[13.5px] font-bold text-[#1f6b45]">Payment received</span>
              <span className="block text-[12px] text-[#3f7a5c]">Tap to place your call — no charge.</span>
            </span>
            <ArrowRight size={16} className="text-[#2f8f5b]" />
          </button>
        )}

        <div className="rounded-[28px] p-5 sm:p-8 border" style={{ background: "linear-gradient(165deg,#F6F0FF,#FFFFFF)", borderColor: "rgba(143,41,221,.16)" }}>
          <Stepper step={step} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <div className="space-y-6">
                  <Heading title="Who are we calling?" sub="Your name, your number, and what the reading is about." />
                  <div>
                    <FieldLabel>Your name</FieldLabel>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={INPUT} />
                  </div>
                  <div>
                    <FieldLabel>Phone number</FieldLabel>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={cc}
                        maxLength={5}
                        onChange={(e) => setCc(e.target.value.startsWith("+") ? e.target.value : `+${e.target.value.replace(/[^\d]/g, "")}`)}
                        className={`${INPUT} !w-[84px] text-center font-semibold`}
                      />
                      <input
                        type="tel"
                        value={phone}
                        maxLength={13}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="98765 43210"
                        className={INPUT}
                      />
                    </div>
                    <p className="text-[11.5px] text-[#8a87a8] mt-2">We call this number. Standard call rates may apply.</p>
                  </div>
                  <div>
                    <FieldLabel>What is the reading about?</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {TOPICS.map((tp) => (
                        <Chip key={tp} active={topic === tp} onClick={() => setTopic(tp)}>
                          {TOPIC_LABEL[tp]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>
                      Your question <Optional />
                    </FieldLabel>
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={800}
                      rows={3}
                      placeholder="e.g. When will my career situation improve?"
                      className={`${INPUT} !h-auto py-3 resize-none leading-[1.6]`}
                    />
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {SAMPLE_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuestion(q)}
                          className="text-[11.5px] px-3 py-1.5 rounded-full bg-[#f3e8ff] text-[#6b21a8] hover:bg-[#e9d5ff] transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <Heading title="Your birth details" sub="Optional — the astrologer will confirm these with you on the call, and they sharpen the reading." />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>
                        Birth date <Optional />
                      </FieldLabel>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <FieldLabel>
                        Birth time <Optional />
                      </FieldLabel>
                      <input
                        type="time"
                        value={birthTime}
                        disabled={unknownTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                        className={`${INPUT} disabled:opacity-40`}
                      />
                      <label className="flex items-center gap-2 text-[12px] text-[#5B5570] mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={unknownTime}
                          onChange={(e) => setUnknownTime(e.target.checked)}
                          className="accent-[#8f29dd]"
                        />
                        I don&apos;t know my birth time
                      </label>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>
                      Birth place <Optional />
                    </FieldLabel>
                    <PlaceAutocomplete value={place} onSelect={setPlace} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <Heading title="When should we call?" sub="Right now, or at an IST time slot you pick." />
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[18px] bg-[#f3e8ff]">
                    {(["now", "scheduled"] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWhen(w)}
                        className={`h-12 rounded-[14px] text-[13.5px] font-bold flex items-center justify-center gap-2 transition-all ${
                          when === w ? "text-white shadow-[0_8px_20px_rgba(143,41,221,.35)]" : "text-[#6b21a8] hover:bg-white/60"
                        }`}
                        style={when === w ? { background: GRADIENT } : undefined}
                      >
                        {w === "now" ? <PhoneCall size={16} /> : <CalendarClock size={16} />}
                        {w === "now" ? "Call me now" : "Pick a time"}
                      </button>
                    ))}
                  </div>

                  {when === "now" ? (
                    <div className="flex items-center gap-3 rounded-[16px] p-4 bg-white border border-[#8f29dd]/15">
                      <span className="relative flex w-3 h-3">
                        <span className="absolute inset-0 rounded-full bg-[#4ade80] animate-ping opacity-70" />
                        <span className="relative w-3 h-3 rounded-full bg-[#22c55e]" />
                      </span>
                      <p className="text-[13.5px] text-[#4a4870]">The astrologer is available — we&apos;ll call within about a minute.</p>
                    </div>
                  ) : slots.length > 0 ? (
                    <div>
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                        {slots.map((d, i) => (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => setSlotDay(i)}
                            className={`flex-shrink-0 px-4 h-10 rounded-full text-[12.5px] font-bold border transition-all ${
                              slotDay === i ? "text-white border-transparent" : "bg-white border-[#8f29dd]/20 text-[#6b21a8]"
                            }`}
                            style={slotDay === i ? { background: GRADIENT } : undefined}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {(slots[slotDay]?.slots ?? []).map((s) => (
                          <button
                            key={s.iso}
                            type="button"
                            onClick={() => setSlotIso(s.iso)}
                            className={`h-11 rounded-[12px] text-[12.5px] font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                              slotIso === s.iso
                                ? "text-white border-transparent shadow-[0_6px_16px_rgba(143,41,221,.3)]"
                                : "bg-white border-[#8f29dd]/18 text-[#4a4870] hover:border-[#8f29dd]/50"
                            }`}
                            style={slotIso === s.iso ? { background: GRADIENT } : undefined}
                          >
                            <Clock size={12} /> {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#8a87a8]">Loading available times…</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-6">
              {error}
            </p>
          )}

          {step === 2 && (
            <p className="text-[11.5px] leading-[1.6] text-[#6b6890] bg-[#f3e8ff]/60 border border-[#8f29dd]/12 rounded-[12px] px-3.5 py-2.5 mt-6">
              By booking, you agree to receive an AI voice call at this number. The call is with an AI astrologer, and
              may be recorded and transcribed to improve quality. Astrology guidance is not a substitute for medical,
              legal or financial advice.
            </p>
          )}

          <div className="flex items-center gap-3 mt-8">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="h-12 px-5 rounded-[100px] text-[13.5px] font-semibold text-[#5B5570] border border-[#1B1730]/14 bg-white hover:bg-[#faf5ff] transition-colors"
              >
                Back
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                disabled={step === 0 && !step0Ok}
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 h-12 rounded-[100px] font-bold text-[14.5px] text-white shadow-[0_10px_26px_rgba(143,41,221,.32)] disabled:opacity-45 disabled:shadow-none flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                style={{ background: GRADIENT }}
              >
                {step === 1 && !birthDate && !place ? "Skip for now" : "Continue"} <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => {
                  setError(null);
                  setPayOpen(true);
                }}
                className="flex-1 h-12 rounded-[100px] font-bold text-[14.5px] text-white shadow-[0_10px_26px_rgba(143,41,221,.32)] disabled:opacity-45 disabled:shadow-none flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                style={{ background: GRADIENT }}
              >
                <PhoneCall size={17} />
                {when === "now" ? "Call me now" : "Book my call"} · ₹{PRICE}
              </button>
            )}
          </div>
          <p className="text-[11.5px] text-[#8a87a8] text-center mt-3">
            {step === 0 && !step0Ok
              ? name.trim().length < 2
                ? "Enter your name to continue."
                : "Enter a valid phone number."
              : step === 2
                ? canSubmit
                  ? `One-time ₹${PRICE} · secure payment via Razorpay or wallet`
                  : "Pick a time slot."
                : " "}
          </p>
        </div>
      </section>

      {/* History */}
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-medium text-[#1B1730] mb-4">Your calls</h2>
        {historyLoading ? (
          <div className="h-[76px] rounded-[18px] bg-[#1B1730]/[.04] animate-pulse" />
        ) : history.length === 0 ? (
          <p className="text-[13.5px] text-[#5B5570] rounded-[18px] border border-dashed border-[#8f29dd]/25 p-5 text-center">
            No calls yet — book your first consultation above.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((c, i) => {
              const st = STATUS_PILL[c.status] ?? STATUS_PILL.created;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: deletingId === c.id ? 0.5 : 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/ask?id=${c.id}`)}
                    className="w-full flex items-center gap-3.5 text-left rounded-[18px] p-4 border transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(143,41,221,.15)]"
                    style={{ background: "linear-gradient(160deg,#8f29dd14,#FFFFFF)", borderColor: "rgba(143,41,221,.2)" }}
                  >
                    <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: GRADIENT }}>
                      <PhoneCall size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-[#1B1730]">{TOPIC_LABEL[c.consultation_topic]}</span>
                      <span className="block text-[12px] text-[#8A8398] truncate">
                        {c.caller_name} · {c.booking_type === "now" ? "Call now" : c.slot_label}
                      </span>
                    </span>
                    <span
                      className="text-[10.5px] font-extrabold uppercase tracking-[.04em] rounded-full px-2.5 py-1 flex-shrink-0"
                      style={{ background: `${st.tint}1a`, color: st.tint }}
                    >
                      {st.text}
                    </span>
                    <ChevronRight size={16} className="text-[#C7AD97] flex-shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    aria-label="Delete call"
                    className="absolute -right-2 -top-2 w-7 h-7 rounded-full bg-white border border-[#1B1730]/10 shadow flex items-center justify-center text-[#8A8398] opacity-0 group-hover:opacity-100 hover:text-[#C0392B] transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <PayMethodSheet
        open={payOpen}
        amountPaise={CONSULT_PRICE}
        balancePaise={wallet?.balance_paise ?? null}
        onPick={(method) => payAndGo(method)}
        onAddMoney={() => router.push("/wallet")}
        onClose={() => setPayOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — the animated voice orb over a dark cosmic panel
// ---------------------------------------------------------------------------

function Hero() {
  const [qIdx, setQIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setQIdx((i) => (i + 1) % SAMPLE_QUESTIONS.length), 3400);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-[32px] px-6 sm:px-12 py-12 sm:py-14 text-center shadow-[0_28px_70px_rgba(58,12,163,.35)]"
        style={{ background: "linear-gradient(150deg,#1B0F3A 0%,#3B1667 55%,#5A1E8C 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(50% 55% at 50% 22%, rgba(244,210,138,.2), transparent 70%)" }}
        />
        <div className="relative">
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(244,210,138,.35)] bg-[rgba(244,210,138,.1)] text-[#F4D28A] text-[12.5px] font-medium tracking-[.02em] mb-7"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#4ade80] animate-ping opacity-75" />
              <span className="relative w-2 h-2 rounded-full bg-[#4ade80]" />
            </span>
            AI astrologer · live by phone
          </motion.span>

          <VoiceOrb state="idle" size={200} />

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="font-[family-name:var(--font-display)] text-[clamp(28px,4.4vw,42px)] leading-[1.12] text-[#FFF7E6] font-medium mt-8"
          >
            A real phone call with your
            <br /> AI astrologer
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-[14.5px] leading-[1.7] text-[rgba(255,247,230,.72)] max-w-[500px] mx-auto mt-3"
          >
            No chat window, no waiting room. AstraVeda rings your phone, confirms your birth details, and gives your
            Vedic reading live on the same call.
          </motion.p>

          <div className="h-[46px] mt-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={qIdx}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-[13px] text-white/90 italic"
              >
                <Sparkles size={14} className="text-[#F4D28A]" /> &ldquo;{SAMPLE_QUESTIONS[qIdx]}&rdquo;
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <a
              href="#book"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-[14.5px] text-[#241505] shadow-[0_8px_24px_rgba(244,210,138,.35)] hover:brightness-105 transition-all"
              style={{ background: GOLD_GRADIENT }}
            >
              <PhoneCall size={16} /> Book a call
            </a>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="relative rounded-[20px] p-4 border bg-white"
            style={{ borderColor: "rgba(143,41,221,.14)" }}
          >
            <span className="absolute top-3 right-4 text-[26px] font-black text-[#8f29dd]/10">{i + 1}</span>
            <span className="w-10 h-10 rounded-[13px] flex items-center justify-center text-white mb-3 shadow-[0_8px_18px_rgba(143,41,221,.3)]" style={{ background: GRADIENT }}>
              <s.icon size={17} />
            </span>
            <p className="text-[13.5px] font-bold text-[#2b2a45]">{s.title}</p>
            <p className="text-[12px] leading-[1.55] text-[#6b6890] mt-1">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result — live status, countdown, summary, transcript
// ---------------------------------------------------------------------------

function useCountdown(targetIso: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return left;
}

function Result({ result, onNew, fromHistory }: { result: Consultation; onNew: () => void; fromHistory: boolean }) {
  const s = STATUS_COPY[result.status] ?? STATUS_COPY.created;
  const left = useCountdown(result.status === "paid" ? result.scheduled_at : null);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="max-w-[760px] mx-auto" ref={scrollRef}>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5B5570] hover:text-[#1B1730] transition-colors mb-4"
      >
        <span aria-hidden>←</span> {fromHistory ? "Your calls" : "Book another call"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-[30px] px-6 sm:px-10 py-10 text-center shadow-[0_26px_60px_rgba(58,12,163,.35)]"
        style={{ background: "linear-gradient(150deg,#1B0F3A 0%,#3B1667 55%,#5A1E8C 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `radial-gradient(50% 55% at 50% 25%, ${result.status === "calling" ? "rgba(74,222,128,.22)" : "rgba(244,210,138,.18)"}, transparent 70%)` }}
        />
        <div className="relative">
          <VoiceOrb state={s.orb} size={170} />
          <h1 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[34px] font-medium text-[#FFF7E6] mt-7">{s.title}</h1>
          <p className="text-[14.5px] leading-[1.65] text-white/75 max-w-[440px] mx-auto mt-2">{s.body}</p>

          {result.status === "calling" && (
            <p className="inline-flex items-center gap-2 mt-4 text-[12px] text-[#86efac]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" /> Live · this page updates by itself
            </p>
          )}

          {left !== null && result.status === "paid" && <Countdown ms={left} />}

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[TOPIC_LABEL[result.consultation_topic], result.booking_type === "now" ? "Call now" : result.slot_label, result.phone_e164].map((c) => (
              <span key={c} className="text-[11.5px] font-semibold text-white bg-white/15 rounded-full px-3 py-1.5">
                {c}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {result.status === "failed" && (
        <p className="flex items-start gap-2 text-[13px] text-[#8a3b2b] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[14px] p-4 mt-4">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> If you were charged, our team will refund card payments; wallet payments are already refunded.
        </p>
      )}

      {result.call_summary && (
        <Card delay={0.1}>
          <CardTitle>Summary</CardTitle>
          <p className="text-[15px] leading-[1.8] text-[#403a52]">{result.call_summary}</p>
          {result.duration_sec ? (
            <p className="text-[12px] text-[#8a87a8] mt-3">Call length: {Math.max(1, Math.round(result.duration_sec / 60))} min</p>
          ) : null}
        </Card>
      )}

      {result.user_question && (
        <Card delay={0.15}>
          <CardTitle>Your question</CardTitle>
          <p className="text-[15px] leading-[1.75] italic text-[#575572]">{result.user_question}</p>
        </Card>
      )}

      {result.transcript.length > 0 && (
        <Card delay={0.2}>
          <CardTitle>Transcript</CardTitle>
          <div className="space-y-3">
            {result.transcript.map((line, i) => {
              const agent = line.role === "agent";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.05 }}
                  className={`flex ${agent ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[86%] rounded-[18px] px-4 py-3 ${agent ? "rounded-bl-[6px] bg-[#f3e8ff] text-[#3b2a55]" : "rounded-br-[6px] text-white"}`}
                    style={agent ? undefined : { background: GRADIENT }}
                  >
                    <p className={`text-[10.5px] font-extrabold uppercase tracking-[.06em] mb-1 ${agent ? "text-[#8f29dd]" : "text-white/70"}`}>
                      {agent ? "Astrologer" : "You"}
                    </p>
                    <p className="text-[14px] leading-[1.6]">{line.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      <button
        type="button"
        onClick={onNew}
        className="w-full mt-6 flex items-center justify-center gap-2 h-12 rounded-[100px] font-semibold text-[14px] border"
        style={{ color: PURPLE, borderColor: "rgba(143,41,221,.3)", background: "#f3e8ff" }}
      >
        {result.status === "missed" || result.status === "failed" ? <RotateCcw size={15} /> : <Plus size={16} />}
        {result.status === "missed" || result.status === "failed" ? "Book again" : "Book another call"}
      </button>
    </div>
  );
}

function Countdown({ ms }: { ms: number }) {
  const total = Math.floor(ms / 1000);
  const parts: [number, string][] = [
    [Math.floor(total / 86400), "days"],
    [Math.floor((total % 86400) / 3600), "hrs"],
    [Math.floor((total % 3600) / 60), "min"],
    [total % 60, "sec"],
  ];
  const shown = parts[0][0] === 0 ? parts.slice(1) : parts;
  return (
    <div className="flex items-center justify-center gap-2.5 mt-6" aria-label="Time until your call">
      {shown.map(([n, label]) => (
        <div key={label} className="w-[64px] rounded-[16px] bg-white/10 border border-white/15 py-2.5">
          <p className="text-[24px] font-black text-[#F4D28A] tabular-nums leading-none">{String(n).padStart(2, "0")}</p>
          <p className="text-[9.5px] font-bold uppercase tracking-[.08em] text-white/55 mt-1.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

const INPUT =
  "w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8f29dd] focus:outline-none focus:ring-2 focus:ring-[#8f29dd]/15";

function Stepper({ step }: { step: number }) {
  const labels = ["You", "Birth details", "When"];
  return (
    <div className="flex items-center mb-8">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black transition-all ${
                i <= step ? "text-white shadow-[0_6px_16px_rgba(143,41,221,.35)]" : "bg-[#f3e8ff] text-[#a78bfa]"
              }`}
              style={i <= step ? { background: GRADIENT } : undefined}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={`hidden sm:block text-[12.5px] font-semibold ${i <= step ? "text-[#2b2a45]" : "text-[#a09dbb]"}`}>{l}</span>
          </div>
          {i < labels.length - 1 && (
            <span className="flex-1 h-[3px] rounded-full mx-3 bg-[#f3e8ff] overflow-hidden">
              <motion.span
                className="block h-full rounded-full"
                style={{ background: GRADIENT }}
                initial={false}
                animate={{ width: i < step ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-[23px] font-medium text-[#1B1730]">{title}</h2>
      <p className="text-[13px] text-[#6b6890] mt-1">{sub}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12.5px] font-semibold text-[#2b2a45] mb-2">{children}</label>;
}

function Optional() {
  return <span className="font-medium text-[#a09dbb]"> · optional</span>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-4 rounded-full text-[12.5px] font-semibold border transition-all ${
        active ? "border-transparent text-white shadow-[0_6px_16px_rgba(143,41,221,.3)]" : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#8f29dd]/45"
      }`}
      style={active ? { background: GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="mt-4 rounded-[24px] p-5 sm:p-7 bg-white border border-[#eeddc8]"
    >
      {children}
    </motion.section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 mb-4 font-[family-name:var(--font-display)] text-[19px] font-medium text-[#2b2a45]">
      <span className="w-1 h-5 rounded-full" style={{ background: GRADIENT }} />
      {children}
    </h2>
  );
}
