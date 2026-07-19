import type { Family, FamilyStatus, Person, Tree } from './types'
import { createPerson } from './types'

function touch(tree: Tree): void {
  tree.updatedAt = new Date().toISOString()
}

function clone(tree: Tree): Tree {
  return {
    ...tree,
    people: { ...tree.people },
    families: { ...tree.families },
  }
}

function requirePerson(tree: Tree, personId: string): void {
  if (!tree.people[personId]) throw new Error(`Person not found: ${personId}`)
}

function wouldCreateAncestryCycle(tree: Tree, parentId: string, childId: string): boolean {
  const visited = new Set<string>()
  const queue = [childId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === parentId) return true
    if (visited.has(current)) continue
    visited.add(current)
    queue.push(...getChildrenOf(tree, current).map((person) => person.id))
  }
  return false
}

let idCounter = 0
export function generateId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

// ---------- Person CRUD ----------

export function addPerson(tree: Tree, input: Partial<Person> = {}): { tree: Tree; person: Person } {
  const next = clone(tree)
  const person = createPerson({ id: input.id ?? generateId('person'), ...input })
  next.people[person.id] = person
  touch(next)
  return { tree: next, person }
}

export function updatePerson(tree: Tree, personId: string, updates: Partial<Person>): Tree {
  if (!tree.people[personId]) throw new Error(`Person not found: ${personId}`)
  const next = clone(tree)
  next.people[personId] = { ...next.people[personId], ...updates, id: personId }
  touch(next)
  return next
}

/** Removes a person and cleans up every family reference to them. Families left with
 * no partners and no children are removed entirely; others are kept intact. */
export function removePerson(tree: Tree, personId: string): Tree {
  if (!tree.people[personId]) throw new Error(`Person not found: ${personId}`)
  const next = clone(tree)
  delete next.people[personId]

  for (const family of Object.values(next.families)) {
    const partners = family.partners.filter((p) => p.personId !== personId)
    const children = family.children.filter((id) => id !== personId)
    if (partners.length === family.partners.length && children.length === family.children.length) {
      continue
    }
    if (partners.length === 0 && children.length === 0) {
      delete next.families[family.id]
    } else {
      next.families[family.id] = { ...family, partners, children }
    }
  }

  touch(next)
  return next
}

// ---------- Family CRUD ----------

export function createFamily(
  tree: Tree,
  input: { partners?: Family['partners']; status?: FamilyStatus; children?: string[] } = {},
): { tree: Tree; family: Family } {
  const next = clone(tree)
  const family: Family = {
    id: generateId('family'),
    partners: input.partners ?? [],
    status: input.status ?? 'unknown',
    children: input.children ?? [],
  }
  next.families[family.id] = family
  touch(next)
  return { tree: next, family }
}

export function updateFamilyStatus(tree: Tree, familyId: string, status: FamilyStatus): Tree {
  if (!tree.families[familyId]) throw new Error(`Family not found: ${familyId}`)
  const next = clone(tree)
  next.families[familyId] = { ...next.families[familyId], status }
  touch(next)
  return next
}

export function removeFamily(tree: Tree, familyId: string): Tree {
  if (!tree.families[familyId]) throw new Error(`Family not found: ${familyId}`)
  const next = clone(tree)
  delete next.families[familyId]
  touch(next)
  return next
}

export function addChildToFamily(tree: Tree, familyId: string, childId: string): Tree {
  const family = tree.families[familyId]
  if (!family) throw new Error(`Family not found: ${familyId}`)
  if (family.children.includes(childId)) return tree
  const next = clone(tree)
  next.families[familyId] = { ...family, children: [...family.children, childId] }
  touch(next)
  return next
}

export function removeChildFromFamily(tree: Tree, familyId: string, childId: string): Tree {
  const family = tree.families[familyId]
  if (!family) throw new Error(`Family not found: ${familyId}`)
  const next = clone(tree)
  next.families[familyId] = { ...family, children: family.children.filter((id) => id !== childId) }
  touch(next)
  return next
}

// ---------- High-level relationship helpers ----------

function findFamiliesAsChild(tree: Tree, personId: string): Family[] {
  return Object.values(tree.families).filter((f) => f.children.includes(personId))
}

function findFamiliesAsPartner(tree: Tree, personId: string): Family[] {
  return Object.values(tree.families).filter((f) => f.partners.some((p) => p.personId === personId))
}

/** Finds the family with exactly this set of partners (order-independent), if any. */
function findFamilyByPartners(tree: Tree, partnerIds: string[]): Family | undefined {
  const target = [...partnerIds].sort().join(',')
  return Object.values(tree.families).find(
    (f) =>
      f.partners.length === partnerIds.length &&
      [...f.partners.map((p) => p.personId)].sort().join(',') === target,
  )
}

/** Replaces a person's parent membership. The child is detached from every previous
 * parent family, then attached to the requested 0, 1, or 2 parents. */
export function setParents(tree: Tree, childId: string, parentIds: string[]): Tree {
  requirePerson(tree, childId)
  const uniqueParentIds = [...new Set(parentIds)]
  if (uniqueParentIds.length !== parentIds.length || uniqueParentIds.length > 2) {
    throw new Error('setParents requires 0 to 2 unique parent ids')
  }
  for (const parentId of uniqueParentIds) {
    requirePerson(tree, parentId)
    if (wouldCreateAncestryCycle(tree, parentId, childId)) {
      throw new Error('Parent relationship would create an ancestry cycle')
    }
  }

  let working = clone(tree)
  for (const family of Object.values(working.families)) {
    if (!family.children.includes(childId)) continue
    const children = family.children.filter((id) => id !== childId)
    if (children.length === 0 && family.partners.length < 2) {
      delete working.families[family.id]
    } else {
      working.families[family.id] = { ...family, children }
    }
  }
  touch(working)

  if (uniqueParentIds.length === 0) return working

  let family = findFamilyByPartners(working, uniqueParentIds)
  if (!family) {
    const created = createFamily(working, {
      partners: uniqueParentIds.map((personId) => ({ personId, role: 'spouse' as const })),
    })
    working = created.tree
    family = created.family
  }
  return addChildToFamily(working, family.id, childId)
}

/** Links two people as spouses/partners, creating a family if one doesn't already exist. */
export function addSpouse(
  tree: Tree,
  personAId: string,
  personBId: string,
  status: FamilyStatus = 'married',
): { tree: Tree; family: Family } {
  requirePerson(tree, personAId)
  requirePerson(tree, personBId)
  if (personAId === personBId) throw new Error('A person cannot be their own spouse')
  const existing = findFamilyByPartners(tree, [personAId, personBId])
  if (existing) {
    const next = updateFamilyStatus(tree, existing.id, status)
    return { tree: next, family: next.families[existing.id] }
  }
  return createFamily(tree, {
    partners: [
      { personId: personAId, role: 'spouse' },
      { personId: personBId, role: 'spouse' },
    ],
    status,
  })
}

/** Marks an existing spouse/partner family as divorced (ex-spouse relationship). */
export function markDivorced(tree: Tree, personAId: string, personBId: string): Tree {
  const family = findFamilyByPartners(tree, [personAId, personBId])
  if (!family) throw new Error('No spouse family found between these two people')
  return updateFamilyStatus(tree, family.id, 'divorced')
}

/** Adds a sibling relationship between two people. Reuses an existing shared family if
 * one of them already belongs to one; otherwise creates a parents-unknown family. */
export function addSibling(tree: Tree, personId: string, siblingId: string): Tree {
  requirePerson(tree, personId)
  requirePerson(tree, siblingId)
  if (personId === siblingId) throw new Error('A person cannot be their own sibling')
  const personFamilies = findFamiliesAsChild(tree, personId)
  const siblingFamilies = findFamiliesAsChild(tree, siblingId)

  const shared = personFamilies.find((f) => siblingFamilies.some((sf) => sf.id === f.id))
  if (shared) return tree // already siblings via a shared family

  if (personFamilies.length > 0) {
    return addChildToFamily(tree, personFamilies[0].id, siblingId)
  }
  if (siblingFamilies.length > 0) {
    return addChildToFamily(tree, siblingFamilies[0].id, personId)
  }
  const created = createFamily(tree, { partners: [], children: [personId, siblingId] })
  return created.tree
}

// ---------- Queries ----------

export function getParentsOf(tree: Tree, personId: string): Person[] {
  const ids = findFamiliesAsChild(tree, personId).flatMap((f) => f.partners.map((p) => p.personId))
  return [...new Set(ids)].map((id) => tree.people[id]).filter(Boolean)
}

export function getChildrenOf(tree: Tree, personId: string): Person[] {
  const ids = findFamiliesAsPartner(tree, personId).flatMap((f) => f.children)
  return [...new Set(ids)].map((id) => tree.people[id]).filter(Boolean)
}

export function getSpousesOf(tree: Tree, personId: string): { person: Person; status: FamilyStatus; familyId: string }[] {
  return findFamiliesAsPartner(tree, personId)
    .flatMap((f) =>
      f.partners
        .filter((p) => p.personId !== personId)
        .map((p) => ({ person: tree.people[p.personId], status: f.status, familyId: f.id })),
    )
    .filter((entry) => Boolean(entry.person))
}

export function getSiblingsOf(tree: Tree, personId: string): Person[] {
  const ids = findFamiliesAsChild(tree, personId).flatMap((f) => f.children.filter((id) => id !== personId))
  return [...new Set(ids)].map((id) => tree.people[id]).filter(Boolean)
}
