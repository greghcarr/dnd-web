import Phaser from 'phaser';
import type { FormationBounds } from '@/spatial/formation';
import {
  GRID_TILE_PX,
  CAMERA_PADDING_TILES,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  RIGHT_COL_PX,
  TRANSPORT_TOP_PX,
} from '@/constants/layout';

// Fit the formation's bounding box (plus padding) into the map area left
// of the right-hand panel, then bias the content left so the panel does
// not cover it. Static: recomputed only on session change and resize.
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
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  const availW = Math.max(1, camera.width - RIGHT_COL_PX);
  const availH = Math.max(1, camera.height - TRANSPORT_TOP_PX * 2);
  const zoom = Phaser.Math.Clamp(
    Math.min(availW / contentW, availH / contentH),
    CAMERA_MIN_ZOOM,
    CAMERA_MAX_ZOOM,
  );

  camera.setZoom(zoom);
  camera.centerOn(centerX, centerY);
  // Push the world right so its centre sits in the left map region rather
  // than under the panel.
  camera.scrollX += RIGHT_COL_PX / (2 * zoom);
};
