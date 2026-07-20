import { Graph, layout as layoutGraph } from '@dagrejs/dagre'
import type { Family, Tree } from '../model/types'

export const NODE_WIDTH = 80
export const NODE_HEIGHT = 160
export const NODE_SPACING_X = 280
export const GENERATION_SPACING_Y = 340

const SPOUSE_GAP = 32
const HOUSEHOLD_GAP = 64
const COMPONENT_GAP = 240
const UNION_SIZE = 8
const RANK_GAP = 82
const standardLayoutCache = new WeakMap<Tree, TreeLayout>()

export interface LayoutPoint {
  x: number
  y: number
}

export interface LayoutNode extends LayoutPoint {
  id: string
  generation: number
}

export interface FamilyLayoutNode extends LayoutNode {}

export interface TreeLayout {
  people: Record<string, LayoutNode>
  families: Record<string, FamilyLayoutNode>
  /** One independently-routed polyline for each family -> child relationship. */
  parentChildRoutes: Record<string, Record<string, LayoutPoint[]>>
  width: number
  height: number
}

const householdGraphId = (rootPersonId: string) => `household:${rootPersonId}`
const familyGraphId = (familyId: string) => `family:${familyId}`
const childEdgeName = (familyId: string, childId: string) => `child:${familyId}:${childId}`

function equivalentFamilyKey(family: Family): string {
  const partners = family.partners
    .map((partner) => `${partner.personId}:${partner.role}`)
    .sort()
    .join(',')
  return `${partners}|${family.status}|${[...family.children].sort().join(',')}`
}

function birthYear(value?: string): number | undefined {
  const match = value?.match(/\b(1\d{3}|20\d{2})\b/)
  if (!match) return undefined
  const year = Number(match[1])
  return year <= new Date().getFullYear() + 1 ? year : undefined
}

interface CanonicalFamilies {
  families: Family[]
  canonicalId: Map<string, string>
}

function canonicalizeFamilies(tree: Tree): CanonicalFamilies {
  const byKey = new Map<string, string>()
  const canonicalId = new Map<string, string>()
  const families: Family[] = []
  for (const family of Object.values(tree.families)) {
    const key = equivalentFamilyKey(family)
    const existing = byKey.get(key)
    if (existing) {
      canonicalId.set(family.id, existing)
    } else {
      byKey.set(key, family.id)
      canonicalId.set(family.id, family.id)
      families.push(family)
    }
  }
  return { families, canonicalId }
}

interface Households {
  ordered: Map<string, string[]>
  personToRoot: Map<string, string>
}

function buildHouseholds(tree: Tree): Households {
  const personIds = Object.keys(tree.people)
  const insertionIndex = new Map(personIds.map((id, index) => [id, index]))
  const parent = new Map(personIds.map((id) => [id, id]))
  const spouseDegree = new Map(personIds.map((id) => [id, 0]))

  function find(id: string): string {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }

  function union(ids: string[]): void {
    const roots = [...new Set(ids.filter((id) => parent.has(id)).map(find))]
    if (roots.length < 2) return
    roots.sort((a, b) => insertionIndex.get(a)! - insertionIndex.get(b)!)
    for (const root of roots.slice(1)) parent.set(root, roots[0])
  }

  for (const family of Object.values(tree.families)) {
    const partnerIds = family.partners.map((partner) => partner.personId).filter((id) => parent.has(id))
    union(partnerIds)
    for (const personId of partnerIds) {
      spouseDegree.set(personId, spouseDegree.get(personId)! + partnerIds.length - 1)
    }
  }

  const personToRoot = new Map(personIds.map((id) => [id, find(id)]))
  const members = new Map<string, string[]>()
  for (const id of personIds) {
    const root = personToRoot.get(id)!
    members.set(root, [...(members.get(root) ?? []), id])
  }

  const ordered = new Map<string, string[]>()
  for (const [root, memberIds] of members) {
    const remaining = [...memberIds].sort((a, b) =>
      spouseDegree.get(b)! - spouseDegree.get(a)!
      || insertionIndex.get(a)! - insertionIndex.get(b)!,
    )
    const result: string[] = []
    remaining.forEach((id, index) => {
      if (index === 0 || index % 2 === 0) result.push(id)
      else result.unshift(id)
    })
    ordered.set(root, result)
  }
  return { ordered, personToRoot }
}

/** Structural generations are longest paths through the spouse-household DAG. SCCs
 * collapse pedigree cycles, preventing cyclic records from inflating ranks forever. */
export function computeGenerations(tree: Tree): Record<string, number> {
  const { ordered, personToRoot } = buildHouseholds(tree)
  const roots = [...ordered.keys()]
  const adjacency = new Map(roots.map((root) => [root, new Set<string>()]))
  for (const family of Object.values(tree.families)) {
    const parentRoots = [...new Set(family.partners.map((p) => personToRoot.get(p.personId)).filter(Boolean))] as string[]
    const childRoots = [...new Set(family.children.map((id) => personToRoot.get(id)).filter(Boolean))] as string[]
    for (const parentRoot of parentRoots) {
      for (const childRoot of childRoots) if (parentRoot !== childRoot) adjacency.get(parentRoot)?.add(childRoot)
    }
  }

  let nextIndex = 0
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const componentOf = new Map<string, number>()
  const components: string[][] = []

  function visit(node: string): void {
    indexes.set(node, nextIndex)
    lowLinks.set(node, nextIndex++)
    stack.push(node)
    onStack.add(node)
    for (const child of adjacency.get(node) ?? []) {
      if (!indexes.has(child)) {
        visit(child)
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(child)!))
      } else if (onStack.has(child)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indexes.get(child)!))
      }
    }
    if (lowLinks.get(node) !== indexes.get(node)) return
    const component: string[] = []
    while (stack.length > 0) {
      const member = stack.pop()!
      onStack.delete(member)
      componentOf.set(member, components.length)
      component.push(member)
      if (member === node) break
    }
    components.push(component)
  }
  roots.forEach((root) => { if (!indexes.has(root)) visit(root) })

  const componentEdges = new Map(components.map((_, index) => [index, new Set<number>()]))
  const indegree = new Map(components.map((_, index) => [index, 0]))
  for (const [parentRoot, children] of adjacency) {
    for (const childRoot of children) {
      const from = componentOf.get(parentRoot)!
      const to = componentOf.get(childRoot)!
      if (from === to || componentEdges.get(from)!.has(to)) continue
      componentEdges.get(from)!.add(to)
      indegree.set(to, indegree.get(to)! + 1)
    }
  }
  const ranks = new Map(components.map((_, index) => [index, 0]))
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([index]) => index)
  while (queue.length > 0) {
    const component = queue.shift()!
    for (const child of componentEdges.get(component)!) {
      ranks.set(child, Math.max(ranks.get(child)!, ranks.get(component)! + 1))
      indegree.set(child, indegree.get(child)! - 1)
      if (indegree.get(child) === 0) queue.push(child)
    }
  }
  return Object.fromEntries(Object.keys(tree.people).map((id) => [id, ranks.get(componentOf.get(personToRoot.get(id)!)!) ?? 0]))
}

function householdWidth(memberCount: number): number {
  return memberCount * NODE_WIDTH + Math.max(0, memberCount - 1) * SPOUSE_GAP
}

function simplifyOrthogonalPoints(points: LayoutPoint[]): LayoutPoint[] {
  const deduped = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y)
  return deduped.filter((point, index) => {
    if (index === 0 || index === deduped.length - 1) return true
    const previous = deduped[index - 1]
    const next = deduped[index + 1]
    return !((previous.x === point.x && point.x === next.x) || (previous.y === point.y && point.y === next.y))
  })
}

function orthogonalizeRoute(start: LayoutPoint, guidePoints: LayoutPoint[], end: LayoutPoint): LayoutPoint[] {
  const guides = [{ ...start }, ...guidePoints.slice(1, -1).map((point) => ({ x: point.x, y: point.y })), { ...end }]
  const result: LayoutPoint[] = [guides[0]]
  for (const next of guides.slice(1)) {
    const current = result[result.length - 1]
    if (current.x !== next.x && current.y !== next.y) {
      const middleY = (current.y + next.y) / 2
      result.push({ x: current.x, y: middleY }, { x: next.x, y: middleY })
    }
    result.push(next)
  }
  return simplifyOrthogonalPoints(result)
}

function familyAnchor(family: Family, people: Record<string, LayoutNode>, fallback: LayoutPoint): LayoutPoint {
  const partners = family.partners.map((partner) => people[partner.personId]).filter(Boolean)
  if (partners.length === 0) return { x: fallback.x, y: fallback.y }
  return {
    x: partners.reduce((sum, node) => sum + node.x + NODE_WIDTH / 2, 0) / partners.length,
    y: partners.reduce((sum, node) => sum + node.y + NODE_HEIGHT / 2, 0) / partners.length,
  }
}

function optimizeCoupleOrientations(
  tree: Tree,
  households: Map<string, string[]>,
  people: Record<string, LayoutNode>,
): void {
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  function anchors(personId: string): number[] {
    const result: number[] = []
    for (const family of Object.values(tree.families)) {
      if (family.children.includes(personId)) {
        const values = family.partners.map((partner) => people[partner.personId]).filter(Boolean).map((node) => node.x + NODE_WIDTH / 2)
        if (values.length > 0) result.push(average(values))
      }
      if (family.partners.length === 1 && family.partners[0].personId === personId) {
        const values = family.children.map((id) => people[id]).filter(Boolean).map((node) => node.x + NODE_WIDTH / 2)
        if (values.length > 0) result.push(average(values))
      }
    }
    return result
  }
  const cost = (id: string, x: number) => anchors(id).reduce((sum, anchor) => sum + (x - anchor) ** 2, 0)
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const members of households.values()) {
      if (members.length !== 2) continue
      const [aId, bId] = members
      const a = people[aId]
      const b = people[bId]
      if (!a || !b) continue
      if (cost(aId, b.x) + cost(bId, a.x) + 1 < cost(aId, a.x) + cost(bId, b.x)) {
        ;[a.x, b.x] = [b.x, a.x]
        changed = true
      }
    }
    if (!changed) break
  }
}

function addFallbackRoutes(
  tree: Tree,
  people: Record<string, LayoutNode>,
  families: Record<string, FamilyLayoutNode>,
): Record<string, Record<string, LayoutPoint[]>> {
  const routes: Record<string, Record<string, LayoutPoint[]>> = {}
  for (const family of Object.values(tree.families)) {
    const familyNode = families[family.id]
    if (!familyNode) continue
    const start = { x: familyNode.x + NODE_WIDTH / 2, y: familyNode.y + NODE_HEIGHT / 2 }
    routes[family.id] = {}
    for (const childId of family.children) {
      const child = people[childId]
      if (!child) continue
      const end = { x: child.x + NODE_WIDTH / 2, y: child.y }
      routes[family.id][childId] = orthogonalizeRoute(start, [], end)
    }
  }
  return routes
}

function computeFallbackLayout(tree: Tree): TreeLayout {
  const generation = computeGenerations(tree)
  const { ordered } = buildHouseholds(tree)
  const people: Record<string, LayoutNode> = {}
  let cursor = 0
  for (const members of ordered.values()) {
    const width = householdWidth(members.length)
    members.forEach((id, index) => {
      people[id] = {
        id,
        x: cursor + index * (NODE_WIDTH + SPOUSE_GAP),
        y: generation[id] * GENERATION_SPACING_Y,
        generation: generation[id],
      }
    })
    cursor += width + HOUSEHOLD_GAP
  }
  const families: Record<string, FamilyLayoutNode> = {}
  for (const family of Object.values(tree.families)) {
    const children = family.children.map((id) => people[id]).filter(Boolean)
    const fallback = children.length > 0
      ? { x: children.reduce((sum, node) => sum + node.x + NODE_WIDTH / 2, 0) / children.length, y: Math.min(...children.map((node) => node.y)) - RANK_GAP }
      : { x: 0, y: 0 }
    const anchor = familyAnchor(family, people, fallback)
    families[family.id] = { id: family.id, x: anchor.x - NODE_WIDTH / 2, y: anchor.y - NODE_HEIGHT / 2, generation: Math.max(0, ...family.partners.map((p) => generation[p.personId] ?? 0)) }
  }
  const nodes = Object.values(people)
  return {
    people,
    families,
    parentChildRoutes: addFallbackRoutes(tree, people, families),
    width: nodes.length ? Math.max(...nodes.map((node) => node.x + NODE_WIDTH)) : 0,
    height: nodes.length ? Math.max(...nodes.map((node) => node.y + NODE_HEIGHT)) : 0,
  }
}

/** Canonical standard view: Dagre owns ranking, crossing reduction, component
 * geometry, and edge guides. Only card placement within a household and whole-
 * component packing are performed after Dagre. */
export function computeLayout(tree: Tree): TreeLayout {
  const cached = standardLayoutCache.get(tree)
  if (cached) return cached

  const generation = computeGenerations(tree)
  const { ordered: households, personToRoot } = buildHouseholds(tree)
  const { families: canonicalFamilies, canonicalId } = canonicalizeFamilies(tree)
  const personIndex = new Map(Object.keys(tree.people).map((id, index) => [id, index]))
  const householdId = (personId: string) => householdGraphId(personToRoot.get(personId)!)
  const graph = new Graph({ multigraph: true, compound: true })
    .setGraph({
      rankdir: 'TB',
      ranker: 'network-simplex',
      acyclicer: 'greedy',
      nodesep: HOUSEHOLD_GAP,
      edgesep: 28,
      ranksep: RANK_GAP,
      marginx: 0,
      marginy: 0,
    })
    .setDefaultEdgeLabel(() => ({}))

  const componentParent = new Map<string, string>()
  function addComponentNode(id: string): void { if (!componentParent.has(id)) componentParent.set(id, id) }
  function findComponent(id: string): string {
    const parent = componentParent.get(id)!
    if (parent === id) return id
    const root = findComponent(parent)
    componentParent.set(id, root)
    return root
  }
  function joinComponent(a: string, b: string): void {
    const aRoot = findComponent(a)
    const bRoot = findComponent(b)
    if (aRoot !== bRoot) componentParent.set(bRoot, aRoot)
  }

  const householdEntries = [...households.entries()].sort(([, a], [, b]) => {
    const aYear = Math.min(...a.map((id) => birthYear(tree.people[id]?.birthDate) ?? Infinity))
    const bYear = Math.min(...b.map((id) => birthYear(tree.people[id]?.birthDate) ?? Infinity))
    return aYear - bYear || personIndex.get(a[0])! - personIndex.get(b[0])!
  })
  for (const [root, members] of householdEntries) {
    const id = householdGraphId(root)
    graph.setNode(id, { width: householdWidth(members.length), height: NODE_HEIGHT })
    addComponentNode(id)
  }

  const birthFamiliesByHousehold = new Map<string, Set<string>>()
  for (const family of canonicalFamilies) {
    for (const childId of family.children) {
      const childHousehold = householdId(childId)
      const birthFamilies = birthFamiliesByHousehold.get(childHousehold) ?? new Set<string>()
      birthFamilies.add(family.id)
      birthFamiliesByHousehold.set(childHousehold, birthFamilies)
    }
  }
  // A household formed by people from multiple recorded birth families is a
  // bridge between branches. Track it so otherwise-unused rank space can later
  // bring its nuclear family closer without changing Dagre's branch ordering.
  const bridgeHouseholds = new Set(
    [...birthFamiliesByHousehold]
      .filter(([, familyIds]) => familyIds.size > 1)
      .map(([household]) => household),
  )

  // Dagre compound groups make the nuclear family and the two sibling sets joined
  // by a bridge marriage one contiguous neighborhood. Normal weighted family
  // edges still decide rank and position, so routed geometry remains Dagre-owned.
  const clusteredHouseholds = new Set<string>()
  const householdsWithChildren = new Set(canonicalFamilies
    .filter((family) => family.children.length > 0)
    .flatMap((family) => family.partners.map((partner) => householdId(partner.personId))))
  for (const bridgeHousehold of bridgeHouseholds) {
    if (clusteredHouseholds.has(bridgeHousehold)) continue
    const neighborhoodHouseholds = [bridgeHousehold]
    for (const birthFamilyId of birthFamiliesByHousehold.get(bridgeHousehold) ?? []) {
      const birthFamily = canonicalFamilies.find((family) => family.id === birthFamilyId)
      if (birthFamily) {
        neighborhoodHouseholds.push(...birthFamily.partners.map((partner) => householdId(partner.personId)))
        neighborhoodHouseholds.push(...birthFamily.children.map(householdId))
      }
    }
    // Keep one descendant ring with every household just gathered. Without this,
    // pulling a bridge person's siblings inward can leave those siblings' leaf
    // children stranded at their former global positions despite open space below.
    const descendantSources = new Set(neighborhoodHouseholds)
    for (const family of canonicalFamilies) {
      if (family.partners.some((partner) => descendantSources.has(householdId(partner.personId)))) {
        neighborhoodHouseholds.push(...family.children.map(householdId).filter((household) => !householdsWithChildren.has(household)))
      }
    }
    const clusterMembers = [...new Set(neighborhoodHouseholds)]
      .filter((household) => !clusteredHouseholds.has(household))
    if (clusterMembers.length < 2) continue
    const clusterId = `bridge-cluster:${bridgeHousehold}`
    graph.setNode(clusterId, {})
    addComponentNode(clusterId)
    joinComponent(clusterId, bridgeHousehold)
    for (const household of clusterMembers) {
      graph.setParent(household, clusterId)
      clusteredHouseholds.add(household)
    }
  }

  const constraints: Array<{ left: string; right: string }> = []
  const constraintKeys = new Set<string>()
  for (const family of canonicalFamilies) {
    const unionId = familyGraphId(family.id)
    graph.setNode(unionId, { width: UNION_SIZE, height: UNION_SIZE })
    addComponentNode(unionId)
    const partnerHouseholds = [...new Set(family.partners.map((partner) => householdId(partner.personId)))]
    partnerHouseholds.forEach((parentId, index) => {
      graph.setEdge(parentId, unionId, { minlen: 1, weight: 240 }, `partner:${family.id}:${index}`)
      joinComponent(parentId, unionId)
    })

    const orderedChildren = [...family.children].sort((a, b) => {
      const yearDifference = (birthYear(tree.people[a]?.birthDate) ?? Infinity) - (birthYear(tree.people[b]?.birthDate) ?? Infinity)
      return yearDifference || personIndex.get(a)! - personIndex.get(b)!
    })
    const childHouseholds = [...new Set(orderedChildren.map(householdId))]
    childHouseholds.forEach((childId, index) => {
      const childPersonId = orderedChildren.find((id) => householdId(id) === childId)!
      graph.setEdge(unionId, childId, { minlen: 1, weight: 320 }, childEdgeName(family.id, childPersonId))
      joinComponent(unionId, childId)
      if (index > 0) {
        const key = `${childHouseholds[index - 1]}|${childId}`
        if (!constraintKeys.has(key)) {
          constraints.push({ left: childHouseholds[index - 1], right: childId })
          constraintKeys.add(key)
        }
      }
    })
    // Preserve separately named parallel routes when unusual data puts two siblings
    // in the same spouse household.
    for (const childId of orderedChildren) {
      const target = householdId(childId)
      const name = childEdgeName(family.id, childId)
      if (!graph.hasEdge(unionId, target, name)) {
        graph.setEdge(unionId, target, { minlen: 1, weight: 320 }, name)
      }
    }
  }

  try {
    // Constrain deterministic birth ordering for leaf sibling/peer households.
    // Branching siblings remain free for Dagre's crossing reducer to optimize.
    const branchingHouseholds = new Set(canonicalFamilies
      .filter((family) => family.children.length > 0)
      .flatMap((family) => family.partners.map((partner) => householdId(partner.personId))))
    const siblingOrderConstraints = constraints.filter(({ left, right }) =>
      !branchingHouseholds.has(left) && !branchingHouseholds.has(right),
    )
    layoutGraph(graph, { constraints: siblingOrderConstraints })
  } catch {
    const fallback = computeFallbackLayout(tree)
    standardLayoutCache.set(tree, fallback)
    return fallback
  }

  // Dagre may interleave disconnected graphs. Pack its completed components in
  // birth-year order while retaining every component's internal coordinates.
  const graphNodesByComponent = new Map<string, string[]>()
  for (const id of graph.nodes()) {
    const root = findComponent(id)
    graphNodesByComponent.set(root, [...(graphNodesByComponent.get(root) ?? []), id])
  }
  const componentEntries = [...graphNodesByComponent.entries()].map(([root, ids]) => {
    const memberPeople = ids.filter((id) => id.startsWith('household:')).flatMap((id) => households.get(id.slice('household:'.length)) ?? [])
    return {
      root,
      ids,
      year: Math.min(...memberPeople.map((id) => birthYear(tree.people[id]?.birthDate) ?? Infinity)),
      index: Math.min(...memberPeople.map((id) => personIndex.get(id) ?? Infinity)),
    }
  }).sort((a, b) => a.year - b.year || a.index - b.index)

  let componentCursor = 0
  for (const component of componentEntries) {
    const minX = Math.min(...component.ids.map((id) => graph.node(id).x - graph.node(id).width / 2))
    const maxX = Math.max(...component.ids.map((id) => graph.node(id).x + graph.node(id).width / 2))
    const offsetX = componentCursor - minX
    for (const id of component.ids) graph.node(id).x += offsetX
    for (const edge of graph.edges()) {
      if (!component.ids.includes(edge.v)) continue
      const label = graph.edge(edge)
      if (label.points) label.points.forEach((point: LayoutPoint) => { point.x += offsetX })
      if (typeof label.x === 'number') label.x += offsetX
    }
    componentCursor += maxX - minX + COMPONENT_GAP
  }

  // Dagre reserves horizontal columns for dummy edge nodes across the whole graph.
  // A large merged pedigree can therefore contain enormous empty x-intervals.
  // Build one global monotone map that removes those intervals while enforcing the
  // original minimum gap for every pair of adjacent same-rank households. Applying
  // one map to nodes and guides preserves orthogonality and crossing order exactly.
  const householdIds = [...households].map(([root]) => householdGraphId(root))
  const sourceXs = [...new Set(householdIds.map((id) => graph.node(id).x))].sort((a, b) => a - b)
  const sourceIndex = new Map(sourceXs.map((x, index) => [x, index]))
  const minimumDistances = new Map<number, Array<{ fromIndex: number; distance: number }>>()
  const householdRanks = new Map<number, string[]>()
  for (const id of householdIds) {
    const y = graph.node(id).y
    householdRanks.set(y, [...(householdRanks.get(y) ?? []), id])
  }
  for (const ids of householdRanks.values()) {
    ids.sort((a, b) => graph.node(a).x - graph.node(b).x)
    for (let index = 1; index < ids.length; index++) {
      const leftId = ids[index - 1]
      const rightId = ids[index]
      const left = graph.node(leftId)
      const right = graph.node(rightId)
      const gap = findComponent(leftId) === findComponent(rightId) ? HOUSEHOLD_GAP : COMPONENT_GAP
      const toIndex = sourceIndex.get(right.x)!
      minimumDistances.set(toIndex, [
        ...(minimumDistances.get(toIndex) ?? []),
        { fromIndex: sourceIndex.get(left.x)!, distance: left.width / 2 + gap + right.width / 2 },
      ])
    }
  }

  const compactXs: number[] = []
  for (let index = 0; index < sourceXs.length; index++) {
    let compactX = index === 0
      ? sourceXs[0]
      : compactXs[index - 1] + Math.min(64, sourceXs[index] - sourceXs[index - 1])
    for (const constraint of minimumDistances.get(index) ?? []) {
      compactX = Math.max(compactX, compactXs[constraint.fromIndex] + constraint.distance)
    }
    compactXs.push(compactX)
  }

  function compactX(x: number): number {
    if (sourceXs.length === 0) return x
    if (x <= sourceXs[0]) return x + compactXs[0] - sourceXs[0]
    if (x >= sourceXs.at(-1)!) return x + compactXs.at(-1)! - sourceXs.at(-1)!
    const rightIndex = sourceXs.findIndex((sourceX) => sourceX >= x)
    const leftIndex = rightIndex - 1
    const progress = (x - sourceXs[leftIndex]) / (sourceXs[rightIndex] - sourceXs[leftIndex])
    return compactXs[leftIndex] + (compactXs[rightIndex] - compactXs[leftIndex]) * progress
  }

  for (const id of graph.nodes()) graph.node(id).x = compactX(graph.node(id).x)
  for (const edgeId of graph.edges()) {
    const edge = graph.edge(edgeId)
    edge.points?.forEach((point: LayoutPoint) => { point.x = compactX(point.x) })
    if (typeof edge.x === 'number') edge.x = compactX(edge.x)
  }

  // Keep a multiply-married person's partners on the side of their own child
  // branches. Reordering cards inside the fixed Dagre household preserves all
  // crossing-reduced household coordinates.
  for (const [root, members] of households) {
    if (members.length < 3) continue
    const householdCenter = graph.node(householdGraphId(root)).x
    const originalIndex = new Map(members.map((id, index) => [id, index]))
    const branchX = (personId: string): number => {
      const values = canonicalFamilies
        .filter((family) => family.partners.some((partner) => partner.personId === personId))
        .flatMap((family) => family.children)
        .map((childId) => graph.node(householdId(childId))?.x)
        .filter((x): x is number => typeof x === 'number')
      return values.length > 0 ? values.reduce((sum, x) => sum + x, 0) / values.length : householdCenter
    }
    members.sort((a, b) => branchX(a) - branchX(b) || originalIndex.get(a)! - originalIndex.get(b)!)
  }

  const people: Record<string, LayoutNode> = {}
  for (const [root, members] of households) {
    const household = graph.node(householdGraphId(root))
    const startX = household.x - householdWidth(members.length) / 2
    members.forEach((id, index) => {
      people[id] = {
        id,
        x: startX + index * (NODE_WIDTH + SPOUSE_GAP),
        y: household.y - NODE_HEIGHT / 2,
        generation: generation[id] ?? 0,
      }
    })
  }
  optimizeCoupleOrientations(tree, households, people)

  const families: Record<string, FamilyLayoutNode> = {}
  const parentChildRoutes: Record<string, Record<string, LayoutPoint[]>> = {}
  for (const family of canonicalFamilies) {
    const union = graph.node(familyGraphId(family.id))
    const anchor = familyAnchor(family, people, union)
    families[family.id] = {
      id: family.id,
      x: anchor.x - NODE_WIDTH / 2,
      y: anchor.y - NODE_HEIGHT / 2,
      generation: Math.max(0, ...family.partners.map((partner) => generation[partner.personId] ?? 0)),
    }
    parentChildRoutes[family.id] = {}
    for (const childId of family.children) {
      const child = people[childId]
      if (!child) continue
      const edge = graph.edge({ v: familyGraphId(family.id), w: householdId(childId), name: childEdgeName(family.id, childId) })
      const guides = (edge?.points as LayoutPoint[] | undefined) ?? []
      parentChildRoutes[family.id][childId] = orthogonalizeRoute(anchor, guides, {
        x: child.x + NODE_WIDTH / 2,
        y: child.y,
      })
    }
  }

  for (const family of Object.values(tree.families)) {
    const sourceId = canonicalId.get(family.id)!
    if (sourceId === family.id || !families[sourceId]) continue
    families[family.id] = { ...families[sourceId], id: family.id }
    parentChildRoutes[family.id] = Object.fromEntries(Object.entries(parentChildRoutes[sourceId] ?? {}).map(([childId, points]) => [childId, points.map((point) => ({ ...point }))]))
  }

  const allPoints = [
    ...Object.values(people).flatMap((node) => [{ x: node.x, y: node.y }, { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT }]),
    ...Object.values(parentChildRoutes).flatMap((routes) => Object.values(routes).flat()),
  ]
  const minX = allPoints.length ? Math.min(...allPoints.map((point) => point.x)) : 0
  const minY = allPoints.length ? Math.min(...allPoints.map((point) => point.y)) : 0
  const maxX = allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 0
  const maxY = allPoints.length ? Math.max(...allPoints.map((point) => point.y)) : 0
  if (minX !== 0 || minY !== 0) {
    Object.values(people).forEach((node) => { node.x -= minX; node.y -= minY })
    Object.values(families).forEach((node) => { node.x -= minX; node.y -= minY })
    Object.values(parentChildRoutes).forEach((routes) => Object.values(routes).forEach((points) => points.forEach((point) => { point.x -= minX; point.y -= minY })))
  }
  const result: TreeLayout = {
    people,
    families,
    parentChildRoutes,
    width: maxX - minX,
    height: maxY - minY,
  }
  standardLayoutCache.set(tree, result)
  return result
}
