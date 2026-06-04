// Texture keys and their sources, plus the sprite-resolution rule. v1
// maps the engine's many classes/species onto the available art coarsely
// (humans for PCs, orcs for monsters) and distinguishes teams with a
// colored ring rather than per-class sprites. When richer art is added,
// only this file and the Boot scene preload list change.

import { CHARACTER_FRAME_PX } from '@/constants/layout';

export const CHARACTER_FRAME_SIZE = CHARACTER_FRAME_PX;

// Direction rows in the 4-row idle sheets, per pack (they differ): the
// human pack is down/left/right/up, the orc pack is down/up/left/right.
// Tokens use the native directional row so the two sides face each other
// without mirroring.
export interface FacingRows {
  readonly left: number;
  readonly right: number;
}
const HUMAN_FACING_ROWS: FacingRows = { left: 1, right: 2 };
const ORC_FACING_ROWS: FacingRows = { left: 2, right: 3 };
const FACING_ROWS: Readonly<Record<string, FacingRows>> = {
  'char-male': HUMAN_FACING_ROWS,
  'char-female': HUMAN_FACING_ROWS,
  'char-orc1': ORC_FACING_ROWS,
  'char-orc2': ORC_FACING_ROWS,
  'char-orc3': ORC_FACING_ROWS,
};

export const facingRow = (spriteKey: string, facing: 'left' | 'right'): number =>
  (FACING_ROWS[spriteKey] ?? HUMAN_FACING_ROWS)[facing];

// The one fully-opaque, seamlessly tileable grass tile; laid on every
// cell so the floor is continuous.
export const GROUND_KEY = 'ground';
export const GROUND_SOURCE = '/assets/tiles/tropical/land_1.png';

// Scatter props (trees, bushes, stones). Each is authored at its own
// size, so heightTiles gives a target on-screen height in tiles and the
// scene scales to it preserving aspect, anchored at the prop's base.
export interface PropSpec {
  readonly key: string;
  readonly src: string;
  readonly heightTiles: number;
}

export const PROP_SPECS: ReadonlyArray<PropSpec> = [
  { key: 'tree-1', src: '/assets/tiles/props/tree_1.png', heightTiles: 1.9 },
  { key: 'tree-2', src: '/assets/tiles/props/tree_2.png', heightTiles: 1.8 },
  { key: 'bush-1', src: '/assets/tiles/props/greenery_1.png', heightTiles: 0.9 },
  { key: 'bush-2', src: '/assets/tiles/props/greenery_2.png', heightTiles: 0.8 },
  { key: 'bush-3', src: '/assets/tiles/props/greenery_3.png', heightTiles: 0.8 },
  { key: 'bush-4', src: '/assets/tiles/props/greenery_4.png', heightTiles: 0.7 },
  { key: 'bush-5', src: '/assets/tiles/props/greenery_5.png', heightTiles: 0.7 },
  { key: 'stone-1', src: '/assets/tiles/props/stones_1.png', heightTiles: 0.45 },
  { key: 'stone-2', src: '/assets/tiles/props/stones_2.png', heightTiles: 0.4 },
  { key: 'stone-3', src: '/assets/tiles/props/stones_3.png', heightTiles: 0.5 },
  { key: 'stone-4', src: '/assets/tiles/props/stones_4.png', heightTiles: 0.4 },
  { key: 'stone-5', src: '/assets/tiles/props/stones_5.png', heightTiles: 0.45 },
];

// Weighted draw pool: bushes and stones common, trees rare so they read
// as occasional landmarks rather than a forest.
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

// Character idle spritesheets (64x64 frames, 4 direction rows).
export const CHARACTER_SHEET_SOURCES: Readonly<Record<string, string>> = {
  'char-male': '/assets/characters/male/Sword_Idle_full.png',
  'char-female': '/assets/characters/female/Sword_Idle_full.png',
  'char-orc1': '/assets/characters/orc/orc1_idle_full.png',
  'char-orc2': '/assets/characters/orc/orc2_idle_full.png',
  'char-orc3': '/assets/characters/orc/orc3_idle_full.png',
};

const HUMAN_KEYS = ['char-male', 'char-female'] as const;
const ORC_KEYS = ['char-orc1', 'char-orc2', 'char-orc3'] as const;

export type CharacterKind = 'pc' | 'npc' | 'creature';

// Resolve a sprite key from the character kind and a per-kind index so
// distinct combatants on a side get distinct looks.
export const spriteKeyFor = (kind: CharacterKind, index: number): string =>
  kind === 'creature'
    ? ORC_KEYS[index % ORC_KEYS.length]!
    : HUMAN_KEYS[index % HUMAN_KEYS.length]!;
