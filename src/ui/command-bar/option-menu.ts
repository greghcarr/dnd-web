// A small popup menu shown above the command bar: a titled list of options
// (Actions now; Spells / Bonus once the engine exposes their affordances).
// Reusable so every sub-menu looks and behaves the same. Tapping the backdrop
// or an option closes it.

export interface MenuOption {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly hint?: string;
}

export interface OptionMenu {
  show(title: string, options: ReadonlyArray<MenuOption>, onPick: (id: string) => void): void;
  hide(): void;
  isOpen(): boolean;
  unmount(): void;
}

export const mountOptionMenu = (parent: HTMLElement): OptionMenu => {
  const root = document.createElement('div');
  root.id = 'option-menu';
  root.hidden = true;
  parent.appendChild(root);

  // Tapping the backdrop (not the card) closes the menu.
  root.addEventListener('pointerdown', (event) => {
    if (event.target === root) hide();
  });

  function hide(): void {
    root.hidden = true;
    root.replaceChildren();
  }

  return {
    show(title, options, onPick) {
      const card = document.createElement('div');
      card.className = 'menu-card';
      const heading = document.createElement('div');
      heading.className = 'menu-title';
      heading.textContent = title;
      card.appendChild(heading);
      for (const option of options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-item';
        button.disabled = !option.enabled;
        button.textContent = !option.enabled && option.hint ? `${option.label} — ${option.hint}` : option.label;
        button.addEventListener('click', () => {
          hide();
          onPick(option.id);
        });
        card.appendChild(button);
      }
      root.replaceChildren(card);
      root.hidden = false;
    },
    hide,
    isOpen: () => !root.hidden,
    unmount() {
      root.remove();
    },
  };
};
