// On-device mirror of the user's Vastu analyses. Neon stays source of truth.
// The room photo is stored here too — it never leaves the device.
import { Directory, File, Paths } from 'expo-file-system';

import type { VastuReading, VastuSummary } from './vastu';

const DIR = 'vastu';

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

export function readVastuListCache(): VastuSummary[] | null {
  return readJson<VastuSummary[]>('list.json');
}

export function writeVastuListCache(list: VastuSummary[]): void {
  writeJson('list.json', list);
}

export function readVastuCache(id: string): VastuReading | null {
  return readJson<VastuReading>(`reading-${id}.json`);
}

export function writeVastuCache(reading: VastuReading): void {
  writeJson(`reading-${reading.id}.json`, reading);
}

export function removeVastuCache(id: string): void {
  for (const name of [`reading-${id}.json`, `photo-${id}.jpg`]) {
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  }
}

export function saveVastuPhoto(id: string, sourceUri: string): string | null {
  try {
    const dest = file(`photo-${id}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function getVastuPhotoUri(id: string): string | null {
  try {
    const f = file(`photo-${id}.jpg`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}
