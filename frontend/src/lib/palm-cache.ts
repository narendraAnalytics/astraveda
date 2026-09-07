// On-device mirror of the user's saved palm readings so the Astrology tab and
// the palm screen paint instantly (and work offline). Neon stays the source of
// truth. The optional palm photo is stored here too — it never leaves the device.
import { Directory, File, Paths } from 'expo-file-system';

import type { PalmReading, PalmSummary } from './palm';

const DIR = 'palm';

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

export function readPalmListCache(): PalmSummary[] | null {
  return readJson<PalmSummary[]>('list.json');
}

export function writePalmListCache(list: PalmSummary[]): void {
  writeJson('list.json', list);
}

// ---- individual readings ----------------------------------------------------

export function readPalmCache(id: string): PalmReading | null {
  return readJson<PalmReading>(`reading-${id}.json`);
}

export function writePalmCache(reading: PalmReading): void {
  writeJson(`reading-${reading.id}.json`, reading);
}

export function removePalmCache(id: string): void {
  for (const name of [`reading-${id}.json`, `photo-${id}.jpg`]) {
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  }
}

// ---- keepsake photo (device only) ----------------------------------------

/** Copies a picked image into the palm dir and returns its persistent uri. */
export function savePalmPhoto(id: string, sourceUri: string): string | null {
  try {
    const dest = file(`photo-${id}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function getPalmPhotoUri(id: string): string | null {
  try {
    const f = file(`photo-${id}.jpg`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}
