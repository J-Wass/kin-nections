<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import { computeFocusedLayout, computeLayout, GENERATION_SPACING_Y, NODE_SPACING_X } from '../lib/layout/treeLayout'
  import { describeAllRelationships } from '../lib/relationship/kinship'
  import { scrollToRequest } from '../lib/stores/appState'
  import NodeCard from './NodeCard.svelte'

  interface Props {
    tree: Tree
    selectedPersonId: string | null
    povPersonId: string | null
    onSelectPerson: (id: string) => void
  }

  let { tree, selectedPersonId, povPersonId, onSelectPerson }: Props = $props()

  const NODE_WIDTH = 150
  const NODE_HEIGHT = 74
  const PADDING = 100
  // A "zoomed in" viewport size for scroll-to/focus — close enough to comfortably
  // read a handful of generations and siblings around the target, rather than
  // preserving whatever zoom level (often "fit the whole tree") was active before.
  const ZOOM_WIDTH = 1100
  const ZOOM_HEIGHT = 850

  // Focusing a person re-roots the whole layout around them (ancestors up,
  // descendants down, siblings/cousins beside) instead of the tree's true roots.
  const layout = $derived(povPersonId ? computeFocusedLayout(tree, povPersonId) : computeLayout(tree))
  const povLabels = $derived(povPersonId ? describeAllRelationships(tree, povPersonId) : null)

  const contentWidth = $derived(layout.width + PADDING * 2)
  const contentHeight = $derived(layout.height + PADDING * 2)

  let viewBox = $state({ x: 0, y: 0, w: 1000, h: 700 })
  let containerEl: HTMLDivElement | undefined = $state()

  function centerOn(node: { x: number; y: number }, w: number, h: number) {
    const targetX = node.x + PADDING + NODE_WIDTH / 2
    const targetY = node.y + PADDING + NODE_HEIGHT / 2
    viewBox = { x: targetX - w / 2, y: targetY - h / 2, w, h }
  }

  // Re-fit the view whenever the layout mode changes. Entering/switching focus zooms
  // in on the focus person specifically; exiting focus (or first render) fits the
  // whole tree, since there's no single target to zoom to anymore.
  let fittedFor: string | null = null
  $effect(() => {
    const key = `${povPersonId ?? ''}:${tree.id}`
    if (fittedFor === key || contentWidth <= 0) return
    fittedFor = key
    if (povPersonId && layout.people[povPersonId]) {
      centerOn(layout.people[povPersonId], ZOOM_WIDTH, ZOOM_HEIGHT)
    } else {
      viewBox = { x: 0, y: 0, w: contentWidth, h: contentHeight }
    }
  })

  // Pure camera pan+zoom to a person, independent of focus — doesn't touch layout
  // mode or relationship labels, just recenters and zooms in on the requested node.
  $effect(() => {
    const request = $scrollToRequest
    if (!request) return
    const node = layout.people[request.personId]
    if (node) centerOn(node, ZOOM_WIDTH, ZOOM_HEIGHT)
    scrollToRequest.set(null)
  })

  let panState: { startX: number; startY: number; origin: typeof viewBox } | null = null

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.node-card')) return
    panState = { startX: e.clientX, startY: e.clientY, origin: { ...viewBox } }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!panState || !containerEl) return
    const rect = containerEl.getBoundingClientRect()
    const scaleX = viewBox.w / rect.width
    const scaleY = viewBox.h / rect.height
    const dx = (e.clientX - panState.startX) * scaleX
    const dy = (e.clientY - panState.startY) * scaleY
    viewBox = { ...panState.origin, x: panState.origin.x - dx, y: panState.origin.y - dy }
  }

  function onPointerUp() {
    panState = null
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    if (!containerEl) return
    const rect = containerEl.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 1.1 : 0.9
    const newW = Math.min(Math.max(viewBox.w * factor, 300), contentWidth * 3)
    const newH = Math.min(Math.max(viewBox.h * factor, 200), contentHeight * 3)
    const px = viewBox.x + (mx / rect.width) * viewBox.w
    const py = viewBox.y + (my / rect.height) * viewBox.h
    viewBox = {
      x: px - (mx / rect.width) * newW,
      y: py - (my / rect.height) * newH,
      w: newW,
      h: newH,
    }
  }

  function resetView() {
    viewBox = { x: 0, y: 0, w: contentWidth, h: contentHeight }
  }

  function nodeX(personId: string): number {
    return layout.people[personId].x + PADDING
  }
  function nodeY(personId: string): number {
    return layout.people[personId].y + PADDING
  }
  function nodeCenterX(personId: string): number {
    return nodeX(personId) + NODE_WIDTH / 2
  }
  function nodeCenterY(personId: string): number {
    return nodeY(personId) + NODE_HEIGHT / 2
  }
  function familyX(familyId: string): number {
    return layout.families[familyId].x + PADDING
  }
  function familyCenterY(familyId: string): number {
    return layout.families[familyId].y + PADDING + NODE_HEIGHT / 2
  }

  const marriageLineClass = (status: string) => (status === 'divorced' ? 'edge marriage divorced' : 'edge marriage')
</script>

<div class="canvas-wrap">
  <div class="canvas-toolbar">
    <button type="button" onclick={resetView} class="reset-btn">Reset view</button>
  </div>
  <div
    class="canvas-container"
    bind:this={containerEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
    role="application"
    aria-label="Family tree diagram"
  >
    <svg viewBox="{viewBox.x} {viewBox.y} {viewBox.w} {viewBox.h}" class="tree-svg">
      <g class="edges">
        {#each Object.values(tree.families) as family (family.id)}
          {@const fx = familyX(family.id)}
          {@const fy = familyCenterY(family.id)}
          {#each family.partners as partner (partner.personId)}
            {#if layout.people[partner.personId]}
              <line
                class={marriageLineClass(family.status)}
                x1={nodeCenterX(partner.personId)}
                y1={nodeCenterY(partner.personId)}
                x2={fx}
                y2={fy}
              />
            {/if}
          {/each}
          {#each family.children as childId (childId)}
            {#if layout.people[childId]}
              {@const midY = (fy + nodeY(childId)) / 2}
              <path
                class="edge parent-child"
                class:unknown-parent={family.partners.length === 0}
                d="M {fx} {fy} L {fx} {midY} L {nodeCenterX(childId)} {midY} L {nodeCenterX(childId)} {nodeY(childId)}"
              />
            {/if}
          {/each}
        {/each}
      </g>

      <g class="nodes">
        {#each Object.values(tree.people) as person (person.id)}
          {#if layout.people[person.id]}
            <foreignObject
              x={nodeX(person.id)}
              y={nodeY(person.id)}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
            >
              <NodeCard
                {person}
                selected={selectedPersonId === person.id}
                povLabel={povLabels ? (person.id === povPersonId ? 'Focus' : povLabels[person.id]?.label ?? null) : null}
                onSelect={onSelectPerson}
              />
            </foreignObject>
          {/if}
        {/each}
      </g>
    </svg>
  </div>
</div>

<style>
  .canvas-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .canvas-toolbar {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 5;
  }

  .reset-btn {
    font-size: 0.8rem;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  .reset-btn:hover {
    background: var(--surface-hover);
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    background: var(--canvas-bg);
  }
  .canvas-container:active {
    cursor: grabbing;
  }

  .tree-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .edge {
    stroke: var(--edge);
    stroke-width: 2;
    fill: none;
  }
  .edge.marriage.divorced {
    stroke-dasharray: 6 4;
    stroke: var(--edge-divorced);
  }
  .edge.parent-child.unknown-parent {
    stroke-dasharray: 3 4;
    stroke: var(--edge-unknown);
  }
</style>
