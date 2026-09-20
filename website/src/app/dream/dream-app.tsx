"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { BookOpen, Check, ChevronDown, Moon, Plus } from "lucide-react";

import {
  createDreamCheckout,
  getDream,
  interpretDream,
  pendingDreamCheckout,
  DREAM_CONTEXT,
  DREAM_STARTERS,
  GENDERS,
  RELATIONS,
  RELATIONSHIP_STATUS,
  type DreamBody,
  type DreamContext,
  type DreamReading,
  type Gender,
  type PaymentProof,
  type Relation,
  type RelationshipStatus,
} from "@/lib/dream";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import NightSky from "@/components/dream/NightSky";
import DreamLoader from "@/components/dream/DreamLoader";
import SymbolGrid from "@/components/dream/SymbolGrid";

const DREAM_PRICE_PAISE = 3000; // ₹30 — display only; the server sets the real amount
const INDIGO = "#4f46e5";
const GRADIENT = "linear-gradient(135deg,#1e1b4b,#4f46e5,#6d28d9)";
const MIN_WORDS = 12;

type Status = "loading" | "form" | "paying" | "generating" | "result";

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function DreamApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dreamId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<DreamReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; dream: DreamBody } | null>(null);

  const [dreamText, setDreamText] = useState("");
  const [context, setContext] = useState<DreamContext>({});
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [payOpen, setPayOpen] = useState(false);

  const words = wordCount(dreamText);
  const canSubmit = name.trim().length >= 2 && words >= MIN_WORDS;

  const body = useCallback(
    (): DreamBody => ({
      name: name.trim(),
      relation,
      gender,
      relationship_status: relationshipStatus,
      birth_date: birthDate || null,
      dream: dreamText.trim(),
      context,
    }),
    [name, relation, gender, relationshipStatus, birthDate, dreamText, context],
  );

  useEffect(() => {
    if (!authLoaded) return;
    (async () => {
      const token = await getToken();
      if (dreamId) {
        try {
          setResult(await getDream(dreamId, token));
          setStatus("result");
        } catch {
          setError("Couldn't load that dream. It may have been deleted.");
          setStatus("form");
        }
        return;
      }
      setStatus("form");
      try {
        const { pending } = await pendingDreamCheckout(token);
        if (pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, dreamId]);

  const runInterpret = useCallback(
    async (payment: PaymentProof | { payment_id: string }, b: DreamBody) => {
      setResumable(null);
      setError(null);
      setStatus("generating");
      try {
        const token = await getToken();
        const r = await interpretDream(b, payment, token);
        setResult(r);
        setStatus("result");
      } catch (err) {
        if (err instanceof ApiError && err.status === 402)
          setError("We couldn't confirm your payment. Try again from “Payment received”.");
        else setError(err instanceof Error ? err.message : "Couldn't interpret your dream. Please try again.");
        setStatus("form");
      }
    },
    [getToken],
  );

  const payAndGo = useCallback(
    async (method: "card" | "wallet") => {
      setPayOpen(false);
      setError(null);
      setStatus("paying");
      const b = body();
      try {
        const token = await getToken();
        const checkout = await createDreamCheckout(b, token, method);
        if (checkout.method === "wallet") {
          refreshWallet();
          await runInterpret({ payment_id: checkout.payment_id }, b);
          return;
        }
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Dream Interpreter · ${b.name}`,
          description: "AstraVeda Dream Interpretation",
          onSuccess: (r) =>
            runInterpret(
              {
                payment_id: checkout.payment_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              },
              b,
            ),
          onDismiss: () => setStatus("form"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
        setStatus("form");
      }
    },
    [body, getToken, refreshWallet, runInterpret],
  );

  const startOver = () => {
    setResult(null);
    setError(null);
    setDreamText("");
    setContext({});
    setName("");
    setRelation(null);
    setGender(null);
    setRelationshipStatus(null);
    setBirthDate("");
    setStatus("form");
    router.push("/dream");
  };

  const pickRelation = (r: Relation) => {
    const next = relation === r ? null : r;
    setRelation(next);
    if (next === "Self" && !name.trim()) setName(user?.fullName ?? user?.firstName ?? "");
  };

  const addStarter = (s: string) =>
    setDreamText((t) => (t.trim() ? `${t.trimEnd()} ${s}` : s));

  if (status === "loading") return <DreamLoader label="Opening your journal" />;
  if (status === "paying") return <DreamLoader label="Waiting for payment" />;
  if (status === "generating") return <DreamLoader label="Reading the dream" />;

  if (status === "result" && result) {
    return (
      <Result
        dream={result}
        fromJournal={Boolean(dreamId)}
        onBack={() => (dreamId ? router.push("/dream/journal") : startOver())}
        onNew={startOver}
        onJournal={() => router.push("/dream/journal")}
      />
    );
  }

  return (
    <div className="max-w-[640px] mx-auto">
      <BackLink onClick={() => router.back()} />

      {resumable && (
        <button
          type="button"
          onClick={() => runInterpret({ payment_id: resumable.payment_id }, resumable.dream)}
          className="w-full flex items-center gap-3 text-left rounded-[16px] p-3.5 mb-4 bg-[#eaf7ee] border border-[#bfe3cb]"
        >
          <Check size={18} className="text-[#2f8f5b] flex-shrink-0" />
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold text-[#1f6b45]">Payment received</span>
            <span className="block text-[12px] text-[#3f7a5c]">Tap to interpret your dream — no charge.</span>
          </span>
        </button>
      )}

      {/* Night-sky journal panel */}
      <div
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 shadow-[0_24px_60px_rgba(49,46,129,.35)]"
        style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#4c1d95 100%)" }}
      >
        <NightSky />
        <div
          aria-hidden
          className="absolute -top-16 -right-10 w-56 h-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(167,139,250,.35), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-9 h-9 rounded-[12px] bg-white/15 flex items-center justify-center">
              <Moon size={17} className="text-[#eef2ff]" />
            </span>
            <span className="text-[11px] font-bold tracking-[.14em] uppercase text-white/70">Svapna Shastra</span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[27px] sm:text-[31px] font-medium text-white leading-tight">
            What did you dream?
          </h1>
          <p className="text-[13.5px] text-white/75 mt-1.5 mb-5">
            Write it as it comes — a reading names its symbols, its feeling, and what it points to.
          </p>

          <div className="rounded-[18px] bg-white/[.08] border border-white/15 backdrop-blur-sm focus-within:border-white/40 focus-within:bg-white/[.12] transition-colors">
            <textarea
              value={dreamText}
              onChange={(e) => setDreamText(e.target.value)}
              rows={7}
              placeholder="I was walking through a house I didn't recognise, and every door opened onto water…"
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-[1.65] text-white placeholder:text-white/40 focus:outline-none"
            />
            <div className="px-4 pb-3.5">
              <div className="h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (words / MIN_WORDS) * 100)}%`,
                    background: words >= MIN_WORDS ? "linear-gradient(90deg,#86efac,#4ade80)" : "linear-gradient(90deg,#a5b4fc,#c4b5fd)",
                  }}
                />
              </div>
              <p className={`text-[11.5px] mt-2 text-right ${words >= MIN_WORDS ? "text-[#86efac]" : "text-white/60"}`}>
                {words >= MIN_WORDS ? `${words} words · that's enough to read` : `${MIN_WORDS - words} more words to go`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {DREAM_STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addStarter(s)}
                className="text-[12px] px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/85 hover:bg-white/20 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context + dreamer */}
      <div className="rounded-[28px] p-6 sm:p-8 mt-4 border" style={{ background: "linear-gradient(165deg,#F3F2FF,#FFFFFF)", borderColor: "rgba(79,70,229,.14)" }}>
        <p className="text-[13px] font-bold text-[#2b2a45] mb-1">A few details sharpen the reading</p>
        <p className="text-[12.5px] text-[#6b6890] mb-6">All optional — tap to choose, tap again to clear.</p>

        <div className="space-y-5 mb-7">
          {DREAM_CONTEXT.map((q) => (
            <div key={q.key}>
              <FieldLabel>{q.question}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <Chip
                    key={o}
                    active={context[q.key] === o}
                    onClick={() => setContext((prev) => ({ ...prev, [q.key]: prev[q.key] === o ? undefined : o }))}
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div>
            <FieldLabel>Whose dream is this?</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              {RELATIONS.map((r) => (
                <Chip key={r} active={relation === r} onClick={() => pickRelation(r)}>
                  {r}
                </Chip>
              ))}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
            style={{ color: INDIGO }}
          >
            <ChevronDown size={15} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
            {showMore ? "Fewer details" : "More about the dreamer (optional)"}
          </button>

          <AnimatePresence initial={false}>
            {showMore && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-5 pt-1">
                  <div>
                    <FieldLabel>Gender</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {GENDERS.map((g) => (
                        <Chip key={g} active={gender === g} onClick={() => setGender((p) => (p === g ? null : g))}>
                          {g}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Relationship status</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {RELATIONSHIP_STATUS.map((s) => (
                        <Chip
                          key={s}
                          active={relationshipStatus === s}
                          onClick={() => setRelationshipStatus((p) => (p === s ? null : s))}
                        >
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Birth date</FieldLabel>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-6">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            setError(null);
            setPayOpen(true);
          }}
          className="w-full mt-7 flex items-center justify-center gap-2.5 h-13 py-3.5 rounded-[100px] font-bold text-[15px] text-white shadow-[0_10px_26px_rgba(79,70,229,.35)] disabled:opacity-45 disabled:shadow-none transition-all hover:brightness-110"
          style={{ background: GRADIENT }}
        >
          <Moon size={17} />
          Interpret my dream · ₹30
        </button>
        <p className="text-[11.5px] text-[#8a87a8] text-center mt-3">
          {canSubmit
            ? "One-time ₹30 · secure payment via Razorpay"
            : name.trim().length < 2
              ? "Enter a name to continue."
              : "Tell us a little more about the dream."}
        </p>
      </div>

      <div className="text-center mt-5">
        <button
          type="button"
          onClick={() => router.push("/dream/journal")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
        >
          <BookOpen size={15} /> Open my dream journal
        </button>
      </div>

      <PayMethodSheet
        open={payOpen}
        amountPaise={DREAM_PRICE_PAISE}
        balancePaise={wallet?.balance_paise ?? null}
        onPick={(method) => payAndGo(method)}
        onAddMoney={() => router.push("/wallet")}
        onClose={() => setPayOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function Result({
  dream,
  fromJournal,
  onBack,
  onNew,
  onJournal,
}: {
  dream: DreamReading;
  fromJournal: boolean;
  onBack: () => void;
  onNew: () => void;
  onJournal: () => void;
}) {
  const [showDream, setShowDream] = useState(false);
  const ctx = useMemo(() => Object.values(dream.context).filter(Boolean) as string[], [dream.context]);

  const chapters = [
    { n: "01", title: "The theme", text: dream.theme, dropCap: true },
    { n: "02", title: "The Vedic view", text: dream.vedic_note },
    { n: "03", title: "Guidance", text: dream.guidance },
  ].filter((c) => c.text);

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <BackLink onClick={onBack} label={fromJournal ? "Journal" : "New dream"} />
        <button type="button" onClick={onJournal} className="text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors">
          My dream journal →
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[28px] p-7 sm:p-10 shadow-[0_24px_60px_rgba(49,46,129,.35)]"
        style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#5b21b6 100%)" }}
      >
        <NightSky />
        <div
          aria-hidden
          className="absolute -top-20 -right-16 w-72 h-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(196,181,253,.4), transparent 68%)" }}
        />
        <div className="relative">
          <span className="w-11 h-11 rounded-[14px] bg-white/15 flex items-center justify-center mb-5">
            <Moon size={20} className="text-[#eef2ff]" />
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] font-medium text-white leading-[1.15]">
            {dream.title}
          </h1>
          {dream.feeling && (
            <p className="text-[15px] leading-[1.65] text-white/85 mt-3 max-w-[560px] italic">{dream.feeling}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <span className="text-[11px] font-extrabold tracking-[.06em] text-white/70 uppercase mr-1">
              {dream.name}
              {dream.relation ? ` · ${dream.relation}` : ""}
            </span>
            {ctx.map((c) => (
              <span key={c} className="text-[11px] font-semibold text-white bg-white/15 rounded-full px-2.5 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {dream.symbols.length > 0 && (
        <section className="mt-6 rounded-[24px] p-5 sm:p-7 border" style={{ background: "#fff", borderColor: "rgba(79,70,229,.14)" }}>
          <ChapterHeading n="✦" title="The symbols" />
          <SymbolGrid symbols={dream.symbols} />
        </section>
      )}

      {chapters.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-4 rounded-[24px] p-6 sm:p-8 border space-y-8"
          style={{ background: "linear-gradient(165deg,#FFFDF8,#F3F2FF)", borderColor: "rgba(79,70,229,.14)" }}
        >
          {chapters.map((c) => (
            <div key={c.title}>
              <ChapterHeading n={c.n} title={c.title} />
              <p className="text-[15.5px] leading-[1.85] text-[#403a52]">
                {c.dropCap && c.text.length > 1 ? (
                  <>
                    <span className="float-left mr-2 mt-1 text-[46px] leading-[.85] font-black" style={{ color: INDIGO }}>
                      {c.text[0]}
                    </span>
                    {c.text.slice(1)}
                  </>
                ) : (
                  c.text
                )}
              </p>
            </div>
          ))}
        </motion.section>
      )}

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => setShowDream((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: INDIGO }}
        >
          <ChevronDown size={15} className={`transition-transform ${showDream ? "rotate-180" : ""}`} />
          {showDream ? "Hide the dream" : "Read the dream you wrote"}
        </button>
        <AnimatePresence initial={false}>
          {showDream && (
            <motion.blockquote
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden text-left mt-3 rounded-[16px] bg-[#fbfbff] border border-[#e7e6f6] px-5 py-4 text-[14.5px] leading-[1.75] italic text-[#575572] border-l-4 border-l-[#6d28d9]"
            >
              {dream.dream_text}
            </motion.blockquote>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="w-full mt-6 flex items-center justify-center gap-2 h-12 rounded-[100px] font-semibold text-[14px] border"
        style={{ color: INDIGO, borderColor: "rgba(79,70,229,.3)", background: "#eeecfd" }}
      >
        <Plus size={16} /> Interpret another dream
      </button>
    </div>
  );
}

const INPUT_CLASS =
  "w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/15";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12.5px] font-semibold text-[#2b2a45] mb-2">{children}</label>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3.5 rounded-full text-[12.5px] font-medium border transition-all ${
        active
          ? "border-transparent text-white shadow-[0_6px_16px_rgba(79,70,229,.3)]"
          : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#4f46e5]/40"
      }`}
      style={active ? { background: GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}

function ChapterHeading({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="flex items-center gap-3 mb-4">
      <span
        className="text-[11px] font-black rounded-[8px] px-2 py-1 text-white"
        style={{ background: "linear-gradient(135deg,#4f46e5,#6d28d9)" }}
      >
        {n}
      </span>
      <span className="font-[family-name:var(--font-display)] text-[20px] font-medium text-[#1B1730]">{title}</span>
    </h2>
  );
}

function BackLink({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5B5570] hover:text-[#1B1730] transition-colors mb-4"
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}
