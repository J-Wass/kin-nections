import { describe, expect, it } from 'vitest'
import { addPerson, setParents } from './treeOps'
import { createEmptyTree } from './types'
import { validateTree } from './validateTree'

describe('validateTree', () => {
  it('accepts a valid tree', () => {
    let tree = createEmptyTree('tree', 'Tree')
    tree = addPerson(tree, { id: 'parent' }).tree
    tree = addPerson(tree, { id: 'child' }).tree
    tree = setParents(tree, 'child', ['parent'])
    expect(validateTree(tree)).toBe(tree)
  })

  it('rejects malformed and dangling family data', () => {
    expect(() => validateTree({
      id: 'tree',
      name: 'Tree',
      createdAt: '',
      updatedAt: '',
      families: {},
    })).toThrow(/people/)

    const tree = createEmptyTree('tree', 'Tree')
    tree.families.family = {
      id: 'family',
      status: 'unknown',
      partners: [{ personId: 'missing', role: 'spouse' }],
      children: [],
    }
    expect(() => validateTree(tree)).toThrow(/missing person/)
  })

  it('rejects ancestry cycles', () => {
    let tree = createEmptyTree('tree', 'Tree')
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree.families.familyA = {
      id: 'familyA', status: 'unknown', partners: [{ personId: 'a', role: 'spouse' }], children: ['b'],
    }
    tree.families.familyB = {
      id: 'familyB', status: 'unknown', partners: [{ personId: 'b', role: 'spouse' }], children: ['a'],
    }
    expect(() => validateTree(tree)).toThrow(/cycle/)
  })
})
