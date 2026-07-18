<script lang="ts">
  import { availableLocales, currentLocale, t, type LocaleCode } from '../lib/i18n'

  function onChange(e: Event) {
    currentLocale.set((e.currentTarget as HTMLSelectElement).value as LocaleCode)
  }
</script>

<label class="language-switcher">
  <span class="sr-only">{$t('language.label')}</span>
  <select value={$currentLocale} onchange={onChange} aria-label={$t('language.label')}>
    {#each availableLocales as locale (locale.code)}
      <option value={locale.code}>{locale.label}</option>
    {/each}
  </select>
</label>

<style>
  select {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
