# Status and roadmap

dnd-web is in early development (`0.1.0-pre-alpha`). This file is the living picture of what works and what is next. It will grow.

## Status: what works today

- Full-screen top-down arena: tiled grass, a wooden fence, scattered props (trees/bushes/stones), seeded per battle.
- Combatants rendered with CraftPix sprites: directional idle (look-ahead pose with occasional per-token blinks), attack/hurt/death animations on forward steps, HP bar with numeric HP, team color on the name outline, turn ring on the active combatant.
- Transport (skip/step/play, keyboard) and instant-reload config (seed, teams, opponents, level).
- Human-readable battle log (narration) and a raw event inspector, both driven by a single replay cursor with cached scrubbing.
- A top-level mode selector with a working mode-switch mechanism (one mode so far: Fuzz Replay Viewer).
- Responsive layout for phones.

## Next

- **Spatial combat.** Render real engine positions, terrain, movement, and line-of-sight/range overlays once the engine supports placement and pathfinding. See [engine-relationship.md](engine-relationship.md). This is gated on engine work.
- **More modes.** New modes that reuse the replay viewer's components, added via the mode registry. See [architecture.md](architecture.md#modes).
- **Player control.** Eventually let the user drive actions, not just watch replays.

## Known rough edges

- Sprite-to-character mapping is coarse (humans for PCs, orcs for monsters; teams distinguished by name outline), because the art covers fewer types than the engine's classes/species.
- The orc idle has no blink frame, so orcs hold their rest pose.
- SVG favicon plus PNG fallback for Safari; see the favicon links in [index.html](../index.html).
