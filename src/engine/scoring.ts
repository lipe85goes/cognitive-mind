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

/** Max mistakes allowed in Number Trail before the session ends. */
export const NUMBER_TRAIL_MAX_ERRORS = 3;

/**
 * Score for Number Trail: +20 per correct number, +100 per completed round,
 * -20 per error.
 */
export function calculateNumberTrailScore(stats: {
  correctNumbers: number;
  roundsCompleted: number;
  errors: number;
}): number {
  const base = stats.correctNumbers * 20 + stats.roundsCompleted * 100;
  const penalty = stats.errors * 20;
  return Math.max(0, base - penalty);
}

/**
 * Score for Seed Garden: completion bonus plus calm move efficiency.
 */
export function calculateSeedGardenScore(stats: {
  targetCompleted: boolean;
  movesRemaining: number;
}): number {
  if (!stats.targetCompleted) return 0;
  return Math.max(0, 150 + stats.movesRemaining * 20);
}

/**
 * Score for Escape Maze: win bonus, turn efficiency, difficulty multiplier.
 */
export function calculateEscapeMazeScore(stats: {
  won: boolean;
  turns: number;
  blockedMoves: number;
  errors: number;
  starsCollected?: number;
  difficulty: EscapeMazeStats["difficulty"];
}): number {
  const winBonus = stats.won ? 100 : 0;
  const starBonus = (stats.starsCollected ?? 0) * 30;
  const turnPenalty = stats.turns * 5;
  const movePenalty = (stats.blockedMoves + stats.errors) * 20;
  const difficultyBonus =
    stats.won && stats.difficulty === "hard"
      ? 40
      : stats.won && stats.difficulty === "medium"
        ? 20
        : 0;

  return Math.max(0, winBonus + starBonus + difficultyBonus - turnPenalty - movePenalty);
}
