import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, tick, unmount } from 'svelte'
import { addPerson, addSpouse, setParents } from '../lib/model/treeOps'
import { createEmptyTree } from '../lib/model/types'
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layout/treeLayout'
import TreeCanvas from './TreeCanvas.svelte'
import TreeCanvasHarness from './TreeCanvasHarness.test.svelte'

let component: ReturnType<typeof mount> | null = null

afterEach(async () => {
  if (component) await unmount(component)
  component = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('TreeCanvas', () => {
  it('returns to the standard layout when reset from focus mode', () => {
    let tree = createEmptyTree('tree', 'Tree')
    tree = addPerson(tree, { id: 'person', firstName: 'Ada' }).tree
    const onStandardView = vi.fn()
    component = mount(TreeCanvas, {
      target: document.body,
      props: {
        tree,
        selectedPersonId: 'person',
        povPersonId: 'person',
        focusRequestVersion: 1,
        onSelectPerson: vi.fn(),
        onFocusPerson: vi.fn(),
        onStandardView,
      },
    })

    document.querySelector<HTMLButtonElement>('.reset-btn')!.click()
    expect(onStandardView).toHaveBeenCalledOnce()
  })

  it('starts focus mode with only the person and their immediate family', async () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of [
      'grandparent',
      'parentA',
      'parentB',
      'focus',
      'sibling',
      'spouse',
      'child',
      'grandchild',
      'unrelated',
    ]) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'parentA', ['grandparent'])
    tree = setParents(tree, 'focus', ['parentA', 'parentB'])
    tree = setParents(tree, 'sibling', ['parentA', 'parentB'])
    tree = addSpouse(tree, 'focus', 'spouse').tree
    tree = setParents(tree, 'child', ['focus', 'spouse'])
    tree = setParents(tree, 'grandchild', ['child'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    const initialViewBox = document.querySelector('.tree-svg')!.getAttribute('viewBox')
    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()

    expect(
      document.querySelector('[data-person-id="focus"] .pov-label')?.textContent,
    ).toBe('Focus')
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('.node-card'))
        .map((node) => node.dataset.personId)
        .sort(),
    ).toEqual(['child', 'focus', 'parentA', 'parentB', 'sibling', 'spouse'])
    expect(document.querySelector('.tree-svg')!.getAttribute('viewBox')).not.toBe(initialViewBox)
    const [viewX, viewY, viewWidth, viewHeight] = document
      .querySelector('.tree-svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)
    for (const node of document.querySelectorAll('foreignObject')) {
      const x = Number(node.getAttribute('x'))
      const y = Number(node.getAttribute('y'))
      expect(x).toBeGreaterThanOrEqual(viewX)
      expect(y).toBeGreaterThanOrEqual(viewY)
      expect(x + NODE_WIDTH).toBeLessThanOrEqual(viewX + viewWidth)
      expect(y + NODE_HEIGHT).toBeLessThanOrEqual(viewY + viewHeight)
    }
  })

  it('fits a large immediate family inside the initial focus viewport', async () => {
    let tree = createEmptyTree('tree', 'Tree')
    const siblingIds = Array.from({ length: 14 }, (_, index) => `sibling${index}`)
    for (const id of ['parentA', 'parentB', 'focus', 'spouse', 'childA', 'childB', ...siblingIds]) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'focus', ['parentA', 'parentB'])
    for (const siblingId of siblingIds) {
      tree = setParents(tree, siblingId, ['parentA', 'parentB'])
    }
    tree = addSpouse(tree, 'focus', 'spouse').tree
    tree = setParents(tree, 'childA', ['focus', 'spouse'])
    tree = setParents(tree, 'childB', ['focus', 'spouse'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()

    expect(document.querySelectorAll('.node-card')).toHaveLength(20)
    const [viewX, viewY, viewWidth, viewHeight] = document
      .querySelector('.tree-svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)
    for (const node of document.querySelectorAll('foreignObject')) {
      const x = Number(node.getAttribute('x'))
      const y = Number(node.getAttribute('y'))
      expect(x).toBeGreaterThanOrEqual(viewX)
      expect(y).toBeGreaterThanOrEqual(viewY)
      expect(x + NODE_WIDTH).toBeLessThanOrEqual(viewX + viewWidth)
      expect(y + NODE_HEIGHT).toBeLessThanOrEqual(viewY + viewHeight)
    }
  })

  it('expands and collapses outward through a visible relative', async () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['focus', 'spouse', 'child', 'grandchild']) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = addSpouse(tree, 'focus', 'spouse').tree
    tree = setParents(tree, 'child', ['focus', 'spouse'])
    tree = setParents(tree, 'grandchild', ['child'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()

    expect(document.querySelector('[data-person-id="grandchild"]')).toBeNull()
    const expandChild = document.querySelector<HTMLButtonElement>(
      '[data-person-id="child"] .relatives-toggle',
    )!
    expect(expandChild.getAttribute('aria-expanded')).toBe('false')
    expandChild.click()
    await tick()

    expect(document.querySelector('[data-person-id="grandchild"]')).not.toBeNull()
    const childCard = document.querySelector('[data-person-id="child"]')!.closest('foreignObject')!
    const [viewX, viewY, viewWidth, viewHeight] = document
      .querySelector('.tree-svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)
    expect(viewX + viewWidth / 2).toBeCloseTo(Number(childCard.getAttribute('x')) + NODE_WIDTH / 2)
    expect(viewY + viewHeight / 2).toBeCloseTo(Number(childCard.getAttribute('y')) + NODE_HEIGHT / 2)
    const collapseChild = document.querySelector<HTMLButtonElement>(
      '[data-person-id="child"] .relatives-toggle',
    )!
    expect(collapseChild.getAttribute('aria-expanded')).toBe('true')
    collapseChild.click()
    await tick()

    expect(document.querySelector('[data-person-id="grandchild"]')).toBeNull()
  })

  it('fades cards and routes by relationship closeness while exploring', async () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['greatGrandparent', 'grandparent', 'parent', 'focus']) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'grandparent', ['greatGrandparent'])
    tree = setParents(tree, 'parent', ['grandparent'])
    tree = setParents(tree, 'focus', ['parent'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()

    expect(document.querySelector('[data-person-id="focus"]')?.getAttribute('data-focus-closeness')).toBe('focus')
    expect(document.querySelector('[data-person-id="parent"]')?.getAttribute('data-focus-closeness')).toBe('near')
    expect(document.querySelector('.node-card.path-highlighted')).toBeNull()

    document
      .querySelector<HTMLButtonElement>('[data-person-id="parent"] .relatives-toggle')!
      .click()
    await tick()
    expect(document.querySelector('[data-person-id="grandparent"]')?.getAttribute('data-focus-closeness')).toBe('extended')
    expect(document.querySelector('.edge.focus-closeness-extended')).not.toBeNull()

    document
      .querySelector<HTMLButtonElement>('[data-person-id="grandparent"] .relatives-toggle')!
      .click()
    await tick()
    expect(document.querySelector('[data-person-id="greatGrandparent"]')?.getAttribute('data-focus-closeness')).toBe('remote')
    expect(document.querySelector('.edge.focus-closeness-remote')).not.toBeNull()
  })

  it('resets explored relatives when focus mode is restarted', async () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['focus', 'child', 'grandchild']) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'child', ['focus'])
    tree = setParents(tree, 'grandchild', ['child'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()
    document
      .querySelector<HTMLButtonElement>('[data-person-id="child"] .relatives-toggle')!
      .click()
    await tick()
    expect(document.querySelector('[data-person-id="grandchild"]')).not.toBeNull()

    document.querySelector<HTMLButtonElement>('.reset-btn')!.click()
    await tick()
    document
      .querySelector<HTMLButtonElement>('[data-person-id="focus"] .focus-person-btn')!
      .click()
    await tick()

    expect(document.querySelector('[data-person-id="grandchild"]')).toBeNull()
  })

  it('uses a readable focus scale on narrow screens', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 500,
      bottom: 844,
      left: 0,
      width: 500,
      height: 844,
      toJSON: () => ({}),
    })
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['focus', 'child', 'grandchild']) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'child', ['focus'])
    tree = setParents(tree, 'grandchild', ['child'])
    component = mount(TreeCanvas, {
      target: document.body,
      props: {
        tree,
        selectedPersonId: 'focus',
        povPersonId: 'focus',
        focusRequestVersion: 1,
        onSelectPerson: vi.fn(),
        onFocusPerson: vi.fn(),
        onStandardView: vi.fn(),
      },
    })
    await tick()
    document
      .querySelector<HTMLButtonElement>('[data-person-id="child"] .relatives-toggle')!
      .click()
    await tick()

    const [, , width, height] = document
      .querySelector('.tree-svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)
    expect(width).toBe(500)
    expect(height).toBe(844)
  })

  it('renders a separately terminated route for every child', () => {
    let tree = createEmptyTree('tree', 'Tree')
    for (const id of ['parent', 'childA', 'childB']) {
      tree = addPerson(tree, { id, firstName: id }).tree
    }
    tree = setParents(tree, 'childA', ['parent'])
    tree = setParents(tree, 'childB', ['parent'])
    component = mount(TreeCanvasHarness, { target: document.body, props: { tree } })

    const routes = document.querySelectorAll<SVGPathElement>('.parent-child:not(.path-highlight)')
    expect(routes).toHaveLength(2)
    for (const route of routes) expect(route.getAttribute('marker-end')).toBe('url(#child-edge-end)')
  })
})
