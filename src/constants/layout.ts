// Spatial and DOM layout tunables. One engine grid cell maps to one
// display tile of GRID_TILE_PX. Source tiles are authored at
// TILE_SOURCE_PX and scaled down; character frames are authored at
// CHARACTER_FRAME_PX so a token roughly fills its tile.

export const GRID_TILE_PX = 64;
export const TILE_SOURCE_PX = 256;
export const TILE_DISPLAY_SCALE = GRID_TILE_PX / TILE_SOURCE_PX;

export const CHARACTER_FRAME_PX = 64;
export const CHARACTER_DIRECTION_COUNT = 4;

// Every map entity (token, prop, future obstacle) stands at this vertical
// fraction down its tile, so sprites, shadows, and props share one ground
// line per square and y-sort consistently.
export const TILE_GROUND_FRAC = 0.8;

// Where the character art actually sits inside its 64px frame (measured
// opaque bounds): feet near 0.72, head near 0.34. Used to anchor the
// sprite's feet to the tile ground and place the HP bar above the head.
export const CHARACTER_FEET_FRAC = 0.72;
export const CHARACTER_HEAD_FRAC = 0.34;

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

// Debug: overlay the tile grid with gray lines. Temporary; set to true
// to show it.
export const SHOW_GRID = false;

// Static camera framing: the camera frames the combatants plus this many
// tiles of surrounding arena, so the fight fills the screen while grass,
// props, and the near fence still show around the edges.
export const CAMERA_PADDING_TILES = 2;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_MAX_ZOOM = 3.5;

// DOM shell: width of the right-hand panel column on desktop.
export const RIGHT_COL_PX = 384;
