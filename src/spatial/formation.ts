// Position synthesis. The engine's fuzz battles are positionless, so the
// viewer places each team in static facing ranks on a tile grid. Pure
// and deterministic: placement order comes from the seed-stable team id
// arrays, no RNG. Team A sits on the left facing right; team B on the
// right facing left. Members stack along the rank; teams larger than a
// rank wrap into sub-ranks that grow away from no-man's-land.

import {
  MAX_COMBATANTS_PER_RANK,
  COMBATANT_SPACING_TILES,
  RANK_DEPTH_SPACING_TILES,
  NO_MANS_LAND_TILES,
} from '@/constants/layout';

export type Team = 'A' | 'B';
export type Facing = 'left' | 'right';

export interface Placement {
  readonly col: number;
  readonly row: number;
  readonly team: Team;
  readonly facing: Facing;
}

export interface FormationBounds {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

export interface Formation {
  readonly placements: ReadonlyMap<string, Placement>;
  readonly bounds: FormationBounds;
}

const TEAM_A_FRONT_COL = 0;
const TEAM_B_FRONT_COL = NO_MANS_LAND_TILES;

const placeTeam = (
  ids: ReadonlyArray<string>,
  team: Team,
  frontCol: number,
  depthSign: -1 | 1,
  facing: Facing,
  out: Map<string, Placement>,
): void => {
  ids.forEach((id, index) => {
    const subRank = Math.floor(index / MAX_COMBATANTS_PER_RANK);
    const slot = index % MAX_COMBATANTS_PER_RANK;
    const membersInSubRank = Math.min(
      ids.length - subRank * MAX_COMBATANTS_PER_RANK,
      MAX_COMBATANTS_PER_RANK,
    );
    const row = (slot - Math.floor((membersInSubRank - 1) / 2)) * COMBATANT_SPACING_TILES;
    const col = frontCol + depthSign * subRank * RANK_DEPTH_SPACING_TILES;
    out.set(id, { col, row, team, facing });
  });
};

const computeBounds = (placements: ReadonlyMap<string, Placement>): FormationBounds => {
  let minCol = 0;
  let maxCol = 0;
  let minRow = 0;
  let maxRow = 0;
  let first = true;
  for (const { col, row } of placements.values()) {
    if (first) {
      minCol = maxCol = col;
      minRow = maxRow = row;
      first = false;
      continue;
    }
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }
  return { minCol, maxCol, minRow, maxRow };
};

export const synthesizePositions = (
  teamAIds: ReadonlyArray<string>,
  teamBIds: ReadonlyArray<string>,
): Formation => {
  const placements = new Map<string, Placement>();
  placeTeam(teamAIds, 'A', TEAM_A_FRONT_COL, -1, 'right', placements);
  placeTeam(teamBIds, 'B', TEAM_B_FRONT_COL, 1, 'left', placements);
  return { placements, bounds: computeBounds(placements) };
};
