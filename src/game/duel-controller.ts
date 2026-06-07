import type { DuelSession, DuelPhase } from './duel-session';
import type { DuelOutcome } from './outcome';
import type { ArenaInteraction, CellMark } from '@/phaser/interaction';
import { mountCommandBar, type CommandBar } from '@/ui/command-bar/command-bar';
import { mountEndScreen, type EndScreen } from '@/ui/end-screen';
import { cellOf } from '@/spatial/engine-positions';

// Ties the live duel together: the command bar (DOM) issues intents, the
// arena interaction channel shows the green move / red target overlay and
// reports cell taps, and the DuelSession is the brain. The controller is the
// only place that knows the current selection mode (move vs attack vs idle).

const statusText = (phase: DuelPhase, outcome: DuelOutcome): string => {
  switch (phase) {
    case 'player':
      return 'Your turn';
    case 'busy':
      return '…';
    case 'enemy':
      return 'Enemy turn…';
    case 'over':
      return outcome === 'victory' ? 'Victory!' : 'Defeat';
  }
};

export class DuelController {
  private selecting: 'move' | 'attack' | null = null;
  private readonly bar: CommandBar;
  private endScreen?: EndScreen;
  private readonly unsubscribeDuel: () => void;

  constructor(
    private readonly duel: DuelSession,
    private readonly interaction: ArenaInteraction,
    private readonly gameRoot: HTMLElement,
    private readonly onNewDuel: () => void,
  ) {
    this.bar = mountCommandBar(gameRoot, {
      onMove: () => this.toggleSelect('move'),
      onAttack: () => this.toggleSelect('attack'),
      onEndTurn: () => {
        this.clearSelection();
        void this.duel.endTurn();
      },
    });
    this.interaction.setClickHandler((col, row) => void this.onCellClick(col, row));
    this.unsubscribeDuel = this.duel.onChange(() => this.refresh());
    this.refresh();
  }

  teardown(): void {
    this.unsubscribeDuel();
    this.interaction.setClickHandler(undefined);
    this.interaction.clearMarks();
    this.endScreen?.unmount();
    this.bar.unmount();
  }

  private toggleSelect(mode: 'move' | 'attack'): void {
    if (this.duel.phase() !== 'player') return;
    this.selecting = this.selecting === mode ? null : mode;
    this.syncMarks();
    this.refresh();
  }

  private clearSelection(): void {
    this.selecting = null;
    this.interaction.clearMarks();
  }

  private syncMarks(): void {
    const cellSize = this.duel.cellSizeFeet;
    if (this.selecting === 'move') {
      this.interaction.setMarks(
        this.duel.moveDestinations().map((d): CellMark => ({ ...cellOf(d.position, cellSize), kind: 'move' })),
      );
    } else if (this.selecting === 'attack') {
      const marks: CellMark[] = [];
      for (const target of this.duel.attackTargets()) {
        if (!target.position) continue;
        marks.push({ ...cellOf(target.position, cellSize), kind: 'target' });
      }
      this.interaction.setMarks(marks);
    } else {
      this.interaction.clearMarks();
    }
  }

  private async onCellClick(col: number, row: number): Promise<void> {
    if (this.duel.phase() !== 'player' || !this.selecting) return;
    const cellSize = this.duel.cellSizeFeet;
    if (this.selecting === 'move') {
      const dest = this.duel
        .moveDestinations()
        .find((d) => cellOf(d.position, cellSize).col === col && cellOf(d.position, cellSize).row === row);
      if (!dest) return;
      this.clearSelection();
      await this.duel.commitMove(dest.position);
    } else {
      const target = this.duel.attackTargets().find((t) => {
        if (!t.position) return false;
        const cell = cellOf(t.position, cellSize);
        return cell.col === col && cell.row === row;
      });
      if (!target) return;
      this.clearSelection();
      await this.duel.commitAttack(target.combatantId);
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
    this.bar.render({
      phase,
      statusText: statusText(phase, this.duel.outcome()),
      movementText: economy ? `Move ${economy.movement.remainingFeet}/${economy.movement.totalFeet} ft` : '',
      action: economy?.actionAvailable ?? false,
      bonus: economy?.bonusActionAvailable ?? false,
      reaction: economy?.reactionAvailable ?? false,
      canMove: phase === 'player' && this.duel.moveDestinations().length > 0,
      canAttack: phase === 'player' && this.duel.attackTargets().length > 0 && (economy?.actionAvailable ?? false),
      selecting: this.selecting,
    });
  }
}
