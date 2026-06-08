import Phaser from 'phaser';
import type { Character, LocationMap } from 'dnd-srd-engine';
import type { SnapshotSource, ReplaySnapshot } from '@/engine/snapshot-source';
import type { Session } from '@/state/session';
import type { FormationBounds, Team } from '@/spatial/formation';
import { combatantPositions, cellOf } from '@/spatial/engine-positions';
import { TokenView, type TokenBadge } from '@/phaser/tokens/TokenView';
import { registerCharacterAnims } from '@/phaser/anims';
import { frameBounds } from '@/phaser/camera';
import { fitGameToParent } from '@/phaser/render-scale';
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
import {
  GROUND_BASE_COLOR,
  GRID_LINE_COLOR,
  GRID_LINE_ALPHA,
  CLASS_NAME_OUTLINE_COLORS,
  TEAM_A_COLOR,
  TEAM_B_COLOR,
} from '@/constants/colors';
import { makeRng, type Rng } from '@/phaser/rng';
import type { ArenaInteraction } from '@/phaser/interaction';
import {
  MOVE_CELL_COLOR,
  MOVE_CELL_ALPHA,
  MOVE_CELL_BORDER_COLOR,
  TARGET_CELL_COLOR,
  TARGET_CELL_ALPHA,
  TARGET_CELL_BORDER_COLOR,
  OVERLAY_BORDER_PX,
  OVERLAY_BORDER_ALPHA,
} from '@/constants/overlay';

const FENCE_WOOD_DARK = 0x5b3b1f;
const FENCE_WOOD_MED = 0x7a5230;
const FENCE_WOOD_LIGHT = 0x9c6b3e;
const PROP_OFFSET_X = GRID_TILE_PX * 0.5;
const PROP_OFFSET_Y = GRID_TILE_PX * 0.3;

// Tactical-arena terrain rendering, seed-deterministic for variety:
// impassable cover blocks sight/movement (tall trees, varied), difficult
// terrain slows (low brush), water is tinted, and open ground gets sparse
// decorative clutter (low bushes/stones that don't block) like the fuzz
// viewer. Only the tall trees mark real blockers, so cover stays readable.
const COVER_PROP_KEYS = ['tree-1', 'tree-2'] as const;
const COVER_SCALE_MIN = 0.85;
const COVER_SCALE_MAX = 1.15;
// The arena's outer impassable ring (contiguous with the map edge) renders
// as a rocky border; interior impassable cells stay tree pillars. Stones
// are small props, so scale them up into boulders.
const BORDER_ROCK_KEYS = ['stone-1', 'stone-2', 'stone-3', 'stone-4', 'stone-5'] as const;
const BORDER_ROCK_SCALE_MIN = 1.8;
const BORDER_ROCK_SCALE_MAX = 2.3;
const BRUSH_PROP_KEYS = ['bush-1', 'bush-3', 'bush-5'] as const;
const DECOR_PROP_KEYS = ['bush-2', 'bush-4', 'stone-1', 'stone-2', 'stone-3', 'stone-4', 'stone-5'] as const;
const TACTICAL_DECOR_PCT = 14;
const WATER_TINT_COLOR = 0x3a6ea5;
const WATER_TINT_ALPHA = 0.45;

const pick = <T>(arr: ReadonlyArray<T>, rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;

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
  private store!: SnapshotSource;
  private readonly tokens = new Map<string, TokenView>();
  private scenery: Phaser.GameObjects.GameObject[] = [];
  private currentSession?: Session;
  private fenceBounds?: FormationBounds;
  private prevCursor = 0;
  private lastSnapshot?: ReplaySnapshot;
  private unsubscribe?: () => void;
  // Interactive-duel cell overlay + tap input (absent in replay modes).
  private interaction?: ArenaInteraction;
  private overlay?: Phaser.GameObjects.Graphics;
  private interactionUnsub?: () => void;
  private resizeObserver?: ResizeObserver;
  private reframeQueued = false;

  constructor() {
    super('Arena');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BASE_COLOR);
    registerCharacterAnims(this);
    this.store = this.registry.get('store') as SnapshotSource;
    this.scale.on(Phaser.Scale.Events.RESIZE, this.scheduleReframe, this);
    // Size the device-resolution buffer to the parent now (covers the initial
    // layout before the first window/observer event).
    fitGameToParent(this.game);
    // The game runs in Scale.NONE, so nothing auto-tracks the parent's size.
    // A CSS-driven arena resize (collapsing the right column) or a mobile
    // viewport change (iOS Safari toolbar show/hide, rotation) must refit the
    // buffer and re-center. Observe the canvas parent directly, refit to the
    // new size, then reframe on the next frame (once canvas + camera settle).
    const arenaParent = this.game.canvas.parentElement;
    if (arenaParent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        fitGameToParent(this.game);
        this.scheduleReframe();
      });
      this.resizeObserver.observe(arenaParent);
    }
    // The interaction channel is present only when a live duel is active; the
    // overlay graphics and tap handler are inert (no marks, no handler) in
    // replay modes.
    this.interaction = this.registry.get('interaction') as ArenaInteraction | undefined;
    if (this.interaction) {
      this.overlay = this.add.graphics().setDepth(RENDER_DEPTH.OVERLAY);
      // Redraw the overlay and re-fit the camera so revealed cells (e.g. the
      // Move squares) all come into view, snapping back when they clear.
      this.interactionUnsub = this.interaction.onChange(() => {
        this.drawOverlay();
        this.frameForMarks(true);
      });
      this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.drawOverlay();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.interactionUnsub?.();
      this.resizeObserver?.disconnect();
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.scheduleReframe, this);
    });
    this.unsubscribe = this.store.subscribe((snapshot) => this.onSnapshot(snapshot));
  }

  private onSnapshot(snapshot: ReplaySnapshot): void {
    this.lastSnapshot = snapshot;
    if (snapshot.session !== this.currentSession) {
      this.currentSession = snapshot.session;
      this.buildForSession(snapshot.session);
      this.prevCursor = snapshot.cursor;
      this.setStates(snapshot, false);
      this.frameCamera(false);
      return;
    }
    const delta = snapshot.cursor - this.prevCursor;
    this.prevCursor = snapshot.cursor;
    // Only animate (token moves, attack/hurt reactions, camera pan) on a
    // single forward step; jumps and rewinds settle/snap to state.
    const animate = delta === 1;
    this.setStates(snapshot, animate);
    if (animate) this.reactToEvent(snapshot);
    this.frameCamera(animate);
  }

  private buildForSession(session: Session): void {
    for (const token of this.tokens.values()) token.destroy();
    this.tokens.clear();
    for (const object of this.scenery) object.destroy();
    this.scenery = [];

    if (session.map) {
      this.buildTacticalArena(session, session.map);
    } else {
      this.buildFormationArena(session);
    }
  }

  // Positionless battles: a fenced field with random scenery around the
  // adjacent-tile formation.
  private buildFormationArena(session: Session): void {
    this.fenceBounds = expand(session.formation.bounds, FENCE_MARGIN_TILES);
    const rng = makeRng(session.seed);
    this.drawGround();
    if (SHOW_GRID) this.drawGrid();
    this.scatterProps(session, rng);
    this.drawFence();
    this.createTokens(session);
  }

  // Tactical battles: the engine's terrain grid, with cover drawn from the
  // map and a fence at the map boundary. Combatants spawn at their real
  // starting cells (the formation built from engine positions).
  private buildTacticalArena(session: Session, map: LocationMap): void {
    this.fenceBounds = { minCol: 0, maxCol: map.widthCells - 1, minRow: 0, maxRow: map.heightCells - 1 };
    const rng = makeRng(session.seed);
    this.drawGround();
    if (SHOW_GRID) this.drawGrid();
    this.drawTerrain(map, rng);
    this.scatterTacticalDecor(session, map, rng);
    // No wooden fence: the arena's rock border is its boundary.
    this.createTokens(session);
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

  // Draw the tactical map's terrain, varied per seed: impassable cells get a
  // tall blocker (so cover/LoS reads correctly), difficult cells low brush,
  // water a tint. Cover stays centred on its cell so it maps 1:1 to the
  // blocked tile.
  private drawTerrain(map: LocationMap, rng: Rng): void {
    const border = this.borderImpassable(map);
    for (let row = 0; row < map.heightCells; row++) {
      for (let col = 0; col < map.widthCells; col++) {
        const terrain = map.terrain[row]?.[col];
        if (terrain === 'impassable') {
          if (border.has(`${col},${row}`)) {
            this.placeProp(pick(BORDER_ROCK_KEYS, rng), col, row, {
              flip: rng() < 0.5,
              scale: BORDER_ROCK_SCALE_MIN + rng() * (BORDER_ROCK_SCALE_MAX - BORDER_ROCK_SCALE_MIN),
            });
          } else {
            this.placeProp(pick(COVER_PROP_KEYS, rng), col, row, {
              flip: rng() < 0.5,
              scale: COVER_SCALE_MIN + rng() * (COVER_SCALE_MAX - COVER_SCALE_MIN),
            });
          }
        } else if (terrain === 'difficult') {
          this.placeProp(pick(BRUSH_PROP_KEYS, rng), col, row, { flip: rng() < 0.5 });
        } else if (terrain === 'water') {
          this.tintCell(col, row, WATER_TINT_COLOR, WATER_TINT_ALPHA);
        }
      }
    }
  }

  // Impassable cells reachable from the map edge through other impassable
  // cells: the arena's outer wall. Interior pillars and fenced pens aren't
  // edge-connected, so they fall outside this set and render as trees.
  private borderImpassable(map: LocationMap): Set<string> {
    const W = map.widthCells;
    const H = map.heightCells;
    const imp = (c: number, r: number): boolean => map.terrain[r]?.[c] === 'impassable';
    const seen = new Set<string>();
    const stack: Array<[number, number]> = [];
    const seed = (c: number, r: number): void => {
      const k = `${c},${r}`;
      if (imp(c, r) && !seen.has(k)) {
        seen.add(k);
        stack.push([c, r]);
      }
    };
    for (let c = 0; c < W; c++) {
      seed(c, 0);
      seed(c, H - 1);
    }
    for (let r = 0; r < H; r++) {
      seed(0, r);
      seed(W - 1, r);
    }
    while (stack.length > 0) {
      const [c, r] = stack.pop()!;
      seed(c + 1, r);
      seed(c - 1, r);
      seed(c, r + 1);
      seed(c, r - 1);
    }
    return seen;
  }

  // Sparse, seed-deterministic ground clutter on open (normal) cells, like
  // the fuzz viewer's scatter. Low props only (bushes/stones) so they read
  // as passable decor, never confused with the blocking cover. Kept off the
  // combatants' starting cells.
  private scatterTacticalDecor(session: Session, map: LocationMap, rng: Rng): void {
    const spawn = new Set<string>();
    for (const { col, row } of session.formation.placements.values()) spawn.add(`${col},${row}`);
    for (let row = 1; row < map.heightCells - 1; row++) {
      for (let col = 1; col < map.widthCells - 1; col++) {
        if (map.terrain[row]?.[col] !== 'normal') continue;
        if (spawn.has(`${col},${row}`)) continue;
        if (rng() * 100 >= TACTICAL_DECOR_PCT) continue;
        this.placeProp(pick(DECOR_PROP_KEYS, rng), col, row, {
          flip: rng() < 0.5,
          offsetX: (rng() - 0.5) * PROP_OFFSET_X,
          offsetY: (rng() - 0.5) * PROP_OFFSET_Y,
        });
      }
    }
  }

  private placeProp(
    key: string,
    col: number,
    row: number,
    opts: { flip?: boolean; scale?: number; offsetX?: number; offsetY?: number } = {},
  ): void {
    const spec = PROP_SPECS.find((s) => s.key === key);
    if (!spec) return;
    const x = (col + 0.5) * GRID_TILE_PX + (opts.offsetX ?? 0);
    const y = (row + TILE_GROUND_FRAC) * GRID_TILE_PX + (opts.offsetY ?? 0);
    const prop = this.add.image(x, y, spec.key).setOrigin(0.5, 1);
    prop.setScale((spec.heightTiles * (opts.scale ?? 1) * GRID_TILE_PX) / prop.height);
    if (opts.flip) prop.setFlipX(true);
    prop.setDepth(RENDER_DEPTH.WORLD_BASE + y);
    this.scenery.push(prop);
  }

  private tintCell(col: number, row: number, color: number, alpha: number): void {
    const tint = this.add
      .rectangle((col + 0.5) * GRID_TILE_PX, (row + 0.5) * GRID_TILE_PX, GRID_TILE_PX, GRID_TILE_PX, color, alpha)
      .setDepth(RENDER_DEPTH.GROUND + 1);
    this.scenery.push(tint);
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
      const token = new TokenView(
        this,
        placement,
        spriteKeyFor(kind, index),
        character?.name ?? id,
        nameOutlineColor(character, placement.team),
        badgeFor(id, session.playerId),
      );
      this.tokens.set(id, token);
    }
  }

  private setStates(snapshot: ReplaySnapshot, animateMoves: boolean): void {
    const { campaign, session } = snapshot;
    const encounter = campaign.state.encounters[session.encounterId];
    const activeId = encounter?.combatants[encounter.activeIndex]?.combatantId;
    for (const [id, token] of this.tokens) {
      token.setState(campaign.state.characters[id], id === activeId);
    }
    // Tactical: reflect each combatant's position at the cursor. moveTo
    // no-ops when the tile is unchanged, so only real moves animate/snap.
    if (!session.map) return;
    const cellSize = session.map.cellSizeFeet;
    for (const combatant of combatantPositions(campaign, session.encounterId)) {
      if (!combatant.position) continue;
      const token = this.tokens.get(combatant.combatantId);
      if (!token) continue;
      const { col, row } = cellOf(combatant.position, cellSize);
      token.moveTo(col, row, animateMoves);
    }
  }

  // The single event just crossed by a forward step drives a reaction: the
  // attacker turns to face its target and lunges, a caster turns to face its
  // target, or the damaged combatant flashes.
  private reactToEvent(snapshot: ReplaySnapshot): void {
    const event = snapshot.session.fullCampaign.events[snapshot.cursor - 1];
    if (!event) return;
    if (event.type === 'AttackRolled') {
      this.faceTokenToward(event.attackerId, event.targetId);
      this.tokens.get(event.attackerId)?.playAttack();
    } else if (event.type === 'SpellCastDeclared') {
      this.faceTokenToward(event.characterId, event.targetIds[0]);
    } else if (event.type === 'DamageApplied') {
      this.tokens.get(event.targetId)?.flashHit();
    }
  }

  // Turn one combatant's token to face another (an attack or spell target), so
  // the avatar looks at who it acts on. No-op if either token is absent or the
  // target is the actor itself (e.g. a self-targeted spell).
  private faceTokenToward(actorId: string, targetId: string | undefined): void {
    if (targetId === undefined || targetId === actorId) return;
    const actor = this.tokens.get(actorId);
    const target = this.tokens.get(targetId);
    if (actor && target) actor.faceToward(target.worldX);
  }

  // Paint the interactive-duel cell overlay: green for reachable move cells,
  // red for legal attack targets. Redrawn whenever the controller changes the
  // marks; empty (cleared) in replay modes and when idle.
  private drawOverlay(): void {
    const g = this.overlay;
    if (!g || !this.interaction) return;
    g.clear();
    for (const mark of this.interaction.getMarks()) {
      const x = mark.col * GRID_TILE_PX;
      const y = mark.row * GRID_TILE_PX;
      const isMove = mark.kind === 'move';
      g.fillStyle(isMove ? MOVE_CELL_COLOR : TARGET_CELL_COLOR, isMove ? MOVE_CELL_ALPHA : TARGET_CELL_ALPHA);
      g.fillRect(x, y, GRID_TILE_PX, GRID_TILE_PX);
      g.lineStyle(OVERLAY_BORDER_PX, isMove ? MOVE_CELL_BORDER_COLOR : TARGET_CELL_BORDER_COLOR, OVERLAY_BORDER_ALPHA);
      g.strokeRect(x, y, GRID_TILE_PX, GRID_TILE_PX);
    }
  }

  // Tap-to-act: convert a pointer (mouse or touch) to a grid cell and report
  // it to the interaction channel, which the controller maps to a move
  // destination or attack target.
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.interaction) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / GRID_TILE_PX);
    const row = Math.floor(world.y / GRID_TILE_PX);
    this.interaction.clickCell(col, row);
  }

  // Reframe on the next animation frame, coalescing bursts of resize events.
  // Deferring lets the canvas + camera settle at the new size first, so the
  // fit uses the final dimensions (not a mid-transition size).
  private scheduleReframe(): void {
    if (this.reframeQueued) return;
    this.reframeQueued = true;
    requestAnimationFrame(() => {
      this.reframeQueued = false;
      this.reframe();
    });
  }

  // Resize handler: re-fit the camera to the current state (never animated).
  // Keeps the marked-cell framing if a selection (e.g. Move) is active.
  private reframe(): void {
    if (this.interaction && this.interaction.getMarks().length > 0) {
      this.frameForMarks(false);
    } else {
      this.frameCamera(false);
    }
  }

  private frameCamera(animate: boolean): void {
    const session = this.currentSession;
    if (!session) return;
    if (session.map) {
      this.frameTactical(session.map, animate);
    } else {
      // Positionless: static framing of the adjacent-tile formation.
      frameBounds(this.cameras.main, session.formation.bounds, false);
    }
  }

  // Follow the action: frame the living combatants at the current cursor
  // (so a felled combatant doesn't drag the view), falling back to the whole
  // map if none are standing.
  private frameTactical(map: LocationMap, animate: boolean): void {
    frameBounds(this.cameras.main, this.livingCombatantBounds() ?? wholeMapBounds(map), animate);
  }

  // Bounds of the living combatants at the current cursor; undefined if none
  // are standing (or no positioned battle is loaded).
  private livingCombatantBounds(): FormationBounds | undefined {
    const snapshot = this.lastSnapshot;
    const session = this.currentSession;
    if (!snapshot || !session?.map) return undefined;
    const cellSize = session.map.cellSizeFeet;
    let bounds: FormationBounds | undefined;
    for (const combatant of combatantPositions(snapshot.campaign, session.encounterId)) {
      if (!combatant.position) continue;
      const character = snapshot.campaign.state.characters[combatant.combatantId];
      if (character && character.hp.current <= 0) continue;
      const { col, row } = cellOf(combatant.position, cellSize);
      bounds = expandBounds(bounds, col, row);
    }
    return bounds;
  }

  // When the player has cells marked (e.g. Move's reachable squares), frame
  // the living combatants together with every marked cell so all the options
  // are visible at once; restore the normal combatant framing when cleared.
  private frameForMarks(animate: boolean): void {
    if (!this.interaction || !this.currentSession?.map) return;
    const marks = this.interaction.getMarks();
    if (marks.length === 0) {
      this.frameCamera(animate);
      return;
    }
    let bounds = this.livingCombatantBounds();
    for (const mark of marks) bounds = expandBounds(bounds, mark.col, mark.row);
    if (bounds) frameBounds(this.cameras.main, bounds, animate);
  }
}

const wholeMapBounds = (map: LocationMap): FormationBounds => ({
  minCol: 0,
  maxCol: map.widthCells - 1,
  minRow: 0,
  maxRow: map.heightCells - 1,
});

const expandBounds = (
  bounds: FormationBounds | undefined,
  col: number,
  row: number,
): FormationBounds =>
  bounds
    ? {
        minCol: Math.min(bounds.minCol, col),
        maxCol: Math.max(bounds.maxCol, col),
        minRow: Math.min(bounds.minRow, row),
        maxRow: Math.max(bounds.maxRow, row),
      }
    : { minCol: col, maxCol: col, minRow: row, maxRow: row };

// Who controls a combatant in an interactive duel: the player gets the "1P"
// badge, everyone else "CPU". Replay viewers (no playerId) get no badge.
const badgeFor = (id: string, playerId: string | undefined): TokenBadge | undefined => {
  if (playerId === undefined) return undefined;
  return id === playerId ? 'player' : 'cpu';
};

// A combatant's most-advanced class (the colour-defining one for multiclass).
const primaryClassId = (character: Character): string =>
  character.classes.reduce((a, b) => (b.level > a.level ? b : a)).classId;

// The name-label outline colour: the combatant's class colour, falling back
// to their team colour when they have no recognised class (e.g. monsters).
const nameOutlineColor = (character: Character | undefined, team: Team): number => {
  const classColor = character ? CLASS_NAME_OUTLINE_COLORS[primaryClassId(character)] : undefined;
  return classColor ?? (team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR);
};

// Expand the weighted prop specs into a flat pool for uniform draws.
const weightedPool = (): typeof PROP_SPECS => {
  const pool: Array<(typeof PROP_SPECS)[number]> = [];
  for (const spec of PROP_SPECS) {
    const weight = PROP_WEIGHTS[spec.key] ?? 1;
    for (let i = 0; i < weight; i++) pool.push(spec);
  }
  return pool;
};
