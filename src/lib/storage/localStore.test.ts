import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyTree } from '../model/types'
import {
  deleteTree,
  getActiveTreeId,
  listTrees,
  loadTree,
  renameTree,
  saveTree,
  setActiveTreeId,
} from './localStore'

beforeEach(() => {
  localStorage.clear()
})

describe('localStore', () => {
  it('returns an empty state when nothing has been saved', () => {
    expect(listTrees()).toEqual([])
    expect(getActiveTreeId()).toBeNull()
    expect(loadTree('missing')).toBeNull()
  })

  it('saves and loads a tree round-trip', () => {
    const tree = createEmptyTree('t1', 'My Family')
    saveTree(tree)
    expect(loadTree('t1')).toEqual(tree)
    expect(listTrees()).toEqual([{ id: 't1', name: 'My Family', updatedAt: tree.updatedAt }])
  })

  it('returns null for corrupt or structurally invalid stored trees', () => {
    localStorage.setItem('kin-nections:tree:broken-json', '{')
    localStorage.setItem('kin-nections:tree:invalid-tree', JSON.stringify({ id: 'invalid-tree' }))
    expect(loadTree('broken-json')).toBeNull()
    expect(loadTree('invalid-tree')).toBeNull()
  })

  it('updates the index summary in place on re-save rather than duplicating', () => {
    const tree = createEmptyTree('t1', 'My Family')
    saveTree(tree)
    const renamed = { ...tree, name: 'Renamed', updatedAt: new Date().toISOString() }
    saveTree(renamed)
    expect(listTrees()).toHaveLength(1)
    expect(listTrees()[0].name).toBe('Renamed')
  })

  it('tracks the active tree id', () => {
    saveTree(createEmptyTree('t1', 'A'))
    setActiveTreeId('t1')
    expect(getActiveTreeId()).toBe('t1')
  })

  it('renameTree updates the stored tree name and index', () => {
    saveTree(createEmptyTree('t1', 'Old Name'))
    const updated = renameTree('t1', 'New Name')
    expect(updated?.name).toBe('New Name')
    expect(loadTree('t1')?.name).toBe('New Name')
    expect(listTrees()[0].name).toBe('New Name')
  })

  it('renameTree returns null for a missing tree', () => {
    expect(renameTree('missing', 'X')).toBeNull()
  })

  it('deleteTree removes the tree and its index entry', () => {
    saveTree(createEmptyTree('t1', 'A'))
    saveTree(createEmptyTree('t2', 'B'))
    setActiveTreeId('t1')

    deleteTree('t1')
    expect(loadTree('t1')).toBeNull()
    expect(listTrees().map((t) => t.id)).toEqual(['t2'])
    // active tree falls back to another remaining tree when the active one is deleted
    expect(getActiveTreeId()).toBe('t2')
  })

  it('deleteTree clears the active id when it was the last tree', () => {
    saveTree(createEmptyTree('t1', 'A'))
    setActiveTreeId('t1')
    deleteTree('t1')
    expect(getActiveTreeId()).toBeNull()
  })
})
