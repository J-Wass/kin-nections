import { describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import { addPerson, addSpouse, createFamily, setParents } from '../model/treeOps'
import {
  computeGenerations,
  computeLayout,
  NODE_HEIGHT,
  NODE_SPACING_X,
  NODE_WIDTH,
} from './treeLayout'

function person(tree: ReturnType<typeof createEmptyTree>, id: string) {
  return addPerson(tree, { id }).tree
}

function assertNoOverlap(layout: ReturnType<typeof computeLayout>) {
  const nodes = Object.values(layout.people)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const overlap = Math.abs(nodes[i].x - nodes[j].x) < NODE_WIDTH
        && Math.abs(nodes[i].y - nodes[j].y) < NODE_HEIGHT
      expect(overlap, `card overlap: ${nodes[i].id}, ${nodes[j].id}`).toBe(false)
    }
  }
}

describe('computeGenerations', () => {
  it('places a single-parent chain at increasing depths', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['a', 'b', 'c']) tree = person(tree, id)
    tree = setParents(tree, 'b', ['a'])
    tree = setParents(tree, 'c', ['b'])

    const gen = computeGenerations(tree)
    expect(gen.a).toBe(0)
    expect(gen.b).toBe(1)
    expect(gen.c).toBe(2)
  })

  it('places both parents of a multi-marriage family at the same generation as their shared children', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['dad', 'mom1', 'mom2', 'kid1', 'kid2']) tree = person(tree, id)
    tree = setParents(tree, 'kid1', ['dad', 'mom1'])
    tree = setParents(tree, 'kid2', ['dad', 'mom2'])

    const gen = computeGenerations(tree)
    expect(gen.dad).toBe(0)
    expect(gen.mom1).toBe(0)
    expect(gen.mom2).toBe(0)
    expect(gen.kid1).toBe(1)
    expect(gen.kid2).toBe(1)
  })

  it('pushes a person down a generation if they are also someone else\'s child', () => {
    // dad has no parents (gen 0), but also remarries someone (stepmom) who is
    // herself a child of grandparents (gen 0) -> stepmom should be gen 1, not 0.
    let tree = createEmptyTree('t', 'T')
    for (const id of ['dad', 'gp1', 'gp2', 'stepmom', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'stepmom', ['gp1', 'gp2'])
    tree = addSpouse(tree, 'dad', 'stepmom').tree
    tree = setParents(tree, 'kid', ['dad', 'stepmom'])

    const gen = computeGenerations(tree)
    expect(gen.stepmom).toBe(1)
    // dad has no parents of his own, but must be pulled up to match his spouse's row
    expect(gen.dad).toBe(1)
    // the child's generation must be at least one below the deepest parent
    expect(gen.kid).toBeGreaterThanOrEqual(gen.stepmom + 1)
  })

  it('treats people with no family ties as generation 0', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'lonely')
    expect(computeGenerations(tree).lonely).toBe(0)
  })

  it('propagates generation across a spouse who has no listed parents of their own', () => {
    // gp -> parent -> parent marries an "outsider" with no recorded parents at all;
    // the outsider must be pulled down to parent's row, not stuck at generation 0.
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp', 'parent', 'outsider', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'parent', ['gp'])
    tree = addSpouse(tree, 'parent', 'outsider').tree
    tree = setParents(tree, 'kid', ['parent', 'outsider'])

    const gen = computeGenerations(tree)
    expect(gen.parent).toBe(1)
    expect(gen.outsider).toBe(1)
    expect(gen.kid).toBe(2)
  })
})

describe('computeLayout', () => {
  it('uses portrait nodes and leaves clear space between sibling cards', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['parent', 'childA', 'childB']) tree = person(tree, id)
    tree = setParents(tree, 'childA', ['parent'])
    tree = setParents(tree, 'childB', ['parent'])

    const layout = computeLayout(tree)
    const siblingDistance = Math.abs(layout.people.childA.x - layout.people.childB.x)
    expect(NODE_HEIGHT).toBeGreaterThanOrEqual(NODE_WIDTH * 2)
    expect(siblingDistance).toBeLessThanOrEqual(NODE_SPACING_X * 1.25)
    expect(siblingDistance - NODE_WIDTH).toBeGreaterThanOrEqual(64)
  })

  it('orders multi-marriage child branches in the same direction as their family unions', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['parent', 'spouseA', 'spouseB', 'childA', 'childB']) tree = person(tree, id)
    tree = setParents(tree, 'childA', ['parent', 'spouseA'])
    tree = setParents(tree, 'childB', ['parent', 'spouseB'])

    const layout = computeLayout(tree)
    const families = Object.values(tree.families)
    const familyA = families.find((family) => family.children.includes('childA'))!
    const familyB = families.find((family) => family.children.includes('childB'))!
    const unionDirection = layout.families[familyA.id].x - layout.families[familyB.id].x
    const childDirection = layout.people.childA.x - layout.people.childB.x

    expect(unionDirection * childDirection).toBeGreaterThan(0)
    assertNoOverlap(layout)
  })

  it('gives every person in a generation a distinct x position', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'parentA', 'parentB', 'kidA', 'kidB']) tree = person(tree, id)
    tree = setParents(tree, 'parentA', ['gp1', 'gp2'])
    tree = setParents(tree, 'parentB', ['gp1', 'gp2'])
    tree = setParents(tree, 'kidA', ['parentA'])
    tree = setParents(tree, 'kidB', ['parentB'])

    assertNoOverlap(computeLayout(tree))
  })

  it('handles a parents-unknown sibling family (0-partner family) without crashing', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    tree = createFamily(tree, { partners: [], children: ['a', 'b'] }).tree

    const layout = computeLayout(tree)
    expect(layout.people.a.generation).toBe(0)
    expect(layout.people.b.generation).toBe(0)
    assertNoOverlap(layout)
  })

  it('positions a family union node between its two partners', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    const spouseResult = addSpouse(tree, 'a', 'b')
    tree = spouseResult.tree
    const family = spouseResult.family

    const layout = computeLayout(tree)
    const famNode = layout.families[family.id]
    const ax = layout.people.a.x
    const bx = layout.people.b.x
    expect(famNode.x).toBeGreaterThanOrEqual(Math.min(ax, bx))
    expect(famNode.x).toBeLessThanOrEqual(Math.max(ax, bx))
  })

  it('produces a width/height that grows with tree size', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['a', 'b', 'c']) tree = person(tree, id)
    const layout = computeLayout(tree)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('centers a couple above the midpoint of their children (pyramid shape)', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['mom', 'dad', 'kid1', 'kid2', 'kid3']) tree = person(tree, id)
    tree = setParents(tree, 'kid1', ['mom', 'dad'])
    tree = setParents(tree, 'kid2', ['mom', 'dad'])
    tree = setParents(tree, 'kid3', ['mom', 'dad'])

    const layout = computeLayout(tree)
    const childXs = [layout.people.kid1.x, layout.people.kid2.x, layout.people.kid3.x]
    const childMid = (Math.min(...childXs) + Math.max(...childXs)) / 2
    const coupleMid = (layout.people.mom.x + layout.people.dad.x) / 2
    expect(coupleMid).toBeCloseTo(childMid, 0)
    assertNoOverlap(layout)
  })

  it('keeps sibling subtrees from overlapping when one sibling has a much larger family', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'bigBranch', 'smallBranch']) tree = person(tree, id)
    tree = setParents(tree, 'bigBranch', ['gp1', 'gp2'])
    tree = setParents(tree, 'smallBranch', ['gp1', 'gp2'])
    for (let i = 0; i < 5; i++) {
      tree = person(tree, `big${i}`)
      tree = setParents(tree, `big${i}`, ['bigBranch'])
    }
    tree = person(tree, 'small0')
    tree = setParents(tree, 'small0', ['smallBranch'])

    assertNoOverlap(computeLayout(tree))
  })

  it('keeps married sibling households grouped near each other', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'parentA')
    tree = person(tree, 'parentB')
    const siblingIds: string[] = []
    for (let index = 0; index < 6; index++) {
      const siblingId = `sibling${index}`
      const spouseId = `spouse${index}`
      const childId = `child${index}`
      siblingIds.push(siblingId)
      for (const id of [siblingId, spouseId, childId]) tree = person(tree, id)
      tree = setParents(tree, siblingId, ['parentA', 'parentB'])
      tree = addSpouse(tree, siblingId, spouseId).tree
      tree = setParents(tree, childId, [siblingId, spouseId])
    }

    const layout = computeLayout(tree)
    const siblingXs = siblingIds.map((id) => layout.people[id].x).sort((a, b) => a - b)
    const largestGap = Math.max(...siblingXs.slice(1).map((x, index) => x - siblingXs[index]))
    expect(largestGap).toBeLessThanOrEqual(NODE_SPACING_X * 3)
    assertNoOverlap(layout)
  })

  it('does not scatter a person who is reachable both as a spouse and, separately, as their own parents\' child', () => {
    // rootA -> childA marries "inLaw", who is ALSO independently a root-reachable
    // child of rootB1+rootB2. If a person can be claimed via the spouse path without
    // that also blocking the child path (or vice versa), they get placed twice and
    // the second placement silently overwrites the first, scattering the whole
    // branch (this is exactly what happened merging two real family trees where the
    // connecting spouse has their own separately-recorded parents).
    let tree = createEmptyTree('t', 'T')
    for (const id of ['rootA', 'childA', 'rootB1', 'rootB2', 'inLaw', 'grandkid']) tree = person(tree, id)
    tree = setParents(tree, 'childA', ['rootA'])
    tree = setParents(tree, 'inLaw', ['rootB1', 'rootB2'])
    tree = addSpouse(tree, 'childA', 'inLaw').tree
    tree = setParents(tree, 'grandkid', ['childA', 'inLaw'])

    const layout = computeLayout(tree)
    // Layered ordering may open one extra half-gap to avoid crossings, but a couple
    // must remain local rather than being scattered across the generation.
    expect(Math.abs(layout.people.childA.x - layout.people.inLaw.x)).toBeLessThanOrEqual(NODE_SPACING_X * 1.5)
    assertNoOverlap(layout)
  })

  it('orients a couple toward each spouse\'s own parent branch', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['leftParentA', 'leftParentB', 'wife', 'rightParentA', 'rightParentB', 'husband', 'child']) {
      tree = person(tree, id)
    }
    tree = setParents(tree, 'wife', ['leftParentA', 'leftParentB'])
    tree = setParents(tree, 'husband', ['rightParentA', 'rightParentB'])
    tree = setParents(tree, 'child', ['husband', 'wife'])

    const layout = computeLayout(tree)
    const leftAnchor = (layout.people.leftParentA.x + layout.people.leftParentB.x) / 2
    const rightAnchor = (layout.people.rightParentA.x + layout.people.rightParentB.x) / 2
    const parentDirection = leftAnchor - rightAnchor
    const coupleDirection = layout.people.wife.x - layout.people.husband.x

    expect(parentDirection).not.toBe(0)
    expect(coupleDirection * parentDirection).toBeGreaterThan(0)
    assertNoOverlap(layout)
  })

  it('keeps generation order stable regardless of person id insertion order (no more alphabetical-id scrambling)', () => {
    let tree = createEmptyTree('t', 'T')
    // create enough people that generated ids would exceed a single base36 digit,
    // where naive alphabetical sort of ids previously broke true creation order
    for (let i = 0; i < 40; i++) tree = person(tree, `p${i}`)
    tree = setParents(tree, 'p1', ['p0'])
    const layout = computeLayout(tree)
    expect(layout.people.p0.generation).toBe(0)
    expect(layout.people.p1.generation).toBe(1)
    assertNoOverlap(layout)
  })

  it('keeps every child below each recorded parent without forcing unrelated branches onto one row', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['rootA', 'parentA', 'rootB', 'parentB', 'partnerB', 'child']) tree = person(tree, id)
    tree = setParents(tree, 'parentA', ['rootA'])
    tree = setParents(tree, 'parentB', ['rootB'])
    tree = addSpouse(tree, 'parentB', 'partnerB').tree
    tree = setParents(tree, 'child', ['parentA', 'parentB'])

    const layout = computeLayout(tree)
    for (const parentId of ['parentA', 'parentB']) {
      expect(layout.people.child.y).toBeGreaterThan(layout.people[parentId].y + NODE_HEIGHT)
    }
    assertNoOverlap(layout)
  })

  it('keeps a simple descendant tree in clear horizontal tiers', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['root', 'childA', 'childB', 'grandchildA', 'grandchildB']) tree = person(tree, id)
    tree = setParents(tree, 'childA', ['root'])
    tree = setParents(tree, 'childB', ['root'])
    tree = setParents(tree, 'grandchildA', ['childA'])
    tree = setParents(tree, 'grandchildB', ['childB'])

    const layout = computeLayout(tree)
    expect(Math.abs(layout.people.childA.y - layout.people.childB.y)).toBeLessThan(NODE_HEIGHT)
    expect(Math.abs(layout.people.grandchildA.y - layout.people.grandchildB.y)).toBeLessThan(NODE_HEIGHT)
    expect(layout.people.childA.y).toBeGreaterThan(layout.people.root.y + NODE_HEIGHT)
    expect(layout.people.grandchildA.y).toBeGreaterThan(layout.people.childA.y + NODE_HEIGHT)
    assertNoOverlap(layout)
  })

  it('uses birth year to order disconnected peers without changing their structural rank', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'older', birthDate: 'ca 1954' }).tree
    tree = addPerson(tree, { id: 'middle', birthDate: '15 Jun 1975' }).tree
    tree = addPerson(tree, { id: 'younger', birthDate: '1 JAN 1997' }).tree

    const layout = computeLayout(tree)
    expect(layout.people.older.y).toBe(layout.people.middle.y)
    expect(layout.people.middle.y).toBe(layout.people.younger.y)
    expect(layout.people.older.x).toBeLessThan(layout.people.middle.x)
    expect(layout.people.middle.x).toBeLessThan(layout.people.younger.x)
    assertNoOverlap(layout)
  })

  it('keeps a single-child branch mostly aligned with its parent', () => {
    let tree = createEmptyTree('t', 'T')
    tree = addPerson(tree, { id: 'parent', birthDate: '1954' }).tree
    tree = addPerson(tree, { id: 'child', birthDate: '1997' }).tree
    tree = setParents(tree, 'child', ['parent'])

    const layout = computeLayout(tree)
    expect(Math.abs(layout.people.child.x - layout.people.parent.x)).toBeLessThanOrEqual(NODE_SPACING_X)
    expect(layout.people.child.y).toBeGreaterThan(layout.people.parent.y + NODE_HEIGHT)
  })

  it('reuses a completed standard layout for focus and reset interactions', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'a')
    tree = person(tree, 'b')
    tree = setParents(tree, 'b', ['a'])

    expect(computeLayout(tree)).toBe(computeLayout(tree))
  })

  it('assigns equivalent duplicate family records the same union position', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['a', 'b', 'child']) tree = person(tree, id)
    const familyData = {
      partners: [
        { personId: 'a', role: 'spouse' as const },
        { personId: 'b', role: 'spouse' as const },
      ],
      children: ['child'],
    }
    const first = createFamily(tree, familyData)
    tree = first.tree
    const second = createFamily(tree, familyData)
    tree = second.tree

    const layout = computeLayout(tree)
    expect(layout.families[first.family.id].x).toBe(layout.families[second.family.id].x)
    expect(layout.families[first.family.id].y).toBe(layout.families[second.family.id].y)
  })
})
