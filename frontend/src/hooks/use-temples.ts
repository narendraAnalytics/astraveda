import { useCallback, useEffect, useState } from 'react';

import { listTemples, type Temple } from '../lib/puja';
import { readTempleCache, writeTempleCache } from '../lib/puja-cache';

/** The temple/puja catalog. Public — paints from cache, revalidates. */
export function useTemples() {
  const [items, setItems] = useState<Temple[]>(() => readTempleCache() ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await listTemples();
        if (cancelled) return;
        setItems(list);
        writeTempleCache(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load temples');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { items, loading, error, reload };
}
