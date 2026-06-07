import type { Campaign, Engine, PlanResult } from 'dnd-srd-engine';
import { mainWeaponInstanceId } from './combatant-read';

type Event = PlanResult['events'][number];
type Cell = { readonly x: number; readonly y: number };

// Move a combatant to a feet position and resolve any opportunity attacks the
// move provokes, returning every event produced and the resulting campaign.
// Reactors take the OA with their main-hand weapon (the MVP reactor policy).
// Shared by the player's move and the enemy policy so OA handling lives once.
export const resolveMove = (
  engine: Engine,
  start: Campaign,
  moverId: string,
  to: Cell,
): { readonly events: readonly Event[]; readonly campaign: Campaign; readonly provokedAttack: boolean } => {
  let campaign = start;
  const events: Event[] = [];
  let provokedAttack = false;
  const push = (produced: readonly Event[]): void => {
    if (produced.length === 0) return;
    campaign = engine.commit(campaign, produced);
    events.push(...produced);
  };

  const move = engine.plan.move(campaign.state, { combatantId: moverId, to });
  push(move.events);
  for (const event of move.events) {
    if (event.type !== 'OpportunityAvailable') continue;
    const weapon = mainWeaponInstanceId(campaign.state, event.reactorId);
    if (!weapon) continue;
    push(
      engine.plan.opportunityAttack(campaign.state, {
        reactorId: event.reactorId,
        targetId: event.moverId,
        weaponInstanceId: weapon,
      }).events,
    );
    provokedAttack = true;
  }

  return { events, campaign, provokedAttack };
};
