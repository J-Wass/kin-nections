export type Sex = 'M' | 'F' | 'unknown'

export type FamilyStatus = 'married' | 'partnered' | 'divorced' | 'widowed' | 'unknown'

export type PartnerRole = 'spouse' | 'partner'

export interface Partner {
  personId: string
  role: PartnerRole
}

export interface Person {
  id: string
  firstName: string
  lastName: string
  nickname?: string
  sex: Sex
  birthDate?: string
  deathDate?: string
  birthPlace?: string
  isLiving?: boolean
  /** Placeholder for a known-to-exist but unidentified relative (e.g. "Unknown Father"). */
  isPlaceholder?: boolean
  notes: string
  customFields?: Record<string, string>
}

export interface Family {
  id: string
  /** 0, 1, or 2 partners. 0 partners = a sibling group with unknown parents. */
  partners: Partner[]
  status: FamilyStatus
  children: string[]
}

export interface Tree {
  id: string
  name: string
  people: Record<string, Person>
  families: Record<string, Family>
  createdAt: string
  updatedAt: string
}

export function createEmptyTree(id: string, name: string): Tree {
  const now = new Date().toISOString()
  return {
    id,
    name,
    people: {},
    families: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function createPerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    firstName: '',
    lastName: '',
    sex: 'unknown',
    notes: '',
    ...overrides,
  }
}
