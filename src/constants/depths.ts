// Render-depth layering. Ground and fence are fixed background layers.
// Props and character tokens are depth-sorted by their world Y on top of
// WORLD_BASE, so entities lower on screen (nearer the camera) draw in
// front of those above them.

export const RENDER_DEPTH = {
  GROUND: 0,
  FENCE: 10,
  WORLD_BASE: 1000,
} as const;
