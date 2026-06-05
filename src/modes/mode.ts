// A top-level app mode. The shared infrastructure (replay store, engine
// bridge, Phaser arena) is created once; each mode owns the side-panel
// content it builds into ctx.content and returns a teardown. Future modes
// reuse the same store/bridge and any of the replay viewer's components.

import type { ReplayStore } from '@/engine/replay-store';
import type { EngineBridge, BattleConfig } from '@/engine/engine-bridge';

export interface ModeContext {
  readonly store: ReplayStore;
  readonly bridge: EngineBridge;
  /** Container in the side panel (below the mode selector) for this mode's UI. */
  readonly content: HTMLElement;
  /** Load a freshly generated battle into the shared store. */
  readonly runBattle: (config: BattleConfig) => void;
  /** The most recently applied battle config. */
  readonly getConfig: () => BattleConfig;
}

export interface Mode {
  /** Build the mode's UI; return a teardown that removes it. */
  readonly mount: (ctx: ModeContext) => () => void;
}
