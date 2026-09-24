import 'i18next';

import type en from '@/locales/en.json';

// English is the source of truth for keys; t('missing.key') is a type error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
