<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import { focusPerson, povPersonId } from '../lib/stores/appState'
  import { t } from '../lib/i18n'
  import Eye from '@lucide/svelte/icons/eye'
  import PersonAutocomplete from './PersonAutocomplete.svelte'

  interface Props {
    tree: Tree
  }

  let { tree }: Props = $props()

  let pickedPersonId: string | null = $state(null)

  function focusPicked() {
    if (!pickedPersonId) return
    focusPerson(pickedPersonId)
  }

  function exitFocus() {
    povPersonId.set(null)
  }
</script>

<div class="pov-panel">
  <div class="focus-search">
    <PersonAutocomplete {tree} large placeholder={$t('pov.choosePerson')} onPick={(id) => (pickedPersonId = id)} />
    <button class="focus-submit" type="button" onclick={focusPicked} disabled={!pickedPersonId}>
      <Eye size={18} aria-hidden="true" />
      <span>{$t('pov.focus')}</span>
    </button>
  </div>
  {#if $povPersonId}
    <button type="button" onclick={exitFocus}>{$t('pov.exit')}</button>
  {/if}
</div>

<style>
  .pov-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }
  .focus-search {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-width: 360px;
    max-width: 680px;
  }
  .focus-search :global(.autocomplete) {
    flex: 1;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  button.focus-submit {
    min-height: 44px;
    padding-inline: 0.9rem;
    border-left: 0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }
  button.focus-submit:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 88%, black);
  }
  button:hover:not(:disabled) {
    background: var(--surface-hover);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  @media (max-width: 720px) {
    .pov-panel {
      align-items: stretch;
    }
    .focus-search {
      min-width: 0;
      max-width: none;
    }
    .focus-submit span {
      display: none;
    }
  }
</style>
