<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import { povPersonId, requestScrollToPerson } from '../lib/stores/appState'
  import { t } from '../lib/i18n'
  import PersonAutocomplete from './PersonAutocomplete.svelte'

  interface Props {
    tree: Tree
  }

  let { tree }: Props = $props()

  let pickedPersonId: string | null = $state(null)

  function scrollToPicked() {
    if (pickedPersonId) requestScrollToPerson(pickedPersonId)
  }

  function focusPicked() {
    if (pickedPersonId) povPersonId.set(pickedPersonId)
  }

  function exitFocus() {
    povPersonId.set(null)
  }
</script>

<div class="pov-panel">
  <PersonAutocomplete {tree} placeholder={$t('pov.choosePerson')} onPick={(id) => (pickedPersonId = id)} />
  <button type="button" onclick={scrollToPicked} disabled={!pickedPersonId}>{$t('pov.scrollTo')}</button>
  <button type="button" onclick={focusPicked} disabled={!pickedPersonId}>{$t('pov.focus')}</button>
  {#if $povPersonId}
    <button type="button" onclick={exitFocus}>{$t('pov.exit')}</button>
  {/if}
</div>

<style>
  .pov-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--surface-hover);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
