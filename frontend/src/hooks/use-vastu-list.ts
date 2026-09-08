import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { deleteVastu, listVastu, type VastuSummary } from '../lib/vastu';
import { readVastuListCache, removeVastuCache, writeVastuListCache } from '../lib/vastu-cache';

/**
 * The signed-in user's Vastu analyses. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /vastu/list`).
 */
export function useVastuList() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [items, setItems] = useState<VastuSummary[]>(() => readVastuListCache() ?? []);
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
        const list = await listVastu(token);
        if (cancelled) return;
        setItems(list);
        writeVastuListCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your Vastu analyses');
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
    removeVastuCache(id);
    try {
      const token = await getTokenRef.current();
      await deleteVastu(id, token);
    } finally {
      setNonce((n) => n + 1);
    }
  }, []);

  return { items, loading, error, reload, remove };
}
