import type { Tree } from '../model/types'
import { getChildrenOf, getParentsOf, getSpousesOf } from '../model/treeOps'

export const NODE_WIDTH = 112
export const NODE_HEIGHT = 124
export const NODE_SPACING_X = 180
export const GENERATION_SPACING_Y = 260

const FOREST_GAP_COLUMNS = 1

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
    cursor += unit.width + FOREST_GAP_COLUMNS
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

interface FocusConnection {
  distance: number
  generation: number
}

/** Shortest family path from the focus person, carrying its relative generation.
 * Direct parents and children must stay exactly one row away even when the default
 * layout has pushed the focus person down to match a spouse's distant branch. */
function findFocusConnections(tree: Tree, startId: string): Map<string, FocusConnection> {
  const connections = new Map<string, FocusConnection>([[startId, { distance: 0, generation: 0 }]])
  const queue = [startId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const current = connections.get(id)!
    const neighbors = [
      ...getParentsOf(tree, id).map((person) => ({ id: person.id, generationDelta: -1 })),
      ...getChildrenOf(tree, id).map((person) => ({ id: person.id, generationDelta: 1 })),
      ...getSpousesOf(tree, id).map((spouse) => ({ id: spouse.person.id, generationDelta: 0 })),
    ]
    for (const neighbor of neighbors) {
      if (!connections.has(neighbor.id)) {
        connections.set(neighbor.id, {
          distance: current.distance + 1,
          generation: current.generation + neighbor.generationDelta,
        })
        queue.push(neighbor.id)
      }
    }
  }
  return connections
}

/** Re-roots the connected tree around one person. People joined as spouses or
 * siblings are moved as a row-level group, so focus mode can reorganize branches
 * without splitting couples or interleaving sibling households. */
export function computeFocusedLayout(tree: Tree, focusPersonId: string): TreeLayout {
  const full = computeLayout(tree)
  const focusNode = full.people[focusPersonId]
  if (!focusNode) return { people: {}, families: {}, width: 0, height: 0 }

  const connections = findFocusConnections(tree, focusPersonId)
  const people: Record<string, LayoutNode> = {}

  for (const [id, node] of Object.entries(full.people)) {
    const connection = connections.get(id)
    if (!connection) continue
    const generation = connection.generation
    people[id] = { ...node, generation, y: generation * GENERATION_SPACING_Y }
  }

  const rows = new Map<number, LayoutNode[]>()
  for (const node of Object.values(people)) {
    const row = rows.get(node.generation) ?? []
    row.push(node)
    rows.set(node.generation, row)
  }

  function buildRowGroups(row: LayoutNode[]): LayoutNode[][] {
    const rowIds = new Set(row.map((node) => node.id))
    const claimed = new Set<string>()
    const groups: LayoutNode[][] = []
    const families = Object.values(tree.families)

    const siblingFamilies = families
      .map((family) => ({
        family,
        children: family.children.filter((id) => rowIds.has(id)),
      }))
      .filter(({ children }) => children.length >= 2)
      .sort((a, b) => {
        const distanceA = Math.min(...a.children.map((id) => connections.get(id)!.distance))
        const distanceB = Math.min(...b.children.map((id) => connections.get(id)!.distance))
        return distanceA - distanceB
      })

    for (const { children } of siblingFamilies) {
      const siblings = children.filter((id) => !claimed.has(id))
      if (siblings.length < 2) continue
      siblings.forEach((id) => claimed.add(id))
      const spouseIds = siblings.flatMap((id) =>
        getSpousesOf(tree, id).map((spouse) => spouse.person.id),
      ).filter((id, index, ids) => rowIds.has(id) && !claimed.has(id) && ids.indexOf(id) === index)
      spouseIds.forEach((id) => claimed.add(id))
      groups.push([...siblings, ...spouseIds].map((id) => people[id]).sort((a, b) => a.x - b.x))
    }

    const remaining = row
      .filter((node) => !claimed.has(node.id))
      .sort((a, b) => connections.get(a.id)!.distance - connections.get(b.id)!.distance || a.x - b.x)
    for (const node of remaining) {
      if (claimed.has(node.id)) continue
      claimed.add(node.id)
      const spouseNodes = getSpousesOf(tree, node.id)
        .map((spouse) => spouse.person.id)
        .filter((id, index, ids) => rowIds.has(id) && !claimed.has(id) && ids.indexOf(id) === index)
        .map((id) => {
          claimed.add(id)
          return people[id]
        })
      groups.push([node, ...spouseNodes].sort((a, b) => a.x - b.x))
    }

    return groups
  }

  function reorderFocusGroup(group: LayoutNode[]): LayoutNode[] {
    const groupIds = new Set(group.map((node) => node.id))
    const families = Object.values(tree.families)
    const hasSiblingInGroup = (personId: string) =>
      families.some(
        (family) => family.children.includes(personId) && family.children.some((id) => id !== personId && groupIds.has(id)),
      )
    const pivotPersonId = hasSiblingInGroup(focusPersonId)
      ? focusPersonId
      : [...new Set(getSpousesOf(tree, focusPersonId).map((spouse) => spouse.person.id))]
          .find((id) => groupIds.has(id) && hasSiblingInGroup(id)) ?? focusPersonId

    const siblingIds = new Set<string>([pivotPersonId])
    for (const family of families) {
      if (!family.children.includes(pivotPersonId)) continue
      for (const childId of family.children) if (groupIds.has(childId)) siblingIds.add(childId)
    }

    const claimed = new Set<string>()
    const households = [...siblingIds]
      .map((siblingId) => {
        const spouseIds = [...new Set(getSpousesOf(tree, siblingId).map((spouse) => spouse.person.id))]
        const spouses = spouseIds
          .filter((id) => groupIds.has(id) && !siblingIds.has(id) && !claimed.has(id))
          .map((id) => people[id])
          .sort((a, b) => a.x - b.x)
        const sibling = people[siblingId]
        claimed.add(sibling.id)
        spouses.forEach((node) => claimed.add(node.id))
        return { sibling, spouses }
      })
      .sort((a, b) => a.sibling.x - b.sibling.x)

    const focusHousehold = households.find((household) => household.sibling.id === pivotPersonId)!
    const otherHouseholds = households.filter((household) => household !== focusHousehold)
    const split = Math.floor(otherHouseholds.length / 2)
    const centeredHouseholdList = [
      ...otherHouseholds.slice(0, split),
      focusHousehold,
      ...otherHouseholds.slice(split),
    ]
    const focusHouseholdIndex = centeredHouseholdList.indexOf(focusHousehold)
    const centeredHouseholds = centeredHouseholdList.flatMap((household, index) => {
      if (index <= focusHouseholdIndex) return [...household.spouses, household.sibling]
      return [household.sibling, ...household.spouses]
    })

    const leftovers = group.filter((node) => !claimed.has(node.id))
    const left = leftovers.filter((node) => node.x < focusNode.x)
    const right = leftovers.filter((node) => node.x >= focusNode.x)
    return [...left, ...centeredHouseholds, ...right]
  }

  const GROUP_GAP = NODE_SPACING_X * 0.35

  function placeGroups(groups: LayoutNode[][], centerX: number, focusId?: string): void {
    if (groups.length === 0) return
    const orderedGroups = [...groups].sort((a, b) => {
      const distanceA = Math.min(...a.map((node) => connections.get(node.id)!.distance))
      const distanceB = Math.min(...b.map((node) => connections.get(node.id)!.distance))
      return distanceA - distanceB || a[0].x - b[0].x
    })
    const anchorIndex = focusId
      ? orderedGroups.findIndex((group) => group.some((node) => node.id === focusId))
      : 0
    const anchor = orderedGroups.splice(Math.max(anchorIndex, 0), 1)[0]
    const anchorOrder = focusId ? reorderFocusGroup(anchor) : anchor
    const focusIndex = focusId ? anchorOrder.findIndex((node) => node.id === focusId) : -1
    const anchorStart = focusId
      ? centerX - focusIndex * NODE_SPACING_X
      : centerX - ((anchorOrder.length - 1) * NODE_SPACING_X) / 2
    anchorOrder.forEach((node, index) => (node.x = anchorStart + index * NODE_SPACING_X))

    let leftEdge = anchorOrder[0].x
    let rightEdge = anchorOrder[anchorOrder.length - 1].x
    for (const group of orderedGroups) {
      const originalCenter = group.reduce((sum, node) => sum + node.x, 0) / group.length
      const leftExtent = centerX - leftEdge
      const rightExtent = rightEdge - centerX
      const useLeft = leftExtent === rightExtent ? originalCenter < focusNode.x : leftExtent < rightExtent
      if (useLeft) {
        const groupStart = leftEdge - GROUP_GAP - group.length * NODE_SPACING_X
        group.forEach((node, index) => (node.x = groupStart + index * NODE_SPACING_X))
        leftEdge = groupStart
      } else {
        const groupStart = rightEdge + GROUP_GAP + NODE_SPACING_X
        group.forEach((node, index) => (node.x = groupStart + index * NODE_SPACING_X))
        rightEdge = groupStart + (group.length - 1) * NODE_SPACING_X
      }
    }
  }

  function adjacentFamilyTarget(group: LayoutNode[], generation: number): number {
    const groupIds = new Set(group.map((node) => node.id))
    const closestDistance = Math.min(...group.map((node) => connections.get(node.id)!.distance))
    const targets: number[] = []

    for (const family of Object.values(tree.families)) {
      if (generation > 0 && family.children.some((id) =>
        groupIds.has(id) && connections.get(id)?.distance === closestDistance,
      )) {
        const parents = family.partners
          .map((partner) => people[partner.personId])
          .filter((node) => node?.generation === generation - 1)
        if (parents.length > 0) {
          targets.push(parents.reduce((sum, node) => sum + node.x, 0) / parents.length)
        }
      }

      if (generation < 0 && family.partners.some((partner) =>
        groupIds.has(partner.personId) && connections.get(partner.personId)?.distance === closestDistance,
      )) {
        const children = family.children
          .map((id) => people[id])
          .filter((node) => node?.generation === generation + 1)
        if (children.length > 0) {
          targets.push((Math.min(...children.map((node) => node.x)) + Math.max(...children.map((node) => node.x))) / 2)
        }
      }
    }

    if (targets.length > 0) return targets.reduce((sum, target) => sum + target, 0) / targets.length
    return group.reduce((sum, node) => sum + node.x, 0) / group.length - focusNode.x
  }

  function placeGroupsByFamily(groups: LayoutNode[][], generation: number): void {
    if (groups.length === 0) return
    const placements = groups
      .map((group) => {
        const groupIds = new Set(group.map((node) => node.id))
        const siblingFamily = Object.values(tree.families)
          .filter((family) => family.children.filter((id) => groupIds.has(id)).length >= 2)
          .sort((a, b) => {
            const distanceA = Math.min(...a.children.filter((id) => groupIds.has(id)).map((id) => connections.get(id)!.distance))
            const distanceB = Math.min(...b.children.filter((id) => groupIds.has(id)).map((id) => connections.get(id)!.distance))
            return distanceA - distanceB
          })[0]
        let orderedGroup = group

        if (siblingFamily) {
          const siblingIds = siblingFamily.children.filter((id) => groupIds.has(id))
          const siblingIdSet = new Set(siblingIds)
          const claimed = new Set(siblingIds)
          const households = siblingIds
            .map((siblingId) => {
              const spouses = [...new Set(getSpousesOf(tree, siblingId).map((spouse) => spouse.person.id))]
                .filter((id) => groupIds.has(id) && !siblingIdSet.has(id) && !claimed.has(id))
                .map((id) => people[id])
                .sort((a, b) => a.x - b.x)
              spouses.forEach((node) => claimed.add(node.id))
              return { sibling: people[siblingId], spouses }
            })
            .sort((a, b) => a.sibling.x - b.sibling.x)
          const split = Math.ceil(households.length / 2)
          const leftHouseholds = households.slice(0, split).flatMap((household) => [...household.spouses, household.sibling])
          const rightHouseholds = households.slice(split).flatMap((household) => [household.sibling, ...household.spouses])
          const leftovers = group.filter((node) => !claimed.has(node.id))
          orderedGroup = [
            ...leftovers.filter((node) => node.x < focusNode.x),
            ...leftHouseholds,
            ...rightHouseholds,
            ...leftovers.filter((node) => node.x >= focusNode.x),
          ]
        }

        return {
          group: orderedGroup,
          target: adjacentFamilyTarget(group, generation),
          distance: Math.min(...group.map((node) => connections.get(node.id)!.distance)),
        }
      })
      .sort((a, b) => a.distance - b.distance || a.target - b.target || a.group[0].x - b.group[0].x)

    const occupied: { start: number; end: number }[] = []
    const separation = NODE_SPACING_X + GROUP_GAP

    function isAvailable(start: number, end: number): boolean {
      return occupied.every((interval) => end + separation <= interval.start || start >= interval.end + separation)
    }

    for (const placement of placements) {
      const width = (placement.group.length - 1) * NODE_SPACING_X
      const desiredStart = placement.target - width / 2
      const candidates = [
        desiredStart,
        ...occupied.flatMap((interval) => [interval.start - separation - width, interval.end + separation]),
      ].filter((start) => isAvailable(start, start + width))
      const start = candidates.reduce((best, candidate) =>
        Math.abs(candidate - desiredStart) < Math.abs(best - desiredStart) ? candidate : best,
      )
      placement.group.forEach((node, index) => {
        node.x = start + index * NODE_SPACING_X
      })
      occupied.push({ start, end: start + width })
    }
  }

  const focusRow = rows.get(0) ?? []
  placeGroups(buildRowGroups(focusRow), 0, focusPersonId)

  const minGeneration = Math.min(...rows.keys())
  const maxGeneration = Math.max(...rows.keys())
  for (let generation = 1; generation <= maxGeneration; generation++) {
    const row = rows.get(generation)
    if (row) placeGroupsByFamily(buildRowGroups(row), generation)
  }
  for (let generation = -1; generation >= minGeneration; generation--) {
    const row = rows.get(generation)
    if (row) placeGroupsByFamily(buildRowGroups(row), generation)
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
