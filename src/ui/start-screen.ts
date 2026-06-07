import type { RunConfig } from '@/game/run-config';
import { dailySeed, dailyLabel } from '@/game/daily';
import { getBoolSetting, setBoolSetting, SettingKey } from '@/settings/settings';

// Pre-duel menu: pick the Daily Challenge (fixed UTC-date seed, app dice,
// the same battle for everyone today) or a Free Duel (random or typed seed,
// with the manual-dice option). Overlays the arena; calls onBegin with the
// chosen RunConfig.

const MAX_FREE_SEED = 1_000_000_000;
const randomSeed = (): number => Math.floor(Math.random() * MAX_FREE_SEED);

export interface StartScreen {
  unmount(): void;
}

export const mountStartScreen = (parent: HTMLElement, onBegin: (config: RunConfig) => void): StartScreen => {
  const root = document.createElement('div');
  root.id = 'start-screen';
  root.innerHTML = `
    <div class="start-card">
      <h1 class="start-title">Tactical Duel</h1>
      <section class="start-section">
        <h2>Daily Challenge</h2>
        <p class="start-note">The same duel for everyone today (<span class="start-date"></span>). The app rolls the dice.</p>
        <button type="button" class="start-btn start-primary" data-start="daily">Start Daily Run</button>
      </section>
      <section class="start-section">
        <h2>Free Duel</h2>
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
  const seedInput = select<HTMLInputElement>('.start-seed-input');
  const manualCheck = select<HTMLInputElement>('.start-manual-check');
  seedInput.value = String(randomSeed());
  manualCheck.checked = getBoolSetting(SettingKey.ManualDice);

  select('.start-reroll').addEventListener('click', () => {
    seedInput.value = String(randomSeed());
  });
  select('[data-start="daily"]').addEventListener('click', () => {
    onBegin({ kind: 'daily', seed: dailySeed(), manualDice: false });
  });
  select('[data-start="free"]').addEventListener('click', () => {
    const parsed = Number.parseInt(seedInput.value, 10);
    const seed = Number.isFinite(parsed) && parsed >= 0 ? parsed : randomSeed();
    setBoolSetting(SettingKey.ManualDice, manualCheck.checked);
    onBegin({ kind: 'free', seed, manualDice: manualCheck.checked });
  });

  return {
    unmount() {
      root.remove();
    },
  };
};
