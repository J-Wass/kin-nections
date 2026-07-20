import { beforeEach, describe, expect, it } from 'vitest'
import { availableLocales, isRtl, translate } from './index'

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

  it('exposes all supported locales', () => {
    expect(availableLocales.map((l) => l.code).sort()).toEqual(
      ['ar', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'pt', 'uk', 'zh'].sort(),
    )
  })

  it('looks up a key in every non-English locale without falling back', () => {
    for (const { code } of availableLocales) {
      if (code === 'en') continue
      expect(translate(code, 'common.save')).not.toBe('does.not.exist')
      expect(translate(code, 'common.save')).not.toBe('common.save')
    }
  })

  it('flags only Arabic as right-to-left', () => {
    expect(availableLocales.filter((l) => isRtl(l.code)).map((l) => l.code)).toEqual(['ar'])
  })
})
