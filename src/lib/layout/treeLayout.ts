import type { Tree } from '../model/types'
import { getChildrenOf, getParentsOf, getSpousesOf } from '../model/treeOps'

export const NODE_SPACING_X = 180
export const GENERATION_SPACING_Y = 160

export interface LayoutNode {
  id: string
  x: number
  y: number
  generation: number
}

export interface FamilyLayoutNode {
  id: string
  x: number
  y: number
  generation: number
}

export interface TreeLayout {
  people: Record<string, LayoutNode>
  families: Record<string, FamilyLayoutNode>
  width: number
  height: number
}

/** Assigns each person a generation depth via relaxation over both parent -> child
 * edges and spouse links, so people are grouped consistently even across multiple
 * marriages / re-parented families. Roots (no parents) start at generation 0.
 *
 * Spouse equalization matters: someone who married into the tree with no parents on
 * record would otherwise stay stuck at generation 0 regardless of which generation
 * their partner is actually in, dragging a line across the whole diagram. */
export function computeGenerations(tree: Tree): Record<string, number> {
  const generation: Record<string, number> = {}
  for (const id of Object.keys(tree.people)) generation[id] = 0

  const families = Object.values(tree.families)
  const maxIterations = Object.keys(tree.people).length + families.length + 2

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false

    for (const family of families) {
      const partnerIds = family.partners.map((p) => p.personId)

      if (partnerIds.length === 2) {
        const [a, b] = partnerIds
        const shared = Math.max(generation[a] ?? 0, generation[b] ?? 0)
        if ((generation[a] ?? 0) < shared) {
          generation[a] = shared
          changed = true
        }
        if ((generation[b] ?? 0) < shared) {
          generation[b] = shared
          changed = true
        }
      }

      if (partnerIds.length === 0 || family.children.length === 0) continue
      const parentGen = Math.max(...partnerIds.map((id) => generation[id] ?? 0))
      const childGen = parentGen + 1
      for (const childId of family.children) {
        if ((generation[childId] ?? 0) < childGen) {
          generation[childId] = childGen
          changed = true
        }
      }
    }

    if (!changed) break
  }

  return generation
}

interface Unit {
  personId: string
  spouseIds: string[]
  childUnits: Unit[]
  width: number
}

/** Builds a forest of layout "units" (a person, their not-yet-claimed spouses, and
 * their not-yet-claimed children as nested units), computing each unit's width in
 * grid columns bottom-up so the placement pass can center every couple above the
 * span their children actually occupy. */
function buildForest(tree: Tree, generation: Record<string, number>): Unit[] {
  const childrenOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()

  for (const family of Object.values(tree.families)) {
    const partnerIds = family.partners.map((p) => p.personId)
    for (const partnerId of partnerIds) {
      const arr = childrenOf.get(partnerId) ?? []
      for (const childId of family.children) if (!arr.includes(childId)) arr.push(childId)
      childrenOf.set(partnerId, arr)
    }
    if (partnerIds.length === 2) {
      const [a, b] = partnerIds
      if (!spousesOf.get(a)?.includes(b)) spousesOf.set(a, [...(spousesOf.get(a) ?? []), b])
      if (!spousesOf.get(b)?.includes(a)) spousesOf.set(b, [...(spousesOf.get(b) ?? []), a])
    }
  }

  // A single shared set: once a person is placed anywhere in the forest — as a
  // spouse-satellite of one unit or as a recursed child of another — they must not
  // be placed again elsewhere. Using separate spouse/child sets let someone claimed
  // as a spouse (e.g. someone who married into a family) still get independently
  // reachable as a "child" through their own parents' unit, silently overwriting
  // their already-assigned position and scattering their whole side of the tree.
  const claimed = new Set<string>()

  function buildUnit(personId: string): Unit {
    const spouseIds = (spousesOf.get(personId) ?? []).filter((id) => !claimed.has(id))
    spouseIds.forEach((id) => claimed.add(id))

    const childIds = (childrenOf.get(personId) ?? []).filter((id) => !claimed.has(id))
    childIds.forEach((id) => claimed.add(id))

    const childUnits = childIds.map((id) => buildUnit(id))
    const childrenWidth = childUnits.reduce((sum, u) => sum + u.width, 0)
    const coupleWidth = 1 + spouseIds.length
    const width = Math.max(coupleWidth, childrenWidth)

    return { personId, spouseIds, childUnits, width }
  }

  const roots: Unit[] = []
  for (const id of Object.keys(tree.people)) {
    if (claimed.has(id)) continue
    if ((generation[id] ?? 0) !== 0) continue
    roots.push(buildUnit(id))
  }
  // Safety net: anyone somehow unreached from a generation-0 root (shouldn't happen
  // in well-formed data, but avoids silently dropping a person from the canvas).
  for (const id of Object.keys(tree.people)) {
    if (claimed.has(id)) continue
    if (roots.some((u) => u.personId === id)) continue
    roots.push(buildUnit(id))
  }

  return roots
}

/** Lays out people and family-union markers as a centered, generation-stacked tree:
 * each row is a generation (oldest at the top), and every couple is centered above
 * the span their own children occupy (classic bottom-up-width / top-down-center tidy
 * tree), which keeps related branches contiguous instead of scattering them by
 * arbitrary visit order. */
export function computeLayout(tree: Tree): TreeLayout {
  const generation = computeGenerations(tree)
  const forest = buildForest(tree, generation)

  const people: Record<string, LayoutNode> = {}
  let maxColumn = 0
  let maxGen = 0

  function place(unit: Unit, columnStart: number): void {
    let childCursor = columnStart
    for (const childUnit of unit.childUnits) {
      place(childUnit, childCursor)
      childCursor += childUnit.width
    }

    const coupleWidth = 1 + unit.spouseIds.length
    const coupleStart = columnStart + (unit.width - coupleWidth) / 2

    const gen = generation[unit.personId] ?? 0
    people[unit.personId] = { id: unit.personId, x: coupleStart * NODE_SPACING_X, y: gen * GENERATION_SPACING_Y, generation: gen }
    maxColumn = Math.max(maxColumn, coupleStart)
    maxGen = Math.max(maxGen, gen)

    unit.spouseIds.forEach((spouseId, i) => {
      const spouseGen = generation[spouseId] ?? 0
      people[spouseId] = {
        id: spouseId,
        x: (coupleStart + 1 + i) * NODE_SPACING_X,
        y: spouseGen * GENERATION_SPACING_Y,
        generation: spouseGen,
      }
      maxColumn = Math.max(maxColumn, coupleStart + 1 + i)
      maxGen = Math.max(maxGen, spouseGen)
    })
  }

  let cursor = 0
  for (const unit of forest) {
    place(unit, cursor)
    cursor += unit.width
  }

  return {
    people,
    families: computeFamilyPositions(tree, people),
    width: (maxColumn + 1) * NODE_SPACING_X,
    height: (maxGen + 1) * GENERATION_SPACING_Y,
  }
}

/** Derives family-union marker positions from already-placed people: between the two
 * partners if any are placed, else centered above the placed children. Shared by both
 * the root-anchored and person-focused layouts. */
function computeFamilyPositions(tree: Tree, people: Record<string, LayoutNode>): Record<string, FamilyLayoutNode> {
  const families: Record<string, FamilyLayoutNode> = {}
  for (const family of Object.values(tree.families)) {
    const partnerNodes = family.partners.map((p) => people[p.personId]).filter(Boolean)
    if (partnerNodes.length > 0) {
      const x = partnerNodes.reduce((sum, n) => sum + n.x, 0) / partnerNodes.length
      const gen = Math.max(...partnerNodes.map((n) => n.generation))
      families[family.id] = { id: family.id, x, y: gen * GENERATION_SPACING_Y, generation: gen }
    } else if (family.children.length > 0) {
      const childNodes = family.children.map((id) => people[id]).filter(Boolean)
      if (childNodes.length === 0) continue
      const x = childNodes.reduce((sum, n) => sum + n.x, 0) / childNodes.length
      const gen = Math.min(...childNodes.map((n) => n.generation)) - 1
      families[family.id] = { id: family.id, x, y: gen * GENERATION_SPACING_Y, generation: gen }
    }
  }
  return families
}

/** Everyone reachable from `startId` via parent/child/spouse edges (in either
 * direction), used to scope the focused layout to the focus person's own relatives —
 * a tree may contain multiple unrelated family lines, and there's no sensible position
 * for a branch that isn't actually connected to the focus person. */
function findConnectedComponent(tree: Tree, startId: string): Set<string> {
  const visited = new Set<string>([startId])
  const queue = [startId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const neighbors = [
      ...getParentsOf(tree, id).map((p) => p.id),
      ...getChildrenOf(tree, id).map((p) => p.id),
      ...getSpousesOf(tree, id).map((s) => s.person.id),
    ]
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n)
        queue.push(n)
      }
    }
  }
  return visited
}

/** Lays out the connected family around a single focus person. The general layout
 * supplies stable generation and left-to-right ordering, then each generation is
 * centered around the focus household. On the focus row, the focus person and their
 * spouses form the central block; other people on that row are balanced around it.
 * This keeps the selected person near the visual center even when they occupied an
 * outside branch in the root-oriented layout. */
export function computeFocusedLayout(tree: Tree, focusPersonId: string): TreeLayout {
  const full = computeLayout(tree)
  const focusNode = full.people[focusPersonId]
  if (!focusNode) return { people: {}, families: {}, width: 0, height: 0 }

  const connected = findConnectedComponent(tree, focusPersonId)
  const people: Record<string, LayoutNode> = {}

  for (const [id, node] of Object.entries(full.people)) {
    if (!connected.has(id)) continue
    const generation = node.generation - focusNode.generation
    people[id] = { ...node, generation, y: generation * GENERATION_SPACING_Y }
  }

  const rows = new Map<number, LayoutNode[]>()
  for (const node of Object.values(people)) {
    const row = rows.get(node.generation) ?? []
    row.push(node)
    rows.set(node.generation, row)
  }

  const focusRow = rows.get(0) ?? []
  const spouseIds = new Set(
    getSpousesOf(tree, focusPersonId)
      .map((spouse) => spouse.person.id)
      .filter((id) => people[id]?.generation === 0),
  )
  const spouses = focusRow.filter((node) => spouseIds.has(node.id)).sort((a, b) => a.x - b.x)
  const spouseSplit = Math.floor(spouses.length / 2)
  const focusBlock = [
    ...spouses.slice(0, spouseSplit),
    people[focusPersonId],
    ...spouses.slice(spouseSplit),
  ]
  const others = focusRow
    .filter((node) => node.id !== focusPersonId && !spouseIds.has(node.id))
    .sort((a, b) => a.x - b.x)
  const otherSplit = Math.floor(others.length / 2)
  const orderedFocusRow = [...others.slice(0, otherSplit), ...focusBlock, ...others.slice(otherSplit)]

  function placeCenteredRow(row: LayoutNode[], centerX: number): void {
    const startX = centerX - ((row.length - 1) * NODE_SPACING_X) / 2
    row.forEach((node, index) => {
      node.x = startX + index * NODE_SPACING_X
    })
  }

  placeCenteredRow(orderedFocusRow, 0)
  const focusOffset = people[focusPersonId].x
  for (const node of orderedFocusRow) node.x -= focusOffset

  const householdCenter =
    focusBlock.reduce((sum, node) => sum + node.x, 0) / Math.max(focusBlock.length, 1)
  for (const [generation, row] of rows) {
    if (generation === 0) continue
    placeCenteredRow(row.sort((a, b) => a.x - b.x), householdCenter)
  }

  let minX = 0
  let maxX = 0
  let minGen = 0
  let maxGen = 0
  for (const node of Object.values(people)) {
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    minGen = Math.min(minGen, node.generation)
    maxGen = Math.max(maxGen, node.generation)
  }

  return {
    people,
    families: computeFamilyPositions(tree, people),
    width: maxX - minX + NODE_SPACING_X,
    height: (maxGen - minGen + 1) * GENERATION_SPACING_Y,
  }
}
