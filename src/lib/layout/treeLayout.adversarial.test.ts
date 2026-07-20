import { describe, expect, it } from 'vitest'
import { addPerson, addSpouse, createFamily, setParents } from '../model/treeOps'
import { createEmptyTree } from '../model/types'
import { measureLayout } from './layoutBenchmark'
import { NODE_HEIGHT, NODE_WIDTH, computeLayout } from './treeLayout'

function withPeople(ids: string[]) {
  let tree = createEmptyTree('adversarial', 'Adversarial')
  for (const id of ids) tree = addPerson(tree, { id }).tree
  return tree
}

function expectNoCardOverlap(layout: ReturnType<typeof computeLayout>): void {
  const nodes = Object.values(layout.people)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      expect(
        Math.abs(nodes[i].x - nodes[j].x) < NODE_WIDTH && Math.abs(nodes[i].y - nodes[j].y) < NODE_HEIGHT,
        `${nodes[i].id} overlaps ${nodes[j].id}`,
      ).toBe(false)
    }
  }
}

function expectRoutesTerminateAtChildren(tree: ReturnType<typeof createEmptyTree>): void {
  const layout = computeLayout(tree)
  for (const family of Object.values(tree.families)) {
    for (const childId of family.children) {
      const points = layout.parentChildRoutes[family.id]?.[childId]
      expect(points?.length, `${family.id} -> ${childId}`).toBeGreaterThan(1)
      expect(points?.at(-1)).toEqual({
        x: layout.people[childId].x + NODE_WIDTH / 2,
        y: layout.people[childId].y,
      })
    }
  }
}

describe('authoritative Dagre layout adversarial cases', () => {
  it('uses rank slack to keep both sides of a wide bridge marriage nearby', () => {
    let tree = withPeople(['leftMom', 'leftDad', 'rightMom', 'rightDad'])
    const sideBranches: Array<{ parents: [string, string]; child: string }> = []
    for (let index = 0; index < 7; index++) {
      const left = index === 5 ? 'david' : `leftSibling${index}`
      const right = index === 1 ? 'ilene' : `rightSibling${index}`
      for (const id of [left, right]) tree = addPerson(tree, { id }).tree
      tree = setParents(tree, left, ['leftMom', 'leftDad'])
      tree = setParents(tree, right, ['rightMom', 'rightDad'])

      for (const sibling of [left, right]) {
        if (sibling === 'david' || sibling === 'ilene') continue
        const spouse = `${sibling}Spouse`
        const child = `${sibling}Child`
        tree = addPerson(tree, { id: spouse }).tree
        tree = addPerson(tree, { id: child }).tree
        tree = addSpouse(tree, sibling, spouse).tree
        tree = setParents(tree, child, [sibling, spouse])
        sideBranches.push({ parents: [sibling, spouse], child })
      }
    }

    tree = addSpouse(tree, 'david', 'ilene').tree
    const bridgeChildren = ['bridgeChildA', 'bridgeChildB', 'bridgeChildC']
    for (const child of bridgeChildren) {
      tree = addPerson(tree, { id: child }).tree
      tree = setParents(tree, child, ['david', 'ilene'])
    }

    const layout = computeLayout(tree)
    const center = (id: string) => layout.people[id].x + NODE_WIDTH / 2
    const average = (ids: string[]) => ids.reduce((sum, id) => sum + center(id), 0) / ids.length
    const bridgeCenter = average(['david', 'ilene'])

    // Both birth families should benefit symmetrically. Dagre's untouched result
    // leaves each parent household 800px from this bridge in the same fixture.
    expect(Math.abs(average(['leftMom', 'leftDad']) - bridgeCenter)).toBeLessThanOrEqual(NODE_WIDTH + 480)
    expect(Math.abs(average(['rightMom', 'rightDad']) - bridgeCenter)).toBeLessThanOrEqual(NODE_WIDTH + 480)
    expect(Math.abs(average(bridgeChildren) - bridgeCenter)).toBeLessThanOrEqual(NODE_WIDTH)
    expect(Math.abs(center('david') - center('ilene'))).toBe(NODE_WIDTH + 32)
    for (const branch of sideBranches) {
      const parentCenter = average(branch.parents)
      expect(
        Math.abs(center(branch.child) - parentCenter),
        `${branch.child} should use the open slot below its parents`,
      ).toBeLessThanOrEqual(NODE_WIDTH + 480)
    }
    const metrics = measureLayout(tree)
    expect(metrics.crossings).toBe(0)
    expect(metrics.edgeCardIntersections).toBe(0)
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })

  it('terminates and retains named routes for a pedigree cycle', () => {
    let tree = withPeople(['a', 'b'])
    tree = createFamily(tree, { partners: [{ personId: 'a', role: 'partner' }], children: ['b'] }).tree
    tree = createFamily(tree, { partners: [{ personId: 'b', role: 'partner' }], children: ['a'] }).tree

    const layout = computeLayout(tree)
    expect(Object.values(layout.people).every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })

  it('keeps cousin intermarriage structural and the new child below both cousins', () => {
    let tree = withPeople(['gp1', 'gp2', 'left', 'right', 'leftSpouse', 'rightSpouse', 'cousinA', 'cousinB', 'child'])
    tree = setParents(tree, 'left', ['gp1', 'gp2'])
    tree = setParents(tree, 'right', ['gp1', 'gp2'])
    tree = setParents(tree, 'cousinA', ['left', 'leftSpouse'])
    tree = setParents(tree, 'cousinB', ['right', 'rightSpouse'])
    tree = setParents(tree, 'child', ['cousinA', 'cousinB'])

    const layout = computeLayout(tree)
    expect(layout.people.child.y).toBeGreaterThan(layout.people.cousinA.y + NODE_HEIGHT)
    expect(layout.people.child.y).toBeGreaterThan(layout.people.cousinB.y + NODE_HEIGHT)
    expect(Math.abs(layout.people.cousinA.x - layout.people.cousinB.x)).toBeLessThanOrEqual(NODE_WIDTH + 64)
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })

  it('handles remarriage and step-family branches without moving spouses apart', () => {
    let tree = withPeople(['parent', 'former', 'current', 'stepEx', 'firstChild', 'secondChild', 'stepChild'])
    tree = setParents(tree, 'firstChild', ['parent', 'former'])
    tree = setParents(tree, 'secondChild', ['parent', 'current'])
    tree = setParents(tree, 'stepChild', ['current', 'stepEx'])

    const layout = computeLayout(tree)
    for (const childId of ['firstChild', 'secondChild', 'stepChild']) {
      const family = Object.values(tree.families).find((candidate) => candidate.children.includes(childId))!
      for (const partner of family.partners) {
        expect(layout.people[childId].y).toBeGreaterThan(layout.people[partner.personId].y + NODE_HEIGHT)
      }
    }
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })

  it('supports unknown parents and maps duplicate canonical routes back to both records', () => {
    let tree = withPeople(['a', 'b'])
    const first = createFamily(tree, { partners: [], children: ['a', 'b'] })
    tree = first.tree
    const duplicate = createFamily(tree, { partners: [], children: ['a', 'b'] })
    tree = duplicate.tree

    const layout = computeLayout(tree)
    expect(layout.parentChildRoutes[duplicate.family.id]).toEqual(layout.parentChildRoutes[first.family.id])
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })

  it('preserves routed bends for a long-rank edge and avoids unrelated cards', () => {
    let tree = withPeople(['root', 'level1', 'level2', 'deepChild', 'unrelated'])
    tree = createFamily(tree, { partners: [{ personId: 'root', role: 'partner' }], children: ['level1'] }).tree
    tree = createFamily(tree, { partners: [{ personId: 'level1', role: 'partner' }], children: ['level2'] }).tree
    tree = createFamily(tree, { partners: [{ personId: 'level2', role: 'partner' }], children: ['deepChild'] }).tree
    const longFamily = createFamily(tree, { partners: [{ personId: 'root', role: 'partner' }], children: ['deepChild'] })
    tree = longFamily.tree

    const layout = computeLayout(tree)
    expect(layout.parentChildRoutes[longFamily.family.id].deepChild.length).toBeGreaterThan(3)
    expect(measureLayout(tree).edgeCardIntersections).toBe(0)
    expectNoCardOverlap(layout)
    expectRoutesTerminateAtChildren(tree)
  })
})
