import { describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import { addPerson, addSibling, addSpouse, getParentsOf, getSiblingsOf, getSpousesOf, markDivorced, setParents } from '../model/treeOps'
import { parseCsvTree } from './parse'
import { serializeCsv } from './serialize'
import { parseCsv, toCsvRow } from './csvUtil'

describe('csvUtil', () => {
  it('escapes and parses fields with commas, quotes, and newlines', () => {
    const row = toCsvRow(['plain', 'has,comma', 'has "quote"', 'multi\nline'])
    const parsed = parseCsv(row)
    expect(parsed).toEqual([['plain', 'has,comma', 'has "quote"', 'multi\nline']])
  })

  it('parses multiple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('CSV round-trip', () => {
  it('preserves basic person fields and parent/child links', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, {
      id: 'mom',
      firstName: 'Jane',
      lastName: 'Doe',
      sex: 'F',
      notes: 'Line one\nLine two',
    }).tree
    tree = addPerson(tree, { id: 'dad', firstName: 'John', lastName: 'Doe', sex: 'M' }).tree
    tree = addPerson(tree, { id: 'kid', firstName: 'Sam', lastName: 'Doe' }).tree
    tree = setParents(tree, 'kid', ['mom', 'dad'])

    const csv = serializeCsv(tree)
    const reparsed = parseCsvTree(csv)

    expect(reparsed.people.mom).toMatchObject({ firstName: 'Jane', lastName: 'Doe', notes: 'Line one\nLine two' })
    expect(getParentsOf(reparsed, 'kid').map((p) => p.id).sort()).toEqual(['dad', 'mom'])
  })

  it('preserves spouse and ex-spouse relationships', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addPerson(tree, { id: 'c' }).tree
    tree = addSpouse(tree, 'a', 'b').tree
    tree = addSpouse(tree, 'a', 'c').tree
    tree = markDivorced(tree, 'a', 'c')

    const reparsed = parseCsvTree(serializeCsv(tree))
    const spouses = getSpousesOf(reparsed, 'a')
    expect(spouses.find((s) => s.person.id === 'b')?.status).toBe('married')
    expect(spouses.find((s) => s.person.id === 'c')?.status).toBe('divorced')
  })

  it('preserves a parents-unknown sibling group via siblingGroupId', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addSibling(tree, 'a', 'b')

    const reparsed = parseCsvTree(serializeCsv(tree))
    expect(getSiblingsOf(reparsed, 'a').map((p) => p.id)).toEqual(['b'])
  })

  it('round-trips a single known parent', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'mom' }).tree
    tree = addPerson(tree, { id: 'kid' }).tree
    tree = setParents(tree, 'kid', ['mom'])

    const reparsed = parseCsvTree(serializeCsv(tree))
    expect(getParentsOf(reparsed, 'kid').map((p) => p.id)).toEqual(['mom'])
  })
})
