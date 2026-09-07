import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { deletePalm, listPalms, type PalmSummary } from '../lib/palm';
import { readPalmListCache, removePalmCache, writePalmListCache } from '../lib/palm-cache';

/**
 * The signed-in user's saved palm readings. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /palm/list`).
 */
export function usePalmList() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [items, setItems] = useState<PalmSummary[]>(() => readPalmListCache() ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const list = await listPalms(token);
        if (cancelled) return;
        setItems(list);
        writePalmListCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your palm readings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, nonce]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    removePalmCache(id);
    try {
      const token = await getTokenRef.current();
      await deletePalm(id, token);
    } finally {
      setNonce((n) => n + 1);
    }
  }, []);

  return { items, loading, error, reload, remove };
}
