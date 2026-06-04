# Development

## Prerequisites

- Node >= 20 (see [.nvmrc](.nvmrc)).
- The sibling engine repo present at `../dnd-srd-engine` with its dependencies installed:
  ```
  cd "../dnd-srd-engine" && npm install
  ```
  dnd-web consumes the engine's TypeScript source directly, so the engine does not need to be built, but its `node_modules` (zod, immer, ulid) must exist.

## Commands

```
npm install
npm run dev          # vite dev server on http://localhost:5174
npm run typecheck    # tsc --noEmit (also typechecks the aliased engine source)
npm run build        # production build to dist/
npm run preview      # serve the production build
```

## Branching

Two permanent branches:
- `main` production / deploy.
- `dev` daily work.

Feature work branches off `dev` and merges back into `dev`. `main` only advances at release points. Commits are local only; never push without an explicit request.

## Versioning

Format: `MAJOR.MINOR.PATCH[-pre-alpha|-alpha|-beta]`, starting at `0.1.0-pre-alpha`.

The version is stored in two places that must stay in sync:
- [package.json](package.json) `version`
- `APP_VERSION` in [src/constants/app.ts](src/constants/app.ts) (rendered in the bottom-left in-app badge)

Bump on meaningful user-visible changes, not on every change.

## Engine version coupling

Because dnd-web aliases to the engine source, an engine change is reflected immediately on the next dev reload or build. When the engine introduces a new event type, the narrator falls back to a humanized label automatically (no code change needed to avoid breakage), but adding a first-class sentence for it is a follow-up in `src/narrator/table.ts`.
