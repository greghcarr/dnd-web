import type { Campaign, ResolvedContent } from 'dnd-srd-engine';
import type { FuzzBattleResult } from '@engine-fuzz';
import type { ScrubCache } from '@/engine/scrub-cache';
import type { NarrationLine } from '@/narrator/types';

// Everything one loaded fuzz battle needs, computed once at start. The
// replay store reads fullCampaign + scrubCache to materialize the
// campaign at any cursor; panels read result/content/encounterId/
// narration. formation (Phase 4) is attached when that module comes
// online.
export interface Session {
  readonly fullCampaign: Campaign;
  readonly totalEvents: number;
  readonly encounterId: string;
  readonly result: FuzzBattleResult;
  readonly content: ResolvedContent;
  readonly scrubCache: ScrubCache;
  readonly narration: ReadonlyArray<NarrationLine>;
}
