import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
import { MemoryCircuit3DGame } from "@/games/color-sequence/MemoryCircuit3DGame";
import { RouteStrategyGame } from "@/games/escape-maze/RouteStrategyGame";
import { NumberTrailGame } from "@/games/number-trail/NumberTrailGame";
import { SeedGardenGame } from "@/games/seed-garden/SeedGardenGame";
import { SecurityPanelGame } from "@/games/security-panel/SecurityPanelGame";

/**
 * Registry of playable games. Add new entries here when implementing activities.
 */
export const GAME_COMPONENTS: Record<
  GameId,
  ComponentType<GameComponentProps>
> = {
  "color-sequence": MemoryCircuit3DGame,
  "escape-maze": RouteStrategyGame,
  "security-panel": SecurityPanelGame,
  "number-trail": NumberTrailGame,
  "seed-garden": SeedGardenGame,
};
