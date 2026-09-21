// Daily Horoscope — free and PUBLIC on the website (login-required on mobile). Port of
// the mobile app's `frontend/src/lib/horoscope.ts`. The backend (`GET /horoscope/today`,
// public twin of the login-protected `/horoscope/all`) writes all
// 12 signs once a day via Sarvam and caches them; the page just renders what it
// returns. A network-free `localHoroscopeDay()` keeps the page populated before
// the API answers / when it's unreachable.

import { api } from "./api";

export type Horoscope = {
  sign: string;
  date: string;
  element: string;
  ruler: string;
  guidance: string;
  lucky_color: string;
  lucky_number: string;
  mood: string;
  best_time: string;
  tithi: string;
  nakshatra: string;
  source: "ai" | "fallback" | string;
};

export type HoroscopeDay = { date: string; signs: Horoscope[] };

export type Element = "Fire" | "Earth" | "Air" | "Water";

export type ZodiacSign = {
  name: string;
  glyph: string;
  element: Element;
  ruler: string;
  dates: string;
  gradient: readonly [string, string];
};

// Standard order — matches the backend `SIGNS` list and the Kundali engine's
// `moon_sign` values, so a saved Self chart maps straight onto this.
export const ZODIAC: ZodiacSign[] = [
  { name: "Aries", glyph: "♈", element: "Fire", ruler: "Mars", dates: "Mar 21 – Apr 19", gradient: ["#ff8a6b", "#e0503a"] },
  { name: "Taurus", glyph: "♉", element: "Earth", ruler: "Venus", dates: "Apr 20 – May 20", gradient: ["#7bc47f", "#3d8a53"] },
  { name: "Gemini", glyph: "♊", element: "Air", ruler: "Mercury", dates: "May 21 – Jun 20", gradient: ["#ffd66b", "#e0a63a"] },
  { name: "Cancer", glyph: "♋", element: "Water", ruler: "Moon", dates: "Jun 21 – Jul 22", gradient: ["#8fd3e8", "#4a97b8"] },
  { name: "Leo", glyph: "♌", element: "Fire", ruler: "Sun", dates: "Jul 23 – Aug 22", gradient: ["#ffb85c", "#e0872a"] },
  { name: "Virgo", glyph: "♍", element: "Earth", ruler: "Mercury", dates: "Aug 23 – Sep 22", gradient: ["#a3c98f", "#6b9a53"] },
  { name: "Libra", glyph: "♎", element: "Air", ruler: "Venus", dates: "Sep 23 – Oct 22", gradient: ["#f2a6c2", "#d16d97"] },
  { name: "Scorpio", glyph: "♏", element: "Water", ruler: "Mars", dates: "Oct 23 – Nov 21", gradient: ["#9a6bd0", "#5e2e8f"] },
  { name: "Sagittarius", glyph: "♐", element: "Fire", ruler: "Jupiter", dates: "Nov 22 – Dec 21", gradient: ["#f0a25c", "#d97b2a"] },
  { name: "Capricorn", glyph: "♑", element: "Earth", ruler: "Saturn", dates: "Dec 22 – Jan 19", gradient: ["#6f8bb0", "#3f5678"] },
  { name: "Aquarius", glyph: "♒", element: "Air", ruler: "Saturn", dates: "Jan 20 – Feb 18", gradient: ["#6bc6e8", "#3a8fc4"] },
  { name: "Pisces", glyph: "♓", element: "Water", ruler: "Jupiter", dates: "Feb 19 – Mar 20", gradient: ["#7fd0b8", "#3f9a7e"] },
];

export const SIGN_NAMES = ZODIAC.map((z) => z.name);

export function zodiac(name: string | null | undefined): ZodiacSign | null {
  if (!name) return null;
  return ZODIAC.find((z) => z.name.toLowerCase() === name.toLowerCase()) ?? null;
}

const ELEMENT_ACCENT: Record<string, string> = {
  Fire: "#e0653a",
  Earth: "#5c8a4a",
  Air: "#d69a2a",
  Water: "#3f8fb8",
};

export function elementAccent(element: string): string {
  return ELEMENT_ACCENT[element] ?? "#8a6bd0";
}

/** Instant, network-free reading — mirrors the backend fallback tone. */
export function localHoroscope(name: string): Horoscope {
  const z = zodiac(name) ?? ZODIAC[0];
  return {
    sign: z.name,
    date: new Date().toISOString().slice(0, 10),
    element: z.element,
    ruler: z.ruler,
    guidance:
      `${z.ruler}'s influence over ${z.name} favours a measured pace today. ` +
      `Tend to what is already in motion before starting anything new, and let a ` +
      `small act of patience settle something that has felt unsettled.`,
    lucky_color:
      z.element === "Fire" ? "Saffron" : z.element === "Water" ? "Sea Green" : z.element === "Air" ? "Sky Blue" : "Forest Green",
    lucky_number: "",
    mood: "Steady",
    best_time: "Abhijit Muhurat (around midday)",
    tithi: "",
    nakshatra: "",
    source: "fallback",
  };
}

export function localHoroscopeDay(): HoroscopeDay {
  return { date: new Date().toISOString().slice(0, 10), signs: SIGN_NAMES.map(localHoroscope) };
}

// Public endpoint first (works signed-out). If it isn't deployed yet, a signed-in
// user still gets the reading through the original login-protected route.
export async function fetchHoroscopeDay(token: string | null): Promise<HoroscopeDay> {
  try {
    return await api<HoroscopeDay>("/horoscope/today");
  } catch (e) {
    if (!token) throw e;
    return api<HoroscopeDay>("/horoscope/all", { token });
  }
}

// Lucky-colour name → a real swatch. The AI writes free text ("Sea Green",
// "Deep Saffron"), so match on known words and fall back to the sign's accent.
const COLOR_WORDS: [string, string][] = [
  ["saffron", "#F4801A"], ["orange", "#FF8A1F"], ["yellow", "#F7C948"], ["gold", "#E0B04A"],
  ["red", "#E5484D"], ["maroon", "#8B1E3F"], ["pink", "#F27BA6"], ["rose", "#F27BA6"], ["magenta", "#D6336C"],
  ["purple", "#8F29DD"], ["violet", "#7C3AED"], ["indigo", "#4F46E5"], ["lavender", "#B79CFF"],
  ["sky", "#5BB8F0"], ["blue", "#3A8FC4"], ["turquoise", "#2FC4B8"], ["teal", "#1E9E94"], ["cyan", "#3BC6E0"],
  ["sea green", "#3FBF8F"], ["emerald", "#22A06B"], ["forest", "#3D8A53"], ["green", "#4CAF6A"],
  ["cream", "#F7EBD0"], ["ivory", "#F5ECD7"], ["white", "#F4F1EA"], ["silver", "#B9C0C8"],
  ["grey", "#9AA3AD"], ["gray", "#9AA3AD"], ["brown", "#8B5E3C"], ["peach", "#FFB999"], ["coral", "#FF7F6B"],
  ["black", "#2A2530"],
];

export function colorSwatch(name: string, fallback: string): string {
  const n = name.toLowerCase();
  for (const [word, hex] of COLOR_WORDS) if (n.includes(word)) return hex;
  return fallback;
}

// Vedic numerology: each graha owns a number (Sun 1 … Ketu 7 … Mars 9). Used when
// the reading arrives without a lucky number (offline fallback / AI left it blank):
// the sign ruler's number, plus a daily companion so it changes each day.
const GRAHA_NUMBER: Record<string, number> = {
  Sun: 1, Moon: 2, Jupiter: 3, Rahu: 4, Mercury: 5, Venus: 6, Ketu: 7, Saturn: 8, Mars: 9,
};

export function luckyNumberFor(signName: string, isoDate: string): string {
  const z = zodiac(signName) ?? ZODIAC[0];
  const primary = GRAHA_NUMBER[z.ruler] ?? 1;
  // Digit-sum of the date (e.g. 2026-09-21 → 2+0+2+6+0+9+2+1 = 22 → 4) keeps it stable all day.
  let sum = isoDate.replace(/\D/g, "").split("").reduce((a, d) => a + Number(d), 0);
  while (sum > 9) sum = String(sum).split("").reduce((a, d) => a + Number(d), 0);
  let second = ((sum + ZODIAC.indexOf(z)) % 9) + 1;
  if (second === primary) second = (second % 9) + 1;
  return `${primary} & ${second}`;
}

export const SIGN_STORAGE_KEY = "astraveda.web.horoscopeSign";
