import Phaser from 'phaser';
import { MAX_RENDER_SCALE } from '@/constants/layout';

// The browser composites the WebGL canvas to the physical display. When the
// drawing buffer is sized in CSS pixels (1x), a high-DPR screen (phones at
// devicePixelRatio 2-3) upscales it, blurring text and sprites. Sizing the
// buffer at the device pixel ratio instead makes that final composite 1:1
// and crisp. Capped so an extreme DPR doesn't blow up fill rate (cost grows
// with RENDER_SCALE squared).
const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
export const RENDER_SCALE = Math.min(Math.max(1, deviceRatio), MAX_RENDER_SCALE);

// Size the game's drawing buffer to the parent at RENDER_SCALE while keeping
// the CSS display size at the parent's size, so the canvas renders at device
// resolution yet lays out at its true on-screen size. The game runs in
// Scale.NONE with zoom 1/RENDER_SCALE (see game.ts), so the camera viewport
// spans the full buffer. Called on boot and on every viewport/parent resize.
export const fitGameToParent = (game: Phaser.Game): void => {
  const parent = game.canvas?.parentElement;
  if (!parent) return;
  const cssWidth = parent.clientWidth;
  const cssHeight = parent.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) return;
  game.scale.resize(cssWidth * RENDER_SCALE, cssHeight * RENDER_SCALE);
  game.canvas.style.width = `${cssWidth}px`;
  game.canvas.style.height = `${cssHeight}px`;
};
