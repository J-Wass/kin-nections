<script lang="ts">
  import { availableLocales, currentLocale, t, type LocaleCode } from '../lib/i18n'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'

  function onChange(e: Event) {
    currentLocale.set((e.currentTarget as HTMLSelectElement).value as LocaleCode)
  }
</script>

<label class="language-switcher">
  <span class="language-glyphs" aria-hidden="true">文 A ض</span>
  <ChevronDown size={14} aria-hidden="true" />
  <select class="language-select" value={$currentLocale} onchange={onChange} aria-label={$t('language.label')}>
    {#each availableLocales as locale (locale.code)}
      <option value={locale.code}>{locale.label}</option>
    {/each}
  </select>
</label>

<style>
  .language-switcher {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.125rem;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
    user-select: none;
  }

  .language-switcher:hover {
    border-color: var(--accent);
  }

  .language-switcher:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .language-glyphs {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .language-select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
