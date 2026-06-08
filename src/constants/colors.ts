// Colours are stored as 0xRRGGBB numbers for Phaser. cssHex() adapts a
// value for DOM/CSS usage so the same constant drives both surfaces.

export const cssHex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export const GROUND_BASE_COLOR = 0x2b2f3a;

export const TEAM_A_COLOR = 0x4a89ff;
export const TEAM_B_COLOR = 0xe7553c;

// A combatant's name label is outlined in their class's signature colour
// (the D&D Beyond class palette). Cleric's colour is white, which would
// vanish behind the white name text, so it outlines in black instead.
// Classless combatants (monsters in the replay viewers) fall back to their
// team colour. Keys are engine class ids (see DUEL_CLASS_IDS).
export const CLASS_NAME_OUTLINE_COLORS: Readonly<Record<string, number>> = {
  barbarian: 0xe7623e,
  bard: 0xab6dac,
  cleric: 0x000000,
  druid: 0x7a853b,
  fighter: 0x7f513e,
  monk: 0x51a5c5,
  paladin: 0xb59e54,
  ranger: 0x507f62,
  rogue: 0x555752,
  sorcerer: 0x992e2e,
  warlock: 0x7b469b,
  wizard: 0x2a50a1,
};

// Name badges on combatant tokens in the interactive duel: "1P" on the
// player (pure red), "CPU" on the opponent (gray); white text on both.
export const PLAYER_BADGE_BG_COLOR = 0xff0000;
export const CPU_BADGE_BG_COLOR = 0x6b7280;
export const BADGE_TEXT_COLOR = 0xffffff;

export const ACTIVE_RING_COLOR = 0xffd54a;
export const DOWNED_TINT = 0x555555;


export const HP_BAR_BG_COLOR = 0x202020;
export const HP_BAR_FILL_COLOR = 0x46c84a;
export const HP_BAR_LOW_COLOR = 0xe7553c;
export const HP_BAR_LOW_THRESHOLD = 0.3;

export const HIT_FLASH_COLOR = 0xffffff;

// Debug grid overlay (see SHOW_GRID in constants/layout.ts).
export const GRID_LINE_COLOR = 0x888888;
export const GRID_LINE_ALPHA = 0.55;
