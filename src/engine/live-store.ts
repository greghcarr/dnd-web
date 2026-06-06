import type { Campaign, PlanResult } from 'dnd-srd-engine';
import { commit } from 'dnd-srd-engine';
import type { Session } from '@/state/session';
import type { NarrationLine } from '@/narrator/types';
import { buildScrubbed } from './scrub-cache';
import type { ReplaySnapshot, SnapshotListener, SnapshotSource } from './snapshot-source';

// Recomputes the battle log from the live campaign as it grows; injected so
// the store has no narrator/content dependency of its own.
export type Renarrate = (campaign: Campaign) => ReadonlyArray<NarrationLine>;

// The live-play counterpart to ReplayStore. Where ReplayStore scrubs a
// cursor over a finished log, LiveStore holds a campaign that GROWS as the
// player and AI commit actions. Two cursors:
//   - the committed TAIL (`currentTail`): the full live campaign, where the
//     turn loop plans the next action;
//   - the VIEW cursor: the frame currently shown, which the turn loop walks
//     forward to the tail one event at a time so each animates (the arena
//     animates only when the cursor advances by exactly 1).
// It materializes each view frame through the session scrub cache, exactly
// like ReplayStore, so the arena's movement animation and attack/hurt
// reactions work unchanged.
export class LiveStore implements SnapshotSource {
  private readonly listeners = new Set<SnapshotListener>();
  private session: Session;
  private tail: Campaign;
  private viewCursor: number;
  private materialized: Campaign;

  constructor(
    session: Session,
    private readonly renarrate?: Renarrate,
  ) {
    this.session = session;
    this.tail = session.fullCampaign;
    this.viewCursor = session.openingCursor;
    this.materialized = buildScrubbed(session.fullCampaign, this.viewCursor, session.scrubCache);
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

  // Grow the live log with a freshly committed action's events. Advances the
  // tail (where planning happens) but not the view; the caller plays the
  // view forward to animate. The scrub cache stays valid: appending events
  // never changes any existing prefix.
  append(events: PlanResult['events']): void {
    if (events.length === 0) return;
    this.tail = commit(this.tail, events);
    this.session = {
      ...this.session,
      fullCampaign: this.tail,
      totalEvents: this.tail.events.length,
      // Re-narrate the grown log so the battle log reflects live events (not
      // the discarded set-up battle's narration).
      narration: this.renarrate ? this.renarrate(this.tail) : this.session.narration,
    };
  }

  // Advance the shown frame one event toward the tail and emit. A single-step
  // advance is the arena's signal to animate that event.
  stepForward(): void {
    if (this.viewAtTail) return;
    this.viewCursor += 1;
    this.materialized = buildScrubbed(this.session.fullCampaign, this.viewCursor, this.session.scrubCache);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
