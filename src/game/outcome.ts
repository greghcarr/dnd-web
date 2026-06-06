import type { Campaign } from 'dnd-srd-engine';

export type DuelOutcome = 'ongoing' | 'victory' | 'defeat';

// Win/loss from the player's perspective. MVP: a combatant at 0 HP is out.
// The full death-save flow (a downed player isn't dead until three failed
// saves) is a later slice; until then 0 HP ends the duel.
export const duelOutcome = (
  state: Campaign['state'],
  playerId: string,
  enemyId: string,
): DuelOutcome => {
  const standing = (id: string): boolean => (state.characters[id]?.hp.current ?? 0) > 0;
  if (!standing(enemyId)) return 'victory';
  if (!standing(playerId)) return 'defeat';
  return 'ongoing';
};

// The winning combatant's id (for the narrator's end line), or undefined
// while the duel is ongoing.
export const winnerId = (
  state: Campaign['state'],
  playerId: string,
  enemyId: string,
): string | undefined => {
  const result = duelOutcome(state, playerId, enemyId);
  if (result === 'victory') return playerId;
  if (result === 'defeat') return enemyId;
  return undefined;
};
