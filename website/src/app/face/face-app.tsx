"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Camera, Edit3, ChevronRight, Smile, Sparkles, Sun, Users } from "lucide-react";

import {
  createFaceCheckout,
  generateFace,
  getFace,
  getFaceReading,
  getLatestFace,
  pendingFaceCheckout,
  scanFace,
  FEATURE_KEYS,
  FEATURE_LABEL,
  GENDERS,
  RELATIONS,
  RELATIONSHIP_STATUS,
  type FaceReading,
  type Gender,
  type PaymentProof,
  type PersonFields,
  type Relation,
  type RelationshipStatus,
} from "@/lib/face";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import GuidedForm, { type GuidedAnswers } from "@/components/face/GuidedForm";
import FaceScanner from "@/components/face/FaceScanner";
import ZoneDiagram from "@/components/face/ZoneDiagram";
import ReadingView from "@/components/face/ReadingView";
import FaceLoader from "@/components/face/FaceLoader";

const FACE_PRICE_PAISE = 4500; // ₹45 — display only; the server sets the real amount
const GRADIENT = "linear-gradient(135deg,#0c5f57,#0f8a7e,#3fa66b)";

type Status =
  | "loading"
  | "resume"
  | "choose"
  | "form"
  | "scanning"
  | "paying"
  | "generating"
  | "summary"
  | "result";
type PayPath = "scan" | "form";

export default function FaceApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const faceId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<FaceReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ payment_id: string; person: PersonFields } | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  // Choose-screen identity
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState("");

  // Payment
  const [payPath, setPayPath] = useState<PayPath>("form");
  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState<PaymentProof | { payment_id: string } | null>(null);

  // Scan
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

      if (faceId) {
        try {
          const r = await getFace(faceId, token);
          setResult(r);
          setStatus("result");
        } catch {
          setError("Couldn't load that reading. It may have been deleted.");
          setStatus("choose");
        }
        return;
      }

      try {
        const r = await getLatestFace(token);
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
        const { pending: pendingOrder } = await pendingFaceCheckout(token);
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
  }, [authLoaded, faceId]);

  const canGo = name.trim().length >= 2;

  const openPay = (path: PayPath) => {
    if (!canGo) return;
    setError(null);
    setPayPath(path);
    setPayOpen(true);
  };

  const payAndGo = useCallback(
    async (method: "card" | "wallet") => {
      setPayOpen(false);
      setError(null);
      setStatus("paying");
      const token = await getToken();
      try {
        const checkout = await createFaceCheckout(person(), token, method);
        if (checkout.method === "wallet") {
          setPaid({ payment_id: checkout.payment_id });
          refreshWallet();
          setStatus(payPath === "scan" ? "scanning" : "form");
          return;
        }
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Face Reading · ${person().name}`,
          description: "AstraVeda Face Reading",
          onSuccess: (r) => {
            setPaid({
              payment_id: checkout.payment_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setStatus(payPath === "scan" ? "scanning" : "form");
          },
          onDismiss: () => setStatus("choose"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
        setStatus("choose");
      }
    },
    [getToken, person, payPath, refreshWallet],
  );

  const handleResume = useCallback(() => {
    if (!pending) return;
    setName(pending.person.name ?? "");
    setRelation((pending.person.relation as Relation) ?? null);
    setGender((pending.person.gender as Gender) ?? null);
    setRelationshipStatus((pending.person.relationship_status as RelationshipStatus) ?? null);
    setPaid({ payment_id: pending.payment_id });
    setPending(null);
    setStatus("choose");
  }, [pending]);

  const onGuidedSubmit = useCallback(
    async (answers: GuidedAnswers) => {
      setError(null);
      setStatus("generating");
      const token = await getToken();
      try {
        const r = await generateFace(
          {
            ...person(),
            face_shape: answers.face_shape,
            forehead: answers.forehead,
            chin_jaw: answers.chin_jaw,
          },
          paid,
          token,
        );
        setResult(r);
        setStatus("result");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not generate your face reading.");
        setStatus("form");
      }
    },
    [person, paid, getToken],
  );

  const onScanCaptured = useCallback(
    async (base64: string, mime: string) => {
      setScanning(true);
      setScanError(null);
      const token = await getToken();
      try {
        const r = await scanFace(
          { ...person(), image: base64, mime_type: mime },
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
        else setScanError(err instanceof Error ? err.message : "Face scan failed — please try again.");
      }
    },
    [getToken, person, paid],
  );

  const handleGetReading = useCallback(async () => {
    if (!result) return;
    setReadingLoading(true);
    setReadingError(null);
    try {
      const token = await getToken();
      const { reading_en } = await getFaceReading(result.id, token);
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
    router.push("/face");
    setStatus("choose");
  };

  if (status === "loading") return <FaceLoader label="Reading the face" />;

  if (status === "scanning") {
    return (
      <FaceScanner
        analysing={scanning}
        errorText={scanError}
        onCaptured={onScanCaptured}
        onRetake={() => setScanError(null)}
        onManual={() => {
          setScanError(null);
          setStatus("form");
        }}
        onClose={() => setStatus("choose")}
      />
    );
  }

  if (status === "resume" && pending) {
    return (
      <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <div className="text-center py-10 rounded-[28px] bg-[#F2FAF8] p-9">
          <p className="text-[15px] text-[#1B1730] mb-2">
            You already paid for a reading that didn&apos;t finish.
          </p>
          <p className="text-[13px] text-[#5B5570] mb-7">{pending.person.name}</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleResume}
              className="h-12 px-7 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(15,138,126,.3)]"
              style={{ background: GRADIENT }}
            >
              Finish my reading
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
          className="rounded-[28px] bg-[#F2FAF8] p-8 sm:p-10 text-center"
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-[20px] font-semibold text-white"
            style={{ background: GRADIENT }}
          >
            {result.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-medium text-[#1B1730]">
            {result.name}&apos;s Face Reading
          </h1>
          <p className="text-[13px] text-[#5B5570] mb-6">
            {result.face_shape === "Unknown" ? "Face reading" : `${result.face_shape} face`}
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStatus("result")}
              className="h-12 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(15,138,126,.3)]"
              style={{ background: GRADIENT }}
            >
              View Full Reading
            </button>
            <button
              type="button"
              onClick={startOver}
              className="h-12 rounded-[100px] font-semibold text-[13.5px] border"
              style={{ color: "#0f8a7e", borderColor: "rgba(15,138,126,.3)" }}
            >
              New Reading
            </button>
            <button
              type="button"
              onClick={() => router.push("/face/readings")}
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
    return <FaceLoader label={status === "paying" ? "Waiting for payment" : "Reading the face"} />;
  }

  if (status === "choose") {
    return (
      <>
        <div className="max-w-[560px] mx-auto">
          <BackLink onClick={() => router.back()} />
          <div className="rounded-[28px] bg-[#F2FAF8] p-6 sm:p-9">
            <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
              Face Reading
            </h1>
            <p className="text-[13.5px] text-[#5B5570] mb-7">
              Mukha Samudrika Shastra — scan your face with your camera, or answer a
              few questions. Your photo is analysed once and never stored.
            </p>

            <div className="space-y-5 mb-7">
              <div>
                <FieldLabel>Whose face is this?</FieldLabel>
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
              disabled={!canGo}
              onClick={() => openPay("scan")}
              className="w-full flex items-center gap-3.5 rounded-[18px] p-4 mb-3 text-left transition-opacity disabled:opacity-45"
              style={{ background: GRADIENT, boxShadow: "0 10px 26px rgba(15,138,126,.28)" }}
            >
              <span className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center flex-shrink-0">
                <Camera size={20} color="#fff" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[14.5px] font-bold text-white">Scan my face</span>
                  <span className="text-[9px] font-black tracking-wide text-white bg-white/25 rounded px-1.5 py-0.5">
                    AI
                  </span>
                  <span className="text-[11px] font-black text-[#0f8a7e] bg-white rounded-full px-2 py-0.5">
                    ₹45
                  </span>
                </span>
                <span className="block text-[11.5px] text-white/85 mt-0.5">
                  Use your camera — AI reads your features for you.
                </span>
              </span>
              <ChevronRight size={18} color="#fff" className="flex-shrink-0" />
            </button>

            <button
              type="button"
              disabled={!canGo}
              onClick={() => openPay("form")}
              className="w-full flex items-center gap-3.5 rounded-[18px] p-4 text-left bg-white border transition-opacity disabled:opacity-45"
              style={{ borderColor: "rgba(15,138,126,.22)" }}
            >
              <span className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "#E2F4F0" }}>
                <Edit3 size={19} color="#0f8a7e" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[14.5px] font-bold text-[#1B1730]">Answer questions</span>
                  <span className="text-[11px] font-black text-white rounded-full px-2 py-0.5" style={{ background: "#0f8a7e" }}>
                    ₹45
                  </span>
                </span>
                <span className="block text-[11.5px] text-[#8A8398] mt-0.5">
                  Three quick steps about your face shape, forehead and chin.
                </span>
              </span>
              <ChevronRight size={18} color="#0f8a7e" className="flex-shrink-0" />
            </button>

            {error && (
              <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-5">
                {error}
              </p>
            )}
          </div>
        </div>
        <PayMethodSheet
          open={payOpen}
          amountPaise={FACE_PRICE_PAISE}
          balancePaise={wallet?.balance_paise ?? null}
          onPick={(method) => payAndGo(method)}
          onAddMoney={() => router.push("/wallet")}
          onClose={() => setPayOpen(false)}
        />
      </>
    );
  }

  if (status === "form") {
    return (
      <div className="max-w-[560px] mx-auto">
        <BackLink onClick={() => setStatus("choose")} />
        <div className="rounded-[28px] bg-[#F2FAF8] p-6 sm:p-9">
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
            {name.trim()}&apos;s Face
          </h1>
          <p className="text-[13.5px] text-[#5B5570] mb-7">
            Answer about your face and receive a Vedic face reading.
          </p>
          <GuidedForm submitting={false} error={error} onSubmit={onGuidedSubmit} onExit={() => setStatus("choose")} />
        </div>
      </div>
    );
  }

  if (status === "result" && result) {
    const featureFacts = FEATURE_KEYS.filter((k) => result.features[k]).map((k) => ({
      key: k,
      label: FEATURE_LABEL[k],
      value: result.features[k] as string,
    }));

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-[28px] bg-[#F2FAF8] p-6 sm:p-9 max-w-[980px] mx-auto"
      >
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <button
              type="button"
              onClick={() => (faceId ? router.push("/face/readings") : setStatus("summary"))}
              className="text-[12.5px] mb-1.5"
              style={{ color: "#0f8a7e" }}
            >
              ← Back
            </button>
            <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] flex items-center gap-2 flex-wrap">
              {result.name}&apos;s Face Reading
              {result.relation && (
                <span className="text-[10px] font-bold rounded-[6px] px-1.5 py-0.5" style={{ background: "#E2F4F0", color: "#0f8a7e" }}>
                  {result.relation}
                </span>
              )}
              {result.source === "scan" && (
                <span className="text-[9px] font-black text-white rounded-[6px] px-1.5 py-0.5" style={{ background: "#0f8a7e" }}>
                  SCANNED
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/face/readings")}
              className="text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
            >
              View All Readings
            </button>
            <button type="button" onClick={startOver} className="text-[13px] font-semibold" style={{ color: "#0f8a7e" }}>
              New reading
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8 lg:gap-10 items-start">
          <section className="lg:sticky lg:top-28">
            <SectionHeading>The three zones</SectionHeading>
            <ZoneDiagram size={200} />
            {featureFacts.length > 0 && (
              <div className="mt-5 space-y-2">
                {featureFacts.map((f) => (
                  <FactChip key={f.key} label={f.label} value={f.value} />
                ))}
              </div>
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
              <div className="rounded-[20px] bg-[linear-gradient(165deg,#FFFDF8,#F0FAF8)] border p-6 sm:p-7" style={{ borderColor: "rgba(15,138,126,.18)" }}>
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
              <div className="rounded-[20px] border border-dashed p-7 flex items-center gap-3.5" style={{ borderColor: "rgba(15,138,126,.3)" }}>
                <span
                  className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: "rgba(15,138,126,.25)", borderTopColor: "#0f8a7e" }}
                />
                <p className="text-[13.5px] text-[#5B5570]">
                  Writing your reading — AI is turning your face&apos;s features into a
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
  "w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#0f8a7e] focus:outline-none focus:ring-2 focus:ring-[#0f8a7e]/15";

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
          ? "border-transparent text-white shadow-[0_6px_16px_rgba(15,138,126,.28)]"
          : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#0f8a7e]/40"
      }`}
      style={active ? { background: GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}

const FACT_META: Record<string, { icon: typeof Smile; color: string }> = {
  Forehead: { icon: Sun, color: "#0c5f57" },
  Eyebrows: { icon: Sparkles, color: "#0f8a7e" },
  Eyes: { icon: Sparkles, color: "#3fa66b" },
  Nose: { icon: Sparkles, color: "#0f8a7e" },
  Lips: { icon: Smile, color: "#0c5f57" },
  Cheeks: { icon: Smile, color: "#3fa66b" },
  "Chin & jaw": { icon: Users, color: "#0f8a7e" },
  Ears: { icon: Sparkles, color: "#0c5f57" },
  "The three zones": { icon: Sun, color: "#3fa66b" },
};

function FactChip({ label, value }: { label: string; value: string }) {
  const meta = FACT_META[label] ?? { icon: Sparkles, color: "#0f8a7e" };
  const Icon = meta.icon;
  return (
    <div
      className="rounded-[14px] border px-3.5 py-3 flex items-start gap-2.5"
      style={{ background: `linear-gradient(160deg,${meta.color}1a,${meta.color}05)`, borderColor: `${meta.color}26` }}
    >
      <span
        className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
        style={{ background: `${meta.color}1c`, color: meta.color }}
      >
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[.03em]" style={{ color: `${meta.color}b3` }}>
          {label}
        </span>
        <span className="block text-[13.5px] font-bold text-[#1B1730] mt-0.5">
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[14px] font-semibold text-[#1B1730] mb-4">
      <span className="w-6 h-px" style={{ background: "linear-gradient(90deg,#0f8a7e,transparent)" }} />
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
