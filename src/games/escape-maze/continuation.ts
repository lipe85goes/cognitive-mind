import type { DifficultyLevel, RouteContinuation } from "@/types/game";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

/**
 * The Rota's reading of the continuation it is handed (`RouteContinuation` in
 * `src/types/game.ts`).
 *
 * In the product the value is the one `useEscapeMaze#endGame` wrote, carried
 * through the shell untouched. It is still checked field by field before the
 * Rota mounts on it, because it crossed the platform: anything that is not a
 * well-formed Route continuation — another kind, a Route that is not a positive
 * integer, an unknown mode — reads as none, and the Rota starts the way a fresh
 * entry does instead of mounting on it.
 *
 * It imports nothing but types, so depending on it pulls in none of the game.
 */
export function readRouteContinuation(
  value: unknown,
): RouteContinuation | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { kind, routeNumber, difficulty } = value as Record<string, unknown>;
  if (kind !== "escape-maze-route") return undefined;
  if (
    typeof routeNumber !== "number" ||
    !Number.isSafeInteger(routeNumber) ||
    routeNumber < 1
  ) {
    return undefined;
  }
  if (!(DIFFICULTY_LEVELS as readonly unknown[]).includes(difficulty)) {
    return undefined;
  }
  return { kind, routeNumber, difficulty: difficulty as DifficultyLevel };
}
