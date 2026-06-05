import './styles/app.css';
import {
  VERSION_INDICATOR,
  DEFAULT_SEED,
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_VS,
  DEFAULT_APP_MODE_ID,
} from '@/constants/app';
import { RIGHT_COL_PX } from '@/constants/layout';
import { EngineBridge, type BattleConfig } from '@/engine/engine-bridge';
import { ReplayStore } from '@/engine/replay-store';
import { createGame } from '@/phaser/game';
import { mountModeSelector } from '@/ui/mode-selector';
import type { Mode, ModeContext } from '@/modes/mode';
import { fuzzReplayViewerMode } from '@/modes/fuzz-replay-viewer';
import type { FuzzMovement } from '@engine-fuzz';

// Composition root. Owns the shared infrastructure (engine bridge, replay
// store, Phaser arena) and switches between app modes, each of which
// builds its own side-panel content against the shared store.

const applyLayoutVars = (): void => {
  document.documentElement.style.setProperty('--right-col', `${RIGHT_COL_PX}px`);
};

const setVersionBadge = (): void => {
  const badge = document.getElementById('version-badge');
  if (badge) badge.textContent = VERSION_INDICATOR;
};

const requireElement = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} in index.html`);
  return el;
};

const DEFAULT_CONFIG: BattleConfig = {
  seed: DEFAULT_SEED,
  mode: DEFAULT_MODE,
  vs: DEFAULT_VS,
  level: DEFAULT_LEVEL,
  movement: 'none',
};

// Mode registry, keyed by the ids in APP_MODES. Both replay viewers reuse
// the same panels; they differ only in the movement kind of the battles
// they generate. Add future modes here.
interface ModeEntry {
  readonly mode: Mode;
  readonly movement: FuzzMovement;
}
const MODES: Readonly<Record<string, ModeEntry>> = {
  'fuzz-replay': { mode: fuzzReplayViewerMode, movement: 'none' },
  'tactical-replay': { mode: fuzzReplayViewerMode, movement: 'tactical' },
};

const boot = (): void => {
  applyLayoutVars();
  setVersionBadge();

  const bridge = new EngineBridge();
  let currentConfig: BattleConfig = { ...DEFAULT_CONFIG };
  let currentMovement: FuzzMovement = currentConfig.movement ?? 'none';
  const store = new ReplayStore(bridge.startBattle(currentConfig));

  createGame('game-root', store);

  const ctx: ModeContext = {
    store,
    bridge,
    content: requireElement('mode-content'),
    // The active mode owns the movement kind; the config bar never sets it,
    // so merge it in here and keep it across config changes.
    runBattle: (config) => {
      currentConfig = { ...config, movement: currentMovement };
      store.loadSession(bridge.startBattle(currentConfig));
    },
    getConfig: () => currentConfig,
  };

  let teardownMode: (() => void) | undefined;
  const switchMode = (modeId: string): void => {
    teardownMode?.();
    const entry = MODES[modeId] ?? MODES[DEFAULT_APP_MODE_ID]!;
    // Switching to a different movement kind reloads the battle so the arena
    // reflects the new mode immediately (same seed/level/etc.).
    if (entry.movement !== currentMovement) {
      currentMovement = entry.movement;
      currentConfig = { ...currentConfig, movement: currentMovement };
      store.loadSession(bridge.startBattle(currentConfig));
    }
    teardownMode = entry.mode.mount(ctx);
  };

  mountModeSelector(requireElement('mode-selector'), DEFAULT_APP_MODE_ID, switchMode);
  switchMode(DEFAULT_APP_MODE_ID);
};

boot();
