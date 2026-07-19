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
  const stemLength = Math.sign(verticalGap) * Math.min(32, Math.abs(verticalGap) / 3)
  const forkY = family.y + stemLength
  const segments = [`M ${family.x} ${family.y} V ${forkY}`]

  for (const child of children) {
    const startControlY = forkY + (child.y - forkY) * 0.3
    const endControlY = forkY + (child.y - forkY) * 0.7
    segments.push(`M ${family.x} ${forkY} C ${family.x} ${startControlY}, ${child.x} ${endControlY}, ${child.x} ${child.y}`)
  }
  return segments.join(' ')
}

export function panUnitsPerPixel(viewBox: Pick<ViewBox, 'w' | 'h'>, viewportWidth: number, viewportHeight: number): number {
  return Math.max(viewBox.w / viewportWidth, viewBox.h / viewportHeight)
}
