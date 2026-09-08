// On-device mirror of the user's dream journal. Neon stays source of truth.
import { Directory, File, Paths } from 'expo-file-system';

import type { DreamReading, DreamSummary } from './dream';

const DIR = 'dream';

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

export function readDreamListCache(): DreamSummary[] | null {
  return readJson<DreamSummary[]>('list.json');
}

export function writeDreamListCache(list: DreamSummary[]): void {
  writeJson('list.json', list);
}

export function readDreamCache(id: string): DreamReading | null {
  return readJson<DreamReading>(`reading-${id}.json`);
}

export function writeDreamCache(reading: DreamReading): void {
  writeJson(`reading-${reading.id}.json`, reading);
}

export function removeDreamCache(id: string): void {
  try {
    const f = file(`reading-${id}.json`);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
