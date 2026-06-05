import './styles/app.css';
import {
  APP_VERSION,
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
import { mountTransportBar } from '@/ui/transport/transport-bar';
import { mountEventInspector } from '@/ui/inspector/event-inspector';
import { mountConfigBar } from '@/ui/inspector/config-bar';
import { mountNarratorConsole } from '@/ui/console/narrator-console';
import { mountModeSelector } from '@/ui/mode-selector';

// Composition root. Owns the engine bridge + replay store, boots the
// Phaser arena, and mounts the DOM panels (transport, narrator console,
// event inspector, config) against the store.

const applyLayoutVars = (): void => {
  document.documentElement.style.setProperty('--right-col', `${RIGHT_COL_PX}px`);
};

const setVersionBadge = (): void => {
  const badge = document.getElementById('version-badge');
  if (badge) badge.textContent = `dnd-web v${APP_VERSION}`;
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

const boot = (): void => {
  applyLayoutVars();
  setVersionBadge();

  const bridge = new EngineBridge();
  const config: BattleConfig = { ...DEFAULT_CONFIG };
  const store = new ReplayStore(bridge.startBattle(config));

  createGame('game-root', store);

  // Only the fuzz replay viewer exists today. Future modes (added to
  // APP_MODES) reuse the store/game/panels and would be swapped in here.
  mountModeSelector(requireElement('mode-selector'), DEFAULT_APP_MODE_ID, () => {});

  mountTransportBar(requireElement('transport'), store);
  mountNarratorConsole(requireElement('narrator-console'), store);
  mountEventInspector(requireElement('event-inspector'), store);

  const runBattle = (next: BattleConfig): void => {
    store.loadSession(bridge.startBattle(next));
  };
  mountConfigBar(requireElement('config-bar'), config, runBattle);
};

boot();
