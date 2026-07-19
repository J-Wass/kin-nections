import { describe, expect, it } from 'vitest'
import { addPerson, addSpouse, setParents } from '../model/treeOps'
import { createEmptyTree } from '../model/types'
import { computeLineagePath, parentChildLinkKey } from './lineagePath'

describe('computeLineagePath', () => {
  it('includes two generations in each direction without including siblings or spouses', () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['greatGrandparent', 'grandparent', 'parent', 'selected', 'sibling', 'spouse', 'child', 'grandchild', 'greatGrandchild']) {
      tree = addPerson(tree, { id }).tree
    }
    tree = setParents(tree, 'grandparent', ['greatGrandparent'])
    tree = setParents(tree, 'parent', ['grandparent'])
    tree = setParents(tree, 'selected', ['parent'])
    tree = setParents(tree, 'sibling', ['parent'])
    tree = addSpouse(tree, 'selected', 'spouse').tree
    tree = setParents(tree, 'child', ['selected', 'spouse'])
    tree = setParents(tree, 'grandchild', ['child'])
    tree = setParents(tree, 'greatGrandchild', ['grandchild'])

    const path = computeLineagePath(tree, 'selected')

    expect([...path.personIds].sort()).toEqual(['child', 'grandchild', 'grandparent', 'parent', 'selected'])
    expect(path.parentChildLinks).toEqual(new Set([
      parentChildLinkKey('parent', 'selected'),
      parentChildLinkKey('grandparent', 'parent'),
      parentChildLinkKey('selected', 'child'),
      parentChildLinkKey('child', 'grandchild'),
    ]))
  })

  it('returns an empty path for a missing person', () => {
    const path = computeLineagePath(createEmptyTree('tree', 'Tree'), 'missing')
    expect(path.personIds.size).toBe(0)
    expect(path.parentChildLinks.size).toBe(0)
  })
})
