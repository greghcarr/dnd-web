import type { DuelPhase } from '@/game/duel-session';

// The bottom-of-screen command bar for the interactive duel. Touch-first:
// large tap targets, overlays the arena, and the row wraps on narrow phones.
// Move / Attack are live; Actions / Bonus / Spells / Items are greyed
// scaffolds for the fuller action menu. The controller drives it via render().

export interface CommandBarView {
  readonly phase: DuelPhase;
  readonly statusText: string;
  readonly movementText: string;
  readonly action: boolean;
  readonly bonus: boolean;
  readonly reaction: boolean;
  readonly canMove: boolean;
  readonly canAttack: boolean;
  readonly selecting: 'move' | 'attack' | null;
}

export interface CommandBarHandlers {
  readonly onMove: () => void;
  readonly onAttack: () => void;
  readonly onEndTurn: () => void;
  readonly onNewDuel: () => void;
}

export interface CommandBar {
  render(view: CommandBarView): void;
  unmount(): void;
}

export const mountCommandBar = (parent: HTMLElement, handlers: CommandBarHandlers): CommandBar => {
  const bar = document.createElement('div');
  bar.id = 'command-bar';
  bar.innerHTML = `
    <div class="cmd-status">
      <span class="cmd-phase"></span>
      <span class="cmd-economy">
        <span class="cmd-move-left"></span>
        <span class="cmd-pip" data-pip="action" title="Action">A</span>
        <span class="cmd-pip" data-pip="bonus" title="Bonus action">B</span>
        <span class="cmd-pip" data-pip="reaction" title="Reaction">R</span>
      </span>
    </div>
    <div class="cmd-buttons">
      <button type="button" class="cmd-btn" data-cmd="move">Move</button>
      <button type="button" class="cmd-btn" data-cmd="attack">Attack</button>
      <button type="button" class="cmd-btn" disabled>Actions</button>
      <button type="button" class="cmd-btn" disabled>Bonus</button>
      <button type="button" class="cmd-btn" disabled>Spells</button>
      <button type="button" class="cmd-btn" disabled>Items</button>
      <button type="button" class="cmd-btn cmd-end" data-cmd="end">End Turn</button>
      <button type="button" class="cmd-btn cmd-new" data-cmd="new">New Duel</button>
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
  const endBtn = select<HTMLButtonElement>('[data-cmd="end"]');
  const newBtn = select<HTMLButtonElement>('[data-cmd="new"]');
  const phaseEl = select('.cmd-phase');
  const moveLeftEl = select('.cmd-move-left');
  const actionPip = select('[data-pip="action"]');
  const bonusPip = select('[data-pip="bonus"]');
  const reactionPip = select('[data-pip="reaction"]');

  moveBtn.addEventListener('click', handlers.onMove);
  attackBtn.addEventListener('click', handlers.onAttack);
  endBtn.addEventListener('click', handlers.onEndTurn);
  newBtn.addEventListener('click', handlers.onNewDuel);

  return {
    render(view: CommandBarView): void {
      // When the duel is over, the bar swaps the action buttons for New Duel
      // (CSS keys off this class).
      bar.classList.toggle('over', view.phase === 'over');
      phaseEl.textContent = view.statusText;
      moveLeftEl.textContent = view.movementText;
      actionPip.classList.toggle('spent', !view.action);
      bonusPip.classList.toggle('spent', !view.bonus);
      reactionPip.classList.toggle('spent', !view.reaction);
      moveBtn.disabled = !view.canMove;
      attackBtn.disabled = !view.canAttack;
      endBtn.disabled = view.phase !== 'player';
      moveBtn.classList.toggle('active', view.selecting === 'move');
      attackBtn.classList.toggle('active', view.selecting === 'attack');
    },
    unmount(): void {
      bar.remove();
    },
  };
};
