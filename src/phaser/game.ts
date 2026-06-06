import Phaser from 'phaser';
import type { SnapshotSource } from '@/engine/snapshot-source';
import { BootScene } from './scenes/BootScene';
import { GROUND_BASE_COLOR, cssHex } from '@/constants/colors';

// Creates the full-screen Phaser game and stashes the snapshot source in
// the game registry so scenes can subscribe to frame changes. The source is
// either the ReplayStore (scrubbed log) or the live duel's LiveStore.
export const createGame = (parent: string, store: SnapshotSource): Phaser.Game => {
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
