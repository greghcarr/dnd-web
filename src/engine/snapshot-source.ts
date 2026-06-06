import type { Campaign } from 'dnd-srd-engine';
import type { Session } from '@/state/session';

// The frame contract the Phaser arena (and any state-reading panel)
// subscribes to. A snapshot is "the campaign as of some cursor", plus the
// Session it belongs to. Two producers implement SnapshotSource and emit
// this same shape, so the arena renders either without knowing which:
//   - ReplayStore: a cursor scrubbed over a static, pre-computed event log.
//   - LiveStore: a player-driven duel, emitting one snapshot per committed
//     action as the live campaign grows.
// The cursor advancing by exactly 1 between consecutive snapshots is the
// signal to animate (token moves, reactions, camera pan); any other delta
// (jump, rewind, session swap) snaps. A live driver therefore emits one
// snapshot per committed action so each step animates.
export interface ReplaySnapshot {
  readonly session: Session;
  readonly campaign: Campaign;
  readonly cursor: number;
  readonly totalEvents: number;
}

export type SnapshotListener = (snapshot: ReplaySnapshot) => void;

export interface SnapshotSource {
  getSnapshot(): ReplaySnapshot;
  // Subscribe and immediately receive the current snapshot so consumers can
  // render their initial frame. Returns an unsubscribe function.
  subscribe(listener: SnapshotListener): () => void;
}
