// On-device mirror of the user's voice consultations. Neon stays source of truth.
import { Directory, File, Paths } from 'expo-file-system';

import type { Consultation, ConsultSummary } from './consult';

const DIR = 'consult';

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

export function readConsultListCache(): ConsultSummary[] | null {
  return readJson<ConsultSummary[]>('list.json');
}

export function writeConsultListCache(list: ConsultSummary[]): void {
  writeJson('list.json', list);
}

export function readConsultCache(id: string): Consultation | null {
  return readJson<Consultation>(`call-${id}.json`);
}

export function writeConsultCache(c: Consultation): void {
  writeJson(`call-${c.id}.json`, c);
}

export function removeConsultCache(id: string): void {
  try {
    const f = file(`call-${id}.json`);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
