import Phaser from 'phaser';
import {
  GROUND_KEY,
  GROUND_SOURCE,
  PROP_SPECS,
  CHARACTER_SHEET_SOURCES,
  CHARACTER_FRAME_SIZE,
} from '@/phaser/assets/asset-keys';
import { ArenaScene } from './ArenaScene';

// Loads the tileset and character spritesheets, then starts the arena.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image(GROUND_KEY, GROUND_SOURCE);
    for (const spec of PROP_SPECS) {
      this.load.image(spec.key, spec.src);
    }
    for (const [key, url] of Object.entries(CHARACTER_SHEET_SOURCES)) {
      this.load.spritesheet(key, url, {
        frameWidth: CHARACTER_FRAME_SIZE,
        frameHeight: CHARACTER_FRAME_SIZE,
      });
    }
  }

  create(): void {
    this.scene.add('Arena', ArenaScene, true);
  }
}
