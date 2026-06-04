import Phaser from 'phaser';
import type { FormationBounds } from '@/spatial/formation';
import { GRID_TILE_PX, CAMERA_PADDING_TILES, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM } from '@/constants/layout';

// Fit the formation's bounding box (plus padding) into the map canvas and
// centre it. The canvas occupies its own layout area (no overlapping
// panel), so the whole camera viewport is usable. Static: recomputed only
// on session change and resize.
export const frameFormation = (
  camera: Phaser.Cameras.Scene2D.Camera,
  bounds: FormationBounds,
): void => {
  const pad = CAMERA_PADDING_TILES;
  const left = (bounds.minCol - pad) * GRID_TILE_PX;
  const top = (bounds.minRow - pad) * GRID_TILE_PX;
  const right = (bounds.maxCol + 1 + pad) * GRID_TILE_PX;
  const bottom = (bounds.maxRow + 1 + pad) * GRID_TILE_PX;
  const contentW = right - left;
  const contentH = bottom - top;

  const zoom = Phaser.Math.Clamp(
    Math.min(camera.width / contentW, camera.height / contentH),
    CAMERA_MIN_ZOOM,
    CAMERA_MAX_ZOOM,
  );

  camera.setZoom(zoom);
  camera.centerOn((left + right) / 2, (top + bottom) / 2);
};
