import type { Tree } from '../model/types'
import { NODE_HEIGHT, NODE_WIDTH, computeLayout, type LayoutPoint, type TreeLayout } from './treeLayout'

export interface LayoutBenchmarkMetrics {
  people: number
  families: number
  crossings: number
  edgeCardIntersections: number
  siblingGapMean: number
  siblingGapMax: number
  routeLength: number
  canvasWidth: number
  canvasHeight: number
  layoutMs: number
}

interface Segment {
  a: LayoutPoint
  b: LayoutPoint
  familyId: string
  childId: string
  routeId: string
}

function routeSegments(tree: Tree, layout: TreeLayout): Segment[] {
  const segments: Segment[] = []
  const seenFamilies = new Set<string>()
  for (const [familyId, routes] of Object.entries(layout.parentChildRoutes)) {
    const family = tree.families[familyId]
    if (!family) continue
    const familyKey = `${family.partners.map((partner) => `${partner.personId}:${partner.role}`).sort().join(',')}|${family.status}|${[...family.children].sort().join(',')}`
    if (seenFamilies.has(familyKey)) continue
    seenFamilies.add(familyKey)
    for (const [childId, points] of Object.entries(routes)) {
      for (let index = 1; index < points.length; index++) {
        segments.push({ a: points[index - 1], b: points[index], familyId, childId, routeId: `${familyId}:${childId}` })
      }
    }
  }
  return segments
}

function segmentIntersection(a: Segment, b: Segment): LayoutPoint | null {
  const aDx = a.b.x - a.a.x
  const aDy = a.b.y - a.a.y
  const bDx = b.b.x - b.a.x
  const bDy = b.b.y - b.a.y
  const denominator = aDx * bDy - aDy * bDx
  if (Math.abs(denominator) < 1e-9) return null
  const offsetX = b.a.x - a.a.x
  const offsetY = b.a.y - a.a.y
  const aRatio = (offsetX * bDy - offsetY * bDx) / denominator
  const bRatio = (offsetX * aDy - offsetY * aDx) / denominator
  if (aRatio < 0 || aRatio > 1 || bRatio < 0 || bRatio > 1) return null
  return { x: a.a.x + aRatio * aDx, y: a.a.y + aRatio * aDy }
}

function intersectsCard(segment: Segment, x: number, y: number, nodeWidth: number, nodeHeight: number): boolean {
  const inside = (point: LayoutPoint) => point.x > x && point.x < x + nodeWidth && point.y > y && point.y < y + nodeHeight
  if (inside(segment.a) || inside(segment.b)) return true
  const sides: Segment[] = [
    { ...segment, a: { x, y }, b: { x: x + nodeWidth, y } },
    { ...segment, a: { x: x + nodeWidth, y }, b: { x: x + nodeWidth, y: y + nodeHeight } },
    { ...segment, a: { x: x + nodeWidth, y: y + nodeHeight }, b: { x, y: y + nodeHeight } },
    { ...segment, a: { x, y: y + nodeHeight }, b: { x, y } },
  ]
  return sides.some((side) => segmentIntersection(segment, side) !== null)
}

export function measureTreeLayout(
  tree: Tree,
  layout: TreeLayout,
  layoutMs: number,
  dimensions = { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT },
): LayoutBenchmarkMetrics {
  const segments = routeSegments(tree, layout)
  const householdParent = new Map(Object.keys(tree.people).map((id) => [id, id]))
  const findHousehold = (id: string): string => {
    const parent = householdParent.get(id) ?? id
    if (parent === id) return id
    const root = findHousehold(parent)
    householdParent.set(id, root)
    return root
  }
  for (const family of Object.values(tree.families)) {
    const partnerIds = family.partners.map((partner) => partner.personId).filter((id) => householdParent.has(id))
    if (partnerIds.length > 1) {
      const root = findHousehold(partnerIds[0])
      for (const partnerId of partnerIds.slice(1)) householdParent.set(findHousehold(partnerId), root)
    }
  }
  const crossingRoutePairs = new Set<string>()
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]
      const b = segments[j]
      // Routes sharing a family-union source form one logical fan-out. Their
      // shared stems and departure bends are junctions, not edge crossings.
      if (a.familyId === b.familyId) continue
      // Spouses are one composite Dagre household; edges incident to that shared
      // target node meet rather than cross.
      if (findHousehold(a.childId) === findHousehold(b.childId)) continue
      const point = segmentIntersection(a, b)
      if (!point) continue
      // Compaction can produce fractional coordinates, so a mathematically shared
      // endpoint may differ by floating-point noise after intersection arithmetic.
      const isEndpoint = (candidate: LayoutPoint) =>
        Math.abs(candidate.x - point.x) < 1e-6 && Math.abs(candidate.y - point.y) < 1e-6
      const aEndpoint = [a.a, a.b].some(isEndpoint)
      const bEndpoint = [b.a, b.b].some(isEndpoint)
      // A path ending or bending on another segment is a touch/junction. Count
      // only proper interior-interior crossings.
      if (!(aEndpoint || bEndpoint)) {
        crossingRoutePairs.add(a.routeId < b.routeId ? `${a.routeId}|${b.routeId}` : `${b.routeId}|${a.routeId}`)
      }
    }
  }

  let edgeCardIntersections = 0
  for (const segment of segments) {
    const family = tree.families[segment.familyId]
    const related = new Set([segment.childId, ...(family?.partners.map((partner) => partner.personId) ?? [])])
    for (const node of Object.values(layout.people)) {
      if (!related.has(node.id) && intersectsCard(segment, node.x, node.y, dimensions.nodeWidth, dimensions.nodeHeight)) edgeCardIntersections++
    }
  }

  const siblingGaps: number[] = []
  for (const family of Object.values(tree.families)) {
    const childXs = family.children.map((id) => layout.people[id]?.x).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b)
    for (let index = 1; index < childXs.length; index++) siblingGaps.push(childXs[index] - childXs[index - 1] - dimensions.nodeWidth)
  }
  const routeLength = segments.reduce((sum, segment) => sum + Math.abs(segment.b.x - segment.a.x) + Math.abs(segment.b.y - segment.a.y), 0)
  return {
    people: Object.keys(layout.people).length,
    families: Object.keys(layout.families).length,
    crossings: crossingRoutePairs.size,
    edgeCardIntersections,
    siblingGapMean: siblingGaps.length ? siblingGaps.reduce((sum, gap) => sum + gap, 0) / siblingGaps.length : 0,
    siblingGapMax: siblingGaps.length ? Math.max(...siblingGaps) : 0,
    routeLength,
    canvasWidth: layout.width,
    canvasHeight: layout.height,
    layoutMs,
  }
}

export function measureLayout(tree: Tree): LayoutBenchmarkMetrics {
  const started = performance.now()
  const layout = computeLayout(tree)
  return measureTreeLayout(tree, layout, performance.now() - started)
}
