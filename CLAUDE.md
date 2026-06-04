# dnd-web

A full-screen 2D top-down RPG-style viewer (Pokemon-like) for combat replays produced by the sibling [dnd-srd-engine](../dnd-srd-engine) project. v1 plays back the engine's seed-deterministic "combat fuzz" battles; the player has no control yet (replay only). Later versions will add player agency.

## Architecture

Hybrid renderer:
- **Phaser 3** draws the full-screen tiled map and character tokens (`#game-root` canvas).
- **HTML/DOM** draws the right-hand column (config bar, narrator console, event inspector) and the top-centre transport bar, overlaid on the canvas.

The engine combat model is **positionless**: fuzz battles assign no coordinates, build no map, and emit no movement events. dnd-web therefore **synthesizes** the entire spatial layer: it places each team in static facing ranks on a grid. Nothing the map shows feeds back into the engine; it is a visualization of an abstract event log.

### Data flow

```
loadStarterPack + runBattle(seed,...)  ->  Session
                                             |
   transport --seek-->  replay-store (owns cursor)  <--restart-- config-bar
                          | { campaign @ cursor }
        +-----------------+------------------+
   ArenaScene (Phaser)  event-inspector   narrator-console
   tokens @ cursor      raw event log     human sentences
```

- A single **cursor** is the source of truth. `replay-store` owns it; panels subscribe. On seek it computes the campaign at the cursor via `scrub-cache` (`replay(events[0..cursor])` cold, `applyAll(nearestPrefix, gap)` warm; LRU bound 128) and notifies subscribers.
- **Narration** is precomputed once per session into `NarrationLine[]` indexed by event; on seek the console just slices lines visible at the cursor.

## Engine dependency

dnd-web aliases directly to the engine's **TypeScript source** (not its built dist), so engine edits are picked up with no rebuild and dnd-web always runs the live engine version. Wiring lives in [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json):

- `dnd-srd-engine` -> `../dnd-srd-engine/src/index.ts`
- `dnd-srd-engine/starter-pack` -> `../dnd-srd-engine/src/starter-pack.ts`
- `@engine-fuzz` -> `../dnd-srd-engine/scripts/combat-fuzz-core.ts` (the fuzz generator; not in the engine's package exports)
- `@/` -> `src/`

Prerequisite: the sibling `../dnd-srd-engine` must have its `node_modules` installed (its `zod`/`immer`/`ulid` resolve from there). Vite's `server.fs.allow` is widened to read the sibling source.

## Conventions

- TypeScript strict mode. No magic numbers or strings: all tunables live in `src/constants/`.
- Phaser: `pointerdown` (not `click`); `useHandCursor: true` on interactive objects; tween-based animation (no frame-step tweens for movement); manual AABB/circle for any hit-testing (no Arcade Physics).
- Render depth is centralized in `src/constants/depths.ts`. Every game object sets its depth from `RENDER_DEPTH`. Layers (low to high): GROUND, GRID_LINES, TILE_DECOR, TOKEN_SHADOW, TOKEN_BODY, TOKEN_RING, TOKEN_HP_BAR, TOKEN_LABEL, FX, CAMERA_UI.
- File references in prose as markdown links, not backtick paths. No em or en dashes.
- Version lives in both `package.json` and the in-app badge (`APP_VERSION` in `src/constants/app.ts`); keep them in sync.

## Key files

- [src/main.ts](src/main.ts) composition root.
- [src/constants/](src/constants/) all tunables (app, layout, depths, colors, timing).
- `src/engine/` engine bridge, scrub cache, replay store, encounter selection.
- `src/narrator/` event -> human sentence (ports the engine's `tests/transcript.ts` resolution).
- `src/spatial/formation.ts` deterministic facing-rank position synthesis.
- `src/phaser/` game, scenes (Boot, Arena), tokens, asset keys, camera.
- `src/ui/` DOM panels (transport, inspector, console, config).
- [ASSET_MANIFEST.md](ASSET_MANIFEST.md) art inventory, frame layout, and sprite mapping.

See [DEVELOPMENT.md](DEVELOPMENT.md) for branching, versioning, and run commands.
