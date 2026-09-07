// Local cache of the user's latest Kundali so the Astrology tab and the Kundali
// screen paint instantly (and work offline). Neon stays the source of truth —
// this is only a mirror, refreshed from the network on every load.
import { File, Paths } from 'expo-file-system';

import type { Kundali } from './kundali';

const FILE_NAME = 'latest-kundali.json';

function cacheFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export function readKundaliCache(): Kundali | null {
  try {
    const file = cacheFile();
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as Kundali;
  } catch {
    return null;
  }
}

export function writeKundaliCache(kundali: Kundali): void {
  try {
    const file = cacheFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(kundali));
  } catch {
    // Non-fatal — the network copy is authoritative.
  }
}

export function clearKundaliCache(): void {
  try {
    const file = cacheFile();
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
