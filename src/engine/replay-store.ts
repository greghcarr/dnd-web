import type { Campaign } from 'dnd-srd-engine';
import type { Session } from '@/state/session';
import type { ReplaySnapshot, SnapshotListener, SnapshotSource } from './snapshot-source';
import { buildScrubbed } from './scrub-cache';

// Single source of truth for the replay cursor. Owns the current cursor,
// materializes the campaign at that cursor via the session scrub cache,
// and notifies subscribers (Phaser arena, event inspector, narrator
// console) with a snapshot whenever the cursor or session changes. The
// snapshot contract itself lives in ./snapshot-source so the live duel
// driver can emit the same shape; re-exported here for existing consumers.
export type { ReplaySnapshot } from './snapshot-source';
export type ReplayListener = SnapshotListener;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class ReplayStore implements SnapshotSource {
  private session: Session;
  private cursor: number;
  private campaign: Campaign;
  private readonly listeners = new Set<ReplayListener>();

  constructor(session: Session, initialCursor: number = session.openingCursor) {
    this.session = session;
    this.cursor = clamp(initialCursor, session.openingCursor, session.totalEvents);
    this.campaign = buildScrubbed(session.fullCampaign, this.cursor, session.scrubCache);
  }

  getSnapshot(): ReplaySnapshot {
    return {
      session: this.session,
      campaign: this.campaign,
      cursor: this.cursor,
      totalEvents: this.session.totalEvents,
    };
  }

  // Subscribe and immediately receive the current snapshot so panels can
  // render their initial state. Returns an unsubscribe function.
  subscribe(listener: ReplayListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  seek(nextCursor: number): void {
    // The spawn frame (openingCursor) is the effective start; the
    // pre-spawn setup frames are not navigable.
    const next = clamp(nextCursor, this.session.openingCursor, this.session.totalEvents);
    if (next === this.cursor) return;
    this.cursor = next;
    this.campaign = buildScrubbed(this.session.fullCampaign, next, this.session.scrubCache);
    this.emit();
  }

  // Swap in a freshly generated battle (config change / new seed) and
  // open at the spawn cursor so the fully-populated arena is shown,
  // paused, before any actions.
  loadSession(session: Session, cursor: number = session.openingCursor): void {
    this.session = session;
    this.cursor = clamp(cursor, session.openingCursor, session.totalEvents);
    this.campaign = buildScrubbed(session.fullCampaign, this.cursor, session.scrubCache);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
