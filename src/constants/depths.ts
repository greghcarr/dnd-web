// Single source of truth for Phaser render-depth layering. Higher draws
// on top. Every game object sets its depth from this table so the layer
// order is explicit and never accidental.

export const RENDER_DEPTH = {
  GROUND: 0,
  GRID_LINES: 10,
  TILE_DECOR: 20,
  TOKEN_SHADOW: 30,
  TOKEN_BODY: 40,
  TOKEN_RING: 50,
  TOKEN_HP_BAR: 60,
  TOKEN_LABEL: 70,
  FX: 80,
  CAMERA_UI: 90,
} as const;
