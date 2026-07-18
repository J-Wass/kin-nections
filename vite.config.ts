import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves project sites from /<repo-name>/. `vite preview` reports
  // command as 'serve' just like `vite dev` does, so it must be checked separately
  // via `isPreview` — otherwise preview serves base '/' while the already-built
  // dist/index.html still references '/kin-nections/', breaking every asset URL.
  base: command === 'build' || isPreview ? '/kin-nections/' : '/',
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
