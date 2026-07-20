import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissOnOutsidePointer } from './dismissOnOutsidePointer'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('dismissOnOutsidePointer', () => {
  it('dismisses an open menu only when the pointer is outside it', () => {
    const menu = document.createElement('details')
    const inside = document.createElement('button')
    const outside = document.createElement('button')
    menu.append(inside)
    document.body.append(menu, outside)
    menu.open = true
    const onDismiss = vi.fn(() => {
      menu.open = false
    })
    const action = dismissOnOutsidePointer(menu, onDismiss)

    inside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(menu.open).toBe(true)
    expect(onDismiss).not.toHaveBeenCalled()

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(menu.open).toBe(false)
    expect(onDismiss).toHaveBeenCalledOnce()

    action.destroy()
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
