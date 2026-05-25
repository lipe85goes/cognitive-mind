import type { DifficultyLevel, GridPosition } from "@/types/game";

/** Manhattan distance between two grid cells. */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** Check if a position is inside grid bounds. */
export function isInBounds(
  pos: GridPosition,
  rows: number,
  cols: number,
): boolean {
  return pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols;
}

const CARDINAL_DELTAS: GridPosition[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

/**
 * Returns valid neighbor cells (not walls, in bounds).
 */
export function getValidNeighbors(
  pos: GridPosition,
  walls: Set<string>,
  rows: number,
  cols: number,
): GridPosition[] {
  return CARDINAL_DELTAS.map((delta) => ({
    row: pos.row + delta.row,
    col: pos.col + delta.col,
  })).filter(
    (next) =>
      isInBounds(next, rows, cols) && !walls.has(`${next.row},${next.col}`),
  );
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Predator movement by difficulty:
 * - easy: often random among valid moves; otherwise a non-pursuit step
 * - medium: prefer moves that reduce Manhattan distance to player
 * - hard: always choose the best valid move toward the player
 */
export function getPredatorNextPosition(
  predator: GridPosition,
  player: GridPosition,
  walls: Set<string>,
  rows: number,
  cols: number,
  difficulty: DifficultyLevel,
): GridPosition {
  const neighbors = getValidNeighbors(predator, walls, rows, cols);
  if (neighbors.length === 0) return predator;

  const currentDistance = manhattanDistance(predator, player);

  if (difficulty === "easy") {
    if (Math.random() < 0.5) {
      return pickRandom(neighbors);
    }
    const notCloser = neighbors.filter(
      (n) => manhattanDistance(n, player) >= currentDistance,
    );
    if (notCloser.length > 0) {
      return pickRandom(notCloser);
    }
    return pickRandom(neighbors);
  }

  const closer = neighbors.filter(
    (n) => manhattanDistance(n, player) < currentDistance,
  );

  if (difficulty === "medium") {
    if (closer.length > 0 && Math.random() < 0.75) {
      const bestDistance = Math.min(
        ...closer.map((n) => manhattanDistance(n, player)),
      );
      const best = closer.filter(
        (n) => manhattanDistance(n, player) === bestDistance,
      );
      return pickRandom(best);
    }
    return pickRandom(neighbors);
  }

  // hard: always take a step that minimizes distance when possible
  if (closer.length > 0) {
    const bestDistance = Math.min(
      ...closer.map((n) => manhattanDistance(n, player)),
    );
    const best = closer.filter(
      (n) => manhattanDistance(n, player) === bestDistance,
    );
    return pickRandom(best);
  }

  return pickRandom(neighbors);
}
