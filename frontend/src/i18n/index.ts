import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  type LanguageCode,
} from './languages';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import mr from './locales/mr.json';
import od from './locales/od.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

const STORE_KEY = 'astraveda.language';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  od: { translation: od },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  kn: { translation: kn },
} as const;

function isSupported(code: string | null | undefined): code is LanguageCode {
  return !!code && (LANGUAGE_CODES as string[]).includes(code);
}

/** Stored choice → device language → English. */
async function resolveInitialLanguage(): Promise<LanguageCode> {
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // SecureStore unavailable (e.g. web) — fall through to device locale.
  }
  const device = Localization.getLocales()[0]?.languageCode;
  return isSupported(device) ? device : DEFAULT_LANGUAGE;
}

export async function initI18n(): Promise<typeof i18n> {
  const lng = await resolveInitialLanguage();
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    returnNull: false,
    // React Native's Intl.PluralRules coverage is thin; v4 JSON keeps plurals simple.
    compatibilityJSON: 'v4',
  });
  return i18n;
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await SecureStore.setItemAsync(STORE_KEY, code);
  } catch {
    // best-effort persistence
  }
}

export { i18n };
