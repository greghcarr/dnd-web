// A single human-readable narration line, tied to the event index that
// reveals it. The console shows every line whose eventIndex < cursor, so
// a line appears exactly when its originating event has been applied. A
// collapsed hit is attributed to its DamageApplied index (it lights up
// only once damage lands); its attackEventIndex records the originating
// AttackRolled for cross-highlighting with the inspector.

export type NarrationKind =
  | 'turn'
  | 'hit'
  | 'miss'
  | 'damage'
  | 'heal'
  | 'spell'
  | 'save'
  | 'condition'
  | 'death'
  | 'rest'
  | 'info';

export interface NarrationLine {
  readonly eventIndex: number;
  readonly text: string;
  readonly kind: NarrationKind;
  readonly attackEventIndex?: number;
}
