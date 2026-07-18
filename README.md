# Kin-nections

A static, no-login family tree manager. Add, remove, and edit people; model parents/children, spouses, ex-spouses, siblings, and unknown/placeholder people; attach notes; import/export as native JSON, GEDCOM, or CSV; and use **PoV mode** to see how everyone in the tree relates to a chosen person.

Everything is stored in the browser's `localStorage` — no backend, no accounts, no server round-trips.

## Development

```sh
npm install
npm run dev      # local dev server with HMR
npm run build    # production build to dist/
npm run preview  # preview the production build
npm test         # run the vitest suite once
npm run test:watch
npm run check    # svelte-check + TypeScript
```

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages via `.github/workflows/deploy.yml`. In the repo's Settings → Pages, set the source to **GitHub Actions**.

`vite.config.ts` sets the production `base` to `/kin-nections/` for GitHub Pages project-site routing. If you push this to a repo with a different name, update that path to match (or to `/` for a user/org page or custom domain).

## Tech stack

Vite + TypeScript + Svelte, compiled to plain static assets. No runtime backend.
