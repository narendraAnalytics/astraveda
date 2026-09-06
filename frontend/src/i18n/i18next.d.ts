import 'i18next';

import type en from './locales/en.json';

// Augment i18next so t('home.askTitle') autocompletes and typos fail at compile time.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
