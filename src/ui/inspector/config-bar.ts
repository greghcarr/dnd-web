// Config bar: the fuzz-scenario knobs (seed, mode, vs, level, rest) plus
// a "Run battle" button. Reads the inputs on run and hands a BattleConfig
// to the caller, which regenerates the session. These are exactly the
// engine runBattle options.

import type { BattleConfig } from '@/engine/engine-bridge';
import { LEVEL_MIN, LEVEL_MAX, type FuzzMode, type FuzzVsKind, type FuzzRestKind } from '@/constants/app';

export interface ConfigBar {
  readonly unmount: () => void;
}

const parseIntOr = (raw: string, fallback: number, min: number, max: number): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const mountConfigBar = (
  root: HTMLElement,
  initial: BattleConfig,
  onRun: (config: BattleConfig) => void,
): ConfigBar => {
  root.innerHTML = `
    <div class="config-grid">
      <label>Seed <input class="cfg-seed" type="number" min="0" step="1" /></label>
      <label>Mode
        <select class="cfg-mode">
          <option value="1v1">1v1</option>
          <option value="2v2">2v2</option>
        </select>
      </label>
      <label>Vs
        <select class="cfg-vs">
          <option value="pc">PC</option>
          <option value="monster">Monster</option>
        </select>
      </label>
      <label>Level <input class="cfg-level" type="number" min="${LEVEL_MIN}" max="${LEVEL_MAX}" step="1" /></label>
      <label>Rest
        <select class="cfg-rest">
          <option value="none">None</option>
          <option value="short">Short</option>
          <option value="long">Long</option>
        </select>
      </label>
    </div>
    <button type="button" class="cfg-run">Run battle</button>
  `;

  const seedInput = root.querySelector<HTMLInputElement>('.cfg-seed');
  const modeSelect = root.querySelector<HTMLSelectElement>('.cfg-mode');
  const vsSelect = root.querySelector<HTMLSelectElement>('.cfg-vs');
  const levelInput = root.querySelector<HTMLInputElement>('.cfg-level');
  const restSelect = root.querySelector<HTMLSelectElement>('.cfg-rest');
  const runBtn = root.querySelector<HTMLButtonElement>('.cfg-run');
  if (!seedInput || !modeSelect || !vsSelect || !levelInput || !restSelect || !runBtn) {
    throw new Error('config-bar: failed to mount template');
  }

  seedInput.value = String(initial.seed);
  modeSelect.value = initial.mode;
  vsSelect.value = initial.vs;
  levelInput.value = String(initial.level);
  restSelect.value = initial.rest;

  const readConfig = (): BattleConfig => ({
    seed: parseIntOr(seedInput.value, initial.seed, 0, Number.MAX_SAFE_INTEGER),
    mode: modeSelect.value as FuzzMode,
    vs: vsSelect.value as FuzzVsKind,
    level: parseIntOr(levelInput.value, initial.level, LEVEL_MIN, LEVEL_MAX),
    rest: restSelect.value as FuzzRestKind,
  });

  const run = (): void => {
    const config = readConfig();
    seedInput.value = String(config.seed);
    levelInput.value = String(config.level);
    onRun(config);
  };

  // Reload the encounter the moment any value changes. Selects fire
  // immediately; number inputs fire on commit (blur / Enter). The button
  // stays as an explicit re-roll for the same parameters.
  const controls = [seedInput, modeSelect, vsSelect, levelInput, restSelect];
  for (const control of controls) control.addEventListener('change', run);
  runBtn.addEventListener('pointerdown', run);

  return {
    unmount: () => {
      for (const control of controls) control.removeEventListener('change', run);
      runBtn.removeEventListener('pointerdown', run);
      root.replaceChildren();
    },
  };
};
