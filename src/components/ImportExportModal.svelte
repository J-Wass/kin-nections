<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import { createEmptyTree } from '../lib/model/types'
  import { generateId } from '../lib/model/treeOps'
  import { parseGedcom } from '../lib/gedcom/parse'
  import { serializeGedcom } from '../lib/gedcom/serialize'
  import { parseCsvTree } from '../lib/csv/parse'
  import { serializeCsv } from '../lib/csv/serialize'
  import { replaceActiveTree, showImportExport } from '../lib/stores/appState'
  import { t } from '../lib/i18n'

  interface Props {
    tree: Tree
  }

  let { tree }: Props = $props()

  type Format = 'json' | 'gedcom' | 'csv' | 'pdf'
  let format: Format = $state('json')
  let importError: string | null = $state(null)
  let importSuccess: string | null = $state(null)
  let fileInput: HTMLInputElement | undefined = $state()

  function close() {
    showImportExport.set(false)
  }

  function download(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function onExport() {
    if (format === 'json') {
      download(JSON.stringify(tree, null, 2), `${tree.name}.json`, 'application/json')
    } else if (format === 'gedcom') {
      download(serializeGedcom(tree), `${tree.name}.ged`, 'text/plain')
    } else {
      download(serializeCsv(tree), `${tree.name}.csv`, 'text/csv')
    }
  }

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    importError = null
    importSuccess = null
    try {
      const treeName = file.name.replace(/\.[^.]+$/, '')
      let imported: Tree
      if (format === 'json') {
        const parsed = JSON.parse(await file.text()) as Tree
        imported = { ...parsed, id: generateId('tree') }
      } else if (format === 'gedcom') {
        imported = parseGedcom(await file.text(), treeName)
      } else if (format === 'csv') {
        imported = parseCsvTree(await file.text(), treeName)
      } else {
        const [{ extractLines }, { inferDepths, parseRegisterReport }] = await Promise.all([
          import('../lib/pdf/extract'),
          import('../lib/pdf/parse'),
        ])
        const lines = await extractLines(await file.arrayBuffer())
        imported = parseRegisterReport(inferDepths(lines), treeName)
      }
      replaceActiveTree(imported)
      importSuccess = $t('importExport.importSuccess', { count: Object.keys(imported.people).length })
    } catch (err) {
      importError = $t('importExport.importError', { message: err instanceof Error ? err.message : String(err) })
    } finally {
      input.value = ''
    }
  }
</script>

<div
  class="modal-backdrop"
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="presentation"
>
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label={$t('importExport.title')}
  >
    <header>
      <h2>{$t('importExport.title')}</h2>
      <button type="button" class="icon-btn" onclick={close} aria-label={$t('common.close')}>×</button>
    </header>

    <div class="body">
      <label>
        {$t('importExport.format')}
        <select bind:value={format}>
          <option value="json">{$t('importExport.format.json')}</option>
          <option value="gedcom">{$t('importExport.format.gedcom')}</option>
          <option value="csv">{$t('importExport.format.csv')}</option>
          <option value="pdf">{$t('importExport.format.pdf')}</option>
        </select>
      </label>

      <div class="row">
        {#if format !== 'pdf'}
          <button type="button" onclick={onExport}>{$t('importExport.export')}</button>
        {/if}
        <button type="button" onclick={() => fileInput?.click()}>{$t('importExport.chooseFile')}</button>
        <input
          bind:this={fileInput}
          type="file"
          accept={format === 'json'
            ? '.json'
            : format === 'gedcom'
              ? '.ged,.gedcom'
              : format === 'csv'
                ? '.csv'
                : '.pdf'}
          onchange={onImportFile}
          hidden
        />
      </div>
      {#if format === 'pdf'}
        <p class="hint">{$t('importExport.pdfHint')}</p>
      {/if}

      {#if importSuccess}<p class="success">{importSuccess}</p>{/if}
      {#if importError}<p class="error">{importError}</p>{/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }
  .modal {
    background: var(--surface);
    border-radius: var(--radius-md);
    width: min(420px, 100%);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .icon-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    color: var(--fg-muted);
  }
  .body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--fg-muted);
  }
  select {
    font: inherit;
    padding: 0.45rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--fg);
  }
  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .row button {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .row button:hover {
    background: var(--surface-hover);
  }
  .hint {
    color: var(--fg-muted);
    font-size: 0.8rem;
    margin: 0;
  }
  .success {
    color: var(--success);
    font-size: 0.85rem;
  }
  .error {
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
