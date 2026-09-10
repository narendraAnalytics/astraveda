import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  fetchCosmicGuidance,
  localCosmicGuidance,
  type CosmicGuidance,
} from '../lib/cosmic';
import { translateMany } from '../i18n/dynamic';
import type { LanguageCode } from '../i18n/languages';

/**
 * Today's Cosmic Guidance for the home screen. Paints instantly from a
 * network-free weekday computation, then swaps in the real sunrise-based
 * timings from `GET /cosmic/today`. If the API is unset or unreachable the
 * local version stays — the section is never empty.
 *
 * The editorial prose (blessing + lucky-colour name) is English-authored, so it
 * is run through Sarvam `/translate` into the active app language and re-run
 * whenever the language changes. The mantra stays in Sanskrit.
 */
export function useCosmicGuidance(): { data: CosmicGuidance; live: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  // Raw English guidance (local fallback, then the real API values).
  const [base, setBase] = useState<CosmicGuidance>(() => localCosmicGuidance());
  const [live, setLive] = useState(false);
  // What the screen renders — `base` for English, a translated copy otherwise.
  const [data, setData] = useState<CosmicGuidance>(base);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await fetchCosmicGuidance();
        if (!cancelled) {
          setBase(fresh);
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

  useEffect(() => {
    if (lang === 'en') {
      setData(base);
      return;
    }
    let cancelled = false;
    setData(base); // show English immediately, swap in the translation below
    (async () => {
      try {
        const [title, body, reveal, colorName] = await translateMany(
          [base.blessing.title, base.blessing.body, base.blessing.reveal, base.lucky_color.name],
          lang as LanguageCode,
        );
        if (cancelled) return;
        setData({
          ...base,
          blessing: { title, body, reveal },
          lucky_color: { ...base.lucky_color, name: colorName },
        });
      } catch {
        // keep English
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, lang]);

  return { data, live };
}
