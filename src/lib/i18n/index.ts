import { derived, writable } from 'svelte/store'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import uk from './locales/uk.json'
import pt from './locales/pt.json'
import ar from './locales/ar.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import hi from './locales/hi.json'

export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'uk' | 'pt' | 'ar' | 'zh' | 'ja' | 'hi'

type Messages = Record<string, string>

const locales: Record<LocaleCode, Messages> = { en, es, fr, de, uk, pt, ar, zh, ja, hi }

export const availableLocales: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'uk', label: 'Українська' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'hi', label: 'हिन्दी' },
]

/** Locales whose script reads right-to-left; drives the document's `dir` attribute. */
const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set(['ar'])

export function isRtl(locale: LocaleCode): boolean {
  return RTL_LOCALES.has(locale)
}

const STORAGE_KEY = 'kin-nections:locale'

function detectInitialLocale(): LocaleCode {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in locales) return stored as LocaleCode
  }
  if (typeof navigator !== 'undefined') {
    const preferred = navigator.language?.slice(0, 2)
    if (preferred && preferred in locales) return preferred as LocaleCode
  }
  return 'en'
}

export const currentLocale = writable<LocaleCode>(detectInitialLocale())

currentLocale.subscribe((locale) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }
})

export function translate(locale: LocaleCode, key: string, params?: Record<string, string | number>): string {
  const messages = locales[locale] ?? locales.en
  let message = messages[key] ?? locales.en[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replaceAll(`{{${name}}}`, String(value))
    }
  }
  return message
}

/** Reactive translation function: `$t('some.key', { name: 'Ada' })` in a Svelte component. */
export const t = derived(currentLocale, (locale) => (key: string, params?: Record<string, string | number>) =>
  translate(locale, key, params),
)
