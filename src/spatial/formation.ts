// Position synthesis. The engine's fuzz battles are positionless, so the
// viewer places the two teams in adjacent columns at the centre of the
// arena: team A in column 0 facing right, team B in column 1 facing left.
// 1v1 is two touching tiles; 2v2 is a 2x2 square. Pure and deterministic:
// placement order comes from the seed-stable team id arrays, no RNG.

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

const TEAM_A_COL = 0;
const TEAM_B_COL = 1;

const placeTeam = (
  ids: ReadonlyArray<string>,
  team: Team,
  col: number,
  facing: Facing,
  out: Map<string, Placement>,
): void => {
  ids.forEach((id, index) => {
    out.set(id, { col, row: index, team, facing });
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
  placeTeam(teamAIds, 'A', TEAM_A_COL, 'right', placements);
  placeTeam(teamBIds, 'B', TEAM_B_COL, 'left', placements);
  return { placements, bounds: computeBounds(placements) };
};
