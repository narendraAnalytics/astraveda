// "Today's Cosmic Guidance" — the daily panchang widget on the home screen.
//
// The backend (`GET /cosmic/today`) computes the real thing from sunrise/sunset
// via Swiss Ephemeris. This module also carries a lightweight local version so
// the cards paint instantly and still work offline / before the API responds.
// The weekday → colour / mantra / blessing tables MUST stay in sync with
// `backend/app/services/cosmic.py`.

import { API_URL } from './api';

export type TimeWindow = { label: string; start: string; end: string };

export type CosmicGuidance = {
  date: string;
  weekday: string;
  planet: string;
  location?: { name: string; lat: number; lon: number; tz: string };
  approximate: boolean;
  sunrise: string;
  sunset: string;
  tithi: string;
  nakshatra: string;
  lucky_color: { name: string; tint: string; bg: string };
  mantra: { text: string; deity: string };
  blessing: { title: string; body: string; reveal: string };
  rahu_kalam: TimeWindow;
  gulika_kalam: TimeWindow;
  yamaganda: TimeWindow;
  best_time: TimeWindow;
};

// JS getDay(): Sun=0..Sat=6  →  map to Python weekday(): Mon=0..Sun=6.
const PY_WEEKDAY = [6, 0, 1, 2, 3, 4, 5];
const WEEKDAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RAHU_PART = [2, 7, 5, 6, 4, 3, 8];
const GULIKA_PART = [6, 5, 4, 3, 2, 1, 7];
const YAMA_PART = [4, 3, 2, 1, 7, 6, 5];

const DAY = [
  {
    planet: 'Moon',
    color: { name: 'Moonlit Silver', tint: '#8b93a3', bg: '#eef0f4' },
    mantra: { text: 'Om Namah Shivaya', deity: 'Shiva' },
    blessing: {
      title: 'May Lord Shiva still every restless thought',
      body: 'and hold your mind in a calm, clear light.',
      reveal: 'Move gently today — what is truly yours will keep.',
    },
  },
  {
    planet: 'Mars',
    color: { name: 'Coral Red', tint: '#e0664a', bg: '#fdeae6' },
    mantra: { text: 'Om Hanumate Namah', deity: 'Hanuman' },
    blessing: {
      title: 'May Lord Hanuman lend you his courage',
      body: 'and the strength to carry what the day asks.',
      reveal: 'Face the hard thing first; the rest will soften.',
    },
  },
  {
    planet: 'Mercury',
    color: { name: 'Emerald Green', tint: '#2fa268', bg: '#e7f6ec' },
    mantra: { text: 'Om Gam Ganapataye Namah', deity: 'Ganesha' },
    blessing: {
      title: 'May Lord Ganesha remove all obstacles',
      body: 'and fill your day with wisdom and joy.',
      reveal: 'Pause, breathe, and trust the path opening before you.',
    },
  },
  {
    planet: 'Jupiter',
    color: { name: 'Golden Yellow', tint: '#d9a521', bg: '#fdf3d9' },
    mantra: { text: 'Om Namo Bhagavate Vasudevaya', deity: 'Vishnu' },
    blessing: {
      title: 'May Lord Vishnu keep your path steady',
      body: 'and your choices wise and unhurried.',
      reveal: 'Say yes slowly today; clarity is on its way.',
    },
  },
  {
    planet: 'Venus',
    color: { name: 'Rose Pink', tint: '#db5d8c', bg: '#fdeaf1' },
    mantra: { text: 'Om Shreem Mahalakshmyai Namah', deity: 'Lakshmi' },
    blessing: {
      title: 'May Goddess Lakshmi bless your efforts',
      body: 'with abundance, grace, and warm company.',
      reveal: 'Tend what you already have — it is quietly growing.',
    },
  },
  {
    planet: 'Saturn',
    color: { name: 'Deep Indigo', tint: '#5b5fa8', bg: '#e9e9f5' },
    mantra: { text: 'Om Sham Shanaishcharaya Namah', deity: 'Shani' },
    blessing: {
      title: 'May Lord Shani reward your patience',
      body: 'and turn honest work into lasting ground.',
      reveal: 'Go slow and do it right; time is on your side.',
    },
  },
  {
    planet: 'Sun',
    color: { name: 'Saffron Orange', tint: '#e08a1e', bg: '#fdeeda' },
    mantra: { text: 'Om Suryaya Namah', deity: 'Surya' },
    blessing: {
      title: 'May Lord Surya light your purpose',
      body: 'and give your day energy and confidence.',
      reveal: 'Begin the bold thing now, while the light is with you.',
    },
  },
];

function fmt(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function partWindow(part: number, label: string): TimeWindow {
  // Local fallback assumes a 6:00 AM sunrise / 6:00 PM sunset day.
  const SUNRISE = 6 * 60;
  const SEG = (12 * 60) / 8;
  const start = SUNRISE + SEG * (part - 1);
  return { label, start: fmt(start), end: fmt(start + SEG) };
}

/** Instant, network-free guidance for `date` (today by default). */
export function localCosmicGuidance(date = new Date()): CosmicGuidance {
  const wd = PY_WEEKDAY[date.getDay()];
  const meta = DAY[wd];
  const muhurta = (12 * 60) / 15;
  const abhijitStart = 6 * 60 + muhurta * 7;
  return {
    date: date.toISOString().slice(0, 10),
    weekday: WEEKDAY_NAME[wd],
    planet: meta.planet,
    approximate: true,
    sunrise: '6:00 AM',
    sunset: '6:00 PM',
    tithi: '',
    nakshatra: '',
    lucky_color: meta.color,
    mantra: meta.mantra,
    blessing: meta.blessing,
    rahu_kalam: partWindow(RAHU_PART[wd], 'Rahu Kalam'),
    gulika_kalam: partWindow(GULIKA_PART[wd], 'Gulika Kalam'),
    yamaganda: partWindow(YAMA_PART[wd], 'Yamaganda'),
    best_time: { label: 'Abhijit Muhurat', start: fmt(abhijitStart), end: fmt(abhijitStart + muhurta) },
  };
}

/** Real guidance from the backend. Throws if `EXPO_PUBLIC_API_URL` is unset. */
export async function fetchCosmicGuidance(loc?: {
  lat: number;
  lon: number;
  tz?: string;
}): Promise<CosmicGuidance> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');
  const qs = loc
    ? `?lat=${loc.lat}&lon=${loc.lon}${loc.tz ? `&tz=${encodeURIComponent(loc.tz)}` : ''}`
    : '';
  const res = await fetch(`${API_URL}/cosmic/today${qs}`);
  if (!res.ok) throw new Error(`cosmic/today ${res.status}`);
  return (await res.json()) as CosmicGuidance;
}
