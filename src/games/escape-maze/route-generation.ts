import { manhattanDistance } from "@/engine/difficulty";
import {
  beginSeededGeneration,
  randomItem,
  routeRandom,
} from "@/engine/route-random";
import {
  COLS,
  DIFFICULTY_PLAY_BRIEF,
  GUARDIAN_CANDIDATES,
  MAX_GENERATION_ATTEMPTS,
  PLAYER_START,
  RECOVERY_RETRIES_PER_SLOT,
  RECOVERY_ROUNDS,
  ROUTE_STAGE_EXIT_CANDIDATES,
  ROUTE_STAGE_GUARDIAN_CANDIDATES,
  ROUTE_STAGE_QUALITY,
  ROWS,
  START_SAFE_CELLS,
  getMinimumPathLength,
  getRouteStage,
  getRouteStageTemplates,
  getStarCount,
  getStarMinSeparation,
  getTrapCount,
  getWallLimits,
  type RouteStage,
} from "@/games/escape-maze/route-config";
import {
  cloneGrid,
  countWalls,
  findPathCells,
  findPathLength,
  getNeighbors,
  getReachableDistances,
  gridToWalls,
  keyToPosition,
  posKey,
  positionsEqual,
} from "@/games/escape-maze/route-geometry";
import type { DifficultyLevel, GridPosition } from "@/types/game";

/**
 * ROUTE-C2 — map generation and certification for the Rota.
 *
 * `generateMaze(difficulty, routeNumber)` is the whole contract: it returns a
 * map that passed every gate, or it throws. Behind it, moved out of
 * `useEscapeMaze.ts` verbatim — no body, gate, threshold, tie-break, order of
 * random draws or comment changed:
 *
 *   template/exit -> buildCandidate (Guardian seat, wall randomisation, early
 *   escape-geometry rejection, lights, isStructurallyValid, traps and chest)
 *   -> isValidMap -> certified map; then the bounded deterministic recovery
 *   sweep through the SAME gates; then the throw.
 *
 * It draws from the Rota's one stream (`@/engine/route-random`) exactly as it
 * always did, so the Hunter, which draws next from the same stream in the hook,
 * sees the same numbers. It reads configuration, the board's graph primitives
 * and the difficulty helpers — never React, the hook, the UI, Babylon or
 * sounds. Only `generateMaze` and `MazeMap` are exported; validators reach the
 * private gates through route-module-loader's surface.
 */

export interface MazeMap {
  grid: number[][];
  walls: Set<string>;
  playerStart: GridPosition;
  guardianStart: GridPosition;
  exitPosition: GridPosition;
  collectibleStars: GridPosition[];
  /** Walkable hazard tiles (Gameplay 2.0). Never affect path/guardian/walls. */
  traps: GridPosition[];
  /**
   * The reward chest: one walkable tile, an optional detour. Replaces the old
   * shield collectible entirely (ROTA-CHEST-REWARDS-01) and inherits its slot.
   */
  chest: GridPosition | null;
}

function countReachableJunctions(
  distances: Map<string, number>,
  walls: Set<string>,
): number {
  let junctions = 0;
  distances.forEach((_, key) => {
    const pos = keyToPosition(key);
    if (getNeighbors(pos, walls).length >= 3) junctions += 1;
  });
  return junctions;
}

function countStartZoneWalls(walls: Set<string>): number {
  return START_SAFE_CELLS.filter((cell) => walls.has(posKey(cell))).length;
}

function protectedKeys(
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): Set<string> {
  return new Set([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
    ...START_SAFE_CELLS.map(posKey),
  ]);
}

function chooseGuardianStart(
  walls: Set<string>,
  exitPosition: GridPosition,
  routeStage: RouteStage,
  difficulty: DifficultyLevel,
): GridPosition {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  // The defender now starts inside a band per mode, not merely "far enough".
  // An unbounded maximum is what let it start irrelevant on Aberto.
  const band = DIFFICULTY_PLAY_BRIEF[difficulty].guardianStartDistance;
  const minDistance = Math.max(band.min, profile.guardianMinStartDistance - 1);
  const candidates = [
    ...ROUTE_STAGE_GUARDIAN_CANDIDATES[routeStage],
    ...GUARDIAN_CANDIDATES,
  ].filter(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= minDistance &&
      manhattanDistance(pos, PLAYER_START) <= band.max,
  );

  if (candidates.length > 0) return randomItem(candidates);

  const fallback = GUARDIAN_CANDIDATES.find(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= band.min,
  );
  return fallback ?? { row: 0, col: 3 };
}

function randomizeWalls(
  baseGrid: number[][],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): number[][] {
  const grid = cloneGrid(baseGrid);
  const guaranteedOpenCells = [
    ...START_SAFE_CELLS,
    playerStart,
    guardianStart,
    exitPosition,
  ];
  guaranteedOpenCells.forEach((cell) => {
    grid[cell.row][cell.col] = 0;
  });
  const limits = getWallLimits(difficulty, routeStage);
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const protectedCells = protectedKeys(playerStart, guardianStart, exitPosition);

  // ROTA-MAPS-DIFFICULTY-01: every toggle is now checked before it is kept.
  // Blind scattering was undoing the template's designed structure — the loops
  // that guarantee an alternative route, and the absence of idle dead ends —
  // which is exactly what the new quality gates then rejected.
  const wouldKeepStructure = (candidate: number[][]): boolean => {
    const candidateWalls = gridToWalls(candidate);
    if (candidateWalls.has(posKey(playerStart))) return false;
    const reachable = getReachableDistances(playerStart, candidateWalls);
    const openCells = ROWS * COLS - candidateWalls.size;
    // One connected field: no pockets the Explorer can see but never enter.
    if (reachable.size !== openCells) return false;
    if (!reachable.has(posKey(exitPosition))) return false;
    if (!reachable.has(posKey(guardianStart))) return false;
    // No new dead ends beyond what the stage tolerates, and never a corridor
    // start: the Explorer must always have a real first choice.
    if (getNeighbors(playerStart, candidateWalls).length < 2) return false;
    if (getNeighbors(guardianStart, candidateWalls).length < 2) return false;
    return sharesBlock(decomposeBoardBlocks(candidateWalls), playerStart, exitPosition);
  };

  for (let attempt = 0; attempt < profile.wallRandomizationAttempts; attempt++) {
    const row = Math.floor(routeRandom() * ROWS);
    const col = Math.floor(routeRandom() * COLS);
    const key = `${row},${col}`;
    if (protectedCells.has(key)) continue;

    const wallCount = countWalls(grid);
    const previous = grid[row][col];
    if (previous === 1 && wallCount > limits.min) {
      grid[row][col] = 0;
    } else if (previous === 0 && wallCount < limits.max) {
      grid[row][col] = 1;
    } else {
      continue;
    }
    if (!wouldKeepStructure(grid)) grid[row][col] = previous;
  }

  return grid;
}

/**
 * Choose the lights, valid by construction.
 *
 * ROTA-01A-STAR-SELECTION-FIX: this used to score every eligible cell, take
 * greedily from the top respecting separation, and hand the result to a
 * validator that then rejected it. Measured on the four failing route3-hard
 * seeds: 2.330 of 2.864 candidates (81,4%) died on the "every light shares a
 * biconnected block with the Explorer" gate — and an exhaustive solver proved a
 * valid set of six existed in 2.330 of 2.330 of them. The layouts were fine;
 * the selection was not. The score rewards distance from the start, which is
 * exactly what correlates with sitting behind a choke point.
 *
 * Two changes, neither of which touches a threshold:
 *
 *  1. reachability-by-block is now part of ELIGIBILITY, not just of validation.
 *     A cell the Explorer cannot reach by two independent routes is never a
 *     candidate in the first place.
 *  2. greedy is not a proof of existence. With separation >= 3 and six lights,
 *     taking the best-scoring cell first can strand the set even when a valid
 *     one exists. Selection is now a bounded backtracking search that walks
 *     candidates in score order — so the preferred cell is still tried first,
 *     and the old preference is preserved whenever it does not block a complete
 *     set.
 *
 * If no complete set exists the function returns fewer than the required count,
 * and `isStructurallyValid` rejects the candidate explicitly. It never invents a
 * position, never drops the count, never violates separation.
 *
 * `blocks` is the decomposition of THIS candidate's walls, computed once in
 * `buildCandidate`. The gate in `isStructurallyValid` stays as the final
 * defence — this makes it a formality rather than a filter.
 */
function chooseStars(
  walls: Set<string>,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  blocks: BoardBlocks,
): GridPosition[] {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const blocked = protectedKeys(playerStart, guardianStart, exitPosition);
  const distances = getReachableDistances(playerStart, walls);
  const targetCount = getStarCount(difficulty, routeStage);
  const minSeparation = getStarMinSeparation(difficulty, routeStage);
  const candidates: Array<{ pos: GridPosition; score: number }> = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const key = posKey(pos);
      const distanceFromStart = distances.get(key);
      const distanceFromExit = findPathLength(pos, exitPosition, walls);
      if (
        walls.has(key) ||
        blocked.has(key) ||
        distanceFromStart === undefined ||
        distanceFromExit === null ||
        distanceFromStart < profile.starMinStartDistance ||
        distanceFromExit < profile.starMinExitDistance ||
        // The requirement the validator applies, applied at selection time.
        !sharesBlock(blocks, playerStart, pos)
      ) {
        continue;
      }

      const degree = getNeighbors(pos, walls).length;
      const guardianDistance = manhattanDistance(pos, guardianStart);
      const stageScore =
        routeStage === 1
          ? 36 - Math.abs(distanceFromStart - 5) * 5 + degree * 3
          : routeStage === 2
            ? distanceFromStart * 1.4 + distanceFromExit + degree * 4
            : distanceFromStart * 1.8 + distanceFromExit * 1.2 + degree * 3;

      candidates.push({
        pos,
        score: stageScore + guardianDistance * 0.4 + routeRandom() * 0.25,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Bounded backtracking in score order: the preferred cell is tried first, and
  // the search only backs off when that choice would make a complete set
  // impossible. Board is 9x9 and targetCount <= 6, so this stays cheap.
  const ordered = candidates.map((candidate) => candidate.pos);
  const separated = (chosen: GridPosition[], next: GridPosition) =>
    chosen.every(
      (star) => manhattanDistance(star, next) >= minSeparation,
    );

  const search = (from: number, chosen: GridPosition[]): GridPosition[] | null => {
    if (chosen.length === targetCount) return chosen;
    for (let index = from; index < ordered.length; index += 1) {
      if (chosen.length + (ordered.length - index) < targetCount) return null;
      const next = ordered[index];
      if (!separated(chosen, next)) continue;
      chosen.push(next);
      const complete = search(index + 1, chosen);
      if (complete) return complete;
      chosen.pop();
    }
    return null;
  };

  const complete = search(0, []);
  if (complete) return complete;

  // No complete set exists on this layout: return what greedy can manage, which
  // is short of the required count, and let the validator reject the candidate.
  const chosen: GridPosition[] = [];
  for (const candidate of candidates) {
    if (separated(chosen, candidate.pos)) chosen.push(candidate.pos);
    if (chosen.length >= targetCount) return chosen;
  }

  // Deliberately short. The previous version topped this list up to targetCount
  // by appending candidates that ignore starMinSeparation — controlled test B
  // caught it returning six lights with eight separation violations. Nothing
  // downstream re-checks separation (gate 13 only checks reachability), so those
  // maps shipped with clustered lights. Returning fewer is the honest answer:
  // isStructurallyValid rejects on the count and the generator tries again.
  return chosen;
}

/**
 * Place a few trap tiles and the reward chest on free walkable cells. Because
 * these sit only on walkable tiles, they never change path validity, wall counts
 * or the guardian AI — they are purely additive overlays on the finished maze.
 *
 * ROTA-CHEST-REWARDS-01: this is the old `chooseTrapsAndShield`, renamed. The
 * chest keeps the shield's exact placement rule — a cell around
 * `chestTargetDistance` from the start, off the lights and the start zone,
 * preferring open ground — because that rule already produced "a detour worth
 * considering", which is precisely what the chest is.
 */
function chooseTrapsAndChest(
  walls: Set<string>,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  stars: GridPosition[],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
): { traps: GridPosition[]; chest: GridPosition | null } {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const distances = getReachableDistances(playerStart, walls);
  const blocked = new Set<string>([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
    ...START_SAFE_CELLS.map(posKey),
    ...stars.map(posKey),
  ]);

  const chestCandidates: Array<{ pos: GridPosition; score: number }> = [];
  distances.forEach((distance, key) => {
    const pos = keyToPosition(key);
    if (blocked.has(key) || walls.has(key)) return;
    if (distance < profile.chestMinStartDistance) return;

    const exitDistance = findPathLength(pos, exitPosition, walls) ?? 0;
    chestCandidates.push({
      pos,
      score:
        30 - Math.abs(distance - profile.chestTargetDistance) * 4 +
        exitDistance * 0.6 +
        getNeighbors(pos, walls).length,
    });
  });
  chestCandidates.sort((a, b) => b.score - a.score);
  const chest = chestCandidates[0]?.pos ?? null;
  if (chest) blocked.add(posKey(chest));

  // ROTA-MAPS-DIFFICULTY-01: traps are placed for the mechanic they will carry,
  // not for spacing. The score is the defender's detour if that cell became
  // impassable, plus a junction bonus — and a cell that would isolate the
  // defender scores zero and is never chosen. Distance from the start is now
  // only a floor, not the ranking.
  const baseGuardianPath =
    findPathLength(guardianStart, playerStart, walls) ?? null;
  const trapCandidates: Array<{ pos: GridPosition; score: number }> = [];
  distances.forEach((distance, key) => {
    const pos = keyToPosition(key);
    if (blocked.has(key) || walls.has(key)) return;
    if (distance < profile.trapMinStartDistance) return;
    if (stars.some((star) => manhattanDistance(star, pos) < 2)) return;

    const future = scoreTrapForFuture(
      pos,
      walls,
      guardianStart,
      playerStart,
      baseGuardianPath,
    );
    if (future <= 0) return; // would seal the defender off, or change nothing
    trapCandidates.push({ pos, score: future + routeRandom() * 0.25 });
  });
  trapCandidates.sort((a, b) => b.score - a.score);

  /**
   * ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE: the set that SPAWNS has to be safe for
   * every combination the Explorer could plausibly light up.
   *
   * The previous analysis found 68 trap pairs that, active together, would leave
   * the defender with no route or the portal region with no door. Handling that
   * at runtime would mean an invisible rule — "this one you may light, that one
   * you may not" — which no player can learn. So the incompatibility is resolved
   * here instead: a candidate only joins the set if it stays safe alongside
   * every trap already chosen.
   *
   * Both defenders are considered. The Sentinel is not in the runtime yet, but
   * its region is a property of the map, so the check is available today: at
   * least one access to the portal zone must survive.
   */
  const portalZoneKeys = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 2) portalZoneKeys.add(cellKey);
  });
  const portalAccessCells: GridPosition[] = [];
  portalZoneKeys.forEach((cellKey) => {
    getNeighbors(keyToPosition(cellKey), walls).forEach((next) => {
      const nextKey = posKey(next);
      if (!portalZoneKeys.has(nextKey) && !portalAccessCells.some((a) => positionsEqual(a, next))) {
        portalAccessCells.push(next);
      }
    });
  });

  const combinationIsSafe = (cells: GridPosition[]): boolean => {
    const blocked = new Set(cells.map(posKey));
    // The defender must keep a way to the Explorer...
    if (findPathCells(guardianStart, playerStart, walls, blocked) === null) return false;
    // ...and the portal region must keep at least one usable door.
    if (portalAccessCells.length === 0) return true;
    return portalAccessCells.some(
      (access) => findPathCells(exitPosition, access, walls, blocked) !== null,
    );
  };

  const traps: GridPosition[] = [];
  const accepts = (candidate: GridPosition): boolean => {
    if (!combinationIsSafe([...traps, candidate])) return false;
    // Every pair, not just the full set: the Explorer decides the order.
    return traps.every((trap) => combinationIsSafe([trap, candidate]));
  };

  const target = getTrapCount(difficulty, routeStage);
  for (const candidate of trapCandidates) {
    if (traps.length >= target) break;
    if (
      traps.some(
        (trap) => manhattanDistance(trap, candidate.pos) < profile.trapMinSeparation,
      )
    ) {
      continue;
    }
    if (accepts(candidate.pos)) traps.push(candidate.pos);
  }

  // Second pass ignores spacing but never safety: a sparser set is acceptable,
  // an unsafe one is not.
  for (const candidate of trapCandidates) {
    if (traps.length >= target) break;
    if (traps.some((trap) => positionsEqual(trap, candidate.pos))) continue;
    if (accepts(candidate.pos)) traps.push(candidate.pos);
  }

  return { traps, chest };
}

/**
 * Biconnected decomposition of the walkable board, computed once per candidate.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-GRAPH-PERF-CLOSE — the contract this replaces,
 * stated exactly:
 *
 *   hasAlternativeRoute(s, t) = s and t are connected, AND removing any single
 *   interior cell of one shortest s->t path still leaves them connected.
 *
 * A cell that separates s from t must lie on EVERY s->t path, and therefore on
 * the shortest one — so the old loop was testing precisely "no cut vertex
 * separates s from t". In a connected graph that is equivalent to "s and t lie
 * in a common biconnected component": the block-cut tree path between two
 * vertices of the same block contains no cut vertex.
 *
 * The old form cost one graph search per interior cell, and
 * `routeCellsHaveEscape` ran it once per route cell — O(route x path) searches,
 * hundreds per candidate, which measured 5.3 s at p90 on Rota 3 Desafiador.
 * One Tarjan pass is O(V+E) and answers every pair in constant time.
 *
 * Adjacency and the degenerate cases are preserved deliberately: s === t is
 * vacuously true in the old code (empty interior), and adjacent cells share the
 * block formed by their own edge.
 */
interface BoardBlocks {
  /** Block ids each walkable cell belongs to. Cut vertices belong to several. */
  blocksOf: Map<string, number[]>;
  /** Connected-component id per cell, so disconnection is still detectable. */
  componentOf: Map<string, number>;
}

function decomposeBoardBlocks(walls: Set<string>): BoardBlocks {
  const blocksOf = new Map<string, number[]>();
  const componentOf = new Map<string, number>();
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  let timer = 0;
  let blockId = 0;
  let componentId = 0;

  const addBlock = (cellKey: string, id: number) => {
    const list = blocksOf.get(cellKey);
    if (!list) blocksOf.set(cellKey, [id]);
    else if (!list.includes(id)) list.push(id);
  };

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const root = { row, col };
      const rootKey = posKey(root);
      if (walls.has(rootKey) || discovery.has(rootKey)) continue;

      const component = componentId;
      componentId += 1;
      // Iterative DFS with an explicit edge stack (Tarjan's block algorithm).
      const edgeStack: Array<[string, string]> = [];
      const frame: Array<{
        cell: GridPosition;
        parent: string | null;
        neighbours: GridPosition[];
        index: number;
      }> = [{ cell: root, parent: null, neighbours: getNeighbors(root, walls), index: 0 }];
      discovery.set(rootKey, timer);
      low.set(rootKey, timer);
      componentOf.set(rootKey, component);
      timer += 1;

      while (frame.length > 0) {
        const top = frame[frame.length - 1];
        const topKey = posKey(top.cell);

        if (top.index < top.neighbours.length) {
          const next = top.neighbours[top.index];
          top.index += 1;
          const nextKey = posKey(next);
          if (nextKey === top.parent) continue;

          if (!discovery.has(nextKey)) {
            edgeStack.push([topKey, nextKey]);
            discovery.set(nextKey, timer);
            low.set(nextKey, timer);
            componentOf.set(nextKey, component);
            timer += 1;
            frame.push({
              cell: next,
              parent: topKey,
              neighbours: getNeighbors(next, walls),
              index: 0,
            });
          } else if ((discovery.get(nextKey) ?? 0) < (discovery.get(topKey) ?? 0)) {
            // Back edge.
            edgeStack.push([topKey, nextKey]);
            low.set(topKey, Math.min(low.get(topKey) ?? 0, discovery.get(nextKey) ?? 0));
          }
          continue;
        }

        frame.pop();
        const parentKey = top.parent;
        if (parentKey === null) continue;

        low.set(parentKey, Math.min(low.get(parentKey) ?? 0, low.get(topKey) ?? 0));

        // Parent is an articulation point for this child: pop one block.
        if ((low.get(topKey) ?? 0) >= (discovery.get(parentKey) ?? 0)) {
          const id = blockId;
          blockId += 1;
          for (;;) {
            const edge = edgeStack.pop();
            if (!edge) break;
            addBlock(edge[0], id);
            addBlock(edge[1], id);
            if (edge[0] === parentKey && edge[1] === topKey) break;
          }
        }
      }
    }
  }

  return { blocksOf, componentOf };
}

/** Same verdict as the old BFS rule, in constant time. */
function sharesBlock(
  blocks: BoardBlocks,
  start: GridPosition,
  target: GridPosition,
): boolean {
  const a = posKey(start);
  const b = posKey(target);
  if (a === b) return blocks.componentOf.has(a); // vacuously true, if it exists
  const componentA = blocks.componentOf.get(a);
  const componentB = blocks.componentOf.get(b);
  if (componentA === undefined || componentB === undefined) return false;
  if (componentA !== componentB) return false; // not connected at all
  const listA = blocks.blocksOf.get(a);
  const listB = blocks.blocksOf.get(b);
  if (!listA || !listB) return false;
  return listA.some((id) => listB.includes(id));
}

/**
 * The route the Explorer actually has to walk: every light, in the cheapest
 * order, then the portal. The old metrics measured start -> portal, which is
 * not the task and understates the journey.
 */
interface ObjectiveRoute {
  moves: number;
  cells: GridPosition[];
}

/**
 * Every cell that is not admissible, treated as a wall for pathfinding only.
 * Degrees, blocks and the gates themselves keep measuring the real walls.
 */
function restrictToAdmissible(
  walls: Set<string>,
  admissible: Set<string>,
): Set<string> {
  const restricted = new Set(walls);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellKey = `${row},${col}`;
      if (!admissible.has(cellKey)) restricted.add(cellKey);
    }
  }
  return restricted;
}

function computeObjectiveRoute(
  playerStart: GridPosition,
  stars: GridPosition[],
  exitPosition: GridPosition,
  walls: Set<string>,
  admissible?: Set<string>,
): ObjectiveRoute | null {
  // With an admissible set the search is confined to it, and nothing else about
  // the route changes: same node list, same permutation search, same cost, same
  // deterministic tie-break. It simply cannot pick a cell the escape-width
  // contract forbids.
  const graph = admissible ? restrictToAdmissible(walls, admissible) : walls;
  const nodes = [playerStart, ...stars, exitPosition];
  const size = nodes.length;
  const cost: number[][] = [];
  for (let i = 0; i < size; i += 1) {
    const distances = getReachableDistances(nodes[i], graph);
    cost.push(nodes.map((node) => distances.get(posKey(node)) ?? Number.POSITIVE_INFINITY));
  }

  const exitIndex = size - 1;
  const lightIndexes = stars.map((_, index) => index + 1);
  let bestOrder: number[] | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;

  const walk = (remaining: number[], order: number[], total: number) => {
    if (total >= bestTotal) return;
    if (remaining.length === 0) {
      const last = order.length ? order[order.length - 1] : 0;
      const full = total + cost[last][exitIndex];
      if (full < bestTotal) {
        bestTotal = full;
        bestOrder = [...order];
      }
      return;
    }
    const from = order.length ? order[order.length - 1] : 0;
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining[i];
      walk(
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
        [...order, next],
        total + cost[from][next],
      );
    }
  };
  walk(lightIndexes, [], 0);

  if (!bestOrder || !Number.isFinite(bestTotal)) return null;

  const cells: GridPosition[] = [];
  let cursor = 0;
  for (const index of [...bestOrder, exitIndex]) {
    const segment = findPathCells(nodes[cursor], nodes[index], graph);
    if (!segment) return null;
    cells.push(...(cells.length ? segment.slice(1) : segment));
    cursor = index;
  }
  return { moves: bestTotal, cells };
}

/**
 * Walk the objective route and count what the Explorer is actually asked to do.
 * A step is "forced" when the only way on is a single cell — the map is moving
 * the piece, not the player. The baseline had forced runs of up to 19 steps.
 */
function measureRouteFlow(route: ObjectiveRoute, walls: Set<string>) {
  let decisions = 0;
  let longestForcedStreak = 0;
  let streak = 0;

  for (let index = 0; index < route.cells.length - 1; index += 1) {
    const current = route.cells[index];
    const previous = index > 0 ? route.cells[index - 1] : null;
    const options = getNeighbors(current, walls).filter(
      (next) => !previous || !positionsEqual(next, previous),
    );
    if (options.length >= 2) {
      decisions += 1;
      streak = 0;
    } else {
      streak += 1;
      longestForcedStreak = Math.max(longestForcedStreak, streak);
    }
  }

  const steps = Math.max(1, route.cells.length - 1);
  return { decisions, longestForcedStreak, decisionRatio: decisions / steps };
}

/**
 * Dead ends are allowed when they hold something or sit on the route — risk,
 * reward, a detour worth taking. An "idle" dead end holds nothing and is far
 * from anywhere the Explorer goes: it is only board that looks like a mistake.
 */
function countIdleDeadEnds(
  walls: Set<string>,
  playerStart: GridPosition,
  routeCells: GridPosition[],
  payload: GridPosition[],
): number {
  const routeKeys = new Set(routeCells.map(posKey));
  const payloadKeys = new Set(payload.map(posKey));
  const distances = getReachableDistances(playerStart, walls);
  let idle = 0;

  distances.forEach((_, key) => {
    const pos = keyToPosition(key);
    if (positionsEqual(pos, playerStart)) return;
    if (getNeighbors(pos, walls).length > 1) return;
    if (payloadKeys.has(key) || routeKeys.has(key)) return;
    const touchesRoute = getNeighbors(pos, walls).some((next) =>
      routeKeys.has(posKey(next)),
    );
    if (!touchesRoute) idle += 1;
  });

  return idle;
}

/**
 * How much a cell would matter once the red trap becomes active.
 *
 * The future rule: the Explorer keeps crossing a lit trap, the defender cannot.
 * So a trap is only worth placing where blocking it would genuinely lengthen the
 * defender's route AND leave it another way round. A trap that changes nothing
 * is decoration; a trap that seals the defender off ends the chase. 79% of the
 * baseline maps had at least one trap worth nothing.
 */
function scoreTrapForFuture(
  cell: GridPosition,
  walls: Set<string>,
  guardianStart: GridPosition,
  playerStart: GridPosition,
  baseGuardianPath: number | null,
): number {
  if (baseGuardianPath === null) return 0;
  const blocked = new Set([posKey(cell)]);
  const detoured = findPathCells(guardianStart, playerStart, walls, blocked);
  if (!detoured) return 0; // would isolate the defender — never acceptable

  const detour = detoured.length - 1 - baseGuardianPath;
  const degree = getNeighbors(cell, walls).length;
  const reach = getReachableDistances(guardianStart, walls).size;
  const reachWithTrap = (() => {
    const distances = new Map<string, number>([[posKey(guardianStart), 0]]);
    const queue: GridPosition[] = [guardianStart];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of getNeighbors(current, walls)) {
        const key = posKey(next);
        if (distances.has(key) || blocked.has(key)) continue;
        distances.set(key, 0);
        queue.push(next);
      }
    }
    return distances.size;
  })();

  return (
    detour * 14 +
    (degree >= 3 ? 22 : degree === 2 ? 8 : 0) +
    Math.min(20, (reach - reachWithTrap) * 2)
  );
}

/**
 * Escape horizon: can the Explorer always keep moving from here?
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-CLOSE: three maps produced a genuine checkmate —
 * one legal move, no survival horizon, and no earlier decision that avoided it.
 * The shape was always the same: the objective route ran through a cell that is
 * a cul-de-sac, so two defenders converging had nothing to be dodged around.
 *
 * The gate is structural and general, not a per-seed exception. Every cell the
 * Explorer is expected to walk must lie on a cycle — reachable from the start by
 * a route that does not need that cell's single neighbour. Where that holds, a
 * checkmate needs the Explorer to have walked into it, which is legitimate
 * consequence. Corners of the board still exist; they just stop being on the
 * route the game asks the Explorer to take.
 */
function routeCellsHaveEscape(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  routeCells: GridPosition[],
  walls: Set<string>,
  blocks: BoardBlocks,
): boolean {
  // ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL: the topological rule below proves the
  // MAP always has a way round. It says nothing about a STATE, because
  // defenders occupy cells and occupation is not a wall. Reachable-state
  // analysis over the dual model showed the signature plainly: 26 of 27
  // collapses happened on a cell with two or fewer ways out — one defender per
  // exit and the Explorer is sealed with no wall involved.
  //
  // So the cheap, general gate is about ESCAPE WIDTH, not about seeds. A cell
  // with three ways out cannot be closed by two defenders. That width is only
  // required where the two of them actually converge — the portal region and
  // its doors, which is where the Sentinel lives and the Hunter arrives. The
  // rest of the board keeps its corridors and its corners.
  const convergence = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 3) convergence.add(cellKey);
  });

  for (const cell of routeCells) {
    if (positionsEqual(cell, playerStart)) continue;
    const exits = getNeighbors(cell, walls).length;
    // A cell with a single way in and out is where a dual pincer becomes a
    // checkmate rather than a scare — anywhere on the board.
    if (exits < 2) return false;
    // Inside the convergence region the Explorer needs a third way out.
    if (convergence.has(posKey(cell)) && !positionsEqual(cell, exitPosition) && exits < 3) {
      return false;
    }
  }
  // The mid-route cells must also stay reachable when any single one of them is
  // blocked: that is what guarantees a way round rather than a way back only.
  return routeCells
    .slice(1, -1)
    .every((cell) => sharesBlock(blocks, playerStart, cell));
}

/**
 * The cells a route is allowed to touch, stated once instead of discovered by
 * trial.
 *
 * ROTA-01A-ESCAPE-ROUTE-GENERATION: `routeCellsHaveEscape` judges a route, but
 * every condition it applies depends only on the WALLS — degree, the portal
 * convergence region, the biconnected block. So admissibility is a property of
 * the board, and the set below is the exact set of cells that can appear in a
 * route the gate would accept, with the same two exemptions the gate makes:
 * the Explorer's own cell, and the portal.
 *
 * That gives two things the generator lacked. Route selection can be confined
 * to this set instead of producing a route and hoping. And a candidate whose
 * portal is not reachable through it can be dropped before any expensive work,
 * because a route that satisfies the gate provably cannot exist.
 *
 * The radius below intentionally mirrors the one inside `routeCellsHaveEscape`,
 * which is deliberately left untouched. The two are kept in step by the
 * equivalence test in `tools/validation/escape-generation-close.mjs`, which
 * compares this derivation against the real gate over tens of thousands of
 * candidates and fails on the first divergence.
 */
const PORTAL_CONVERGENCE_RADIUS = 3;

function admissibleRouteCells(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): Set<string> {
  const convergence = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= PORTAL_CONVERGENCE_RADIUS) convergence.add(cellKey);
  });

  const startKey = posKey(playerStart);
  const exitKey = posKey(exitPosition);
  const admissible = new Set<string>([startKey]);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const cellKey = posKey(pos);
      if (cellKey === startKey || walls.has(cellKey)) continue;
      const exits = getNeighbors(pos, walls).length;
      if (exits < 2) continue;
      if (cellKey === exitKey) {
        admissible.add(cellKey);
        continue;
      }
      if (convergence.has(cellKey) && exits < 3) continue;
      if (!sharesBlock(blocks, playerStart, pos)) continue;
      admissible.add(cellKey);
    }
  }
  return admissible;
}

/**
 * Can ANY route on this board satisfy the escape-width contract?
 *
 * A route runs from the Explorer to the portal and every cell after the first
 * must be admissible, so the portal has to be reachable through admissible
 * cells. When it is not, no choice of lights and no ordering can rescue the
 * candidate — the measured answer was 192 out of 192.
 *
 * Necessary, not sufficient: this says a route MIGHT exist, never that the map
 * is good. Every gate still runs afterwards. Being necessary is what makes it
 * safe to reject early — it can only discard candidates the final validator
 * would have discarded anyway.
 */
function escapeGeometryIsPossible(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): boolean {
  const admissible = admissibleRouteCells(playerStart, exitPosition, walls, blocks);
  const exitKey = posKey(exitPosition);
  if (!admissible.has(exitKey)) return false;

  const seen = new Set<string>([posKey(playerStart)]);
  const queue: GridPosition[] = [playerStart];
  while (queue.length > 0) {
    const current = queue.shift() as GridPosition;
    if (posKey(current) === exitKey) return true;
    for (const next of getNeighbors(current, walls)) {
      const nextKey = posKey(next);
      if (seen.has(nextKey) || !admissible.has(nextKey)) continue;
      seen.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

/**
 * The objective route the gates will judge.
 *
 * `computeObjectiveRoute` minimises moves and knows nothing about escape width,
 * so on 63 of 255 measured rejections it picked a route through a two-exit cell
 * beside the portal while an admissible route existed on the same walls, the
 * same lights and the same portal. The map was fine; the route was not.
 *
 * Cheapest route first, exactly as before — so every candidate that already
 * passes keeps the identical route and no accepted map changes. Only when that
 * route is inadmissible is the same search repeated inside the admissible
 * subgraph: same cost function, same tie-break, still the shortest route, now
 * chosen from routes the contract permits.
 *
 * If no admissible route exists the original is returned unchanged and the gate
 * rejects it, as it always did. Nothing is relaxed to make a map pass.
 */
function resolveObjectiveRoute(
  playerStart: GridPosition,
  stars: GridPosition[],
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): ObjectiveRoute | null {
  const cheapest = computeObjectiveRoute(playerStart, stars, exitPosition, walls);
  if (!cheapest) return null;
  if (routeCellsHaveEscape(playerStart, exitPosition, cheapest.cells, walls, blocks)) {
    return cheapest;
  }
  const admissible = admissibleRouteCells(playerStart, exitPosition, walls, blocks);
  return (
    computeObjectiveRoute(playerStart, stars, exitPosition, walls, admissible) ?? cheapest
  );
}

/**
 * Does this map offer any strategic identity at all?
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL: one map (R1/medium/5659) had two portal
 * doors, no contextual trade-off and no breakable wall — nothing to decide. It
 * was solvable and structurally clean, and still not worth playing. Cheap
 * topological proxies for the families, checked before the expensive work:
 *
 *   - three or more doors into the portal region (family C), or
 *   - a genuinely different second route to the portal (family A), or
 *   - a connecting corridor between regions (family B).
 *
 * Family D is deliberately absent: a breakable wall is optional and must never
 * be fabricated to rescue a map.
 */
function hasStrategicIdentity(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
): boolean {
  const zoneKeys = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 2) zoneKeys.add(cellKey);
  });
  const accesses = new Set<string>();
  zoneKeys.forEach((cellKey) => {
    getNeighbors(keyToPosition(cellKey), walls).forEach((next) => {
      if (!zoneKeys.has(posKey(next))) accesses.add(posKey(next));
    });
  });
  if (accesses.size >= 3) return true; // family C

  const direct = findPathCells(playerStart, exitPosition, walls);
  if (direct) {
    const avoid = new Set(direct.slice(1, -1).map(posKey));
    const second = findPathCells(playerStart, exitPosition, walls, avoid);
    // Family A: a second route that is genuinely a different journey, not a
    // one-cell wobble around the same corridor.
    if (second && second.length - direct.length >= 3) return true;
  }

  // Family B: a corridor of degree-2 cells joining regions.
  let corridor = 0;
  let longest = 0;
  const distances = getReachableDistances(playerStart, walls);
  distances.forEach((_, cellKey) => {
    const degree = getNeighbors(keyToPosition(cellKey), walls).length;
    if (degree === 2) {
      corridor += 1;
      longest = Math.max(longest, corridor);
    } else {
      corridor = 0;
    }
  });
  return longest >= 3;
}

/*
 * ROTA-CHEST-REWARDS-01 (revisao pos-playtest): a certificacao de paredes
 * quebraveis vivia aqui e decidia quais paredes a Picareta podia abrir.
 *
 * O produto mudou: a Picareta abre QUALQUER parede interna do labirinto ao lado
 * do Explorer, e a dificuldade passou a ser escolher qual. A regra deixou de ser
 * uma permissao de runtime, entao saiu da producao — mas nao foi apagada, porque
 * a medicao que ela produziu (324 mapas) e o motivo pelo qual a mecanica existe.
 *
 * Ela agora vive como analise offline em
 * `tools/validation/breakable-wall-certifier.mjs`, e nada em src/ a importa.
 * Ver `docs/archive/route-chest-rewards-01/pickaxe-free-wall-choice-contract.md`.
 */
/**
 * Structural pre-check: everything `isValidMap` decides that does not depend on
 * traps, the chest or the breakable walls.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-RUNTIME-PERF: trap selection is by far the most
 * expensive step in building a candidate. `scoreTrapForFuture` runs two graph
 * searches for EVERY reachable cell, and `combinationIsSafe` adds more per
 * accepted trap — roughly a hundred searches per candidate. On Rota 3
 * Desafiador the generator rejects ~90 candidates before it accepts one, so
 * nearly all of that work was spent on maps that were already doomed on
 * geometry. Measured in production: p90 7.0 s, max 15.1 s.
 *
 * This runs first, on the cheap half of the candidate. It is a strict subset of
 * the full check — the trap, chest and idle-dead-end rules still run in
 * `isValidMap` afterwards — so a map accepted here is not accepted by a weaker
 * standard, it has simply not been fully judged yet. No gate is removed and no
 * threshold moves.
 */
/**
 * Everything a single candidate's geometry yields, computed once.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-PERF-FINAL-02: `isStructurallyValid` and
 * `isValidMap` were each building the block decomposition and solving the
 * objective route for the SAME walls — two of the two most expensive
 * operations, done twice per structurally valid candidate. This carries them
 * forward instead.
 *
 * It belongs to one attempt and nothing else: it is created inside
 * `buildCandidate`, handed straight to `isValidMap`, and dropped. There is no
 * global cache and therefore nothing that can go stale — if the walls change,
 * a new context is built from scratch.
 */
interface CandidateAnalysis {
  blocks: BoardBlocks;
  objective: ObjectiveRoute;
}

function isStructurallyValid(
  walls: Set<string>,
  grid: number[][],
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  collectibleStars: GridPosition[],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  precomputedBlocks?: BoardBlocks,
): CandidateAnalysis | null {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const brief = DIFFICULTY_PLAY_BRIEF[difficulty];
  const distances = getReachableDistances(PLAYER_START, walls);
  const pathLength = distances.get(posKey(exitPosition)) ?? null;
  if (pathLength === null || pathLength < getMinimumPathLength(routeStage)) return null;
  if (manhattanDistance(PLAYER_START, guardianStart) < profile.guardianMinStartDistance) return null;
  if (getNeighbors(PLAYER_START, walls).length < 2) return null;
  if (getNeighbors(guardianStart, walls).length < 2) return null;

  const limits = getWallLimits(difficulty, routeStage);
  const wallCount = countWalls(grid);
  if (wallCount < limits.min || wallCount > limits.max) return null;
  if (distances.size < profile.minReachableCells) return null;
  if (countStartZoneWalls(walls) > profile.maxStartZoneWalls) return null;
  if (countReachableJunctions(distances, walls) < profile.minJunctions) return null;

  if (collectibleStars.length !== getStarCount(difficulty, routeStage)) return null;
  const starsReachable = collectibleStars.every(
    (star) =>
      distances.has(posKey(star)) &&
      findPathLength(star, exitPosition, walls) !== null,
  );
  if (!starsReachable) return null;
  const starsSeparated = collectibleStars.every((star, index) =>
    collectibleStars.every(
      (other, otherIndex) =>
        index === otherIndex ||
        manhattanDistance(star, other) >=
          getStarMinSeparation(difficulty, routeStage),
    ),
  );
  if (!starsSeparated) return null;

  if (!hasStrategicIdentity(PLAYER_START, exitPosition, walls)) return null;
  // One decomposition answers the portal, every light and every route cell.
  const blocks = precomputedBlocks ?? decomposeBoardBlocks(walls);
  if (!sharesBlock(blocks, PLAYER_START, exitPosition)) return null;
  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {
    return null;
  }

  const objective = resolveObjectiveRoute(
    PLAYER_START,
    collectibleStars,
    exitPosition,
    walls,
    blocks,
  );
  if (!objective) return null;
  if (!routeCellsHaveEscape(PLAYER_START, exitPosition, objective.cells, walls, blocks)) {
    return null;
  }
  const flow = measureRouteFlow(objective, walls);
  if (flow.decisionRatio < brief.minDecisionRatio) return null;
  if (flow.longestForcedStreak > brief.maxForcedStreak) return null;
  return { blocks, objective };
}

function isValidMap(
  map: MazeMap,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  analysis?: CandidateAnalysis,
): boolean {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const distances = getReachableDistances(map.playerStart, map.walls);
  const pathLength = distances.get(posKey(map.exitPosition)) ?? null;
  const guardianDistance = manhattanDistance(map.playerStart, map.guardianStart);
  const wallCount = countWalls(map.grid);
  const limits = getWallLimits(difficulty, routeStage);
  const firstChoices = getNeighbors(map.playerStart, map.walls).length;
  const junctions = countReachableJunctions(distances, map.walls);
  const expectedLights = getStarCount(difficulty, routeStage);
  const expectedTraps = getTrapCount(difficulty, routeStage);
  const starsReachable = map.collectibleStars.every(
    (star) => distances.has(posKey(star)) && findPathLength(star, map.exitPosition, map.walls) !== null,
  );
  const starsSeparated = map.collectibleStars.every((star, index) =>
    map.collectibleStars.every(
      (other, otherIndex) =>
        index === otherIndex ||
        manhattanDistance(star, other) >=
          getStarMinSeparation(difficulty, routeStage),
    ),
  );
  const trapsValid = map.traps.every((trap) => {
    const distance = distances.get(posKey(trap));
    return (
      distance !== undefined &&
      distance >= profile.trapMinStartDistance &&
      !map.collectibleStars.some((star) => manhattanDistance(star, trap) < 2)
    );
  });
  const chestDistance = map.chest ? distances.get(posKey(map.chest)) : undefined;
  const chestUseful =
    chestDistance !== undefined && chestDistance >= profile.chestMinStartDistance;
  /**
   * ROTA-CHEST-REWARDS-01 (revisão pós-playtest): there used to be a gate here
   * requiring at least one CERTIFIED breakable wall. It is gone because the
   * Pickaxe no longer asks the generator for permission — every wall on the
   * board is a legal target, and every certified map has walls by definition
   * (the wall-count limits per mode are 13-28). Nothing to check.
   */

  // --- play quality, not just solvability -----------------------------------
  const brief = DIFFICULTY_PLAY_BRIEF[difficulty];
  // Decomposed first because the route resolution needs it: without that, a map
  // certified through `analysis` could be re-judged here against a different,
  // inadmissible route and fail its own acceptance.
  const blocks = analysis?.blocks ?? decomposeBoardBlocks(map.walls);
  const objective =
    analysis?.objective ??
    resolveObjectiveRoute(
      map.playerStart,
      map.collectibleStars,
      map.exitPosition,
      map.walls,
      blocks,
    );
  if (!objective) return false;
  const flow = measureRouteFlow(objective, map.walls);
  const idleDeadEnds = countIdleDeadEnds(
    map.walls,
    map.playerStart,
    objective.cells,
    [...map.collectibleStars, ...map.traps, ...(map.chest ? [map.chest] : [])],
  );
  const alternativeRoute = sharesBlock(blocks, map.playerStart, map.exitPosition);
  const lightsHaveAlternatives = map.collectibleStars.every((star) =>
    sharesBlock(blocks, map.playerStart, star),
  );

  const routeHasEscape = routeCellsHaveEscape(
    map.playerStart,
    map.exitPosition,
    objective.cells,
    map.walls,
    blocks,
  );

  const strategicIdentity = hasStrategicIdentity(
    map.playerStart,
    map.exitPosition,
    map.walls,
  );

  return (
    alternativeRoute &&
    lightsHaveAlternatives &&
    routeHasEscape &&
    strategicIdentity &&
    flow.decisionRatio >= brief.minDecisionRatio &&
    flow.longestForcedStreak <= brief.maxForcedStreak &&
    idleDeadEnds <= brief.maxIdleDeadEnds &&
    pathLength !== null &&
    pathLength >= getMinimumPathLength(routeStage) &&
    guardianDistance >= profile.guardianMinStartDistance &&
    firstChoices >= 2 &&
    wallCount >= limits.min &&
    wallCount <= limits.max &&
    distances.size >= profile.minReachableCells &&
    junctions >= profile.minJunctions &&
    countStartZoneWalls(map.walls) <= profile.maxStartZoneWalls &&
    map.collectibleStars.length === expectedLights &&
    starsReachable &&
    starsSeparated &&
    map.traps.length === expectedTraps &&
    trapsValid &&
    chestUseful &&
    getNeighbors(map.guardianStart, map.walls).length >= 2
  );
}

/**
 * Build one candidate map from an explicit template/exit choice.
 *
 * Split out of `generateMaze` so both the randomised phase and the deterministic
 * recovery sweep run through EXACTLY the same construction and the same gates.
 * There is no second, weaker path.
 */
function buildCandidate(
  template: number[][],
  exitPosition: GridPosition,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
): { map: MazeMap; analysis: CandidateAnalysis } | null {
  const preliminaryWalls = gridToWalls(template);
  const guardianStart = chooseGuardianStart(
    preliminaryWalls,
    exitPosition,
    routeStage,
    difficulty,
  );
  const grid = randomizeWalls(
    template,
    difficulty,
    routeStage,
    PLAYER_START,
    guardianStart,
    exitPosition,
  );
  const walls = gridToWalls(grid);
  walls.delete(posKey(PLAYER_START));
  walls.delete(posKey(guardianStart));
  walls.delete(posKey(exitPosition));

  // The decomposition depends only on walls, so it exists before the lights and
  // can be shared with the selection that needs it.
  const blocks = decomposeBoardBlocks(walls);

  // Nothing chosen after this point can rescue a board whose portal cannot be
  // reached through admissible cells, and 192 of 192 measured escape-width
  // rejections were exactly that. Refusing here skips light selection, the
  // permutation search over the route and trap placement for a candidate that
  // was already lost. The condition is necessary for the final gate, so this
  // can only discard maps the validator would have discarded.
  if (!escapeGeometryIsPossible(PLAYER_START, exitPosition, walls, blocks)) {
    return null;
  }

  const collectibleStars = chooseStars(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    difficulty,
    routeStage,
    blocks,
  );

  // Cheap half first. Trap selection is the expensive half and only runs for
  // candidates that already satisfy the geometry.
  const analysis = isStructurallyValid(
    walls,
    grid,
    guardianStart,
    exitPosition,
    collectibleStars,
    difficulty,
    routeStage,
    blocks,
  );
  if (!analysis) return null;

  const { traps, chest } = chooseTrapsAndChest(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    collectibleStars,
    difficulty,
    routeStage,
  );
  return {
    map: {
      grid,
      walls,
      playerStart: PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
      traps,
      chest,
    },
    analysis,
  };
}

/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE: the generator never returns an
 * uncertified map.
 *
 * It used to end with "attempts exhausted -> build one anyway and return it
 * unvalidated". In a 1080-map sweep that fired once, on route 3 / Desafiador —
 * the tightest combination — and that single map reached the Explorer without
 * having passed identity, escape width, trade-offs, trap safety or portal-zone
 * checks. One in a thousand is still a map the product promised and did not
 * deliver.
 *
 * Two phases now, and BOTH end at the same `isValidMap`:
 *
 *   1. randomised search, as before;
 *   2. a bounded deterministic sweep over every template x every exit candidate.
 *      Wall randomisation is stepped down to zero across the sweep, so the last
 *      rounds present the bare template — the layout that was selected by
 *      structural search precisely because it satisfies these gates.
 *
 * If both phases somehow fail, the function throws. A thrown error is a loud,
 * fixable bug; a silently uncertified map is a broken promise the player meets
 * in the middle of a route.
 */
export function generateMaze(
  difficulty: DifficultyLevel,
  routeNumber = 1,
): MazeMap {
  // ROTA-DIFFICULTY-04C: a no-op unless a diagnostic seed is armed, and nothing
  // in the product arms one. When armed it restarts the seeded stream here, so
  // a scenario is the same board on Launch, on Start and on every Restart.
  beginSeededGeneration();
  const routeStage = getRouteStage(routeNumber);
  const exitCandidates = ROUTE_STAGE_EXIT_CANDIDATES[routeStage];
  const templates = getRouteStageTemplates(routeStage);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const template = randomItem(templates);
    const candidate = buildCandidate(
      template,
      randomItem(exitCandidates),
      difficulty,
      routeStage,
    );
    if (
      candidate &&
      isValidMap(candidate.map, difficulty, routeStage, candidate.analysis)
    ) {
      return candidate.map;
    }
  }

  // --- recovery sweep: same gates, deterministic order, bounded -------------
  for (let round = 0; round < RECOVERY_ROUNDS; round++) {
    for (const template of templates) {
      for (const exitPosition of exitCandidates) {
        for (let retry = 0; retry < RECOVERY_RETRIES_PER_SLOT; retry++) {
          const candidate = buildCandidate(
            template,
            exitPosition,
            difficulty,
            routeStage,
          );
          if (
            candidate &&
            isValidMap(candidate.map, difficulty, routeStage, candidate.analysis)
          ) {
            return candidate.map;
          }
        }
      }
    }
  }


  throw new Error(
    `Route map generation failed all gates for stage ${routeStage} (${difficulty}). ` +
      "This is a generator bug, not a runtime condition: no uncertified map is ever returned.",
  );
}
