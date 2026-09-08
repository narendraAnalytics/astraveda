import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

import {
  AMBIENCE_DUCKED_VOLUME,
  AMBIENCE_VOLUME,
  PUJA_AMBIENCE,
  type PujaTradition,
} from '../lib/virtual-puja';

type Options = {
  tradition: PujaTradition;
  /** Devotional background track on/off. */
  enabled: boolean;
  /** Lower the ambience under the aarti. */
  ducked: boolean;
  muted: boolean;
};

/**
 * The looping devotional background track. `useAudioPlayer` swaps the underlying
 * player when `tradition` changes (different bundled asset), so the play effect
 * re-runs and retries for the new track. No status hook — a short retry loop
 * covers the initial buffering without extra re-renders.
 */
export function usePujaAmbient({ tradition, enabled, ducked, muted }: Options) {
  const player = useAudioPlayer(PUJA_AMBIENCE[tradition]);

  // The `for (const p of [player])` indirection keeps the react-hooks/immutability
  // lint rule happy while still setting these player fields.
  useEffect(() => {
    for (const p of [player]) {
      try {
        p.loop = true;
      } catch {}
    }
  }, [player]);

  useEffect(() => {
    for (const p of [player]) {
      try {
        p.muted = muted;
      } catch {}
    }
  }, [muted, player]);

  useEffect(() => {
    for (const p of [player]) {
      try {
        p.volume = ducked ? AMBIENCE_DUCKED_VOLUME : AMBIENCE_VOLUME;
      } catch {}
    }
  }, [ducked, player]);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      try {
        if (enabled) player.play();
        else player.pause();
      } catch {}
      // Retry a few times: the asset may still be buffering on the first calls.
      if (enabled && tries++ < 8) setTimeout(tick, 350);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [enabled, player]);
}
