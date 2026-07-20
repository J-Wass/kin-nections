<script lang="ts">
  import { addPerson } from './lib/model/treeOps'
  import { applyMutation, focusPerson, focusRequestVersion, povPersonId, selectedPersonId, showImportExport, tree, treeList } from './lib/stores/appState'
  import { t } from './lib/i18n'
  import { dismissOnOutsidePointer } from './lib/dom/dismissOnOutsidePointer'
  import TreeCanvas from './components/TreeCanvas.svelte'
  import PersonEditorPanel from './components/PersonEditorPanel.svelte'
  import TreeManagerBar from './components/TreeManagerBar.svelte'
  import ImportExportModal from './components/ImportExportModal.svelte'
  import PovModePanel from './components/PovModePanel.svelte'
  import LanguageSwitcher from './components/LanguageSwitcher.svelte'
  import Menu from '@lucide/svelte/icons/menu'
  import FileUp from '@lucide/svelte/icons/file-up'

  const isEmpty = $derived(Object.keys($tree.people).length === 0)
  let mainMenu: HTMLDetailsElement | undefined = $state()

  function closeMainMenu() {
    if (mainMenu) mainMenu.open = false
  }

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
    <div class="primary-search">
      <PovModePanel tree={$tree} />
    </div>
    <div class="header-menu">
      <details bind:this={mainMenu} use:dismissOnOutsidePointer={closeMainMenu}>
        <summary aria-label={$t('app.menu')} title={$t('app.menu')}>
          <Menu size={20} aria-hidden="true" />
        </summary>
        <div class="menu-panel">
          <section class="menu-section">
            <h2>{$t('tree.manage')}</h2>
            <TreeManagerBar tree={$tree} treeList={$treeList} />
          </section>
          <div class="menu-footer">
            <button type="button" onclick={() => showImportExport.set(true)}>
              <FileUp size={16} aria-hidden="true" />
              <span>{$t('importExport.title')}</span>
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </details>
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
          focusRequestVersion={$focusRequestVersion}
          onSelectPerson={(id) => selectedPersonId.set(id)}
          onFocusPerson={focusPerson}
          onStandardView={() => povPersonId.set(null)}
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
    display: grid;
    grid-template-columns: auto minmax(360px, 680px) auto;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .brand h1 {
    font-size: 1.15rem;
    margin: 0;
  }

  .primary-search {
    min-width: 0;
    width: 100%;
  }

  .header-menu {
    position: relative;
  }
  .header-menu details {
    position: relative;
  }
  .header-menu summary {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    list-style: none;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  .header-menu summary::-webkit-details-marker {
    display: none;
  }
  .header-menu summary:hover,
  .header-menu details[open] > summary {
    background: var(--surface-hover);
  }
  .menu-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    inset-inline-end: 0;
    z-index: 30;
    width: min(390px, calc(100vw - 2rem));
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  }
  .menu-section h2 {
    margin: 0 0 0.65rem;
    font-size: 0.78rem;
    font-weight: 650;
    color: var(--fg-muted);
  }
  .menu-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.85rem;
    margin-top: 0.85rem;
    border-top: 1px solid var(--border);
  }
  .menu-footer button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  .menu-footer button:hover {
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
    .app-header {
      grid-template-columns: 1fr auto;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem;
    }
    .primary-search {
      grid-column: 1 / -1;
      grid-row: 2;
    }
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
