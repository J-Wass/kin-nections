<script lang="ts">
  import type { Tree } from '../lib/model/types'

  interface Props {
    tree: Tree
    onPick: (id: string | null) => void
    placeholder?: string
  }

  let { tree, onPick, placeholder = '' }: Props = $props()

  const uid = $props.id()
  const listboxId = `${uid}-listbox`

  let query = $state('')
  let open = $state(false)
  let highlightedIndex = $state(0)
  let inputEl: HTMLInputElement | undefined = $state()

  function personLabel(id: string): string {
    const p = tree.people[id]
    if (!p) return id
    const name = p.isPlaceholder ? 'Unknown' : `${p.firstName} ${p.lastName}`.trim() || 'Unnamed'
    // Birth year disambiguates same-name people, which are common in real genealogies.
    const year = p.birthDate?.match(/\d{4}/)?.[0]
    return year ? `${name} (b. ${year})` : name
  }

  const allOptions = $derived(Object.keys(tree.people).map((id) => ({ id, label: personLabel(id) })))

  const results = $derived(
    query.trim()
      ? allOptions.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10)
      : [],
  )

  function pick(id: string) {
    query = personLabel(id)
    open = false
    onPick(id)
  }

  function onInput() {
    open = true
    highlightedIndex = 0
    onPick(null)
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIndex = (highlightedIndex + 1) % results.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIndex = (highlightedIndex - 1 + results.length) % results.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[highlightedIndex].id)
    } else if (e.key === 'Escape') {
      open = false
    }
  }

  function onBlur() {
    // let a click on a suggestion register before closing the list
    setTimeout(() => (open = false), 150)
  }
</script>

<div class="autocomplete">
  <input
    bind:this={inputEl}
    type="text"
    role="combobox"
    aria-expanded={open}
    aria-autocomplete="list"
    aria-controls={listboxId}
    {placeholder}
    bind:value={query}
    oninput={onInput}
    onfocus={() => (open = query.trim().length > 0)}
    onkeydown={onKeydown}
    onblur={onBlur}
  />
  {#if open && results.length > 0}
    <ul class="suggestions" role="listbox" id={listboxId}>
      {#each results as result, i (result.id)}
        <li role="option" aria-selected={i === highlightedIndex}>
          <button type="button" class:highlighted={i === highlightedIndex} onmousedown={() => pick(result.id)}>
            {result.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
    min-width: 220px;
  }
  input {
    width: 100%;
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--fg);
  }
  .suggestions {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 20;
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    max-height: 260px;
    overflow-y: auto;
  }
  .suggestions button {
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.5rem;
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }
  .suggestions button:hover,
  .suggestions button.highlighted {
    background: var(--surface-hover);
  }
</style>
