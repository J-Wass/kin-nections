import { afterEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { mount, unmount } from 'svelte'
import { availableLocales, currentLocale } from '../lib/i18n'
import LanguageSwitcher from './LanguageSwitcher.svelte'

let component: ReturnType<typeof mount> | null = null

afterEach(async () => {
  if (component) await unmount(component)
  component = null
  currentLocale.set('en')
  document.body.innerHTML = ''
})

describe('LanguageSwitcher', () => {
  it('shows the multilingual trigger and exposes locales through a native select', () => {
    component = mount(LanguageSwitcher, { target: document.body })

    expect(document.querySelector('.language-glyphs')?.textContent).toBe('文 A ض')
    const select = document.querySelector<HTMLSelectElement>('.language-select')!
    expect([...select.options].map((option) => option.value)).toEqual(
      availableLocales.map((l) => l.code),
    )

    select.value = 'es'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(get(currentLocale)).toBe('es')
  })
})
