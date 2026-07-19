<script lang="ts">
  import type { Person } from '../lib/model/types'
  import { formatPersonName } from '../lib/model/personDisplay'
  import { t } from '../lib/i18n'
  import Eye from '@lucide/svelte/icons/eye'

  interface Props {
    person: Person
    selected: boolean
    pathHighlighted?: boolean
    povLabel?: string | null
    onSelect: (id: string) => void
    onFocusPerson: (id: string) => void
  }

  let { person, selected, pathHighlighted = false, povLabel = null, onSelect, onFocusPerson }: Props = $props()

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
    font-size: 0.8rem;
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
    padding: 1.15rem 0.45rem 0.55rem;
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
    opacity: 0;
    pointer-events: none;
    transform: scale(0.85);
    transition: opacity 120ms ease, transform 120ms ease, background 120ms ease;
  }

  .node-card:hover .focus-person-btn,
  .node-card:focus-within .focus-person-btn,
  .node-card.selected .focus-person-btn {
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
  }

  .focus-person-btn:hover {
    background: var(--surface-hover);
  }

  .focus-person-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  @media (hover: none) {
    .focus-person-btn {
      opacity: 1;
      pointer-events: auto;
      transform: scale(1);
    }
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

  .name {
    font-weight: 600;
    white-space: normal;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
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
</style>
