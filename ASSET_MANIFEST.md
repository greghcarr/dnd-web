# Asset manifest

Art is checked in under [public/assets/](public/assets/) (served by Vite at `/assets/...`). All art is CraftPix.net free-license pixel art; see [public/assets/LICENSE-craftpix.txt](public/assets/LICENSE-craftpix.txt).

## Tiles

Individual ground tile PNGs, authored at **256x256**, displayed at `GRID_TILE_PX` (64) via `TILE_DISPLAY_SCALE` (0.25). One engine grid cell maps to one tile.

- `public/assets/tiles/tropical/land_1.png` .. `land_26.png` grass / medieval-city ground (default theme).
- `public/assets/tiles/desert/land_1.png` .. `land_18.png` desert ground (alternate theme).

v1 picks one tile (or a small deterministic mix) for the whole arena floor.

## Characters

Composited animation strips, authored at **64x64 per frame**, laid out as a grid of **4 rows (facing directions) x N columns (animation frames)**. Sheet pixel width = `N * 64`, height = `256`. These are Phaser spritesheets:
`load.spritesheet(key, url, { frameWidth: 64, frameHeight: 64 })`.

(The exact row-to-direction mapping is determined visually during arena rendering; for static facing formations v1 may render a single idle frame per token.)

Available animations per pack (file stem `<Anim>_full.png`):
`Idle`, `Walk`, `Run`, `attack`, `Walk_Attack`, `Run_Attack`, `Hurt`, `Death`.

- `public/assets/characters/male/` human male base, `Sword_*` and `Unarmed_*` variants.
- `public/assets/characters/female/` human female base, `Sword_*` and `Unarmed_*` variants.
- `public/assets/characters/orc/` orc, three visual variants `orc1_*`, `orc2_*`, `orc3_*`.

## Sprite mapping (v1)

The engine's classes (barbarian, wizard, ...) and species (human, elf, ...) outnumber the available art, so v1 maps coarsely and shows team identity with a colored token ring (team A blue, team B red) rather than per-class art:

- PC combatants (`kind` pc/npc): human male or female base, `Sword_Idle` variant, chosen deterministically by combatant index.
- Monster combatants (vs = monster): orc variants `orc1/2/3`, cycled by index.
- Fallback: if a sheet is missing, a runtime-generated placeholder token (colored rounded rect with the character's initial) is used.

The resolution function lives in `src/phaser/assets/asset-keys.ts`. When richer per-class art is added later, only that file plus the Boot scene's preload list change.

## Adding or replacing art

Drop files following the paths above and update the resolution function if naming differs. Keep the 64x64 frame module and the 4-direction row layout so the spritesheet slicing stays valid.
