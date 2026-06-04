// One combatant on the map: a character sprite with a soft shadow, a
// team-colored ring (brighter when it is this combatant's turn), an HP
// bar, and a name label, all grouped in a container at the synthesized
// tile position. update() reflects the engine state at the cursor.

import Phaser from 'phaser';
import type { Character } from 'dnd-srd-engine';
import type { Placement } from '@/spatial/formation';
import { facingRow } from '@/phaser/assets/asset-keys';
import { GRID_TILE_PX, CHARACTER_FRAME_PX } from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import {
  TEAM_A_COLOR,
  TEAM_B_COLOR,
  ACTIVE_RING_COLOR,
  DOWNED_TINT,
  TOKEN_SHADOW_COLOR,
  TOKEN_SHADOW_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_FILL_COLOR,
  HP_BAR_LOW_COLOR,
  HP_BAR_LOW_THRESHOLD,
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
const DOWNED_ALPHA = 0.6;

export class TokenView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly teamColor: number;

  constructor(scene: Phaser.Scene, placement: Placement, spriteKey: string, name: string) {
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
    // Use the native directional row for this pack so the two teams face
    // each other (no mirroring).
    const framesPerRow = Math.max(1, Math.floor(scene.textures.get(spriteKey).source[0]!.width / CHARACTER_FRAME_PX));
    const facingFrame = facingRow(spriteKey, placement.facing) * framesPerRow;
    this.sprite = scene.add
      .sprite(0, RING_Y, spriteKey, facingFrame)
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE);
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
    // Depth-sort with props by world Y so nearer entities draw in front.
    this.container.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    this.drawRing(false);
  }

  private drawRing(active: boolean): void {
    this.ring.clear();
    this.ring.lineStyle(active ? 4 : 2, active ? ACTIVE_RING_COLOR : this.teamColor, active ? 1 : 0.75);
    this.ring.strokeEllipse(0, RING_Y, RING_RADIUS_X * 2, RING_RADIUS_Y * 2);
  }

  update(character: Character | undefined, isActive: boolean): void {
    // Before the character's CharacterCreated event has been applied it
    // does not exist in state yet; hide the token so it "enters" the
    // arena as the replay reaches that event rather than showing stale
    // end-of-battle state at the start.
    if (!character) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);

    const frac =
      character.hp.max > 0 ? Phaser.Math.Clamp(character.hp.current / character.hp.max, 0, 1) : 0;
    this.hpFill.scaleX = frac;
    this.hpFill.setFillStyle(frac <= HP_BAR_LOW_THRESHOLD ? HP_BAR_LOW_COLOR : HP_BAR_FILL_COLOR);
    if (character.hp.current <= 0) {
      this.sprite.setTint(DOWNED_TINT);
      this.sprite.setAlpha(DOWNED_ALPHA);
    } else {
      this.sprite.clearTint();
      this.sprite.setAlpha(1);
    }
    this.nameText.setText(character.name);
    this.drawRing(isActive);
  }

  destroy(): void {
    this.container.destroy();
  }
}
