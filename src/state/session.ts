import type { Campaign, ResolvedContent } from 'dnd-srd-engine';
import type { FuzzBattleResult } from '@engine-fuzz';
import type { ScrubCache } from '@/engine/scrub-cache';

// Everything one loaded fuzz battle needs, computed once at start. The
// replay store reads fullCampaign + scrubCache to materialize the
// campaign at any cursor; panels read result/content/encounterId.
// formation (Phase 4) and narration (Phase 3) are attached as those
// modules come online.
export interface Session {
  readonly fullCampaign: Campaign;
  readonly totalEvents: number;
  readonly encounterId: string;
  readonly result: FuzzBattleResult;
  readonly content: ResolvedContent;
  readonly scrubCache: ScrubCache;
}
