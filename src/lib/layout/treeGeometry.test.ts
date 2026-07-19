import { describe, expect, it } from 'vitest'
import type { Family } from '../model/types'
import { buildChildBranchPath, computeFitBounds, panUnitsPerPixel, uniqueRenderableFamilies } from './treeGeometry'

describe('treeGeometry', () => {
  it('deduplicates equivalent rendered families regardless of partner order', () => {
    const familyA: Family = {
      id: 'a', status: 'married',
      partners: [{ personId: 'p1', role: 'spouse' }, { personId: 'p2', role: 'spouse' }],
      children: ['c'],
    }
    const familyB: Family = {
      ...familyA, id: 'b', partners: [...familyA.partners].reverse(),
    }
    expect(uniqueRenderableFamilies([familyA, familyB], new Set(['a', 'b']))).toEqual([familyA])
  })

  it('makes focused bounds horizontally symmetric around the focused node', () => {
    const focus = { id: 'focus', x: 100, y: 0, generation: 0 }
    const bounds = computeFitBounds([
      { id: 'left', x: -500, y: 0, generation: 0 },
      focus,
      { id: 'right', x: 300, y: 200, generation: 1 },
    ], 100, 120, 50, focus)
    const focusCenter = focus.x + 50
    expect(focusCenter - bounds.x).toBeCloseTo(bounds.w - 100 - (focusCenter - bounds.x))
  })

  it('builds one curved branch per child without a horizontal rail', () => {
    const path = buildChildBranchPath({ x: 10, y: 20 }, [{ x: 0, y: 100 }, { x: 50, y: 100 }])
    expect(path.match(/ C /g)).toHaveLength(2)
    expect(path).not.toContain(' H ')
  })

  it('uses the uniform SVG scale for both pan axes', () => {
    expect(panUnitsPerPixel({ w: 1000, h: 500 }, 500, 500)).toBe(2)
    expect(panUnitsPerPixel({ w: 500, h: 1000 }, 500, 500)).toBe(2)
  })
})
