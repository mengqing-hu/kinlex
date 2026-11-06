import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './locales'

// Every page starts with the learner's language, e.g. /zh/de/vocabulary/a1 is German taught in
// Chinese, so each language's pages can be cached and found by search engines.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Most languages still show the English interface, so search engines are not told about them.
  alternateLinks: false,
})
