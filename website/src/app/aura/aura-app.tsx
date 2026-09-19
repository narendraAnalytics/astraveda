"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Camera, ChevronRight } from "lucide-react";

import {
  createAuraCheckout,
  getAura,
  getAuraReading,
  getLatestAura,
  pendingAuraCheckout,
  scanAura,
  AURA_HEX,
  AURA_MEANING,
  AURA_QUIZ,
  GENDERS,
  RELATIONS,
  RELATIONSHIP_STATUS,
  type AuraColor,
  type AuraReading,
  type Gender,
  type PaymentProof,
  type PersonFields,
  type QuizAnswers,
  type Relation,
  type RelationshipStatus,
} from "@/lib/aura";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import OptionGroup from "@/components/palm/OptionGroup";
import AuraScanner from "@/components/aura/AuraScanner";
import AuraHalo from "@/components/aura/AuraHalo";
import ChakraColumn, { chakraStatesFromReading } from "@/components/aura/ChakraColumn";
import ReadingView from "@/components/aura/ReadingView";
import AuraLoader from "@/components/aura/AuraLoader";

const AURA_PRICE_PAISE = 6000; // ₹60 — display only; the server sets the real amount
const GRADIENT = "linear-gradient(135deg,#3b1d63,#7c3aed,#c026d3)";

type Status =
  | "loading"
  | "resume"
  | "choose"
  | "quiz"
  | "scanning"
  | "paying"
  | "generating"
  | "summary"
  | "result";

export default function AuraApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auraId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<AuraReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ payment_id: string; person: PersonFields } | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState("");

  const [quiz, setQuiz] = useState<QuizAnswers>({});

  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState<PaymentProof | { payment_id: string } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const person = useCallback(
    (): PersonFields => ({
      name: name.trim(),
      relation,
      gender,
      relationship_status: relationshipStatus,
      birth_date: birthDate || null,
    }),
    [name, relation, gender, relationshipStatus, birthDate],
  );

  useEffect(() => {
    if (!authLoaded) return;
    (async () => {
      const token = await getToken();

      if (auraId) {
        try {
          const r = await getAura(auraId, token);
          setResult(r);
          setStatus("result");
        } catch {
          setError("Couldn't load that reading. It may have been deleted.");
          setStatus("choose");
        }
        return;
      }

      try {
        const r = await getLatestAura(token);
        setResult(r);
        setStatus("summary");
        return;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          setError("Couldn't reach AstraVeda. Please refresh and try again.");
          setStatus("choose");
          return;
        }
      }
      try {
        const { pending: pendingOrder } = await pendingAuraCheckout(token);
        if (pendingOrder) {
          setPending(pendingOrder);
          setStatus("resume");
          return;
        }
      } catch {
        // fall through
      }
      setStatus("choose");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, auraId]);

  const canContinue = name.trim().length >= 2;
  const quizComplete = useMemo(() => AURA_QUIZ.every((q) => quiz[q.key as keyof QuizAnswers]), [quiz]);

  const payAndGo = useCallback(
    async (method: "card" | "wallet") => {
      setPayOpen(false);
      setError(null);
      setStatus("paying");
      const token = await getToken();
      try {
        const checkout = await createAuraCheckout(person(), token, method);
        if (checkout.method === "wallet") {
          setPaid({ payment_id: checkout.payment_id });
          refreshWallet();
          setStatus("scanning");
          return;
        }
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Aura Scan · ${person().name}`,
          description: "AstraVeda Aura Scan",
          onSuccess: (r) => {
            setPaid({
              payment_id: checkout.payment_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setStatus("scanning");
          },
          onDismiss: () => setStatus("quiz"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
        setStatus("quiz");
      }
    },
    [getToken, person, refreshWallet],
  );

  const handleResume = useCallback(() => {
    if (!pending) return;
    setName(pending.person.name ?? "");
    setRelation((pending.person.relation as Relation) ?? null);
    setGender((pending.person.gender as Gender) ?? null);
    setRelationshipStatus((pending.person.relationship_status as RelationshipStatus) ?? null);
    setPaid({ payment_id: pending.payment_id });
    setPending(null);
    setStatus("quiz"); // quiz answers weren't persisted — collect them, then scan
  }, [pending]);

  const onScanCaptured = useCallback(
    async (base64: string, mime: string) => {
      setScanning(true);
      setScanError(null);
      const token = await getToken();
      try {
        const r = await scanAura(
          { ...person(), image: base64, mime_type: mime, quiz },
          paid,
          token,
        );
        setScanning(false);
        setResult(r);
        setStatus("result");
      } catch (err) {
        setScanning(false);
        if (err instanceof ApiError && err.status === 422) setScanError(err.message);
        else if (err instanceof ApiError && err.status === 429)
          setScanError("The reading service is busy right now — please try again in a minute.");
        else setScanError(err instanceof Error ? err.message : "Aura scan failed — please try again.");
      }
    },
    [getToken, person, quiz, paid],
  );

  const handleGetReading = useCallback(async () => {
    if (!result) return;
    setReadingLoading(true);
    setReadingError(null);
    try {
      const token = await getToken();
      const { reading_en } = await getAuraReading(result.id, token);
      setResult({ ...result, reading_en });
    } catch (err) {
      setReadingError(err instanceof ApiError ? err.message : "Couldn't fetch the reading.");
    } finally {
      setReadingLoading(false);
    }
  }, [result, getToken]);

  useEffect(() => {
    if (status === "result" && result && !result.reading_en && !readingLoading && !readingError) {
      handleGetReading();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result?.id, result?.reading_en, readingError]);

  const startOver = () => {
    setResult(null);
    setError(null);
    setPaid(null);
    setScanError(null);
    setQuiz({});
    router.push("/aura");
    setStatus("choose");
  };

  if (status === "loading") return <AuraLoader label="Reading the energy" />;

  if (status === "scanning") {
    return (
      <AuraScanner
        analysing={scanning}
        errorText={scanError}
        onCaptured={onScanCaptured}
        onRetake={() => setScanError(null)}
        onManual={() => setStatus("choose")}
        onClose={() => setStatus("choose")}
      />
    );
  }

  if (status === "resume" && pending) {
    return (
      <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <div className="text-center py-10 rounded-[28px] bg-[#F4EFFE] p-9">
          <p className="text-[15px] text-[#1B1730] mb-2">
            You already paid for a scan that didn&apos;t finish.
          </p>
          <p className="text-[13px] text-[#5B5570] mb-7">{pending.person.name}</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleResume}
              className="h-12 px-7 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(124,58,237,.3)]"
              style={{ background: GRADIENT }}
            >
              Finish my scan
            </button>
            <button
              type="button"
              onClick={() => setStatus("choose")}
              className="h-12 px-6 rounded-[100px] text-[14px] font-medium text-[#5B5570] border border-[#1B1730]/14"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "summary" && result) {
    return (
      <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-[28px] bg-[#F4EFFE] p-8 sm:p-10 text-center"
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-[20px] font-semibold text-white"
            style={{ background: GRADIENT }}
          >
            {result.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-medium text-[#1B1730]">
            {result.name}&apos;s Aura Scan
          </h1>
          <p className="text-[13px] text-[#5B5570] mb-6">{result.dominant_color} aura</p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStatus("result")}
              className="h-12 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(124,58,237,.3)]"
              style={{ background: GRADIENT }}
            >
              View Full Reading
            </button>
            <button
              type="button"
              onClick={startOver}
              className="h-12 rounded-[100px] font-semibold text-[13.5px] border"
              style={{ color: "#7c3aed", borderColor: "rgba(124,58,237,.3)" }}
            >
              New Scan
            </button>
            <button
              type="button"
              onClick={() => router.push("/aura/readings")}
              className="h-11 text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
            >
              View All Readings →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === "paying" || status === "generating") {
    return <AuraLoader label={status === "paying" ? "Waiting for payment" : "Reading the energy"} />;
  }

  if (status === "choose") {
    return (
      <div className="max-w-[560px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <div className="rounded-[28px] bg-[#F4EFFE] p-6 sm:p-9">
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
            Aura Scan
          </h1>
          <p className="text-[13.5px] text-[#5B5570] mb-7">
            A selfie and four quick questions become your aura colour, a seven-chakra
            map and this week&apos;s energy. Your photo is analysed once and never stored.
          </p>

          <div className="space-y-5 mb-7">
            <div>
              <FieldLabel>Whose aura is this?</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <FieldLabel>Relation (optional)</FieldLabel>
              <div className="grid grid-cols-4 gap-2">
                {RELATIONS.map((r) => (
                  <ChipButton key={r} active={relation === r} onClick={() => setRelation((prev) => (prev === r ? null : r))}>
                    {r}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Gender (optional)</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {GENDERS.map((g) => (
                  <ChipButton key={g} active={gender === g} onClick={() => setGender((prev) => (prev === g ? null : g))}>
                    {g}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Relationship status (optional)</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_STATUS.map((s) => (
                  <ChipButton
                    key={s}
                    active={relationshipStatus === s}
                    onClick={() => setRelationshipStatus((prev) => (prev === s ? null : s))}
                  >
                    {s}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Birth date (optional)</FieldLabel>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              setError(null);
              setStatus("quiz");
            }}
            className="w-full h-12 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(124,58,237,.28)] disabled:opacity-45 flex items-center justify-center gap-2"
            style={{ background: GRADIENT }}
          >
            Next — the energy quiz
            <ChevronRight size={18} />
          </button>
          <p className="text-[11.5px] text-[#8A8398] text-center mt-3">
            {canContinue ? "4 quick questions, then a ₹60 scan" : "Enter a name to continue."}
          </p>

          {error && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-5">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "quiz") {
    return (
      <>
        <div className="max-w-[560px] mx-auto">
          <BackLink onClick={() => setStatus("choose")} />
          <div className="rounded-[28px] bg-[#F4EFFE] p-6 sm:p-9">
            <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
              The Energy Quiz
            </h1>
            <p className="text-[13.5px] text-[#5B5570] mb-7">
              Answer honestly — there are no wrong answers. This steers your chakra map.
            </p>

            <div className="space-y-6 mb-7">
              {AURA_QUIZ.map((q, i) => (
                <div key={q.key}>
                  <FieldLabel>{`${i + 1}. ${q.question}`}</FieldLabel>
                  <OptionGroup
                    options={q.options.map((o) => ({ value: o, label: o }))}
                    value={quiz[q.key as keyof QuizAnswers] ?? null}
                    onChange={(v) => setQuiz((prev) => ({ ...prev, [q.key]: v as string }))}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={!quizComplete}
              onClick={() => {
                setError(null);
                setPayOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2.5 h-12 rounded-[100px] font-bold text-[14.5px] text-white shadow-[0_10px_26px_rgba(124,58,237,.28)] disabled:opacity-45 transition-opacity"
              style={{ background: GRADIENT }}
            >
              <Camera size={17} />
              Continue · ₹60
            </button>
            <p className="text-[11.5px] text-[#8A8398] text-center mt-3">
              {quizComplete ? "One-time ₹60 · secure payment via Razorpay, then a quick selfie" : "Answer all four to continue."}
            </p>

            {error && (
              <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-5">
                {error}
              </p>
            )}
          </div>
        </div>
        <PayMethodSheet
          open={payOpen}
          amountPaise={AURA_PRICE_PAISE}
          balancePaise={wallet?.balance_paise ?? null}
          onPick={(method) => payAndGo(method)}
          onAddMoney={() => router.push("/wallet")}
          onClose={() => setPayOpen(false)}
        />
      </>
    );
  }

  if (status === "result" && result) {
    const colors = [result.dominant_color, ...result.secondary_colors] as AuraColor[];
    const hexes = colors.map((c) => AURA_HEX[c]).filter(Boolean);
    const chakraStates = result.reading_en ? chakraStatesFromReading(result.reading_en) : {};

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-[28px] bg-[#F4EFFE] p-6 sm:p-9 max-w-[980px] mx-auto"
      >
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <button
              type="button"
              onClick={() => (auraId ? router.push("/aura/readings") : setStatus("summary"))}
              className="text-[12.5px] mb-1.5"
              style={{ color: "#7c3aed" }}
            >
              ← Back
            </button>
            <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] flex items-center gap-2 flex-wrap">
              {result.name}&apos;s Aura Scan
              {result.relation && (
                <span className="text-[10px] font-bold rounded-[6px] px-1.5 py-0.5" style={{ background: "#F4EFFE", color: "#7c3aed" }}>
                  {result.relation}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/aura/readings")}
              className="text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
            >
              View All Readings
            </button>
            <button type="button" onClick={startOver} className="text-[13px] font-semibold" style={{ color: "#7c3aed" }}>
              New scan
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8 lg:gap-10 items-start">
          <section className="lg:sticky lg:top-28">
            <div className="flex justify-center mb-5">
              <AuraHalo photoUrl={null} colors={hexes} size={220} />
            </div>

            <SectionHeading>Your colours</SectionHeading>
            <div className="space-y-2.5 mb-6">
              {colors.map((c, i) => (
                <div key={c} className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-[7px] mt-0.5 flex-shrink-0" style={{ backgroundColor: AURA_HEX[c] }} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-[#1B1730]">
                      {c} <span className="font-normal text-[#8A8398]">· {i === 0 ? "dominant" : "secondary"}</span>
                    </p>
                    <p className="text-[12px] leading-[1.5] text-[#5B5570]">{AURA_MEANING[c]}</p>
                  </div>
                </div>
              ))}
            </div>

            {result.reading_en && (
              <>
                <SectionHeading>The seven chakras</SectionHeading>
                <ChakraColumn states={chakraStates} />
              </>
            )}
          </section>

          <section>
            <h2
              className="font-[family-name:var(--font-display)] text-[22px] font-medium mb-4 bg-clip-text text-transparent"
              style={{ backgroundImage: GRADIENT }}
            >
              Your Reading
            </h2>
            {result.reading_en ? (
              <div className="rounded-[20px] bg-[linear-gradient(165deg,#FFFDF8,#F8F3FE)] border p-6 sm:p-7" style={{ borderColor: "rgba(124,58,237,.18)" }}>
                <ReadingView text={result.reading_en} />
              </div>
            ) : readingError ? (
              <div className="rounded-[20px] border border-dashed border-[#C0392B]/30 p-7 flex flex-col items-start gap-3.5">
                <p className="text-[13.5px] text-[#C0392B]">{readingError}</p>
                <button
                  type="button"
                  onClick={handleGetReading}
                  className="h-11 px-6 rounded-[100px] font-semibold text-[13.5px] text-white"
                  style={{ background: GRADIENT }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed p-7 flex items-center gap-3.5" style={{ borderColor: "rgba(124,58,237,.3)" }}>
                <span
                  className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: "rgba(124,58,237,.25)", borderTopColor: "#7c3aed" }}
                />
                <p className="text-[13.5px] text-[#5B5570]">
                  Writing your reading — AI is turning your energy into a
                  natural-language narrative…
                </p>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    );
  }

  return null;
}

const INPUT_CLASS =
  "w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/15";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">{children}</label>;
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-[12px] text-[12.5px] font-medium border transition-all px-2 ${
        active
          ? "border-transparent text-white shadow-[0_6px_16px_rgba(124,58,237,.28)]"
          : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#7c3aed]/40"
      }`}
      style={active ? { background: GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[14px] font-semibold text-[#1B1730] mb-4">
      <span className="w-6 h-px" style={{ background: "linear-gradient(90deg,#7c3aed,transparent)" }} />
      {children}
    </h2>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5B5570] hover:text-[#1B1730] transition-colors mb-4"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
