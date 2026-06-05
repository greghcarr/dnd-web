// Texture keys and their sources, plus the sprite-resolution rule. v1
// maps the engine's many classes/species onto the available art coarsely
// (humans for PCs, orcs for monsters) and distinguishes teams with a
// colored ring rather than per-class sprites.

// Asset URLs must include Vite's base path (import.meta.env.BASE_URL) so
// they resolve under a GitHub Pages project subpath (/<repo>/), not the
// domain root. The paths below are relative (no leading slash).
const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

// --- Direction rows -------------------------------------------------------
// The 4-row sheets order their directions differently per pack: the human
// pack is down/left/right/up, the orc pack is down/up/left/right. Tokens
// play the native directional row so the two sides face each other.
export interface FacingRows {
  readonly left: number;
  readonly right: number;
}
const HUMAN_FACING_ROWS: FacingRows = { left: 1, right: 2 };
const ORC_FACING_ROWS: FacingRows = { left: 2, right: 3 };

// --- Characters -----------------------------------------------------------
export const CHARACTER_KEYS = ['char-male', 'char-female', 'char-orc1', 'char-orc2', 'char-orc3'] as const;
export type CharacterKey = (typeof CHARACTER_KEYS)[number];

export const ANIM_TYPES = ['idle', 'attack', 'hurt', 'death'] as const;
export type AnimType = (typeof ANIM_TYPES)[number];

// Per-character animation spritesheets (each 64x64 frames, 4 direction
// rows). Texture keys are `${characterKey}-${animType}`.
export const ANIM_SHEETS: Readonly<Record<CharacterKey, Readonly<Record<AnimType, string>>>> = {
  'char-male': {
    idle: asset('assets/characters/male/Sword_Idle_full.png'),
    attack: asset('assets/characters/male/Sword_attack_full.png'),
    hurt: asset('assets/characters/male/Sword_Hurt_full.png'),
    death: asset('assets/characters/male/Sword_Death_full.png'),
  },
  'char-female': {
    idle: asset('assets/characters/female/Sword_Idle_full.png'),
    attack: asset('assets/characters/female/Sword_attack_full.png'),
    hurt: asset('assets/characters/female/Sword_Hurt_full.png'),
    death: asset('assets/characters/female/Sword_Death_full.png'),
  },
  'char-orc1': {
    idle: asset('assets/characters/orc/orc1_idle_full.png'),
    attack: asset('assets/characters/orc/orc1_attack_full.png'),
    hurt: asset('assets/characters/orc/orc1_hurt_full.png'),
    death: asset('assets/characters/orc/orc1_death_full.png'),
  },
  'char-orc2': {
    idle: asset('assets/characters/orc/orc2_idle_full.png'),
    attack: asset('assets/characters/orc/orc2_attack_full.png'),
    hurt: asset('assets/characters/orc/orc2_hurt_full.png'),
    death: asset('assets/characters/orc/orc2_death_full.png'),
  },
  'char-orc3': {
    idle: asset('assets/characters/orc/orc3_idle_full.png'),
    attack: asset('assets/characters/orc/orc3_attack_full.png'),
    hurt: asset('assets/characters/orc/orc3_hurt_full.png'),
    death: asset('assets/characters/orc/orc3_death_full.png'),
  },
};

const ORC_KEY_PREFIX = 'char-orc';

export const getFacingRows = (characterKey: string): FacingRows =>
  characterKey.startsWith(ORC_KEY_PREFIX) ? ORC_FACING_ROWS : HUMAN_FACING_ROWS;

// Idle strategy: rather than loop the full idle row (which turns the head
// to the camera and blinks in sync), tokens hold a "looking ahead" rest
// frame and only flash the blink frame occasionally on a per-token random
// timer. `rest` and `blink` are frame indices WITHIN the directional row.
// A pack with no usable blink frame (e.g. the 4-frame orc idle) just
// holds its rest pose.
export interface IdleConfig {
  readonly rest: number;
  readonly blink: ReadonlyArray<number>;
}
const HUMAN_IDLE: IdleConfig = { rest: 1, blink: [2] };
const ORC_IDLE: IdleConfig = { rest: 0, blink: [] };

export const idleConfig = (characterKey: string): IdleConfig =>
  characterKey.startsWith(ORC_KEY_PREFIX) ? ORC_IDLE : HUMAN_IDLE;

export const animTextureKey = (characterKey: string, anim: AnimType): string =>
  `${characterKey}-${anim}`;

export const animKey = (characterKey: string, anim: AnimType, facing: 'left' | 'right'): string =>
  `${characterKey}:${anim}:${facing}`;

const HUMAN_KEYS = ['char-male', 'char-female'] as const;
const ORC_KEYS = ['char-orc1', 'char-orc2', 'char-orc3'] as const;

export type CharacterKind = 'pc' | 'npc' | 'creature';

// Resolve a character key from the kind and a per-kind index so distinct
// combatants on a side get distinct looks.
export const spriteKeyFor = (kind: CharacterKind, index: number): CharacterKey =>
  kind === 'creature' ? ORC_KEYS[index % ORC_KEYS.length]! : HUMAN_KEYS[index % HUMAN_KEYS.length]!;

// --- Ground & props -------------------------------------------------------
export const GROUND_KEY = 'ground';
export const GROUND_SOURCE = asset('assets/tiles/tropical/land_1.png');

export interface PropSpec {
  readonly key: string;
  readonly src: string;
  readonly heightTiles: number;
}

export const PROP_SPECS: ReadonlyArray<PropSpec> = [
  { key: 'tree-1', src: asset('assets/tiles/props/tree_1.png'), heightTiles: 1.9 },
  { key: 'tree-2', src: asset('assets/tiles/props/tree_2.png'), heightTiles: 1.8 },
  { key: 'bush-1', src: asset('assets/tiles/props/greenery_1.png'), heightTiles: 0.9 },
  { key: 'bush-2', src: asset('assets/tiles/props/greenery_2.png'), heightTiles: 0.8 },
  { key: 'bush-3', src: asset('assets/tiles/props/greenery_3.png'), heightTiles: 0.8 },
  { key: 'bush-4', src: asset('assets/tiles/props/greenery_4.png'), heightTiles: 0.7 },
  { key: 'bush-5', src: asset('assets/tiles/props/greenery_5.png'), heightTiles: 0.7 },
  { key: 'stone-1', src: asset('assets/tiles/props/stones_1.png'), heightTiles: 0.45 },
  { key: 'stone-2', src: asset('assets/tiles/props/stones_2.png'), heightTiles: 0.4 },
  { key: 'stone-3', src: asset('assets/tiles/props/stones_3.png'), heightTiles: 0.5 },
  { key: 'stone-4', src: asset('assets/tiles/props/stones_4.png'), heightTiles: 0.4 },
  { key: 'stone-5', src: asset('assets/tiles/props/stones_5.png'), heightTiles: 0.45 },
];

export const PROP_WEIGHTS: Readonly<Record<string, number>> = {
  'tree-1': 1,
  'tree-2': 1,
  'bush-1': 4,
  'bush-2': 4,
  'bush-3': 4,
  'bush-4': 4,
  'bush-5': 4,
  'stone-1': 2,
  'stone-2': 2,
  'stone-3': 2,
  'stone-4': 2,
  'stone-5': 2,
};
