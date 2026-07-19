import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'
import { addPerson } from '../model/treeOps'
import { createEmptyTree } from '../model/types'
import { focusPerson, focusRequestVersion, povPersonId, selectedPersonId, tree } from './appState'

beforeEach(() => {
  let seeded = createEmptyTree('tree', 'Tree')
  seeded = addPerson(seeded, { id: 'person' }).tree
  tree.set(seeded)
  selectedPersonId.set(null)
  povPersonId.set(null)
  focusRequestVersion.set(0)
})

describe('focusPerson', () => {
  it('selects and focuses a known person atomically', () => {
    focusPerson('person')
    expect(get(selectedPersonId)).toBe('person')
    expect(get(povPersonId)).toBe('person')
  })

  it('ignores a missing person', () => {
    focusPerson('missing')
    expect(get(selectedPersonId)).toBeNull()
    expect(get(povPersonId)).toBeNull()
    expect(get(focusRequestVersion)).toBe(0)
  })

  it('emits a new request when focusing the same person again', () => {
    focusPerson('person')
    focusPerson('person')
    expect(get(focusRequestVersion)).toBe(2)
  })
})
