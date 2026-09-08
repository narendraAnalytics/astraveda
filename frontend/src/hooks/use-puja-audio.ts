import { useEffect, useMemo, useRef } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import {
  AMBIENCE_DUCKED_VOLUME,
  AMBIENCE_VOLUME,
  PUJA_AMBIENCE,
  PUJA_SOUNDS,
  type PujaTradition,
} from '../lib/virtual-puja';

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {}
};

type Options = {
  muted: boolean;
  tradition: PujaTradition;
  /** Devotional background track on/off. */
  bhajanOn: boolean;
  /** Lower the ambience under the aarti. */
  ducked: boolean;
};

/**
 * Owns the puja audio players (bundled synth placeholder assets). Five effect
 * players plus one looping devotional `ambient` track that swaps per temple and
 * is driven from its own load status (so it reliably starts once buffered).
 * All calls are wrapped so a decode/playback failure can never crash the screen.
 */
export function usePujaAudio({ muted, tradition, bhajanOn, ducked }: Options) {
  const bell = useAudioPlayer(PUJA_SOUNDS.bell);
  const aarti = useAudioPlayer(PUJA_SOUNDS.aarti);
  const conch = useAudioPlayer(PUJA_SOUNDS.conch);
  const chime = useAudioPlayer(PUJA_SOUNDS.chime);
  const mantra = useAudioPlayer(PUJA_SOUNDS.mantra);
  // Higher updateInterval — we only watch isLoaded/playing transitions, no need
  // for frequent status re-renders.
  const ambient = useAudioPlayer(PUJA_AMBIENCE[tradition], { updateInterval: 800 });
  const ambientStatus = useAudioPlayerStatus(ambient);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(
      () => {},
    );
  }, []);

  useEffect(() => {
    for (const p of [bell, aarti, mantra, ambient]) {
      try {
        p.loop = true;
      } catch {}
    }
  }, [bell, aarti, mantra, ambient]);

  useEffect(() => {
    for (const p of [bell, aarti, conch, chime, mantra, ambient]) {
      try {
        p.muted = muted;
      } catch {}
    }
  }, [muted, bell, aarti, conch, chime, mantra, ambient]);

  // Swap the ambience track when the temple's tradition changes.
  const loadedTradition = useRef(tradition);
  useEffect(() => {
    if (loadedTradition.current === tradition) return;
    loadedTradition.current = tradition;
    safe(() => ambient.replace(PUJA_AMBIENCE[tradition]));
  }, [tradition, ambient]);

  // Start / stop the ambience from its actual load state — retries every time
  // `isLoaded` flips true (initial buffer, and after each `replace`).
  useEffect(() => {
    if (bhajanOn) {
      if (ambientStatus.isLoaded && !ambientStatus.playing) safe(() => ambient.play());
    } else if (ambientStatus.playing) {
      safe(() => ambient.pause());
    }
  }, [bhajanOn, ambientStatus.isLoaded, ambientStatus.playing, ambient]);

  // Duck the ambience under the aarti.
  useEffect(() => {
    for (const p of [ambient]) {
      try {
        p.volume = ducked ? AMBIENCE_DUCKED_VOLUME : AMBIENCE_VOLUME;
      } catch {}
    }
  }, [ducked, ambient, ambientStatus.isLoaded]);

  return useMemo(() => {
    const restart = (p: typeof bell) => {
      safe(() => p.seekTo(0));
      safe(() => p.play());
    };
    return {
      startBell: () => restart(bell),
      stopBell: () => safe(() => bell.pause()),
      startAarti: () => restart(aarti),
      stopAarti: () => safe(() => aarti.pause()),
      playConch: () => restart(conch),
      playChime: () => restart(chime),
      /** Stop the ritual effects; leaves the devotional ambience playing. */
      stopEffects: () =>
        safe(() => {
          bell.pause();
          aarti.pause();
          mantra.pause();
        }),
    };
  }, [bell, aarti, conch, chime, mantra]);
}

export type PujaAudio = ReturnType<typeof usePujaAudio>;
