import type { RunConfig } from '@/game/run-config';
import { dailySeed, dailyLabel } from '@/game/daily';
import { getBoolSetting, setBoolSetting, SettingKey } from '@/settings/settings';
import { LEVEL_MIN, LEVEL_MAX, DEFAULT_LEVEL, DAILY_LEVEL } from '@/constants/app';

// Pre-duel menu: pick the Daily Challenge (fixed UTC-date seed, app dice,
// the same battle for everyone today) or a Free Duel (random or typed seed,
// with the manual-dice option). Overlays the arena; calls onBegin with the
// chosen RunConfig.

const MAX_FREE_SEED = 1_000_000_000;
const randomSeed = (): number => Math.floor(Math.random() * MAX_FREE_SEED);

export interface StartScreen {
  unmount(): void;
}

export interface ClassOption {
  readonly id: string;
  readonly name: string;
}

export const mountStartScreen = (
  parent: HTMLElement,
  classes: ReadonlyArray<ClassOption>,
  onBegin: (config: RunConfig) => void,
): StartScreen => {
  const root = document.createElement('div');
  root.id = 'start-screen';
  root.innerHTML = `
    <div class="start-card">
      <h1 class="start-title">Tactical Duel</h1>
      <section class="start-section">
        <h2>Daily Challenge</h2>
        <p class="start-note">The same <span class="start-daily-level"></span> duel for everyone today (<span class="start-date"></span>). The app rolls the dice.</p>
        <button type="button" class="start-btn start-primary" data-start="daily">Start Daily Run</button>
      </section>
      <section class="start-section">
        <h2>Free Duel</h2>
        <label class="start-field">Class <select class="start-select start-class-select"></select></label>
        <label class="start-field">Level <select class="start-select start-level-select"></select></label>
        <div class="start-seed">
          <label>Seed <input type="number" class="start-seed-input" min="0" step="1" /></label>
          <button type="button" class="start-reroll" aria-label="Random seed" title="Random seed">⟳</button>
        </div>
        <label class="start-manual">
          <input type="checkbox" class="start-manual-check" />
          I'll provide my own dice rolls
        </label>
        <button type="button" class="start-btn" data-start="free">Start Free Duel</button>
      </section>
    </div>
  `;
  parent.appendChild(root);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`start-screen: missing ${sel}`);
    return el;
  };
  select('.start-date').textContent = dailyLabel();
  select('.start-daily-level').textContent = `Level ${DAILY_LEVEL}`;
  const seedInput = select<HTMLInputElement>('.start-seed-input');
  const manualCheck = select<HTMLInputElement>('.start-manual-check');
  const classSelect = select<HTMLSelectElement>('.start-class-select');
  const randomOption = document.createElement('option');
  randomOption.value = '';
  randomOption.textContent = 'Random';
  classSelect.appendChild(randomOption);
  for (const cls of classes) {
    const option = document.createElement('option');
    option.value = cls.id;
    option.textContent = cls.name;
    classSelect.appendChild(option);
  }

  const levelSelect = select<HTMLSelectElement>('.start-level-select');
  for (let level = LEVEL_MIN; level <= LEVEL_MAX; level += 1) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = `Level ${level}`;
    levelSelect.appendChild(option);
  }
  levelSelect.value = String(DEFAULT_LEVEL);
  seedInput.value = String(randomSeed());
  manualCheck.checked = getBoolSetting(SettingKey.ManualDice);

  select('.start-reroll').addEventListener('click', () => {
    seedInput.value = String(randomSeed());
  });
  select('[data-start="daily"]').addEventListener('click', () => {
    onBegin({ kind: 'daily', seed: dailySeed(), manualDice: false, level: DAILY_LEVEL });
  });
  select('[data-start="free"]').addEventListener('click', () => {
    const parsed = Number.parseInt(seedInput.value, 10);
    const seed = Number.isFinite(parsed) && parsed >= 0 ? parsed : randomSeed();
    const level = Number.parseInt(levelSelect.value, 10) || DEFAULT_LEVEL;
    const playerClass = classSelect.value || undefined;
    setBoolSetting(SettingKey.ManualDice, manualCheck.checked);
    onBegin({ kind: 'free', seed, manualDice: manualCheck.checked, level, playerClass });
  });

  return {
    unmount() {
      root.remove();
    },
  };
};
