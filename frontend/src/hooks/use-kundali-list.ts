import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { deleteKundali, listKundalis, type KundaliSummary } from '../lib/kundali';
import {
  readKundaliListCache,
  removeChartCache,
  writeKundaliListCache,
} from '../lib/kundali-cache';

/**
 * The signed-in user's saved Kundalis. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /kundali/list`).
 */
export function useKundaliList() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [items, setItems] = useState<KundaliSummary[]>(() => readKundaliListCache() ?? []);
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
        const list = await listKundalis(token);
        if (cancelled) return;
        setItems(list);
        writeKundaliListCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your charts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, nonce]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((k) => k.id !== id));
    removeChartCache(id);
    try {
      const token = await getTokenRef.current();
      await deleteKundali(id, token);
    } finally {
      setNonce((n) => n + 1);
    }
  }, []);

  return { items, loading, error, reload, remove };
}
