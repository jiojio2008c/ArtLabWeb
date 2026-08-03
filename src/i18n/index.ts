import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhHant from './locales/zh-Hant.ts'
import zhHans from './locales/zh-Hans.ts'
import en from './locales/en.ts'
import ptPT from './locales/pt-PT.ts'
import plPL from './locales/pl-PL.ts'

const APP_LOCALE_STORAGE_KEY = 'magicfloor_locale_v1'
const APP_LOCALES = ['zh-Hant', 'zh-Hans', 'en', 'pt-PT', 'pl-PL'] as const
type AppLocale = (typeof APP_LOCALES)[number]

const LANGUAGE_OPTIONS: ReadonlyArray<{ id: AppLocale; nativeName: string }> = [
  { id: 'zh-Hant', nativeName: '繁體中文' },
  { id: 'zh-Hans', nativeName: '简体中文' },
  { id: 'en', nativeName: 'English' },
  { id: 'pt-PT', nativeName: 'Português' },
  { id: 'pl-PL', nativeName: 'Polski' }
]

const normalizeLocale = (value: string | null | undefined): AppLocale => {
  if (value && (APP_LOCALES as readonly string[]).includes(value)) return value as AppLocale
  return 'zh-Hant'
}

const loadAppLocale = (): AppLocale => {
  if (typeof window === 'undefined') return 'zh-Hant'
  try {
    return normalizeLocale(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY))
  } catch {
    return 'zh-Hant'
  }
}

const persistAppLocale = (locale: AppLocale) => {
  try {
    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale)
  } catch {
    // The selected language still applies for the current session.
  }
}

const applyDocumentLocale = (locale: AppLocale) => {
  document.documentElement.lang = locale
  document.documentElement.dir = 'ltr'
}

const initialLocale = loadAppLocale()

void i18n.use(initReactI18next).init({
  resources: {
    'zh-Hant': { translation: zhHant },
    'zh-Hans': { translation: zhHans },
    en: { translation: en },
    'pt-PT': { translation: ptPT },
    'pl-PL': { translation: plPL }
  },
  lng: initialLocale,
  fallbackLng: 'zh-Hant',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false
})

applyDocumentLocale(initialLocale)

const changeAppLocale = async (locale: AppLocale) => {
  persistAppLocale(locale)
  applyDocumentLocale(locale)
  await i18n.changeLanguage(locale)
}

const getCurrentAppLocale = () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language)

export type { AppLocale }
export {
  APP_LOCALES,
  APP_LOCALE_STORAGE_KEY,
  LANGUAGE_OPTIONS,
  changeAppLocale,
  getCurrentAppLocale,
  loadAppLocale
}
export default i18n
