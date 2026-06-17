import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
// MemoryCircuit3DGame is the active premium 3D Circuito de Memória. The original
// ColorSequenceGame (same logic) is kept on disk as a fallback reference.
import { MemoryCircuit3DGame } from "@/games/color-sequence/MemoryCircuit3DGame";
import { EscapeMazeGame } from "@/games/escape-maze/EscapeMazeGame";
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
  "escape-maze": EscapeMazeGame,
  "security-panel": SecurityPanelGame,
  "number-trail": NumberTrailGame,
  "seed-garden": SeedGardenGame,
};
