import type { DifficultyLevel, RouteContinuation } from "@/types/game";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

/**
 * Rota Estratégica v1 is a journey of exactly three Routes (ROUTE-JOURNEY-
 * TERMINAL-01). The one place that number lives: the Rota's producer
 * (`useEscapeMaze#endGame`, through `nextJourneyRoute`) and its reader
 * (`readRouteContinuation`) both take it from here. The shell never sees it —
 * it only learns whether a result carries a continuation at all.
 *
 * `getRouteStage` keeps cycling `((n - 1) % 3) + 1` for any Route the hook is
 * mounted on directly (validation tooling does that); the journey simply never
 * hands the product a Route past this one.
 */
export const ROUTE_JOURNEY_FINAL_ROUTE = 3;

/**
 * Where the journey goes once Route `routeNumber` ends.
 *
 *   Routes before the last, won or lost → the next Route (N + 1);
 *   the last Route, lost                → the last Route again;
 *   the last Route, won                 → undefined: the journey is complete.
 *
 * A Route past the last one only exists when tooling mounts the hook on it
 * directly; it ends the way the last Route does, so this never returns a Route
 * outside the journey.
 */
export function nextJourneyRoute(
  routeNumber: number,
  won: boolean,
): number | undefined {
  if (routeNumber < ROUTE_JOURNEY_FINAL_ROUTE) return routeNumber + 1;
  return won ? undefined : ROUTE_JOURNEY_FINAL_ROUTE;
}

/**
 * The Rota's reading of the continuation it is handed (`RouteContinuation` in
 * `src/types/game.ts`).
 *
 * In the product the value is the one `useEscapeMaze#endGame` wrote, carried
 * through the shell untouched. It is still checked field by field before the
 * Rota mounts on it, because it crossed the platform: anything that is not a
 * well-formed Route continuation — another kind, a Route that is not an integer
 * from 1 to `ROUTE_JOURNEY_FINAL_ROUTE`, an unknown mode — reads as none, and
 * the Rota starts the way a fresh entry does instead of mounting on it. That is
 * also what keeps a value written before the journey had an end (Route 4 and
 * up) from opening a Route the journey does not have.
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
    routeNumber < 1 ||
    routeNumber > ROUTE_JOURNEY_FINAL_ROUTE
  ) {
    return undefined;
  }
  if (!(DIFFICULTY_LEVELS as readonly unknown[]).includes(difficulty)) {
    return undefined;
  }
  return { kind, routeNumber, difficulty: difficulty as DifficultyLevel };
}
