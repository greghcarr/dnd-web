import type { DuelPhase } from '@/game/duel-session';

// The bottom-of-screen command bar for the interactive duel. Touch-first:
// large tap targets, overlays the arena, and the row wraps on narrow phones.
// Move / Attack are live; Actions / Bonus / Spells / Items are greyed
// scaffolds for the fuller action menu. The controller drives it via render().

export interface CommandBarView {
  readonly phase: DuelPhase;
  readonly canMove: boolean;
  readonly canAttack: boolean;
  readonly canActions: boolean;
  readonly canBonus: boolean;
  readonly canSpells: boolean;
  readonly canUndo: boolean;
  // True once the player has taken any action this turn (moved, or spent their
  // action or bonus action), used to suggest ending the turn.
  readonly hasActed: boolean;
  readonly selecting: 'move' | 'attack' | null;
}

export interface CommandBarHandlers {
  readonly onMove: () => void;
  readonly onAttack: () => void;
  readonly onActions: () => void;
  readonly onBonus: () => void;
  readonly onSpells: () => void;
  readonly onUndo: () => void;
  readonly onEndTurn: () => void;
  readonly onQuit: () => void;
}

export interface CommandBar {
  render(view: CommandBarView): void;
  unmount(): void;
}

export const mountCommandBar = (parent: HTMLElement, handlers: CommandBarHandlers): CommandBar => {
  const bar = document.createElement('div');
  bar.id = 'command-bar';
  bar.innerHTML = `
    <div class="cmd-buttons">
      <button type="button" class="cmd-btn" data-cmd="move">Move</button>
      <button type="button" class="cmd-btn" data-cmd="attack">Attack</button>
      <button type="button" class="cmd-btn" data-cmd="actions">Actions</button>
      <button type="button" class="cmd-btn" data-cmd="bonus">Bonus</button>
      <button type="button" class="cmd-btn" data-cmd="spells">Spells</button>
      <button type="button" class="cmd-btn" disabled>Items</button>
      <button type="button" class="cmd-btn cmd-undo" data-cmd="undo">Undo</button>
      <button type="button" class="cmd-btn cmd-end" data-cmd="end">End Turn</button>
      <button type="button" class="cmd-btn cmd-quit" data-cmd="quit">Quit</button>
    </div>
  `;
  parent.appendChild(bar);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = bar.querySelector<T>(sel);
    if (!el) throw new Error(`command-bar: missing ${sel}`);
    return el;
  };
  const moveBtn = select<HTMLButtonElement>('[data-cmd="move"]');
  const attackBtn = select<HTMLButtonElement>('[data-cmd="attack"]');
  const actionsBtn = select<HTMLButtonElement>('[data-cmd="actions"]');
  const bonusBtn = select<HTMLButtonElement>('[data-cmd="bonus"]');
  const spellsBtn = select<HTMLButtonElement>('[data-cmd="spells"]');
  const undoBtn = select<HTMLButtonElement>('[data-cmd="undo"]');
  const endBtn = select<HTMLButtonElement>('[data-cmd="end"]');
  const quitBtn = select<HTMLButtonElement>('[data-cmd="quit"]');

  moveBtn.addEventListener('click', handlers.onMove);
  attackBtn.addEventListener('click', handlers.onAttack);
  actionsBtn.addEventListener('click', handlers.onActions);
  bonusBtn.addEventListener('click', handlers.onBonus);
  spellsBtn.addEventListener('click', handlers.onSpells);
  undoBtn.addEventListener('click', handlers.onUndo);
  endBtn.addEventListener('click', handlers.onEndTurn);
  // Quit is always available (no render() gating), so you can leave mid-turn.
  quitBtn.addEventListener('click', handlers.onQuit);

  return {
    render(view: CommandBarView): void {
      moveBtn.disabled = !view.canMove;
      attackBtn.disabled = !view.canAttack;
      actionsBtn.disabled = !view.canActions;
      bonusBtn.disabled = !view.canBonus;
      spellsBtn.disabled = !view.canSpells;
      undoBtn.disabled = !view.canUndo;
      endBtn.disabled = view.phase !== 'player';
      // Suggest ending the turn once the player has done anything this turn.
      endBtn.classList.toggle('suggested', view.hasActed);
      moveBtn.classList.toggle('active', view.selecting === 'move');
      attackBtn.classList.toggle('active', view.selecting === 'attack');
    },
    unmount(): void {
      bar.remove();
    },
  };
};
