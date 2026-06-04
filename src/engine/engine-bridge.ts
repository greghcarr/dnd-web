import { resolveContent, type ContentPack, type ResolvedContent } from 'dnd-srd-engine';
import { loadStarterPack } from 'dnd-srd-engine/starter-pack';
import { runBattle, type FuzzRest, type FuzzVs } from '@engine-fuzz';
import {
  TEAM_SIZE_1V1,
  TEAM_SIZE_2V2,
  type FuzzMode,
  type FuzzVsKind,
  type FuzzRestKind,
} from '@/constants/app';
import type { Session } from '@/state/session';
import { narrate } from '@/narrator';
import { synthesizePositions } from '@/spatial/formation';
import { createScrubCache, buildScrubbed } from './scrub-cache';
import { findEncounterId } from './encounter-select';

export interface BattleConfig {
  readonly seed: number;
  readonly mode: FuzzMode;
  readonly vs: FuzzVsKind;
  readonly level: number;
  readonly rest: FuzzRestKind;
}

// Compile-time guard that the app's local fuzz unions stay assignable to
// the engine's. If the engine narrows FuzzVs / FuzzRest, this breaks here
// instead of silently at the runBattle call site.
const _vsCheck: FuzzVs = 'pc' as FuzzVsKind;
const _restCheck: FuzzRest = 'none' as FuzzRestKind;
void _vsCheck;
void _restCheck;

// Owns the content pack (loaded once) and turns a BattleConfig into a
// fully prepared Session: runs the deterministic fuzz battle, resolves
// content for name lookups, and primes the scrub cache with its pinned
// genesis/end anchors.
export class EngineBridge {
  private readonly pack: ContentPack;
  private readonly content: ResolvedContent;

  constructor() {
    this.pack = loadStarterPack();
    this.content = resolveContent([this.pack]);
  }

  getContent(): ResolvedContent {
    return this.content;
  }

  startBattle(config: BattleConfig): Session {
    const result = runBattle({
      seed: config.seed,
      pack: this.pack,
      level: config.level,
      rest: config.rest,
      teamSize: config.mode === '2v2' ? TEAM_SIZE_2V2 : TEAM_SIZE_1V1,
      vs: config.vs,
    });

    const fullCampaign = result.campaign;
    const totalEvents = fullCampaign.events.length;

    // Pin the genesis (0) and end (totalEvents) anchors so they never
    // evict, then seed both so the pins actually hold.
    const scrubCache = createScrubCache([0, totalEvents]);
    scrubCache.entries.set(totalEvents, fullCampaign);
    buildScrubbed(fullCampaign, 0, scrubCache);

    return {
      fullCampaign,
      totalEvents,
      encounterId: findEncounterId(fullCampaign),
      result,
      content: this.content,
      scrubCache,
      narration: narrate(fullCampaign.events, this.content),
      formation: synthesizePositions(result.teamACharacterIds, result.teamBCharacterIds),
    };
  }
}
