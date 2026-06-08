// The channel between the live duel's controller (DOM) and the Phaser arena.
// Shared via the game registry, like the snapshot source: the controller
// publishes which cells to highlight and what happens when one is clicked;
// the arena renders the marks and reports cell clicks. Replay modes never
// touch it (no marks, no handler), so the arena shows no overlay and clicks
// are inert.

export type CellMarkKind = 'move' | 'target';

export interface CellMark {
  readonly col: number;
  readonly row: number;
  readonly kind: CellMarkKind;
}

export type CellClickHandler = (col: number, row: number) => void;

// A one-shot floating message the controller asks the arena to pop above a
// combatant (e.g. a red "action already used" when the engine refuses a cast).
// Distinct from event-driven combat text, which the arena derives from the log.
export type FloatingNoticeTone = 'info' | 'error';
export interface FloatingNotice {
  readonly subjectId: string;
  readonly label: string;
  readonly tone: FloatingNoticeTone;
}

export class ArenaInteraction {
  private marks: ReadonlyArray<CellMark> = [];
  private clickHandler?: CellClickHandler;
  private readonly listeners = new Set<() => void>();
  private readonly noticeListeners = new Set<(notice: FloatingNotice) => void>();

  getMarks(): ReadonlyArray<CellMark> {
    return this.marks;
  }

  setMarks(marks: ReadonlyArray<CellMark>): void {
    this.marks = marks;
    this.notify();
  }

  clearMarks(): void {
    this.setMarks([]);
  }

  // The controller sets what a cell click does for the current selection
  // (pick a move destination, pick a target); undefined means clicks are
  // ignored (idle / replay).
  setClickHandler(handler: CellClickHandler | undefined): void {
    this.clickHandler = handler;
  }

  clickCell(col: number, row: number): void {
    this.clickHandler?.(col, row);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Ask the arena to pop a floating notice above a combatant.
  emitNotice(notice: FloatingNotice): void {
    for (const listener of this.noticeListeners) listener(notice);
  }

  onNotice(listener: (notice: FloatingNotice) => void): () => void {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
