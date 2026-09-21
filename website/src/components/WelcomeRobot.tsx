"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  Aperture,
  ArrowUpRight,
  Hand,
  Home,
  Moon,
  ScanFace,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import AuthAwareLink from "./auth/AuthAwareLink";
import RobotAvatar from "./robot/RobotAvatar";
import { createRobotVoice, prefetchRobotLine } from "@/lib/robot-voice";

// Web port of the mobile WelcomeRobot (frontend/src/components/welcome-robot.tsx): the robot walks
// in, types "Welcome, {name}!" (friend when signed out), speaks it with Sarvam, then lists what
// you can explore. English only (same as mobile — the Sarvam voice is English).
//
// AUDIO ISOLATION: voice lives in lib/robot-voice.ts and uses its own <audio>/speechSynthesis —
// it never reads or writes the intro video, so muting/unmuting the intro can't affect the robot.

const INTRO_EVENT = "astraveda:intro-entered";
const SEEN_KEY = "astraveda.web.introSeen";
const GREETED_KEY = "astraveda.web.robotGreeted";

const WALK_MS = 1800;
const BUBBLE_DELAY_S = 1.2;
const TYPE_START_MS = 1500;
const TYPE_MS = 32;
const FEATURE_STAGGER_S = 0.12;

type Feature = {
  label: string;
  href: string;
  Icon: typeof Sparkles;
  from: string;
  to: string;
};

const FEATURES: Feature[] = [
  { label: "Discover your Kundli", href: "/kundali", Icon: Sparkles, from: "#8F29DD", to: "#D6336C" },
  { label: "Read your palm", href: "/palm", Icon: Hand, from: "#C0356F", to: "#E2745A" },
  { label: "Reveal your face", href: "/face", Icon: ScanFace, from: "#0f8a7e", to: "#3fa66b" },
  { label: "Balance your space with Vastu", href: "/vastu", Icon: Home, from: "#c2571f", to: "#e0932f" },
  { label: "Scan your aura", href: "/aura", Icon: Aperture, from: "#7c3aed", to: "#c026d3" },
  { label: "Interpret your dreams", href: "/dream", Icon: Moon, from: "#4f46e5", to: "#6d28d9" },
];

const readGreeted = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(GREETED_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const markGreeted = (id: string) => {
  try {
    sessionStorage.setItem(GREETED_KEY, JSON.stringify([...new Set([...readGreeted(), id])]));
  } catch {
    /* storage blocked */
  }
};

export default function WelcomeRobot() {
  const reduce = useReducedMotion();
  const { isLoaded, isSignedIn, user } = useUser();

  const [armed, setArmed] = useState(false); // intro is finished (or was already seen)
  const introEntered = useRef(false); // the Enter click happened in THIS page load
  const started = useRef(false);

  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("friend");
  const nameRef = useRef("friend");

  const [stage, setStage] = useState<"greeting" | "features">("greeting");
  const [typed, setTyped] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [walking, setWalking] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false); // browser refused autoplay audio → "tap to hear"

  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const blockedRef = useRef(false);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const forceAdvanceRef = useRef<(() => void) | null>(null);
  const replayRef = useRef(0); // token for playLines() chains
  const typingDoneRef = useRef(false);
  typingDoneRef.current = typingDone;
  const linesRef = useRef({ l1: "", l2: "" });
  const voiceRef = useRef<ReturnType<typeof createRobotVoice> | null>(null);
  if (!voiceRef.current && typeof window !== "undefined") voiceRef.current = createRobotVoice();

  // 1) Arm: after the intro's Enter click, or immediately if the intro was already seen this session.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onEnter = () => {
      introEntered.current = true;
      t = setTimeout(() => setArmed(true), 750); // let the intro's dissolve finish first
    };
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    if (seen) setArmed(true);
    else window.addEventListener(INTRO_EVENT, onEnter, { once: true });
    return () => {
      window.removeEventListener(INTRO_EVENT, onEnter);
      if (t) clearTimeout(t);
    };
  }, []);

  // 2) Decide whether to greet, once Clerk has resolved (never greet "friend" then flip to a name).
  useEffect(() => {
    if (!armed || !isLoaded || started.current) return;
    const id = isSignedIn && user ? user.id : "guest";
    if (readGreeted().includes(id)) return;
    // A guest who skipped the intro (already seen this session) was welcomed before — stay quiet.
    if (id === "guest" && !introEntered.current) return;
    started.current = true;
    markGreeted(id);
    const n = isSignedIn && user ? (user.firstName ?? user.username ?? "friend") : "friend";
    nameRef.current = n;
    setName(n);
    setVisible(true);
  }, [armed, isLoaded, isSignedIn, user]);

  // 3) The one-shot sequence: type greeting → speak it → features → speak them. One effect,
  //    callback-chained, keyed only on `visible` (same reasoning as the mobile version).
  useEffect(() => {
    if (!visible) return;
    const voice = voiceRef.current;
    if (!voice) return;
    let cancelled = false;
    let stopSpeak: (() => void) | undefined;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const intervals: Array<ReturnType<typeof setInterval>> = [];

    const n = nameRef.current;
    const greetingText = `Welcome, ${n}! 👋\nHi from AstraVeda`;
    const l1 = `Welcome, ${n}! Hi from AstraVeda.`;
    const l2 = `Here's what you can explore. ${FEATURES.map((f) => f.label).join(". ")}.`;
    linesRef.current = { l1, l2 };
    setStage("greeting");
    setTyped("");
    setTypingDone(false);
    prefetchRobotLine(l1); // fetch both lines while the robot walks in → no gap before speech
    prefetchRobotLine(l2);

    const speakLine = (text: string, after: () => void) => {
      if (mutedRef.current || blockedRef.current) {
        timers.push(setTimeout(after, 500));
        return;
      }
      let settled = false; // a cancelled utterance can fire onDone AND the mute button can force-advance
      const finish = () => {
        if (cancelled || settled) return;
        settled = true;
        forceAdvanceRef.current = null;
        setSpeaking(false);
        after();
      };
      forceAdvanceRef.current = finish;
      stopSpeak = voice.speak(text, {
        onStart: () => !cancelled && setSpeaking(true),
        onDone: finish,
        onError: finish,
        onBlocked: () => {
          blockedRef.current = true;
          setBlocked(true);
          finish();
        },
      });
    };

    const startFeatures = () => {
      if (cancelled) return;
      setStage("features");
      speakLine(l2, () => {});
    };
    const afterTyping = () => {
      if (cancelled) return;
      setTypingDone(true);
      speakLine(l1, startFeatures);
    };

    setWalking(!reduceRef.current);
    if (reduceRef.current) {
      setTyped(greetingText);
      afterTyping();
    } else {
      timers.push(setTimeout(() => !cancelled && setWalking(false), WALK_MS));
      timers.push(
        setTimeout(() => {
          const chars = Array.from(greetingText);
          let i = 0;
          const iv = setInterval(() => {
            if (cancelled) return clearInterval(iv);
            i += 1;
            setTyped(chars.slice(0, i).join(""));
            if (i >= chars.length) {
              clearInterval(iv);
              afterTyping();
            }
          }, TYPE_MS);
          intervals.push(iv);
        }, TYPE_START_MS),
      );
    }

    return () => {
      cancelled = true;
      forceAdvanceRef.current = null;
      stopSpeak?.();
      voice.stop();
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [visible]);

  const stopVoice = useCallback(() => {
    voiceRef.current?.stop();
    setSpeaking(false);
  }, []);

  // Speaker button: mute/unmute — or, when the browser blocked autoplay, this click IS the gesture
  // that lets us play the greeting + feature lines now.
  // Speak the welcome + feature lines again (used by "tap to hear" and by un-muting). Each call
  // gets a token; muting/closing bumps it, so a chain that is still running can never continue
  // speaking after a mute (a cancelled browser utterance can still fire its "end" event).
  const playLines = useCallback(() => {
    const voice = voiceRef.current;
    if (!voice) return;
    voice.stop();
    const token = ++replayRef.current;
    const live = () => token === replayRef.current;
    const { l1, l2 } = linesRef.current;
    const say = (text: string, next?: () => void) =>
      voice.speak(text, {
        onStart: () => live() && setSpeaking(true),
        onDone: () => {
          if (!live()) return;
          setSpeaking(false);
          next?.();
        },
        onError: () => live() && setSpeaking(false),
        onBlocked: () => {
          if (!live()) return;
          blockedRef.current = true;
          setBlocked(true);
          setSpeaking(false);
        },
      });
    say(l1, () => say(l2));
  }, []);

  // Speaker button. Blocked autoplay: this click is the gesture that lets audio play. Mute stops
  // everything. Un-mute replays the lines (once the greeting has finished typing — before that the
  // main sequence is still ahead and will speak on its own).
  const handleSpeaker = useCallback(() => {
    if (blockedRef.current) {
      blockedRef.current = false;
      setBlocked(false);
      setMuted(false);
      mutedRef.current = false;
      playLines();
      return;
    }
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
      if (typingDoneRef.current) playLines();
      return;
    }
    mutedRef.current = true;
    setMuted(true);
    replayRef.current += 1; // cancel any replay chain in flight
    stopVoice();
    forceAdvanceRef.current?.();
  }, [playLines, stopVoice]);

  const handleClose = useCallback(() => {
    replayRef.current += 1;
    stopVoice();
    setVisible(false);
  }, [stopVoice]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-[150] flex max-w-[calc(100vw-1.5rem)] items-end gap-1 sm:bottom-6 sm:left-6 sm:gap-2"
      role="alert"
    >
      {/* Robot: walks in from the left, then floats */}
      <motion.div
        className="pointer-events-auto relative w-[92px] shrink-0 sm:w-[124px]"
        initial={reduce ? false : { x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: WALK_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: walking ? [0, -7, 0] : [0, -5, 0] }}
          transition={{ duration: walking ? 0.46 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <RobotAvatar walking={walking} waving={!walking || !!reduce} speaking={speaking} animate={!reduce} className="h-auto w-full" />
        </motion.div>
      </motion.div>

      {/* Speech bubble */}
      <motion.div
        layout={!reduce}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: reduce ? 0 : BUBBLE_DELAY_S,
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
          layout: { duration: 0.35 },
        }}
        className="pointer-events-auto relative mb-6 w-[min(72vw,330px)] origin-bottom-left rounded-[22px] border border-white/80 bg-[#FFFAF2]/95 py-3.5 pl-4 pr-16 shadow-[0_18px_50px_-12px_rgba(143,41,221,.45)] backdrop-blur-xl"
      >
        {/* tail */}
        <span
          aria-hidden
          className="absolute -left-1.5 bottom-6 h-3.5 w-3.5 rotate-45 border-b border-l border-white/80 bg-[#FFFAF2]"
        />

        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSpeaker}
            aria-label={blocked ? "Tap to hear the welcome" : muted ? "Unmute welcome message" : "Mute welcome message"}
            className={`relative flex h-7 items-center justify-center gap-1 rounded-full bg-[#8F29DD]/10 text-[#8F29DD] transition hover:bg-[#8F29DD]/20 ${blocked ? "px-2.5" : "w-7"}`}
          >
            {blocked && (
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#8F29DD]/25" />
            )}
            {muted && !blocked ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {blocked && <span className="relative text-[11px] font-semibold">Tap to hear</span>}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Dismiss welcome message"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8F29DD]/10 text-[#8F29DD] transition hover:bg-[#8F29DD]/20"
          >
            <X size={14} />
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {stage === "greeting" ? (
            <motion.p
              key="greeting"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="min-h-[40px] whitespace-pre-line text-[14px] font-semibold leading-[1.45] text-[#3a1a52]"
            >
              {typed}
              {!typingDone && !reduce && (
                <motion.span
                  aria-hidden
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[#8F29DD]"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                />
              )}
            </motion.p>
          ) : (
            <motion.ul key="features" className="flex flex-col gap-1.5">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.label}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : i * FEATURE_STAGGER_S, type: "spring", damping: 16, stiffness: 240 }}
                >
                  <AuthAwareLink
                    signedOutHref="/sign-in"
                    signedInHref={f.href}
                    className="group flex items-center gap-2.5 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-[#8F29DD]/15 hover:bg-white"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-6"
                      style={{ background: `linear-gradient(135deg, ${f.from}, ${f.to})` }}
                    >
                      <f.Icon size={14} strokeWidth={2.2} />
                    </span>
                    <span className="flex-1 text-[12.5px] font-semibold leading-[1.3] text-[#3a1a52]">{f.label}</span>
                    <ArrowUpRight size={13} className="text-[#8F29DD] opacity-0 transition group-hover:opacity-100" />
                  </AuthAwareLink>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
