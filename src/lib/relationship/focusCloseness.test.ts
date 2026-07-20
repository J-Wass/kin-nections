import { describe, expect, it } from 'vitest'
import type { KinshipResult } from './kinship'
import { farthestCloseness, focusCloseness } from './focusCloseness'

function relationship(label: string, length: number): KinshipResult {
  return {
    label,
    path: Array.from({ length }, () => 'parent'),
  }
}

describe('focusCloseness', () => {
  const immediate = new Set(['parent', 'child', 'spouse', 'sibling'])

  it('uses the brightest tier for focus and immediate family', () => {
    expect(focusCloseness('focus', 'focus', immediate)).toBe('focus')
    for (const personId of immediate) {
      expect(focusCloseness('focus', personId, immediate, relationship('Related', 4))).toBe('near')
    }
  })

  it('uses the middle tier for the named extended family relationships', () => {
    for (const label of ['Grandparent', 'Grandchild', 'Aunt/Uncle', 'Niece/Nephew', 'First cousin']) {
      expect(focusCloseness('focus', label, immediate, relationship(label, 4))).toBe('extended')
    }
  })

  it('uses the dimmest color for great-relatives and second cousins', () => {
    expect(
      focusCloseness('focus', 'great-grandparent', immediate, relationship('Great-grandparent', 3)),
    ).toBe('remote')
    expect(
      focusCloseness('focus', 'second-cousin', immediate, relationship('Second cousin', 6)),
    ).toBe('remote')
  })

  it('removes focus color beyond six family hops or when disconnected', () => {
    expect(
      focusCloseness('focus', 'third-cousin', immediate, relationship('Third cousin', 8)),
    ).toBe('none')
    expect(
      focusCloseness('focus', 'unrelated', immediate, relationship('No known relation', 0)),
    ).toBe('none')
  })
})

describe('farthestCloseness', () => {
  it('colors an edge using its most distant endpoint', () => {
    expect(farthestCloseness(['focus', 'near'])).toBe('near')
    expect(farthestCloseness(['near', 'extended'])).toBe('extended')
    expect(farthestCloseness(['extended', 'remote'])).toBe('remote')
    expect(farthestCloseness(['near', 'none'])).toBe('none')
  })
})
