import type { FamilyStatus, PartnerRole, Sex, Tree } from './types'

const SEXES = new Set<Sex>(['M', 'F', 'unknown'])
const FAMILY_STATUSES = new Set<FamilyStatus>(['married', 'partnered', 'divorced', 'widowed', 'unknown'])
const PARTNER_ROLES = new Set<PartnerRole>(['spouse', 'partner'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`${context}.${key} must be a string`)
  return value
}

function validateOptionalString(record: Record<string, unknown>, key: string, context: string): void {
  if (record[key] !== undefined && typeof record[key] !== 'string') {
    throw new Error(`${context}.${key} must be a string when provided`)
  }
}

function assertAcyclic(tree: Tree): void {
  const childrenByParent = new Map<string, Set<string>>()
  for (const family of Object.values(tree.families)) {
    for (const partner of family.partners) {
      const children = childrenByParent.get(partner.personId) ?? new Set<string>()
      family.children.forEach((childId) => children.add(childId))
      childrenByParent.set(partner.personId, children)
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(personId: string): void {
    if (visiting.has(personId)) throw new Error('Tree contains an ancestry cycle')
    if (visited.has(personId)) return
    visiting.add(personId)
    childrenByParent.get(personId)?.forEach(visit)
    visiting.delete(personId)
    visited.add(personId)
  }
  Object.keys(tree.people).forEach(visit)
}

/** Validates untrusted imported or persisted data and returns it as a Tree. */
export function validateTree(value: unknown): Tree {
  if (!isRecord(value)) throw new Error('Tree must be an object')
  requireString(value, 'id', 'tree')
  requireString(value, 'name', 'tree')
  requireString(value, 'createdAt', 'tree')
  requireString(value, 'updatedAt', 'tree')
  if (!isRecord(value.people)) throw new Error('tree.people must be an object')
  if (!isRecord(value.families)) throw new Error('tree.families must be an object')

  for (const [id, rawPerson] of Object.entries(value.people)) {
    if (!isRecord(rawPerson)) throw new Error(`Person ${id} must be an object`)
    if (requireString(rawPerson, 'id', `person ${id}`) !== id) throw new Error(`Person key does not match id: ${id}`)
    requireString(rawPerson, 'firstName', `person ${id}`)
    requireString(rawPerson, 'lastName', `person ${id}`)
    requireString(rawPerson, 'notes', `person ${id}`)
    if (!SEXES.has(rawPerson.sex as Sex)) throw new Error(`person ${id}.sex is invalid`)
    for (const key of ['nickname', 'birthDate', 'deathDate', 'birthPlace']) {
      validateOptionalString(rawPerson, key, `person ${id}`)
    }
    for (const key of ['isLiving', 'isPlaceholder']) {
      if (rawPerson[key] !== undefined && typeof rawPerson[key] !== 'boolean') {
        throw new Error(`person ${id}.${key} must be a boolean when provided`)
      }
    }
    if (rawPerson.customFields !== undefined) {
      if (!isRecord(rawPerson.customFields) || Object.values(rawPerson.customFields).some((item) => typeof item !== 'string')) {
        throw new Error(`person ${id}.customFields must contain string values`)
      }
    }
  }

  for (const [id, rawFamily] of Object.entries(value.families)) {
    if (!isRecord(rawFamily)) throw new Error(`Family ${id} must be an object`)
    if (requireString(rawFamily, 'id', `family ${id}`) !== id) throw new Error(`Family key does not match id: ${id}`)
    if (!FAMILY_STATUSES.has(rawFamily.status as FamilyStatus)) throw new Error(`family ${id}.status is invalid`)
    if (!Array.isArray(rawFamily.partners) || rawFamily.partners.length > 2) {
      throw new Error(`family ${id}.partners must contain at most two people`)
    }
    if (!Array.isArray(rawFamily.children) || rawFamily.children.some((childId) => typeof childId !== 'string')) {
      throw new Error(`family ${id}.children must contain person ids`)
    }

    const partnerIds = rawFamily.partners.map((rawPartner, index) => {
      if (!isRecord(rawPartner)) throw new Error(`family ${id}.partners[${index}] must be an object`)
      const personId = requireString(rawPartner, 'personId', `family ${id}.partners[${index}]`)
      if (!PARTNER_ROLES.has(rawPartner.role as PartnerRole)) throw new Error(`family ${id}.partners[${index}].role is invalid`)
      return personId
    })
    const childIds = rawFamily.children as string[]
    if (new Set(partnerIds).size !== partnerIds.length || new Set(childIds).size !== childIds.length) {
      throw new Error(`family ${id} contains duplicate people`)
    }
    for (const personId of [...partnerIds, ...childIds]) {
      if (!value.people[personId]) throw new Error(`family ${id} references missing person ${personId}`)
    }
    if (partnerIds.some((personId) => childIds.includes(personId))) {
      throw new Error(`family ${id} lists the same person as parent and child`)
    }
  }

  const tree = value as unknown as Tree
  assertAcyclic(tree)
  return tree
}
