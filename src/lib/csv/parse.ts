import type { Person, Sex, Tree } from '../model/types'
import { createEmptyTree } from '../model/types'
import { addSpouse, createFamily, markDivorced, setParents } from '../model/treeOps'
import { CSV_COLUMNS } from './serialize'
import { parseCsv } from './csvUtil'

function parseBool(value: string): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parseSex(value: string): Sex {
  return value === 'M' || value === 'F' ? value : 'unknown'
}

export function parseCsvTree(text: string, treeName = 'Imported tree'): Tree {
  const rows = parseCsv(text)
  if (rows.length === 0) return createEmptyTree(`tree_${Date.now()}`, treeName)

  const header = rows[0]
  const colIndex = new Map(header.map((name, i) => [name, i]))
  const get = (row: string[], name: (typeof CSV_COLUMNS)[number]): string => {
    const idx = colIndex.get(name)
    return idx === undefined ? '' : (row[idx] ?? '')
  }

  let tree = createEmptyTree(`tree_${Date.now()}`, treeName)

  const dataRows = rows.slice(1)

  for (const row of dataRows) {
    const id = get(row, 'id')
    if (!id) continue
    const person: Person = {
      id,
      firstName: get(row, 'firstName'),
      lastName: get(row, 'lastName'),
      nickname: get(row, 'nickname') || undefined,
      sex: parseSex(get(row, 'sex')),
      birthDate: get(row, 'birthDate') || undefined,
      deathDate: get(row, 'deathDate') || undefined,
      birthPlace: get(row, 'birthPlace') || undefined,
      isLiving: parseBool(get(row, 'isLiving')),
      isPlaceholder: parseBool(get(row, 'isPlaceholder')),
      notes: get(row, 'notes'),
    }
    tree.people[id] = person
  }

  const siblingGroups = new Map<string, string[]>()

  for (const row of dataRows) {
    const id = get(row, 'id')
    if (!id || !tree.people[id]) continue

    const parent1 = get(row, 'parent1Id')
    const parent2 = get(row, 'parent2Id')
    const parentIds = [parent1, parent2].filter((p) => p && tree.people[p])
    if (parentIds.length > 0) {
      tree = setParents(tree, id, parentIds)
    } else {
      const groupId = get(row, 'siblingGroupId')
      if (groupId) {
        if (!siblingGroups.has(groupId)) siblingGroups.set(groupId, [])
        siblingGroups.get(groupId)!.push(id)
      }
    }

    const spouseIds = get(row, 'spouseIds').split(';').filter((s) => s && tree.people[s])
    for (const spouseId of spouseIds) {
      tree = addSpouse(tree, id, spouseId, 'married').tree
    }

    const exSpouseIds = get(row, 'exSpouseIds').split(';').filter((s) => s && tree.people[s])
    for (const exSpouseId of exSpouseIds) {
      tree = addSpouse(tree, id, exSpouseId, 'divorced').tree
      tree = markDivorced(tree, id, exSpouseId)
    }
  }

  for (const memberIds of siblingGroups.values()) {
    if (memberIds.length > 1) {
      tree = createFamily(tree, { partners: [], children: memberIds }).tree
    }
  }

  return tree
}
