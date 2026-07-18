import { describe, expect, it } from 'vitest'
import { createEmptyTree } from './types'
import {
  addChildToFamily,
  addPerson,
  addSibling,
  addSpouse,
  createFamily,
  getChildrenOf,
  getParentsOf,
  getSiblingsOf,
  getSpousesOf,
  markDivorced,
  removeChildFromFamily,
  removeFamily,
  removePerson,
  setParents,
  updatePerson,
} from './treeOps'

function seedTree() {
  return createEmptyTree('tree1', 'Test Tree')
}

describe('person CRUD', () => {
  it('adds a person with sensible defaults', () => {
    const { tree, person } = addPerson(seedTree(), { firstName: 'Ada', lastName: 'Lovelace' })
    expect(tree.people[person.id]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', sex: 'unknown', notes: '' })
  })

  it('updates a person by id', () => {
    const { tree, person } = addPerson(seedTree(), { firstName: 'Ada' })
    const next = updatePerson(tree, person.id, { firstName: 'Augusta' })
    expect(next.people[person.id].firstName).toBe('Augusta')
    expect(tree.people[person.id].firstName).toBe('Ada') // original untouched
  })

  it('throws when updating a nonexistent person', () => {
    expect(() => updatePerson(seedTree(), 'nope', { firstName: 'X' })).toThrow()
  })
})

describe('removePerson cascade', () => {
  it('removes the person from families and drops empty families', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'p1', firstName: 'Parent1' }).tree
    tree = addPerson(tree, { id: 'p2', firstName: 'Parent2' }).tree
    tree = addPerson(tree, { id: 'c1', firstName: 'Child1' }).tree
    tree = setParents(tree, 'c1', ['p1', 'p2'])

    const afterRemovingChild = removePerson(tree, 'c1')
    const family = Object.values(afterRemovingChild.families)[0]
    expect(family.children).toEqual([])
    expect(family.partners.map((p) => p.personId).sort()).toEqual(['p1', 'p2'])
  })

  it('deletes a family entirely once it has no partners and no children left', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'p1' }).tree
    tree = addPerson(tree, { id: 'p2' }).tree
    tree = addSpouse(tree, 'p1', 'p2').tree

    let next = removePerson(tree, 'p1')
    next = removePerson(next, 'p2')
    expect(Object.keys(next.families)).toHaveLength(0)
  })
})

describe('family relationships', () => {
  it('setParents creates a shared family for two parents and one child', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'mom' }).tree
    tree = addPerson(tree, { id: 'dad' }).tree
    tree = addPerson(tree, { id: 'kid' }).tree
    tree = setParents(tree, 'kid', ['mom', 'dad'])

    expect(getParentsOf(tree, 'kid').map((p) => p.id).sort()).toEqual(['dad', 'mom'])
    expect(getChildrenOf(tree, 'mom').map((p) => p.id)).toEqual(['kid'])
  })

  it('setParents reuses an existing family for a second child of the same parents', () => {
    let tree = seedTree()
    for (const id of ['mom', 'dad', 'kid1', 'kid2']) tree = addPerson(tree, { id }).tree
    tree = setParents(tree, 'kid1', ['mom', 'dad'])
    tree = setParents(tree, 'kid2', ['mom', 'dad'])

    expect(Object.keys(tree.families)).toHaveLength(1)
    expect(getSiblingsOf(tree, 'kid1').map((p) => p.id)).toEqual(['kid2'])
  })

  it('supports a single known parent', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'mom' }).tree
    tree = addPerson(tree, { id: 'kid' }).tree
    tree = setParents(tree, 'kid', ['mom'])
    expect(getParentsOf(tree, 'kid').map((p) => p.id)).toEqual(['mom'])
  })

  it('addSpouse creates a married family and markDivorced flips it to divorced', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addSpouse(tree, 'a', 'b').tree

    expect(getSpousesOf(tree, 'a')).toMatchObject([{ status: 'married' }])

    tree = markDivorced(tree, 'a', 'b')
    expect(getSpousesOf(tree, 'a')).toMatchObject([{ status: 'divorced' }])
  })

  it('addSpouse is idempotent for the same pair (reuses the family)', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addSpouse(tree, 'a', 'b').tree
    tree = addSpouse(tree, 'a', 'b', 'partnered').tree
    expect(Object.keys(tree.families)).toHaveLength(1)
    expect(Object.values(tree.families)[0].status).toBe('partnered')
  })

  it('addSibling creates a parents-unknown family when neither sibling has one', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'a' }).tree
    tree = addPerson(tree, { id: 'b' }).tree
    tree = addSibling(tree, 'a', 'b')

    expect(getSiblingsOf(tree, 'a').map((p) => p.id)).toEqual(['b'])
    const family = Object.values(tree.families)[0]
    expect(family.partners).toEqual([])
  })

  it('addSibling reuses an existing family if one sibling already has parents', () => {
    let tree = seedTree()
    for (const id of ['mom', 'dad', 'kid1', 'kid2']) tree = addPerson(tree, { id }).tree
    tree = setParents(tree, 'kid1', ['mom', 'dad'])
    tree = addSibling(tree, 'kid1', 'kid2')

    expect(Object.keys(tree.families)).toHaveLength(1)
    expect(getParentsOf(tree, 'kid2').map((p) => p.id).sort()).toEqual(['dad', 'mom'])
  })

  it('addChildToFamily / removeChildFromFamily manage membership without duplicates', () => {
    let tree = seedTree()
    tree = addPerson(tree, { id: 'kid' }).tree
    const { tree: withFamily, family } = createFamily(tree, {})
    tree = withFamily
    tree = addChildToFamily(tree, family.id, 'kid')
    tree = addChildToFamily(tree, family.id, 'kid') // duplicate add is a no-op
    expect(tree.families[family.id].children).toEqual(['kid'])

    tree = removeChildFromFamily(tree, family.id, 'kid')
    expect(tree.families[family.id].children).toEqual([])
  })

  it('removeFamily deletes the family record', () => {
    const { tree, family } = createFamily(seedTree(), {})
    const next = removeFamily(tree, family.id)
    expect(next.families[family.id]).toBeUndefined()
  })
})
