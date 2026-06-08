// The player's turn resources (remaining movement, action / bonus / reaction
// pips), shown as a small HUD strip just below the turn banner at the top of
// the arena. Relocated out of the command bar so the turn info reads together
// at the top. Driven by the duel controller via render(); hidden when it isn't
// the player's turn.

export interface TurnEconomyView {
  readonly visible: boolean;
  readonly movementText: string;
  readonly action: boolean;
  readonly bonus: boolean;
  readonly reaction: boolean;
}

export interface TurnEconomy {
  render(view: TurnEconomyView): void;
  unmount(): void;
}

export const mountTurnEconomy = (parent: HTMLElement): TurnEconomy => {
  const el = document.createElement('div');
  el.id = 'turn-economy';
  el.hidden = true;
  el.innerHTML = `
    <span class="cmd-move-left"></span>
    <span class="cmd-pip" data-pip="action" title="Action">A</span>
    <span class="cmd-pip" data-pip="bonus" title="Bonus action">B</span>
    <span class="cmd-pip" data-pip="reaction" title="Reaction">R</span>
  `;
  parent.appendChild(el);

  const select = (sel: string): HTMLElement => {
    const found = el.querySelector<HTMLElement>(sel);
    if (!found) throw new Error(`turn-economy: missing ${sel}`);
    return found;
  };
  const moveLeftEl = select('.cmd-move-left');
  const actionPip = select('[data-pip="action"]');
  const bonusPip = select('[data-pip="bonus"]');
  const reactionPip = select('[data-pip="reaction"]');

  return {
    render(view: TurnEconomyView): void {
      el.hidden = !view.visible;
      moveLeftEl.textContent = view.movementText;
      actionPip.classList.toggle('spent', !view.action);
      bonusPip.classList.toggle('spent', !view.bonus);
      reactionPip.classList.toggle('spent', !view.reaction);
    },
    unmount(): void {
      el.remove();
    },
  };
};
