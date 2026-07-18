<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import type { TreeSummary } from '../lib/storage/localStore'
  import { createNewTree, deleteActiveTree, renameActiveTree, switchTree } from '../lib/stores/appState'
  import { t } from '../lib/i18n'

  interface Props {
    tree: Tree
    treeList: TreeSummary[]
  }

  let { tree, treeList }: Props = $props()

  function onSwitch(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value
    if (id !== tree.id) switchTree(id)
  }

  function onNew() {
    const name = prompt($t('tree.namePrompt'), 'New tree')
    if (name && name.trim()) createNewTree(name.trim())
  }

  function onRename() {
    const name = prompt($t('tree.namePrompt'), tree.name)
    if (name && name.trim()) renameActiveTree(name.trim())
  }

  function onDelete() {
    if (confirm($t('tree.deleteConfirm', { name: tree.name }))) deleteActiveTree()
  }
</script>

<div class="tree-manager">
  <select value={tree.id} onchange={onSwitch} aria-label={$t('tree.switch')}>
    {#each treeList as summary (summary.id)}
      <option value={summary.id}>{summary.name}</option>
    {/each}
  </select>
  <button type="button" onclick={onNew}>{$t('tree.new')}</button>
  <button type="button" onclick={onRename}>{$t('tree.rename')}</button>
  <button type="button" class="danger" onclick={onDelete} disabled={treeList.length <= 1}>{$t('tree.delete')}</button>
</div>

<style>
  .tree-manager {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  select,
  button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  button:hover {
    background: var(--surface-hover);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.danger {
    color: var(--danger);
  }
</style>
