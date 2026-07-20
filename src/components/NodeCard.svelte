<script lang="ts">
  import type { Person } from '../lib/model/types'
  import type { FocusCloseness } from '../lib/relationship/focusCloseness'
  import { formatPersonName } from '../lib/model/personDisplay'
  import { t } from '../lib/i18n'
  import Eye from '@lucide/svelte/icons/eye'
  import CirclePlus from '@lucide/svelte/icons/circle-plus'
  import CircleMinus from '@lucide/svelte/icons/circle-minus'

  interface Props {
    person: Person
    selected: boolean
    pathHighlighted?: boolean
    povLabel?: string | null
    relativesExpandable?: boolean
    relativesExpanded?: boolean
    focusCloseness?: FocusCloseness | null
    onSelect: (id: string) => void
    onFocusPerson: (id: string) => void
    onToggleRelatives?: (id: string) => void
  }

  let {
    person,
    selected,
    pathHighlighted = false,
    povLabel = null,
    relativesExpandable = false,
    relativesExpanded = false,
    focusCloseness = null,
    onSelect,
    onFocusPerson,
    onToggleRelatives,
  }: Props = $props()

  const displayName = $derived(formatPersonName(person))

  const years = $derived(
    [person.birthDate?.slice(-4), person.deathDate ? person.deathDate.slice(-4) : person.isLiving === false ? '?' : ''].filter(Boolean).join(' – '),
  )

  const sexClass = $derived(`sex-${person.sex}`)
</script>

<div
  class="node-card {sexClass}"
  class:selected
  class:path-highlighted={pathHighlighted}
  class:placeholder={person.isPlaceholder}
  class:relatives-expandable={relativesExpandable}
  class:focus-colored={focusCloseness !== null}
  class:closeness-focus={focusCloseness === 'focus'}
  class:closeness-near={focusCloseness === 'near'}
  class:closeness-extended={focusCloseness === 'extended'}
  class:closeness-remote={focusCloseness === 'remote'}
  class:closeness-none={focusCloseness === 'none'}
  data-person-id={person.id}
  data-focus-closeness={focusCloseness ?? undefined}
>
  <button
    type="button"
    class="node-main"
    aria-pressed={selected}
    onclick={() => onSelect(person.id)}
    ondblclick={() => onFocusPerson(person.id)}
  >
    <span class="name">{displayName}</span>
    {#if years}<span class="years">{years}</span>{/if}
    {#if povLabel}<span class="pov-label">{povLabel}</span>{/if}
  </button>
  <button
    type="button"
    class="focus-person-btn"
    aria-label={$t('pov.focus')}
    title={$t('pov.focus')}
    onclick={(event) => {
      event.stopPropagation()
      onFocusPerson(person.id)
    }}
  >
    <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
  </button>
  {#if relativesExpandable}
    <button
      type="button"
      class="relatives-toggle"
      aria-expanded={relativesExpanded}
      aria-label={$t(relativesExpanded ? 'tree.collapseRelatives' : 'tree.expandRelatives')}
      title={$t(relativesExpanded ? 'tree.collapseRelatives' : 'tree.expandRelatives')}
      onclick={(event) => {
        event.stopPropagation()
        onToggleRelatives?.(person.id)
      }}
    >
      {#if relativesExpanded}
        <CircleMinus size={18} strokeWidth={2.2} aria-hidden="true" />
      {:else}
        <CirclePlus size={18} strokeWidth={2.2} aria-hidden="true" />
      {/if}
    </button>
  {/if}
</div>

<style>
  .node-card {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: var(--radius-md);
    border: 2px solid var(--node-border);
    background: var(--node-bg);
    color: var(--node-fg);
    font-size: 0.75rem;
    line-height: 1.2;
    text-align: center;
    user-select: none;
    overflow: hidden;
  }

  .node-main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    padding: 1.2rem 0.35rem 0.55rem;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  .node-main:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: -3px;
  }

  .node-card.relatives-expandable .node-main {
    padding-bottom: 2.15rem;
  }

  .focus-person-btn {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    z-index: 2;
    width: 1.65rem;
    height: 1.65rem;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--accent);
    font: inherit;
    font-size: 1.05rem;
    line-height: 1;
    cursor: pointer;
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
    transition: opacity 120ms ease, transform 120ms ease, background 120ms ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .focus-person-btn {
      opacity: 0;
      transform: scale(0.85);
    }

    .node-card:hover .focus-person-btn,
    .node-card:focus-within .focus-person-btn,
    .node-card.selected .focus-person-btn {
      opacity: 1;
      transform: scale(1);
    }
  }

  .focus-person-btn:hover {
    background: var(--surface-hover);
  }

  .focus-person-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .relatives-toggle {
    position: absolute;
    right: 0.3rem;
    bottom: 0.3rem;
    z-index: 2;
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--accent);
    cursor: pointer;
    transition: background 120ms ease, transform 120ms ease;
  }

  .relatives-toggle:hover {
    background: var(--surface-hover);
    transform: scale(1.06);
  }

  .relatives-toggle:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .node-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
  }

  .node-card.path-highlighted {
    border-color: var(--path-highlight);
    box-shadow:
      0 0 0 2px var(--path-highlight-ring),
      0 0 10px var(--path-highlight-glow);
  }

  .node-card.path-highlighted.selected {
    box-shadow:
      0 0 0 3px var(--path-highlight-ring),
      0 0 14px var(--path-highlight-glow);
  }

  .node-card.placeholder {
    border-style: dashed;
    opacity: 0.75;
  }

  .node-card.sex-M {
    --node-border: var(--male-border);
    --node-bg: var(--male-bg);
  }
  .node-card.sex-F {
    --node-border: var(--female-border);
    --node-bg: var(--female-bg);
  }
  .node-card.sex-unknown {
    --node-border: var(--unknown-border);
    --node-bg: var(--unknown-bg);
  }

  .node-card.focus-colored.closeness-focus {
    --node-border: var(--closeness-focus-border);
    --node-bg: var(--closeness-focus-bg);
  }
  .node-card.focus-colored.closeness-near {
    --node-border: var(--closeness-near-border);
    --node-bg: var(--closeness-near-bg);
  }
  .node-card.focus-colored.closeness-extended {
    --node-border: var(--closeness-extended-border);
    --node-bg: var(--closeness-extended-bg);
  }
  .node-card.focus-colored.closeness-remote {
    --node-border: var(--closeness-remote-border);
    --node-bg: var(--closeness-remote-bg);
  }
  .node-card.focus-colored.closeness-none {
    --node-border: var(--closeness-none-border);
    --node-bg: var(--closeness-none-bg);
  }

  .node-card.focus-colored.selected {
    border-color: var(--node-border);
  }

  .node-card.focus-colored.closeness-focus {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--closeness-focus-border) 28%, transparent),
      0 0 16px color-mix(in srgb, var(--closeness-focus-border) 38%, transparent);
  }

  .name {
    font-weight: 600;
    white-space: normal;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .years {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  .pov-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--accent);
  }

  .node-card.focus-colored .pov-label {
    color: color-mix(in srgb, var(--node-border) 78%, var(--node-fg));
  }
</style>
