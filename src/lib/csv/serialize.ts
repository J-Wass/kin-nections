import type { Tree } from '../model/types'
import { getParentsOf, getSpousesOf } from '../model/treeOps'
import { toCsvRow } from './csvUtil'

export const CSV_COLUMNS = [
  'id',
  'firstName',
  'lastName',
  'nickname',
  'sex',
  'birthDate',
  'deathDate',
  'birthPlace',
  'isLiving',
  'isPlaceholder',
  'notes',
  'parent1Id',
  'parent2Id',
  'spouseIds',
  'exSpouseIds',
  'siblingGroupId',
] as const

function boolField(value: boolean | undefined): string {
  return value === undefined ? '' : String(value)
}

export function serializeCsv(tree: Tree): string {
  const rows: string[][] = [Array.from(CSV_COLUMNS)]

  for (const person of Object.values(tree.people)) {
    const parents = getParentsOf(tree, person.id)
    const spouses = getSpousesOf(tree, person.id)
    const spouseIds = spouses.filter((s) => s.status !== 'divorced').map((s) => s.person.id)
    const exSpouseIds = spouses.filter((s) => s.status === 'divorced').map((s) => s.person.id)

    const siblingFamily = Object.values(tree.families).find(
      (f) => f.partners.length === 0 && f.children.includes(person.id),
    )

    rows.push([
      person.id,
      person.firstName,
      person.lastName,
      person.nickname ?? '',
      person.sex,
      person.birthDate ?? '',
      person.deathDate ?? '',
      person.birthPlace ?? '',
      boolField(person.isLiving),
      boolField(person.isPlaceholder),
      person.notes,
      parents[0]?.id ?? '',
      parents[1]?.id ?? '',
      spouseIds.join(';'),
      exSpouseIds.join(';'),
      siblingFamily?.id ?? '',
    ])
  }

  return rows.map(toCsvRow).join('\n')
}
