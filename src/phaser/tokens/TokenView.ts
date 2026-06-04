// One combatant on the map: an animated character sprite with a soft
// shadow, a team-colored ring (brighter on the active turn), an HP bar,
// and a name label, grouped in a container at the tile position.
// setState reflects engine state at the cursor (idle vs dead, HP, active
// turn); playAttack / flashHit are transient reactions triggered when the
// replay steps forward over an attack or damage event.

import Phaser from 'phaser';
import type { Character } from 'dnd-srd-engine';
import type { Placement } from '@/spatial/formation';
import { animTextureKey, animKey } from '@/phaser/assets/asset-keys';
import { GRID_TILE_PX, TOKEN_LUNGE_PX, TOKEN_RECOIL_PX } from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import { HP_TWEEN_MS, HIT_FLASH_MS, TOKEN_LUNGE_MS } from '@/constants/timing';
import {
  TEAM_A_COLOR,
  TEAM_B_COLOR,
  ACTIVE_RING_COLOR,
  TOKEN_SHADOW_COLOR,
  TOKEN_SHADOW_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_FILL_COLOR,
  HP_BAR_LOW_COLOR,
  HP_BAR_LOW_THRESHOLD,
  HIT_FLASH_COLOR,
} from '@/constants/colors';

const SPRITE_SCALE = 1.4;
const SPRITE_ORIGIN_Y = 0.82;
const BAR_WIDTH = GRID_TILE_PX * 0.9;
const BAR_HEIGHT = 5;
const BAR_Y = -GRID_TILE_PX * 0.7;
const NAME_Y = BAR_Y - 9;
const RING_Y = GRID_TILE_PX * 0.28;
const RING_RADIUS_X = GRID_TILE_PX * 0.42;
const RING_RADIUS_Y = GRID_TILE_PX * 0.22;
const SHADOW_Y = GRID_TILE_PX * 0.34;

export class TokenView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly teamColor: number;
  private readonly characterKey: string;
  private readonly facing: 'left' | 'right';
  private readonly facingSign: number;
  private dead = false;

  constructor(scene: Phaser.Scene, placement: Placement, characterKey: string, name: string) {
    this.scene = scene;
    this.characterKey = characterKey;
    this.facing = placement.facing;
    this.facingSign = placement.facing === 'right' ? 1 : -1;
    const x = (placement.col + 0.5) * GRID_TILE_PX;
    const y = (placement.row + 0.5) * GRID_TILE_PX;
    this.teamColor = placement.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;

    const shadow = scene.add.ellipse(
      0,
      SHADOW_Y,
      GRID_TILE_PX * 0.6,
      GRID_TILE_PX * 0.22,
      TOKEN_SHADOW_COLOR,
      TOKEN_SHADOW_ALPHA,
    );
    this.ring = scene.add.graphics();
    this.sprite = scene.add
      .sprite(0, RING_Y, animTextureKey(characterKey, 'idle'))
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE);
    this.playIdle();

    const hpBg = scene.add.rectangle(0, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_BG_COLOR).setOrigin(0.5, 0.5);
    this.hpFill = scene.add
      .rectangle(-BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_FILL_COLOR)
      .setOrigin(0, 0.5);
    this.nameText = scene.add
      .text(0, NAME_Y, name, { fontFamily: 'monospace', fontSize: '11px', color: '#e6e8ee' })
      .setOrigin(0.5, 1);

    this.container = scene.add.container(x, y, [
      shadow,
      this.ring,
      this.sprite,
      hpBg,
      this.hpFill,
      this.nameText,
    ]);
    this.container.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    this.drawRing(false);
  }

  private playIdle(): void {
    const key = animKey(this.characterKey, 'idle', this.facing);
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
  }

  private drawRing(active: boolean): void {
    this.ring.clear();
    this.ring.lineStyle(active ? 4 : 2, active ? ACTIVE_RING_COLOR : this.teamColor, active ? 1 : 0.75);
    this.ring.strokeEllipse(0, RING_Y, RING_RADIUS_X * 2, RING_RADIUS_Y * 2);
  }

  // Declarative: reflect the engine state at the cursor.
  setState(character: Character | undefined, isActive: boolean): void {
    if (!character) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);

    const frac =
      character.hp.max > 0 ? Phaser.Math.Clamp(character.hp.current / character.hp.max, 0, 1) : 0;
    this.scene.tweens.killTweensOf(this.hpFill);
    this.scene.tweens.add({ targets: this.hpFill, scaleX: frac, duration: HP_TWEEN_MS, ease: 'Quad.easeOut' });
    this.hpFill.setFillStyle(frac <= HP_BAR_LOW_THRESHOLD ? HP_BAR_LOW_COLOR : HP_BAR_FILL_COLOR);

    const isDead = character.hp.current <= 0;
    if (isDead && !this.dead) {
      this.dead = true;
      this.sprite.clearTint();
      this.sprite.play(animKey(this.characterKey, 'death', this.facing));
    } else if (!isDead && this.dead) {
      this.dead = false;
      this.sprite.clearTint();
      this.playIdle();
    }

    this.nameText.setText(character.name);
    this.drawRing(isActive);
  }

  // Transient: this combatant just attacked. Lunge toward the target and
  // play the attack animation, then settle back to idle.
  playAttack(): void {
    if (this.dead) return;
    const key = animKey(this.characterKey, 'attack', this.facing);
    this.sprite.play(key);
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.facingSign * TOKEN_LUNGE_PX,
      duration: TOKEN_LUNGE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.sprite.once(`animationcomplete-${key}`, () => {
      if (!this.dead) this.playIdle();
    });
  }

  // Transient: this combatant just took damage. Flash white, recoil, and
  // play the hurt animation, then settle back to idle (unless it died,
  // which setState handles).
  flashHit(): void {
    if (this.dead) return;
    const key = animKey(this.characterKey, 'hurt', this.facing);
    this.sprite.play(key);
    this.sprite.setTintFill(HIT_FLASH_COLOR);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (!this.dead) this.sprite.clearTint();
    });
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      x: -this.facingSign * TOKEN_RECOIL_PX,
      duration: TOKEN_LUNGE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.sprite.once(`animationcomplete-${key}`, () => {
      if (!this.dead) this.playIdle();
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.sprite, this.hpFill]);
    this.container.destroy();
  }
}
