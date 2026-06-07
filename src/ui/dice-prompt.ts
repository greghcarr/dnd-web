import type { RollChoice } from '@/game/dice-source';

// Modal that asks the player for a physical die result. Driven by the
// engine's NeedRoll: one die at a time, labelled with what the roll is for.
// "Use app dice" hands the roll back to the engine (optionally for the rest
// of the duel). Overlays the arena.

export interface DicePrompt {
  ask(die: number, context: string | undefined): Promise<RollChoice>;
  unmount(): void;
}

export const mountDicePrompt = (parent: HTMLElement): DicePrompt => {
  const root = document.createElement('div');
  root.id = 'dice-prompt';
  root.hidden = true;
  root.innerHTML = `
    <div class="dice-card">
      <h2 class="dice-title"></h2>
      <p class="dice-context"></p>
      <input type="number" class="dice-input" min="1" inputmode="numeric" />
      <div class="dice-actions">
        <button type="button" class="dice-submit">Use my roll</button>
        <button type="button" class="dice-app">Use app dice</button>
      </div>
      <label class="dice-rest"><input type="checkbox" class="dice-rest-check" /> Use app dice for the rest of this duel</label>
    </div>
  `;
  parent.appendChild(root);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`dice-prompt: missing ${sel}`);
    return el;
  };
  const title = select('.dice-title');
  const context = select('.dice-context');
  const input = select<HTMLInputElement>('.dice-input');
  const submit = select<HTMLButtonElement>('.dice-submit');
  const appBtn = select<HTMLButtonElement>('.dice-app');
  const restCheck = select<HTMLInputElement>('.dice-rest-check');

  let resolver: ((choice: RollChoice) => void) | undefined;
  let sides = 20;

  const close = (choice: RollChoice): void => {
    root.hidden = true;
    const resolve = resolver;
    resolver = undefined;
    resolve?.(choice);
  };

  const trySubmit = (): void => {
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value) || value < 1 || value > sides) {
      input.focus();
      input.select();
      return;
    }
    close({ kind: 'value', value });
  };

  submit.addEventListener('click', trySubmit);
  appBtn.addEventListener('click', () => close({ kind: 'app', rest: restCheck.checked }));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') trySubmit();
  });

  return {
    ask(die, ctx) {
      sides = die;
      title.textContent = `Roll a d${die}`;
      context.textContent = ctx ? `for the ${ctx} roll` : '';
      input.value = '';
      input.max = String(die);
      restCheck.checked = false;
      root.hidden = false;
      input.focus();
      return new Promise<RollChoice>((resolve) => {
        resolver = resolve;
      });
    },
    unmount() {
      // Resolve any in-flight prompt so its awaiter doesn't hang on teardown.
      resolver?.({ kind: 'app', rest: true });
      root.remove();
    },
  };
};
