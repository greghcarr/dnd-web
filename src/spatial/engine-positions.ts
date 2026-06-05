// The single place that reaches into engine state for combatant positions.
// In tactical battles the engine tracks each combatant's coordinates on the
// encounter (feet-coords); everywhere else in the viewer goes through here
// so an engine shape change touches one file. Positionless battles return
// combatants whose `position` is undefined.

import type { Campaign } from 'dnd-srd-engine';

export interface EngineCombatant {
  readonly combatantId: string;
  readonly position?: { readonly x: number; readonly y: number };
}

export interface Cell {
  readonly col: number;
  readonly row: number;
}

export const combatantPositions = (
  campaign: Campaign,
  encounterId: string,
): ReadonlyArray<EngineCombatant> => campaign.state.encounters[encounterId]?.combatants ?? [];

// Engine positions are feet-coords; one grid cell is cellSizeFeet wide. We
// replicate the engine's feet->cell floor locally (the engine's feetToCell
// is intentionally not part of its public surface).
export const cellOf = (
  position: { readonly x: number; readonly y: number },
  cellSizeFeet: number,
): Cell => ({
  col: Math.floor(position.x / cellSizeFeet),
  row: Math.floor(position.y / cellSizeFeet),
});
