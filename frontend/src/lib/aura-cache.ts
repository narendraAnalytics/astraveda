// On-device mirror of the user's saved aura scans. Neon stays source of truth.
// The selfie keepsake is stored here too — it never leaves the device.
import { Directory, File, Paths } from 'expo-file-system';

import type { AuraReading, AuraSummary } from './aura';

const DIR = 'aura';

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

export function readAuraListCache(): AuraSummary[] | null {
  return readJson<AuraSummary[]>('list.json');
}

export function writeAuraListCache(list: AuraSummary[]): void {
  writeJson('list.json', list);
}

export function readAuraCache(id: string): AuraReading | null {
  return readJson<AuraReading>(`reading-${id}.json`);
}

export function writeAuraCache(reading: AuraReading): void {
  writeJson(`reading-${reading.id}.json`, reading);
}

export function removeAuraCache(id: string): void {
  for (const name of [`reading-${id}.json`, `photo-${id}.jpg`]) {
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  }
}

export function saveAuraPhoto(id: string, sourceUri: string): string | null {
  try {
    const dest = file(`photo-${id}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function getAuraPhotoUri(id: string): string | null {
  try {
    const f = file(`photo-${id}.jpg`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}
