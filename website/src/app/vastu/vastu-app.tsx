"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Camera, Check, Compass, ImagePlus, LayoutGrid, Plus } from "lucide-react";

import {
  analyzeVastu,
  createVastuCheckout,
  getVastu,
  pendingVastuCheckout,
  directionLabel,
  ROOM_TYPES,
  type Direction,
  type PaymentProof,
  type RoomType,
  type SpaceFields,
  type VastuReading,
} from "@/lib/vastu";
import { ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useWallet } from "@/hooks/use-wallet";
import PayMethodSheet from "@/components/wallet/PayMethodSheet";
import CompassPicker from "@/components/vastu/CompassPicker";
import ScoreDial from "@/components/vastu/ScoreDial";
import ElementBars from "@/components/vastu/ElementBars";
import VastuLoader from "@/components/vastu/VastuLoader";

const VASTU_PRICE_PAISE = 15000; // ₹150 — display only; the server sets the real amount
const CLAY = "#c2571f";
const GRADIENT = "linear-gradient(135deg,#7a2e0e,#c2571f,#e0932f)";

const ROOM_GLYPH: Record<RoomType, string> = {
  Entrance: "🚪",
  Living: "🛋️",
  Kitchen: "🍳",
  Bedroom: "🛏️",
  Pooja: "🪔",
  Bathroom: "🚿",
  Study: "📚",
  Other: "🏠",
};

const SEVERITY_TINT: Record<string, string> = { minor: "#e0932f", moderate: "#dd7a3a", major: "#d9534f" };

type Status = "loading" | "form" | "paying" | "capture" | "generating" | "result";

// Downscale + re-encode the photo in the browser: a phone camera shot is
// 4–10 MB, the analysis needs ~1280px. Returns bare base64 (no data: prefix).
async function prepareImage(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  return { base64: dataUrl.split(",")[1], mime: "image/jpeg" };
}

export default function VastuApp() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vastuId = searchParams.get("id");
  const { wallet, refresh: refreshWallet } = useWallet();

  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<VastuReading | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; space: SpaceFields } | null>(null);

  const [label, setLabel] = useState("");
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [direction, setDirection] = useState<Direction>("Unknown");

  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState<PaymentProof | { payment_id: string } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const canPay = label.trim().length >= 2 && !!roomType;

  const space = useCallback(
    (): SpaceFields => ({ label: label.trim(), room_type: (roomType ?? "Other") as RoomType, direction }),
    [label, roomType, direction],
  );

  useEffect(() => {
    if (!authLoaded) return;
    (async () => {
      const token = await getToken();
      if (vastuId) {
        try {
          setResult(await getVastu(vastuId, token));
          setStatus("result");
        } catch {
          setError("Couldn't load that analysis. It may have been deleted.");
          setStatus("form");
        }
        return;
      }
      setStatus("form");
      try {
        const { pending } = await pendingVastuCheckout(token);
        if (pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, vastuId]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const payAndGo = useCallback(
    async (method: "card" | "wallet") => {
      setPayOpen(false);
      setError(null);
      setStatus("paying");
      try {
        const token = await getToken();
        const checkout = await createVastuCheckout(space(), token, method);
        if (checkout.method === "wallet") {
          setPaid({ payment_id: checkout.payment_id });
          refreshWallet();
          setCaptureError(null);
          setStatus("capture");
          return;
        }
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: `Vastu AI · ${space().label}`,
          description: "AstraVeda Vastu analysis",
          onSuccess: (r) => {
            setPaid({
              payment_id: checkout.payment_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setCaptureError(null);
            setStatus("capture");
          },
          onDismiss: () => setStatus("form"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
        setStatus("form");
      }
    },
    [getToken, refreshWallet, space],
  );

  const handleResume = useCallback(() => {
    if (!resumable) return;
    setLabel(resumable.space.label ?? "");
    setRoomType((resumable.space.room_type as RoomType) ?? null);
    setDirection((resumable.space.direction as Direction) ?? "Unknown");
    setPaid({ payment_id: resumable.payment_id });
    setResumable(null);
    setCaptureError(null);
    setStatus("capture");
  }, [resumable]);

  const analyse = useCallback(
    async (file: File) => {
      if (!paid) return;
      if (!file.type.startsWith("image/")) {
        setCaptureError("Please choose an image file (JPG, PNG or WebP).");
        return;
      }
      setCaptureError(null);
      setStatus("generating");
      try {
        const { base64, mime } = await prepareImage(file);
        const token = await getToken();
        const r = await analyzeVastu({ ...space(), image: base64, mime_type: mime }, paid, token);
        setPhotoUrl(URL.createObjectURL(file));
        setResult(r);
        setStatus("result");
      } catch (err) {
        setStatus("capture");
        if (err instanceof ApiError && (err.status === 422 || err.status === 429)) setCaptureError(err.message);
        else if (err instanceof ApiError && err.status === 402)
          setCaptureError("We couldn't confirm your payment. Reopen from “Payment received”.");
        else setCaptureError(err instanceof Error ? err.message : "Analysis failed — please try again.");
      }
    },
    [getToken, paid, space],
  );

  const startOver = () => {
    setResult(null);
    setPhotoUrl(null);
    setError(null);
    setPaid(null);
    setCaptureError(null);
    setLabel("");
    setRoomType(null);
    setDirection("Unknown");
    setStatus("form");
    router.push("/vastu");
  };

  if (status === "loading") return <VastuLoader label="Opening Vastu AI" />;
  if (status === "paying") return <VastuLoader label="Waiting for payment" />;
  if (status === "generating") return <VastuLoader label={`Studying ${label.trim() || "the space"}`} />;

  if (status === "result" && result) {
    return (
      <Result
        vastu={result}
        photoUrl={photoUrl}
        fromList={Boolean(vastuId)}
        onBack={() => (vastuId ? router.push("/vastu/spaces") : startOver())}
        onNew={startOver}
        onSpaces={() => router.push("/vastu/spaces")}
      />
    );
  }

  if (status === "capture") {
    return (
      <div className="max-w-[560px] mx-auto">
        <BackLink onClick={() => setStatus("form")} />
        <div className="rounded-[28px] p-6 sm:p-9 border" style={{ background: "linear-gradient(165deg,#FFF6EC,#FFFFFF)", borderColor: "rgba(194,87,31,.2)" }}>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#1f6b45] bg-[#eaf7ee] border border-[#bfe3cb] rounded-full px-3 py-1 mb-4">
            <Check size={13} /> Payment received
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[25px] font-medium text-[#4a2f20] mb-1">
            Add a photo of {label.trim() || "the space"}
          </h1>
          <p className="text-[13.5px] text-[#8b6f62] mb-6">
            A wide shot with as much of the room in frame as possible works best. Your photo is analysed once and never stored.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) analyse(f);
            }}
            className={`rounded-[22px] border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? "border-[#c2571f] bg-[#fbeee2]" : "border-[#c2571f]/35 bg-[#fffaf4]"
            }`}
          >
            <div
              className="w-14 h-14 rounded-[16px] mx-auto mb-4 flex items-center justify-center shadow-[0_10px_24px_rgba(194,87,31,.3)]"
              style={{ background: GRADIENT }}
            >
              <ImagePlus size={24} color="#fff" />
            </div>
            <p className="text-[14.5px] font-semibold text-[#4a2f20]">Drop a room photo here</p>
            <p className="text-[12.5px] text-[#8b6f62] mt-1 mb-5">or choose how to add it</p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="h-12 px-6 rounded-[100px] font-bold text-[14px] text-white shadow-[0_10px_24px_rgba(194,87,31,.3)] inline-flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                style={{ background: GRADIENT }}
              >
                <ImagePlus size={17} /> Upload from device
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="h-12 px-6 rounded-[100px] font-bold text-[14px] inline-flex items-center justify-center gap-2 border transition-colors hover:bg-[#fbeee2]"
                style={{ color: CLAY, borderColor: "rgba(194,87,31,.35)" }}
              >
                <Camera size={17} /> Take a photo
              </button>
            </div>
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) analyse(f);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) analyse(f);
            }}
          />

          {captureError && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-5">
              {captureError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- form
  return (
    <div className="max-w-[600px] mx-auto">
      <BackLink onClick={() => router.back()} />

      {resumable && (
        <button
          type="button"
          onClick={handleResume}
          className="w-full flex items-center gap-3 text-left rounded-[16px] p-3.5 mb-4 bg-[#eaf7ee] border border-[#bfe3cb]"
        >
          <Check size={18} className="text-[#2f8f5b] flex-shrink-0" />
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold text-[#1f6b45]">Payment received</span>
            <span className="block text-[12px] text-[#3f7a5c]">
              Tap to add a photo of {resumable.space.label || "the space"} — no charge.
            </span>
          </span>
        </button>
      )}

      {/* Header panel — earthy terracotta with a faint vastu-grid texture */}
      <div
        className="relative overflow-hidden rounded-[28px] px-6 py-7 sm:px-8 sm:py-8 shadow-[0_22px_50px_rgba(122,46,14,.3)]"
        style={{ background: "linear-gradient(150deg,#5a1f08 0%,#9a3d12 50%,#d4832b 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div aria-hidden className="absolute -right-12 -top-12 w-52 h-52 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,220,160,.35), transparent 70%)" }} />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[.14em] uppercase text-white/75 mb-2">
            <Compass size={14} /> Vastu Shastra
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[32px] font-medium text-white leading-tight">
            Vastu AI
          </h1>
          <p className="text-[13.5px] text-white/80 mt-1.5 max-w-[440px]">
            Tell us about the space, then add a photo. AI checks it against Vastu Shastra and suggests remedies — no demolition.
          </p>
        </div>
      </div>

      <div className="rounded-[28px] p-6 sm:p-8 mt-4 border" style={{ background: "linear-gradient(165deg,#FFF6EC,#FFFFFF)", borderColor: "rgba(194,87,31,.2)" }}>
        <div className="space-y-7">
          <div>
            <FieldLabel>Name this space</FieldLabel>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Our kitchen, Master bedroom"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <FieldLabel>What kind of room is it?</FieldLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROOM_TYPES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoomType(r)}
                  className={`h-[68px] rounded-[16px] flex flex-col items-center justify-center gap-1 text-[12.5px] font-semibold border transition-all ${
                    roomType === r
                      ? "border-transparent text-white shadow-[0_8px_20px_rgba(194,87,31,.32)]"
                      : "bg-white border-[#4a2f20]/12 text-[#6e4a33] hover:border-[#c2571f]/45"
                  }`}
                  style={roomType === r ? { background: GRADIENT } : undefined}
                >
                  <span className="text-[20px] leading-none" aria-hidden>
                    {ROOM_GLYPH[r]}
                  </span>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Which direction does it face?</FieldLabel>
            <p className="text-[12px] text-[#a2896f] -mt-1 mb-3">
              The direction you look when standing in the doorway looking in.
              {direction !== "Unknown" && (
                <>
                  {" "}
                  Selected: <b className="text-[#7a2e0e]">{directionLabel(direction)}</b>
                </>
              )}
            </p>
            <CompassPicker value={direction} onChange={setDirection} />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5 mt-6">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canPay}
          onClick={() => {
            setError(null);
            setPayOpen(true);
          }}
          className="w-full mt-8 flex items-center justify-center gap-2.5 py-3.5 rounded-[100px] font-bold text-[15px] text-white shadow-[0_10px_26px_rgba(194,87,31,.35)] disabled:opacity-45 disabled:shadow-none transition-all hover:brightness-110"
          style={{ background: GRADIENT }}
        >
          <Compass size={17} />
          Analyze this space · ₹150
        </button>
        <p className="text-[11.5px] text-[#9b7663] text-center mt-3">
          {canPay
            ? "One-time ₹150 · secure payment via Razorpay, then a photo"
            : label.trim().length < 2
              ? "Name the space to continue."
              : "Choose the kind of room."}
        </p>
      </div>

      <div className="text-center mt-5">
        <button
          type="button"
          onClick={() => router.push("/vastu/spaces")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors"
        >
          <LayoutGrid size={15} /> Open my spaces
        </button>
      </div>

      <PayMethodSheet
        open={payOpen}
        amountPaise={VASTU_PRICE_PAISE}
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
  vastu,
  photoUrl,
  fromList,
  onBack,
  onNew,
  onSpaces,
}: {
  vastu: VastuReading;
  photoUrl: string | null;
  fromList: boolean;
  onBack: () => void;
  onNew: () => void;
  onSpaces: () => void;
}) {
  return (
    <div className="max-w-[980px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <BackLink onClick={onBack} label={fromList ? "My spaces" : "New analysis"} />
        <button type="button" onClick={onSpaces} className="text-[13px] font-semibold text-[#5B5570] hover:text-[#1B1730] transition-colors">
          My spaces →
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-9 shadow-[0_22px_50px_rgba(122,46,14,.3)]"
        style={{ background: "linear-gradient(150deg,#5a1f08 0%,#9a3d12 50%,#d4832b 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tracking-[.14em] uppercase text-white/70">Vastu analysis</span>
            <h1 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] font-medium text-white leading-[1.15] mt-1">
              {vastu.label}
            </h1>
            <div className="flex flex-wrap gap-2 mt-4">
              <Pill>
                {ROOM_GLYPH[vastu.room_type] ?? "🏠"} {vastu.room_type}
              </Pill>
              <Pill>
                <Compass size={12} /> Faces {directionLabel(vastu.direction)}
              </Pill>
            </div>
          </div>
          <div className="rounded-[18px] bg-white/95 p-3 shadow-[0_10px_24px_rgba(0,0,0,.18)]">
            <CompassPicker value={vastu.direction} readOnly size="sm" />
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[330px_1fr] gap-5 mt-5 items-start">
        <div className="space-y-5 lg:sticky lg:top-28">
          <Card className="flex justify-center py-7">
            <ScoreDial score={vastu.score} verdict={vastu.verdict} />
          </Card>

          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={vastu.label} className="w-full h-[200px] object-cover rounded-[20px] border border-[#e6c9b3]" />
          )}

          {vastu.elements.length > 0 && (
            <Card>
              <CardTitle>The five elements</CardTitle>
              <ElementBars elements={vastu.elements} />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {vastu.doshas.length > 0 ? (
            <Card>
              <CardTitle>Doshas found</CardTitle>
              <ul className="divide-y divide-[#f3e6d5]">
                {vastu.doshas.map((d, i) => {
                  const tint = SEVERITY_TINT[d.severity] ?? "#e0932f";
                  return (
                    <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="w-2.5 h-2.5 rounded-full mt-[7px] flex-shrink-0" style={{ background: tint }} />
                      <p className="flex-1 text-[14px] leading-[1.6] font-semibold text-[#4a3626]">{d.issue}</p>
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-[.05em] rounded-full px-2 py-0.5 flex-shrink-0 mt-1"
                        style={{ background: `${tint}1f`, color: tint }}
                      >
                        {d.severity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <Card className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#e4f3e9] flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-[#3fa66b]" />
              </span>
              <p className="text-[14px] font-semibold text-[#3d6b52]">No significant doshas visible in this photo.</p>
            </Card>
          )}

          {vastu.remedies.length > 0 && (
            <Card>
              <CardTitle>Remedies (Upay)</CardTitle>
              <ol className="space-y-3">
                {vastu.remedies.map((m, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                    className="flex gap-3.5 rounded-[16px] p-3.5 border"
                    style={{ background: "linear-gradient(160deg,#c2571f0d,#fff)", borderColor: "rgba(194,87,31,.16)" }}
                  >
                    <span
                      className="w-7 h-7 rounded-full text-[12px] font-black text-white flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: GRADIENT }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14.5px] leading-[1.55] font-bold text-[#3c2b1f]">{m.remedy}</p>
                      {m.fixes && <p className="text-[12.5px] leading-[1.55] text-[#6e5747] mt-1">Helps with: {m.fixes}</p>}
                      <span
                        className={`inline-block mt-2 text-[10px] font-extrabold tracking-[.04em] rounded-full px-2.5 py-1 ${
                          m.ease === "easy" ? "bg-[#e4f3e9] text-[#2f8f5b]" : "bg-[#f0e6d8] text-[#8a6f5a]"
                        }`}
                      >
                        {m.ease === "easy" ? "EASY · NO WORK" : "MODERATE EFFORT"}
                      </span>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </Card>
          )}

          {(vastu.summary || vastu.guidance) && (
            <Card className="space-y-7">
              {vastu.summary && (
                <div>
                  <CardTitle>This space</CardTitle>
                  <p className="text-[15.5px] leading-[1.85] text-[#463a33]">
                    {vastu.summary.length > 1 ? (
                      <>
                        <span className="float-left mr-2 mt-1 text-[46px] leading-[.85] font-black" style={{ color: CLAY }}>
                          {vastu.summary[0]}
                        </span>
                        {vastu.summary.slice(1)}
                      </>
                    ) : (
                      vastu.summary
                    )}
                  </p>
                </div>
              )}
              {vastu.guidance && (
                <div>
                  <CardTitle>Where to start</CardTitle>
                  <p className="text-[15.5px] leading-[1.85] text-[#463a33]">{vastu.guidance}</p>
                </div>
              )}
            </Card>
          )}

          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-[100px] font-semibold text-[14px] border"
            style={{ color: CLAY, borderColor: "rgba(194,87,31,.35)", background: "#fbeee2" }}
          >
            <Plus size={16} /> Analyze another space
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full h-12 rounded-[12px] border border-[#4a2f20]/14 bg-white px-4 text-[15px] text-[#3c2924] focus:border-[#c2571f] focus:outline-none focus:ring-2 focus:ring-[#c2571f]/15";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12.5px] font-semibold text-[#6e4a33] mb-2.5">{children}</label>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] p-5 sm:p-6 bg-white border border-[#eeddc8] ${className}`}>{children}</section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 mb-4 font-[family-name:var(--font-display)] text-[19px] font-medium text-[#3c2b1f]">
      <span className="w-1 h-5 rounded-full" style={{ background: GRADIENT }} />
      {children}
    </h2>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white bg-white/15 rounded-full px-3 py-1.5">
      {children}
    </span>
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
