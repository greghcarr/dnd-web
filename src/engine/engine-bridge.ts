import { resolveContent, createEngine, seededRNG, type ContentPack, type ResolvedContent, type Engine } from 'dnd-srd-engine';
import { loadStarterPack } from 'dnd-srd-engine/starter-pack';
import { runBattle, type FuzzVs, type FuzzMovement } from '@engine-fuzz';
import { TEAM_SIZE_1V1, TEAM_SIZE_2V2, type FuzzMode, type FuzzVsKind } from '@/constants/app';
import type { Session } from '@/state/session';
import { narrate } from '@/narrator';
import { synthesizePositions, formationFromEngine } from '@/spatial/formation';
import { combatantPositions } from '@/spatial/engine-positions';
import { createScrubCache, buildScrubbed } from './scrub-cache';
import { findEncounterId } from './encounter-select';

export interface BattleConfig {
  readonly seed: number;
  readonly mode: FuzzMode;
  readonly vs: FuzzVsKind;
  readonly level: number;
  // Omitted/`'none'` is the positionless fuzz; `'tactical'` spawns combatants
  // on a generated map and moves them. Defaults to 'none'.
  readonly movement?: FuzzMovement;
  // Pins team A (the player) to this class; undefined leaves it seed-random
  // (engine slice 717). The map and opponent are unchanged by the pin.
  readonly playerClass?: string;
}

// Compile-time guard that the app's local fuzz union stays assignable to
// the engine's. If the engine narrows FuzzVs, this breaks here instead of
// silently at the runBattle call site.
const _vsCheck: FuzzVs = 'pc' as FuzzVsKind;
void _vsCheck;

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

  // A fresh engine instance for driving a live (player-controlled) duel:
  // its seeded stream supplies the enemy's dice, deterministic for the daily
  // run. Distinct from the one runBattle uses to generate the set-up.
  createDuelEngine(seed: number): Engine {
    return createEngine({ rng: seededRNG(seed), contentPacks: [this.pack] });
  }

  startBattle(config: BattleConfig): Session {
    const result = runBattle({
      seed: config.seed,
      pack: this.pack,
      level: config.level,
      // No post-battle rest; battles always end on the encounter outcome.
      rest: 'none',
      teamSize: config.mode === '2v2' ? TEAM_SIZE_2V2 : TEAM_SIZE_1V1,
      vs: config.vs,
      movement: config.movement ?? 'none',
      playerClass: config.playerClass,
    });

    const fullCampaign = result.campaign;
    const totalEvents = fullCampaign.events.length;
    const encounterId = findEncounterId(fullCampaign);

    // Open the replay at the start of the first turn, after all setup
    // (spawns, level-ups, initiative) but before any combat action, so the
    // viewer sees the fully populated, fully leveled arena. Fall back to
    // just after the last spawn if no turn ever begins.
    let lastSpawn = -1;
    let firstTurn = -1;
    for (let i = 0; i < fullCampaign.events.length; i++) {
      const type = fullCampaign.events[i]!.type;
      if (type === 'CharacterCreated') lastSpawn = i;
      if (firstTurn < 0 && type === 'TurnStarted') firstTurn = i;
    }
    const openingCursor = firstTurn >= 0 ? firstTurn + 1 : lastSpawn + 1;

    // Pin the genesis (0) and end (totalEvents) anchors so they never
    // evict, then seed both so the pins actually hold.
    const scrubCache = createScrubCache([0, totalEvents]);
    scrubCache.entries.set(totalEvents, fullCampaign);
    buildScrubbed(fullCampaign, 0, scrubCache);

    // Tactical battles carry a real map and starting positions; build the
    // initial formation from the engine state at the opening cursor (after
    // placement, before any move). Positionless battles synthesize a
    // formation from the seed-stable team id arrays.
    const map =
      result.movement === 'tactical' && result.locationId
        ? fullCampaign.state.locations[result.locationId]?.map
        : undefined;
    let formation;
    if (map) {
      const opening = buildScrubbed(fullCampaign, openingCursor, scrubCache);
      formation = formationFromEngine(
        combatantPositions(opening, encounterId),
        new Set(result.teamACharacterIds),
        map.cellSizeFeet,
      );
    } else {
      formation = synthesizePositions(result.teamACharacterIds, result.teamBCharacterIds);
    }

    return {
      seed: config.seed,
      fullCampaign,
      totalEvents,
      openingCursor,
      encounterId,
      result,
      content: this.content,
      scrubCache,
      narration: narrate(fullCampaign.events, this.content, result.winner),
      formation,
      map,
    };
  }
}
