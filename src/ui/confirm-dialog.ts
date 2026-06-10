// A small yes/no modal over the arena. Used to confirm destructive actions
// (e.g. quitting a duel). Tapping Cancel or the backdrop dismisses it; only
// the confirm button runs the callback.

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}

export interface ConfirmDialog {
  open(request: ConfirmRequest): void;
  unmount(): void;
}

export const mountConfirmDialog = (parent: HTMLElement): ConfirmDialog => {
  const root = document.createElement('div');
  root.id = 'confirm-dialog';
  root.hidden = true;
  parent.appendChild(root);

  const close = (): void => {
    root.hidden = true;
    root.replaceChildren();
  };
  // Tapping the backdrop (not the card) cancels.
  root.addEventListener('pointerdown', (event) => {
    if (event.target === root) close();
  });

  return {
    open({ title, message, confirmLabel, onConfirm }) {
      const card = document.createElement('div');
      card.className = 'confirm-card';
      const heading = document.createElement('h2');
      heading.className = 'confirm-title';
      heading.textContent = title;
      const body = document.createElement('p');
      body.className = 'confirm-message';
      body.textContent = message;
      const actions = document.createElement('div');
      actions.className = 'confirm-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'start-btn confirm-cancel';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', close);
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'start-btn confirm-yes';
      confirm.textContent = confirmLabel;
      confirm.addEventListener('click', () => {
        close();
        onConfirm();
      });
      actions.append(cancel, confirm);
      card.append(heading, body, actions);
      root.replaceChildren(card);
      root.hidden = false;
    },
    unmount() {
      root.remove();
    },
  };
};
