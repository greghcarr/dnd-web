// Animation and playback timing, plus the scrub cache bound.

export const STEP_DELAY_MS = 350;

export const HP_TWEEN_MS = 200;
export const HIT_FLASH_MS = 140;
export const TOKEN_FADE_MS = 200;

// Per-session cache of cursor -> Campaign so scrubbing never re-replays
// from genesis every step. Ported bound from the engine demo.
export const SCRUB_CACHE_MAX_SLOTS = 128;
