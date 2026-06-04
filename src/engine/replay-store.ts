import type { Campaign } from 'dnd-srd-engine';
import type { Session } from '@/state/session';
import { buildScrubbed } from './scrub-cache';

// Single source of truth for the replay cursor. Owns the current cursor,
// materializes the campaign at that cursor via the session scrub cache,
// and notifies subscribers (Phaser arena, event inspector, narrator
// console) with a snapshot whenever the cursor or session changes.

export interface ReplaySnapshot {
  readonly session: Session;
  readonly campaign: Campaign;
  readonly cursor: number;
  readonly totalEvents: number;
}

export type ReplayListener = (snapshot: ReplaySnapshot) => void;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class ReplayStore {
  private session: Session;
  private cursor: number;
  private campaign: Campaign;
  private readonly listeners = new Set<ReplayListener>();

  constructor(session: Session, initialCursor: number = session.openingCursor) {
    this.session = session;
    this.cursor = clamp(initialCursor, 0, session.totalEvents);
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
    const next = clamp(nextCursor, 0, this.session.totalEvents);
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
    this.cursor = clamp(cursor, 0, session.totalEvents);
    this.campaign = buildScrubbed(session.fullCampaign, this.cursor, session.scrubCache);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
