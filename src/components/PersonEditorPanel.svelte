<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import { addPerson, removePerson, updatePerson } from '../lib/model/treeOps'
  import { applyMutation, focusPerson, selectedPersonId } from '../lib/stores/appState'
  import { formatPersonName } from '../lib/model/personDisplay'
  import { t } from '../lib/i18n'
  import Eye from '@lucide/svelte/icons/eye'
  import RelationshipEditor from './RelationshipEditor.svelte'

  interface Props {
    tree: Tree
    personId: string
    onClose: () => void
  }

  let { tree, personId, onClose }: Props = $props()

  const person = $derived(tree.people[personId])
  const displayName = $derived(person ? formatPersonName(person) : '')

  function update(field: string, value: string | boolean) {
    applyMutation((current) => updatePerson(current, personId, { [field]: value } as never))
  }

  function onRemove() {
    if (!confirm($t('person.removeConfirm', { name: `${person.firstName} ${person.lastName}`.trim() || 'this person' }))) {
      return
    }
    applyMutation((current) => removePerson(current, personId))
    onClose()
  }

  function addNewPerson(placeholder: boolean) {
    applyMutation((current) => {
      const result = addPerson(current, { isPlaceholder: placeholder, firstName: placeholder ? 'Unknown' : '' })
      selectedPersonId.set(result.person.id)
      return result.tree
    })
  }

  function focusThis() {
    focusPerson(personId)
  }
</script>

{#if person}
  <div class="panel">
    <header class="panel-header">
      <div class="panel-title">
        <span class="panel-context">{$t('person.editPerson')}</span>
        <h2>{displayName}</h2>
      </div>
      <button type="button" class="icon-btn" onclick={onClose} aria-label={$t('common.close')}>×</button>
    </header>

    <div class="quick-actions">
      <button type="button" onclick={focusThis}>
        <Eye size={16} aria-hidden="true" />
        <span>{$t('pov.focus')}</span>
      </button>
    </div>

    <div class="panel-body">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={person.isPlaceholder ?? false}
          onchange={(e) => update('isPlaceholder', e.currentTarget.checked)}
        />
        {$t('person.placeholder')}
      </label>

      <div class="field-row">
        <label>
          {$t('person.firstName')}
          <input type="text" value={person.firstName} oninput={(e) => update('firstName', e.currentTarget.value)} />
        </label>
        <label>
          {$t('person.lastName')}
          <input type="text" value={person.lastName} oninput={(e) => update('lastName', e.currentTarget.value)} />
        </label>
      </div>

      <label>
        {$t('person.nickname')}
        <input type="text" value={person.nickname ?? ''} oninput={(e) => update('nickname', e.currentTarget.value)} />
      </label>

      <label>
        {$t('person.sex')}
        <select value={person.sex} onchange={(e) => update('sex', e.currentTarget.value)}>
          <option value="unknown">{$t('person.sex.unknown')}</option>
          <option value="M">{$t('person.sex.male')}</option>
          <option value="F">{$t('person.sex.female')}</option>
        </select>
      </label>

      <div class="field-row">
        <label>
          {$t('person.birthDate')}
          <input type="text" value={person.birthDate ?? ''} oninput={(e) => update('birthDate', e.currentTarget.value)} />
        </label>
        <label>
          {$t('person.deathDate')}
          <input type="text" value={person.deathDate ?? ''} oninput={(e) => update('deathDate', e.currentTarget.value)} />
        </label>
      </div>

      <label>
        {$t('person.birthPlace')}
        <input type="text" value={person.birthPlace ?? ''} oninput={(e) => update('birthPlace', e.currentTarget.value)} />
      </label>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={person.isLiving ?? true}
          onchange={(e) => update('isLiving', e.currentTarget.checked)}
        />
        {$t('person.living')}
      </label>

      <label>
        {$t('person.notes')}
        <textarea
          rows="4"
          placeholder={$t('person.notesPlaceholder')}
          value={person.notes}
          oninput={(e) => update('notes', e.currentTarget.value)}
        ></textarea>
      </label>

      <hr />

      <RelationshipEditor {tree} {personId} onNavigate={(id) => selectedPersonId.set(id)} />

      <hr />

      <div class="actions">
        <button type="button" class="secondary" onclick={() => addNewPerson(false)}>{$t('person.addPerson')}</button>
        <button type="button" class="secondary" onclick={() => addNewPerson(true)}>{$t('person.placeholder')}</button>
        <button type="button" class="danger" onclick={onRemove}>{$t('person.removePerson')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface);
    border-left: 1px solid var(--border);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .panel-title {
    min-width: 0;
  }
  .panel-context {
    display: block;
    margin-bottom: 0.3rem;
    color: var(--fg-muted);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  .panel-header h2 {
    margin: 0;
    font-size: 1.75rem;
    line-height: 1.1;
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    color: var(--fg-muted);
    padding: 0.25rem;
    flex-shrink: 0;
  }
  .icon-btn:hover {
    color: var(--fg);
  }

  .quick-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .quick-actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: inherit;
    font-size: 0.8rem;
    padding: 0.35rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
  }
  .quick-actions button:hover {
    background: var(--surface-hover);
  }

  .panel-body {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--fg-muted);
  }

  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .field-row {
    display: flex;
    gap: 0.75rem;
  }
  .field-row label {
    flex: 1;
  }

  input[type='text'],
  select,
  textarea {
    font: inherit;
    padding: 0.45rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--fg);
  }

  textarea {
    resize: vertical;
    font-family: inherit;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.25rem 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button.secondary,
  button.danger {
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.85rem;
  }
  button.secondary:hover {
    background: var(--surface-hover);
  }
  button.danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  button.danger:hover {
    background: var(--danger-bg-hover);
  }
</style>
