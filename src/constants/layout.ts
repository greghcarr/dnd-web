// Spatial and DOM layout tunables. One engine grid cell maps to one
// display tile of GRID_TILE_PX. Source tiles are authored at
// TILE_SOURCE_PX and scaled down; character frames are authored at
// CHARACTER_FRAME_PX so a token roughly fills its tile.

export const GRID_TILE_PX = 64;
export const TILE_SOURCE_PX = 256;
export const TILE_DISPLAY_SCALE = GRID_TILE_PX / TILE_SOURCE_PX;

export const CHARACTER_FRAME_PX = 64;
export const CHARACTER_DIRECTION_COUNT = 4;

// How far a token lunges toward its target when attacking, and recoils
// when hit (pixels).
export const TOKEN_LUNGE_PX = 12;
export const TOKEN_RECOIL_PX = 6;

// The fenced battle area extends this many tiles beyond the combatants on
// every side; ground grass extends further still so the fence sits in a
// field. Props scatter inside the fence, away from the combatants.
export const FENCE_MARGIN_TILES = 3;
export const ARENA_GROUND_PAD_TILES = 3;
export const PROP_CLEAR_TILES = 1;
export const PROP_DENSITY_PCT = 32;

// Static camera framing (fence area plus a one-tile breath).
export const CAMERA_PADDING_TILES = 1;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_MAX_ZOOM = 2;

// DOM shell.
export const RIGHT_COL_PX = 384;
export const TRANSPORT_TOP_PX = 12;
