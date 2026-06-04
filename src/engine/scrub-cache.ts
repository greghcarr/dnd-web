import { replay, applyAll, type Campaign } from 'dnd-srd-engine';
import { SCRUB_CACHE_MAX_SLOTS } from '@/constants/timing';

// Per-session cache of cursor -> Campaign so scrubbing never re-replays
// from genesis on every step. Forward steps reuse the prior cursor's
// state and apply just the new events; backward jumps reuse the nearest
// cached prefix <= target and replay only the gap. Ported from the
// engine demo (dnd-srd-engine/web/main.ts).
//
// LRU eviction: a JS Map preserves insertion order, so the least-
// recently-used entry is the first non-pinned key in iteration order. On
// a hit we delete + re-insert to move the key to the most-recently-used
// end. The genesis (0) and end (totalEvents) anchors are pinned so the
// from-start and from-end paths stay instant.

export interface ScrubCache {
  readonly entries: Map<number, Campaign>;
  readonly pinned: ReadonlySet<number>;
  readonly maxSlots: number;
}

export const createScrubCache = (
  pinnedCursors: ReadonlyArray<number>,
  maxSlots = SCRUB_CACHE_MAX_SLOTS,
): ScrubCache => ({
  entries: new Map(),
  pinned: new Set(pinnedCursors),
  maxSlots,
});

const cacheSet = (cache: ScrubCache, cursor: number, campaign: Campaign): void => {
  cache.entries.set(cursor, campaign);
  while (cache.entries.size > cache.maxSlots) {
    let evicted = false;
    for (const key of cache.entries.keys()) {
      if (cache.pinned.has(key)) continue;
      cache.entries.delete(key);
      evicted = true;
      break;
    }
    if (!evicted) break;
  }
};

const cacheGet = (cache: ScrubCache, cursor: number): Campaign | undefined => {
  const hit = cache.entries.get(cursor);
  if (hit === undefined) return undefined;
  cache.entries.delete(cursor);
  cache.entries.set(cursor, hit);
  return hit;
};

export const buildScrubbed = (full: Campaign, cursor: number, cache: ScrubCache): Campaign => {
  const hit = cacheGet(cache, cursor);
  if (hit !== undefined) return hit;

  // Largest cached prefix <= cursor, so we replay only the gap.
  let bestKey = -1;
  for (const key of cache.entries.keys()) {
    if (key <= cursor && key > bestKey) bestKey = key;
  }

  const state =
    bestKey >= 0
      ? applyAll(cache.entries.get(bestKey)!.state, full.events.slice(bestKey, cursor))
      : replay(full.events.slice(0, cursor));

  const scrubbed: Campaign = {
    ...full,
    events: full.events.slice(0, cursor),
    state,
    cursor,
  };
  cacheSet(cache, cursor, scrubbed);
  return scrubbed;
};
