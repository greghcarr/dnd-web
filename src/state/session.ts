import type { Campaign, ResolvedContent } from 'dnd-srd-engine';
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
  readonly encounterId: string;
  readonly result: FuzzBattleResult;
  readonly content: ResolvedContent;
  readonly scrubCache: ScrubCache;
  readonly narration: ReadonlyArray<NarrationLine>;
  readonly formation: Formation;
}
