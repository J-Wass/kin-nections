import type { Tree } from '../model/types'
import { getChildrenOf, getParentsOf } from '../model/treeOps'

export interface LineagePath {
  personIds: Set<string>
  parentChildLinks: Set<string>
}

export function parentChildLinkKey(parentId: string, childId: string): string {
  return `${parentId}\u0000${childId}`
}

/** Returns ancestors and descendants within the requested number of generations.
 * Spouses and siblings are deliberately excluded unless they independently appear
 * in the selected person's direct lineage. */
export function computeLineagePath(tree: Tree, personId: string, depth = 2): LineagePath {
  if (!tree.people[personId]) return { personIds: new Set(), parentChildLinks: new Set() }

  const personIds = new Set<string>([personId])
  const parentChildLinks = new Set<string>()

  let ancestorFrontier = new Set([personId])
  const visitedAncestors = new Set([personId])
  for (let generation = 0; generation < depth; generation++) {
    const next = new Set<string>()
    for (const childId of ancestorFrontier) {
      for (const parent of getParentsOf(tree, childId)) {
        personIds.add(parent.id)
        parentChildLinks.add(parentChildLinkKey(parent.id, childId))
        if (!visitedAncestors.has(parent.id)) next.add(parent.id)
      }
    }
    next.forEach((id) => visitedAncestors.add(id))
    ancestorFrontier = next
  }

  let descendantFrontier = new Set([personId])
  const visitedDescendants = new Set([personId])
  for (let generation = 0; generation < depth; generation++) {
    const next = new Set<string>()
    for (const parentId of descendantFrontier) {
      for (const child of getChildrenOf(tree, parentId)) {
        personIds.add(child.id)
        parentChildLinks.add(parentChildLinkKey(parentId, child.id))
        if (!visitedDescendants.has(child.id)) next.add(child.id)
      }
    }
    next.forEach((id) => visitedDescendants.add(id))
    descendantFrontier = next
  }

  return { personIds, parentChildLinks }
}
