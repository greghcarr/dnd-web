// One combatant on the map: an animated character sprite with a soft
// shadow, a team-colored ring (brighter on the active turn), an HP bar,
// and a name label, grouped in a container at the tile position.
// setState reflects engine state at the cursor (idle vs dead, HP, active
// turn); playAttack / flashHit are transient reactions triggered when the
// replay steps forward over an attack or damage event.

import Phaser from 'phaser';
import type { Character } from 'dnd-srd-engine';
import type { Placement } from '@/spatial/formation';
import { animTextureKey, animKey, getFacingRows, idleConfig } from '@/phaser/assets/asset-keys';
import {
  GRID_TILE_PX,
  CHARACTER_FRAME_PX,
  TILE_GROUND_FRAC,
  CHARACTER_FEET_FRAC,
  CHARACTER_HEAD_FRAC,
  TOKEN_LUNGE_PX,
  TOKEN_RECOIL_PX,
} from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import {
  HP_TWEEN_MS,
  HIT_FLASH_MS,
  TOKEN_LUNGE_MS,
  BLINK_MIN_MS,
  BLINK_MAX_MS,
  BLINK_DURATION_MS,
} from '@/constants/timing';
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
  cssHex,
} from '@/constants/colors';

const SPRITE_SCALE = 1.4;
// Feet sit at the container origin (the tile ground point); the head is
// this far above it, so the HP bar and name sit just above the head.
const DISPLAY_HEIGHT = CHARACTER_FRAME_PX * SPRITE_SCALE;
const HEAD_Y = -(CHARACTER_FEET_FRAC - CHARACTER_HEAD_FRAC) * DISPLAY_HEIGHT;
const BAR_WIDTH = GRID_TILE_PX * 0.9;
const BAR_HEIGHT = 8;
const BAR_Y = HEAD_Y - 8;
const NAME_Y = BAR_Y - 5;
const RING_RADIUS_X = GRID_TILE_PX * 0.42;
const RING_RADIUS_Y = GRID_TILE_PX * 0.2;
const SHADOW_RADIUS_X = GRID_TILE_PX * 0.6;
const SHADOW_RADIUS_Y = GRID_TILE_PX * 0.22;

export class TokenView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly teamColor: number;
  private readonly characterKey: string;
  private readonly facing: 'left' | 'right';
  private readonly facingSign: number;
  private readonly idleTexture: string;
  private restFrame = 0;
  private blinkFrame?: number;
  private blinkTimer?: Phaser.Time.TimerEvent;
  private dead = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, placement: Placement, characterKey: string, name: string) {
    this.scene = scene;
    this.characterKey = characterKey;
    this.facing = placement.facing;
    this.facingSign = placement.facing === 'right' ? 1 : -1;
    // Container origin = the tile's ground point. Feet, shadow, and ring
    // all sit at (0, 0) so the character stands in its square.
    const x = (placement.col + 0.5) * GRID_TILE_PX;
    const y = (placement.row + TILE_GROUND_FRAC) * GRID_TILE_PX;
    this.teamColor = placement.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;

    const shadow = scene.add.ellipse(
      0,
      0,
      SHADOW_RADIUS_X,
      SHADOW_RADIUS_Y,
      TOKEN_SHADOW_COLOR,
      TOKEN_SHADOW_ALPHA,
    );
    this.ring = scene.add.graphics();
    this.idleTexture = animTextureKey(characterKey, 'idle');
    this.sprite = scene.add
      .sprite(0, 0, this.idleTexture)
      .setOrigin(0.5, CHARACTER_FEET_FRAC)
      .setScale(SPRITE_SCALE);

    // Resolve the rest and blink frame numbers for this pack and facing.
    const framesPerRow = Math.max(
      1,
      Math.floor(scene.textures.get(this.idleTexture).source[0]!.width / CHARACTER_FRAME_PX),
    );
    const rowBase = getFacingRows(characterKey)[this.facing] * framesPerRow;
    const idle = idleConfig(characterKey);
    this.restFrame = rowBase + idle.rest;
    this.blinkFrame = idle.blink.length > 0 ? rowBase + idle.blink[0]! : undefined;
    this.playIdle();

    const hpBg = scene.add.rectangle(0, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_BG_COLOR).setOrigin(0.5, 0.5);
    this.hpFill = scene.add
      .rectangle(-BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_FILL_COLOR)
      .setOrigin(0, 0.5);
    this.hpText = scene.add
      .text(0, BAR_Y, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);
    // The name's outline color marks which side the combatant is on.
    this.nameText = scene.add
      .text(0, NAME_Y, name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e6e8ee',
        stroke: cssHex(this.teamColor),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);

    this.container = scene.add.container(x, y, [
      shadow,
      this.ring,
      this.sprite,
      hpBg,
      this.hpFill,
      this.hpText,
      this.nameText,
    ]);
    this.container.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    this.drawRing(false);
  }

  // Idle = hold the "looking ahead" rest frame; blinks happen on their
  // own randomized schedule so tokens never blink in unison.
  private playIdle(): void {
    this.sprite.anims.stop();
    this.sprite.setTexture(this.idleTexture, this.restFrame);
    this.scheduleBlink();
  }

  private scheduleBlink(): void {
    this.cancelBlink();
    if (this.dead || this.destroyed || this.blinkFrame === undefined) return;
    const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
    this.blinkTimer = this.scene.time.delayedCall(delay, () => this.doBlink());
  }

  private doBlink(): void {
    if (this.dead || this.destroyed || this.blinkFrame === undefined) return;
    // Skip (but keep the schedule alive) if a transient animation is mid-play.
    if (this.sprite.anims.isPlaying) {
      this.scheduleBlink();
      return;
    }
    this.sprite.setTexture(this.idleTexture, this.blinkFrame);
    this.scene.time.delayedCall(BLINK_DURATION_MS, () => {
      if (this.dead || this.destroyed) return;
      if (!this.sprite.anims.isPlaying) this.sprite.setTexture(this.idleTexture, this.restFrame);
      this.scheduleBlink();
    });
  }

  private cancelBlink(): void {
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
  }

  // Only the active combatant shows a ring; team is conveyed by the name
  // outline instead.
  private drawRing(active: boolean): void {
    this.ring.clear();
    if (!active) return;
    this.ring.lineStyle(4, ACTIVE_RING_COLOR, 1);
    this.ring.strokeEllipse(0, 0, RING_RADIUS_X * 2, RING_RADIUS_Y * 2);
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
    this.hpText.setText(`${Math.max(0, character.hp.current)}/${character.hp.max}`);

    const isDead = character.hp.current <= 0;
    if (isDead && !this.dead) {
      this.dead = true;
      this.cancelBlink();
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
    if (this.dead || this.destroyed) return;
    this.cancelBlink();
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
    if (this.dead || this.destroyed) return;
    this.cancelBlink();
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
    this.destroyed = true;
    this.cancelBlink();
    this.scene.tweens.killTweensOf([this.sprite, this.hpFill]);
    this.container.destroy();
  }
}
