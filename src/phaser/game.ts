import Phaser from 'phaser';
import type { ReplayStore } from '@/engine/replay-store';
import { BootScene } from './scenes/BootScene';
import { GROUND_BASE_COLOR, cssHex } from '@/constants/colors';

// Creates the full-screen Phaser game and stashes the replay store in the
// game registry so scenes can subscribe to cursor changes.
export const createGame = (parent: string, store: ReplayStore): Phaser.Game => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: cssHex(GROUND_BASE_COLOR),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene],
  });
  game.registry.set('store', store);
  return game;
};
