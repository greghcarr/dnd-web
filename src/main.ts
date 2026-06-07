import './styles/app.css';
import {
  VERSION_INDICATOR,
  DEFAULT_SEED,
  TACTICAL_DEFAULT_SEED,
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_VS,
  DEFAULT_APP_MODE_ID,
  INTERACTIVE_DUEL_MODE_ID,
} from '@/constants/app';
import { RIGHT_COL_PX } from '@/constants/layout';
import { EngineBridge, type BattleConfig } from '@/engine/engine-bridge';
import { ReplayStore } from '@/engine/replay-store';
import { SourceRouter } from '@/engine/source-router';
import { ArenaInteraction } from '@/phaser/interaction';
import { DuelSession } from '@/game/duel-session';
import { DuelController } from '@/game/duel-controller';
import type { RunConfig } from '@/game/run-config';
import { ManualDiceSource, SeededDiceSource } from '@/game/dice-source';
import { mountStartScreen } from '@/ui/start-screen';
import { mountDicePrompt } from '@/ui/dice-prompt';
import { createGame } from '@/phaser/game';
import { getBoolSetting, setBoolSetting, SettingKey } from '@/settings/settings';
import { mountModeSelector } from '@/ui/mode-selector';
import { mountEventInspector } from '@/ui/inspector/event-inspector';
import { mountNarratorConsole } from '@/ui/console/narrator-console';
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
// the same panels; they differ in the movement kind of the battles they
// generate and the seed each opens on. Add future modes here.
interface ModeEntry {
  readonly mode: Mode;
  readonly movement: FuzzMovement;
  readonly defaultSeed: number;
}
const MODES: Readonly<Record<string, ModeEntry>> = {
  'fuzz-replay': { mode: fuzzReplayViewerMode, movement: 'none', defaultSeed: DEFAULT_SEED },
  'tactical-replay': { mode: fuzzReplayViewerMode, movement: 'tactical', defaultSeed: TACTICAL_DEFAULT_SEED },
};

const boot = (): void => {
  applyLayoutVars();
  setVersionBadge();

  const bridge = new EngineBridge();
  let currentConfig: BattleConfig = { ...DEFAULT_CONFIG };
  let currentMovement: FuzzMovement = currentConfig.movement ?? 'none';
  const store = new ReplayStore(bridge.startBattle(currentConfig));

  // The arena subscribes to the router, not a concrete store, so modes can
  // point it at the replay store or a live duel without the scene caring.
  const router = new SourceRouter(store);
  // Shared channel for the live duel's cell overlay + tap input; inert until
  // a duel sets marks and a click handler on it.
  const interaction = new ArenaInteraction();
  const game = createGame('game-root', router);
  game.registry.set('interaction', interaction);

  // Immersive toggle: collapse the right column to give the arena the full
  // width (height on phones). Persisted; Phaser is told to re-fit on change.
  const layoutEl = requireElement('layout');
  const logsToggle = requireElement('logs-toggle');
  const applyLogsCollapsed = (collapsed: boolean): void => {
    layoutEl.classList.toggle('logs-collapsed', collapsed);
    logsToggle.textContent = collapsed ? '⟨' : '⟩';
    logsToggle.setAttribute('aria-label', collapsed ? 'Show logs' : 'Hide logs');
    game.scale.refresh();
  };
  let logsCollapsed = getBoolSetting(SettingKey.LogsCollapsed);
  applyLogsCollapsed(logsCollapsed);
  logsToggle.addEventListener('click', () => {
    logsCollapsed = !logsCollapsed;
    setBoolSetting(SettingKey.LogsCollapsed, logsCollapsed);
    applyLogsCollapsed(logsCollapsed);
  });

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

  // The interactive duel drives the engine live, so it points the arena at a
  // fresh LiveStore rather than the shared replay store. It is distinct
  // enough from the replay viewers to live in its own branch instead of the
  // MODES table. (Player controls and the start screen are later slices; for
  // now it stands up the live, set-up arena.)
  const mountDuel = (): (() => void) => {
    const gameRoot = requireElement('game-root');
    // Either the start screen or a running duel is active at a time; this
    // tears down whichever it is when the mode unmounts.
    let teardownActive: () => void = () => {};

    // Pre-duel menu: choose Daily / Free, then begin.
    function showStart(): void {
      const start = mountStartScreen(gameRoot, (config) => {
        start.unmount();
        teardownActive = runDuel(config);
      });
      teardownActive = () => start.unmount();
    }

    // A running duel: live store + right-column logs (same as the replay
    // viewers) + the command bar overlaying the arena. "New Duel" (shown on
    // game over) returns to the start screen.
    function runDuel(config: RunConfig): () => void {
      // Manual dice (player's own rolls) only in free duels; daily runs are
      // app-rolled. The prompt overlays the arena.
      const dicePrompt = mountDicePrompt(gameRoot);
      const dice = config.manualDice ? new ManualDiceSource(dicePrompt.ask) : new SeededDiceSource();
      const duel = new DuelSession(bridge, config, dice);
      router.setSource(duel.store);
      ctx.content.innerHTML = `
        <section id="event-inspector" class="panel" aria-label="Event log"></section>
        <section id="narrator-console" class="panel" aria-label="Battle narration"></section>
      `;
      const inspectorEl = ctx.content.querySelector<HTMLElement>('#event-inspector');
      const narratorEl = ctx.content.querySelector<HTMLElement>('#narrator-console');
      if (!inspectorEl || !narratorEl) throw new Error('interactive-duel: missing log panels');
      const inspector = mountEventInspector(inspectorEl, duel.store);
      const narrator = mountNarratorConsole(narratorEl, duel.store);
      const cleanup = (): void => {
        dicePrompt.unmount();
        inspector.unmount();
        narrator.unmount();
        ctx.content.replaceChildren();
      };
      const controller = new DuelController(duel, interaction, gameRoot, () => {
        controller.teardown();
        cleanup();
        showStart();
      });
      // If the enemy won initiative, this runs its turn(s) before the player's.
      void duel.begin();
      return () => {
        controller.teardown();
        cleanup();
      };
    }

    showStart();
    return () => teardownActive();
  };

  const switchMode = (modeId: string): void => {
    teardownMode?.();
    if (modeId === INTERACTIVE_DUEL_MODE_ID) {
      teardownMode = mountDuel();
      return;
    }
    // Replay viewers share the scrubbed store; point the arena back at it in
    // case we are leaving the live duel.
    router.setSource(store);
    const entry = MODES[modeId] ?? MODES[DEFAULT_APP_MODE_ID]!;
    // Switching to a different movement kind reloads the battle so the arena
    // reflects the new mode immediately, opening on that mode's default seed.
    if (entry.movement !== currentMovement) {
      currentMovement = entry.movement;
      currentConfig = { ...currentConfig, seed: entry.defaultSeed, movement: currentMovement };
      store.loadSession(bridge.startBattle(currentConfig));
    }
    teardownMode = entry.mode.mount(ctx);
  };

  mountModeSelector(requireElement('mode-selector'), DEFAULT_APP_MODE_ID, switchMode);
  switchMode(DEFAULT_APP_MODE_ID);
};

boot();
