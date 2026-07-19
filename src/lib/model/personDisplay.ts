import type { Person } from './types'

export function formatPersonName(person: Person): string {
  const name = `${person.firstName} ${person.lastName}`.trim()
  if (name) return name
  return person.isPlaceholder ? 'Unknown' : 'Unnamed'
}
