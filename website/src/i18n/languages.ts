// The 7 languages AstraVeda ships — same set, codes and guest rule as the mobile app.
// `endonym` is the name in the language's own script; `badge` is a single script
// glyph for the dropdown (flags map badly to languages — all 7 are Indian, so the
// Indian flag lives on the navbar button and each row gets its own script badge).

export type LangCode = "en" | "hi" | "od" | "ta" | "te" | "mr" | "kn";

export type Language = {
  code: LangCode;
  endonym: string;
  english: string;
  badge: string;
  /** Badge gradient (from, to) — soft pastels, matching the bright site palette. */
  tint: readonly [string, string];
};

export const LANGUAGES: Language[] = [
  { code: "en", endonym: "English", english: "English", badge: "A", tint: ["#FFD9A8", "#FFB36B"] },
  { code: "hi", endonym: "हिन्दी", english: "Hindi", badge: "अ", tint: ["#FFC9C9", "#FF8F8F"] },
  { code: "od", endonym: "ଓଡ଼ିଆ", english: "Odia", badge: "ଓ", tint: ["#D9C8FF", "#A98BFF"] },
  { code: "ta", endonym: "தமிழ்", english: "Tamil", badge: "த", tint: ["#BDEBD8", "#6FD1A8"] },
  { code: "te", endonym: "తెలుగు", english: "Telugu", badge: "తె", tint: ["#BFE0FF", "#7FBAF5"] },
  { code: "mr", endonym: "मराठी", english: "Marathi", badge: "म", tint: ["#FFE0A8", "#F5BC4A"] },
  { code: "kn", endonym: "ಕನ್ನಡ", english: "Kannada", badge: "ಕ", tint: ["#FFC8E0", "#F58BB8"] },
];

export const DEFAULT_LANGUAGE: LangCode = "en";

/** Guests (signed-out visitors) get these two; the other five need a sign-in. */
export const GUEST_LANGUAGES: readonly LangCode[] = ["en", "od"];

export const LANGUAGE_STORAGE_KEY = "astraveda.web.language";

export const isLangCode = (v: unknown): v is LangCode =>
  typeof v === "string" && LANGUAGES.some((l) => l.code === v);

export const languageOf = (code: LangCode): Language =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
