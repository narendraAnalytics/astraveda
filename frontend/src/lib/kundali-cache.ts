// On-device mirror of the user's saved Kundalis so the Astrology tab and the
// chart screen paint instantly (and work offline). Neon stays the source of
// truth — these files are refreshed from the network on every load.
import { Directory, File, Paths } from 'expo-file-system';

import type { Kundali, KundaliSummary } from './kundali';

const DIR = 'kundali';

function dir(): Directory {
  const d = new Directory(Paths.document, DIR);
  try {
    if (!d.exists) d.create();
  } catch {
    // ignore
  }
  return d;
}

function file(name: string): File {
  return new File(dir(), name);
}

function readJson<T>(name: string): T | null {
  try {
    const f = file(name);
    if (!f.exists) return null;
    return JSON.parse(f.textSync()) as T;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown): void {
  try {
    const f = file(name);
    if (!f.exists) f.create();
    f.write(JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

// ---- list ----------------------------------------------------------------

export function readKundaliListCache(): KundaliSummary[] | null {
  return readJson<KundaliSummary[]>('list.json');
}

export function writeKundaliListCache(list: KundaliSummary[]): void {
  writeJson('list.json', list);
}

// ---- individual charts --------------------------------------------------

export function readChartCache(id: string): Kundali | null {
  return readJson<Kundali>(`chart-${id}.json`);
}

export function writeChartCache(kundali: Kundali): void {
  writeJson(`chart-${kundali.id}.json`, kundali);
}

export function removeChartCache(id: string): void {
  try {
    const f = file(`chart-${id}.json`);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
