import { i18n } from './index';
import type { LanguageCode } from './languages';

// Backend base URL. Local dev: your PC LAN IP (never localhost from a phone).
// Prod: the Render URL. Set EXPO_PUBLIC_API_URL in frontend/.env.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// Session cache so the same string is never re-fetched. The backend also caches
// permanently in Postgres, so a cold cache still costs at most one Sarvam call.
const memo = new Map<string, string>();

/**
 * Translate backend/AI-generated text into the active app language.
 * Returns the original text unchanged for English, on error, or if API_URL is unset.
 */
export async function translateText(
  text: string,
  targetLang: LanguageCode = i18n.language as LanguageCode,
): Promise<string> {
  if (!text?.trim() || targetLang === 'en' || !API_URL) return text;

  const key = `${targetLang}:${text}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  try {
    const res = await fetch(`${API_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target_lang: targetLang, source_lang: 'en' }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as { translated_text?: string };
    const out = data.translated_text || text;
    memo.set(key, out);
    return out;
  } catch {
    return text;
  }
}
