<script lang="ts">
  import { addPerson } from './lib/model/treeOps'
  import { applyMutation, povPersonId, selectedPersonId, showImportExport, tree, treeList } from './lib/stores/appState'
  import { t } from './lib/i18n'
  import TreeCanvas from './components/TreeCanvas.svelte'
  import PersonEditorPanel from './components/PersonEditorPanel.svelte'
  import TreeManagerBar from './components/TreeManagerBar.svelte'
  import ImportExportModal from './components/ImportExportModal.svelte'
  import PovModePanel from './components/PovModePanel.svelte'
  import LanguageSwitcher from './components/LanguageSwitcher.svelte'

  const isEmpty = $derived(Object.keys($tree.people).length === 0)

  function addFirstPerson() {
    applyMutation((current) => {
      const result = addPerson(current, { firstName: '', lastName: '' })
      selectedPersonId.set(result.person.id)
      return result.tree
    })
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <div class="brand">
      <h1>{$t('app.title')}</h1>
    </div>
    <div class="header-controls">
      <TreeManagerBar tree={$tree} treeList={$treeList} />
      <PovModePanel tree={$tree} />
      <button type="button" onclick={() => showImportExport.set(true)}>{$t('importExport.title')}</button>
      <LanguageSwitcher />
    </div>
  </header>

  <main class="app-main">
    <div class="canvas-area">
      {#if isEmpty}
        <div class="empty-state">
          <p>{$t('tree.empty')}</p>
          <button type="button" onclick={addFirstPerson}>{$t('person.addFirst')}</button>
        </div>
      {:else}
        <TreeCanvas
          tree={$tree}
          selectedPersonId={$selectedPersonId}
          povPersonId={$povPersonId ?? null}
          onSelectPerson={(id) => selectedPersonId.set(id)}
        />
      {/if}
    </div>

    {#if $selectedPersonId && $tree.people[$selectedPersonId]}
      <aside class="editor-area">
        <PersonEditorPanel tree={$tree} personId={$selectedPersonId} onClose={() => selectedPersonId.set(null)} />
      </aside>
    {/if}
  </main>
</div>

{#if $showImportExport}
  <ImportExportModal tree={$tree} />
{/if}

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .brand h1 {
    font-size: 1.15rem;
    margin: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .header-controls > button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  .header-controls > button:hover {
    background: var(--surface-hover);
  }

  .app-main {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .canvas-area {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .editor-area {
    width: min(380px, 100%);
    flex-shrink: 0;
  }

  .empty-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    padding: 2rem;
    color: var(--fg-muted);
  }
  .empty-state button {
    font: inherit;
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-fg);
    cursor: pointer;
    font-size: 0.9rem;
  }

  @media (max-width: 720px) {
    .app-main {
      flex-direction: column;
    }
    .editor-area {
      width: 100%;
      max-height: 60vh;
      border-top: 1px solid var(--border);
    }
  }
</style>
