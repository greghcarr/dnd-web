// Top-level mode selector: a dropdown at the top of the side panel for
// choosing the app mode (currently just the fuzz replay viewer). Built
// from the APP_MODES registry so future modes appear automatically.

import { APP_MODES } from '@/constants/app';

export interface ModeSelector {
  readonly unmount: () => void;
}

export const mountModeSelector = (
  root: HTMLElement,
  currentId: string,
  onChange: (modeId: string) => void,
): ModeSelector => {
  const options = APP_MODES.map((mode) => `<option value="${mode.id}">${mode.label}</option>`).join('');
  root.innerHTML = `<select class="mode-select" aria-label="Mode">${options}</select>`;
  const select = root.querySelector<HTMLSelectElement>('.mode-select');
  if (!select) throw new Error('mode-selector: failed to mount template');
  select.value = currentId;

  const handler = (): void => onChange(select.value);
  select.addEventListener('change', handler);

  return {
    unmount: () => {
      select.removeEventListener('change', handler);
      root.replaceChildren();
    },
  };
};
