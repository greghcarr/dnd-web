# CLAUDE.md

Claude Code auto-loads this at session start. It is a short safety-rail summary; the real docs are linked below.

**Read before non-trivial work:** the contributor manual [CONTRIBUTING.md](CONTRIBUTING.md), the [architecture](docs/architecture.md), and the engine-vs-viewer boundary [docs/engine-relationship.md](docs/engine-relationship.md). The docs map is [docs/README.md](docs/README.md).

## What this is

dnd-web is a 2D top-down browser viewer for the sibling [dnd-srd-engine](../dnd-srd-engine)'s combat replays. Presentation only: rules and battle state belong in the engine.

## Load-bearing rules

- **Presentation only.** If a change would alter the event log or outcome, it goes in the engine, not here. See [docs/engine-relationship.md](docs/engine-relationship.md).
- **Commit, don't push.** Local commits only; never push/amend/force-push without explicit instruction. Work goes to `dev`, not `main` ([DEVELOPMENT.md](DEVELOPMENT.md)).
- **Pre-commit:** `npm run typecheck` and `npm run build` must pass; for UI changes, also look at the running app ([CONTRIBUTING.md](CONTRIBUTING.md#verifying-a-change)).
- **No magic numbers/strings;** tunables in [src/constants/](src/constants/).
- **Engine is consumed from source;** `../dnd-srd-engine` must have `node_modules` installed. Verify engine field names against engine source.

## Conventions

TypeScript strict. Phaser: `pointerdown` not `click`, tween-based animation, depth from [constants/depths.ts](src/constants/depths.ts). File references as markdown links; no em or en dashes. Version lives in [package.json](package.json); `APP_VERSION` derives from it at build time via Vite `define` (see [vite.config.ts](vite.config.ts)), so the two cannot drift. Full list in [CONTRIBUTING.md](CONTRIBUTING.md).

## Key files

- [src/main.ts](src/main.ts): composition root; shared infra (bridge, store, game) + mode switching.
- [src/modes/](src/modes/): the [Mode](src/modes/mode.ts) abstraction and the fuzz replay viewer; the extension point for new modes.
- [src/engine/](src/engine/): engine bridge, replay store (the cursor), scrub cache.
- [src/phaser/](src/phaser/): arena scene, tokens, animations, camera, asset keys.
- [src/ui/](src/ui/): DOM panels. [src/narrator/](src/narrator/): event log to sentences. [src/constants/](src/constants/): tunables.

Architecture detail and data flow: [docs/architecture.md](docs/architecture.md).
