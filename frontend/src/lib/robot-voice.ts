// Cloud narration for the welcome robot (and any future short mascot lines):
// the backend proxies Sarvam Bulbul TTS and returns a base64 WAV, which we
// write to a local cache file and hand back a file:// uri to play. Any
// failure (no EXPO_PUBLIC_API_URL, network error, Sarvam down) throws — the
// caller falls back to the on-device system voice, so nothing else depends
// on this working.
import { Directory, File, Paths } from 'expo-file-system';

import { api } from './api';

type SpeakResponse = { audio_base64: string; format: string };

const TIMEOUT_MS = 8000;
let counter = 0;

function dir(): Directory {
  const d = new Directory(Paths.cache, 'robot-voice');
  try {
    if (!d.exists) d.create();
  } catch {
    // ignore
  }
  return d;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('TTS request timed out')), ms));
}

export async function synthesizeSpeechUri(text: string): Promise<string> {
  const { audio_base64, format } = await Promise.race([
    api<SpeakResponse>('/tts/speak', { method: 'POST', body: { text } }),
    timeout(TIMEOUT_MS),
  ]);

  counter += 1;
  const f = new File(dir(), `line-${Date.now()}-${counter}.${format}`);
  if (!f.exists) f.create();
  f.write(audio_base64, { encoding: 'base64' });
  return f.uri;
}
