import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import { createPerson } from '../lib/model/types'
import NodeCard from './NodeCard.svelte'

let component: ReturnType<typeof mount> | null = null

afterEach(async () => {
  if (component) await unmount(component)
  component = null
  document.body.innerHTML = ''
})

function renderCard() {
  const onSelect = vi.fn()
  const onFocusPerson = vi.fn()
  component = mount(NodeCard, {
    target: document.body,
    props: {
      person: createPerson({ id: 'person', firstName: 'Ada', lastName: 'Lovelace' }),
      selected: false,
      onSelect,
      onFocusPerson,
    },
  })
  return { onSelect, onFocusPerson }
}

describe('NodeCard', () => {
  it('selects on click and focuses on double-click', () => {
    const { onSelect, onFocusPerson } = renderCard()
    const mainButton = document.querySelector<HTMLButtonElement>('.node-main')!
    mainButton.click()
    mainButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith('person')
    expect(onFocusPerson).toHaveBeenCalledWith('person')
  })

  it('focuses from the eye control without selecting separately', () => {
    const { onSelect, onFocusPerson } = renderCard()
    document.querySelector<HTMLButtonElement>('.focus-person-btn')!.click()
    expect(onFocusPerson).toHaveBeenCalledWith('person')
    expect(onSelect).not.toHaveBeenCalled()
  })
})
