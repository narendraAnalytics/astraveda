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

type Status = "loading" | "resume" | "form" | "paying" | "generating" | "result";

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
        setStatus("result");
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
      <div className="text-center py-10">
        <p className="text-[15px] text-[rgba(255,247,230,.8)] mb-2">
          You already paid for a chart that didn&apos;t finish generating.
        </p>
        <p className="text-[13px] text-[rgba(255,247,230,.5)] mb-7">
          {pending.birth.name} · {pending.birth.birth_date}
        </p>
        <div className="flex items-center justify-center gap-3">
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
            className="h-12 px-6 rounded-[100px] text-[14px] font-medium text-[rgba(255,247,230,.7)] border border-[rgba(255,247,230,.2)]"
          >
            Start a new chart
          </button>
        </div>
      </div>
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
        className="rounded-[28px] bg-[#FFF7E6] p-6 sm:p-9 max-w-[720px] mx-auto"
      >
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
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

        <section className="mb-8">
          <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Avakhada</h2>
          <AvakhadaGrid chart={result.chart} />
        </section>

        <section className="mb-8">
          <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Birth Chart (D1)</h2>
          <NorthIndianChart houses={result.chart.houses} />
        </section>

        <section className="mb-8">
          <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Vimshottari Dasha</h2>
          <DashaTimeline chart={result.chart} />
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Reading</h2>
          {result.reading_en ? (
            <p className="text-[14px] leading-[1.7] text-[#3A3450] whitespace-pre-line">
              {result.reading_en}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleGetReading}
              disabled={readingLoading}
              className="h-11 px-6 rounded-[100px] font-semibold text-[13.5px] text-white bg-[#8F29DD] disabled:opacity-60"
            >
              {readingLoading ? "Writing your reading…" : "Get AI Reading"}
            </button>
          )}
        </section>
      </motion.div>
    );
  }

  return null;
}
