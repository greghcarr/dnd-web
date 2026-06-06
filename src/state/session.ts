import type { Campaign, ResolvedContent, LocationMap } from 'dnd-srd-engine';
import type { FuzzBattleResult } from '@engine-fuzz';
import type { ScrubCache } from '@/engine/scrub-cache';
import type { NarrationLine } from '@/narrator/types';
import type { Formation } from '@/spatial/formation';

// Everything one loaded fuzz battle needs, computed once at start. The
// replay store reads fullCampaign + scrubCache to materialize the
// campaign at any cursor; panels and the arena read result/content/
// encounterId/narration/formation.
export interface Session {
  readonly seed: number;
  readonly fullCampaign: Campaign;
  readonly totalEvents: number;
  // Cursor to open the replay at: just after the last combatant spawns.
  readonly openingCursor: number;
  readonly encounterId: string;
  readonly result: FuzzBattleResult;
  readonly content: ResolvedContent;
  readonly scrubCache: ScrubCache;
  readonly narration: ReadonlyArray<NarrationLine>;
  readonly formation: Formation;
  // Present only for tactical battles: the arena's terrain grid. Its
  // presence is what tells the arena to render cover and animate movement.
  readonly map?: LocationMap;
}
