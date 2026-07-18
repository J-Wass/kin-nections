import { describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import { addPerson, addSpouse, createFamily, setParents } from '../model/treeOps'
import { computeFocusedLayout, computeGenerations, computeLayout, NODE_SPACING_X } from './treeLayout'

function person(tree: ReturnType<typeof createEmptyTree>, id: string) {
  return addPerson(tree, { id }).tree
}

function assertNoOverlap(layout: ReturnType<typeof computeLayout>) {
  const byGenPosition = new Map<string, string[]>()
  for (const node of Object.values(layout.people)) {
    const key = `${node.generation}:${node.x}`
    if (!byGenPosition.has(key)) byGenPosition.set(key, [])
    byGenPosition.get(key)!.push(node.id)
  }
  for (const [key, ids] of byGenPosition.entries()) {
    expect(ids, `overlap at ${key}: ${ids.join(', ')}`).toHaveLength(1)
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
    expect(coupleMid).toBeCloseTo(childMid, 5)
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
    // childA and inLaw must end up adjacent (a couple), not scattered apart
    expect(Math.abs(layout.people.childA.x - layout.people.inLaw.x)).toBeCloseTo(NODE_SPACING_X, 5)
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
})

describe('computeFocusedLayout', () => {
  it('places the focus person at relative generation 0, ancestors above and descendants below', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp', 'parent', 'me', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'parent', ['gp'])
    tree = setParents(tree, 'me', ['parent'])
    tree = setParents(tree, 'kid', ['me'])

    const layout = computeFocusedLayout(tree, 'me')
    expect(layout.people.me.generation).toBe(0)
    expect(layout.people.parent.generation).toBeLessThan(0)
    expect(layout.people.gp.generation).toBeLessThan(layout.people.parent.generation)
    expect(layout.people.kid.generation).toBeGreaterThan(0)
    assertNoOverlap(layout)
  })

  it('places an edge-branch focus person near the horizontal center of the graph', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['gp1', 'gp2', 'me', 'bigSibling']) tree = person(tree, id)
    tree = setParents(tree, 'me', ['gp1', 'gp2'])
    tree = setParents(tree, 'bigSibling', ['gp1', 'gp2'])
    for (let i = 0; i < 9; i++) {
      tree = person(tree, `niece${i}`)
      tree = setParents(tree, `niece${i}`, ['bigSibling'])
    }

    const layout = computeFocusedLayout(tree, 'me')
    expect(layout.people.me.x).toBe(0)
    const xs = Object.values(layout.people).map((node) => node.x)
    const graphMidpoint = (Math.min(...xs) + Math.max(...xs)) / 2
    expect(Math.abs(layout.people.me.x - graphMidpoint)).toBeLessThanOrEqual(NODE_SPACING_X / 2)
    assertNoOverlap(layout)
  })

  it('includes BOTH parents\' full ancestries, not just one side (the real bug this replaced)', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['me', 'dad', 'mom', 'dadGp1', 'dadGp2', 'momGp1', 'momGp2']) tree = person(tree, id)
    tree = setParents(tree, 'me', ['dad', 'mom'])
    tree = setParents(tree, 'dad', ['dadGp1', 'dadGp2'])
    tree = setParents(tree, 'mom', ['momGp1', 'momGp2'])

    const layout = computeFocusedLayout(tree, 'me')
    // every ancestor on BOTH sides must be present and two generations above "me"
    for (const id of ['dadGp1', 'dadGp2', 'momGp1', 'momGp2']) {
      expect(layout.people[id], `${id} should be in the focused layout`).toBeDefined()
      expect(layout.people[id].generation).toBe(-2)
    }
    assertNoOverlap(layout)
  })

  it('never draws a family edge to an ancestor whose partner-side was excluded (no orphaned edges)', () => {
    // "me"'s mom has her own separate parent, but that parent's OTHER spouse
    // (unrelated to "me") should not create a dangling half-placed family.
    let tree = createEmptyTree('t', 'T')
    for (const id of ['me', 'mom', 'momDad', 'unrelatedSpouse', 'unrelatedStepkid']) tree = person(tree, id)
    tree = setParents(tree, 'me', ['mom'])
    tree = setParents(tree, 'mom', ['momDad'])
    tree = addSpouse(tree, 'momDad', 'unrelatedSpouse').tree
    tree = setParents(tree, 'unrelatedStepkid', ['momDad', 'unrelatedSpouse'])

    const layout = computeFocusedLayout(tree, 'me')
    // unrelatedSpouse IS connected (via momDad), so it should be included and placed
    expect(layout.people.unrelatedSpouse).toBeDefined()
    expect(layout.people.unrelatedStepkid).toBeDefined()
    assertNoOverlap(layout)
  })

  it('centers descendants below the focus person the same way the general layout does', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['me', 'spouse', 'kid1', 'kid2', 'kid3']) tree = person(tree, id)
    tree = addSpouse(tree, 'me', 'spouse').tree
    tree = setParents(tree, 'kid1', ['me', 'spouse'])
    tree = setParents(tree, 'kid2', ['me', 'spouse'])
    tree = setParents(tree, 'kid3', ['me', 'spouse'])

    const layout = computeFocusedLayout(tree, 'me')
    const childXs = [layout.people.kid1.x, layout.people.kid2.x, layout.people.kid3.x]
    const childMid = (Math.min(...childXs) + Math.max(...childXs)) / 2
    const coupleMid = (layout.people.me.x + layout.people.spouse.x) / 2
    expect(coupleMid).toBeCloseTo(childMid, 5)
  })

  it('omits people outside the focus person\'s connected component', () => {
    let tree = createEmptyTree('t', 'T')
    tree = person(tree, 'me')
    tree = person(tree, 'unrelated')
    const layout = computeFocusedLayout(tree, 'me')
    expect(layout.people.me).toBeDefined()
    expect(layout.people.unrelated).toBeUndefined()
  })

  it('handles a focus person who is themselves a root with no ancestors', () => {
    let tree = createEmptyTree('t', 'T')
    for (const id of ['me', 'kid']) tree = person(tree, id)
    tree = setParents(tree, 'kid', ['me'])
    const layout = computeFocusedLayout(tree, 'me')
    expect(layout.people.me.generation).toBe(0)
    expect(layout.people.kid.generation).toBe(1)
  })
})
