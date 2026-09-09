import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { deleteConsult, listConsults, type ConsultSummary } from '../lib/consult';
import { readConsultListCache, removeConsultCache, writeConsultListCache } from '../lib/consult-cache';

/**
 * The signed-in user's voice consultations. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /consult/list`).
 */
export function useConsultList() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [items, setItems] = useState<ConsultSummary[]>(() => readConsultListCache() ?? []);
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
        const list = await listConsults(token);
        if (cancelled) return;
        setItems(list);
        writeConsultListCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your consultations');
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
    removeConsultCache(id);
    try {
      const token = await getTokenRef.current();
      await deleteConsult(id, token);
    } finally {
      setNonce((n) => n + 1);
    }
  }, []);

  return { items, loading, error, reload, remove };
}
