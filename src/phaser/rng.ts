// Tiny deterministic PRNG (mulberry32) for arena decoration. Seeded off
// the battle seed so each fight's scatter is varied yet reproducible.

export type Rng = () => number;

export const makeRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
