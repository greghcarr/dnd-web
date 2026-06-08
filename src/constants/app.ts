// App-level identity and fuzz-scenario defaults. The fuzz knobs mirror
// the engine's runBattle options; their literal unions are duplicated
// here so this module stays free of an engine import. The engine-bridge
// asserts they stay assignable to the engine's own FuzzVs / FuzzRest.

// App name + version derive from package.json at build time (vite
// `define` injects them; see vite.config.ts). This makes the two
// sources of truth (package.json + APP_VERSION) impossible to drift,
// replacing the prior hand-maintained string-literal convention.
export const APP_NAME = __APP_NAME__;
export const APP_VERSION = __APP_VERSION__;
export const ENGINE_VERSION = __ENGINE_VERSION__;
export const ENGINE_SHA = __ENGINE_SHA__;

// Composed indicator the version-badge renders. Format:
//   "<appName> <appVersion> / engine <engineVersion> (<engineSha>)"
// e.g. "dnd-web 0.2.0-pre-alpha / engine 0.4.0-alpha.0 (5b3e3c8)".
export const VERSION_INDICATOR =
  `${APP_NAME} ${APP_VERSION} / engine ${ENGINE_VERSION} (${ENGINE_SHA})`;

// Top-level app modes shown in the mode selector. The fuzz replay viewer
// is the only mode today; future modes (which reuse the replay viewer's
// components) are added here and handled in main's mode switch.
export interface AppMode {
  readonly id: string;
  readonly label: string;
}
export const APP_MODES: ReadonlyArray<AppMode> = [
  { id: 'fuzz-replay', label: 'Fuzz Replay Viewer' },
  { id: 'tactical-replay', label: 'Tactical Duel (movement)' },
  { id: 'interactive-duel', label: 'Interactive Duel (play)' },
];
export const DEFAULT_APP_MODE_ID = 'interactive-duel';

// The interactive, player-driven duel mode. Distinct from the replay
// viewers: it drives the engine live rather than scrubbing a finished log.
export const INTERACTIVE_DUEL_MODE_ID = 'interactive-duel';

export type FuzzMode = '1v1' | '2v2';
export type FuzzVsKind = 'pc' | 'monster';

export const DEFAULT_SEED = 42;
// The tactical mode opens on a livelier battle: seed 42 kites to a draw,
// whereas this one is a decisive duel with plenty of maneuvering. 42 stays
// the positionless default and golden test fixture.
export const TACTICAL_DEFAULT_SEED = 123;
export const DEFAULT_LEVEL = 1;
export const LEVEL_MIN = 1;
// The engine builds correct level/HP/proficiency/spell slots for all of
// 1-20. Characters above ~L6 are correctly leveled but under-featured
// (higher-level feature content is still being modeled in the pack); the
// engine's runBattle throws loudly if a future choice can't be auto-resolved
// rather than silently shipping an under-leveled character.
export const LEVEL_MAX = 20;
// The daily challenge is always this level (a fixed, shared higher-level duel).
export const DAILY_LEVEL = 5;

export const DEFAULT_MODE: FuzzMode = '1v1';
export const DEFAULT_VS: FuzzVsKind = 'pc';

// The base classes a Free Duel player can pin (engine slice 717's pinnable
// CLASS_POOLS set). A content pack may define others; only these are honored,
// so the class picker filters to them. A non-pinnable id falls back to random.
export const DUEL_CLASS_IDS: ReadonlyArray<string> = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
];

export const TEAM_SIZE_1V1 = 1;
export const TEAM_SIZE_2V2 = 2;
