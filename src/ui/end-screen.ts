import type { DuelOutcome } from '@/game/outcome';

// The post-duel screen: a centered Victory / Defeat card over the arena with
// a New Duel button back to the start menu. Shown by the controller when the
// duel ends.

export interface EndScreen {
  unmount(): void;
}

export const mountEndScreen = (
  parent: HTMLElement,
  outcome: DuelOutcome,
  onNewDuel: () => void,
): EndScreen => {
  const won = outcome === 'victory';
  const root = document.createElement('div');
  root.id = 'end-screen';
  root.innerHTML = `
    <div class="end-card">
      <h1 class="end-title ${won ? 'end-victory' : 'end-defeat'}">${won ? 'Victory!' : 'Defeat'}</h1>
      <p class="end-note">${won ? 'You felled your opponent.' : 'You fell in battle.'}</p>
      <button type="button" class="start-btn start-primary end-new">New Duel</button>
    </div>
  `;
  parent.appendChild(root);
  const button = root.querySelector<HTMLButtonElement>('.end-new');
  if (!button) throw new Error('end-screen: missing button');
  button.addEventListener('click', onNewDuel);

  return {
    unmount() {
      root.remove();
    },
  };
};
