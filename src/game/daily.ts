import { DUEL_CLASS_IDS } from '@/constants/app';

// The daily challenge: the same duel for everyone on a given UTC day. The
// seed is the UTC date encoded as YYYYMMDD, so it is stable across a calendar
// day worldwide and changes at UTC midnight.
const YEAR_FACTOR = 10000;
const MONTH_FACTOR = 100;

export const dailySeed = (now: Date = new Date()): number =>
  now.getUTCFullYear() * YEAR_FACTOR + (now.getUTCMonth() + 1) * MONTH_FACTOR + now.getUTCDate();

// The daily pins a specific class (deterministic from the date seed) rather
// than leaving it seed-random. Pinning is what makes the daily an exact
// subset of the Free Duels: a manual run with this class + DAILY_LEVEL + the
// date seed reproduces the daily byte-for-byte (the engine's pinned-class
// build is deterministic). A seed-random daily could not be replicated, since
// the unpinned and pinned build paths draw differently.
export const dailyClass = (now: Date = new Date()): string =>
  DUEL_CLASS_IDS[dailySeed(now) % DUEL_CLASS_IDS.length]!;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const dailyLabel = (now: Date = new Date()): string =>
  `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
