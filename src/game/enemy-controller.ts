import type { Campaign, Engine, PlanResult } from 'dnd-srd-engine';
import { combatantPositions } from '@/spatial/engine-positions';
import { mainWeaponInstanceId } from './combatant-read';
import { resolveMove } from './resolve-move';

// MVP enemy policy: close on the foe, then attack if in range. Built only on
// the engine's affordance queries (legalMoveDestinations / legalTargets), so
// every move and attack is legal by construction. The role-classified kiting
// policy (planTacticalMove) is a follow-up: it needs weapon-definition
// plumbing the engine has not graduated out of its fuzz scripts yet.

type Event = PlanResult['events'][number];
type Cell = { readonly x: number; readonly y: number };

const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const positionOf = (campaign: Campaign, encounterId: string, id: string): Cell | undefined =>
  combatantPositions(campaign, encounterId).find((c) => c.combatantId === id)?.position;

// Plan and locally resolve one combatant's whole turn (move-then-attack),
// returning every event produced. Threads a local campaign copy so each step
// plans against the state the previous step produced; the caller appends the
// returned events to grow the live store.
export const planEnemyTurn = (
  engine: Engine,
  start: Campaign,
  encounterId: string,
  selfId: string,
  foeId: string,
): readonly Event[] => {
  let campaign = start;
  const collected: Event[] = [];

  const foePos = positionOf(campaign, encounterId, foeId);
  if (foePos) {
    const selfPos = positionOf(campaign, encounterId, selfId);
    let best: Cell | undefined;
    let bestDistance = selfPos ? chebyshev(selfPos, foePos) : Number.POSITIVE_INFINITY;
    for (const destination of engine.query.legalMoveDestinations(campaign.state, encounterId, selfId)) {
      const distance = chebyshev(destination.position, foePos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = destination.position;
      }
    }
    if (best) {
      const moved = resolveMove(engine, campaign, selfId, best);
      campaign = moved.campaign;
      collected.push(...moved.events);
    }
  }

  const inRange = engine.query
    .legalTargets(campaign.state, encounterId, selfId, 'attack')
    .some((target) => target.combatantId === foeId);
  if (inRange) {
    const weapon = mainWeaponInstanceId(campaign.state, selfId);
    if (weapon) {
      collected.push(...engine.plan.attack(campaign.state, { attackerId: selfId, targetId: foeId, weaponInstanceId: weapon }).events);
    }
  }

  return collected;
};
