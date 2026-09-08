// On-device mirror of the temple catalog + the user's confirmed bookings so
// the Puja tab and the slip paint instantly. Neon stays source of truth.
import { Directory, File, Paths } from 'expo-file-system';

import type { PujaOrder, Temple } from './puja';

const DIR = 'puja';

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

export function readTempleCache(): Temple[] | null {
  return readJson<Temple[]>('temples.json');
}
export function writeTempleCache(list: Temple[]): void {
  writeJson('temples.json', list);
}

export function readOrdersCache(): PujaOrder[] | null {
  return readJson<PujaOrder[]>('orders.json');
}
export function writeOrdersCache(list: PujaOrder[]): void {
  writeJson('orders.json', list);
}

export function readOrderCache(id: string): PujaOrder | null {
  return readJson<PujaOrder>(`order-${id}.json`);
}
export function writeOrderCache(order: PujaOrder): void {
  writeJson(`order-${order.id}.json`, order);
}
