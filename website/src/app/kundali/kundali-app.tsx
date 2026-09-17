"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth, useUser } from "@clerk/nextjs";

import {
  createKundaliCheckout,
  generateKundali,
  getKundaliReading,
  getLatestKundali,
  pendingKundaliCheckout,
  type GenerateBody,
  type Kundali,
} from "@/lib/kundali";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@/lib/api";
import BirthForm from "@/components/kundali/BirthForm";
import ZodiacLoader from "@/components/kundali/ZodiacLoader";
import AvakhadaGrid from "@/components/kundali/AvakhadaGrid";
import NorthIndianChart from "@/components/kundali/NorthIndianChart";
import DashaTimeline from "@/components/kundali/DashaTimeline";
import ReadingView from "@/components/kundali/ReadingView";

type Status = "loading" | "resume" | "form" | "paying" | "generating" | "summary" | "result";

export default function KundaliApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<Kundali | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ payment_id: string; birth: GenerateBody } | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    (async () => {
      const token = await getToken();
      try {
        const chart = await getLatestKundali(token);
        setResult(chart);
        setStatus("summary");
        return;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          setError("Couldn't reach AstraVeda. Please refresh and try again.");
          setStatus("form");
          return;
        }
      }
      try {
        const { pending: pendingOrder } = await pendingKundaliCheckout(token);
        if (pendingOrder) {
          setPending(pendingOrder);
          setStatus("resume");
          return;
        }
      } catch {
        // fall through to the form
      }
      setStatus("form");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded]);

  const startGeneration = useCallback(
    async (body: GenerateBody, payment: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
      const token = await getToken();
      setStatus("generating");
      try {
        const chart = await generateKundali(body, payment, token);
        setResult(chart);
        setStatus("result");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Generation failed. Please try again.");
        setStatus("form");
      }
    },
    [getToken],
  );

  const handleSubmit = useCallback(
    async (body: GenerateBody) => {
      setError(null);
      setStatus("paying");
      const token = await getToken();
      try {
        const checkout = await createKundaliCheckout(body, token, "card");
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Kundli · ${body.name}`,
          description: "AstraVeda Kundli chart",
          onSuccess: (r) =>
            startGeneration(body, {
              payment_id: checkout.payment_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            }),
          onDismiss: () => setStatus("form"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
        setStatus("form");
      }
    },
    [getToken, startGeneration],
  );

  const handleResume = useCallback(() => {
    if (!pending) return;
    startGeneration(pending.birth, { payment_id: pending.payment_id });
  }, [pending, startGeneration]);

  const handleGetReading = useCallback(async () => {
    if (!result) return;
    setReadingLoading(true);
    try {
      const token = await getToken();
      const { reading_en } = await getKundaliReading(result.id, token);
      setResult({ ...result, reading_en });
    } catch {
      setError("Couldn't fetch the reading. Please try again.");
    } finally {
      setReadingLoading(false);
    }
  }, [result, getToken]);

  if (status === "loading") {
    return <ZodiacLoader label="Reading the stars" />;
  }

  if (status === "resume" && pending) {
    return (
      <div className="text-center py-10 rounded-[28px] bg-[#FFF7E6] p-9 max-w-[480px] mx-auto">
        <p className="text-[15px] text-[#1B1730] mb-2">
          You already paid for a chart that didn&apos;t finish generating.
        </p>
        <p className="text-[13px] text-[#5B5570] mb-7">
          {pending.birth.name} · {pending.birth.birth_date}
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleResume}
            className="h-12 px-7 rounded-[100px] font-semibold text-[14.5px] text-[#241505] bg-[linear-gradient(180deg,#F7DDA2,#E9BE6C)]"
          >
            Finish generating my chart
          </button>
          <button
            type="button"
            onClick={() => setStatus("form")}
            className="h-12 px-6 rounded-[100px] text-[14px] font-medium text-[#5B5570] border border-[#1B1730]/14"
          >
            Start a new chart
          </button>
        </div>
      </div>
    );
  }

  if (status === "summary" && result) {
    const a = result.chart.avakhada;
    const facts: [string, string][] = [
      ["Lagna", result.chart.lagna.sign],
      ["Moon Sign", a.moon_sign],
      ["Nakshatra", a.nakshatra],
      ["Mahadasha", result.chart.vimshottari.current.mahadasha ?? "—"],
    ];
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-[28px] bg-[#FFF7E6] p-8 sm:p-10 max-w-[480px] mx-auto text-center"
      >
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-[20px] font-semibold text-white bg-[linear-gradient(135deg,#8F29DD,#A72BE6)]">
          {result.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-medium text-[#1B1730]">
          {result.name}&apos;s Kundli
        </h1>
        <p className="text-[13px] text-[#5B5570] mb-6">
          {result.birth_date} · {result.birth_place}
        </p>

        <div className="grid grid-cols-2 gap-2.5 mb-8">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-[12px] bg-[#8F29DD]/[.05] border border-[#8F29DD]/12 px-3 py-2.5">
              <div className="text-[10.5px] text-[#5B5570]">{label}</div>
              <div className="text-[13px] font-semibold text-[#1B1730] mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setStatus("result")}
            className="h-12 rounded-[100px] font-semibold text-[14.5px] text-[#241505] bg-[linear-gradient(180deg,#F7DDA2,#E9BE6C)]"
          >
            View Full Chart
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
              setStatus("form");
            }}
            className="h-12 rounded-[100px] font-semibold text-[13.5px] text-[#8F29DD] border border-[#8F29DD]/25"
          >
            Generate New Chart
          </button>
        </div>
      </motion.div>
    );
  }

  if (status === "paying" || status === "generating") {
    return (
      <ZodiacLoader label={status === "paying" ? "Waiting for payment" : "Computing your chart"} />
    );
  }

  if (status === "form") {
    return (
      <div className="rounded-[28px] bg-[#FFF7E6] p-6 sm:p-9 max-w-[480px] mx-auto">
        <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
          Your Kundli
        </h1>
        <p className="text-[13.5px] text-[#5B5570] mb-7">
          A few details, then a ₹15 chart computed on our own Swiss Ephemeris engine.
        </p>
        <BirthForm
          defaultName={user?.fullName || user?.firstName || ""}
          submitting={false}
          error={error}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  if (status === "result" && result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-[28px] bg-[#FFF7E6] p-6 sm:p-9 max-w-[980px] mx-auto"
      >
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <button
              type="button"
              onClick={() => setStatus("summary")}
              className="text-[12.5px] text-[#8F29DD] hover:text-[#7420c4] mb-1.5"
            >
              ← Back
            </button>
            <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730]">
              {result.name}&apos;s Kundli
            </h1>
            <p className="text-[13px] text-[#5B5570]">
              {result.birth_date} · {result.birth_place}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
              setStatus("form");
            }}
            className="text-[13px] font-semibold text-[#8F29DD] hover:text-[#7420c4]"
          >
            Generate another chart
          </button>
        </div>

        <section className="mb-9">
          <SectionHeading>Avakhada</SectionHeading>
          <AvakhadaGrid chart={result.chart} />
        </section>

        <div className="grid lg:grid-cols-[380px_1fr] gap-8 lg:gap-10 mb-9 items-start">
          <section className="lg:sticky lg:top-28">
            <SectionHeading>Birth Chart (D1)</SectionHeading>
            <NorthIndianChart houses={result.chart.houses} planets={result.chart.planets} />
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-[22px] font-medium mb-4 bg-clip-text text-transparent bg-[linear-gradient(90deg,#8F29DD,#D0447E,#C18426)]">
              Your Reading
            </h2>
            {result.reading_en ? (
              <div className="rounded-[20px] bg-[linear-gradient(165deg,#FFFDF8,#FBF2E0)] border border-[#C18426]/20 p-6 sm:p-7">
                <ReadingView text={result.reading_en} />
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-[#C18426]/30 p-7 flex flex-col items-start gap-3.5">
                <p className="text-[13.5px] text-[#5B5570]">
                  A natural-language reading of this chart, written by AI from the
                  computed facts above.
                </p>
                <button
                  type="button"
                  onClick={handleGetReading}
                  disabled={readingLoading}
                  className="h-11 px-6 rounded-[100px] font-semibold text-[13.5px] text-white bg-[#8F29DD] disabled:opacity-60"
                >
                  {readingLoading ? "Writing your reading…" : "Get AI Reading"}
                </button>
              </div>
            )}
          </section>
        </div>

        <section>
          <SectionHeading>Vimshottari Dasha</SectionHeading>
          <DashaTimeline chart={result.chart} />
        </section>
      </motion.div>
    );
  }

  return null;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[14px] font-semibold text-[#1B1730] mb-4">
      <span className="w-6 h-px bg-[linear-gradient(90deg,#C18426,transparent)]" />
      {children}
    </h2>
  );
}
