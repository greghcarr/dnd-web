// How a duel is configured at game start. The start screen (a later slice)
// builds this; the DuelSession consumes it. `kind` selects the seed source
// and whether the run is ranked; `manualDice` is the "I'll provide my own
// dice rolls" toggle, honored only in free (unranked) duels (daily runs
// force engine dice so scores stay trustworthy). `manualDice` is carried
// now but not wired until the manual-dice slice.
export type DuelKind = 'daily' | 'free';

export interface RunConfig {
  readonly kind: DuelKind;
  readonly seed: number;
  readonly manualDice: boolean;
  // Character level for both combatants (the opponent matches the player). The
  // engine auto-resolves all level-up choices.
  readonly level: number;
}
