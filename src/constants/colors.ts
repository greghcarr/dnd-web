// Colours are stored as 0xRRGGBB numbers for Phaser. cssHex() adapts a
// value for DOM/CSS usage so the same constant drives both surfaces.

export const cssHex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export const GROUND_BASE_COLOR = 0x2b2f3a;

export const TEAM_A_COLOR = 0x4a89ff;
export const TEAM_B_COLOR = 0xe7553c;

export const ACTIVE_RING_COLOR = 0xffd54a;
export const DOWNED_TINT = 0x555555;


export const HP_BAR_BG_COLOR = 0x202020;
export const HP_BAR_FILL_COLOR = 0x46c84a;
export const HP_BAR_LOW_COLOR = 0xe7553c;
export const HP_BAR_LOW_THRESHOLD = 0.3;

export const HIT_FLASH_COLOR = 0xffffff;
