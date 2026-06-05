// App-level identity and fuzz-scenario defaults. The fuzz knobs mirror
// the engine's runBattle options; their literal unions are duplicated
// here so this module stays free of an engine import. The engine-bridge
// asserts they stay assignable to the engine's own FuzzVs / FuzzRest.

export const APP_VERSION = '0.1.0-pre-alpha';

// Top-level app modes shown in the mode selector. The fuzz replay viewer
// is the only mode today; future modes (which reuse the replay viewer's
// components) are added here and handled in main's mode switch.
export interface AppMode {
  readonly id: string;
  readonly label: string;
}
export const APP_MODES: ReadonlyArray<AppMode> = [{ id: 'fuzz-replay', label: 'Fuzz Replay Viewer' }];
export const DEFAULT_APP_MODE_ID = 'fuzz-replay';

export type FuzzMode = '1v1' | '2v2';
export type FuzzVsKind = 'pc' | 'monster';

export const DEFAULT_SEED = 42;
export const DEFAULT_LEVEL = 1;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;

export const DEFAULT_MODE: FuzzMode = '1v1';
export const DEFAULT_VS: FuzzVsKind = 'pc';

export const TEAM_SIZE_1V1 = 1;
export const TEAM_SIZE_2V2 = 2;
