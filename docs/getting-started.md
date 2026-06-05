# Getting started

A 5-minute path to running dnd-web locally.

## Prerequisites

- Node >= 20 (see [.nvmrc](../.nvmrc)).
- The sibling engine repo present at `../dnd-srd-engine` with its dependencies installed. dnd-web consumes the engine from source, so the engine does not need to be built, but its `node_modules` (zod, immer, ulid) must exist:
  ```
  cd "../dnd-srd-engine" && npm install
  ```

## Run it

```
cd "../dnd-web" && npm install
npm run dev
```

Open http://localhost:5174. You should see two combatants facing each other on a fenced grass arena, paused at the start, with a side panel of controls.

## What you can do

- **Transport** (the playback buttons): jump to start, step back, play/pause, step forward, jump to end. Keyboard: arrows step, Home/End jump, Space plays.
- **Config dropdowns**: change seed, teams (1v1 / 2v2), opponents (PC / monster), or level; the encounter reloads instantly, paused.
- **Battle log**: the fight in plain sentences. **Event log**: the raw engine events.

## Commands

```
npm run dev          # vite dev server on http://localhost:5174
npm run typecheck    # tsc --noEmit (also typechecks the aliased engine source)
npm run build        # production build to dist/
npm run preview      # serve the production build
```

## Where to go next

- Understand how it fits together: [architecture.md](architecture.md).
- Make a change: [CONTRIBUTING.md](../CONTRIBUTING.md).
- What is planned: [roadmap.md](roadmap.md).
