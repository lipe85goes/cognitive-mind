import { calculateStars } from "@/engine/rewards";
import type { GameId, GameResult } from "@/types/game";

/** Playable stages in map order. */
export const PLAYABLE_STAGE_IDS: GameId[] = [
  "color-sequence",
  "escape-maze",
  "security-panel",
  "number-trail",
  "seed-garden",
];

/** Best activation signal count earned for a game on this device. */
export function getBestActivationSignalsForGame(
  results: Pick<GameResult, "gameId" | "score">[],
  gameId: GameId,
): number {
  return results
    .filter((r) => r.gameId === gameId)
    .reduce((max, r) => Math.max(max, calculateStars(r.score)), 0);
}
