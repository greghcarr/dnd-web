// Registers per-character directional animations (idle loops; attack,
// hurt, death play once). Each animation pulls a full direction row from
// its sheet, so the frame count is derived from the loaded texture width.

import Phaser from 'phaser';
import { CHARACTER_FRAME_PX } from '@/constants/layout';
import {
  CHARACTER_KEYS,
  ANIM_TYPES,
  animTextureKey,
  animKey,
  getFacingRows,
  type AnimType,
} from '@/phaser/assets/asset-keys';

const FRAME_RATES: Record<AnimType, number> = {
  idle: 6,
  attack: 14,
  hurt: 12,
  death: 8,
};

const FACINGS = ['left', 'right'] as const;

export const registerCharacterAnims = (scene: Phaser.Scene): void => {
  for (const characterKey of CHARACTER_KEYS) {
    const rows = getFacingRows(characterKey);
    for (const anim of ANIM_TYPES) {
      const texture = animTextureKey(characterKey, anim);
      const framesPerRow = Math.max(
        1,
        Math.floor(scene.textures.get(texture).source[0]!.width / CHARACTER_FRAME_PX),
      );
      for (const facing of FACINGS) {
        const key = animKey(characterKey, anim, facing);
        if (scene.anims.exists(key)) continue;
        const start = rows[facing] * framesPerRow;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(texture, { start, end: start + framesPerRow - 1 }),
          frameRate: FRAME_RATES[anim],
          repeat: anim === 'idle' ? -1 : 0,
        });
      }
    }
  }
};
