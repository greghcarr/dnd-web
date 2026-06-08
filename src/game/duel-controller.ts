import type {
  DuelSession,
  SimpleAction,
  CastableSpell,
  LegalSpellTargets,
  SpellTarget,
} from './duel-session';
import type { ArenaInteraction, CellMark } from '@/phaser/interaction';
import { mountCommandBar, type CommandBar } from '@/ui/command-bar/command-bar';
import { mountOptionMenu, type OptionMenu, type MenuOption } from '@/ui/command-bar/option-menu';
import { mountEndScreen, type EndScreen } from '@/ui/end-screen';
import { mountConfirmDialog, type ConfirmDialog } from '@/ui/confirm-dialog';
import { cellOf } from '@/spatial/engine-positions';

const SIMPLE_ACTION_LABELS: Record<SimpleAction, string> = {
  dash: 'Dash',
  disengage: 'Disengage',
  dodge: 'Dodge',
};

// Bonus-action spells are listed in the Bonus menu alongside class features;
// this prefix tags them so a pick routes to the spell flow, not useOption.
const SPELL_OPTION_PREFIX = 'spell:';

// Attack is the first entry in the Actions menu (distinct from the
// self-targeted SimpleActions, since picking it starts target selection).
const ATTACK_ACTION_ID = 'attack';

// What the player is currently aiming. Move/attack target via the command-bar
// buttons; a spell that needs a target parks here while the player taps a cell.
type Pending =
  | { readonly kind: 'move' }
  | { readonly kind: 'attack' }
  | { readonly kind: 'spell'; readonly spellId: string; readonly slotLevel: number; readonly targeting: LegalSpellTargets };

// Ties the live duel together: the command bar (DOM) issues intents, the arena
// interaction channel shows the move/target overlay and reports cell taps, and
// the DuelSession is the brain. The controller is the only place that knows the
// current selection/aiming state.

export class DuelController {
  private pending: Pending | null = null;
  private readonly bar: CommandBar;
  private readonly menu: OptionMenu;
  private readonly confirm: ConfirmDialog;
  private endScreen?: EndScreen;
  private readonly unsubscribeDuel: () => void;

  constructor(
    private readonly duel: DuelSession,
    private readonly interaction: ArenaInteraction,
    private readonly gameRoot: HTMLElement,
    private readonly onNewDuel: () => void,
  ) {
    this.confirm = mountConfirmDialog(gameRoot);
    this.bar = mountCommandBar(gameRoot, {
      onMove: () => this.toggleSelect('move'),
      onActions: () => this.openActions(),
      onBonus: () => this.openBonus(),
      onSpells: () => this.openSpells(),
      onUndo: () => {
        this.clearSelection();
        this.duel.undo();
      },
      onEndTurn: () => {
        this.clearSelection();
        void this.duel.endTurn();
      },
      onQuit: () => this.confirmQuit(),
    });
    this.menu = mountOptionMenu(gameRoot);
    this.interaction.setClickHandler((col, row) => void this.onCellClick(col, row));
    this.unsubscribeDuel = this.duel.onChange(() => this.refresh());
    this.refresh();
  }

  // Quit confirmation: abandons the run and returns to the start menu, which
  // reopens pre-filled with this run's settings (same path as "New Duel").
  private confirmQuit(): void {
    this.confirm.open({
      title: 'Quit duel?',
      message: 'Are you sure? This run will be abandoned and you will return to the menu.',
      confirmLabel: 'Quit',
      onConfirm: () => this.onNewDuel(),
    });
  }

  teardown(): void {
    this.unsubscribeDuel();
    this.interaction.setClickHandler(undefined);
    this.interaction.clearMarks();
    this.menu.unmount();
    this.confirm.unmount();
    this.endScreen?.unmount();
    this.bar.unmount();
  }

  private toggleSelect(mode: 'move' | 'attack'): void {
    if (this.duel.phase() !== 'player') return;
    this.menu.hide();
    this.pending = this.pending?.kind === mode ? null : { kind: mode };
    this.syncMarks();
    this.refresh();
  }

  // --- Actions menu (Dash / Disengage / Dodge) ---

  private openActions(): void {
    if (this.duel.phase() !== 'player') return;
    this.clearSelection();
    this.menu.show('Actions', this.actionOptions(), (id) => {
      // Attack starts target selection; the rest are self-targeted commits.
      if (id === ATTACK_ACTION_ID) {
        this.toggleSelect('attack');
        return;
      }
      void this.duel.commitAction(id as SimpleAction);
    });
  }

  private actionOptions(): MenuOption[] {
    const out: MenuOption[] = [this.attackOption()];
    for (const available of this.duel.availableActions()) {
      if (available.action !== 'dash' && available.action !== 'disengage' && available.action !== 'dodge') continue;
      out.push({
        id: available.action,
        label: SIMPLE_ACTION_LABELS[available.action],
        enabled: available.enabled,
        hint: available.reason ? available.reason.replace(/-/g, ' ') : undefined,
      });
    }
    return out;
  }

  // Attack as an Actions entry: usable when the action is unspent and a target
  // is in range; picking it starts the target-selection flow (see openActions).
  private attackOption(): MenuOption {
    const actionAvailable = this.duel.economy()?.actionAvailable ?? false;
    const hasTarget = this.duel.attackTargets().length > 0;
    const reason = !actionAvailable ? 'no action' : !hasTarget ? 'no target in range' : undefined;
    return { id: ATTACK_ACTION_ID, label: 'Attack', enabled: actionAvailable && hasTarget, hint: reason };
  }

  // --- Spells menu (action-cost spells) ---

  private openSpells(): void {
    if (this.duel.phase() !== 'player') return;
    this.clearSelection();
    const spells = this.actionSpells();
    this.menu.show(
      'Spells',
      spells.map((spell) => this.spellOption(spell, spell.spellId)),
      (spellId) => this.chooseSpell(spellId),
    );
  }

  // --- Bonus Actions menu (class features + bonus-action spells) ---

  private openBonus(): void {
    if (this.duel.phase() !== 'player') return;
    this.clearSelection();
    const options: MenuOption[] = this.duel.bonusActions().map((option) => ({
      id: option.id,
      label: option.label,
      enabled: option.enabled,
      hint: option.reason ? option.reason.replace(/-/g, ' ') : undefined,
    }));
    for (const spell of this.bonusSpells()) {
      options.push(this.spellOption(spell, `${SPELL_OPTION_PREFIX}${spell.spellId}`));
    }
    this.menu.show('Bonus Actions', options, (id) => {
      if (id.startsWith(SPELL_OPTION_PREFIX)) {
        this.chooseSpell(id.slice(SPELL_OPTION_PREFIX.length));
        return;
      }
      this.useBonusOption(id);
    });
  }

  private useBonusOption(optionId: string): void {
    const option = this.duel.bonusActions().find((o) => o.id === optionId);
    if (!option) return;
    // 1v1: a creature-target bonus action targets the lone opponent.
    const targetId = option.target === 'creature' ? this.duel.enemyId : undefined;
    void this.duel.commitOption(optionId, targetId);
  }

  // Pick a spell: cast self-targeted spells immediately; otherwise park in
  // targeting mode and highlight the legal targets/cells.
  private chooseSpell(spellId: string): void {
    const spell = this.duel.castableSpells().find((s) => s.spellId === spellId);
    if (!spell || spell.levelOptions.length === 0) return;
    const slotLevel = Math.min(...spell.levelOptions);
    const targeting = this.duel.legalSpellTargets(spellId, slotLevel);
    if (targeting.kind === 'self') {
      void this.castSpell(spellId, slotLevel, { targetIds: [this.duel.playerId] });
      return;
    }
    if (
      (targeting.kind === 'creatures' && targeting.candidates.length === 0) ||
      (targeting.kind === 'points' && targeting.cells.length === 0)
    ) {
      return; // nothing legal to target
    }
    this.pending = { kind: 'spell', spellId, slotLevel, targeting };
    this.syncMarks();
    this.refresh();
  }

  private spellOption(spell: CastableSpell, id: string): MenuOption {
    const suffix = spell.castingTime === 'action' ? '' : ` (${spell.castingTime.replace('-', ' ')})`;
    return { id, label: `${this.duel.spellName(spell.spellId)}${suffix}`, enabled: true };
  }

  private actionSpells(): readonly CastableSpell[] {
    return this.duel.castableSpells().filter((s) => s.castingTime === 'action' || s.castingTime === 'other');
  }

  private bonusSpells(): readonly CastableSpell[] {
    return this.duel.castableSpells().filter((s) => s.castingTime === 'bonus-action');
  }

  private clearSelection(): void {
    this.pending = null;
    this.interaction.clearMarks();
    this.menu.hide();
  }

  private syncMarks(): void {
    const cellSize = this.duel.cellSizeFeet;
    if (!this.pending) {
      this.interaction.clearMarks();
      return;
    }
    if (this.pending.kind === 'move') {
      this.interaction.setMarks(
        this.duel.moveDestinations().map((d): CellMark => ({ ...cellOf(d.position, cellSize), kind: 'move' })),
      );
      return;
    }
    if (this.pending.kind === 'attack') {
      this.interaction.setMarks(this.targetMarks(this.duel.attackTargets()));
      return;
    }
    const targeting = this.pending.targeting;
    if (targeting.kind === 'creatures') {
      this.interaction.setMarks(this.targetMarks(targeting.candidates));
    } else if (targeting.kind === 'points') {
      this.interaction.setMarks(
        targeting.cells.map((cell): CellMark => ({ ...cellOf(cell, cellSize), kind: 'target' })),
      );
    } else {
      this.interaction.clearMarks();
    }
  }

  private targetMarks(candidates: ReadonlyArray<{ readonly position?: { x: number; y: number } }>): CellMark[] {
    const cellSize = this.duel.cellSizeFeet;
    const marks: CellMark[] = [];
    for (const candidate of candidates) {
      if (!candidate.position) continue;
      marks.push({ ...cellOf(candidate.position, cellSize), kind: 'target' });
    }
    return marks;
  }

  private async onCellClick(col: number, row: number): Promise<void> {
    if (this.duel.phase() !== 'player' || !this.pending) return;
    const cellSize = this.duel.cellSizeFeet;
    const at = (pos: { x: number; y: number }): boolean => {
      const cell = cellOf(pos, cellSize);
      return cell.col === col && cell.row === row;
    };

    if (this.pending.kind === 'move') {
      const dest = this.duel.moveDestinations().find((d) => at(d.position));
      if (!dest) return;
      this.clearSelection();
      await this.duel.commitMove(dest.position);
      return;
    }
    if (this.pending.kind === 'attack') {
      const target = this.duel.attackTargets().find((t) => t.position && at(t.position));
      if (!target) return;
      this.clearSelection();
      await this.duel.commitAttack(target.combatantId);
      return;
    }
    // Spell targeting.
    const { spellId, slotLevel, targeting } = this.pending;
    if (targeting.kind === 'creatures') {
      const target = targeting.candidates.find((c) => c.position && at(c.position));
      if (!target) return;
      this.clearSelection();
      await this.castSpell(spellId, slotLevel, { targetIds: [target.combatantId] });
    } else if (targeting.kind === 'points') {
      const point = targeting.cells.find((cell) => at(cell));
      if (!point) return;
      this.clearSelection();
      await this.castSpell(spellId, slotLevel, { targetPosition: point });
    }
  }

  // Cast a spell and, if the engine refuses it (no slot, action already used,
  // concentration, etc.), pop the reason as red floating text above the player.
  private async castSpell(spellId: string, slotLevel: number, target: SpellTarget): Promise<void> {
    const outcome = await this.duel.commitSpell(spellId, slotLevel, target);
    if (!outcome.ok && outcome.reason) {
      this.interaction.emitNotice({ subjectId: this.duel.playerId, label: outcome.reason, tone: 'error' });
    }
  }

  private refresh(): void {
    const phase = this.duel.phase();
    // Show the Victory/Defeat screen once the duel ends.
    if (phase === 'over' && !this.endScreen) {
      this.endScreen = mountEndScreen(this.gameRoot, this.duel.outcome(), this.onNewDuel);
    }
    if (phase !== 'player') this.clearSelection();
    const economy = this.duel.economy();
    // "Has acted" = moved at all, or spent the action or bonus action. Used to
    // suggest ending the turn. Null economy (not the player's turn) reads as
    // not-acted, so the highlight is confined to the player's own turn.
    const hasActed = economy
      ? economy.movement.remainingFeet < economy.movement.totalFeet ||
        !economy.actionAvailable ||
        !economy.bonusActionAvailable
      : false;
    const selecting = this.pending?.kind === 'move' ? 'move' : null;
    this.bar.render({
      phase,
      movementText: economy ? `Move ${economy.movement.remainingFeet}/${economy.movement.totalFeet} ft` : '',
      action: economy?.actionAvailable ?? false,
      bonus: economy?.bonusActionAvailable ?? false,
      reaction: economy?.reactionAvailable ?? false,
      canMove: phase === 'player' && this.duel.moveDestinations().length > 0,
      canActions: phase === 'player' && this.actionOptions().some((option) => option.enabled),
      canBonus:
        phase === 'player' &&
        (this.duel.bonusActions().some((option) => option.enabled) || this.bonusSpells().length > 0),
      canSpells: phase === 'player' && this.actionSpells().length > 0,
      canUndo: this.duel.canUndo(),
      hasActed,
      selecting,
    });
  }
}
