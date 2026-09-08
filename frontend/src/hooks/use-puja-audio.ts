import { useEffect, useMemo } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import { PUJA_SOUNDS } from '../lib/virtual-puja';

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {}
};

/**
 * The five puja ritual-effect players (bundled synth placeholder assets).
 * Devotional ambience is a separate concern — see `usePujaAmbient`.
 * All calls are wrapped so a decode/playback failure can never crash the screen.
 */
export function usePujaAudio(muted: boolean) {
  const bell = useAudioPlayer(PUJA_SOUNDS.bell);
  const aarti = useAudioPlayer(PUJA_SOUNDS.aarti);
  const conch = useAudioPlayer(PUJA_SOUNDS.conch);
  const chime = useAudioPlayer(PUJA_SOUNDS.chime);
  const mantra = useAudioPlayer(PUJA_SOUNDS.mantra);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
      () => {},
    );
  }, []);

  useEffect(() => {
    for (const p of [bell, aarti, mantra]) {
      try {
        p.loop = true;
      } catch {}
    }
  }, [bell, aarti, mantra]);

  useEffect(() => {
    for (const p of [bell, aarti, conch, chime, mantra]) {
      try {
        p.muted = muted;
      } catch {}
    }
  }, [muted, bell, aarti, conch, chime, mantra]);

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
      /** Stop the ritual effects (ambience is managed separately). */
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
