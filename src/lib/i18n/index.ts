import { derived, writable } from 'svelte/store'
import en from './locales/en.json'
import es from './locales/es.json'

export type LocaleCode = 'en' | 'es'

type Messages = Record<string, string>

const locales: Record<LocaleCode, Messages> = { en, es }

export const availableLocales: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]

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
