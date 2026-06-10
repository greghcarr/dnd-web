import type { Campaign } from 'dnd-srd-engine';

export type DuelOutcome = 'ongoing' | 'victory' | 'defeat';

type State = Campaign['state'];

const DEATH_SAVE_FAILURES_TO_DIE = 3;

// Knocked to 0 HP (unconscious / out of the fight), whether dying or stable.
const isDown = (state: State, id: string): boolean => (state.characters[id]?.hp.current ?? 0) <= 0;

// Truly dead: three failed death saves, or damage past the negative-max
// threshold. A downed-but-not-dead combatant is still in the duel.
const isDead = (state: State, id: string): boolean => {
  const character = state.characters[id];
  if (!character) return true;
  return character.deathSaves.failures >= DEATH_SAVE_FAILURES_TO_DIE || character.hp.current <= -character.hp.max;
};

// Win/loss from the player's perspective. Dropping the enemy (a knockout)
// decides the duel; the player only loses on actual death, so a downed player
// keeps making death saves until they die or the enemy is felled.
export const duelOutcome = (state: State, playerId: string, enemyId: string): DuelOutcome => {
  if (isDown(state, enemyId)) return 'victory';
  if (isDead(state, playerId)) return 'defeat';
  return 'ongoing';
};

// The winning combatant's id (for the narrator's end line), or undefined
// while the duel is ongoing.
export const winnerId = (state: State, playerId: string, enemyId: string): string | undefined => {
  const result = duelOutcome(state, playerId, enemyId);
  if (result === 'victory') return playerId;
  if (result === 'defeat') return enemyId;
  return undefined;
};
