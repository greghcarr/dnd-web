import type { ReplaySnapshot, SnapshotListener, SnapshotSource } from './snapshot-source';

// A switchable SnapshotSource. The Phaser arena subscribes to this once, at
// boot; app modes then point it at the active producer: the ReplayStore for
// the replay viewers, a LiveStore for the interactive duel. On swap it
// unsubscribes from the old delegate and subscribes to the new one, whose
// immediate snapshot is rebroadcast so the arena rebuilds for the new
// source. This is the single seam that lets one arena serve both a scrubbed
// log and a live game without knowing which it is showing.
export class SourceRouter implements SnapshotSource {
  private current: SnapshotSource;
  private readonly listeners = new Set<SnapshotListener>();
  private unsubscribeCurrent?: () => void;

  constructor(initial: SnapshotSource) {
    this.current = initial;
    this.bind();
  }

  setSource(next: SnapshotSource): void {
    if (next === this.current) return;
    this.unsubscribeCurrent?.();
    this.current = next;
    this.bind();
  }

  getSnapshot(): ReplaySnapshot {
    return this.current.getSnapshot();
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Subscribing to a delegate yields its current snapshot immediately; we
  // rebroadcast every delegate emission so subscribers re-render. (At
  // construction there are no listeners yet, so the first emission is a
  // no-op; the arena gets its initial frame from its own subscribe call.)
  private bind(): void {
    this.unsubscribeCurrent = this.current.subscribe((snapshot) => this.broadcast(snapshot));
  }

  private broadcast(snapshot: ReplaySnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }
}
