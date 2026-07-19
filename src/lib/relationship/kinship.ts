import type { Tree } from '../model/types'
import { getParentsOf } from '../model/treeOps'

type EdgeType = 'parent' | 'child' | 'spouse' | 'exSpouse' | 'sibling'

interface Edge {
  to: string
  type: EdgeType
}

export interface KinshipResult {
  /** Human-readable relationship label, e.g. "Grandparent", "1st cousin once removed". */
  label: string
  /** Raw sequence of relation hops used to derive the label, for debugging/tests. */
  path: EdgeType[]
}

const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`
}

function greatPrefix(count: number): string {
  return count > 0 ? `${'great-'.repeat(count)}` : ''
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildAdjacency(tree: Tree): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>()
  const link = (a: string, b: string, type: EdgeType) => {
    if (!graph.has(a)) graph.set(a, [])
    graph.get(a)!.push({ to: b, type })
  }

  for (const family of Object.values(tree.families)) {
    const partnerIds = family.partners.map((p) => p.personId)
    const spouseType: EdgeType = family.status === 'divorced' ? 'exSpouse' : 'spouse'
    if (partnerIds.length === 2) {
      const [a, b] = partnerIds
      link(a, b, spouseType)
      link(b, a, spouseType)
    }
    for (const parentId of partnerIds) {
      for (const childId of family.children) {
        link(parentId, childId, 'child')
        link(childId, parentId, 'parent')
      }
    }
    // A parents-unknown family (0 partners) only records a sibling grouping;
    // link those children directly since there's no shared parent to route through.
    if (partnerIds.length === 0) {
      for (const a of family.children) {
        for (const b of family.children) {
          if (a !== b) link(a, b, 'sibling')
        }
      }
    }
  }
  return graph
}

/** Shortest path (as a sequence of edge types) from `fromId` to `toId`, or null if unreachable. */
function shortestPath(graph: Map<string, Edge[]>, fromId: string, toId: string): EdgeType[] | null {
  if (fromId === toId) return []
  const visited = new Set<string>([fromId])
  const queue: { id: string; path: EdgeType[] }[] = [{ id: fromId, path: [] }]

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = graph.get(current.id) ?? []
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue
      const nextPath = [...current.path, edge.type]
      if (edge.to === toId) return nextPath
      visited.add(edge.to)
      queue.push({ id: edge.to, path: nextPath })
    }
  }
  return null
}

function shortestPathsFrom(graph: Map<string, Edge[]>, fromId: string): Map<string, EdgeType[]> {
  const paths = new Map<string, EdgeType[]>([[fromId, []]])
  const queue = [fromId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentPath = paths.get(currentId)!
    for (const edge of graph.get(currentId) ?? []) {
      if (paths.has(edge.to)) continue
      paths.set(edge.to, [...currentPath, edge.type])
      queue.push(edge.to)
    }
  }
  return paths
}

function isRun(path: EdgeType[], type: EdgeType): boolean {
  return path.length > 0 && path.every((step) => step === type)
}

function ancestorDescentLabel(up: number, down: number, isHalf: boolean): string {
  if (up === 1 && down === 1) return isHalf ? 'Half-sibling' : 'Sibling'
  if (up === 2 && down === 1) return 'Aunt/Uncle'
  if (up === 1 && down === 2) return 'Niece/Nephew'
  if (up >= 3 && down === 1) return `${capitalize(greatPrefix(up - 2))}grand-aunt/uncle`
  if (up === 1 && down >= 3) return `${capitalize(greatPrefix(down - 2))}grand-niece/nephew`

  const degree = Math.min(up, down) - 1
  const removed = Math.abs(up - down)
  const ord = ordinal(degree)
  const base = `${ord.charAt(0).toUpperCase()}${ord.slice(1)} cousin`
  return removed > 0 ? `${base}, ${removed} time${removed > 1 ? 's' : ''} removed` : base
}

function classifyBloodPath(path: EdgeType[], startId: string, endId: string, tree: Tree): string | null {
  if (path.length === 0) return 'Self'
  if (isRun(path, 'parent')) {
    const n = path.length
    if (n === 1) return 'Parent'
    if (n === 2) return 'Grandparent'
    return `${capitalize(greatPrefix(n - 2))}grandparent`
  }
  if (isRun(path, 'child')) {
    const n = path.length
    if (n === 1) return 'Child'
    if (n === 2) return 'Grandchild'
    return `${capitalize(greatPrefix(n - 2))}grandchild`
  }

  const firstNonParentIdx = path.findIndex((step) => step !== 'parent')
  const up = firstNonParentIdx === -1 ? path.length : firstNonParentIdx
  const downPart = path.slice(up)
  if (up > 0 && downPart.length > 0 && downPart.every((step) => step === 'child')) {
    const down = downPart.length
    let isHalf = false
    if (up === 1 && down === 1) {
      const startParents = new Set(getParentsOf(tree, startId).map((p) => p.id))
      const endParents = new Set(getParentsOf(tree, endId).map((p) => p.id))
      const shared = [...startParents].filter((id) => endParents.has(id))
      isHalf = shared.length === 1
    }
    return ancestorDescentLabel(up, down, isHalf)
  }
  return null
}

/** Exact-match patterns for short paths that mix a marital hop with a blood hop. */
function classifyMixedShortPath(path: EdgeType[]): string | null {
  const key = path.join('>')
  const table: Record<string, string> = {
    'spouse': 'Spouse',
    'exSpouse': 'Ex-spouse',
    'sibling': 'Sibling',
    'parent>spouse': 'Step-parent',
    'child>spouse': 'Child-in-law',
    'spouse>parent': 'Parent-in-law',
    'spouse>child': 'Step-child',
  }
  return table[key] ?? null
}

function classifyRelationship(tree: Tree, fromId: string, toId: string, path: EdgeType[] | null): KinshipResult {
  if (path === null) return { label: 'No known relation', path: [] }
  if (path.length === 0) return { label: 'Self', path: [] }

  const mixedExact = classifyMixedShortPath(path)
  if (mixedExact) return { label: mixedExact, path }

  const hasLeadingSpouse = path[0] === 'spouse' || path[0] === 'exSpouse'
  const hasTrailingSpouse = path[path.length - 1] === 'spouse' || path[path.length - 1] === 'exSpouse'

  if (hasLeadingSpouse && !hasTrailingSpouse) {
    const inner = classifyBloodPath(path.slice(1), fromId, toId, tree)
    if (inner) return { label: `${inner}-in-law`, path }
  } else if (hasTrailingSpouse && !hasLeadingSpouse) {
    const inner = classifyBloodPath(path.slice(0, -1), fromId, toId, tree)
    if (inner) return { label: `${inner}-in-law`, path }
  } else if (!hasLeadingSpouse && !hasTrailingSpouse) {
    const inner = classifyBloodPath(path, fromId, toId, tree)
    if (inner) return { label: inner, path }
  }

  return { label: `Related (${path.length} steps)`, path }
}

export function describeRelationship(tree: Tree, fromId: string, toId: string): KinshipResult {
  const graph = buildAdjacency(tree)
  return classifyRelationship(tree, fromId, toId, shortestPath(graph, fromId, toId))
}

/** Computes every reachable person's relationship label relative to `fromId`. */
export function describeAllRelationships(tree: Tree, fromId: string): Record<string, KinshipResult> {
  const paths = shortestPathsFrom(buildAdjacency(tree), fromId)
  const result: Record<string, KinshipResult> = {}
  for (const personId of Object.keys(tree.people)) {
    if (personId === fromId) continue
    result[personId] = classifyRelationship(tree, fromId, personId, paths.get(personId) ?? null)
  }
  return result
}
