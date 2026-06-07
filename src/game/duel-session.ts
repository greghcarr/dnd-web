import type { Engine, Campaign } from 'dnd-srd-engine';
import type { EngineBridge } from '@/engine/engine-bridge';
import { LiveStore } from '@/engine/live-store';
import { buildScrubbed, createScrubCache } from '@/engine/scrub-cache';
import { DEFAULT_MODE, DEFAULT_VS } from '@/constants/app';
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
type AvailableAction = ReturnType<Engine['query']['availableActions']>[number];
type Position = MoveDestination['position'];

// Spell + bonus-action affordance shapes (slices 713/714), derived from the
// query namespace so we don't depend on the type names being exported.
export type CastableSpell = ReturnType<Engine['query']['castableSpells']>[number];
export type LegalSpellTargets = ReturnType<Engine['query']['legalSpellTargets']>;
export type BonusActionOption = ReturnType<Engine['query']['bonusActions']>[number];
export type SpellTarget = { readonly targetIds?: readonly string[]; readonly targetPosition?: Position };

// The self-targeted action-economy actions the Actions menu offers (move and
// attack have their own command-bar buttons).
export type SimpleAction = 'dash' | 'disengage' | 'dodge';

export type DuelPhase = 'player' | 'busy' | 'enemy' | 'over';

// Safety bound on the auto-driven loop (enemy turns + the player's own downed
// death-save turns). A human's live turn is unbounded; this only guards the
// automatic side against a non-terminating policy.
const MAX_AUTO_TURNS = 100;

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
  // Whole-turn pending undo (Into the Breach model): each clean move pushes
  // the pre-move campaign so it can be rewound to. Rolling dice this turn (an
  // attack, or a move that provokes an opportunity attack) locks undo.
  private undoStack: Campaign[] = [];
  private diceRolledThisTurn = false;

  constructor(
    bridge: EngineBridge,
    config: RunConfig,
    private readonly dice: DiceSource,
  ) {
    const session = bridge.startBattle({
      seed: config.seed,
      mode: DEFAULT_MODE,
      vs: DEFAULT_VS,
      level: config.level,
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

  availableActions(): readonly AvailableAction[] {
    if (this.activeId() !== this.playerId) return [];
    return this.engine.query.availableActions(this.store.currentTail.state, this.encounterId, this.playerId);
  }

  castableSpells(): readonly CastableSpell[] {
    if (this.activeId() !== this.playerId) return [];
    return this.engine.query.castableSpells(this.store.currentTail.state, this.playerId);
  }

  legalSpellTargets(spellId: string, slotLevel: number): LegalSpellTargets {
    return this.engine.query.legalSpellTargets(this.store.currentTail.state, this.encounterId, this.playerId, spellId, slotLevel);
  }

  bonusActions(): readonly BonusActionOption[] {
    if (this.activeId() !== this.playerId) return [];
    return this.engine.query.bonusActions(this.store.currentTail.state, this.encounterId, this.playerId);
  }

  spellName(spellId: string): string {
    return this.engine.content.spells.get(spellId)?.name ?? spellId;
  }

  // Cast a spell at a slot level + targets. Dice (attack/save/damage/heal)
  // route through the dice source (manual or app). Casting is a committing
  // action, so it locks undo. A cast can fail (concentration / economy / edge
  // cases) even past target validation; on failure it aborts cleanly.
  async commitSpell(spellId: string, slotLevel: number, target: SpellTarget): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    try {
      const result = await this.dice.resolve(() =>
        this.engine.plan.castSpell(this.store.currentTail.state, {
          characterId: this.playerId,
          spellId,
          slotLevel,
          targetIds: target.targetIds ?? [],
          ...(target.targetPosition ? { targetPosition: target.targetPosition } : {}),
        }),
      );
      this.store.append(result.events);
      await playToTail(this.store);
      this.diceRolledThisTurn = true;
      this.undoStack = [];
    } catch {
      // Cast rejected (e.g. concentration / action-economy edge); no-op.
    }
    this.busy = false;
    this.notify();
  }

  // Perform an enumerated bonus-action option via the engine dispatcher.
  async commitOption(optionId: string, targetId?: string): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    try {
      const result = await this.dice.resolve(() =>
        this.engine.plan.useOption(this.store.currentTail.state, {
          combatantId: this.playerId,
          optionId,
          ...(targetId ? { targetId } : {}),
        }),
      );
      this.store.append(result.events);
      await playToTail(this.store);
      this.diceRolledThisTurn = true;
      this.undoStack = [];
    } catch {
      // Option rejected; no-op.
    }
    this.busy = false;
    this.notify();
  }

  // Dash / Disengage / Dodge: self-targeted, dice-free, so undoable like a
  // clean move.
  async commitAction(action: SimpleAction): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    const base = this.store.currentTail;
    const intent = { combatantId: this.playerId };
    const result =
      action === 'dash'
        ? this.engine.plan.dash(base.state, intent)
        : action === 'disengage'
          ? this.engine.plan.disengage(base.state, intent)
          : this.engine.plan.dodge(base.state, intent);
    this.store.append(result.events);
    await playToTail(this.store);
    this.busy = false;
    if (!this.diceRolledThisTurn) this.undoStack.push(base);
    this.notify();
  }

  async commitMove(to: Position): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    const base = this.store.currentTail;
    const moved = resolveMove(this.engine, base, this.playerId, to);
    this.store.append(moved.events);
    await playToTail(this.store);
    this.busy = false;
    if (moved.provokedAttack) {
      // The move drew an opportunity attack (dice), which locks undo.
      this.diceRolledThisTurn = true;
      this.undoStack = [];
    } else if (!this.diceRolledThisTurn) {
      this.undoStack.push(base);
    }
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
    // The attack rolled dice; that locks undo for the rest of the turn.
    this.diceRolledThisTurn = true;
    this.undoStack = [];
    this.notify();
  }

  // Kick off the duel: drive AI (and, if the enemy won initiative, its
  // turn(s)) until it is the player's turn to act. Called once on mount.
  async begin(): Promise<void> {
    this.busy = true;
    this.notify();
    await this.runUntilPlayerActs();
    this.resetTurnUndo();
    this.busy = false;
    this.notify();
  }

  async endTurn(): Promise<void> {
    if (this.phase() !== 'player') return;
    this.busy = true;
    this.notify();
    await this.advance(false);
    await this.runUntilPlayerActs();
    this.resetTurnUndo();
    this.busy = false;
    this.notify();
  }

  // Undo is available for clean (dice-free) moves made this turn, until the
  // player rolls dice (an attack, or a move that provoked an opportunity
  // attack), which locks the turn.
  canUndo(): boolean {
    return this.phase() === 'player' && this.undoStack.length > 0;
  }

  undo(): void {
    if (!this.canUndo()) return;
    const previous = this.undoStack.pop()!;
    this.store.rewindTo(previous);
    this.notify();
  }

  private resetTurnUndo(): void {
    this.undoStack = [];
    this.diceRolledThisTurn = false;
  }

  // Drive the enemy's turns, and auto-pass the player's own turns while they
  // are downed (the engine rolls their death save on the way in), until the
  // player can act again or the duel ends.
  private async runUntilPlayerActs(): Promise<void> {
    let guard = 0;
    while (this.outcome() === 'ongoing' && guard < MAX_AUTO_TURNS) {
      guard += 1;
      const active = this.activeId();
      if (active === undefined) break;
      if (active === this.playerId) {
        if (this.playerCanAct()) return;
        await this.advance(false); // unconscious player: pass to the enemy
        continue;
      }
      this.store.append(planEnemyTurn(this.engine, this.store.currentTail, this.encounterId, active, this.playerId));
      await playToTail(this.store);
      if (this.outcome() !== 'ongoing') break;
      // Advancing into the player's turn rolls their death save when they are
      // down; route it through their dice (a manual prompt) if one is pending.
      await this.advance(this.playerDeathSavePending());
    }
  }

  // Advance the turn. `rollAsPlayer` routes any roll the advance makes (a
  // downed player's death save) through the player's dice source; otherwise
  // the engine rolls. For a PC duel the only roll an advance makes is that
  // death save, so the routing stays precise.
  private async advance(rollAsPlayer: boolean): Promise<void> {
    const plan = () => this.engine.plan.advanceTurn(this.store.currentTail.state, { encounterId: this.encounterId });
    const result = rollAsPlayer ? await this.dice.resolve(plan) : plan();
    this.store.append(result.events);
    await playToTail(this.store);
  }

  private playerCanAct(): boolean {
    const player = this.store.currentTail.state.characters[this.playerId];
    return !!player && player.hp.current > 0;
  }

  private playerDeathSavePending(): boolean {
    const player = this.store.currentTail.state.characters[this.playerId];
    return !!player && player.hp.current <= 0 && !player.deathSaves.stable && player.deathSaves.failures < 3;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
