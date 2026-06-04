import Phaser from 'phaser';
import {
  GROUND_SOURCES,
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
    for (const [key, url] of Object.entries(GROUND_SOURCES)) {
      this.load.image(key, url);
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
