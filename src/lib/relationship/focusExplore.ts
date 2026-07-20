import type { Family, Tree } from '../model/types'

export function immediateFamilyIds(tree: Tree, personId: string): Set<string> {
  const ids = new Set<string>()
  if (!tree.people[personId]) return ids

  ids.add(personId)

  for (const family of Object.values(tree.families)) {
    if (family.children.includes(personId)) {
      family.partners.forEach((partner) => ids.add(partner.personId))
      family.children.forEach((childId) => ids.add(childId))
    }

    if (family.partners.some((partner) => partner.personId === personId)) {
      family.partners.forEach((partner) => ids.add(partner.personId))
      family.children.forEach((childId) => ids.add(childId))
    }
  }

  return ids
}

export function explorationPersonIds(
  tree: Tree,
  focusPersonId: string,
  expandedPersonIds: Iterable<string>,
): Set<string> {
  const visible = new Set<string>()
  if (tree.people[focusPersonId]) visible.add(focusPersonId)

  for (const personId of expandedPersonIds) {
    immediateFamilyIds(tree, personId).forEach((id) => visible.add(id))
  }

  return visible
}

function visibleFamily(family: Family, visiblePersonIds: Set<string>): Family | null {
  const partners = family.partners.filter((partner) => visiblePersonIds.has(partner.personId))
  const children = family.children.filter((childId) => visiblePersonIds.has(childId))
  const connectsSpouses = partners.length >= 2
  const connectsGenerations = partners.length >= 1 && children.length >= 1
  const connectsUnknownParentSiblings = family.partners.length === 0 && children.length >= 2

  if (!connectsSpouses && !connectsGenerations && !connectsUnknownParentSiblings) return null

  return { ...family, partners, children }
}

export function projectTreeForPeople(tree: Tree, visiblePersonIds: Set<string>): Tree {
  const people = Object.fromEntries(
    Object.entries(tree.people).filter(([id]) => visiblePersonIds.has(id)),
  )
  const families = Object.fromEntries(
    Object.values(tree.families)
      .map((family) => visibleFamily(family, visiblePersonIds))
      .filter((family): family is Family => family !== null)
      .map((family) => [family.id, family]),
  )

  return { ...tree, people, families }
}
