// On-device mirror of today's horoscope so the screen paints instantly and
// works offline. Neon stays the source of truth — refreshed on every load.
import { Directory, File, Paths } from 'expo-file-system';

import type { HoroscopeDay } from './horoscope';

const DIR = 'horoscope';

function dir(): Directory {
  const d = new Directory(Paths.document, DIR);
  try {
    if (!d.exists) d.create();
  } catch {
    // ignore
  }
  return d;
}

function file(): File {
  return new File(dir(), 'today.json');
}

export function readHoroscopeCache(): HoroscopeDay | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const day = JSON.parse(f.textSync()) as HoroscopeDay;
    // Only trust it if it's actually for today.
    if (day?.date === new Date().toISOString().slice(0, 10)) return day;
    return null;
  } catch {
    return null;
  }
}

export function writeHoroscopeCache(day: HoroscopeDay): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(day));
  } catch {
    // non-fatal
  }
}
