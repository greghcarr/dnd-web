# Architecture

dnd-web is a browser viewer for combat replays produced by the sibling [dnd-srd-engine](../../dnd-srd-engine). It renders the engine's seed-deterministic "combat fuzz" battles as a tiled, top-down arena with a side panel of controls and logs. It is a viewer first; player control comes later.

## The two-layer split (the load-bearing principle)

The engine owns the rules and the event log. dnd-web owns presentation.

- Anything that changes **what happened in the battle** (positions, damage, who moved) must come from engine events, so the replay, scrubbing, and narration stay correct and deterministic.
- Anything that is **how it looks** (sprites, animation, camera, layout, colors) lives here.

When in doubt, that sentence decides where code goes. The fuller treatment of what belongs in the engine vs here, including the spatial roadmap, is in [engine-relationship.md](engine-relationship.md).

## Engine dependency

dnd-web consumes the engine's **TypeScript source** directly via path aliases (no build step, always the live version). Wiring is in [vite.config.ts](../vite.config.ts) and [tsconfig.json](../tsconfig.json):

- `dnd-srd-engine` and `dnd-srd-engine/starter-pack` resolve to the engine's `src/`.
- `@engine-fuzz` resolves to the engine's `scripts/combat-fuzz-core.ts` (the battle generator, which is not in the engine's package exports).
- `@/` resolves to `src/`.

Prerequisite: the sibling `../dnd-srd-engine` must have its `node_modules` installed (its `zod`/`immer`/`ulid` resolve from there). See [getting-started.md](getting-started.md).

## Data flow

Fuzz combat is **positionless**: the engine assigns no coordinates and never emits movement. The viewer therefore synthesizes a battlefield, and a single cursor drives every panel.

```
loadStarterPack + runBattle(config)  ->  Session
                                           |
   transport/config --> ReplayStore (owns the cursor) <-- mode selector
                          | { campaign @ cursor }
        +-----------------+------------------+----------------+
   ArenaScene (Phaser)   event inspector   narrator console   (status)
   tokens @ cursor       raw event log     human sentences
```

- [engine/engine-bridge.ts](../src/engine/engine-bridge.ts): loads the content pack, runs a deterministic battle, and builds a [Session](../src/state/session.ts) (full campaign, narration, formation, the opening cursor, scrub cache).
- [engine/replay-store.ts](../src/engine/replay-store.ts): the single source of truth for the cursor. Panels subscribe; on seek it materializes the campaign at the cursor via [engine/scrub-cache.ts](../src/engine/scrub-cache.ts) (LRU of cursor to campaign, ported from the engine demo) and notifies subscribers.
- The opening cursor is the start of the first turn (after spawns, level-ups, and initiative), so the arena opens fully populated and leveled, paused.

## Modes

The app is organized around top-level **modes** so future modes can reuse the replay viewer's components.

- A [Mode](../src/modes/mode.ts) is `mount(context) -> teardown`. The context exposes the shared `store`, `bridge`, `runBattle`, `getConfig`, and a `#mode-content` container to build into.
- [main.ts](../src/main.ts) owns the shared infrastructure (bridge, store, Phaser arena) and a `switchMode` that tears down the current mode and mounts the selected one. The [mode selector](../src/ui/mode-selector.ts) drives it.
- The only mode today is the [fuzz replay viewer](../src/modes/fuzz-replay-viewer.ts). Add a mode by adding an entry to `APP_MODES` ([constants/app.ts](../src/constants/app.ts)) and the `MODES` registry in main.

## Phaser arena

- [phaser/game.ts](../src/phaser/game.ts): creates the full-screen game, stashes the store in the registry.
- [phaser/scenes/BootScene.ts](../src/phaser/scenes/BootScene.ts): preloads the ground tile, props, and every character animation sheet, then starts the arena.
- [phaser/scenes/ArenaScene.ts](../src/phaser/scenes/ArenaScene.ts): draws the grass floor, a fence, seeded scatter props, and one token per combatant; updates tokens from engine state on each cursor change; reacts to single forward steps with attack/hurt animations.
- [phaser/tokens/TokenView.ts](../src/phaser/tokens/TokenView.ts): a combatant. Idle is a static "looking ahead" frame plus an occasional per-token blink; attack/hurt/death are played animations. Shows an HP bar with numeric HP, a name outlined in the team color, and a turn ring only on the active combatant.
- Positions are synthesized by [spatial/formation.ts](../src/spatial/formation.ts) (teams in adjacent center columns). This is the swap point for real engine positions when they exist.
- Render order: ground and fence are fixed layers; tokens and props y-sort by world position. See [constants/depths.ts](../src/constants/depths.ts).

## Narrator

[narrator/index.ts](../src/narrator/index.ts) turns the event log into human sentences once per session. It collapses the attack chain into one weapon-aware line, adds first-mention class/species enrichment, synthesizes a closing line from the result, and delegates other events to a curated table ([narrator/table.ts](../src/narrator/table.ts)) with name resolution ported from the engine's `tests/transcript.ts` ([narrator/resolve.ts](../src/narrator/resolve.ts)).

## DOM panels

The side panel (right column on desktop, stacked below the map on phones) hosts the [mode selector](../src/ui/mode-selector.ts), then the active mode's content: [config bar](../src/ui/inspector/config-bar.ts), [transport](../src/ui/transport/transport-bar.ts), [event inspector](../src/ui/inspector/event-inspector.ts), and [narrator console](../src/ui/console/narrator-console.ts). Layout and the responsive breakpoint are in [styles/app.css](../src/styles/app.css).

## Conventions

Tunables live in [constants/](../src/constants/) (no magic numbers). TypeScript strict. Phaser uses `pointerdown` (not `click`), tween-based animation, and a documented render-depth table. Full conventions and workflow are in [CONTRIBUTING.md](../CONTRIBUTING.md).
