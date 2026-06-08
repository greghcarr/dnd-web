import Phaser from 'phaser';
import type { FormationBounds } from '@/spatial/formation';
import { GRID_TILE_PX, CAMERA_PADDING_TILES, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM } from '@/constants/layout';
import { CAMERA_PAN_MS } from '@/constants/timing';
import { RENDER_SCALE } from '@/phaser/render-scale';

// Fit a tile bounding box (plus padding) into the map canvas and centre it.
// The canvas occupies its own layout area (no overlapping panel), so the
// whole viewport is usable. Positionless battles call this once per session
// with the static formation bounds; tactical battles call it every step
// with the living combatants' bounds (animate=true follows the action on a
// forward step, false snaps on jumps/rewinds/resize).
export const frameBounds = (
  camera: Phaser.Cameras.Scene2D.Camera,
  bounds: FormationBounds,
  animate: boolean,
): void => {
  const pad = CAMERA_PADDING_TILES;
  const left = (bounds.minCol - pad) * GRID_TILE_PX;
  const top = (bounds.minRow - pad) * GRID_TILE_PX;
  const right = (bounds.maxCol + 1 + pad) * GRID_TILE_PX;
  const bottom = (bounds.maxRow + 1 + pad) * GRID_TILE_PX;
  const contentW = right - left;
  const contentH = bottom - top;

  // camera.width/height are in buffer pixels (RENDER_SCALE x the CSS size),
  // so the fit and the zoom clamp scale by RENDER_SCALE too. The effective
  // on-screen zoom (camera zoom / RENDER_SCALE) then stays within
  // [CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM] regardless of the device's DPR.
  const zoom = Phaser.Math.Clamp(
    Math.min(camera.width / contentW, camera.height / contentH),
    CAMERA_MIN_ZOOM * RENDER_SCALE,
    CAMERA_MAX_ZOOM * RENDER_SCALE,
  );
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  if (animate) {
    camera.pan(cx, cy, CAMERA_PAN_MS, 'Quad.easeInOut');
    camera.zoomTo(zoom, CAMERA_PAN_MS, 'Quad.easeInOut');
  } else {
    // Cancel any in-flight pan/zoom from a prior animated step; otherwise the
    // running tween keeps updating the camera after this snap and the view
    // drifts off-centre (seen on resize / mode switch mid-animation).
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    camera.setZoom(zoom);
    camera.centerOn(cx, cy);
  }
};
