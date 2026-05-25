import type { GameResult } from "@/types/game";

/** Light daily target — no backend, counted from saved sessions today. */
export const DAILY_GOAL_TARGET = 3;

/** Sessions saved today on this device (local calendar day). */
export function countTodaySessions(
  results: Pick<GameResult, "playedAt">[],
): number {
  const today = new Date().toDateString();
  return results.filter(
    (r) => new Date(r.playedAt).toDateString() === today,
  ).length;
}

export function getDailyGoalProgress(
  results: Pick<GameResult, "playedAt">[],
): { completed: number; target: number; reached: boolean } {
  const completed = Math.min(countTodaySessions(results), DAILY_GOAL_TARGET);
  return {
    completed,
    target: DAILY_GOAL_TARGET,
    reached: completed >= DAILY_GOAL_TARGET,
  };
}
