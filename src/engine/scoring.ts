import type { EscapeMazeStats } from "@/types/game";

/** Max mistakes allowed in Color Sequence before the round ends. */
export const COLOR_SEQUENCE_MAX_ERRORS = 3;

/**
 * Score for Color Sequence: rewards level and length, penalizes errors.
 */
export function calculateColorSequenceScore(stats: {
  level: number;
  sequenceLength: number;
  errors: number;
}): number {
  const base = stats.level * 120 + stats.sequenceLength * 40;
  const penalty = stats.errors * 80;
  return Math.max(0, base - penalty);
}

/** Max mistakes allowed in Security Panel before the session ends. */
export const SECURITY_PANEL_MAX_ERRORS = 3;

/**
 * Score for Security Panel: +100 per completed panel, -20 per error, level bonus.
 */
export function calculateSecurityPanelScore(stats: {
  level: number;
  panelsCompleted: number;
  errors: number;
}): number {
  const base = stats.panelsCompleted * 100 - stats.errors * 20;
  const levelBonus = Math.max(0, stats.level - 1) * 30;
  return Math.max(0, base + levelBonus);
}

/**
 * Score for Escape Maze: win bonus, turn efficiency, difficulty multiplier.
 */
export function calculateEscapeMazeScore(stats: {
  won: boolean;
  turns: number;
  blockedMoves: number;
  errors: number;
  difficulty: EscapeMazeStats["difficulty"];
}): number {
  if (!stats.won) {
    return Math.max(0, stats.turns * 5 - stats.errors * 30);
  }

  const difficultyMultiplier =
    stats.difficulty === "hard" ? 1.5 : stats.difficulty === "medium" ? 1.2 : 1;
  const turnBonus = Math.max(0, 350 - stats.turns * 12);
  const movePenalty = stats.blockedMoves * 15 + stats.errors * 25;
  return Math.round((500 + turnBonus - movePenalty) * difficultyMultiplier);
}
