import type { FamilyStatus, Tree } from '../model/types'
import { createEmptyTree } from '../model/types'
import { addPerson, addSpouse, setParents, updateFamilyStatus, updatePerson } from '../model/treeOps'

export interface PositionedLine {
  text: string
  x: number
}

export interface DepthLine {
  text: string
  depth: number
}

const DEFAULT_X_TOLERANCE = 3

/** Clusters distinct x-offsets into ordered indentation depths (0 = shallowest),
 * tolerating small positioning noise between lines that are meant to align. */
export function inferDepths(lines: PositionedLine[], tolerance = DEFAULT_X_TOLERANCE): DepthLine[] {
  const distinctXs = [...new Set(lines.map((l) => l.x))].sort((a, b) => a - b)
  const clusters: number[] = []
  for (const x of distinctXs) {
    if (clusters.length === 0 || x - clusters[clusters.length - 1] > tolerance) {
      clusters.push(x)
    }
  }

  const depthOf = (x: number): number => {
    let best = 0
    let bestDist = Infinity
    clusters.forEach((clusterX, idx) => {
      const dist = Math.abs(x - clusterX)
      if (dist < bestDist) {
        bestDist = dist
        best = idx
      }
    })
    return best
  }

  return lines.map((line) => ({ text: line.text, depth: depthOf(line.x) }))
}

function appendNote(existing: string | undefined, line: string): string {
  return existing ? `${existing}\n${line}` : line
}

function splitDatePlace(raw: string): { date?: string; place?: string } {
  const idx = raw.indexOf(',')
  if (idx === -1) {
    const date = raw.trim()
    return date ? { date } : {}
  }
  const date = raw.slice(0, idx).trim()
  const place = raw.slice(idx + 1).trim()
  return { date: date || undefined, place: place || undefined }
}

/** Splits "First Middle Last" into firstName/lastName using "last word = surname",
 * which handles multi-word first names and parenthetical nicknames reasonably. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { firstName: fullName.trim(), lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

const SPOUSE_RE = /^&\s*(.+)$/
const BIRTH_RE = /^b\.\s*(.+)$/i
const DEATH_RE = /^d\.\s*(.+)$/i
const BIRTHPLACE_ONLY_RE = /^bp\.\s*(.+)$/i
const DEATHPLACE_ONLY_RE = /^dp\.\s*(.+)$/i
const MARRIAGE_RE = /^m\.\s*(.+)$/i

interface StackEntry {
  depth: number
  personId: string
  spouseId: string | null
}

/**
 * Parses a "Register"-style indented descendant report (name / optional b. and d.
 * lines / optional "& spouse" with their own b./d. / optional "m." line, repeated
 * recursively for children at the next depth) into a Tree.
 *
 * Note: this does not deduplicate repeated names (e.g. an ancestor listed twice for
 * two marriages, or a name reused across generations) — same-name people are common
 * in real genealogies and are NOT reliably the same person, so merging by name would
 * be more dangerous than leaving occasional duplicates for the user to merge by hand.
 */
export function parseRegisterReport(lines: DepthLine[], treeName = 'Imported tree'): Tree {
  let tree = createEmptyTree(`tree_${Date.now()}`, treeName)

  const stack: StackEntry[] = []
  let currentPersonId: string | null = null
  let currentSpouseId: string | null = null
  let currentFamilyId: string | null = null
  let lastOpenField: 'person' | 'spouse' = 'person'

  for (const line of lines) {
    const text = line.text.trim()
    if (!text) continue

    const spouseMatch = SPOUSE_RE.exec(text)
    const birthMatch = BIRTH_RE.exec(text)
    const deathMatch = DEATH_RE.exec(text)
    const birthPlaceMatch = BIRTHPLACE_ONLY_RE.exec(text)
    const deathPlaceMatch = DEATHPLACE_ONLY_RE.exec(text)
    const marriageMatch = MARRIAGE_RE.exec(text)

    if (spouseMatch) {
      if (!currentPersonId) continue
      const { firstName, lastName } = splitName(spouseMatch[1])
      const added = addPerson(tree, { firstName, lastName })
      tree = added.tree
      currentSpouseId = added.person.id
      lastOpenField = 'spouse'

      const top = stack[stack.length - 1]
      if (top && top.personId === currentPersonId) top.spouseId = currentSpouseId

      const spouseResult = addSpouse(tree, currentPersonId, currentSpouseId, 'married')
      tree = spouseResult.tree
      currentFamilyId = spouseResult.family.id
      continue
    }

    if (birthMatch) {
      const targetId = lastOpenField === 'spouse' ? currentSpouseId : currentPersonId
      if (targetId) {
        const { date, place } = splitDatePlace(birthMatch[1])
        tree = updatePerson(tree, targetId, { birthDate: date, birthPlace: place })
      }
      continue
    }

    if (deathMatch) {
      const targetId = lastOpenField === 'spouse' ? currentSpouseId : currentPersonId
      if (targetId) {
        const { date, place } = splitDatePlace(deathMatch[1])
        const notes = place ? appendNote(tree.people[targetId]?.notes, `Died in ${place}`) : tree.people[targetId]?.notes ?? ''
        tree = updatePerson(tree, targetId, { deathDate: date, isLiving: false, notes })
      }
      continue
    }

    if (birthPlaceMatch) {
      const targetId = lastOpenField === 'spouse' ? currentSpouseId : currentPersonId
      if (targetId) tree = updatePerson(tree, targetId, { birthPlace: birthPlaceMatch[1].trim() })
      continue
    }

    if (deathPlaceMatch) {
      const targetId = lastOpenField === 'spouse' ? currentSpouseId : currentPersonId
      if (targetId) {
        const notes = appendNote(tree.people[targetId]?.notes, `Died in ${deathPlaceMatch[1].trim()}`)
        tree = updatePerson(tree, targetId, { isLiving: false, notes })
      }
      continue
    }

    if (marriageMatch) {
      if (currentFamilyId) {
        const status: FamilyStatus = marriageMatch[1].trim() === '?' ? 'unknown' : 'married'
        tree = updateFamilyStatus(tree, currentFamilyId, status)
      }
      continue
    }

    // Plain line: a new person's name. Pop the stack back to this line's parent level.
    while (stack.length > 0 && stack[stack.length - 1].depth >= line.depth) {
      stack.pop()
    }

    const { firstName, lastName } = splitName(text)
    const added = addPerson(tree, { firstName, lastName })
    tree = added.tree

    const parent = stack[stack.length - 1]
    if (parent) {
      const parentIds = [parent.personId, parent.spouseId].filter((id): id is string => Boolean(id))
      tree = setParents(tree, added.person.id, parentIds)
    }

    stack.push({ depth: line.depth, personId: added.person.id, spouseId: null })
    currentPersonId = added.person.id
    currentSpouseId = null
    currentFamilyId = null
    lastOpenField = 'person'
  }

  return tree
}
