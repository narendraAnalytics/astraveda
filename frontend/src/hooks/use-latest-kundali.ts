import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { ApiError } from '../lib/api';
import { getLatestKundali, type Kundali } from '../lib/kundali';
import { readKundaliCache, writeKundaliCache } from '../lib/kundali-cache';

/**
 * The signed-in user's most recent Kundali. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /kundali`). A 404 means "none yet"
 * — not an error.
 */
export function useLatestKundali() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [kundali, setKundali] = useState<Kundali | null>(() => readKundaliCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setKundali(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const latest = await getLatestKundali(token);
        if (cancelled) return;
        setKundali(latest);
        writeKundaliCache(latest);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setKundali(null);
        } else {
          setError(e instanceof Error ? e.message : 'Could not load your chart');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, nonce]);

  return { kundali, loading, error, reload };
}
