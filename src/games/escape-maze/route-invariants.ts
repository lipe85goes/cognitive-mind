import { COLS, ROWS } from "@/games/escape-maze/route-config";
import type { MazeMap } from "@/games/escape-maze/route-generation";
import {
  getReachableDistances,
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
  const effectiveWalls = new Set(mazeMap.walls);
  if (brokenWall !== null) {
    if (!mazeMap.walls.has(brokenWall)) issues.push("BROKEN_WALL_NOT_IN_BASE_MAP");
    effectiveWalls.delete(brokenWall);
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
