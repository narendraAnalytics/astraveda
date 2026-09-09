// Daily Horoscope — login-required, free. The backend (`GET /horoscope/all`)
// writes all 12 signs once a day via Sarvam and caches them; the app just
// renders what it returns. A network-free `localHoroscope()` keeps the screen
// populated before the API answers / when it's unreachable.

import { api } from './api';

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
  source: 'ai' | 'fallback' | string;
};

export type HoroscopeDay = { date: string; signs: Horoscope[] };

export type ZodiacSign = {
  name: string;
  glyph: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  ruler: string;
  dates: string;
  gradient: readonly [string, string];
};

// Standard order — matches the backend `SIGNS` list and the Kundali engine's
// `moon_sign` values, so a saved Self chart maps straight onto this.
export const ZODIAC: ZodiacSign[] = [
  { name: 'Aries', glyph: '♈', element: 'Fire', ruler: 'Mars', dates: 'Mar 21 – Apr 19', gradient: ['#ff8a6b', '#e0503a'] },
  { name: 'Taurus', glyph: '♉', element: 'Earth', ruler: 'Venus', dates: 'Apr 20 – May 20', gradient: ['#7bc47f', '#3d8a53'] },
  { name: 'Gemini', glyph: '♊', element: 'Air', ruler: 'Mercury', dates: 'May 21 – Jun 20', gradient: ['#ffd66b', '#e0a63a'] },
  { name: 'Cancer', glyph: '♋', element: 'Water', ruler: 'Moon', dates: 'Jun 21 – Jul 22', gradient: ['#8fd3e8', '#4a97b8'] },
  { name: 'Leo', glyph: '♌', element: 'Fire', ruler: 'Sun', dates: 'Jul 23 – Aug 22', gradient: ['#ffb85c', '#e0872a'] },
  { name: 'Virgo', glyph: '♍', element: 'Earth', ruler: 'Mercury', dates: 'Aug 23 – Sep 22', gradient: ['#a3c98f', '#6b9a53'] },
  { name: 'Libra', glyph: '♎', element: 'Air', ruler: 'Venus', dates: 'Sep 23 – Oct 22', gradient: ['#f2a6c2', '#d16d97'] },
  { name: 'Scorpio', glyph: '♏', element: 'Water', ruler: 'Mars', dates: 'Oct 23 – Nov 21', gradient: ['#9a6bd0', '#5e2e8f'] },
  { name: 'Sagittarius', glyph: '♐', element: 'Fire', ruler: 'Jupiter', dates: 'Nov 22 – Dec 21', gradient: ['#f0a25c', '#d97b2a'] },
  { name: 'Capricorn', glyph: '♑', element: 'Earth', ruler: 'Saturn', dates: 'Dec 22 – Jan 19', gradient: ['#6f8bb0', '#3f5678'] },
  { name: 'Aquarius', glyph: '♒', element: 'Air', ruler: 'Saturn', dates: 'Jan 20 – Feb 18', gradient: ['#6bc6e8', '#3a8fc4'] },
  { name: 'Pisces', glyph: '♓', element: 'Water', ruler: 'Jupiter', dates: 'Feb 19 – Mar 20', gradient: ['#7fd0b8', '#3f9a7e'] },
];

export const SIGN_NAMES = ZODIAC.map((z) => z.name);

export function zodiac(name: string | null | undefined): ZodiacSign | null {
  if (!name) return null;
  return ZODIAC.find((z) => z.name.toLowerCase() === name.toLowerCase()) ?? null;
}

const ELEMENT_ACCENT: Record<string, string> = {
  Fire: '#e0653a',
  Earth: '#5c8a4a',
  Air: '#d69a2a',
  Water: '#3f8fb8',
};

export function elementAccent(element: string): string {
  return ELEMENT_ACCENT[element] ?? '#8a6bd0';
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
    lucky_color: z.element === 'Fire' ? 'Saffron' : z.element === 'Water' ? 'Sea Green' : z.element === 'Air' ? 'Sky Blue' : 'Forest Green',
    lucky_number: '',
    mood: 'Steady',
    best_time: 'Abhijit Muhurat (around midday)',
    tithi: '',
    nakshatra: '',
    source: 'fallback',
  };
}

export function localHoroscopeDay(): HoroscopeDay {
  return { date: new Date().toISOString().slice(0, 10), signs: SIGN_NAMES.map(localHoroscope) };
}

export function fetchHoroscopeDay(token: string | null) {
  return api<HoroscopeDay>('/horoscope/all', { token });
}
