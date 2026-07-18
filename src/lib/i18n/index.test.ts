import { beforeEach, describe, expect, it } from 'vitest'
import { availableLocales, translate } from './index'

beforeEach(() => {
  localStorage.clear()
})

describe('i18n translate', () => {
  it('looks up a key in the requested locale', () => {
    expect(translate('es', 'common.save')).toBe('Guardar')
    expect(translate('en', 'common.save')).toBe('Save')
  })

  it('interpolates params', () => {
    expect(translate('en', 'tree.deleteConfirm', { name: 'Smiths' })).toBe(
      'Delete "Smiths"? This cannot be undone.',
    )
  })

  it('falls back to English for a locale missing a key', () => {
    // simulate a locale-specific gap by looking up a key only present in en
    expect(translate('es', 'app.title')).toBe('Kin-nections')
  })

  it('falls back to the raw key when missing everywhere', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })

  it('exposes English and Spanish as available locales', () => {
    expect(availableLocales.map((l) => l.code).sort()).toEqual(['en', 'es'])
  })
})
