"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";

import {
  createKundaliCheckout,
  generateKundali,
  getKundali,
  getKundaliReading,
  getLatestKundali,
  pendingKundaliCheckout,
  type GenerateBody,
  type Kundali,
} from "@/lib/kundali";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@/lib/api";
import { useWallet } from "@/hooks/use-wallet";
import BirthForm from "@/components/kundali/BirthForm";
import ZodiacLoader from "@/components/kundali/ZodiacLoader";
import AvakhadaGrid from "@/components/kundali/AvakhadaGrid";
import NorthIndianChart from "@/components/kundali/NorthIndianChart";
import DashaTimeline from "@/components/kundali/DashaTimeline";
import ReadingView from "@/components/kundali/ReadingView";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";

const KUNDALI_PRICE_PAISE = 1500; // ₹15 — mirrors backend config.kundali_price_paise

type Status = "loading" | "resume" | "form" | "paying" | "generating" | "summary" | "result";

export default function KundaliApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chartId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<Kundali | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ payment_id: string; birth: GenerateBody } | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [methodSheetBody, setMethodSheetBody] = useState<GenerateBody | null>(null);

  useEffect(() => {
    if (!authLoaded) return;
    (async () => {
      const token = await getToken();

      // Opened from the "Your Charts" gallery — go straight to that chart's
      // full view, the gallery card already showed the summary facts.
      if (chartId) {
        try {
          const chart = await getKundali(chartId, token);
          setResult(chart);
          setStatus("result");
        } catch {
          setError("Couldn't load that chart. It may have been deleted.");
          setStatus("form");
        }
        return;
      }

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
  }, [authLoaded, chartId]);

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

  // BirthForm's final step just collects details — the wallet-vs-card choice
  // (and the actual charge) happens in the PayMethodSheet opened from here.
  const handleSubmit = useCallback((body: GenerateBody) => {
    setError(null);
    setMethodSheetBody(body);
  }, []);

  const payAndGenerate = useCallback(
    async (body: GenerateBody, method: "card" | "wallet") => {
      setMethodSheetBody(null);
      setError(null);
      setStatus("paying");
      const token = await getToken();
      try {
        const checkout = await createKundaliCheckout(body, token, method);
        if (checkout.method === "wallet") {
          await startGeneration(body, { payment_id: checkout.payment_id });
          refreshWallet();
          return;
        }
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
    [getToken, startGeneration, refreshWallet],
  );

  const handleResume = useCallback(() => {
    if (!pending) return;
    startGeneration(pending.birth, { payment_id: pending.payment_id });
  }, [pending, startGeneration]);

  const handleGetReading = useCallback(async () => {
    if (!result) return;
    setReadingLoading(true);
    setReadingError(null);
    try {
      const token = await getToken();
      const { reading_en } = await getKundaliReading(result.id, token);
      setResult({ ...result, reading_en });
    } catch (err) {
      setReadingError(err instanceof ApiError ? err.message : "Couldn't fetch the reading.");
    } finally {
      setReadingLoading(false);
    }
  }, [result, getToken]);

  // The reading writes itself the moment the chart is ready — no extra click.
  useEffect(() => {
    if (status === "result" && result && !result.reading_en && !readingLoading && !readingError) {
      handleGetReading();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result?.id, result?.reading_en, readingError]);

  if (status === "loading") {
    return <ZodiacLoader label="Reading the stars" />;
  }

  if (status === "resume" && pending) {
    return (
      <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <div className="text-center py-10 rounded-[28px] bg-[#FFF7E6] p-9">
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
            className="h-12 px-7 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] shadow-[0_8px_22px_rgba(214,51,108,.3)]"
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
      <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-[28px] bg-[#FFF7E6] p-8 sm:p-10 text-center"
        >
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-[20px] font-semibold text-white bg-[linear-gradient(135deg,#D6336C,#FF5C8A)]">
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
            <div key={label} className="rounded-[12px] bg-[#D6336C]/[.05] border border-[#D6336C]/15 px-3 py-2.5">
              <div className="text-[10.5px] text-[#5B5570]">{label}</div>
              <div className="text-[13px] font-semibold text-[#1B1730] mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setStatus("result")}
            className="h-12 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] shadow-[0_8px_22px_rgba(214,51,108,.3)]"
          >
            View Full Chart
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
              router.push("/kundali");
            }}
            className="h-12 rounded-[100px] font-semibold text-[13.5px] text-[#D6336C] border border-[#D6336C]/30"
          >
            Generate New Chart
          </button>
          <button
            type="button"
            onClick={() => router.push("/kundali/charts")}
            className="h-11 text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
          >
            View All Charts →
          </button>
        </div>
        </motion.div>
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
      <>
        <div className="max-w-[480px] mx-auto">
        <BackLink onClick={() => router.back()} />
        <div className="rounded-[28px] bg-[#FFF7E6] p-6 sm:p-9">
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-medium text-[#1B1730] mb-1">
            Your Kundli
          </h1>
          <p className="text-[13.5px] text-[#5B5570] mb-7">
            A few details, then a ₹15 chart computed on our own Swiss Ephemeris engine.
          </p>
          <BirthForm
            userName={user?.fullName || user?.firstName || user?.username || "You"}
            submitting={false}
            error={error}
            onSubmit={handleSubmit}
            onExit={() => router.back()}
          />
        </div>
        </div>
        <PayMethodSheet
          open={methodSheetBody !== null}
          amountPaise={KUNDALI_PRICE_PAISE}
          balancePaise={wallet?.balance_paise ?? null}
          onPick={(method) => methodSheetBody && payAndGenerate(methodSheetBody, method)}
          onAddMoney={() => router.push("/wallet")}
          onClose={() => setMethodSheetBody(null)}
        />
      </>
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
              className="text-[12.5px] text-[#D6336C] hover:text-[#B8265A] mb-1.5"
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/kundali/charts")}
              className="text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
            >
              View All Charts
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError(null);
                router.push("/kundali");
              }}
              className="text-[13px] font-semibold text-[#D6336C] hover:text-[#B8265A]"
            >
              Generate another chart
            </button>
          </div>
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
            <h2 className="font-[family-name:var(--font-display)] text-[22px] font-medium mb-4 bg-clip-text text-transparent bg-[linear-gradient(90deg,#D6336C,#FF5C8A)]">
              Your Reading
            </h2>
            {result.reading_en ? (
              <div className="rounded-[20px] bg-[linear-gradient(165deg,#FFFDF8,#FDF0F4)] border border-[#D6336C]/18 p-6 sm:p-7">
                <ReadingView text={result.reading_en} />
              </div>
            ) : readingError ? (
              <div className="rounded-[20px] border border-dashed border-[#C0392B]/30 p-7 flex flex-col items-start gap-3.5">
                <p className="text-[13.5px] text-[#C0392B]">{readingError}</p>
                <button
                  type="button"
                  onClick={handleGetReading}
                  className="h-11 px-6 rounded-[100px] font-semibold text-[13.5px] text-white bg-[linear-gradient(135deg,#D6336C,#FF5C8A)]"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-[#D6336C]/30 p-7 flex items-center gap-3.5">
                <span className="w-5 h-5 rounded-full border-2 border-[#D6336C]/25 border-t-[#D6336C] animate-spin flex-shrink-0" />
                <p className="text-[13.5px] text-[#5B5570]">
                  Writing your reading — AI is turning the chart above into a natural-language
                  narrative…
                </p>
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
      <span className="w-6 h-px bg-[linear-gradient(90deg,#D6336C,transparent)]" />
      {children}
    </h2>
  );
}

// Leaves the Kundali flow entirely (browser back — usually returns to the
// homepage or wherever the user came from), as opposed to BirthForm's own
// step-back which only moves within the form.
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
