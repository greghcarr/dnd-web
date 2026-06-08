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
  CAMERA_MAX_ZOOM,
} from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import {
  HP_TWEEN_MS,
  HIT_FLASH_MS,
  TOKEN_LUNGE_MS,
  TOKEN_MOVE_MS,
  BLINK_MIN_MS,
  BLINK_MAX_MS,
  BLINK_DURATION_MS,
} from '@/constants/timing';
import {
  ACTIVE_RING_COLOR,
  HP_BAR_BG_COLOR,
  HP_BAR_FILL_COLOR,
  HP_BAR_LOW_COLOR,
  HP_BAR_LOW_THRESHOLD,
  HIT_FLASH_COLOR,
  PLAYER_BADGE_BG_COLOR,
  CPU_BADGE_BG_COLOR,
  BADGE_TEXT_COLOR,
  cssHex,
} from '@/constants/colors';

const SPRITE_SCALE = 1.4;
// pixelArt mode renders every texture at this many device pixels per CSS
// pixel so the labels carry enough source detail at the camera's max zoom
// (CAMERA_MAX_ZOOM) and on high-DPR phone screens; the pixel-art sprites
// are untouched.
const LABEL_RESOLUTION = Math.ceil(CAMERA_MAX_ZOOM * Math.max(1, window.devicePixelRatio || 1));
// pixelArt forces nearest-neighbor filtering on every texture, which is
// right for the sprites but minifies the high-res label canvases into
// blocky, unreadable text (worst on phones). The labels opt into smooth
// linear filtering instead; it must be re-applied after each setText
// because Phaser re-uploads the label texture (as nearest) on every edit.
const LABEL_FILTER = Phaser.Textures.FilterMode.LINEAR;
// Label font sizes (px before LABEL_RESOLUTION scaling). Sized for legibility
// on a phone where the whole arena is fit into a small viewport.
const HP_FONT_PX = '11px';
const NAME_FONT_PX = '13px';
// A small pill just left of a combatant's name marking who controls it in
// the interactive duel: "1P" (red) for the player, "CPU" (gray) for the
// opponent. Absent in the replay viewers.
export type TokenBadge = 'player' | 'cpu';
const BADGE_SPECS: Record<TokenBadge, { readonly label: string; readonly bg: number }> = {
  player: { label: '1P', bg: PLAYER_BADGE_BG_COLOR },
  cpu: { label: 'CPU', bg: CPU_BADGE_BG_COLOR },
};
const BADGE_FONT_PX = '5px';
// The badges read as plain labels, so they use a simple sans-serif (the app's
// system sans) rather than the monospace of the name/HP text.
const BADGE_FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// Pill corner radius as a fraction of its height (0.5 = full capsule).
const BADGE_PILL_RADIUS_FRAC = 0.35;
// Nudge the label off its bounding box so the glyphs sit centered in the pill
// (the text box carries descent space below and side bearing on the left).
const BADGE_TEXT_OFFSET_X = 1;
const BADGE_TEXT_OFFSET_Y = 0.5;
const BADGE_PAD_X = 2;
const BADGE_PAD_Y = 1;
const BADGE_GAP_PX = 5;
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
// The container origin sits at the feet (TILE_GROUND_FRAC down the tile),
// so a ring drawn there rides the bottom grid line. Nudge it up to the
// center of the tile's lower half so it sits neatly within that half.
const TILE_LOWER_HALF_CENTER_FRAC = 0.75;
const RING_Y = (TILE_LOWER_HALF_CENTER_FRAC - TILE_GROUND_FRAC) * GRID_TILE_PX;

export class TokenView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly badge?: Phaser.GameObjects.Text;
  // Rounded-rect pill behind the badge text (Phaser text backgrounds are
  // square, so the pill is drawn separately).
  private readonly badgePill?: Phaser.GameObjects.Graphics;
  private readonly badgeColor?: number;
  private readonly characterKey: string;
  private facing: 'left' | 'right';
  private facingSign: number;
  private framesPerRow = 1;
  private readonly idleTexture: string;
  private restFrame = 0;
  private blinkFrame?: number;
  private blinkTimer?: Phaser.Time.TimerEvent;
  private dead = false;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    placement: Placement,
    characterKey: string,
    name: string,
    nameOutlineColor: number,
    badge: TokenBadge | undefined,
  ) {
    this.scene = scene;
    this.characterKey = characterKey;
    this.facing = placement.facing;
    this.facingSign = placement.facing === 'right' ? 1 : -1;
    // Container origin = the tile's ground point. Feet and ring sit at
    // (0, 0) so the character stands in its square. The sprite art already
    // carries its own baked-in shadow, so no extra shadow is drawn here.
    const x = (placement.col + 0.5) * GRID_TILE_PX;
    const y = (placement.row + TILE_GROUND_FRAC) * GRID_TILE_PX;

    this.ring = scene.add.graphics();
    this.idleTexture = animTextureKey(characterKey, 'idle');
    this.sprite = scene.add
      .sprite(0, 0, this.idleTexture)
      .setOrigin(0.5, CHARACTER_FEET_FRAC)
      .setScale(SPRITE_SCALE);

    // Resolve the rest and blink frame numbers for this pack and facing.
    this.framesPerRow = Math.max(
      1,
      Math.floor(scene.textures.get(this.idleTexture).source[0]!.width / CHARACTER_FRAME_PX),
    );
    this.applyFacingFrames();
    this.playIdle();

    const hpBg = scene.add.rectangle(0, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_BG_COLOR).setOrigin(0.5, 0.5);
    this.hpFill = scene.add
      .rectangle(-BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, HP_BAR_FILL_COLOR)
      .setOrigin(0, 0.5);
    this.hpText = scene.add
      .text(0, BAR_Y, '', {
        fontFamily: 'monospace',
        fontSize: HP_FONT_PX,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: LABEL_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);
    // The name's outline color is the combatant's class color.
    this.nameText = scene.add
      .text(0, NAME_Y, name, {
        fontFamily: 'monospace',
        fontSize: NAME_FONT_PX,
        color: '#e6e8ee',
        stroke: cssHex(nameOutlineColor),
        strokeThickness: 3,
        resolution: LABEL_RESOLUTION,
      })
      .setOrigin(0.5, 1);
    this.hpText.texture.setFilter(LABEL_FILTER);
    this.nameText.texture.setFilter(LABEL_FILTER);

    // Mark who controls this combatant with a rounded pill left of the name:
    // a separate rounded-rect behind the label (drawn/positioned in layoutBadge).
    if (badge) {
      const spec = BADGE_SPECS[badge];
      this.badgeColor = spec.bg;
      this.badgePill = scene.add.graphics();
      this.badge = scene.add
        .text(0, NAME_Y, spec.label, {
          fontFamily: BADGE_FONT_FAMILY,
          fontSize: BADGE_FONT_PX,
          color: cssHex(BADGE_TEXT_COLOR),
          resolution: LABEL_RESOLUTION,
        })
        .setOrigin(1, 0.5);
      this.badge.texture.setFilter(LABEL_FILTER);
    }

    const children: Phaser.GameObjects.GameObject[] = [
      this.ring,
      this.sprite,
      hpBg,
      this.hpFill,
      this.hpText,
      this.nameText,
    ];
    if (this.badgePill && this.badge) children.push(this.badgePill, this.badge);
    this.container = scene.add.container(x, y, children);
    this.container.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    this.layoutBadge();
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

  // Only the active combatant shows a ring; the name outline conveys class.
  private drawRing(active: boolean): void {
    this.ring.clear();
    if (!active) return;
    this.ring.lineStyle(4, ACTIVE_RING_COLOR, 1);
    this.ring.strokeEllipse(0, RING_Y, RING_RADIUS_X * 2, RING_RADIUS_Y * 2);
  }

  // Set a label's text, re-applying linear filtering: Phaser re-uploads the
  // label texture as nearest-neighbor on every setText (pixelArt default),
  // which would otherwise leave the updated text blocky.
  private setLabel(label: Phaser.GameObjects.Text, value: string): void {
    label.setText(value);
    label.texture.setFilter(LABEL_FILTER);
  }

  // Set the name label and keep the badge tucked against its left edge,
  // vertically centered on the name text (the name is center/bottom-anchored,
  // so the badge position depends on its width and height).
  private setName(name: string): void {
    this.setLabel(this.nameText, name);
    this.layoutBadge();
  }

  private layoutBadge(): void {
    if (!this.badge || !this.badgePill) return;
    // The label is right/middle-anchored just left of the name; the pill wraps
    // it with padding and fully rounded ends (radius = half its height).
    const bx = -this.nameText.displayWidth / 2 - BADGE_GAP_PX;
    const by = NAME_Y - this.nameText.displayHeight / 2;
    const w = this.badge.displayWidth + BADGE_PAD_X * 2;
    const h = this.badge.displayHeight + BADGE_PAD_Y * 2;
    this.badgePill.clear();
    this.badgePill.fillStyle(this.badgeColor ?? 0, 1);
    this.badgePill.fillRoundedRect(bx - this.badge.displayWidth - BADGE_PAD_X, by - h / 2, w, h, h * BADGE_PILL_RADIUS_FRAC);
    // Nudge the label off its box so the glyphs sit centered in the pill.
    this.badge.setPosition(bx + BADGE_TEXT_OFFSET_X, by + BADGE_TEXT_OFFSET_Y);
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
    this.setLabel(this.hpText, `${Math.max(0, character.hp.current)}/${character.hp.max}`);

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

    this.setName(character.name);
    this.drawRing(isActive);
  }

  // Recompute the rest/blink frame numbers for the current facing row.
  private applyFacingFrames(): void {
    const rowBase = getFacingRows(this.characterKey)[this.facing] * this.framesPerRow;
    const idle = idleConfig(this.characterKey);
    this.restFrame = rowBase + idle.rest;
    this.blinkFrame = idle.blink.length > 0 ? rowBase + idle.blink[0]! : undefined;
  }

  private setFacing(facing: 'left' | 'right'): void {
    if (facing === this.facing) return;
    this.facing = facing;
    this.facingSign = facing === 'right' ? 1 : -1;
    this.applyFacingFrames();
    // Reflect the new direction immediately while standing idle.
    if (!this.dead && !this.sprite.anims.isPlaying) {
      this.sprite.setTexture(this.idleTexture, this.restFrame);
    }
  }

  // This token's world x, so the scene can turn one combatant to face another.
  get worldX(): number {
    return this.container.x;
  }

  // Turn to face a target at the given world x (the combatant being attacked
  // or targeted by a spell), so the avatar looks at who it acts on. Same-column
  // targets keep the current facing.
  faceToward(targetX: number): void {
    const dx = targetX - this.container.x;
    if (Math.abs(dx) > 0.5) this.setFacing(dx > 0 ? 'right' : 'left');
  }

  // True if a world-space point falls on the visible character sprite, so the
  // scene can resolve a tap to this combatant (works in any movement mode,
  // since it tests the sprite's real bounds rather than a grid cell).
  hitTest(worldX: number, worldY: number): boolean {
    if (this.destroyed || !this.container.visible) return false;
    return this.sprite.getBounds().contains(worldX, worldY);
  }

  // Reflect a position change at the cursor (tactical mode): slide to the
  // new tile on a single forward step, snap on jumps/rewinds. Turns to face
  // the travel direction; depth tracks world Y so y-sort stays correct.
  moveTo(col: number, row: number, animate: boolean): void {
    if (this.destroyed) return;
    const x = (col + 0.5) * GRID_TILE_PX;
    const y = (row + TILE_GROUND_FRAC) * GRID_TILE_PX;
    if (x === this.container.x && y === this.container.y) return;
    const dx = x - this.container.x;
    if (Math.abs(dx) > 0.5) this.setFacing(dx > 0 ? 'right' : 'left');
    this.scene.tweens.killTweensOf(this.container);
    if (animate) {
      this.scene.tweens.add({
        targets: this.container,
        x,
        y,
        duration: TOKEN_MOVE_MS,
        ease: 'Quad.easeInOut',
        onUpdate: () => this.container.setDepth(RENDER_DEPTH.WORLD_BASE + this.container.y),
      });
    } else {
      this.container.setPosition(x, y);
      this.container.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    }
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
    this.scene.tweens.killTweensOf([this.sprite, this.hpFill, this.container]);
    this.container.destroy();
  }
}
