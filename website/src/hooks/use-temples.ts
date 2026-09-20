"use client";

import { useCallback, useEffect, useState } from "react";
import { listTemples, type Temple } from "@/lib/puja";

// The catalog is public and small — fetched once per page load and shared
// across the /puja pages via a module-level cache, so drilling from the
// temple list into a temple and its booking form doesn't refetch each time.
let cache: Temple[] | null = null;

export function useTemples() {
  const [items, setItems] = useState<Temple[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listTemples();
      cache = rows;
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the temples.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}
