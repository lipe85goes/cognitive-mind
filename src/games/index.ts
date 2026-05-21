import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
import { ColorSequenceGame } from "@/games/color-sequence/ColorSequenceGame";
import { EscapeMazeGame } from "@/games/escape-maze/EscapeMazeGame";
import { SecurityPanelGame } from "@/games/security-panel/SecurityPanelGame";

/**
 * Registry of playable games. Add new entries here when implementing activities.
 */
export const GAME_COMPONENTS: Record<
  GameId,
  ComponentType<GameComponentProps>
> = {
  "color-sequence": ColorSequenceGame,
  "escape-maze": EscapeMazeGame,
  "security-panel": SecurityPanelGame,
};

export function getGameComponent(
  gameId: GameId,
): ComponentType<GameComponentProps> | null {
  return GAME_COMPONENTS[gameId] ?? null;
}
