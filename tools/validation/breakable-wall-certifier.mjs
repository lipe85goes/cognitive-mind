/**
 * ROTA-CHEST-REWARDS-01 — the breakable-wall certifier, as OFFLINE ANALYSIS.
 *
 * ## Why this file exists here and not in production any more
 *
 * This rule once decided which walls the Pickaxe was allowed to open. After the
 * manual playtest the product changed: the Pickaxe now opens ANY internal maze
 * wall the Explorer is standing next to, and the difficulty is choosing which.
 *
 * So the rule stopped being a runtime permission. It did not stop being true:
 * it is still the measurement that answered "can opening a wall change this
 * board at all?", over 324 maps, and that answer is what made the mechanic worth
 * building. Deleting it would erase the reason the Pickaxe exists; leaving it in
 * production would leave an authority that no longer has a job.
 *
 *   BREAKABLE_WALL_FEASIBILITY_GATE     = SUPERSEDED_AS_RUNTIME_RESTRICTION
 *   BREAKABLE_WALL_FEASIBILITY_EVIDENCE = PRESERVED
 *
 * The logic below is the production code as it stood at the checkpoint, moved
 * verbatim and rewritten only from TypeScript into JavaScript. Fidelity is not
 * asserted by claim: `breakable-wall-feasibility.mjs` reproduces the original
 * campaign numbers exactly, and that comparison is written into its report.
 *
 * Nothing in `src/` imports this. Nothing in the game reads it.
 */

/** An opening joining fewer than two walkable cells is a pocket, not a route. */
export const BREAKABLE_MIN_DEGREE = 2;
/** Preferred spacing between marked walls, when marks still existed. */
export const BREAKABLE_MIN_SEPARATION = 2;
/** Hard ceiling on marked walls per map, when marks still existed. */
export const BREAKABLE_WALL_MAX = 3;
/** Marks per stage, when marks still existed. */
export const BREAKABLE_WALL_COUNT = { 1: 2, 2: 2, 3: 3 };

const ROWS = 9;
const COLS = 9;
const eq = (a, b) => a.row === b.row && a.col === b.col;
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const toCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};

function countCellsWithAlternativeRoute(API, playerStart, blocks, walkableKeys) {
  let count = 0;
  for (const cellKey of walkableKeys) {
    if (API.sharesBlock(blocks, playerStart, toCell(cellKey))) count += 1;
  }
  return count;
}

function measureBaseline(API, walls, playerStart, guardianStart, exitPosition, stars, blocks) {
  const walkableKeys = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cellKey = `${row},${col}`;
      if (!walls.has(cellKey)) walkableKeys.push(cellKey);
    }
  }
  const objective = API.computeObjectiveRoute(playerStart, stars, exitPosition, walls);
  const zone = API.computePortalDefenceZone(playerStart, exitPosition, walls);
  return {
    blocks,
    objectiveMoves: objective ? objective.moves : null,
    routeCells: objective ? objective.cells : [],
    portalAccesses: zone.accesses.length,
    portalZoneCells: zone.zone.length,
    alternativeRouteCells: countCellsWithAlternativeRoute(
      API,
      playerStart,
      blocks,
      walkableKeys,
    ),
    hunterMoves: API.findPathLength(guardianStart, playerStart, walls),
    walkableKeys,
  };
}

export function certifyBreakableWall(
  API,
  wall,
  walls,
  playerStart,
  guardianStart,
  exitPosition,
  stars,
  traps,
  chest,
  baseline,
) {
  const empty = {
    degree: 0,
    cyclesGained: 0,
    objectiveMovesSaved: 0,
    portalAccessesGained: 0,
    portalZoneCellsGained: 0,
    escapeCellsGained: 0,
    alternativeRouteCellsGained: 0,
    hunterMovesSaved: 0,
  };
  const refuse = (reason, effect = empty) => ({
    position: wall,
    effect,
    score: 0,
    certified: false,
    rejection: reason,
  });

  const wallKey = API.posKey(wall);
  if (wall.row < 0 || wall.row >= ROWS || wall.col < 0 || wall.col >= COLS) {
    return refuse("OUT_OF_BOARD");
  }
  if (!walls.has(wallKey)) return refuse("NOT_A_WALL");
  if (eq(wall, exitPosition)) return refuse("IS_PORTAL");
  if (eq(wall, playerStart) || eq(wall, guardianStart)) return refuse("IS_SPAWN");
  if (API.START_SAFE_CELLS.some((cell) => eq(cell, wall))) return refuse("IS_START_ZONE");
  if (stars.some((star) => eq(star, wall))) return refuse("IS_LIGHT");
  if (traps.some((trap) => eq(trap, wall))) return refuse("IS_TRAP");
  if (chest && eq(chest, wall)) return refuse("IS_CHEST");

  const degree = API.getNeighbors(wall, walls).length;
  if (degree < BREAKABLE_MIN_DEGREE) {
    return refuse(degree === 0 ? "WOULD_ADD_ISLAND" : "WOULD_ADD_DEAD_END", {
      ...empty,
      degree,
    });
  }

  const opened = new Set(walls);
  opened.delete(wallKey);

  const reachable = API.getReachableDistances(playerStart, opened);
  if (reachable.size !== ROWS * COLS - opened.size) {
    return refuse("WOULD_SPLIT_BOARD", { ...empty, degree });
  }
  if (!reachable.has(API.posKey(exitPosition))) {
    return refuse("PORTAL_UNREACHABLE", { ...empty, degree });
  }

  const openedBlocks = API.decomposeBoardBlocks(opened);
  const openedObjective = API.computeObjectiveRoute(playerStart, stars, exitPosition, opened);
  const openedZone = API.computePortalDefenceZone(playerStart, exitPosition, opened);
  const openedHunter = API.findPathLength(guardianStart, playerStart, opened);

  const objectiveMovesSaved =
    baseline.objectiveMoves !== null && openedObjective
      ? baseline.objectiveMoves - openedObjective.moves
      : 0;
  const alternativeRouteCellsGained =
    countCellsWithAlternativeRoute(API, playerStart, openedBlocks, baseline.walkableKeys) -
    baseline.alternativeRouteCells;
  const escapeCellsGained = baseline.routeCells.filter(
    (cell) =>
      API.getNeighbors(cell, walls).length < 3 &&
      API.getNeighbors(cell, opened).length >= 3,
  ).length;
  const hunterMovesSaved =
    baseline.hunterMoves !== null && openedHunter !== null
      ? baseline.hunterMoves - openedHunter
      : 0;

  const effect = {
    degree,
    cyclesGained: degree - 1,
    objectiveMovesSaved,
    portalAccessesGained: openedZone.accesses.length - baseline.portalAccesses,
    portalZoneCellsGained: openedZone.zone.length - baseline.portalZoneCells,
    escapeCellsGained,
    alternativeRouteCellsGained,
    hunterMovesSaved,
  };

  const significant =
    effect.objectiveMovesSaved >= 1 ||
    effect.portalAccessesGained >= 1 ||
    effect.escapeCellsGained >= 1 ||
    effect.alternativeRouteCellsGained >= 1;
  if (!significant) return refuse("NO_TOPOLOGICAL_EFFECT", effect);

  return {
    position: wall,
    effect,
    score:
      effect.objectiveMovesSaved * 12 +
      effect.portalAccessesGained * 10 +
      effect.escapeCellsGained * 8 +
      effect.alternativeRouteCellsGained * 2 +
      effect.cyclesGained * 3,
    certified: true,
    rejection: null,
  };
}

export function auditBreakableWalls(
  API,
  walls,
  playerStart,
  guardianStart,
  exitPosition,
  stars,
  traps,
  chest,
  precomputedBlocks,
) {
  const blocks = precomputedBlocks ?? API.decomposeBoardBlocks(walls);
  const baseline = measureBaseline(
    API,
    walls,
    playerStart,
    guardianStart,
    exitPosition,
    stars,
    blocks,
  );
  const audited = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cellKey = `${row},${col}`;
      if (!walls.has(cellKey)) continue;
      audited.push(
        certifyBreakableWall(
          API,
          { row, col },
          walls,
          playerStart,
          guardianStart,
          exitPosition,
          stars,
          traps,
          chest,
          baseline,
        ),
      );
    }
  }
  return audited;
}

export function chooseBreakableWalls(
  API,
  walls,
  playerStart,
  guardianStart,
  exitPosition,
  stars,
  traps,
  chest,
  routeStage,
  precomputedBlocks,
) {
  const certified = auditBreakableWalls(
    API,
    walls,
    playerStart,
    guardianStart,
    exitPosition,
    stars,
    traps,
    chest,
    precomputedBlocks,
  )
    .filter((candidate) => candidate.certified)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.position.row !== b.position.row) return a.position.row - b.position.row;
      return a.position.col - b.position.col;
    });

  const target = Math.min(BREAKABLE_WALL_MAX, BREAKABLE_WALL_COUNT[routeStage]);
  const chosen = [];
  for (const candidate of certified) {
    if (chosen.length >= target) break;
    if (
      chosen.some(
        (marked) => manhattan(marked, candidate.position) < BREAKABLE_MIN_SEPARATION,
      )
    ) {
      continue;
    }
    chosen.push(candidate.position);
  }
  for (const candidate of certified) {
    if (chosen.length >= target) break;
    if (chosen.some((marked) => eq(marked, candidate.position))) continue;
    chosen.push(candidate.position);
  }
  return chosen;
}
