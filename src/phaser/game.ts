import Phaser from 'phaser';
import type { SnapshotSource } from '@/engine/snapshot-source';
import { BootScene } from './scenes/BootScene';
import { GROUND_BASE_COLOR, cssHex } from '@/constants/colors';
import { RENDER_SCALE, fitGameToParent } from './render-scale';

// Creates the full-screen Phaser game and stashes the snapshot source in
// the game registry so scenes can subscribe to frame changes. The source is
// either the ReplayStore (scrubbed log) or the live duel's LiveStore.
//
// Sizing runs in Scale.NONE (not RESIZE) so we can render the drawing buffer
// at the device pixel ratio: the buffer is RENDER_SCALE x the CSS size and
// zoom is 1/RENDER_SCALE, so the canvas displays at its true on-screen size
// but renders crisply on high-DPR phones (see render-scale.ts). We drive the
// fit on boot, on window resize/rotation, and from the arena scene's parent
// observer (which also catches layout changes like collapsing the log column).
export const createGame = (parent: string, store: SnapshotSource): Phaser.Game => {
  const parentEl = document.getElementById(parent);
  const cssWidth = parentEl?.clientWidth || window.innerWidth;
  const cssHeight = parentEl?.clientHeight || window.innerHeight;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: cssHex(GROUND_BASE_COLOR),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: 1 / RENDER_SCALE,
      width: Math.round(cssWidth * RENDER_SCALE),
      height: Math.round(cssHeight * RENDER_SCALE),
    },
    scene: [BootScene],
  });
  game.registry.set('store', store);
  const refit = (): void => fitGameToParent(game);
  game.events.once(Phaser.Core.Events.READY, refit);
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
  return game;
};
