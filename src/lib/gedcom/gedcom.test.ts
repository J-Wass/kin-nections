import { describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import { addPerson, addSpouse, markDivorced, setParents, updatePerson } from '../model/treeOps'
import { parseGedcom } from './parse'
import { serializeGedcom } from './serialize'

describe('GEDCOM round-trip', () => {
  it('preserves people, names, dates, notes, and family structure through serialize -> parse', () => {
    let tree = createEmptyTree('t', 'My Family')
    tree = addPerson(tree, { id: 'dad', firstName: 'John', lastName: 'Smith', sex: 'M' }).tree
    tree = addPerson(tree, {
      id: 'mom',
      firstName: 'Jane',
      lastName: 'Smith',
      sex: 'F',
      birthDate: '1 JAN 1960',
      birthPlace: 'Boston',
      notes: 'Loved gardening.\nSecond line of notes.',
    }).tree
    tree = addPerson(tree, {
      id: 'kid',
      firstName: 'Sam',
      lastName: 'Smith',
      sex: 'unknown',
      deathDate: '5 MAY 2020',
      isLiving: false,
    }).tree
    tree = setParents(tree, 'kid', ['dad', 'mom'])
    tree = addSpouse(tree, 'dad', 'mom').tree

    const gedcom = serializeGedcom(tree)
    const reparsed = parseGedcom(gedcom)

    expect(reparsed.people.dad).toMatchObject({ firstName: 'John', lastName: 'Smith', sex: 'M' })
    expect(reparsed.people.mom).toMatchObject({
      firstName: 'Jane',
      lastName: 'Smith',
      sex: 'F',
      birthDate: '1 JAN 1960',
      birthPlace: 'Boston',
      notes: 'Loved gardening.\nSecond line of notes.',
    })
    expect(reparsed.people.kid).toMatchObject({ deathDate: '5 MAY 2020', isLiving: false })

    const family = Object.values(reparsed.families).find((f) => f.children.includes('kid'))
    expect(family?.partners.map((p) => p.personId).sort()).toEqual(['dad', 'mom'])
  })

  it('marks a family divorced and round-trips the status', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addSpouse(tree, 'a', 'b').tree
    tree = markDivorced(tree, 'a', 'b')

    const reparsed = parseGedcom(serializeGedcom(tree))
    expect(Object.values(reparsed.families)[0].status).toBe('divorced')
  })

  it('round-trips a person with a nickname', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'a', firstName: 'Robert', lastName: 'Jones' }).tree
    tree = updatePerson(tree, 'a', { nickname: 'Bob' })

    const reparsed = parseGedcom(serializeGedcom(tree))
    expect(reparsed.people.a.nickname).toBe('Bob')
  })
})

describe('parseGedcom on hand-written input', () => {
  const sample = [
    '0 HEAD',
    '1 SOUR Ancestry',
    '0 @I1@ INDI',
    '1 NAME Mary /Johnson/',
    '1 SEX F',
    '1 BIRT',
    '2 DATE 3 MAR 1940',
    '2 PLAC Chicago, IL',
    '1 FAMS @F1@',
    '0 @I2@ INDI',
    '1 NAME Tom /Johnson/',
    '1 SEX M',
    '1 FAMS @F1@',
    '0 @I3@ INDI',
    '1 NAME Alice /Johnson/',
    '1 SEX F',
    '1 FAMC @F1@',
    '0 @F1@ FAM',
    '1 HUSB @I2@',
    '1 WIFE @I1@',
    '1 CHIL @I3@',
    '1 MARR',
    '2 DATE 10 JUN 1962',
    '0 TRLR',
  ].join('\n')

  it('parses individuals with names, sex, and birth info', () => {
    const tree = parseGedcom(sample)
    expect(tree.people.I1).toMatchObject({
      firstName: 'Mary',
      lastName: 'Johnson',
      sex: 'F',
      birthDate: '3 MAR 1940',
      birthPlace: 'Chicago, IL',
    })
  })

  it('parses family structure with husband, wife, and child', () => {
    const tree = parseGedcom(sample)
    const family = tree.families.F1
    expect(family.partners.map((p) => p.personId).sort()).toEqual(['I1', 'I2'])
    expect(family.children).toEqual(['I3'])
    expect(family.status).toBe('married')
  })
})
