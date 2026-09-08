/**
 * i18next initialization — v4.0 spec §1.8 / §7.1.
 *
 * ENGLISH ONLY, ON PURPOSE. Mandinka, Wolof, Fula and French are declared in
 * SUPPORTED_LOCALES and have no bundle, so they fall back to English until AIWA
 * supplies or approves the translations. Those are cultural and linguistic
 * decisions under AIWA's authority — machine-translating them here would put
 * invented orthography in front of the children whose language this exists to
 * honour, which is worse than an honest English fallback.
 *
 * Key extraction across the student-facing screens is DONE and is enforced, not
 * assumed: `src/i18n/noHardcodedStrings.test.ts` fails the build on a literal
 * string in a student-facing component, and on any key whose bundled English
 * disagrees with the `defaultValue` in the code.
 *
 * Adding a locale is: drop `<code>.json` beside `en/common.json`, import it, and
 * add it to `resources` below. Nothing else changes.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/common.json'

export const SUPPORTED_LOCALES = ['en', 'mn', 'wo', 'ff', 'fr'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  defaultNS: 'common',
  // Resources are bundled (synchronous import above) — no backend loader,
  // so init resolves on the same tick.
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
  returnNull: false,
  // react-i18next defaults to useSuspense=true. There is no <Suspense>
  // boundary in main.tsx, so disable suspense to prevent the first
  // useTranslation() call from throwing/suspending on initial render.
  react: {
    useSuspense: false,
  },
})

export default i18n
