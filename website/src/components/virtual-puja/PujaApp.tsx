"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import {
  Apple,
  ArrowLeft,
  Bell,
  Flame,
  Flower2,
  Music,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  DEFAULT_TEMPLE_ID,
  INCENSE,
  LAMPS,
  STORAGE,
  VIRTUAL_TEMPLES,
  deityImage,
  getTemple,
  sceneUnit,
  sleep,
} from "@/lib/virtual-puja";
import { pujaAudio } from "@/lib/puja-audio";
import { makeFxShared, type FxShared } from "./PujaFX";
import PetalBurst, { makePetals, type PetalSpec } from "./Petals";
import TempleSheet from "./TempleSheet";
import Naivedya, { NAIVEDYA_CHIME_MS, NAIVEDYA_ITEMS, NAIVEDYA_MERGE_MS, NAIVEDYA_PLATE } from "./Naivedya";

// The WebGL layer is browser-only and heavy — load it after first paint.
const PujaFX = dynamic(() => import("./PujaFX"), { ssr: false });

// If WebGL is unavailable the shrine still works (DOM diyas, sounds, petals).
class FxBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const GOLD = "#F4D28A";

// Soft fade on every edge of the deity photo so it dissolves into the backdrop.
const FEATHER =
  "linear-gradient(to right, transparent 0, #000 16%, #000 84%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 8%, #000 86%, transparent 100%)";

const readPref = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writePref = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

// ── Scene art ───────────────────────────────────────────────────────────────

function DiyaBowl() {
  return (
    <svg viewBox="0 0 64 34" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="dy-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9a35a" />
          <stop offset="0.55" stopColor="#b8642b" />
          <stop offset="1" stopColor="#6d3413" />
        </linearGradient>
        <radialGradient id="dy-oil" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#d98a2b" />
        </radialGradient>
      </defs>
      <path d="M2 6 Q32 -2 62 6 Q58 32 32 33 Q6 32 2 6Z" fill="url(#dy-clay)" />
      <ellipse cx="32" cy="6.2" rx="29.5" ry="4.6" fill="url(#dy-oil)" />
      <path d="M6 12 Q32 20 58 12" stroke="rgba(255,225,160,.55)" strokeWidth="1.1" fill="none" />
      <rect x="30.4" y="1.5" width="3.2" height="6" rx="1.4" fill="#2b1608" />
    </svg>
  );
}

function ThaliPlate() {
  return (
    <svg viewBox="0 0 132 64" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="th-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#d9a233" />
          <stop offset="1" stopColor="#8f6316" />
        </linearGradient>
      </defs>
      <ellipse cx="66" cy="42" rx="63" ry="20" fill="#5b3a0a" opacity="0.5" />
      <ellipse cx="66" cy="38" rx="62" ry="20" fill="url(#th-gold)" />
      <ellipse cx="66" cy="38" rx="50" ry="14.5" fill="none" stroke="rgba(120,75,10,.55)" strokeWidth="1.5" />
      <ellipse cx="66" cy="37" rx="42" ry="11" fill="#e2b34a" opacity="0.6" />
      {[40, 66, 92].map((x, i) => (
        <g key={x} transform={`translate(${x - 14} ${i === 1 ? 24 : 26})`}>
          <path d="M0 4 Q14 -1 28 4 Q26 16 14 17 Q2 16 0 4Z" fill="#b8642b" />
          <ellipse cx="14" cy="4" rx="13" ry="2.6" fill="#ffd27a" />
        </g>
      ))}
      {[[28, 40], [104, 40], [66, 50], [50, 47], [82, 47]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill={i % 2 ? "#ff8a1f" : "#e63b2e"} />
      ))}
    </svg>
  );
}

function BellArt() {
  return (
    <svg viewBox="0 0 64 96" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="bl-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f5d12" />
          <stop offset="0.35" stopColor="#ffe08a" />
          <stop offset="0.7" stopColor="#d59a26" />
          <stop offset="1" stopColor="#7a4c0d" />
        </linearGradient>
      </defs>
      <rect x="31" y="0" width="2" height="24" fill="#c9a34a" />
      <circle cx="32" cy="26" r="5" fill="#b98420" />
      <path d="M32 28 C12 32 10 56 4 74 L60 74 C54 56 52 32 32 28Z" fill="url(#bl-body)" />
      <rect x="2" y="72" width="60" height="7" rx="3.5" fill="#a87415" />
      <path d="M14 46 Q32 52 50 46" stroke="rgba(90,55,5,.45)" strokeWidth="1.5" fill="none" />
      <path d="M12 58 Q32 65 52 58" stroke="rgba(90,55,5,.45)" strokeWidth="1.5" fill="none" />
      <circle cx="32" cy="84" r="5.5" fill="#8a5c10" />
    </svg>
  );
}

function IncenseStand() {
  return (
    <svg viewBox="0 0 40 60" className="h-full w-full overflow-visible">
      <rect x="19" y="4" width="2" height="34" rx="1" fill="#6b3d1c" />
      <circle cx="20" cy="4" r="2.4" fill="#ff6a1a" />
      <circle cx="20" cy="4" r="4.5" fill="#ff6a1a" opacity="0.25" />
      <path d="M6 44 Q20 36 34 44 L31 56 Q20 60 9 56Z" fill="#c69026" />
      <ellipse cx="20" cy="44" rx="14" ry="3.6" fill="#f0c860" />
    </svg>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

const ACTIONS = [
  { id: "bell", label: "Bell", Icon: Bell },
  { id: "shankh", label: "Shankh", Icon: Waves },
  { id: "flowers", label: "Flowers", Icon: Flower2 },
  { id: "dhoop", label: "Dhoop", Icon: Wind },
  { id: "aarti", label: "Aarti", Icon: Flame },
  { id: "naivedya", label: "Naivedya", Icon: Apple },
] as const;
type ActionId = (typeof ACTIONS)[number]["id"];

export default function PujaApp() {
  const reduced = !!useReducedMotion();
  const [templeId, setTempleId] = useState(DEFAULT_TEMPLE_ID);
  const temple = getTemple(templeId);
  const [entered, setEntered] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ambientOn, setAmbientOn] = useState(true);
  const [aarti, setAarti] = useState(false);
  const [dhoop, setDhoop] = useState(false);
  const [naivedya, setNaivedya] = useState(false);
  const [bellTick, setBellTick] = useState(0);
  const [ripples, setRipples] = useState<number[]>([]);
  const [bursts, setBursts] = useState<{ id: number; petals: PetalSpec[] }[]>([]);
  const [auto, setAuto] = useState<{ label: string; step: number; ms: number } | null>(null);

  const fx = useRef<FxShared>(makeFxShared());
  const stageRef = useRef<HTMLDivElement>(null);
  const thaliRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const aartiRef = useRef(false);
  const dhoopRef = useRef(false);
  const naivedyaRef = useRef(false);
  const stopAartiRef = useRef<(() => void) | null>(null);
  const autoRef = useRef<object | null>(null);
  const burstId = useRef(0);

  // Natural aspect of each deity photo so the whole image is shown, never cropped.
  const [aspects, setAspects] = useState<Record<string, number>>({});
  useEffect(() => {
    VIRTUAL_TEMPLES.forEach((t) => {
      const img = new Image();
      img.onload = () => setAspects((a) => ({ ...a, [t.id]: img.naturalWidth / img.naturalHeight }));
      img.src = deityImage(t, 900);
    });
  }, []);

  // Preload offering art so the items drop in without a pop-in delay.
  useEffect(() => {
    [...NAIVEDYA_ITEMS.map((i) => i.src), NAIVEDYA_PLATE].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Restore saved prefs.
  useEffect(() => {
    const t = readPref(STORAGE.temple);
    if (t) setTempleId(getTemple(t).id);
    const m = readPref(STORAGE.muted) === "1";
    setMuted(m);
    pujaAudio.setMuted(m);
    if (readPref(STORAGE.ambient) === "0") setAmbientOn(false);
  }, []);

  // Track stage size for the aarti thali path.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      dimsRef.current = { w: el.clientWidth, h: el.clientHeight };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ambience follows temple + toggle (only after the entry gesture).
  useEffect(() => {
    if (!entered) return;
    if (ambientOn) pujaAudio.startAmbient(temple.tradition);
    else pujaAudio.stopAmbient();
  }, [entered, ambientOn, temple.tradition]);

  useEffect(
    () => () => {
      pujaAudio.stopAmbient();
      stopAartiRef.current?.();
      autoRef.current = null;
    },
    [],
  );

  // Aarti thali swings on a figure-8; its flames follow via the shared ref.
  useAnimationFrame((time) => {
    const { w, h } = dimsRef.current;
    const el = thaliRef.current;
    if (!el || !w) return;
    const u = sceneUnit(w, h);
    const th = reduced ? 0 : time / 1000;
    const x = w / 2 + Math.sin(th * 1.15) * 0.36 * u;
    const y = h * 0.58 + Math.sin(th * 2.3) * 0.085 * u;
    const plate = Math.max(96, Math.min(150, u * 0.42));
    const scale = plate / 132;
    el.style.transform = `translate(${x - plate / 2}px, ${y}px) scale(${scale})`;
    fx.current.thali.wx = x - w / 2;
    fx.current.thali.wy = h / 2 - (y + 24 * scale);
  });

  // ── Ritual actions ────────────────────────────────────────────────────────

  const ringBell = useCallback(() => {
    pujaAudio.bell();
    setBellTick((n) => n + 1);
    fx.current.boost = 1;
  }, []);

  const blowShankh = useCallback(() => {
    pujaAudio.conch();
    const id = ++burstId.current;
    setRipples((r) => [...r, id]);
    window.setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 3600);
    fx.current.boost = 1;
  }, []);

  const throwFlowers = useCallback(() => {
    pujaAudio.chime();
    const id = ++burstId.current;
    const petals = makePetals(reduced ? 18 : 64);
    setBursts((b) => [...b, { id, petals }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 13000);
    fx.current.boost = Math.max(fx.current.boost, 0.5);
  }, [reduced]);

  const setDhoopOn = useCallback((next: boolean) => {
    if (dhoopRef.current === next) return;
    dhoopRef.current = next;
    setDhoop(next);
    fx.current.smokeTarget = next ? 1 : 0;
    if (next) pujaAudio.chime();
  }, []);

  const setAartiOn = useCallback((next: boolean) => {
    if (aartiRef.current === next) return;
    aartiRef.current = next;
    setAarti(next);
    fx.current.thaliTarget = next ? 1 : 0;
    if (next) {
      stopAartiRef.current = pujaAudio.startAarti();
      pujaAudio.duck(true);
    } else {
      stopAartiRef.current?.();
      stopAartiRef.current = null;
      pujaAudio.duck(false);
    }
  }, []);

  const setNaivedyaOn = useCallback((next: boolean) => {
    if (naivedyaRef.current === next) return;
    naivedyaRef.current = next;
    setNaivedya(next);
    // A soft chime as each offering lands, matching the staggered entrance.
    if (next) {
      NAIVEDYA_CHIME_MS.forEach((ms) => window.setTimeout(pujaAudio.chime, ms));
      window.setTimeout(pujaAudio.bell, NAIVEDYA_MERGE_MS);
    }
  }, []);

  const cancelAuto = useCallback(() => {
    autoRef.current = null;
    setAuto(null);
  }, []);

  const runAuto = useCallback(async () => {
    const token = {};
    autoRef.current = token;
    const steps: { label: string; run: () => void; wait: number }[] = [
      { label: "Shankh — invoking the divine", run: blowShankh, wait: 3800 },
      { label: "Ringing the temple bell", run: ringBell, wait: 2800 },
      { label: "Offering flowers", run: throwFlowers, wait: 2400 },
      { label: "Lighting the dhoop", run: () => setDhoopOn(true), wait: 2400 },
      { label: "Aarti — waving the lamp", run: () => setAartiOn(true), wait: 8000 },
      { label: "Naivedya — food offering", run: () => setNaivedyaOn(true), wait: 2600 },
      { label: "Pushpanjali — a shower of blessings", run: throwFlowers, wait: 3200 },
      { label: "Blessings received. Om Shanti.", run: () => setAartiOn(false), wait: 2400 },
    ];
    for (let i = 0; i < steps.length; i++) {
      if (autoRef.current !== token) return;
      setAuto({ label: steps[i].label, step: i, ms: steps[i].wait });
      steps[i].run();
      await sleep(steps[i].wait);
    }
    if (autoRef.current === token) cancelAuto();
  }, [blowShankh, ringBell, throwFlowers, setDhoopOn, setAartiOn, setNaivedyaOn, cancelAuto]);

  const onAction = (id: ActionId) => {
    pujaAudio.unlock();
    if (id === "bell") ringBell();
    else if (id === "shankh") blowShankh();
    else if (id === "flowers") throwFlowers();
    else if (id === "dhoop") setDhoopOn(!dhoopRef.current);
    else if (id === "aarti") setAartiOn(!aartiRef.current);
    else setNaivedyaOn(!naivedyaRef.current);
  };
  const isOn = (id: ActionId) =>
    id === "dhoop" ? dhoop : id === "aarti" ? aarti : id === "naivedya" ? naivedya : false;

  const begin = () => {
    pujaAudio.unlock();
    pujaAudio.setMuted(muted);
    setEntered(true);
    window.setTimeout(() => {
      pujaAudio.conch();
      fx.current.boost = 1;
    }, 500);
  };

  const pickTemple = (id: string) => {
    setSheet(false);
    if (id === templeId) return;
    pujaAudio.unlock();
    setTempleId(id);
    writePref(STORAGE.temple, id);
    pujaAudio.chime();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    pujaAudio.setMuted(next);
    writePref(STORAGE.muted, next ? "1" : "0");
  };
  const toggleAmbient = () => {
    const next = !ambientOn;
    setAmbientOn(next);
    writePref(STORAGE.ambient, next ? "1" : "0");
  };

  // Mouse parallax.
  const mx = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const my = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const archX = useParallax(mx, 14);
  const archY = useParallax(my, 8);
  const bgX = useParallax(mx, -22);
  const bgY = useParallax(my, -14);
  const onMove = (e: React.PointerEvent) => {
    if (reduced) return;
    mx.set((e.clientX / window.innerWidth - 0.5) * 2);
    my.set((e.clientY / window.innerHeight - 0.5) * 2);
  };

  const glow = temple.glow;
  const asp = aspects[temple.id] ?? 1;
  const world = {
    "--u": "min(42cqw, 40cqh)",
    "--b": "clamp(30px, calc(var(--u) * .2), 58px)",
    // Deity photo box: natural aspect (uncropped), up to 74% of the height; may run a
    // little past the screen sides on tall phones (its edges are feathered away).
    "--asp": asp,
    "--ih": "min(74cqh, calc(125cqw / var(--asp)))",
    "--iw": "calc(var(--ih) * var(--asp))",
  } as CSSProperties;

  return (
    <div
      ref={stageRef}
      onPointerMove={onMove}
      className="fixed inset-0 overflow-hidden bg-[#07040d] text-white select-none [container-type:size]"
    >
      {/* Ambient backdrop: blurred deity art + scene gradient */}
      <AnimatePresence>
        <motion.div
          key={`bg-${temple.id}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          style={{ x: bgX, y: bgY }}
        >
          <div
            className="absolute -inset-10"
            style={{
              background: `radial-gradient(120% 90% at 50% 30%, ${temple.colors[2]}55, ${temple.colors[1]} 45%, ${temple.colors[0]} 100%)`,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={deityImage(temple, 500)}
            alt=""
            aria-hidden
            className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] object-cover opacity-70 blur-[26px] saturate-125 scale-110"
          />
        </motion.div>
      </AnimatePresence>

      {/* Vignette keeps the UI readable over the brighter backdrop */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 35%, rgba(5,2,10,.62) 100%)" }}
      />

      {/* Slow rotating light rays */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[34%] h-[190cqmax] w-[190cqmax] -translate-x-1/2 -translate-y-1/2 opacity-[.16]"
        style={{
          background: `repeating-conic-gradient(from 0deg, rgba(${glow},.9) 0deg 4deg, transparent 4deg 18deg)`,
          maskImage: "radial-gradient(circle, black 0%, transparent 55%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 55%)",
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
      />

      <div className="absolute inset-0" style={world}>
        {/* Halo */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full blur-2xl"
          style={{
            top: "6%",
            width: "calc(var(--iw) * .9)",
            height: "var(--ih)",
            background: `radial-gradient(circle, rgba(${glow},.5), rgba(${glow},.1) 55%, transparent 72%)`,
          }}
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.75], scale: [1, 1.05, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Deity — the whole photo, uncropped, melting into the backdrop (no frame, no border) */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "6%" }}>
          <motion.div
            style={{ x: archX, y: archY, width: "var(--iw)", height: "var(--ih)" }}
            className="relative"
          >
            <div
              className="absolute inset-0"
              style={{
                maskImage: FEATHER,
                WebkitMaskImage: FEATHER,
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            >
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={temple.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                >
                  <motion.div
                    className="h-full w-full"
                    animate={reduced ? undefined : { scale: [1, 1.05, 1.015, 1] }}
                    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={deityImage(temple, 900)}
                      alt={temple.deity}
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>
              {/* Lamp-light warmth washing up the deity */}
              <motion.div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(90% 50% at 50% 100%, rgba(255,150,50,.38), transparent 70%)",
                }}
                animate={reduced ? undefined : { opacity: [0.75, 1, 0.82, 1, 0.78] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>

        {/* Diya bowls (flames are drawn by the WebGL layer above) */}
        {LAMPS.map((l, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `calc(50% + var(--u) * ${l.k})`,
              top: `${l.y * 100}%`,
              width: `calc(var(--b) * ${l.s})`,
              height: `calc(var(--b) * ${l.s} * .53)`,
              transform: "translate(-50%, -3%)",
            }}
          >
            <DiyaBowl />
          </div>
        ))}

        {/* Incense stand */}
        <div
          className="absolute"
          style={{
            left: `calc(50% + var(--u) * ${INCENSE.k})`,
            top: `${INCENSE.y * 100}%`,
            width: "calc(var(--b) * .6)",
            height: "calc(var(--b) * .9)",
            transform: "translate(-50%, -8%)",
          }}
        >
          <IncenseStand />
        </div>

        {/* Naivedya — offerings drop in one by one, glide together, then bloom into one plate */}
        <div
          className="absolute left-1/2 pointer-events-none"
          style={{
            top: "calc(6% + var(--ih) * .97)",
            transform: "translate(-50%, -100%)",
          }}
        >
          <AnimatePresence>
            {naivedya && (
              <motion.div key="naivedya" exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.4 }}>
                <Naivedya />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Aarti thali (its flames are WebGL) */}
        <div
          ref={thaliRef}
          className={`absolute left-0 top-0 origin-top-left transition-opacity duration-700 ${aarti ? "opacity-100" : "opacity-0"}`}
          style={{ width: 132, height: 64 }}
        >
          <ThaliPlate />
        </div>

        {/* Mantra caption */}
        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+100px)] px-4 text-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={temple.id}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="font-[family-name:var(--font-display)] text-[clamp(18px,3.2cqmin,30px)] tracking-wide"
              style={{ color: GOLD, textShadow: `0 0 18px rgba(${glow},.9), 0 0 42px rgba(${glow},.5)` }}
            >
              {temple.mantra}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bell */}
      <button
        onClick={() => {
          pujaAudio.unlock();
          ringBell();
        }}
        aria-label="Ring the temple bell"
        className="absolute right-[4%] top-[8%] z-20 h-[clamp(64px,11cqh,104px)] outline-none"
        style={{ aspectRatio: "64 / 96" }}
      >
        <motion.div
          key={bellTick}
          className="h-full w-full"
          style={{ transformOrigin: "50% 0%" }}
          initial={{ rotate: 0 }}
          animate={{ rotate: bellTick ? [0, 16, -13, 9, -6, 3, 0] : 0 }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
        >
          <BellArt />
        </motion.div>
      </button>

      {/* GPU flames, embers, smoke */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <FxBoundary>
          <PujaFX shared={fx} reduced={reduced} />
        </FxBoundary>
      </div>

      {/* Shankh shock-rings */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.div key={id}>
              {[0, 0.35, 0.7].map((d) => (
                <motion.span
                  key={d}
                  className="absolute left-1/2 top-[38%] block h-40 w-40 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{ border: `2px solid rgba(${glow},.8)` }}
                  initial={{ scale: 0.2, opacity: 0.8 }}
                  animate={{ scale: 9, opacity: 0 }}
                  transition={{ duration: 3, delay: d, ease: "easeOut" }}
                />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Petals */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {bursts.map((b) => (
          <PetalBurst key={b.id} petals={b.petals} />
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-7 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[13px] text-white/85 backdrop-blur hover:bg-white/20"
        >
          <ArrowLeft size={15} /> <span className="hidden sm:inline">AstraVeda</span>
        </a>
        <button
          onClick={() => setSheet(true)}
          className="min-w-0 max-w-[58vw] rounded-full border border-white/15 bg-white/10 px-4 py-2 text-center backdrop-blur hover:bg-white/15"
        >
          <span className="block truncate text-[13px] font-semibold" style={{ color: GOLD }}>
            {temple.deity}
          </span>
          <span className="block truncate text-[10.5px] text-white/55">{temple.place} · change</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={toggleAmbient}
            aria-pressed={ambientOn}
            aria-label="Toggle devotional ambience"
            className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur ${ambientOn ? "bg-[#F4D28A]/25 text-[#F4D28A]" : "bg-white/10 text-white/55"}`}
          >
            <Music size={16} />
          </button>
          <button
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/85 backdrop-blur hover:bg-white/20"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Auto-puja progress */}
      <AnimatePresence>
        {auto && (
          <motion.div
            key="auto"
            className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-30 mx-auto max-w-md rounded-2xl border border-white/10 bg-black/55 p-3.5 backdrop-blur-md"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px]" style={{ color: GOLD }}>
                <Sparkles size={15} /> {auto.label}
              </div>
              <button onClick={cancelAuto} aria-label="Stop auto puja" className="text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                key={auto.step}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#ffb020,#ff7a1a)" }}
                initial={{ width: `${(auto.step / 8) * 100}%` }}
                animate={{ width: `${((auto.step + 1) / 8) * 100}%` }}
                transition={{ duration: auto.ms / 1000, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-3xl border border-white/10 bg-black/45 p-2 backdrop-blur-xl [scrollbar-width:none]">
          {ACTIONS.map(({ id, label, Icon }) => {
            const on = isOn(id);
            return (
              <motion.button
                key={id}
                onClick={() => onAction(id)}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -2 }}
                aria-pressed={on}
                className={`relative flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10.5px] transition-colors ${
                  on ? "text-[#3a1f00]" : "text-white/80 hover:bg-white/10"
                }`}
                style={on ? { background: "linear-gradient(135deg,#ffe08a,#ffb020)", boxShadow: "0 0 18px rgba(255,176,32,.55)" } : undefined}
              >
                <Icon size={19} />
                {label}
              </motion.button>
            );
          })}
          <div className="mx-1 h-9 w-px bg-white/15" />
          <motion.button
            onClick={() => {
              pujaAudio.unlock();
              if (auto) cancelAuto();
              else void runAuto();
            }}
            whileTap={{ scale: 0.95 }}
            className="relative shrink-0 rounded-2xl px-4 py-2.5 text-[12px] font-semibold text-white"
            style={{
              background: "linear-gradient(135deg,#a72be6,#8f29dd 55%,#6d1fbd)",
              boxShadow: "0 0 22px rgba(167,43,230,.55)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} /> {auto ? "Stop" : "Auto Puja"}
            </span>
            {!auto && !reduced && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-2xl border border-[#d18bff]"
                animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.12, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
            )}
          </motion.button>
        </div>
      </div>

      <TempleSheet open={sheet} activeId={temple.id} onClose={() => setSheet(false)} onPick={pickTemple} />

      {/* Entry gate — also the user gesture that unlocks audio */}
      <AnimatePresence>
        {!entered && (
          <motion.div
            key="gate"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
            style={{ background: "radial-gradient(120% 90% at 50% 40%, #2a1240, #0a0612 70%)" }}
            exit={{ opacity: 0, scale: 1.12, filter: "blur(10px)" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          >
            <motion.div
              className="grid h-24 w-24 place-items-center rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,176,32,.35), transparent 70%)" }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Flame size={46} style={{ color: "#ffb020", filter: "drop-shadow(0 0 14px #ff8a1f)" }} />
            </motion.div>
            <h1
              className="mt-6 font-[family-name:var(--font-display)] text-[clamp(34px,7vw,58px)] leading-none"
              style={{ color: GOLD }}
            >
              Virtual Puja
            </h1>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/65">
              Light the lamps, ring the bell, offer flowers and perform aarti — from wherever you are. Sound on for
              the full experience.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {VIRTUAL_TEMPLES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTemple(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                    t.id === temple.id ? "text-[#3a1f00]" : "border-white/15 text-white/70 hover:bg-white/10"
                  }`}
                  style={
                    t.id === temple.id
                      ? { background: "linear-gradient(135deg,#ffe08a,#ffb020)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {t.deity}
                </button>
              ))}
            </div>
            <motion.button
              onClick={begin}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="mt-8 rounded-full px-9 py-3.5 text-[15px] font-semibold text-[#3a1f00]"
              style={{
                background: "linear-gradient(135deg,#ffe9a8,#ffb020 60%,#ff8a1f)",
                boxShadow: "0 10px 40px rgba(255,150,30,.45)",
              }}
            >
              Begin Puja
            </motion.button>
            <a href="/" className="mt-5 text-[12.5px] text-white/45 hover:text-white/75">
              ← Back to AstraVeda
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Small helper: scale a spring motion value (−1…1) into a pixel offset.
function useParallax(v: ReturnType<typeof useSpring>, px: number) {
  const out = useMotionValue(0);
  useEffect(() => v.on("change", (n) => out.set(n * px)), [v, px, out]);
  return out;
}
