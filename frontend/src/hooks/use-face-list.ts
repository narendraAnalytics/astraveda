import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { deleteFace, listFaces, type FaceSummary } from '../lib/face';
import { readFaceListCache, removeFaceCache, writeFaceListCache } from '../lib/face-cache';

/**
 * The signed-in user's saved face readings. Paints instantly from the on-device
 * cache, then revalidates against Neon (`GET /face/list`).
 */
export function useFaceList() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [items, setItems] = useState<FaceSummary[]>(() => readFaceListCache() ?? []);
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
        const list = await listFaces(token);
        if (cancelled) return;
        setItems(list);
        writeFaceListCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your face readings');
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
    removeFaceCache(id);
    try {
      const token = await getTokenRef.current();
      await deleteFace(id, token);
    } finally {
      setNonce((n) => n + 1);
    }
  }, []);

  return { items, loading, error, reload, remove };
}
