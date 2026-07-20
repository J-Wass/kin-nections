import { describe, expect, it } from 'vitest'
import { addPerson, addSpouse, setParents } from '../model/treeOps'
import { createEmptyTree } from '../model/types'
import {
  explorationPersonIds,
  immediateFamilyIds,
  projectTreeForPeople,
} from './focusExplore'

function familyTree() {
  let tree = createEmptyTree('focus-tree', 'Focus tree')
  for (const id of [
    'grandparent',
    'parentA',
    'parentB',
    'focus',
    'sibling',
    'spouse',
    'child',
    'grandchild',
    'unrelated',
  ]) {
    tree = addPerson(tree, { id }).tree
  }
  tree = setParents(tree, 'parentA', ['grandparent'])
  tree = setParents(tree, 'focus', ['parentA', 'parentB'])
  tree = setParents(tree, 'sibling', ['parentA', 'parentB'])
  tree = addSpouse(tree, 'focus', 'spouse').tree
  tree = setParents(tree, 'child', ['focus', 'spouse'])
  tree = setParents(tree, 'grandchild', ['child'])
  return tree
}

describe('focus exploration', () => {
  it('starts with only parents, siblings, spouses, and children', () => {
    const tree = familyTree()

    expect([...immediateFamilyIds(tree, 'focus')].sort()).toEqual([
      'child',
      'focus',
      'parentA',
      'parentB',
      'sibling',
      'spouse',
    ])
  })

  it('reveals one additional family neighborhood per expanded person', () => {
    const tree = familyTree()

    expect([...explorationPersonIds(tree, 'focus', ['focus'])]).not.toContain('grandchild')
    expect([...explorationPersonIds(tree, 'focus', ['focus', 'child'])]).toContain('grandchild')
  })

  it('projects only meaningful visible family relationships', () => {
    const tree = familyTree()
    const projected = projectTreeForPeople(
      tree,
      explorationPersonIds(tree, 'focus', ['focus']),
    )

    expect(Object.keys(projected.people).sort()).toEqual([
      'child',
      'focus',
      'parentA',
      'parentB',
      'sibling',
      'spouse',
    ])
    expect(
      Object.values(projected.families).every(
        (family) =>
          family.partners.every((partner) => projected.people[partner.personId]) &&
          family.children.every((childId) => projected.people[childId]),
      ),
    ).toBe(true)
  })
})
