import type { KinshipResult } from './kinship'

export type FocusCloseness = 'focus' | 'near' | 'extended' | 'remote' | 'none'

const EXTENDED_RELATIONSHIPS = new Set([
  'Grandparent',
  'Grandchild',
  'Aunt/Uncle',
  'Niece/Nephew',
  'First cousin',
])

// This includes second cousins (six family hops) and several generations of
// direct ancestry, then lets still-more-distant relationships fade to neutral.
const MAX_REMOTE_COLOR_STEPS = 6

export function focusCloseness(
  focusPersonId: string,
  personId: string,
  immediateFamilyIds: Set<string>,
  relationship?: KinshipResult | null,
): FocusCloseness {
  if (personId === focusPersonId) return 'focus'
  if (immediateFamilyIds.has(personId)) return 'near'
  if (!relationship || relationship.label === 'No known relation') return 'none'
  if (EXTENDED_RELATIONSHIPS.has(relationship.label)) return 'extended'
  if (relationship.path.length <= MAX_REMOTE_COLOR_STEPS) return 'remote'
  return 'none'
}

const DISTANCE: Record<FocusCloseness, number> = {
  focus: 0,
  near: 0,
  extended: 1,
  remote: 2,
  none: 3,
}

export function farthestCloseness(tiers: FocusCloseness[]): Exclude<FocusCloseness, 'focus'> {
  let result: Exclude<FocusCloseness, 'focus'> = 'near'
  for (const tier of tiers) {
    const normalized = tier === 'focus' ? 'near' : tier
    if (DISTANCE[normalized] > DISTANCE[result]) result = normalized
  }
  return result
}
