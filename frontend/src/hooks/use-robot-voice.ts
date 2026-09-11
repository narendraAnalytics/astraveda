import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import { synthesizeSpeechUri } from '../lib/robot-voice';

type SpeakCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
};

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {}
};

// Picks the most natural-sounding on-device TTS voice available, for the
// fallback path only (Android ships several English voices per locale —
// network/"Enhanced" ones sound human, the default compact one sounds like a
// classic text-to-speech robot; iOS voice ids already sound natural).
let cachedVoiceId: string | null | undefined;
async function pickFallbackVoice(): Promise<string | undefined> {
  if (cachedVoiceId !== undefined) return cachedVoiceId ?? undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
    const pool = english.length ? english : voices;
    const score = (v: (typeof voices)[number]) => {
      const id = v.identifier?.toLowerCase() ?? '';
      const quality = v.quality?.toLowerCase() ?? '';
      let s = 0;
      if (quality.includes('enhanced')) s += 3;
      if (id.includes('network')) s += 2;
      if (id.includes('local')) s -= 1;
      if (v.language?.toLowerCase() === 'en-us') s += 1;
      return s;
    };
    const best = [...pool].sort((a, b) => score(b) - score(a))[0];
    cachedVoiceId = best?.identifier ?? null;
  } catch {
    cachedVoiceId = null;
  }
  return cachedVoiceId ?? undefined;
}

/**
 * Speaks short mascot lines with a real human-sounding cloud voice (backend
 * -> Sarvam Bulbul TTS), falling back to the on-device system voice if the
 * network call fails for any reason (offline, no API URL configured, Sarvam
 * error). Preloads the fallback voice id on mount so the fallback path never
 * has to wait on it later.
 */
export function useRobotVoice() {
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    pickFallbackVoice();
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
      () => {},
    );
  }, []);

  const stop = useCallback(() => {
    safe(() => Speech.stop());
    safe(() => playerRef.current?.remove());
    playerRef.current = null;
  }, []);

  const speak = useCallback((text: string, { onStart, onDone, onError }: SpeakCallbacks) => {
    let cancelled = false;

    const fallback = async () => {
      const voice = await pickFallbackVoice();
      if (cancelled) return;
      Speech.speak(text, {
        voice,
        rate: 0.95,
        pitch: 1.0,
        onStart: () => onStart?.(),
        onDone: () => onDone?.(),
        onStopped: () => onDone?.(),
        onError: () => onError?.(),
      });
    };

    (async () => {
      try {
        const uri = await synthesizeSpeechUri(text);
        if (cancelled) return;
        const player = createAudioPlayer(uri);
        playerRef.current = player;
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            sub.remove();
            onDone?.();
          }
        });
        onStart?.();
        player.play();
      } catch {
        if (!cancelled) fallback();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
