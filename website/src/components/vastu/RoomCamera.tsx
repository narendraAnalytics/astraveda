"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, X } from "lucide-react";

const GRADIENT = "linear-gradient(135deg,#7a2e0e,#c2571f,#e0932f)";

// Live camera for a room photo — getUserMedia on phone or laptop, tap the
// shutter to capture the full (uncropped) frame. Rear camera by default, with a
// flip button when the device has more than one. Mirrors the mobile app's
// RoomCamera (a plain shutter — the subject is a whole room, so no auto-shutter).
export default function RoomCamera({
  onCaptured,
  onClose,
  onUpload,
}: {
  onCaptured: (file: File) => void;
  onClose: () => void;
  onUpload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPermission("pending");
    streamRef.current?.getTracks().forEach((t) => t.stop());

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("denied");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission("granted");
        try {
          const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
          if (!cancelled) setCanFlip(cams.length > 1);
        } catch {
          // flip stays hidden
        }
      })
      .catch(() => !cancelled && setPermission("denied"));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (busy || !video || !canvas || !video.videoWidth) return;
    setBusy(true);
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false);
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCaptured(new File([blob], "room.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.88,
    );
  }, [busy, onCaptured]);

  if (permission === "denied") {
    return (
      <div className="fixed inset-0 z-[200] bg-[#160d07] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-[18px] bg-[#fbeee2] flex items-center justify-center">
          <Camera size={26} color="#c2571f" />
        </div>
        <h3 className="text-white text-[17px] font-semibold">Camera access needed</h3>
        <p className="text-white/70 text-[13px] max-w-[330px]">
          Your browser blocked the camera, or none was found. Allow it in your browser&apos;s site settings, or
          upload a photo from your device instead.
        </p>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-2 text-[13.5px] font-bold px-6 py-3 rounded-full text-white"
          style={{ background: GRADIENT }}
        >
          <ImagePlus size={16} /> Upload from device
        </button>
        <button type="button" onClick={onClose} className="text-white/60 text-[12.5px] mt-1">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#160d07] overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Rule-of-thirds guide — helps frame a whole room */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
        <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close camera"
        className="absolute right-4 w-10 h-10 rounded-full bg-black/45 flex items-center justify-center text-white z-10"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X size={20} />
      </button>

      <div
        className="absolute left-1/2 -translate-x-1/2 text-center px-4 py-2 rounded-full bg-black/50 text-white text-[12.5px] font-semibold"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        {permission === "pending" ? "Starting camera…" : "Fit as much of the room in frame as you can"}
      </div>

      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}
      >
        <button
          type="button"
          onClick={onUpload}
          aria-label="Upload from device instead"
          className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center text-white"
        >
          <ImagePlus size={20} />
        </button>
        <button
          type="button"
          onClick={shoot}
          disabled={permission !== "granted" || busy}
          aria-label="Take photo"
          className="w-[78px] h-[78px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
        >
          <span className="w-[60px] h-[60px] rounded-full" style={{ background: GRADIENT }} />
        </button>
        {canFlip ? (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            aria-label="Switch camera"
            className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center text-white"
          >
            <RefreshCw size={20} />
          </button>
        ) : (
          <span className="w-12 h-12" />
        )}
      </div>
    </div>
  );
}
