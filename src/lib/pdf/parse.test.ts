import { describe, expect, it } from 'vitest'
import { getChildrenOf, getParentsOf, getSiblingsOf, getSpousesOf } from '../model/treeOps'
import { inferDepths, parseRegisterReport, type DepthLine } from './parse'

function byName(tree: ReturnType<typeof parseRegisterReport>, firstName: string, lastName = '') {
  return Object.values(tree.people).find((p) => p.firstName === firstName && (!lastName || p.lastName === lastName))
}

describe('inferDepths', () => {
  it('clusters distinct x-offsets into ordered depth levels', () => {
    const lines = [
      { text: 'root', x: 10 },
      { text: 'child', x: 40 },
      { text: 'grandchild', x: 70 },
    ]
    const result = inferDepths(lines)
    expect(result.map((l) => l.depth)).toEqual([0, 1, 2])
  })

  it('tolerates small positioning noise within the same visual column', () => {
    const lines = [
      { text: 'a', x: 10 },
      { text: 'b', x: 11 }, // 1pt off from 'a', same column
      { text: 'c', x: 40 },
      { text: 'd', x: 42 }, // 2pt off from 'c', same column
    ]
    const result = inferDepths(lines, 3)
    expect(result.map((l) => l.depth)).toEqual([0, 0, 1, 1])
  })
})

describe('parseRegisterReport', () => {
  it('parses a root couple, a married child with a spouse, and grandchildren siblings', () => {
    const lines: DepthLine[] = [
      { text: 'Abraham Miller', depth: 0 },
      { text: '& Sarah Cohen', depth: 0 },
      { text: 'b. 1900, Warsaw', depth: 0 },
      { text: 'm. 1920', depth: 0 },
      { text: 'Isaac Miller', depth: 1 },
      { text: 'b. 1921', depth: 1 },
      { text: 'd. 1990', depth: 1 },
      { text: '& Rebecca Stone', depth: 1 },
      { text: 'b. 1923', depth: 1 },
      { text: 'm. 1945', depth: 1 },
      { text: 'Jacob Miller', depth: 2 },
      { text: 'b. 1950', depth: 2 },
      { text: 'Leah Miller', depth: 2 },
      { text: 'b. 1953', depth: 2 },
    ]

    const tree = parseRegisterReport(lines, 'Test import')

    const abraham = byName(tree, 'Abraham', 'Miller')!
    const sarah = byName(tree, 'Sarah', 'Cohen')!
    const isaac = byName(tree, 'Isaac', 'Miller')!
    const rebecca = byName(tree, 'Rebecca', 'Stone')!
    const jacob = byName(tree, 'Jacob', 'Miller')!
    const leah = byName(tree, 'Leah', 'Miller')!

    expect(sarah.birthDate).toBe('1900')
    expect(sarah.birthPlace).toBe('Warsaw')
    expect(isaac.birthDate).toBe('1921')
    expect(isaac.deathDate).toBe('1990')
    expect(isaac.isLiving).toBe(false)

    expect(getSpousesOf(tree, abraham.id).map((s) => s.person.id)).toEqual([sarah.id])
    expect(getSpousesOf(tree, abraham.id)[0].status).toBe('married')

    expect(getParentsOf(tree, isaac.id).map((p) => p.id).sort()).toEqual([abraham.id, sarah.id].sort())
    expect(getParentsOf(tree, jacob.id).map((p) => p.id).sort()).toEqual([isaac.id, rebecca.id].sort())
    expect(getSiblingsOf(tree, jacob.id).map((p) => p.id)).toEqual([leah.id])
    expect(getChildrenOf(tree, isaac.id).map((p) => p.id).sort()).toEqual([jacob.id, leah.id].sort())
  })

  it('pops back to the correct ancestor after a deep branch, for a second child of the root couple', () => {
    const lines: DepthLine[] = [
      { text: 'Abraham Miller', depth: 0 },
      { text: '& Sarah Cohen', depth: 0 },
      { text: 'Isaac Miller', depth: 1 },
      { text: '& Rebecca Stone', depth: 1 },
      { text: 'Jacob Miller', depth: 2 },
      { text: '& Nora Fields', depth: 2 },
      { text: 'm. ?', depth: 2 },
      { text: 'Emma Miller', depth: 3 },
      { text: 'Ruth Miller', depth: 1 }, // second child of Abraham & Sarah
    ]

    const tree = parseRegisterReport(lines)
    const abraham = byName(tree, 'Abraham', 'Miller')!
    const sarah = byName(tree, 'Sarah', 'Cohen')!
    const isaac = byName(tree, 'Isaac', 'Miller')!
    const ruth = byName(tree, 'Ruth', 'Miller')!
    const jacob = byName(tree, 'Jacob', 'Miller')!
    const nora = byName(tree, 'Nora', 'Fields')!

    expect(getParentsOf(tree, ruth.id).map((p) => p.id).sort()).toEqual([abraham.id, sarah.id].sort())
    expect(getSiblingsOf(tree, ruth.id).map((p) => p.id)).toEqual([isaac.id])
    expect(getSpousesOf(tree, jacob.id).map((s) => s.person.id)).toEqual([nora.id])
    expect(getSpousesOf(tree, jacob.id)[0].status).toBe('unknown')
  })

  it('supports a single parent with no listed spouse', () => {
    const lines: DepthLine[] = [
      { text: 'Abraham Miller', depth: 0 },
      { text: 'Isaac Miller', depth: 1 },
    ]
    const tree = parseRegisterReport(lines)
    const abraham = byName(tree, 'Abraham', 'Miller')!
    const isaac = byName(tree, 'Isaac', 'Miller')!
    expect(getParentsOf(tree, isaac.id).map((p) => p.id)).toEqual([abraham.id])
  })

  it('does not deduplicate a name repeated across separate top-level entries', () => {
    const lines: DepthLine[] = [
      { text: 'Isaac Miller', depth: 0 },
      { text: 'b. 1850', depth: 0 },
      { text: '& Sarah Cohen', depth: 0 },
      { text: 'Isaac Miller', depth: 0 },
      { text: 'b. 1850', depth: 0 },
      { text: '& Ruth Katz', depth: 0 },
    ]
    const tree = parseRegisterReport(lines)
    const isaacs = Object.values(tree.people).filter((p) => p.firstName === 'Isaac' && p.lastName === 'Miller')
    expect(isaacs).toHaveLength(2)
  })

  it('splits multi-word first names using last-word-as-surname', () => {
    const lines: DepthLine[] = [{ text: 'Ilene Dawn Feitlowitz', depth: 0 }]
    const tree = parseRegisterReport(lines)
    const person = Object.values(tree.people)[0]
    expect(person.firstName).toBe('Ilene Dawn')
    expect(person.lastName).toBe('Feitlowitz')
  })

  it('handles birthplace-only ("bp.") and deathplace-only ("dp.") lines', () => {
    const lines: DepthLine[] = [
      { text: 'Isaac Fajtlowicz', depth: 0 },
      { text: 'bp. Odessa', depth: 0 },
      { text: '& Zina Liter', depth: 0 },
      { text: 'dp. Brazil', depth: 0 },
    ]
    const tree = parseRegisterReport(lines)
    const isaac = byName(tree, 'Isaac', 'Fajtlowicz')!
    const zina = byName(tree, 'Zina', 'Liter')!
    expect(isaac.birthPlace).toBe('Odessa')
    expect(zina.isLiving).toBe(false)
    expect(zina.notes).toContain('Brazil')
  })

  it('captures a death place from a "d." line into notes since the model has no dedicated field', () => {
    const lines: DepthLine[] = [{ text: 'Moritz Wasserman', depth: 0 }, { text: 'd. 5 Oct 1937, Phoebus, VA', depth: 0 }]
    const tree = parseRegisterReport(lines)
    const person = Object.values(tree.people)[0]
    expect(person.deathDate).toBe('5 Oct 1937')
    expect(person.notes).toContain('Phoebus, VA')
  })
})
