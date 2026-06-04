// App-level identity and fuzz-scenario defaults. The fuzz knobs mirror
// the engine's runBattle options; their literal unions are duplicated
// here so this module stays free of an engine import. The engine-bridge
// asserts they stay assignable to the engine's own FuzzVs / FuzzRest.

export const APP_VERSION = '0.1.0-pre-alpha';

export type FuzzMode = '1v1' | '2v2';
export type FuzzVsKind = 'pc' | 'monster';
export type FuzzRestKind = 'none' | 'short' | 'long';

export const DEFAULT_SEED = 42;
export const DEFAULT_LEVEL = 1;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;

export const DEFAULT_MODE: FuzzMode = '1v1';
export const DEFAULT_VS: FuzzVsKind = 'pc';
export const DEFAULT_REST: FuzzRestKind = 'none';

export const TEAM_SIZE_1V1 = 1;
export const TEAM_SIZE_2V2 = 2;
