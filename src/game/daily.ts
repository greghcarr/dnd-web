// The daily challenge: the same duel for everyone on a given UTC day. The
// seed is the UTC date encoded as YYYYMMDD, so it is stable across a calendar
// day worldwide and changes at UTC midnight.
const YEAR_FACTOR = 10000;
const MONTH_FACTOR = 100;

export const dailySeed = (now: Date = new Date()): number =>
  now.getUTCFullYear() * YEAR_FACTOR + (now.getUTCMonth() + 1) * MONTH_FACTOR + now.getUTCDate();

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const dailyLabel = (now: Date = new Date()): string =>
  `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
