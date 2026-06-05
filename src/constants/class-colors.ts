// Per-class text colors for the battle log. Mirrored from the engine
// project's World-of-Warcraft-inspired class palette
// (dnd-srd-engine/dndbnb/src/lib/class-colors.ts); this is presentation
// data, kept in sync by hand. Each value is the bright accent shown as
// name text on the dark log background (the palette's `bg`, not its
// on-accent `fg`). Classes outside WoW (barbarian, bard, sorcerer) use
// theme-fitting stand-ins; anything unmapped falls back to deep purple.

const CLASS_TEXT_COLOR: Readonly<Record<string, string>> = {
  barbarian: '#C41E3A',
  bard: '#E5C16C',
  cleric: '#DCDCE0',
  druid: '#FF7C0A',
  fighter: '#C69B6D',
  monk: '#00C97A',
  paladin: '#F48CBA',
  ranger: '#AAD372',
  rogue: '#E8D14B',
  sorcerer: '#2E5CDB',
  warlock: '#9482C9',
  wizard: '#3FC7EB',
};

const CUSTOM_CLASS_TEXT_COLOR = '#A330C9';

export const classTextColor = (classId: string): string =>
  CLASS_TEXT_COLOR[classId] ?? CUSTOM_CLASS_TEXT_COLOR;
