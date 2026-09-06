// The 7 languages AstraVeda ships. `endonym` is the name in that language's own
// script (rendered via the OS system font, which covers all these scripts on
// iOS and Android). `code` is what we pass to i18next and to the backend.
export type LanguageCode = 'en' | 'hi' | 'od' | 'ta' | 'te' | 'mr' | 'kn';

export type Language = {
  code: LanguageCode;
  endonym: string;
  english: string;
};

export const LANGUAGES: Language[] = [
  { code: 'en', endonym: 'English', english: 'English' },
  { code: 'hi', endonym: 'हिन्दी', english: 'Hindi' },
  { code: 'od', endonym: 'ଓଡ଼ିଆ', english: 'Odia' },
  { code: 'ta', endonym: 'தமிழ்', english: 'Tamil' },
  { code: 'te', endonym: 'తెలుగు', english: 'Telugu' },
  { code: 'mr', endonym: 'मराठी', english: 'Marathi' },
  { code: 'kn', endonym: 'ಕನ್ನಡ', english: 'Kannada' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE: LanguageCode = 'en';
