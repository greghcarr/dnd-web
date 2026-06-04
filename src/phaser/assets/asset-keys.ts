// Texture keys and their sources, plus the sprite-resolution rule. v1
// maps the engine's many classes/species onto the available art coarsely
// (humans for PCs, orcs for monsters) and distinguishes teams with a
// colored ring rather than per-class sprites. When richer art is added,
// only this file and the Boot scene preload list change.

import { CHARACTER_FRAME_PX } from '@/constants/layout';

export const CHARACTER_FRAME_SIZE = CHARACTER_FRAME_PX;

// Direction rows in the 4-row idle sheets. Both the human and orc packs
// place the left-facing pose in row 2, so the arena uses that row and
// mirrors it for the right-facing team (see TokenView).
export const SIDE_FACING_ROW = 2;

// The one fully-opaque, seamlessly tileable grass tile; laid on every
// cell so the floor is continuous. The other land tiles carry
// transparency and are used only as sparse decor on top.
export const GROUND_KEY = 'ground';
export const GROUND_SOURCE = '/assets/tiles/tropical/land_1.png';

// Bush / foliage overlays scattered sparsely on top of the ground.
export const DECOR_SOURCES: Readonly<Record<string, string>> = {
  'decor-0': '/assets/tiles/tropical/land_2.png',
  'decor-1': '/assets/tiles/tropical/land_3.png',
  'decor-2': '/assets/tiles/tropical/land_4.png',
};
export const DECOR_KEYS = Object.keys(DECOR_SOURCES);

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
