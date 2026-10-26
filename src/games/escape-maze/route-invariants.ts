import { COLS, ROWS } from "@/games/escape-maze/route-config";
import type { MazeMap } from "@/games/escape-maze/route-generation";
import {
  currentWalls,
  getReachableDistances,
  keyToPosition,
  posKey,
  positionsEqual,
} from "@/games/escape-maze/route-geometry";
import type { GridPosition } from "@/types/game";

/**
 * ROUTE-C4 — the Rota's runtime contract: is this logical state of a Route
 * possible, and can every unfinished objective still be reached on its walls?
 *
 * `inspectDynamicMazeState`, the snapshot it reads (`DynamicMazeStateSnapshot`)
 * and the verdict it returns (`DynamicSolvabilityInspection`) moved out of
 * `useEscapeMaze.ts` verbatim — no body, issue code, order of checks, objective
 * or comment changed. The state's own vocabulary moved with them: the snapshot
 * is written in `GameStatus` and `ChestReward`, and this module may not depend
 * on the hook to name them. The hook imports all five back and re-exports
 * them, so what other modules import from it is unchanged.
 *
 * Pure: a snapshot in, a new verdict out — its effective walls are a new set,
 * never `mazeMap.walls` itself. It reads the board's size and the graph
 * primitives, and `MazeMap` only as a type — never React, the hook, the
 * defenders, the RNG, UI, Babylon or sounds. When to ask (every render, from
 * the state the hook holds) stays the hook's business, and "solvable" stays
 * topological: whether the Explorer wins against the Hunter and the Sentinel
 * is the exact dynamic solver's question, not this one.
 */

export type GameStatus = "setup" | "playing" | "won" | "lost";

/**
 * The two rewards the Chest offers in v1. The Explorer takes exactly one.
 *
 * "Never both" is a property of the type, not a rule someone has to remember to
 * check: there is a single slot, so holding one is holding not-the-other.
 */
export type ChestReward = "pickaxe" | "second-chance";

export interface DynamicMazeStateSnapshot {
  mazeMap: MazeMap;
  player: GridPosition;
  guardian: GridPosition;
  sentinel: GridPosition;
  collectedStars: Iterable<string>;
  triggeredTraps: Iterable<string>;
  chestOpened: boolean;
  rewardSelected: ChestReward | null;
  rewardSpent: boolean;
  brokenWall: string | null;
  /**
   * ROTA2-DYNAMIC-TRAPS-01: the walls dynamic traps opened (route-state's
   * `trapOpenedWalls`). Optional so a snapshot written before Rota 2.0 still
   * reads as "nothing opened by a trap".
   */
  trapOpenedWalls?: Iterable<string>;
  /**
   * ROTA2-DEPENDENT-OBJECTIVES-02: the marked passage the Route's portal waits
   * for (route-objectives.ts) — the linked wall on Routes 2 and 3, null on
   * Route 1. Optional so an older snapshot reads as "no passage objective".
   */
  requiredPassageWall?: string | null;
  status: GameStatus;
}

export interface DynamicSolvabilityInspection {
  valid: boolean;
  topologicallySolvable: boolean;
  solvable: boolean;
  issues: string[];
  effectiveWalls: Set<string>;
  unreachableObjectives: string[];
}

/**
 * Pure runtime contract for Rota's logical board.
 *
 * "Solvable" here is deliberately topological: every unfinished objective can
 * still be reached on the current wall graph. Mobile defenders remain threats,
 * not permanent walls, and their adversarial outcome is analysed separately by
 * the exact dynamic solver. This function detects impossible state, stale wall
 * topology and genuine objective softlocks without depending on React or render.
 *
 * ROTA2-DYNAMIC-TRAPS-01: the wall graph is the CURRENT one — the certified
 * walls minus the Pickaxe's wall and the walls dynamic traps opened — and the
 * snapshot's trap links and opened walls are themselves checked: a link must
 * name one of the board's traps and walls, and an opened wall must be what an
 * armed link opened (ten more issue codes, all `TRAP_LINK_*`,
 * `TRAP_OPENED_WALL_*` or `ARMED_TRAP_LINK_*`).
 */
export function inspectDynamicMazeState(
  snapshot: DynamicMazeStateSnapshot,
): DynamicSolvabilityInspection {
  const {
    mazeMap,
    player,
    guardian,
    sentinel,
    chestOpened,
    rewardSelected,
    rewardSpent,
    brokenWall,
    status,
  } = snapshot;
  const issues: string[] = [];
  const trapOpenedWalls = [...(snapshot.trapOpenedWalls ?? [])];
  // ROTA2-DYNAMIC-TRAPS-01: the walls as they stand, through the same
  // derivation the turn and the board use — never a copy of their own.
  const effectiveWalls = new Set(currentWalls(mazeMap.walls, brokenWall, trapOpenedWalls));
  if (brokenWall !== null && !mazeMap.walls.has(brokenWall)) {
    issues.push("BROKEN_WALL_NOT_IN_BASE_MAP");
  }

  const collected = new Set(snapshot.collectedStars);
  const armedTraps = new Set(snapshot.triggeredTraps);
  const starKeys = new Set(mazeMap.collectibleStars.map(posKey));
  const trapKeys = new Set(mazeMap.traps.map(posKey));
  const insideBoard = (cell: GridPosition) =>
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < ROWS &&
    cell.col >= 0 &&
    cell.col < COLS;
  const mobile = [
    ["PLAYER", player],
    ["HUNTER", guardian],
    ["SENTINEL", sentinel],
  ] as const;
  for (const [label, cell] of mobile) {
    if (!insideBoard(cell)) issues.push(`${label}_OUT_OF_BOUNDS`);
    else if (effectiveWalls.has(posKey(cell))) issues.push(`${label}_ON_WALL`);
  }

  if (positionsEqual(guardian, sentinel)) issues.push("DEFENDER_CO_OCCUPANCY");
  if (
    status === "playing" &&
    (positionsEqual(player, guardian) || positionsEqual(player, sentinel))
  ) {
    issues.push("PLAYER_DEFENDER_CO_OCCUPANCY");
  }
  if (positionsEqual(guardian, mazeMap.exitPosition)) issues.push("HUNTER_ON_PORTAL");
  if (positionsEqual(sentinel, mazeMap.exitPosition)) issues.push("SENTINEL_ON_PORTAL");

  for (const key of collected) {
    if (!starKeys.has(key)) issues.push("UNKNOWN_COLLECTED_LIGHT");
  }
  for (const key of armedTraps) {
    if (!trapKeys.has(key)) issues.push("UNKNOWN_ARMED_TRAP");
  }
  if (armedTraps.has(posKey(guardian))) issues.push("HUNTER_ON_ARMED_TRAP");
  if (armedTraps.has(posKey(sentinel))) issues.push("SENTINEL_ON_ARMED_TRAP");

  // --- ROTA2-DYNAMIC-TRAPS-01: the links the map carries, and what they did --
  // The map side: each link is one of the board's traps, opening one of its
  // walls, one link per trap and per wall, with the one mutation that exists.
  const links = mazeMap.trapLinks ?? [];
  const wallOfTrap = new Map<string, string>();
  const linkedWalls = new Set<string>();
  for (const link of links) {
    if (link.mutation.kind !== "open-wall") {
      issues.push("TRAP_LINK_UNKNOWN_MUTATION");
      continue;
    }
    const { wall } = link.mutation;
    if (!trapKeys.has(link.trap)) issues.push("TRAP_LINK_UNKNOWN_TRAP");
    if (!mazeMap.walls.has(wall) || !insideBoard(keyToPosition(wall))) {
      issues.push("TRAP_LINK_WALL_NOT_IN_BASE_MAP");
    }
    if (wallOfTrap.has(link.trap)) issues.push("TRAP_LINK_DUPLICATE_TRAP");
    if (linkedWalls.has(wall)) issues.push("TRAP_LINK_DUPLICATE_WALL");
    wallOfTrap.set(link.trap, wall);
    linkedWalls.add(wall);
  }
  // The state side: a wall a trap opened belongs to an armed link, once, and
  // is not also the Pickaxe's; an armed link's wall stands no more — opened by
  // its trap, or already by the Pickaxe (the trap then had nothing to open).
  const openedByTrap = new Set<string>();
  for (const wall of trapOpenedWalls) {
    if (!mazeMap.walls.has(wall)) issues.push("TRAP_OPENED_WALL_NOT_IN_BASE_MAP");
    if (openedByTrap.has(wall)) issues.push("TRAP_OPENED_WALL_TWICE");
    if (wall === brokenWall) issues.push("TRAP_OPENED_WALL_ALSO_BROKEN");
    const armedLink = [...wallOfTrap].some(
      ([trap, linked]) => linked === wall && armedTraps.has(trap),
    );
    if (!armedLink) issues.push("TRAP_OPENED_WALL_WITHOUT_ARMED_LINK");
    openedByTrap.add(wall);
  }
  for (const [trap, wall] of wallOfTrap) {
    if (armedTraps.has(trap) && !openedByTrap.has(wall) && wall !== brokenWall) {
      issues.push("ARMED_TRAP_LINK_WALL_STILL_CLOSED");
    }
  }

  if (!chestOpened) {
    if (rewardSelected !== null) issues.push("REWARD_BEFORE_CHEST");
    if (rewardSpent) issues.push("REWARD_SPENT_BEFORE_CHEST");
    if (brokenWall !== null) issues.push("WALL_BROKEN_BEFORE_CHEST");
    if (mazeMap.chest && positionsEqual(player, mazeMap.chest)) {
      issues.push("PLAYER_ON_UNOPENED_CHEST");
    }
  } else if (rewardSelected === null) {
    if (rewardSpent) issues.push("PENDING_REWARD_ALREADY_SPENT");
    if (mazeMap.chest && !positionsEqual(player, mazeMap.chest)) {
      issues.push("PENDING_REWARD_AWAY_FROM_CHEST");
    }
  }
  if (rewardSelected !== null && !chestOpened) issues.push("SELECTED_REWARD_WITH_CLOSED_CHEST");
  if (rewardSpent && rewardSelected === null) issues.push("SPENT_REWARD_WITHOUT_SELECTION");
  if (rewardSelected === "pickaxe" && rewardSpent && brokenWall === null) {
    issues.push("SPENT_PICKAXE_WITHOUT_OPEN_WALL");
  }
  if (brokenWall !== null && (rewardSelected !== "pickaxe" || !rewardSpent)) {
    issues.push("OPEN_WALL_WITHOUT_SPENT_PICKAXE");
  }

  const reachable = insideBoard(player)
    ? getReachableDistances(player, effectiveWalls)
    : new Map<string, number>();
  const unfinishedObjectives = mazeMap.collectibleStars
    .map(posKey)
    .filter((key) => !collected.has(key));
  unfinishedObjectives.push(posKey(mazeMap.exitPosition));
  if (!chestOpened && mazeMap.chest) unfinishedObjectives.push(posKey(mazeMap.chest));
  const unreachableObjectives = unfinishedObjectives.filter((key) => !reachable.has(key));
  // ROTA2-DEPENDENT-OBJECTIVES-02: a marked passage still standing is an
  // unfinished objective. It is not a cell to walk to — it is a wall to open,
  // and it stays openable while its trap is unarmed and within reach, or while
  // a Pickaxe (in hand, or still waiting in a Chest within reach) can be
  // carried to a walkable cell beside it. Neither way needs the passage open.
  const passageWall = snapshot.requiredPassageWall ?? null;
  if (passageWall !== null && effectiveWalls.has(passageWall)) {
    const passageTrap = [...wallOfTrap].find(([, wall]) => wall === passageWall)?.[0];
    const byTrap =
      passageTrap !== undefined && !armedTraps.has(passageTrap) && reachable.has(passageTrap);
    const pickaxeObtainable =
      (rewardSelected === "pickaxe" && !rewardSpent) ||
      (chestOpened && rewardSelected === null) ||
      (!chestOpened && mazeMap.chest !== null && reachable.has(posKey(mazeMap.chest)));
    const wallCell = keyToPosition(passageWall);
    const beside = [
      { row: wallCell.row - 1, col: wallCell.col },
      { row: wallCell.row + 1, col: wallCell.col },
      { row: wallCell.row, col: wallCell.col - 1 },
      { row: wallCell.row, col: wallCell.col + 1 },
    ];
    const byPickaxe =
      pickaxeObtainable && beside.some((cell) => insideBoard(cell) && reachable.has(posKey(cell)));
    if (!byTrap && !byPickaxe) unreachableObjectives.push(passageWall);
  }
  if (unreachableObjectives.length > 0) issues.push("UNREACHABLE_OBJECTIVE");

  const topologicallySolvable = unreachableObjectives.length === 0;
  const valid = issues.length === 0;
  return {
    valid,
    topologicallySolvable,
    solvable: valid && topologicallySolvable,
    issues,
    effectiveWalls,
    unreachableObjectives,
  };
}
