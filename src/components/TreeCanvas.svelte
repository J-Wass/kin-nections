<script lang="ts">
  import type { Family, Tree } from '../lib/model/types'
  import { computeLayout, NODE_HEIGHT, NODE_WIDTH } from '../lib/layout/treeLayout'
  import { buildAdaptiveChildPath, computeFitBounds, panUnitsPerPixel, uniqueRenderableFamilies } from '../lib/layout/treeGeometry'
  import { describeAllRelationships } from '../lib/relationship/kinship'
  import { computeLineagePath, parentChildLinkKey } from '../lib/relationship/lineagePath'
  import {
    explorationPersonIds,
    immediateFamilyIds,
    projectTreeForPeople,
  } from '../lib/relationship/focusExplore'
  import {
    farthestCloseness,
    focusCloseness as computeFocusCloseness,
    type FocusCloseness,
  } from '../lib/relationship/focusCloseness'
  import { t } from '../lib/i18n'
  import NodeCard from './NodeCard.svelte'
  import Network from '@lucide/svelte/icons/network'

  interface Props {
    tree: Tree
    selectedPersonId: string | null
    povPersonId: string | null
    focusRequestVersion: number
    onSelectPerson: (id: string) => void
    onFocusPerson: (id: string) => void
    onStandardView: () => void
  }

  let { tree, selectedPersonId, povPersonId, focusRequestVersion, onSelectPerson, onFocusPerson, onStandardView }: Props = $props()

  const PADDING = 100
  // A zoomed-in viewport size for focus mode, close enough to comfortably
  // read a handful of generations and siblings around the target, rather than
  // preserving whatever zoom level (often "fit the whole tree") was active before.
  const ZOOM_WIDTH = 1100
  const ZOOM_HEIGHT = 850

  const explorationKey = $derived(`${tree.id}:${povPersonId ?? ''}:${focusRequestVersion}`)
  let exploration = $state<{
    key: string
    expandedPersonIds: string[]
    anchorPersonId: string | null
  }>({
    key: '',
    expandedPersonIds: [],
    anchorPersonId: null,
  })
  const expandedPersonIds = $derived(
    povPersonId
      ? exploration.key === explorationKey
        ? exploration.expandedPersonIds
        : [povPersonId]
      : [],
  )
  const visiblePersonIds = $derived(
    povPersonId
      ? explorationPersonIds(tree, povPersonId, expandedPersonIds)
      : new Set(Object.keys(tree.people)),
  )
  const explorationAnchorId = $derived(
    povPersonId && exploration.key === explorationKey
      ? exploration.anchorPersonId ?? povPersonId
      : povPersonId,
  )
  const hasExplorationAction = $derived(
    Boolean(povPersonId && exploration.key === explorationKey),
  )
  const layoutTree = $derived(
    povPersonId ? projectTreeForPeople(tree, visiblePersonIds) : tree,
  )
  const layout = $derived(computeLayout(layoutTree))
  const povLabels = $derived(povPersonId ? describeAllRelationships(tree, povPersonId) : null)
  const focusImmediateFamilyIds = $derived(
    povPersonId ? immediateFamilyIds(tree, povPersonId) : new Set<string>(),
  )
  const selectedPath = $derived(
    !povPersonId && selectedPersonId ? computeLineagePath(tree, selectedPersonId) : null,
  )
  const renderedFamilies = $derived(uniqueRenderableFamilies(
    Object.values(layoutTree.families),
    new Set(Object.keys(layout.families)),
  ))

  const fitBounds = $derived.by(() => {
    const nodes = Object.values(layout.people)
    return computeFitBounds(nodes, NODE_WIDTH, NODE_HEIGHT, PADDING)
  })
  const contentWidth = $derived(fitBounds.w)
  const contentHeight = $derived(fitBounds.h)

  let viewBox = $state({ x: 0, y: 0, w: 1000, h: 700 })
  let containerEl: HTMLDivElement | undefined = $state()

  function centerOn(node: { x: number; y: number }, w: number, h: number) {
    const targetX = node.x + PADDING + NODE_WIDTH / 2
    const targetY = node.y + PADDING + NODE_HEIGHT / 2
    viewBox = { x: targetX - w / 2, y: targetY - h / 2, w, h }
  }

  function focusViewportSize(): { w: number; h: number } {
    const bounds = containerEl?.getBoundingClientRect()
    if (bounds && bounds.width > 0 && bounds.width < 700) {
      return {
        w: Math.max(360, bounds.width),
        h: Math.max(560, bounds.height),
      }
    }
    return { w: ZOOM_WIDTH, h: ZOOM_HEIGHT }
  }

  // Entering or switching focus fits the complete immediate-family neighborhood.
  // Once exploration begins, keep the acted-on person centered as the graph grows.
  let fittedFor: string | null = null
  let fittedLayout: typeof layout | null = null
  $effect(() => {
    const key = `${povPersonId ?? ''}:${tree.id}:${focusRequestVersion}`
    if ((fittedFor === key && fittedLayout === layout) || contentWidth <= 0) return
    fittedFor = key
    fittedLayout = layout
    if (povPersonId && !hasExplorationAction) {
      viewBox = { ...fitBounds }
    } else if (explorationAnchorId && layout.people[explorationAnchorId]) {
      const focusViewport = focusViewportSize()
      centerOn(layout.people[explorationAnchorId], focusViewport.w, focusViewport.h)
    } else {
      viewBox = { ...fitBounds }
    }
  })

  let panState: { startX: number; startY: number; origin: typeof viewBox } | null = null
  let pendingPan: { clientX: number; clientY: number } | null = null
  let panFrame: number | null = null

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.node-card')) return
    panState = { startX: e.clientX, startY: e.clientY, origin: { ...viewBox } }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!panState || !containerEl) return
    const latest = e.getCoalescedEvents?.().at(-1) ?? e
    pendingPan = { clientX: latest.clientX, clientY: latest.clientY }
    if (panFrame !== null) return
    panFrame = requestAnimationFrame(applyPendingPan)
  }

  function applyPendingPan() {
    panFrame = null
    if (!panState || !containerEl || !pendingPan) return
    const rect = containerEl.getBoundingClientRect()
    // preserveAspectRatio="meet" gives SVG one uniform screen scale. Using separate
    // x/y ratios makes vertical panning feel sluggish whenever the aspect ratios differ.
    const scale = panUnitsPerPixel(panState.origin, rect.width, rect.height)
    const dx = (pendingPan.clientX - panState.startX) * scale
    const dy = (pendingPan.clientY - panState.startY) * scale
    viewBox = { ...panState.origin, x: panState.origin.x - dx, y: panState.origin.y - dy }
  }

  function onPointerUp() {
    if (panFrame !== null) {
      cancelAnimationFrame(panFrame)
      panFrame = null
    }
    if (pendingPan) applyPendingPan()
    panState = null
    pendingPan = null
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
    if (povPersonId) {
      onStandardView()
    } else {
      viewBox = { ...fitBounds }
    }
  }

  function relativesExpanded(personId: string): boolean {
    return expandedPersonIds.includes(personId)
  }

  function relativesExpandable(personId: string): boolean {
    if (!povPersonId) return false
    const relatives = immediateFamilyIds(tree, personId)
    if (relatives.size <= 1) return false
    return relativesExpanded(personId) || [...relatives].some((id) => !visiblePersonIds.has(id))
  }

  function personFocusCloseness(personId: string): FocusCloseness | null {
    if (!povPersonId) return null
    return computeFocusCloseness(
      povPersonId,
      personId,
      focusImmediateFamilyIds,
      povLabels?.[personId],
    )
  }

  function familyFocusCloseness(family: Family, childId?: string): Exclude<FocusCloseness, 'focus'> {
    const personIds = family.partners
      .map((partner) => partner.personId)
      .filter((personId) => Boolean(layout.people[personId]))
    if (childId) personIds.push(childId)
    return farthestCloseness(
      personIds.map((personId) => personFocusCloseness(personId) ?? 'none'),
    )
  }

  function focusEdgeClass(tier: Exclude<FocusCloseness, 'focus'>): string {
    return povPersonId ? `focus-closeness-${tier}` : ''
  }

  function toggleRelatives(personId: string) {
    if (!povPersonId) return
    const current = [...expandedPersonIds]
    exploration = {
      key: explorationKey,
      anchorPersonId: personId,
      expandedPersonIds: current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    }
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
    return layout.families[familyId].x + PADDING + NODE_WIDTH / 2
  }
  function familyCenterY(familyId: string): number {
    return layout.families[familyId].y + PADDING + NODE_HEIGHT / 2
  }

  const marriageLineClass = (status: string) => (status === 'divorced' ? 'edge marriage divorced' : 'edge marriage')

  function visibleChildren(family: Family): string[] {
    return family.children.filter((childId) => Boolean(layout.people[childId]))
  }

  function isPathNode(personId: string): boolean {
    return selectedPath?.personIds.has(personId) ?? false
  }

  function isPathPartner(family: Family, partnerId: string): boolean {
    return family.children.some((childId) =>
      selectedPath?.parentChildLinks.has(parentChildLinkKey(partnerId, childId)),
    ) ?? false
  }

  function pathChildren(family: Family): string[] {
    return visibleChildren(family).filter((childId) =>
      family.partners.some((partner) =>
        selectedPath?.parentChildLinks.has(parentChildLinkKey(partner.personId, childId)),
      ),
    )
  }

  function childBranchPath(familyId: string, childId: string): string {
    const points = layout.parentChildRoutes[familyId]?.[childId] ?? []
    return buildAdaptiveChildPath(points.map((point) => ({
      x: point.x + PADDING,
      y: point.y + PADDING,
    })))
  }
</script>

<div class="canvas-wrap">
  <div class="canvas-toolbar">
    <button type="button" onclick={resetView} class="reset-btn">
      <Network size={16} aria-hidden="true" />
      <span>{$t('tree.standardView')}</span>
    </button>
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
      <defs>
        <marker
          id="child-edge-end"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
        </marker>
      </defs>
      <g class="edges">
        {#each renderedFamilies as family (family.id)}
          {@const fx = familyX(family.id)}
          {@const fy = familyCenterY(family.id)}
          {#each family.partners as partner (partner.personId)}
            {#if layout.people[partner.personId]}
              <line
                class="{marriageLineClass(family.status)} {focusEdgeClass(familyFocusCloseness(family))}"
                class:path-highlight={isPathPartner(family, partner.personId)}
                x1={nodeCenterX(partner.personId)}
                y1={nodeCenterY(partner.personId)}
                x2={fx}
                y2={fy}
              />
            {/if}
          {/each}
          {@const childIds = visibleChildren(family)}
          {#each childIds as childId (childId)}
            <path
              class="edge parent-child {focusEdgeClass(familyFocusCloseness(family, childId))}"
              class:unknown-parent={family.partners.length === 0}
              d={childBranchPath(family.id, childId)}
              marker-end="url(#child-edge-end)"
            />
          {/each}
          {@const highlightedChildIds = pathChildren(family)}
          {#each highlightedChildIds as childId (childId)}
            <path
              class="edge parent-child path-highlight"
              d={childBranchPath(family.id, childId)}
              marker-end="url(#child-edge-end)"
            />
          {/each}
        {/each}
      </g>

      <g class="nodes">
        {#each Object.values(layoutTree.people) as person (person.id)}
          {#if layout.people[person.id]}
            <foreignObject
              x={nodeX(person.id)}
              y={nodeY(person.id)}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
            >
              <NodeCard
                {person}
                selected={selectedPersonId === person.id || povPersonId === person.id}
                pathHighlighted={isPathNode(person.id)}
                povLabel={povLabels ? (person.id === povPersonId ? 'Focus' : povLabels[person.id]?.label ?? null) : null}
                relativesExpandable={relativesExpandable(person.id)}
                relativesExpanded={relativesExpanded(person.id)}
                focusCloseness={personFocusCloseness(person.id)}
                onSelect={onSelectPerson}
                {onFocusPerson}
                onToggleRelatives={toggleRelatives}
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
    inset-inline-end: 0.75rem;
    z-index: 5;
  }

  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
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
    user-select: none;
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
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    opacity: 0.68;
  }
  .edge.marriage.divorced {
    stroke-dasharray: 6 4;
    stroke: var(--edge-divorced);
  }
  .edge.parent-child.unknown-parent {
    stroke-dasharray: 3 4;
    stroke: var(--edge-unknown);
  }
  .edge.focus-closeness-near {
    stroke: var(--closeness-near-border);
    stroke-width: 2.2;
    opacity: var(--closeness-near-edge-opacity);
  }
  .edge.focus-closeness-extended {
    stroke: var(--closeness-extended-border);
    stroke-width: 1.9;
    opacity: var(--closeness-extended-edge-opacity);
  }
  .edge.focus-closeness-remote {
    stroke: var(--closeness-remote-border);
    stroke-width: 1.65;
    opacity: var(--closeness-remote-edge-opacity);
  }
  .edge.focus-closeness-none {
    stroke: var(--closeness-none-border);
    stroke-width: 1.5;
    opacity: var(--closeness-none-edge-opacity);
  }
  .edge.path-highlight,
  .edge.marriage.divorced.path-highlight {
    stroke: var(--path-highlight);
    stroke-width: 3;
    stroke-dasharray: none;
    opacity: 1;
    filter: drop-shadow(0 0 3px var(--path-highlight-glow));
  }
</style>
