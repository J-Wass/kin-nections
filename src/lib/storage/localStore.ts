import type { Tree } from '../model/types'
import { validateTree } from '../model/validateTree'

const INDEX_KEY = 'kin-nections:index'
const TREE_KEY_PREFIX = 'kin-nections:tree:'

export interface TreeSummary {
  id: string
  name: string
  updatedAt: string
}

interface TreeIndex {
  activeTreeId: string | null
  trees: TreeSummary[]
}

function readIndex(): TreeIndex {
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return { activeTreeId: null, trees: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<TreeIndex>
    const trees = Array.isArray(parsed.trees)
      ? parsed.trees.filter((tree): tree is TreeSummary =>
          typeof tree?.id === 'string' && typeof tree.name === 'string' && typeof tree.updatedAt === 'string')
      : []
    return { activeTreeId: typeof parsed.activeTreeId === 'string' ? parsed.activeTreeId : null, trees }
  } catch {
    return { activeTreeId: null, trees: [] }
  }
}

function writeIndex(index: TreeIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function treeKey(id: string): string {
  return `${TREE_KEY_PREFIX}${id}`
}

export function listTrees(): TreeSummary[] {
  return readIndex().trees
}

export function getActiveTreeId(): string | null {
  return readIndex().activeTreeId
}

export function setActiveTreeId(id: string | null): void {
  const index = readIndex()
  index.activeTreeId = id
  writeIndex(index)
}

export function loadTree(id: string): Tree | null {
  const raw = localStorage.getItem(treeKey(id))
  if (!raw) return null
  try {
    return validateTree(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveTree(tree: Tree): void {
  localStorage.setItem(treeKey(tree.id), JSON.stringify(tree))

  const index = readIndex()
  const summary: TreeSummary = { id: tree.id, name: tree.name, updatedAt: tree.updatedAt }
  const existingIdx = index.trees.findIndex((t) => t.id === tree.id)
  if (existingIdx >= 0) {
    index.trees[existingIdx] = summary
  } else {
    index.trees.push(summary)
  }
  writeIndex(index)
}

export function renameTree(id: string, name: string): Tree | null {
  const tree = loadTree(id)
  if (!tree) return null
  const updated: Tree = { ...tree, name, updatedAt: new Date().toISOString() }
  saveTree(updated)
  return updated
}

export function deleteTree(id: string): void {
  localStorage.removeItem(treeKey(id))
  const index = readIndex()
  index.trees = index.trees.filter((t) => t.id !== id)
  if (index.activeTreeId === id) {
    index.activeTreeId = index.trees[0]?.id ?? null
  }
  writeIndex(index)
}
