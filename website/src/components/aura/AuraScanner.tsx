"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Camera, X, RefreshCw } from "lucide-react";

const VIOLET = "#7c3aed";
const GOLD = "#ffd36a";
const FRAME = 300;

// Auto-shutter timing (ms) — mirrors the mobile app's AuraScanner.
const SETTLE_MS = 2400;
const HOLD_MS = 3200;
const RETRY_MS = 3500;
const MAX_AUTO_RETRIES = 3;

const COACH = [
  "Center your face in the circle",
  "Soft, even light on your face",
  "A plain background reads best",
  "Relax — let your energy settle",
];

const ANALYSING = [
  "Reading the colours around you…",
  "Feeling the warmth of the light…",
  "Mapping your seven chakras…",
  "Naming your aura…",
];

type Stage = "framing" | "holding" | "capturing";

export default function AuraScanner({
  onCaptured,
  onManual,
  onClose,
  analysing,
  errorText,
  onRetake,
}: {
  onCaptured: (base64: string, mime: string) => void;
  onManual: () => void;
  onClose: () => void;
  analysing: boolean;
  errorText: string | null;
  onRetake: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [stage, setStage] = useState<Stage>("framing");
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [coachIdx, setCoachIdx] = useState(0);
  const [analyseIdx, setAnalyseIdx] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [autoRetries, setAutoRetries] = useState(0);
  const [manualHold, setManualHold] = useState(false);

  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 640, height: 640 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission("granted");
      })
      .catch(() => !cancelled && setPermission("denied"));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const fire = useCallback(() => {
    if (busyRef.current || !videoRef.current || !canvasRef.current) return;
    busyRef.current = true;
    setStage("capturing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      busyRef.current = false;
      setStage("framing");
      return;
    }
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setShotUrl(dataUrl);
    onCaptured(dataUrl.split(",")[1] ?? "", "image/jpeg");
  }, [onCaptured]);

  const runSequence = useCallback(() => {
    if (busyRef.current || manualHold) return;
    clearTimers();
    setStage("framing");
    setHoldProgress(0);

    later(() => {
      setStage("holding");
      if (!reduceMotion) {
        const start = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / HOLD_MS);
          setHoldProgress(p);
          if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
      later(fire, HOLD_MS);
    }, SETTLE_MS);
  }, [clearTimers, later, fire, reduceMotion, manualHold]);

  useEffect(() => {
    if (permission !== "granted" || shotUrl || analysing || errorText) return;
    runSequence();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, shotUrl, analysing, errorText]);

  useEffect(() => {
    if (shotUrl || analysing || errorText) return;
    const id = setInterval(() => setCoachIdx((i) => (i + 1) % COACH.length), 2200);
    return () => clearInterval(id);
  }, [shotUrl, analysing, errorText]);

  useEffect(() => {
    if (!analysing) {
      setAnalyseIdx(0);
      return;
    }
    const id = setInterval(() => setAnalyseIdx((i) => (i + 1) % ANALYSING.length), 2100);
    return () => clearInterval(id);
  }, [analysing]);

  useEffect(() => {
    if (!errorText) return;
    busyRef.current = false;
    setShotUrl(null);
    setStage("framing");
    clearTimers();

    if (autoRetries >= MAX_AUTO_RETRIES) {
      setManualHold(true);
      return;
    }
    setManualHold(false);
    later(() => {
      setAutoRetries((n) => n + 1);
      onRetake();
    }, RETRY_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorText]);

  const tapNow = useCallback(() => {
    clearTimers();
    setManualHold(false);
    setAutoRetries(0);
    if (errorText) {
      onRetake();
      return;
    }
    if (stage === "holding") fire();
    else runSequence();
  }, [stage, fire, runSequence, clearTimers, errorText, onRetake]);

  if (permission === "denied") {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0d0a1a] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-[18px] bg-[#f4effe] flex items-center justify-center">
          <Camera size={26} color={VIOLET} />
        </div>
        <h3 className="text-white text-[17px] font-semibold">Camera access to scan your aura</h3>
        <p className="text-white/70 text-[13px] max-w-[320px]">
          Your browser blocked camera access, or none is available. Allow it in your browser's
          site settings to continue.
        </p>
        <button type="button" onClick={onManual} className="text-[13px] font-semibold px-5 py-3 rounded-full text-white" style={{ background: `linear-gradient(135deg,${VIOLET},#c026d3)` }}>
          Back
        </button>
        <button type="button" onClick={onClose} className="text-white/60 text-[12.5px] mt-1">
          Cancel
        </button>
      </div>
    );
  }

  const holding = stage === "holding";
  const outlineColor = holding ? GOLD : "#fff";

  return (
    <div className="fixed inset-0 z-[200] bg-[#0d0a1a] overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", display: shotUrl ? "none" : "block" }}
      />
      {shotUrl && (
        <>
          <img src={shotUrl} alt="Captured selfie" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white z-10"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X size={20} />
      </button>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none px-6">
        <div
          className="relative rounded-full border-2 overflow-hidden flex items-center justify-center"
          style={{ width: FRAME, height: FRAME, borderColor: "rgba(255,255,255,0.4)" }}
        >
          <svg width={FRAME} height={FRAME} className="absolute inset-0" style={{ opacity: 0.5 + (holding ? holdProgress * 0.4 : 0) }}>
            <circle cx={FRAME / 2} cy={FRAME / 2} r={FRAME / 2 - 4} stroke={outlineColor} strokeWidth={2.5} strokeDasharray="4 7" fill="none" />
          </svg>

          {holding && !reduceMotion && (
            <svg width={FRAME} height={FRAME} className="absolute inset-0">
              <circle cx={FRAME / 2} cy={FRAME / 2} r={140} stroke="rgba(255,255,255,0.16)" strokeWidth={4} fill="none" />
              <circle
                cx={FRAME / 2}
                cy={FRAME / 2}
                r={140}
                stroke={GOLD}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={2 * Math.PI * 140}
                strokeDashoffset={2 * Math.PI * 140 * (1 - holdProgress)}
                transform={`rotate(-90 ${FRAME / 2} ${FRAME / 2})`}
              />
            </svg>
          )}

          {analysing && !reduceMotion && (
            <motion.div
              className="absolute left-0 right-0 h-[3px]"
              style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}` }}
              animate={{ top: [0, FRAME - 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        <AnimatePresence mode="wait">
          {analysing ? (
            <motion.div
              key={analyseIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-2.5 max-w-[86%]"
            >
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0" />
              <span className="text-white text-[12.5px] font-semibold">{ANALYSING[analyseIdx]}</span>
            </motion.div>
          ) : errorText ? (
            <div className="flex items-center gap-2 rounded-full px-4 py-2.5 max-w-[86%]" style={{ background: "rgba(124,58,237,0.94)" }}>
              <span className="text-white text-[12.5px] font-semibold">
                {errorText}
                {manualHold ? "" : " Retrying…"}
              </span>
            </div>
          ) : (
            <motion.div key={holding ? "hold" : coachIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-10">
              <p className="text-white/90 text-[13px] font-semibold text-center leading-[1.4]">
                {holding ? "Hold still — capturing automatically" : COACH[coachIdx]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute left-0 right-0 flex flex-col items-center gap-2.5" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}>
        {!analysing && manualHold && (
          <button type="button" onClick={tapNow} className="flex items-center gap-2 text-white font-bold text-[14px] px-6 py-3 rounded-2xl" style={{ background: VIOLET }}>
            <RefreshCw size={16} /> Scan again
          </button>
        )}
      </div>
    </div>
  );
}
