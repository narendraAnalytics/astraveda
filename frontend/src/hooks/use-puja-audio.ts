import { useEffect, useMemo } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import {
  AMBIENCE_DUCKED_VOLUME,
  AMBIENCE_VOLUME,
  PUJA_AMBIENCE,
  PUJA_SOUNDS,
  type PujaTradition,
} from '../lib/virtual-puja';

/**
 * Owns the puja audio players (sources are bundled assets, currently silent
 * placeholders). Five effect players plus one looping devotional `ambient`
 * track that swaps per temple. All calls are wrapped so a decode/playback
 * failure can never crash the screen.
 */
export function usePujaAudio(muted: boolean) {
  const bell = useAudioPlayer(PUJA_SOUNDS.bell);
  const aarti = useAudioPlayer(PUJA_SOUNDS.aarti);
  const conch = useAudioPlayer(PUJA_SOUNDS.conch);
  const chime = useAudioPlayer(PUJA_SOUNDS.chime);
  const mantra = useAudioPlayer(PUJA_SOUNDS.mantra);
  const ambient = useAudioPlayer(PUJA_AMBIENCE.shiva);

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
    for (const p of [ambient]) {
      try {
        p.volume = AMBIENCE_VOLUME;
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

  return useMemo(() => {
    const safe = (fn: () => void) => {
      try {
        fn();
      } catch {}
    };
    const restart = (p: typeof bell) =>
      safe(() => {
        p.seekTo(0);
        p.play();
      });
    return {
      startBell: () => restart(bell),
      stopBell: () => safe(() => bell.pause()),
      startAarti: () => restart(aarti),
      stopAarti: () => safe(() => aarti.pause()),
      playConch: () => restart(conch),
      playChime: () => restart(chime),

      setAmbientTradition: (tradition: PujaTradition) =>
        safe(() => ambient.replace(PUJA_AMBIENCE[tradition])),
      playAmbient: () => safe(() => ambient.play()),
      stopAmbient: () => safe(() => ambient.pause()),
      duckAmbient: (ducked: boolean) =>
        safe(() => {
          ambient.volume = ducked ? AMBIENCE_DUCKED_VOLUME : AMBIENCE_VOLUME;
        }),

      /** Stop the ritual effects but leave the devotional ambience playing. */
      stopEffects: () =>
        safe(() => {
          bell.pause();
          aarti.pause();
          mantra.pause();
        }),
      /** Stop everything, including ambience (screen teardown). */
      stopAll: () =>
        safe(() => {
          bell.pause();
          aarti.pause();
          mantra.pause();
          ambient.pause();
        }),
    };
  }, [bell, aarti, conch, chime, mantra, ambient]);
}

export type PujaAudio = ReturnType<typeof usePujaAudio>;
