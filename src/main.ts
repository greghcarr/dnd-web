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
};

// Mode registry, keyed by the ids in APP_MODES. Add future modes here.
const MODES: Readonly<Record<string, Mode>> = {
  'fuzz-replay': fuzzReplayViewerMode,
};

const boot = (): void => {
  applyLayoutVars();
  setVersionBadge();

  const bridge = new EngineBridge();
  let currentConfig: BattleConfig = { ...DEFAULT_CONFIG };
  const store = new ReplayStore(bridge.startBattle(currentConfig));

  createGame('game-root', store);

  const ctx: ModeContext = {
    store,
    bridge,
    content: requireElement('mode-content'),
    runBattle: (config) => {
      currentConfig = config;
      store.loadSession(bridge.startBattle(config));
    },
    getConfig: () => currentConfig,
  };

  let teardownMode: (() => void) | undefined;
  const switchMode = (modeId: string): void => {
    teardownMode?.();
    const mode = MODES[modeId] ?? fuzzReplayViewerMode;
    teardownMode = mode.mount(ctx);
  };

  mountModeSelector(requireElement('mode-selector'), DEFAULT_APP_MODE_ID, switchMode);
  switchMode(DEFAULT_APP_MODE_ID);
};

boot();
