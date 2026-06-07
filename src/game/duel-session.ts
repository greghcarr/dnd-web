import type { Engine } from 'dnd-srd-engine';
import type { EngineBridge } from '@/engine/engine-bridge';
import { LiveStore } from '@/engine/live-store';
import { buildScrubbed, createScrubCache } from '@/engine/scrub-cache';
import { DEFAULT_MODE, DEFAULT_VS, DEFAULT_LEVEL } from '@/constants/app';
import type { Session } from '@/state/session';
import type { RunConfig } from './run-config';
import { narrate } from '@/narrator';
import { planEnemyTurn } from './enemy-controller';
import { resolveMove } from './resolve-move';
import { duelOutcome, winnerId, type DuelOutcome } from './outcome';
import { activeCombatantId, mainWeaponInstanceId } from './combatant-read';
import { playToTail } from './playback';
import type { DiceSource } from './dice-source';

// Affordance shapes, derived from the engine query namespace so we don't
// depend on the type names being individually exported.
type MoveDestination = ReturnType<Engine['query']['legalMoveDestinations']>[number];
type TargetCandidate = ReturnType<Engine['query']['legalTargets']>[number];
type ActionEconomyView = ReturnType<Engine['query']['actionEconomy']>;
type Position = MoveDestination['position'];

export type DuelPhase = 'player' | 'busy' | 'enemy' | 'over';

// Safety bound on the enemy turn loop (a human turn is unbounded; this only
// guards the AI side against a non-terminating policy).
const MAX_ENEMY_TURNS = 100;

// A live, player-driven tactical duel. Reuses the engine's tactical
// generation (via the bridge) for the map + roster, branches the campaign at
// the set-up frame (discarding the AI combat runBattle computed past it), and
// drives the engine forward one committed action at a time through a
// LiveStore. The player commits Move/Attack on their turn; End Turn advances
// and runs the enemy turn(s) with the affordance-driven policy. Planning uses
// the committed tail; the LiveStore walks the view forward to animate.
export class DuelSession {
  readonly store: LiveStore;
  readonly playerId: string;
  readonly enemyId: string;
  readonly cellSizeFeet: number;
  private readonly engine: Engine;
  private readonly encounterId: string;
  private readonly listeners = new Set<() => void>();
  private busy = false;

  constructor(
    bridge: EngineBridge,
    config: RunConfig,
    private readonly dice: DiceSource,
  ) {
    const session = bridge.startBattle({
      seed: config.seed,
      mode: DEFAULT_MODE,
      vs: DEFAULT_VS,
      level: DEFAULT_LEVEL,
      movement: 'tactical',
    });
    // Branch the live campaign at the set-up frame: all spawns, placement,
    // and initiative, before any combat action. A fresh scrub cache, since
    // the live log diverges from runBattle's here.
    const setup = buildScrubbed(session.fullCampaign, session.openingCursor, session.scrubCache);
    const liveCache = createScrubCache([0, session.openingCursor]);
    buildScrubbed(setup, 0, liveCache);
    buildScrubbed(setup, session.openingCursor, liveCache);

    const playerId = session.result.teamACharacterIds[0]!;
    const enemyId = session.result.teamBCharacterIds[0]!;
    // Live battle log: re-narrate the growing campaign (winner line appears
    // only once the duel is decided).
    const content = bridge.getContent();
    const renarrate = (campaign: typeof setup) =>
      narrate(campaign.events, content, winnerId(campaign.state, playerId, enemyId));
    const liveSession: Session = {
      ...session,
      fullCampaign: setup,
      totalEvents: setup.events.length,
      scrubCache: liveCache,
      narration: renarrate(setup),
    };

    this.store = new LiveStore(liveSession, renarrate);
    this.engine = bridge.createDuelEngine(config.seed);
    this.encounterId = session.encounterId;
    this.playerId = playerId;
    this.enemyId = enemyId;
    this.cellSizeFeet = session.map?.cellSizeFeet ?? 5;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  outcome(): DuelOutcome {
    return duelOutcome(this.store.currentTail.state, this.playerId, this.enemyId);
  }

  phase(): DuelPhase {
    if (this.outcome() !== 'ongoing') return 'over';
    if (this.activeId() !== this.playerId) return 'enemy';
    return this.busy ? 'busy' : 'player';
  }

  activeId(): string | undefined {
    return activeCombatantId(this.store.currentTail.state, this.encounterId);
  }

  // Affordances for the player's active combatant (empty off-turn).
  moveDestinations(): readonly MoveDestination[] {
    if (this.activeId() !== this.playerId) return [];
    return this.engine.query.legalMoveDestinations(this.store.currentTail.state, this.encounterId, this.playerId);
  }

  attackTargets(): readonly TargetCandidate[] {
    if (this.activeId() !== this.playerId) return [];
    return this.engine.query.legalTargets(this.store.currentTail.state, this.encounterId, this.playerId, 'attack');
  }

  economy(): ActionEconomyView {
    return this.engine.query.actionEconomy(this.store.currentTail.state, this.encounterId, this.playerId);
  }

  async commitMove(to: Position): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    const moved = resolveMove(this.engine, this.store.currentTail, this.playerId, to);
    this.store.append(moved.events);
    await playToTail(this.store);
    this.busy = false;
    this.notify();
  }

  async commitAttack(targetId: string): Promise<void> {
    if (this.phase() !== 'player') return;
    const weapon = mainWeaponInstanceId(this.store.currentTail.state, this.playerId);
    if (!weapon) return;
    this.busy = true;
    this.notify();
    // The dice source rolls the attack: the engine's RNG (daily/seeded) or the
    // player's own physical dice (manual), via the resumable roll seam.
    const attack = await this.dice.resolve(() =>
      this.engine.plan.attack(this.store.currentTail.state, {
        attackerId: this.playerId,
        targetId,
        weaponInstanceId: weapon,
      }),
    );
    this.store.append(attack.events);
    await playToTail(this.store);
    this.busy = false;
    this.notify();
  }

  // Kick off the duel: if the enemy won initiative, run its turn(s) until it
  // is the player's turn (or the duel is over). Called once on mount.
  async begin(): Promise<void> {
    if (this.outcome() !== 'ongoing' || this.activeId() === this.playerId) {
      this.notify();
      return;
    }
    this.busy = true;
    this.notify();
    await this.runEnemyTurns();
    this.busy = false;
    this.notify();
  }

  async endTurn(): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    await this.advance();
    await this.runEnemyTurns();
    this.busy = false;
    this.notify();
  }

  // Run AI turns until control returns to the player or the duel ends.
  private async runEnemyTurns(): Promise<void> {
    let guard = 0;
    while (this.outcome() === 'ongoing' && this.activeId() !== this.playerId && guard < MAX_ENEMY_TURNS) {
      guard += 1;
      const active = this.activeId()!;
      const foe = active === this.playerId ? this.enemyId : this.playerId;
      this.store.append(planEnemyTurn(this.engine, this.store.currentTail, this.encounterId, active, foe));
      await playToTail(this.store);
      if (this.outcome() !== 'ongoing') break;
      await this.advance();
    }
  }

  private async advance(): Promise<void> {
    const advance = this.engine.plan.advanceTurn(this.store.currentTail.state, { encounterId: this.encounterId });
    this.store.append(advance.events);
    await playToTail(this.store);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
