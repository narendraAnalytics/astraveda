import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import {
  fetchHoroscopeDay,
  localHoroscopeDay,
  type Horoscope,
  type HoroscopeDay,
} from '../lib/horoscope';
import { readHoroscopeCache, writeHoroscopeCache } from '../lib/horoscope-cache';

/**
 * Today's horoscope for all 12 signs. Paints from the on-device cache (or an
 * offline template) immediately, then revalidates against `GET /horoscope/all`.
 * `live` is true once the real API values are in.
 */
export function useHoroscope(): {
  day: HoroscopeDay;
  bySign: Record<string, Horoscope>;
  loading: boolean;
  live: boolean;
  error: string | null;
} {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [day, setDay] = useState<HoroscopeDay>(() => readHoroscopeCache() ?? localHoroscopeDay());
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const fresh = await fetchHoroscopeDay(token);
        if (cancelled) return;
        setDay(fresh);
        setLive(true);
        writeHoroscopeCache(fresh);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your horoscope');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bySign = useMemo(() => {
    const map: Record<string, Horoscope> = {};
    for (const h of day.signs) map[h.sign] = h;
    return map;
  }, [day]);

  return { day, bySign, loading, live, error };
}
