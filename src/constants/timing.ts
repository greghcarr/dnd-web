// Animation and playback timing, plus the scrub cache bound.

export const STEP_DELAY_MS = 350;

export const HP_TWEEN_MS = 200;
export const HIT_FLASH_MS = 90;
export const TOKEN_LUNGE_MS = 110;

// Occasional idle blink: each token waits a random delay in this range
// between blinks (so they desync), and a blink lasts BLINK_DURATION_MS.
export const BLINK_MIN_MS = 2200;
export const BLINK_MAX_MS = 6500;
export const BLINK_DURATION_MS = 120;

// Per-session cache of cursor -> Campaign so scrubbing never re-replays
// from genesis every step. Ported bound from the engine demo.
export const SCRUB_CACHE_MAX_SLOTS = 128;
