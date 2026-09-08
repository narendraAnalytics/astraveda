// On-device mirror of the user's saved face readings so the Astrology tab and
// the face screen paint instantly (and work offline). Neon stays the source of
// truth. The selfie keepsake is stored here too — it never leaves the device.
import { Directory, File, Paths } from 'expo-file-system';

import type { FaceReading, FaceSummary } from './face';

const DIR = 'face';

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

export function readFaceListCache(): FaceSummary[] | null {
  return readJson<FaceSummary[]>('list.json');
}

export function writeFaceListCache(list: FaceSummary[]): void {
  writeJson('list.json', list);
}

export function readFaceCache(id: string): FaceReading | null {
  return readJson<FaceReading>(`reading-${id}.json`);
}

export function writeFaceCache(reading: FaceReading): void {
  writeJson(`reading-${reading.id}.json`, reading);
}

export function removeFaceCache(id: string): void {
  for (const name of [`reading-${id}.json`, `photo-${id}.jpg`]) {
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      // ignore
    }
  }
}

/** Copies a captured selfie into the face dir and returns its persistent uri. */
export function saveFacePhoto(id: string, sourceUri: string): string | null {
  try {
    const dest = file(`photo-${id}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function getFacePhotoUri(id: string): string | null {
  try {
    const f = file(`photo-${id}.jpg`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}
