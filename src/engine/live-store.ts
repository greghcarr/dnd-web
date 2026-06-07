import type { Campaign, PlanResult } from 'dnd-srd-engine';
import { commit } from 'dnd-srd-engine';
import type { Session } from '@/state/session';
import type { NarrationLine } from '@/narrator/types';
import { buildScrubbed, createScrubCache, type ScrubCache } from './scrub-cache';
import type { ReplaySnapshot, SnapshotListener, SnapshotSource } from './snapshot-source';

// Recomputes the battle log from the live campaign as it grows; injected so
// the store has no narrator/content dependency of its own.
export type Renarrate = (campaign: Campaign) => ReadonlyArray<NarrationLine>;

// A duel keeps ONE session object for its lifetime; the store mutates its
// growing fields (fullCampaign / totalEvents / narration) in place so the
// session identity stays stable. The arena keys "is this a new battle?" off
// session identity, so this keeps it from rebuilding on every committed
// action (only a genuinely new duel swaps the object).
type MutableSession = { -readonly [K in keyof Session]: Session[K] };

// The live-play counterpart to ReplayStore. Where ReplayStore scrubs a cursor
// over a finished log, LiveStore holds a campaign that GROWS as the player and
// AI commit actions. Two cursors: the committed TAIL (`currentTail`), where
// the turn loop plans; and the VIEW cursor, walked forward to the tail one
// event at a time so each animates. It materializes each view frame through a
// scrub cache, exactly like ReplayStore, so the arena's movement animation and
// attack/hurt reactions work unchanged. `rewindTo` powers undo.
export class LiveStore implements SnapshotSource {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly session: MutableSession;
  private cache: ScrubCache;
  private tail: Campaign;
  private viewCursor: number;
  private materialized: Campaign;

  constructor(
    session: Session,
    private readonly renarrate?: Renarrate,
  ) {
    this.session = { ...session };
    this.cache = session.scrubCache;
    this.tail = session.fullCampaign;
    this.viewCursor = session.openingCursor;
    this.materialized = buildScrubbed(session.fullCampaign, this.viewCursor, this.cache);
  }

  get currentTail(): Campaign {
    return this.tail;
  }

  get viewAtTail(): boolean {
    return this.viewCursor >= this.session.totalEvents;
  }

  getSnapshot(): ReplaySnapshot {
    return {
      session: this.session,
      campaign: this.materialized,
      cursor: this.viewCursor,
      totalEvents: this.session.totalEvents,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Grow the live log with a committed action's events. Advances the tail
  // (where planning happens) but not the view; the caller plays the view
  // forward to animate. The scrub cache stays valid: appending never changes
  // an existing prefix.
  append(events: PlanResult['events']): void {
    if (events.length === 0) return;
    this.tail = commit(this.tail, events);
    this.session.fullCampaign = this.tail;
    this.session.totalEvents = this.tail.events.length;
    if (this.renarrate) this.session.narration = this.renarrate(this.tail);
  }

  // Undo: rewind the tail to an earlier campaign and snap the view to it. A
  // fresh cache drops frames from the abandoned branch, so a later, different
  // redo never reads a stale frame at a reused cursor.
  rewindTo(campaign: Campaign): void {
    this.tail = campaign;
    this.session.fullCampaign = campaign;
    this.session.totalEvents = campaign.events.length;
    if (this.renarrate) this.session.narration = this.renarrate(campaign);
    this.cache = createScrubCache([0, this.session.openingCursor]);
    this.session.scrubCache = this.cache;
    this.viewCursor = campaign.events.length;
    this.materialized = campaign;
    this.emit();
  }

  // Advance the shown frame one event toward the tail and emit (animate step).
  stepForward(): void {
    if (this.viewAtTail) return;
    this.viewCursor += 1;
    this.materialized = buildScrubbed(this.session.fullCampaign, this.viewCursor, this.cache);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
