import Phaser from 'phaser';
import type { ReplayStore, ReplaySnapshot } from '@/engine/replay-store';
import type { Session } from '@/state/session';
import { TokenView } from '@/phaser/tokens/TokenView';
import { frameFormation } from '@/phaser/camera';
import { spriteKeyFor, GROUND_KEY, DECOR_KEYS, type CharacterKind } from '@/phaser/assets/asset-keys';
import { GRID_TILE_PX, CAMERA_PADDING_TILES, DECOR_DENSITY_PCT } from '@/constants/layout';
import { RENDER_DEPTH } from '@/constants/depths';
import { GROUND_BASE_COLOR } from '@/constants/colors';

// The arena. Draws the tiled floor for the synthesized formation bounds,
// one token per combatant, and keeps tokens in sync with the engine
// state at the replay cursor. Rebuilds when the session changes.
export class ArenaScene extends Phaser.Scene {
  private store!: ReplayStore;
  private readonly tokens = new Map<string, TokenView>();
  private groundImages: Phaser.GameObjects.Image[] = [];
  private currentSession?: Session;
  private unsubscribe?: () => void;

  constructor() {
    super('Arena');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BASE_COLOR);
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
    }
    this.updateTokens(snapshot);
  }

  private buildForSession(session: Session): void {
    for (const token of this.tokens.values()) token.destroy();
    this.tokens.clear();
    for (const image of this.groundImages) image.destroy();
    this.groundImages = [];

    this.drawGround(session);

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

    this.reframe();
  }

  private drawGround(session: Session): void {
    const { minCol, maxCol, minRow, maxRow } = session.formation.bounds;
    const pad = CAMERA_PADDING_TILES;
    const occupied = new Set<string>();
    for (const placement of session.formation.placements.values()) {
      occupied.add(`${placement.col},${placement.row}`);
    }
    for (let row = minRow - pad; row <= maxRow + pad; row++) {
      for (let col = minCol - pad; col <= maxCol + pad; col++) {
        const x = (col + 0.5) * GRID_TILE_PX;
        const y = (row + 0.5) * GRID_TILE_PX;
        const ground = this.add
          .image(x, y, GROUND_KEY)
          .setDisplaySize(GRID_TILE_PX, GRID_TILE_PX)
          .setDepth(RENDER_DEPTH.GROUND);
        this.groundImages.push(ground);

        const hash = cellHash(col, row);
        if (hash % 100 < DECOR_DENSITY_PCT && !occupied.has(`${col},${row}`)) {
          const decorKey = DECOR_KEYS[(hash >> 8) % DECOR_KEYS.length]!;
          const decor = this.add
            .image(x, y, decorKey)
            .setDisplaySize(GRID_TILE_PX, GRID_TILE_PX)
            .setDepth(RENDER_DEPTH.TILE_DECOR);
          this.groundImages.push(decor);
        }
      }
    }
  }

  private updateTokens(snapshot: ReplaySnapshot): void {
    const { campaign, session } = snapshot;
    const encounter = campaign.state.encounters[session.encounterId];
    const activeId = encounter?.combatants[encounter.activeIndex]?.combatantId;
    for (const [id, token] of this.tokens) {
      token.update(campaign.state.characters[id], id === activeId);
    }
  }

  private reframe(): void {
    if (this.currentSession) frameFormation(this.cameras.main, this.currentSession.formation.bounds);
  }
}

// Deterministic per-cell hash so decor placement is stable without RNG.
const cellHash = (col: number, row: number): number =>
  Math.abs((col * 73856093) ^ (row * 19349663));
