import { COLS, ROWS } from "@/games/escape-maze/route-config";
import type { DifficultyLevel, GridPosition } from "@/types/game";

/**
 * ROTA2-ADAPTIVE-HUNTER-04 — the Hunter reads one pattern: the Explorer stepping
 * the same way twice in a row.
 *
 * On Routes 2 and 3, when the Explorer's step repeats the direction of its
 * previous successful step, the Hunter predicts that the Explorer keeps going
 * and tries to get to a cell ahead of it first. It reacts only to steps that
 * already happened; it never knows the next one, and the Explorer can always
 * turn. Route 1 never adapts.
 *
 * This module is the ONE implementation of that policy. The hook asks it for
 * the Hunter's interception moves; both reference solvers
 * (`tools/validation/dynamic-solver-packed-successors.mjs`,
 * `tools/validation/rota2-dynamic-solver.mjs`) load this same module and ask
 * it the same question. It lists the moves; it never picks one: choosing
 * between tied moves is the hook's, through the Rota's random seam
 * (`chooseInterceptionMove`, route-defenders.ts).
 *
 * Pure: no React, no Babylon, no browser, no storage, no RNG, no clock. It
 * never mutates what it is given and reads the board's size and nothing else
 * from the Rota. The same input always gives the same answer, in the same
 * order.
 */

/** Where a successful step went. Four values; "none yet" is `null`. */
export type ExplorerDirection = "up" | "right" | "down" | "left";

const DIRECTION_DELTAS: Record<ExplorerDirection, GridPosition> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

/**
 * The direction of a step from `from` to `to`, or `null` when that is not one
 * orthogonal cell — standing still, or anything that is not a step, invents no
 * direction.
 */
export function explorerStepDirection(
  from: GridPosition,
  to: GridPosition,
): ExplorerDirection | null {
  const row = to.row - from.row;
  const col = to.col - from.col;
  if (row === -1 && col === 0) return "up";
  if (row === 1 && col === 0) return "down";
  if (row === 0 && col === -1) return "left";
  if (row === 0 && col === 1) return "right";
  return null;
}

/** The Routes whose Hunter reads the repeated direction: 2 and 3. Route 1 keeps v1's pursuit. */
export function hunterAdaptsOnRoute(routeNumber: number): boolean {
  return routeNumber >= 2;
}

/**
 * How far ahead the Hunter may predict, by mode — a maximum, never a reason to
 * move. Easy and Medium look one cell ahead; Hard up to two.
 */
export const INTERCEPT_HORIZON: Readonly<Record<DifficultyLevel, 1 | 2>> = {
  easy: 1,
  medium: 1,
  hard: 2,
};

export interface HunterInterceptionInput {
  routeNumber: number;
  difficulty: DifficultyLevel;
  /** The direction of the last successful step BEFORE this one — the state's memory. */
  previousDirection: ExplorerDirection | null;
  /** The direction of this turn's step; `null` when the turn is not a step. */
  direction: ExplorerDirection | null;
  hunter: GridPosition;
  /** The Explorer, after this turn's step. */
  explorer: GridPosition;
  exitPosition: GridPosition;
  /** The maze as it stands after this turn's step: `currentWalls(...)`, with any wall the step's trap opened. */
  walls: Set<string>;
  /** Cells the Hunter may not enter this turn: the armed traps and the Sentinel's cell. */
  blocked: Set<string>;
}

export interface HunterInterception {
  /** The predicted cell the Hunter is heading for. */
  target: GridPosition;
  /** How many cells ahead of the Explorer `target` is. */
  horizon: 1 | 2;
  /**
   * The Hunter's legal one-cell moves that bring it closest to `target`, in the
   * board's fixed neighbour order (up, down, left, right). Never empty.
   */
  moves: GridPosition[];
}

const cellIndex = (row: number, col: number) => row * COLS + col;
const inBoard = (row: number, col: number) =>
  row >= 0 && row < ROWS && col >= 0 && col < COLS;
const NEIGHBOUR_DELTAS: readonly GridPosition[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];
const UNREACHED = -1;

/**
 * The Hunter's interception this turn, or `null` when it does not adapt and the
 * usual pursuit (`chooseGuardianMove`) decides.
 *
 * It adapts only when all of these hold:
 *
 *  1. the Route adapts (Routes 2 and 3);
 *  2. this turn is a step, and its direction equals the previous successful
 *     step's — the pattern was SEEN, twice;
 *  3. the Hunter is not already next to the Explorer: when it can reach the
 *     Explorer now, the usual pursuit decides, exactly as before. (So an
 *     interception move never lands on the Explorer: it positions, it never
 *     captures.)
 *
 * Then, from the mode's horizon down to one cell, the first prediction that
 * works wins:
 *
 *  - the cells from the Explorer to the predicted cell, along the direction,
 *    are all on the board and not walls of the current maze — a path the
 *    Explorer could actually walk;
 *  - the predicted cell is one the Hunter may stand on: not a wall, not the
 *    portal, not an armed trap, not the Sentinel's cell;
 *  - Easy: the Hunter can step onto it with this one move;
 *    Medium and Hard: some legal move shortens the Hunter's shortest path to
 *    it. That path runs through the current maze and never through a wall,
 *    the portal, an armed trap, the Sentinel or the Explorer — getting ahead of
 *    someone means going around them.
 *
 * The moves are every legal move at the new shortest distance. When no
 * prediction works, `null`.
 */
export function planHunterInterception(
  input: HunterInterceptionInput,
): HunterInterception | null {
  const {
    routeNumber,
    difficulty,
    previousDirection,
    direction,
    hunter,
    explorer,
    exitPosition,
    walls,
    blocked,
  } = input;
  if (!hunterAdaptsOnRoute(routeNumber)) return null;
  if (direction === null || previousDirection !== direction) return null;
  if (
    Math.abs(hunter.row - explorer.row) + Math.abs(hunter.col - explorer.col) <=
    1
  ) {
    return null;
  }

  const isWall = (row: number, col: number) => walls.has(`${row},${col}`);
  /** A cell the Hunter may stand on (its own cell aside). */
  const hunterMayEnter = (row: number, col: number) =>
    inBoard(row, col) &&
    !isWall(row, col) &&
    !(row === exitPosition.row && col === exitPosition.col) &&
    !blocked.has(`${row},${col}`);
  const hunterMoves = NEIGHBOUR_DELTAS.map((delta) => ({
    row: hunter.row + delta.row,
    col: hunter.col + delta.col,
  })).filter((cell) => hunterMayEnter(cell.row, cell.col));

  const delta = DIRECTION_DELTAS[direction];
  for (let horizon = INTERCEPT_HORIZON[difficulty]; horizon >= 1; horizon -= 1) {
    let walkable = true;
    for (let step = 1; step <= horizon; step += 1) {
      const row = explorer.row + delta.row * step;
      const col = explorer.col + delta.col * step;
      if (!inBoard(row, col) || isWall(row, col)) {
        walkable = false;
        break;
      }
    }
    if (!walkable) continue;
    const target = {
      row: explorer.row + delta.row * horizon,
      col: explorer.col + delta.col * horizon,
    };
    if (!hunterMayEnter(target.row, target.col)) continue;
    if (target.row === hunter.row && target.col === hunter.col) continue;

    let moves: GridPosition[];
    if (difficulty === "easy") {
      moves = hunterMoves.filter(
        (cell) => cell.row === target.row && cell.col === target.col,
      );
    } else {
      // Breadth-first from the predicted cell over the cells the Hunter could
      // walk this turn, the Explorer's cell excluded.
      const distance = new Int16Array(ROWS * COLS).fill(UNREACHED);
      const queue: number[] = [cellIndex(target.row, target.col)];
      distance[queue[0]] = 0;
      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head];
        const row = Math.floor(current / COLS);
        const col = current % COLS;
        for (const step of NEIGHBOUR_DELTAS) {
          const nextRow = row + step.row;
          const nextCol = col + step.col;
          if (!inBoard(nextRow, nextCol)) continue;
          const next = cellIndex(nextRow, nextCol);
          if (distance[next] !== UNREACHED) continue;
          const isHunter = nextRow === hunter.row && nextCol === hunter.col;
          if (
            !isHunter &&
            (!hunterMayEnter(nextRow, nextCol) ||
              (nextRow === explorer.row && nextCol === explorer.col))
          ) {
            continue;
          }
          distance[next] = distance[current] + 1;
          queue.push(next);
        }
      }
      const fromHunter = distance[cellIndex(hunter.row, hunter.col)];
      moves =
        fromHunter === UNREACHED
          ? []
          : hunterMoves.filter(
              (cell) => distance[cellIndex(cell.row, cell.col)] === fromHunter - 1,
            );
    }
    if (moves.length > 0) return { target, horizon, moves };
  }
  return null;
}
