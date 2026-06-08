import type { RunConfig } from '@/game/run-config';
import { dailySeed, dailyClass } from '@/game/daily';
import { getBoolSetting, setBoolSetting, SettingKey } from '@/settings/settings';
import { LEVEL_MIN, LEVEL_MAX, DEFAULT_LEVEL, DAILY_LEVEL } from '@/constants/app';

// Pre-duel menu: one unified Tactical Duel form. The player picks class /
// level / seed / dice, or ticks "Daily challenge" to snap those to today's
// shared run and lock them. The daily is just a specific Free Duel (a pinned
// class + the date seed + DAILY_LEVEL, app-rolled), so picking the same class
// + level + seed manually reproduces it exactly; only the daily tick marks a
// run as the official daily (which is what would count for completion).
// Overlays the arena.

const MAX_FREE_SEED = 1_000_000_000;
const randomSeed = (): number => Math.floor(Math.random() * MAX_FREE_SEED);

export interface StartScreen {
  unmount(): void;
}

export interface ClassOption {
  readonly id: string;
  readonly name: string;
}

// The player's field state, snapshotted when the daily tick locks the form so
// clearing the tick restores exactly what they had just before.
interface FormState {
  readonly classId: string;
  readonly level: string;
  readonly seed: string;
  readonly manualDice: boolean;
}

export const mountStartScreen = (
  parent: HTMLElement,
  classes: ReadonlyArray<ClassOption>,
  dailyHero: string,
  onBegin: (config: RunConfig) => void,
): StartScreen => {
  const root = document.createElement('div');
  root.id = 'start-screen';
  root.innerHTML = `
    <div class="start-card">
      <h1 class="start-title">Tactical Duel</h1>
      <label class="start-field">Class <select class="start-select start-class-select"></select></label>
      <label class="start-field">Level <select class="start-select start-level-select"></select></label>
      <div class="start-seed">
        <label>Seed <input type="number" class="start-seed-input" min="0" step="1" /></label>
        <button type="button" class="start-reroll" aria-label="Random seed" title="Random seed">⟳</button>
      </div>
      <label class="start-daily">
        <input type="checkbox" class="start-daily-check" />
        <span>Daily challenge (<span class="start-daily-desc"></span>)</span>
      </label>
      <label class="start-manual">
        <input type="checkbox" class="start-manual-check" />
        I'll provide my own dice rolls
      </label>
      <button type="button" class="start-btn start-primary" data-start="begin">Begin Duel</button>
    </div>
  `;
  parent.appendChild(root);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`start-screen: missing ${sel}`);
    return el;
  };
  const classSelect = select<HTMLSelectElement>('.start-class-select');
  const levelSelect = select<HTMLSelectElement>('.start-level-select');
  const seedInput = select<HTMLInputElement>('.start-seed-input');
  const reroll = select<HTMLButtonElement>('.start-reroll');
  const dailyCheck = select<HTMLInputElement>('.start-daily-check');
  const manualCheck = select<HTMLInputElement>('.start-manual-check');

  // Class dropdown: a random pick plus every pinnable class.
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
  for (let level = LEVEL_MIN; level <= LEVEL_MAX; level += 1) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = `Level ${level}`;
    levelSelect.appendChild(option);
  }

  levelSelect.value = String(DEFAULT_LEVEL);
  seedInput.value = String(randomSeed());
  manualCheck.checked = getBoolSetting(SettingKey.ManualDice);
  select('.start-daily-desc').textContent = dailyHero;

  // Rows that lock (disabled + dimmed) while the daily tick is on.
  const lockRows: HTMLElement[] = [
    classSelect.closest('label')!,
    levelSelect.closest('label')!,
    select<HTMLElement>('.start-seed'),
    manualCheck.closest('label')!,
  ];
  const setLocked = (locked: boolean): void => {
    classSelect.disabled = locked;
    levelSelect.disabled = locked;
    seedInput.disabled = locked;
    reroll.disabled = locked;
    manualCheck.disabled = locked;
    for (const row of lockRows) row.classList.toggle('start-locked', locked);
  };

  // Snapshot of the player's picks, captured when the daily tick locks the
  // form so clearing it restores exactly what they had.
  let saved: FormState | undefined;

  reroll.addEventListener('click', () => {
    seedInput.value = String(randomSeed());
  });

  dailyCheck.addEventListener('change', () => {
    if (dailyCheck.checked) {
      saved = {
        classId: classSelect.value,
        level: levelSelect.value,
        seed: seedInput.value,
        manualDice: manualCheck.checked,
      };
      // Snap to today's daily (a specific pinned-class Free Duel) and lock.
      classSelect.value = dailyClass();
      levelSelect.value = String(DAILY_LEVEL);
      seedInput.value = String(dailySeed());
      manualCheck.checked = false; // the daily is always app-rolled
      setLocked(true);
    } else {
      if (saved) {
        classSelect.value = saved.classId;
        levelSelect.value = saved.level;
        seedInput.value = saved.seed;
        manualCheck.checked = saved.manualDice;
      }
      setLocked(false);
    }
  });

  select('[data-start="begin"]').addEventListener('click', () => {
    if (dailyCheck.checked) {
      // The official daily: built from the daily source (not the locked
      // fields), app-rolled, marked 'daily' so it counts for completion.
      onBegin({ kind: 'daily', seed: dailySeed(), manualDice: false, level: DAILY_LEVEL, playerClass: dailyClass() });
      return;
    }
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
