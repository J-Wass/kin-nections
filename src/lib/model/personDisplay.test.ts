import { describe, expect, it } from 'vitest'
import { formatPersonName } from './personDisplay'
import { createPerson } from './types'

describe('formatPersonName', () => {
  it('formats named, unnamed, and placeholder people consistently', () => {
    expect(formatPersonName(createPerson({ id: 'named', firstName: 'Ada', lastName: 'Lovelace' }))).toBe('Ada Lovelace')
    expect(formatPersonName(createPerson({ id: 'unnamed' }))).toBe('Unnamed')
    expect(formatPersonName(createPerson({ id: 'placeholder', isPlaceholder: true }))).toBe('Unknown')
  })
})
