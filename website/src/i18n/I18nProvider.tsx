"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  DEFAULT_LANGUAGE,
  GUEST_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  isLangCode,
  type LangCode,
} from "./languages";
import type { Dict } from "./locales/en";
import { en } from "./locales/en";
import { hi } from "./locales/hi";
import { od } from "./locales/od";
import { ta } from "./locales/ta";
import { te } from "./locales/te";
import { mr } from "./locales/mr";
import { kn } from "./locales/kn";

const DICTS: Record<LangCode, Dict> = { en, hi, od, ta, te, mr, kn };

type I18nValue = {
  /** The language actually being shown (a locked choice falls back to English). */
  lang: LangCode;
  d: Dict;
  signedIn: boolean;
  isLocked: (code: LangCode) => boolean;
  /** Returns false (and changes nothing) when `code` is locked for this visitor. */
  setLang: (code: LangCode) => boolean;
};

const Ctx = createContext<I18nValue>({
  lang: DEFAULT_LANGUAGE,
  d: en,
  signedIn: false,
  isLocked: () => false,
  setLang: () => false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  // Always start on English so the server render and the first client render match
  // (hydration-safe); the saved choice is applied right after mount.
  const [chosen, setChosen] = useState<LangCode>(DEFAULT_LANGUAGE);
  const signedIn = !!(isLoaded && isSignedIn);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLangCode(saved)) setChosen(saved);
    } catch {
      /* private mode */
    }
  }, []);

  const isLocked = useCallback(
    (code: LangCode) => !signedIn && !GUEST_LANGUAGES.includes(code),
    [signedIn],
  );

  // A locked saved choice (e.g. Tamil after signing out) shows English but stays
  // in storage, so signing back in restores it.
  const lang: LangCode = isLocked(chosen) ? DEFAULT_LANGUAGE : chosen;

  useEffect(() => {
    document.documentElement.lang = lang === "od" ? "or" : lang;
  }, [lang]);

  const setLang = useCallback(
    (code: LangCode) => {
      if (isLocked(code)) return false;
      setChosen(code);
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      } catch {
        /* private mode */
      }
      return true;
    },
    [isLocked],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, d: DICTS[lang], signedIn, isLocked, setLang }),
    [lang, signedIn, isLocked, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
