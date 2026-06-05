# dnd-web and the engine

dnd-web is a presentation layer over [dnd-srd-engine](../../dnd-srd-engine). This doc is the reference for what belongs where, so work lands in the right repo.

## The rule

- **Rules and state go in the engine.** Anything that determines what is legal or what happened in a battle (positions, movement, line of sight, damage, outcomes) must be engine logic that produces or gates events. That keeps replays deterministic and keeps the event log, scrubbing, and narration correct.
- **Presentation goes in dnd-web.** Rendering positions, animating movement, drawing line-of-sight or range overlays, camera, layout, and theming live here and only read from the engine.

Litmus test: if removing it would change the event log or the outcome, it is engine work. If it only changes how the same log looks, it is dnd-web.

## Why the arena is synthesized today

The engine has a full spatial model (positions, terrain maps, distance, line of sight, terrain-costed `plan.move`), but the combat-fuzz generator never uses it: encounters are created without positions and no one moves. So replays are positionless, and dnd-web synthesizes a layout (facing ranks) in [spatial/formation.ts](../src/spatial/formation.ts). That module is the single swap point: when scenarios carry real positions, the viewer reads `combatant.position` instead of synthesizing.

## Spatial roadmap (engine-side, summarized)

To get real positioned combat, the engine needs (in order):

1. **Combatant placement.** A way to give combatants starting positions in an encounter (event-sourced). This is the only true blocker for the viewer to show real positions.
2. **Pathfinding / reachability.** A* / BFS over movement cost, so `plan.move` costs the shortest legal path and consumers can show reach.
3. **Range / line-of-sight enforcement** on the attack and spell planners (currently advisory).

Then dnd-web renders real positions, terrain, movement, and overlays. Movement AI and positioned scenario generation are a separate layer that drives the engine APIs.

The detailed engine plan lives in the engine repo. If you are doing this work, do the rules in the engine, then flip the viewer here.
