"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Sun } from "lucide-react";
import {
  SIGN_STORAGE_KEY,
  fetchHoroscopeDay,
  localHoroscope,
  localHoroscopeDay,
  zodiac,
  type Horoscope,
  type HoroscopeDay,
} from "@/lib/horoscope";
import { listKundalis } from "@/lib/kundali";
import SignStrip from "@/components/horoscope/SignStrip";
import ReadingCard from "@/components/horoscope/ReadingCard";
import SignGrid from "@/components/horoscope/SignGrid";

// Bright, drifting pastel blobs tinted by the chosen sign — never dark.
function Backdrop({ c0, c1 }: { c0: string; c1: string }) {
  const reduced = useReducedMotion();
  const drift = (dx: number, dy: number, d: number) =>
    reduced ? undefined : { x: [0, dx, 0], y: [0, dy, 0], scale: [1, 1.12, 1] };
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#FFFAF2]">
      <motion.div
        className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full blur-[90px]"
        animate={{ backgroundColor: `${c0}55`, ...(drift(60, 40, 0) ?? {}) }}
        transition={{ backgroundColor: { duration: 1 }, x: { duration: 16, repeat: Infinity }, y: { duration: 16, repeat: Infinity }, scale: { duration: 16, repeat: Infinity } }}
      />
      <motion.div
        className="absolute -right-28 top-[18%] h-[480px] w-[480px] rounded-full blur-[100px]"
        animate={{ backgroundColor: `${c1}40`, ...(drift(-50, 60, 0) ?? {}) }}
        transition={{ backgroundColor: { duration: 1 }, x: { duration: 19, repeat: Infinity }, y: { duration: 19, repeat: Infinity }, scale: { duration: 19, repeat: Infinity } }}
      />
      <motion.div
        className="absolute -bottom-32 left-[28%] h-[460px] w-[460px] rounded-full blur-[100px]"
        animate={{ backgroundColor: "#FFD98A55", ...(drift(40, -40, 0) ?? {}) }}
        transition={{ backgroundColor: { duration: 1 }, x: { duration: 22, repeat: Infinity }, y: { duration: 22, repeat: Infinity }, scale: { duration: 22, repeat: Infinity } }}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export default function HoroscopeApp() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  // Null until mounted: local date/time differs between server and browser, so
  // nothing date-dependent is rendered on the server (hydration-safe).
  const [day, setDay] = useState<HoroscopeDay | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kundaliSign, setKundaliSign] = useState<string | null>(null);
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    setDay(localHoroscopeDay());
    try {
      const saved = window.localStorage.getItem(SIGN_STORAGE_KEY);
      if (saved && zodiac(saved)) setOverride(zodiac(saved)!.name);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      const token = isSignedIn ? await getToken() : null;
      const [h, k] = await Promise.allSettled([
        fetchHoroscopeDay(token),
        token ? listKundalis(token) : Promise.reject(new Error("signed out")),
      ]);
      if (cancelled) return;
      if (h.status === "fulfilled") {
        setDay(h.value);
        setLive(true);
      } else {
        setError(h.reason instanceof Error ? h.reason.message : "Could not load today's horoscope");
      }
      if (k.status === "fulfilled") {
        const self = k.value.find((c) => (c.relation ?? "").toLowerCase() === "self" && zodiac(c.moon_sign));
        if (self) setKundaliSign(zodiac(self.moon_sign)!.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const selected = override ?? kundaliSign;
  const sign = zodiac(selected);
  const reading: Horoscope | null = useMemo(() => {
    if (!sign || !day) return null;
    return day.signs.find((s) => s.sign.toLowerCase() === sign.name.toLowerCase()) ?? localHoroscope(sign.name);
  }, [sign, day]);

  const pick = (name: string) => {
    setOverride(name);
    try {
      window.localStorage.setItem(SIGN_STORAGE_KEY, name);
    } catch {
      /* private mode */
    }
  };
  const resetToChart = () => {
    setOverride(null);
    try {
      window.localStorage.removeItem(SIGN_STORAGE_KEY);
    } catch {
      /* private mode */
    }
  };

  const [c0, c1] = sign?.gradient ?? ["#C9A8FF", "#FFB8D2"];
  const any = day?.signs[0];

  return (
    <>
      <Backdrop c0={c0} c1={c1} />
      <main className="mx-auto max-w-[980px] px-4 pb-24 pt-28 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F0B94F]/40 bg-[#FFF3D6] px-3.5 py-1.5 text-[12.5px] font-medium text-[#8a6100]">
            <Sun size={14} /> Free · refreshed every day
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(34px,6vw,54px)] font-medium leading-[1.05] text-[#1B1730]">
            Daily{" "}
            <span
              className="italic bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${c1}, ${c0}, #E9BE6C)` }}
            >
              Horoscope
            </span>
          </h1>
          <p className="mt-2 min-h-[22px] text-[14.5px] text-[#5B5570]">
            {day ? formatDate(day.date) : ""}
            {live && any?.tithi ? ` · ${any.tithi}` : ""}
          </p>
        </motion.header>

        <SignStrip selected={sign?.name ?? null} mine={kundaliSign} onPick={pick} />

        <div className="mt-4">
          {sign && reading ? (
            <ReadingCard sign={sign} reading={reading} />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[32px] border border-[#F0B94F]/30 bg-gradient-to-br from-[#FFF3D6] via-white to-[#FFE3EC] p-10 text-center shadow-[0_20px_50px_rgba(240,185,79,.2)]"
            >
              <motion.div
                className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#FFD75E] to-[#FF8A6B] text-4xl text-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              >
                ☉
              </motion.div>
              <h2 className="font-[family-name:var(--font-display)] text-[28px] text-[#1B1730]">Choose your sign</h2>
              <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-[#5B5570]">
                Tap a sign above to read today&apos;s guidance.
                {isSignedIn
                  ? " Generate a Kundali and we'll open your Moon sign automatically next time."
                  : " Sign in and generate a Kundali, and we'll open your Moon sign automatically."}
              </p>
            </motion.div>
          )}
        </div>

        {override && kundaliSign && override !== kundaliSign && (
          <button
            onClick={resetToChart}
            className="mx-auto mt-4 block text-[13.5px] font-medium text-[#8F29DD] underline-offset-4 hover:underline"
          >
            Use my birth-chart sign ({kundaliSign})
          </button>
        )}

        {error && !live && (
          <p className="mx-auto mt-4 max-w-md text-center text-[12.5px] text-[#8a6100]">
            Couldn&apos;t reach the server — showing general guidance for today.
          </p>
        )}

        <SignGrid selected={sign?.name ?? null} mine={kundaliSign} onPick={pick} />

        <p className="mx-auto mt-10 max-w-xl text-center text-[12.5px] leading-relaxed text-[#8a839a]">
          One reading per sign, written fresh each day from today&apos;s panchang. General guidance for everyone born
          under a sign — not a personal prediction. For a reading built on your own birth time, generate a Kundali.
        </p>
      </main>
    </>
  );
}
