import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import { createPerson } from '../lib/model/types'
import type { FocusCloseness } from '../lib/relationship/focusCloseness'
import NodeCard from './NodeCard.svelte'

let component: ReturnType<typeof mount> | null = null

afterEach(async () => {
  if (component) await unmount(component)
  component = null
  document.body.innerHTML = ''
})

function renderCard(
  relativesExpandable = false,
  relativesExpanded = false,
  focusCloseness: FocusCloseness | null = null,
) {
  const onSelect = vi.fn()
  const onFocusPerson = vi.fn()
  const onToggleRelatives = vi.fn()
  component = mount(NodeCard, {
    target: document.body,
    props: {
      person: createPerson({ id: 'person', firstName: 'Ada', lastName: 'Lovelace' }),
      selected: false,
      relativesExpandable,
      relativesExpanded,
      focusCloseness,
      onSelect,
      onFocusPerson,
      onToggleRelatives,
    },
  })
  return { onSelect, onFocusPerson, onToggleRelatives }
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
    const focusButton = document.querySelector<HTMLButtonElement>('.focus-person-btn')!
    expect(getComputedStyle(focusButton).pointerEvents).toBe('auto')
    focusButton.click()
    expect(onFocusPerson).toHaveBeenCalledWith('person')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('exposes an accessible relative expansion control', () => {
    const { onSelect, onToggleRelatives } = renderCard(true, false)
    const toggle = document.querySelector<HTMLButtonElement>('.relatives-toggle')!

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('Expand relatives')
    toggle.click()

    expect(onToggleRelatives).toHaveBeenCalledWith('person')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('exposes the focus-closeness tier for styling and accessibility inspection', () => {
    renderCard(false, false, 'extended')
    const card = document.querySelector<HTMLElement>('.node-card')!

    expect(card.dataset.focusCloseness).toBe('extended')
    expect(card.classList.contains('focus-colored')).toBe(true)
    expect(card.classList.contains('closeness-extended')).toBe(true)
  })
})
