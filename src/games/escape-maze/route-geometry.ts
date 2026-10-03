import { COLS, ROWS } from "@/games/escape-maze/route-config";
import type { GridPosition } from "@/types/game";

/**
 * ROUTE-C2 — the Rota's board as a graph: cell keys, the four-neighbourhood,
 * breadth-first distances and paths, and the grid <-> wall-set conversions.
 *
 * Moved out of `useEscapeMaze.ts` verbatim: no body, order or comment changed,
 * only `export` added. These are the primitives both halves of the Rota walk
 * the board with — generation and certification (`route-generation.ts`) and
 * the runtime still in the hook (the defenders, the dynamic invariants, the
 * turn loop) — so they belong to neither. Pure: no React, no RNG, no state and
 * no policy; the only configuration they read is the size of the board.
 */

export function keyToPosition(key: string): GridPosition {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

export function posKey(pos: GridPosition): string {
  return `${pos.row},${pos.col}`;
}

export function positionsEqual(a: GridPosition, b: GridPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export function gridToWalls(grid: number[][]): Set<string> {
  const walls = new Set<string>();
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === 1) walls.add(`${r},${c}`);
    });
  });
  return walls;
}

export function getNeighbors(
  pos: GridPosition,
  walls: Set<string>,
  rows = ROWS,
  cols = COLS,
): GridPosition[] {
  return [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ].filter(
    (next) =>
      next.row >= 0 &&
      next.row < rows &&
      next.col >= 0 &&
      next.col < cols &&
      !walls.has(posKey(next)),
  );
}

export function findPathLength(
  start: GridPosition,
  target: GridPosition,
  walls: Set<string>,
  blocked?: Set<string>,
): number | null {
  const queue: { pos: GridPosition; distance: number }[] = [
    { pos: start, distance: 0 },
  ];
  const visited = new Set([posKey(start)]);
  if (blocked) for (const cellKey of blocked) visited.add(cellKey);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (positionsEqual(current.pos, target)) {
      return current.distance;
    }

    getNeighbors(current.pos, walls).forEach((next) => {
      const key = posKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pos: next, distance: current.distance + 1 });
      }
    });
  }

  return null;
}

export function countWalls(grid: number[][]): number {
  return grid.flat().filter((cell) => cell === 1).length;
}

export function getReachableDistances(
  start: GridPosition,
  walls: Set<string>,
): Map<string, number> {
  const distances = new Map<string, number>([[posKey(start), 0]]);
  const queue: GridPosition[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentDistance = distances.get(posKey(current)) ?? 0;

    getNeighbors(current, walls).forEach((next) => {
      const key = posKey(next);
      if (!distances.has(key)) {
        distances.set(key, currentDistance + 1);
        queue.push(next);
      }
    });
  }

  return distances;
}

/**
 * Does a second, independent way through exist?
 *
 * ROTA-MAPS-DIFFICULTY-01: a separating cell must lie on EVERY route, so it
 * must lie on the shortest one. Blocking each cell of the shortest path in turn
 * and re-searching therefore proves vertex connectivity >= 2 exactly, at a cost
 * of one BFS per path cell. In the baseline sweep 46% of maps failed this — the
 * Explorer met a corridor with a single choke point and had nothing to plan.
 */
export function findPathCells(
  start: GridPosition,
  target: GridPosition,
  walls: Set<string>,
  blocked?: Set<string>,
): GridPosition[] | null {
  const previous = new Map<string, string | null>([[posKey(start), null]]);
  const queue: GridPosition[] = [start];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (positionsEqual(current, target)) {
      const cells: GridPosition[] = [];
      let cursor: string | null = posKey(current);
      while (cursor) {
        cells.unshift(keyToPosition(cursor));
        cursor = previous.get(cursor) ?? null;
      }
      return cells;
    }
    for (const next of getNeighbors(current, walls)) {
      const key = posKey(next);
      if (previous.has(key) || blocked?.has(key)) continue;
      previous.set(key, posKey(current));
      queue.push(next);
    }
  }
  return null;
}
