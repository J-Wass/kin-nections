import type { Family } from '../model/types'
import type { LayoutNode } from './treeLayout'

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export function familyRenderKey(family: Family): string {
  const partners = family.partners
    .map((partner) => `${partner.personId}:${partner.role}`)
    .sort()
    .join(',')
  return `${partners}|${family.status}|${[...family.children].sort().join(',')}`
}

export function uniqueRenderableFamilies(families: Family[], visibleFamilyIds: Set<string>): Family[] {
  const seen = new Set<string>()
  return families.filter((family) => {
    if (!visibleFamilyIds.has(family.id)) return false
    const key = familyRenderKey(family)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function computeFitBounds(
  nodes: LayoutNode[],
  nodeWidth: number,
  nodeHeight: number,
  padding: number,
  focusNode?: LayoutNode,
): ViewBox {
  if (nodes.length === 0) return { x: 0, y: 0, w: 1000, h: 700 }
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + nodeWidth))
  const maxY = Math.max(...nodes.map((node) => node.y + nodeHeight))

  let boundsMinX = minX
  let boundsMaxX = maxX
  if (focusNode) {
    const focusCenterX = focusNode.x + nodeWidth / 2
    const horizontalExtent = Math.max(focusCenterX - minX, maxX - focusCenterX)
    boundsMinX = focusCenterX - horizontalExtent
    boundsMaxX = focusCenterX + horizontalExtent
  }
  return {
    x: boundsMinX,
    y: minY,
    w: boundsMaxX - boundsMinX + padding * 2,
    h: maxY - minY + padding * 2,
  }
}

export function buildChildBranchPath(family: Point, children: Point[]): string {
  if (children.length === 0) return ''
  const nearestChildY = Math.min(...children.map((child) => child.y))
  const verticalGap = nearestChildY - family.y
  const stemLength = Math.sign(verticalGap) * Math.min(56, Math.abs(verticalGap) / 3)
  const forkY = family.y + stemLength
  const segments = [`M ${family.x} ${family.y} V ${forkY}`]

  for (const child of children) {
    const remainingGap = child.y - forkY
    const terminalLength = Math.sign(remainingGap) * Math.min(42, Math.abs(remainingGap) / 4)
    const arrivalY = child.y - terminalLength
    const startControlY = forkY + (arrivalY - forkY) * 0.35
    const endControlY = forkY + (arrivalY - forkY) * 0.75
    segments.push(`M ${family.x} ${forkY} C ${family.x} ${startControlY}, ${child.x} ${endControlY}, ${child.x} ${arrivalY} V ${child.y}`)
  }
  return segments.join(' ')
}

/** Converts an orthogonal point list into an SVG path with compact quadratic
 * corners. The first and last coordinates are retained exactly for markers. */
export function buildRoundedOrthogonalPath(points: Point[], radius = 16): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    const incomingLength = Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y)
    const outgoingLength = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y)
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2)
    if (cornerRadius <= 0) {
      commands.push(`L ${corner.x} ${corner.y}`)
      continue
    }
    const before = {
      x: corner.x - Math.sign(corner.x - previous.x) * cornerRadius,
      y: corner.y - Math.sign(corner.y - previous.y) * cornerRadius,
    }
    const after = {
      x: corner.x + Math.sign(next.x - corner.x) * cornerRadius,
      y: corner.y + Math.sign(next.y - corner.y) * cornerRadius,
    }
    commands.push(`L ${before.x} ${before.y}`, `Q ${corner.x} ${corner.y} ${after.x} ${after.y}`)
  }
  const end = points[points.length - 1]
  commands.push(`L ${end.x} ${end.y}`)
  return commands.join(' ')
}

/** Keeps Dagre's rounded orthogonal route for local and long-rank connections, but
 * replaces a very wide single-generation rail with a monotone curved branch. This
 * preserves exact endpoints while avoiding a horizontal line across the canvas. */
export function buildAdaptiveChildPath(
  points: Point[],
  maxHorizontalSegment = 1400,
  maxVerticalSpan = 450,
): string {
  if (points.length < 2) return buildRoundedOrthogonalPath(points)
  const first = points[0]
  const last = points.at(-1)!
  const longestHorizontal = Math.max(0, ...points.slice(1).map((point, index) =>
    point.y === points[index].y ? Math.abs(point.x - points[index].x) : 0,
  ))
  if (longestHorizontal > maxHorizontalSegment && Math.abs(last.y - first.y) <= maxVerticalSpan) {
    return buildChildBranchPath(first, [last])
  }
  return buildRoundedOrthogonalPath(points)
}

export function panUnitsPerPixel(viewBox: Pick<ViewBox, 'w' | 'h'>, viewportWidth: number, viewportHeight: number): number {
  return Math.max(viewBox.w / viewportWidth, viewBox.h / viewportHeight)
}
