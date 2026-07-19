<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import {
    addSibling,
    addSpouse,
    getChildrenOf,
    getParentsOf,
    getSiblingsOf,
    getSpousesOf,
    markDivorced,
    setParents,
  } from '../lib/model/treeOps'
  import { applyMutation } from '../lib/stores/appState'
  import { formatPersonName } from '../lib/model/personDisplay'
  import { t } from '../lib/i18n'

  interface Props {
    tree: Tree
    personId: string
    onNavigate: (id: string) => void
  }

  let { tree, personId, onNavigate }: Props = $props()

  const parents = $derived(getParentsOf(tree, personId))
  const children = $derived(getChildrenOf(tree, personId))
  const siblings = $derived(getSiblingsOf(tree, personId))
  const spouses = $derived(getSpousesOf(tree, personId))

  const otherPeople = $derived(Object.values(tree.people).filter((p) => p.id !== personId))
  const ancestorIds = $derived.by(() => collectRelativeIds(personId, (id) => getParentsOf(tree, id).map((person) => person.id)))
  const descendantIds = $derived.by(() => collectRelativeIds(personId, (id) => getChildrenOf(tree, id).map((person) => person.id)))
  const parentOptions = $derived(otherPeople.filter((person) =>
    !parents.some((parent) => parent.id === person.id) && !descendantIds.has(person.id)))
  const childOptions = $derived(otherPeople.filter((person) => {
    if (children.some((child) => child.id === person.id) || ancestorIds.has(person.id)) return false
    const existingParents = getParentsOf(tree, person.id)
    return existingParents.length < 2 || existingParents.some((parent) => parent.id === personId)
  }))
  const spouseOptions = $derived(otherPeople.filter((person) =>
    !spouses.some((spouse) => spouse.person.id === person.id)))
  const siblingOptions = $derived(otherPeople.filter((person) =>
    !siblings.some((sibling) => sibling.id === person.id)))

  let parentPick = $state('')
  let childPick = $state('')
  let spousePick = $state('')
  let siblingPick = $state('')

  function collectRelativeIds(startId: string, neighbors: (id: string) => string[]): Set<string> {
    const found = new Set<string>()
    const queue = [startId]
    while (queue.length > 0) {
      for (const id of neighbors(queue.shift()!)) {
        if (found.has(id)) continue
        found.add(id)
        queue.push(id)
      }
    }
    return found
  }

  function personLabel(id: string): string {
    const p = tree.people[id]
    if (!p) return id
    return formatPersonName(p)
  }

  function addParent() {
    if (!parentPick) return
    const newParentIds = [...parents.map((p) => p.id), parentPick].slice(0, 2)
    applyMutation((current) => setParents(current, personId, newParentIds))
    parentPick = ''
  }

  function addChild() {
    if (!childPick) return
    applyMutation((current) => {
      const parentIds = [...new Set([...getParentsOf(current, childPick).map((parent) => parent.id), personId])]
      return setParents(current, childPick, parentIds)
    })
    childPick = ''
  }

  function addSpouseRelation() {
    if (!spousePick) return
    applyMutation((current) => addSpouse(current, personId, spousePick).tree)
    spousePick = ''
  }

  function addSiblingRelation() {
    if (!siblingPick) return
    applyMutation((current) => addSibling(current, personId, siblingPick))
    siblingPick = ''
  }

  function divorce(spouseId: string) {
    applyMutation((current) => markDivorced(current, personId, spouseId))
  }

  function removeParent(parentId: string) {
    const remainingParentIds = parents.filter((parent) => parent.id !== parentId).map((parent) => parent.id)
    applyMutation((current) => setParents(current, personId, remainingParentIds))
  }

  function removeChild(childId: string) {
    const remainingParentIds = getParentsOf(tree, childId)
      .filter((parent) => parent.id !== personId)
      .map((parent) => parent.id)
    applyMutation((current) => setParents(current, childId, remainingParentIds))
  }
</script>

<div class="relationship-editor">
  <section>
    <h3>{$t('relationship.parents')}</h3>
    <ul class="chip-list">
      {#each parents as parent (parent.id)}
        <li>
          <button type="button" class="chip" onclick={() => onNavigate(parent.id)}>{personLabel(parent.id)}</button>
          <button type="button" class="chip-remove" aria-label="Remove parent" onclick={() => removeParent(parent.id)}>×</button>
        </li>
      {:else}
        <li class="empty">{$t('common.none')}</li>
      {/each}
    </ul>
    {#if parents.length < 2}
      <div class="add-row">
        <select bind:value={parentPick}>
          <option value="">{$t('relationship.addParent')}</option>
          {#each parentOptions as p (p.id)}
            <option value={p.id}>{personLabel(p.id)}</option>
          {/each}
        </select>
        <button type="button" onclick={addParent} disabled={!parentPick}>{$t('common.add')}</button>
      </div>
    {/if}
  </section>

  <section>
    <h3>{$t('relationship.children')}</h3>
    <ul class="chip-list">
      {#each children as childP (childP.id)}
        <li>
          <button type="button" class="chip" onclick={() => onNavigate(childP.id)}>{personLabel(childP.id)}</button>
          <button type="button" class="chip-remove" aria-label="Remove child" onclick={() => removeChild(childP.id)}>×</button>
        </li>
      {:else}
        <li class="empty">{$t('common.none')}</li>
      {/each}
    </ul>
    <div class="add-row">
      <select bind:value={childPick}>
        <option value="">{$t('relationship.addChild')}</option>
        {#each childOptions as p (p.id)}
          <option value={p.id}>{personLabel(p.id)}</option>
        {/each}
      </select>
      <button type="button" onclick={addChild} disabled={!childPick}>{$t('common.add')}</button>
    </div>
  </section>

  <section>
    <h3>{$t('relationship.spouses')}</h3>
    <ul class="chip-list">
      {#each spouses as spouse (spouse.person.id)}
        <li>
          <button type="button" class="chip" onclick={() => onNavigate(spouse.person.id)}>
            {personLabel(spouse.person.id)}
            <span class="status">({$t(`relationship.status.${spouse.status}`)})</span>
          </button>
          {#if spouse.status !== 'divorced'}
            <button type="button" class="chip-action" onclick={() => divorce(spouse.person.id)}>
              {$t('relationship.markDivorced')}
            </button>
          {/if}
        </li>
      {:else}
        <li class="empty">{$t('common.none')}</li>
      {/each}
    </ul>
    <div class="add-row">
      <select bind:value={spousePick}>
        <option value="">{$t('relationship.addSpouse')}</option>
        {#each spouseOptions as p (p.id)}
          <option value={p.id}>{personLabel(p.id)}</option>
        {/each}
      </select>
      <button type="button" onclick={addSpouseRelation} disabled={!spousePick}>{$t('common.add')}</button>
    </div>
  </section>

  <section>
    <h3>{$t('relationship.siblings')}</h3>
    <ul class="chip-list">
      {#each siblings as sib (sib.id)}
        <li>
          <button type="button" class="chip" onclick={() => onNavigate(sib.id)}>{personLabel(sib.id)}</button>
        </li>
      {:else}
        <li class="empty">{$t('common.none')}</li>
      {/each}
    </ul>
    {#if parents.length === 0}
      <div class="add-row">
        <select bind:value={siblingPick}>
          <option value="">{$t('relationship.addSibling')}</option>
          {#each siblingOptions as p (p.id)}
            <option value={p.id}>{personLabel(p.id)}</option>
          {/each}
        </select>
        <button type="button" onclick={addSiblingRelation} disabled={!siblingPick}>{$t('common.add')}</button>
      </div>
    {/if}
  </section>
</div>

<style>
  .relationship-editor section {
    margin-bottom: 1.25rem;
  }
  h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--fg-muted);
    margin: 0 0 0.5rem;
  }
  .chip-list {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0 0 0.5rem;
    padding: 0;
  }
  .chip-list li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .chip,
  .chip-action {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .chip:hover,
  .chip-action:hover {
    background: var(--surface-hover);
  }
  .chip-remove {
    border: none;
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.25rem;
  }
  .status {
    opacity: 0.7;
    font-size: 0.72rem;
  }
  .empty {
    color: var(--fg-muted);
    font-size: 0.85rem;
  }
  .add-row {
    display: flex;
    gap: 0.4rem;
  }
  .add-row select {
    flex: 1;
    min-width: 0;
  }
</style>
