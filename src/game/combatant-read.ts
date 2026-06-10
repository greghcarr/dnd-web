import type { Campaign } from 'dnd-srd-engine';

// The single place the live duel reaches into engine character/encounter
// state shape (mirrors spatial/engine-positions for positions). If the
// engine later surfaces these via engine.query.*, route through that.
type State = Campaign['state'];

// The combatant whose turn it is, by combatant id (=== character id).
export const activeCombatantId = (state: State, encounterId: string): string | undefined => {
  const encounter = state.encounters[encounterId];
  return encounter?.combatants[encounter.activeIndex]?.combatantId;
};

// The instance id of a combatant's main-hand weapon, used as the
// `weaponInstanceId` for attack/opportunity-attack intents. Undefined when
// nothing is equipped.
export const mainWeaponInstanceId = (state: State, characterId: string): string | undefined =>
  state.characters[characterId]?.equipped.mainHand;
