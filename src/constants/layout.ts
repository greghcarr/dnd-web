// Spatial and DOM layout tunables. One engine grid cell maps to one
// display tile of GRID_TILE_PX. Source tiles are authored at
// TILE_SOURCE_PX and scaled down; character frames are authored at
// CHARACTER_FRAME_PX so a token roughly fills its tile.

export const GRID_TILE_PX = 64;
export const TILE_SOURCE_PX = 256;
export const TILE_DISPLAY_SCALE = GRID_TILE_PX / TILE_SOURCE_PX;

export const CHARACTER_FRAME_PX = 64;
export const CHARACTER_DIRECTION_COUNT = 4;

// Facing-rank formation tunables (see spatial/formation.ts).
export const MAX_COMBATANTS_PER_RANK = 5;
export const COMBATANT_SPACING_TILES = 1;
export const RANK_DEPTH_SPACING_TILES = 1;
export const NO_MANS_LAND_TILES = 6;

// Percentage of ground cells that receive a sparse bush/foliage overlay.
export const DECOR_DENSITY_PCT = 16;

// Static camera framing.
export const CAMERA_PADDING_TILES = 2;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_MAX_ZOOM = 2;

// DOM shell.
export const RIGHT_COL_PX = 384;
export const TRANSPORT_TOP_PX = 12;
