import Phaser from 'phaser';
import {
  GROUND_KEY,
  GROUND_SOURCE,
  PROP_SPECS,
  CHARACTER_KEYS,
  ANIM_TYPES,
  ANIM_SHEETS,
  animTextureKey,
} from '@/phaser/assets/asset-keys';
import { CHARACTER_FRAME_PX } from '@/constants/layout';
import { ArenaScene } from './ArenaScene';

// Loads the tileset, props, and every character animation sheet, then
// starts the arena.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image(GROUND_KEY, GROUND_SOURCE);
    for (const spec of PROP_SPECS) {
      this.load.image(spec.key, spec.src);
    }
    for (const characterKey of CHARACTER_KEYS) {
      for (const anim of ANIM_TYPES) {
        this.load.spritesheet(animTextureKey(characterKey, anim), ANIM_SHEETS[characterKey][anim], {
          frameWidth: CHARACTER_FRAME_PX,
          frameHeight: CHARACTER_FRAME_PX,
        });
      }
    }
  }

  create(): void {
    this.scene.add('Arena', ArenaScene, true);
  }
}
