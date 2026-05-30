/**
 * i18next initialization — v4.0 spec §1.8 / §7.1.
 *
 * Stub bundle: only English is wired right now. Mandinka, Wolof, Fula, French
 * bundles will be added as translation content is produced by the linguistic
 * team. Key extraction across screens lands in a separate PR; this file just
 * wires the system so `useTranslation()` works.
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
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
  returnNull: false,
})

export default i18n
