import { useEffect, useState } from 'react';

import {
  fetchCosmicGuidance,
  localCosmicGuidance,
  type CosmicGuidance,
} from '../lib/cosmic';

/**
 * Today's Cosmic Guidance for the home screen. Paints instantly from a
 * network-free weekday computation, then swaps in the real sunrise-based
 * timings from `GET /cosmic/today`. If the API is unset or unreachable the
 * local version stays — the section is never empty.
 */
export function useCosmicGuidance(): { data: CosmicGuidance; live: boolean } {
  const [data, setData] = useState<CosmicGuidance>(() => localCosmicGuidance());
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await fetchCosmicGuidance();
        if (!cancelled) {
          setData(fresh);
          setLive(true);
        }
      } catch {
        // keep the local fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, live };
}
