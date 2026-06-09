import type { RunConfig } from '@/game/run-config';
import type { DuelCharacterOption } from '@/auth/characters';
import { dailySeed, dailyClass } from '@/game/daily';
import { getBoolSetting, setBoolSetting, SettingKey } from '@/settings/settings';
import { LEVEL_MIN, LEVEL_MAX, DEFAULT_LEVEL, DAILY_LEVEL, ENGINE_SRD_COMPLETE_LEVEL } from '@/constants/app';

// Pre-duel menu: one unified Tactical Duel form. The player picks class /
// level / seed / dice, or ticks "Daily challenge" to snap those to today's
// shared run and lock them. The daily is just a specific Free Duel (a pinned
// class + the date seed + DAILY_LEVEL, app-rolled), so picking the same class
// + level + seed manually reproduces it exactly; only the daily tick marks a
// run as the official daily (which is what would count for completion).
// Overlays the arena.

const MAX_FREE_SEED = 1_000_000_000;
const randomSeed = (): number => Math.floor(Math.random() * MAX_FREE_SEED);

// Trailing mark on each level option: a check for levels the engine guarantees
// SRD-complete, an exclamation for levels above that (where play is unverified).
const SRD_COMPLETE_MARK = '✓';
const SRD_INCOMPLETE_MARK = '❗';

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
  readonly characterId: string;
}

export const mountStartScreen = (
  parent: HTMLElement,
  classes: ReadonlyArray<ClassOption>,
  dailyHero: string,
  loadCharacters: () => Promise<DuelCharacterOption[]>,
  initial: RunConfig | undefined,
  onBegin: (config: RunConfig) => void,
): StartScreen => {
  const root = document.createElement('div');
  root.id = 'start-screen';
  root.innerHTML = `
    <div class="start-card">
      <h1 class="start-title">Tactical Duel</h1>
      <label class="start-field">Name <input type="text" class="start-name-input" maxlength="20" placeholder="Aria" /></label>
      <label class="start-field">Class <select class="start-select start-class-select"></select></label>
      <div class="start-level-group">
        <label class="start-field">Level <select class="start-select start-level-select"></select></label>
        <p class="start-level-warning"></p>
      </div>
      <label class="start-field start-character-field" hidden>Character <select class="start-select start-character-select"></select></label>
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
  const nameInput = select<HTMLInputElement>('.start-name-input');
  const classSelect = select<HTMLSelectElement>('.start-class-select');
  const levelSelect = select<HTMLSelectElement>('.start-level-select');
  const seedInput = select<HTMLInputElement>('.start-seed-input');
  const reroll = select<HTMLButtonElement>('.start-reroll');
  const dailyCheck = select<HTMLInputElement>('.start-daily-check');
  const manualCheck = select<HTMLInputElement>('.start-manual-check');
  const levelWarning = select<HTMLElement>('.start-level-warning');
  const characterField = select<HTMLElement>('.start-character-field');
  const characterSelect = select<HTMLSelectElement>('.start-character-select');

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
    const mark = level <= ENGINE_SRD_COMPLETE_LEVEL ? SRD_COMPLETE_MARK : SRD_INCOMPLETE_MARK;
    option.textContent = `Level ${level} ${mark}`;
    levelSelect.appendChild(option);
  }

  // Character picker: a "generate" default plus the signed-in player's dndbnb
  // characters, loaded asynchronously. The field stays hidden in guest mode (or
  // when the account has no characters), so only signed-in players with saved
  // characters see it.
  const generateOption = document.createElement('option');
  generateOption.value = '';
  generateOption.textContent = 'Generate a random character';
  characterSelect.appendChild(generateOption);
  void loadCharacters().then((characters) => {
    if (!characterSelect.isConnected || characters.length === 0) return;
    for (const character of characters) {
      const option = document.createElement('option');
      option.value = character.id;
      option.textContent = character.label;
      characterSelect.appendChild(option);
    }
    characterField.hidden = false;
    // Restore a reopened run's pick once its option exists (free duels only).
    if (initial?.dndbnbCharacterId && !dailyCheck.checked && characters.some((c) => c.id === initial.dndbnbCharacterId)) {
      characterSelect.value = initial.dndbnbCharacterId;
    }
  });

  // Default the form to today's daily class + level (a familiar starting point)
  // but with a fresh random seed, so a default Begin is a daily-like free duel
  // rather than a replay of the fixed daily seed.
  classSelect.value = dailyClass();
  levelSelect.value = String(DAILY_LEVEL);
  seedInput.value = String(randomSeed());
  manualCheck.checked = getBoolSetting(SettingKey.ManualDice);
  select('.start-daily-desc').textContent = dailyHero;
  // Caveat shown only above the level the engine fully implements SRD class
  // features through (ENGINE_SRD_COMPLETE_LEVEL); above it play gets
  // increasingly unexpected.
  levelWarning.textContent =
    `This game will display increasingly unexpected results above level ${ENGINE_SRD_COMPLETE_LEVEL}. It is not recommended to play at these levels.`;
  const syncLevelWarning = (): void => {
    levelWarning.hidden = (Number.parseInt(levelSelect.value, 10) || 0) <= ENGINE_SRD_COMPLETE_LEVEL;
  };
  levelSelect.addEventListener('change', syncLevelWarning);
  syncLevelWarning();

  // Rows that lock (disabled + dimmed) while the daily tick is on.
  const lockRows: HTMLElement[] = [
    classSelect.closest('label')!,
    levelSelect.closest('label')!,
    characterField,
    select<HTMLElement>('.start-seed'),
    manualCheck.closest('label')!,
  ];
  const setLocked = (locked: boolean): void => {
    classSelect.disabled = locked;
    levelSelect.disabled = locked;
    characterSelect.disabled = locked;
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
        characterId: characterSelect.value,
      };
      // Snap to today's daily (a specific pinned-class Free Duel) and lock. The
      // daily uses its own generated character, so clear any picked one.
      classSelect.value = dailyClass();
      levelSelect.value = String(DAILY_LEVEL);
      seedInput.value = String(dailySeed());
      manualCheck.checked = false; // the daily is always app-rolled
      characterSelect.value = '';
      setLocked(true);
    } else {
      if (saved) {
        classSelect.value = saved.classId;
        levelSelect.value = saved.level;
        seedInput.value = saved.seed;
        manualCheck.checked = saved.manualDice;
        characterSelect.value = saved.characterId;
      }
      setLocked(false);
    }
    syncLevelWarning();
  });

  select('[data-start="begin"]').addEventListener('click', () => {
    // The name is cosmetic, so it applies to the daily too (it never changes
    // the battle); the daily stays the same run for everyone regardless.
    const playerName = nameInput.value.trim() || undefined;
    if (dailyCheck.checked) {
      // The official daily: built from the daily source (not the locked
      // fields), app-rolled, marked 'daily' so it counts for completion.
      onBegin({ kind: 'daily', seed: dailySeed(), manualDice: false, level: DAILY_LEVEL, playerClass: dailyClass(), playerName });
      return;
    }
    const parsed = Number.parseInt(seedInput.value, 10);
    const seed = Number.isFinite(parsed) && parsed >= 0 ? parsed : randomSeed();
    const level = Number.parseInt(levelSelect.value, 10) || DEFAULT_LEVEL;
    const playerClass = classSelect.value || undefined;
    const dndbnbCharacterId = characterSelect.value || undefined;
    setBoolSetting(SettingKey.ManualDice, manualCheck.checked);
    onBegin({ kind: 'free', seed, manualDice: manualCheck.checked, level, playerClass, playerName, dndbnbCharacterId });
  });

  // Reopening after a run (quit / finished): restore the fields to how that
  // run was configured. For a daily run, re-tick the box (its change handler
  // re-snaps and locks the fields to today's daily).
  if (initial) {
    nameInput.value = initial.playerName ?? '';
    classSelect.value = initial.playerClass ?? '';
    levelSelect.value = String(initial.level);
    seedInput.value = String(initial.seed);
    manualCheck.checked = initial.manualDice;
    syncLevelWarning();
    if (initial.kind === 'daily') {
      dailyCheck.checked = true;
      dailyCheck.dispatchEvent(new Event('change'));
    }
  }

  return {
    unmount() {
      root.remove();
    },
  };
};
