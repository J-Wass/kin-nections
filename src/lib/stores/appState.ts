import { derived, get, writable } from 'svelte/store'
import type { Tree } from '../model/types'
import { createEmptyTree } from '../model/types'
import { generateId } from '../model/treeOps'
import {
  deleteTree as deleteTreeFromStorage,
  getActiveTreeId,
  listTrees,
  loadTree,
  renameTree as renameTreeInStorage,
  saveTree,
  setActiveTreeId,
  type TreeSummary,
} from '../storage/localStore'

function initTree(): Tree {
  const activeId = getActiveTreeId()
  if (activeId) {
    const existing = loadTree(activeId)
    if (existing) return existing
  }
  const trees = listTrees()
  if (trees.length > 0) {
    const first = loadTree(trees[0].id)
    if (first) {
      setActiveTreeId(first.id)
      return first
    }
  }
  const fresh = createEmptyTree(generateId('tree'), 'My Family')
  saveTree(fresh)
  setActiveTreeId(fresh.id)
  return fresh
}

export const tree = writable<Tree>(initTree())
export const treeList = writable<TreeSummary[]>(listTrees())

export const selectedPersonId = writable<string | null>(null)
/** The person currently "focused": drives both PoV relationship labels and the
 * ancestors-up/descendants-down re-rooted layout in TreeCanvas. Null = normal view. */
export const povPersonId = writable<string | null>(null)
export const showImportExport = writable(false)

interface ScrollToRequest {
  personId: string
  token: number
}
let scrollToTokenCounter = 0
/** A one-shot "pan the camera to this person" request, distinct from `povPersonId` —
 * scrolling never changes the layout or relationship labels, it just recenters the
 * view. TreeCanvas consumes and clears it after handling. Wrapped with a token so
 * requesting the same person twice in a row still re-fires reliably. */
export const scrollToRequest = writable<ScrollToRequest | null>(null)

export function requestScrollToPerson(personId: string): void {
  scrollToTokenCounter += 1
  scrollToRequest.set({ personId, token: scrollToTokenCounter })
}

function refreshTreeList(): void {
  treeList.set(listTrees())
}

/** Applies a treeOps-style mutation, persists the result, and pushes the new tree
 * into the reactive store. `mutate` should return a brand new Tree object. */
export function applyMutation(mutate: (current: Tree) => Tree): void {
  tree.update((current) => {
    const next = mutate(current)
    saveTree(next)
    refreshTreeList()
    return next
  })
}

export function switchTree(id: string): void {
  const loaded = loadTree(id)
  if (!loaded) return
  setActiveTreeId(id)
  tree.set(loaded)
  selectedPersonId.set(null)
  povPersonId.set(null)
}

export function createNewTree(name: string): void {
  const fresh = createEmptyTree(generateId('tree'), name)
  saveTree(fresh)
  setActiveTreeId(fresh.id)
  tree.set(fresh)
  refreshTreeList()
  selectedPersonId.set(null)
  povPersonId.set(null)
}

export function renameActiveTree(name: string): void {
  const current = get(tree)
  const updated = renameTreeInStorage(current.id, name)
  if (updated) {
    tree.set(updated)
    refreshTreeList()
  }
}

export function deleteActiveTree(): void {
  const current = get(tree)
  deleteTreeFromStorage(current.id)
  refreshTreeList()
  const remaining = listTrees()
  if (remaining.length > 0) {
    switchTree(remaining[0].id)
  } else {
    createNewTree('My Family')
  }
}

export function replaceActiveTree(next: Tree): void {
  saveTree(next)
  setActiveTreeId(next.id)
  tree.set(next)
  refreshTreeList()
  selectedPersonId.set(null)
  povPersonId.set(null)
}

export const selectedPerson = derived([tree, selectedPersonId], ([$tree, $id]) => ($id ? $tree.people[$id] ?? null : null))
