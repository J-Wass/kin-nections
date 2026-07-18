import { describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import { addPerson, addSibling, addSpouse, markDivorced, setParents } from '../model/treeOps'
import { describeAllRelationships, describeRelationship } from './kinship'

function person(tree: ReturnType<typeof createEmptyTree>, id: string) {
  return addPerson(tree, { id }).tree
}

describe('describeRelationship', () => {
  it('labels self', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    expect(describeRelationship(tree, 'a', 'a').label).toBe('Self')
  })

  it('labels parent and child', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'mom')
    tree = person(tree, 'kid')
    tree = setParents(tree, 'kid', ['mom'])

    expect(describeRelationship(tree, 'kid', 'mom').label).toBe('Parent')
    expect(describeRelationship(tree, 'mom', 'kid').label).toBe('Child')
  })

  it('labels grandparent and grandchild', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp', 'parent', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'parent', ['gp'])
    tree = setParents(tree, 'kid', ['parent'])

    expect(describeRelationship(tree, 'kid', 'gp').label).toBe('Grandparent')
    expect(describeRelationship(tree, 'gp', 'kid').label).toBe('Grandchild')
  })

  it('labels great-grandparent for three generations up', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gg', 'gp', 'parent', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'gp', ['gg'])
    tree = setParents(tree, 'parent', ['gp'])
    tree = setParents(tree, 'kid', ['parent'])

    expect(describeRelationship(tree, 'kid', 'gg').label).toBe('Great-grandparent')
  })

  it('labels full siblings sharing both parents', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'dad', 'a', 'b']) tree = person(tree, id)
    tree = setParents(tree, 'a', ['mom', 'dad'])
    tree = setParents(tree, 'b', ['mom', 'dad'])

    expect(describeRelationship(tree, 'a', 'b').label).toBe('Sibling')
  })

  it('labels half-siblings sharing exactly one parent', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'dad1', 'dad2', 'a', 'b']) tree = person(tree, id)
    tree = setParents(tree, 'a', ['mom', 'dad1'])
    tree = setParents(tree, 'b', ['mom', 'dad2'])

    expect(describeRelationship(tree, 'a', 'b').label).toBe('Half-sibling')
  })

  it('labels siblings with unknown parents via addSibling', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    tree = addSibling(tree, 'a', 'b')
    expect(describeRelationship(tree, 'a', 'b').label).toBe('Sibling')
  })

  it('labels aunt/uncle and niece/nephew', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'parent', 'aunt', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'parent', ['gp1', 'gp2'])
    tree = setParents(tree, 'aunt', ['gp1', 'gp2'])
    tree = setParents(tree, 'kid', ['parent'])

    expect(describeRelationship(tree, 'kid', 'aunt').label).toBe('Aunt/Uncle')
    expect(describeRelationship(tree, 'aunt', 'kid').label).toBe('Niece/Nephew')
  })

  it('labels first cousins', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'parentA', 'parentB', 'kidA', 'kidB']) tree = person(tree, id)
    tree = setParents(tree, 'parentA', ['gp1', 'gp2'])
    tree = setParents(tree, 'parentB', ['gp1', 'gp2'])
    tree = setParents(tree, 'kidA', ['parentA'])
    tree = setParents(tree, 'kidB', ['parentB'])

    expect(describeRelationship(tree, 'kidA', 'kidB').label).toBe('First cousin')
  })

  it('labels first cousins once removed', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'parentA', 'parentB', 'kidA', 'kidB', 'grandkidB']) tree = person(tree, id)
    tree = setParents(tree, 'parentA', ['gp1', 'gp2'])
    tree = setParents(tree, 'parentB', ['gp1', 'gp2'])
    tree = setParents(tree, 'kidA', ['parentA'])
    tree = setParents(tree, 'kidB', ['parentB'])
    tree = setParents(tree, 'grandkidB', ['kidB'])

    expect(describeRelationship(tree, 'kidA', 'grandkidB').label).toBe('First cousin, 1 time removed')
  })

  it('labels spouse and ex-spouse', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    tree = addSpouse(tree, 'a', 'b').tree

    expect(describeRelationship(tree, 'a', 'b').label).toBe('Spouse')
    tree = markDivorced(tree, 'a', 'b')
    expect(describeRelationship(tree, 'a', 'b').label).toBe('Ex-spouse')
  })

  it('labels step-parent and step-child', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'kid', 'stepdad']) tree = person(tree, id)
    tree = setParents(tree, 'kid', ['mom'])
    tree = addSpouse(tree, 'mom', 'stepdad').tree

    expect(describeRelationship(tree, 'kid', 'stepdad').label).toBe('Step-parent')
    expect(describeRelationship(tree, 'stepdad', 'kid').label).toBe('Step-child')
  })

  it('labels in-laws via a spouse of a blood relative', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'dad', 'a', 'b', 'bSpouse']) tree = person(tree, id)
    tree = setParents(tree, 'a', ['mom', 'dad'])
    tree = setParents(tree, 'b', ['mom', 'dad'])
    tree = addSpouse(tree, 'b', 'bSpouse').tree

    expect(describeRelationship(tree, 'a', 'bSpouse').label).toBe('Sibling-in-law')
    expect(describeRelationship(tree, 'bSpouse', 'a').label).toBe('Sibling-in-law')
  })

  it('returns "No known relation" for disconnected people', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    expect(describeRelationship(tree, 'a', 'b').label).toBe('No known relation')
  })
})

describe('describeAllRelationships', () => {
  it('computes a relationship for every other person in the tree', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'dad', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'kid', ['mom', 'dad'])

    const all = describeAllRelationships(tree, 'kid')
    expect(Object.keys(all).sort()).toEqual(['dad', 'mom'])
    expect(all.mom.label).toBe('Parent')
    expect(all.dad.label).toBe('Parent')
  })
})
