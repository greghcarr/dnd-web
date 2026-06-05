import Phaser from 'phaser';
import type { ReplayStore, ReplaySnapshot } from '@/engine/replay-store';
import type { Session } from '@/state/session';
import type { FormationBounds } from '@/spatial/formation';
import { TokenView } from '@/phaser/tokens/TokenView';
import { registerCharacterAnims } from '@/phaser/anims';
import { frameFormation } from '@/phaser/camera';
import {
  spriteKeyFor,
  GROUND_KEY,
  PROP_SPECS,
  PROP_WEIGHTS,
  type CharacterKind,
} from '@/phaser/assets/asset-keys';
import {
  GRID_TILE_PX,
  TILE_GROUND_FRAC,
  FENCE_MARGIN_TILES,
  ARENA_GROUND_PAD_TILES,
  PROP_CLEAR_TILES,
  PROP_DENSITY_PCT,
  SHOW_GRID,
} from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import { GROUND_BASE_COLOR, GRID_LINE_COLOR, GRID_LINE_ALPHA } from '@/constants/colors';
import { makeRng, type Rng } from '@/phaser/rng';

const FENCE_WOOD_DARK = 0x5b3b1f;
const FENCE_WOOD_MED = 0x7a5230;
const FENCE_WOOD_LIGHT = 0x9c6b3e;
const PROP_OFFSET_X = GRID_TILE_PX * 0.5;
const PROP_OFFSET_Y = GRID_TILE_PX * 0.3;

const expand = (bounds: FormationBounds, by: number): FormationBounds => ({
  minCol: bounds.minCol - by,
  maxCol: bounds.maxCol + by,
  minRow: bounds.minRow - by,
  maxRow: bounds.maxRow + by,
});

// The arena. Draws the grass floor, a fenced battle area, scattered props
// (seeded off the battle seed so each fight differs yet is deterministic),
// and one token per combatant, kept in sync with engine state at the
// replay cursor. Rebuilds when the session changes.
export class ArenaScene extends Phaser.Scene {
  private store!: ReplayStore;
  private readonly tokens = new Map<string, TokenView>();
  private scenery: Phaser.GameObjects.GameObject[] = [];
  private currentSession?: Session;
  private fenceBounds?: FormationBounds;
  private prevCursor = 0;
  private unsubscribe?: () => void;

  constructor() {
    super('Arena');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BASE_COLOR);
    registerCharacterAnims(this);
    this.store = this.registry.get('store') as ReplayStore;
    this.scale.on(Phaser.Scale.Events.RESIZE, this.reframe, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.reframe, this);
    });
    this.unsubscribe = this.store.subscribe((snapshot) => this.onSnapshot(snapshot));
  }

  private onSnapshot(snapshot: ReplaySnapshot): void {
    if (snapshot.session !== this.currentSession) {
      this.currentSession = snapshot.session;
      this.buildForSession(snapshot.session);
      this.prevCursor = snapshot.cursor;
      this.setStates(snapshot);
      return;
    }
    const delta = snapshot.cursor - this.prevCursor;
    this.prevCursor = snapshot.cursor;
    this.setStates(snapshot);
    // Only react with attack/hurt animations on a single forward step
    // (play or step-forward); jumps and rewinds just settle to state.
    if (delta === 1) this.reactToEvent(snapshot);
  }

  private buildForSession(session: Session): void {
    for (const token of this.tokens.values()) token.destroy();
    this.tokens.clear();
    for (const object of this.scenery) object.destroy();
    this.scenery = [];

    this.fenceBounds = expand(session.formation.bounds, FENCE_MARGIN_TILES);
    const rng = makeRng(session.seed);
    this.drawGround();
    if (SHOW_GRID) this.drawGrid();
    this.scatterProps(session, rng);
    this.drawFence();
    this.createTokens(session);
    this.reframe();
  }

  private drawGround(): void {
    const { minCol, maxCol, minRow, maxRow } = expand(this.fenceBounds!, ARENA_GROUND_PAD_TILES);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const ground = this.add
          .image((col + 0.5) * GRID_TILE_PX, (row + 0.5) * GRID_TILE_PX, GROUND_KEY)
          .setDisplaySize(GRID_TILE_PX, GRID_TILE_PX)
          .setDepth(RENDER_DEPTH.GROUND);
        this.scenery.push(ground);
      }
    }
  }

  // Debug: gray lines on each tile boundary across the ground extent.
  private drawGrid(): void {
    const { minCol, maxCol, minRow, maxRow } = expand(this.fenceBounds!, ARENA_GROUND_PAD_TILES);
    const left = minCol * GRID_TILE_PX;
    const right = (maxCol + 1) * GRID_TILE_PX;
    const top = minRow * GRID_TILE_PX;
    const bottom = (maxRow + 1) * GRID_TILE_PX;
    const grid = this.add.graphics().setDepth(RENDER_DEPTH.GRID);
    grid.lineStyle(1, GRID_LINE_COLOR, GRID_LINE_ALPHA);
    for (let col = minCol; col <= maxCol + 1; col++) {
      const x = col * GRID_TILE_PX;
      grid.lineBetween(x, top, x, bottom);
    }
    for (let row = minRow; row <= maxRow + 1; row++) {
      const y = row * GRID_TILE_PX;
      grid.lineBetween(left, y, right, y);
    }
    this.scenery.push(grid);
  }

  private scatterProps(session: Session, rng: Rng): void {
    const fence = this.fenceBounds!;
    // Keep props off the combatants and their immediate surroundings.
    const clear = new Set<string>();
    for (const { col, row } of session.formation.placements.values()) {
      for (let dr = -PROP_CLEAR_TILES; dr <= PROP_CLEAR_TILES; dr++) {
        for (let dc = -PROP_CLEAR_TILES; dc <= PROP_CLEAR_TILES; dc++) {
          clear.add(`${col + dc},${row + dr}`);
        }
      }
    }
    const pool = weightedPool();
    for (let row = fence.minRow + 1; row <= fence.maxRow - 1; row++) {
      for (let col = fence.minCol + 1; col <= fence.maxCol - 1; col++) {
        if (clear.has(`${col},${row}`)) continue;
        if (rng() * 100 >= PROP_DENSITY_PCT) continue;
        const spec = pool[Math.floor(rng() * pool.length)]!;
        const x = (col + 0.5) * GRID_TILE_PX + (rng() - 0.5) * PROP_OFFSET_X;
        const y = (row + TILE_GROUND_FRAC) * GRID_TILE_PX + (rng() - 0.5) * PROP_OFFSET_Y;
        const prop = this.add.image(x, y, spec.key).setOrigin(0.5, 1);
        prop.setScale((spec.heightTiles * GRID_TILE_PX) / prop.height);
        if (rng() < 0.5) prop.setFlipX(true);
        prop.setDepth(RENDER_DEPTH.WORLD_BASE + y);
        this.scenery.push(prop);
      }
    }
  }

  private drawFence(): void {
    const fence = this.fenceBounds!;
    const left = fence.minCol * GRID_TILE_PX;
    const top = fence.minRow * GRID_TILE_PX;
    const right = (fence.maxCol + 1) * GRID_TILE_PX;
    const bottom = (fence.maxRow + 1) * GRID_TILE_PX;
    const g = this.add.graphics().setDepth(RENDER_DEPTH.FENCE);

    g.lineStyle(5, FENCE_WOOD_MED, 1);
    g.strokeRect(left, top, right - left, bottom - top);
    g.lineStyle(2, FENCE_WOOD_LIGHT, 0.85);
    g.strokeRect(left, top - 3, right - left, bottom - top);

    const post = (cx: number, cy: number): void => {
      g.fillStyle(FENCE_WOOD_DARK, 1);
      g.fillRect(cx - 4, cy - 13, 8, 26);
      g.fillStyle(FENCE_WOOD_LIGHT, 1);
      g.fillRect(cx - 4, cy - 13, 8, 5);
    };
    for (let col = fence.minCol; col <= fence.maxCol + 1; col++) {
      post(col * GRID_TILE_PX, top);
      post(col * GRID_TILE_PX, bottom);
    }
    for (let row = fence.minRow; row <= fence.maxRow + 1; row++) {
      post(left, row * GRID_TILE_PX);
      post(right, row * GRID_TILE_PX);
    }
    this.scenery.push(g);
  }

  private createTokens(session: Session): void {
    const state = session.fullCampaign.state;
    let humanIndex = 0;
    let creatureIndex = 0;
    for (const [id, placement] of session.formation.placements) {
      const character = state.characters[id];
      const kind: CharacterKind = character?.kind ?? 'pc';
      const index = kind === 'creature' ? creatureIndex++ : humanIndex++;
      const token = new TokenView(this, placement, spriteKeyFor(kind, index), character?.name ?? id);
      this.tokens.set(id, token);
    }
  }

  private setStates(snapshot: ReplaySnapshot): void {
    const { campaign, session } = snapshot;
    const encounter = campaign.state.encounters[session.encounterId];
    const activeId = encounter?.combatants[encounter.activeIndex]?.combatantId;
    for (const [id, token] of this.tokens) {
      token.setState(campaign.state.characters[id], id === activeId);
    }
  }

  // The single event just crossed by a forward step drives a reaction:
  // the attacker lunges, or the damaged combatant flashes.
  private reactToEvent(snapshot: ReplaySnapshot): void {
    const event = snapshot.session.fullCampaign.events[snapshot.cursor - 1];
    if (!event) return;
    if (event.type === 'AttackRolled') {
      this.tokens.get(event.attackerId)?.playAttack();
    } else if (event.type === 'DamageApplied') {
      this.tokens.get(event.targetId)?.flashHit();
    }
  }

  private reframe(): void {
    // Frame the combatants (not the whole fence) so they fill the screen.
    if (this.currentSession) frameFormation(this.cameras.main, this.currentSession.formation.bounds);
  }
}

// Expand the weighted prop specs into a flat pool for uniform draws.
const weightedPool = (): typeof PROP_SPECS => {
  const pool: Array<(typeof PROP_SPECS)[number]> = [];
  for (const spec of PROP_SPECS) {
    const weight = PROP_WEIGHTS[spec.key] ?? 1;
    for (let i = 0; i < weight; i++) pool.push(spec);
  }
  return pool;
};
