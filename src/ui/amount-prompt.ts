// Modal asking the player for an amount bounded 1..max (e.g. the HP a Paladin
// spends on Lay on Hands). Confirm resolves the number; Cancel (or Escape)
// resolves undefined. Overlays the arena, mirroring the dice prompt.

export interface AmountPrompt {
  ask(label: string, max: number): Promise<number | undefined>;
  unmount(): void;
}

export const mountAmountPrompt = (parent: HTMLElement): AmountPrompt => {
  const root = document.createElement('div');
  root.id = 'amount-prompt';
  root.hidden = true;
  root.innerHTML = `
    <div class="amount-card">
      <h2 class="amount-title"></h2>
      <p class="amount-context"></p>
      <input type="number" class="amount-input" min="1" inputmode="numeric" />
      <div class="amount-actions">
        <button type="button" class="amount-submit">Confirm</button>
        <button type="button" class="amount-cancel">Cancel</button>
      </div>
    </div>
  `;
  parent.appendChild(root);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`amount-prompt: missing ${sel}`);
    return el;
  };
  const title = select('.amount-title');
  const context = select('.amount-context');
  const input = select<HTMLInputElement>('.amount-input');
  const submit = select<HTMLButtonElement>('.amount-submit');
  const cancel = select<HTMLButtonElement>('.amount-cancel');

  let resolver: ((value: number | undefined) => void) | undefined;
  let max = 1;

  const close = (value: number | undefined): void => {
    root.hidden = true;
    const resolve = resolver;
    resolver = undefined;
    resolve?.(value);
  };

  const trySubmit = (): void => {
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value) || value < 1 || value > max) {
      input.focus();
      input.select();
      return;
    }
    close(value);
  };

  submit.addEventListener('click', trySubmit);
  cancel.addEventListener('click', () => close(undefined));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') trySubmit();
    if (event.key === 'Escape') close(undefined);
  });

  return {
    ask(label, maximum) {
      max = Math.max(1, maximum);
      title.textContent = label;
      context.textContent = `Choose an amount (1 to ${max})`;
      input.max = String(max);
      input.value = String(max);
      root.hidden = false;
      input.focus();
      input.select();
      return new Promise<number | undefined>((resolve) => {
        resolver = resolve;
      });
    },
    unmount() {
      // Resolve any in-flight prompt so its awaiter doesn't hang on teardown.
      resolver?.(undefined);
      root.remove();
    },
  };
};
