# Contributing to dnd-web

This is the contributor manual. Anyone doing non-trivial work (human or AI agent) reads this and [docs/architecture.md](docs/architecture.md) first. For branching and versioning specifics see [DEVELOPMENT.md](DEVELOPMENT.md).

## Setup

dnd-web consumes the sibling engine from source. Install the engine's deps once, then dnd-web's:

```
cd "../dnd-srd-engine" && npm install
cd "../dnd-web" && npm install
npm run dev
```

Details and what the app does are in [docs/getting-started.md](docs/getting-started.md).

## The one principle

Rules and battle state live in the engine; dnd-web is presentation. If a change would alter the event log or the outcome, it belongs in the engine (as event-sourced logic), not here. See [docs/engine-relationship.md](docs/engine-relationship.md). Getting this boundary wrong is the easiest way to break determinism, scrubbing, and the logs.

## Code style

- TypeScript strict. No magic numbers or strings: put tunables in [src/constants/](src/constants/).
- Small, intention-revealing functions; prefer editing existing files over adding new ones.
- Reference files in prose as markdown links, not backtick paths. No em or en dashes.
- Phaser: `pointerdown` (not `click`), `useHandCursor` on interactive objects, tween-based animation, manual AABB/circle (no Arcade Physics), and every game object sets its depth from [constants/depths.ts](src/constants/depths.ts).
- The version lives in [package.json](package.json). `APP_VERSION` in [src/constants/app.ts](src/constants/app.ts) derives from it at build time via Vite `define` (see [vite.config.ts](vite.config.ts)); the engine version + short SHA are injected the same way and surfaced together in the version-badge. To bump the app version, edit `package.json` only.

## Where things go

- New tunable -> [src/constants/](src/constants/).
- New panel / control -> [src/ui/](src/ui/), mounted by a mode.
- New app mode -> add to `APP_MODES` ([src/constants/app.ts](src/constants/app.ts)) and the `MODES` registry in [src/main.ts](src/main.ts); implement [Mode](src/modes/mode.ts) and reuse the shared store/components.
- New event sentence in the battle log -> [src/narrator/table.ts](src/narrator/table.ts) (or the collapse logic in [src/narrator/index.ts](src/narrator/index.ts)).
- New rendering on the map -> [src/phaser/](src/phaser/).
- New art -> [public/assets/](public/assets/) per [ASSET_MANIFEST.md](ASSET_MANIFEST.md).

## Verifying a change

This is a visual, interactive app, so "it compiles" is not enough.

1. **Typecheck and build** (both must pass; the typecheck also covers the aliased engine source):
   ```
   npm run typecheck
   npm run build
   ```
2. **Look at it.** `npm run dev` and exercise the change in the browser. For UI changes, confirm both desktop and a narrow (phone) width.
3. For automated visual checks, a headless browser works well; render with software WebGL so the Phaser canvas draws (Chromium flags `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Screenshot and inspect.

If a change touches replay logic, confirm the engine event semantics by checking field names against the engine source (e.g. [tests/transcript.ts](../dnd-srd-engine/tests/transcript.ts)) rather than guessing.

## Git

See [DEVELOPMENT.md](DEVELOPMENT.md) for branches. Commit, never push, unless explicitly asked. Keep commits per logical unit. End commit messages with the project co-author trailer.

## Documentation

Docs are part of the change. When you add a capability, update the relevant doc (or add one under [docs/](docs/)) and link it from [docs/README.md](docs/README.md). The project is early; growing the docs alongside the code is expected.
