<script lang="ts">
  import type { Person } from '../lib/model/types'

  interface Props {
    person: Person
    selected: boolean
    povLabel?: string | null
    onSelect: (id: string) => void
  }

  let { person, selected, povLabel = null, onSelect }: Props = $props()

  const displayName = $derived(
    person.isPlaceholder
      ? '❓ Unknown'
      : `${person.firstName} ${person.lastName}`.trim() || 'Unnamed',
  )

  const years = $derived(
    [person.birthDate?.slice(-4), person.deathDate ? person.deathDate.slice(-4) : person.isLiving === false ? '?' : ''].filter(Boolean).join(' – '),
  )

  const sexClass = $derived(`sex-${person.sex}`)
</script>

<div
  class="node-card {sexClass}"
  class:selected
  class:placeholder={person.isPlaceholder}
  role="button"
  tabindex="0"
  aria-pressed={selected}
  onclick={() => onSelect(person.id)}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(person.id)
    }
  }}
>
  <span class="name">{displayName}</span>
  {#if years}<span class="years">{years}</span>{/if}
  {#if povLabel}<span class="pov-label">{povLabel}</span>{/if}
</div>

<style>
  .node-card {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-md);
    border: 2px solid var(--node-border);
    background: var(--node-bg);
    color: var(--node-fg);
    font-size: 0.8rem;
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
    user-select: none;
    overflow: hidden;
  }

  .node-card:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .node-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
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
