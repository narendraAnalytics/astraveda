"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { INTRO_VIDEO, LOGO_URL } from "@/lib/site";
import { useI18n } from "@/i18n/I18nProvider";
import { CoverStage, WatermarkPatch } from "./WatermarkPatch";

// Shown once per browser-tab session (sessionStorage) — reloads, in-site navigation and
// coming back from /sign-in don't re-gate the visitor; a new tab / new visit does.
const SEEN_KEY = "astraveda.web.introSeen";

export default function IntroOverlay() {
  const { d } = useI18n();
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false); // already seen this session → render nothing at all
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);

  // First paint (server + client) shows the overlay so a first-time visitor never sees the
  // page flash before it; a returning visitor's overlay is dropped instantly (no exit animation).
  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setHidden(true);
    } catch {
      /* storage blocked — just show it */
    }
  }, []);

  const visible = !hidden && open;

  // Lock page scroll while the intro is up.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const enter = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    videoRef.current?.pause();
    setOpen(false);
  };

  // Enter key = click Enter (unless a button is focused, which handles its own Enter).
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return;
      enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted; // triggered by a click, so the browser allows unmuting
    setMuted(v.muted);
  };

  if (hidden) return null;
  const showVideo = mounted && !reduce;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="intro"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] overflow-hidden bg-[#0B0820]"
          exit={{ opacity: 0, scale: 1.07, filter: "blur(14px)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Cosmic base + logo — visible while the video buffers, and as the whole
              background for Reduce Motion viewers */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "radial-gradient(70% 60% at 50% 38%, rgba(143,41,221,.35), transparent 70%), radial-gradient(60% 50% at 80% 100%, rgba(244,210,138,.18), transparent 70%), #0B0820",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="" className="h-24 w-auto opacity-80 sm:h-32" />
          </div>

          {showVideo && (
            <div
              className="absolute inset-0 [container-type:size] transition-opacity duration-1000 ease-out"
              style={{ opacity: ready ? 1 : 0 }}
            >
              <CoverStage>
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onCanPlay={() => setReady(true)}
                >
                  <source src={INTRO_VIDEO} type="video/webm" />
                </video>
                <WatermarkPatch />
              </CoverStage>
            </div>
          )}

          {/* Legibility scrim for the bottom controls */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
            style={{
              background:
                "linear-gradient(to top, rgba(11,8,32,.78), rgba(11,8,32,.35) 55%, transparent)",
            }}
          />

          {showVideo && ready && (
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? d.intro.soundOn : d.intro.soundOff}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#F4D28A]/70 bg-black/35 text-[#F4D28A] shadow-[0_6px_20px_rgba(0,0,0,.35)] backdrop-blur-md transition hover:scale-105 hover:bg-black/50 sm:right-6 sm:top-6"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}

          {/* Enter */}
          <div className="absolute inset-x-0 bottom-[max(2.5rem,env(safe-area-inset-bottom))] flex justify-center px-6">
            <motion.button
              type="button"
              autoFocus
              onClick={enter}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-3 rounded-full px-10 py-4 text-[17px] font-semibold tracking-[.04em] text-[#241505] shadow-[0_10px_36px_rgba(244,210,138,.5)]"
              style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
            >
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full border border-[#F4D28A]"
                  animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {d.intro.enter}
              <ArrowRight
                size={20}
                strokeWidth={2.4}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
