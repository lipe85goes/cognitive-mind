import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
import { MemoryCircuit3DGame } from "@/games/color-sequence/MemoryCircuit3DGame";
import { RouteStrategyGame } from "@/games/escape-maze/RouteStrategyGame";
import { NumberTrailGame } from "@/games/number-trail/NumberTrailGame";
import { SeedGardenGame } from "@/games/seed-garden/SeedGardenGame";
import { SecurityPanelGame } from "@/games/security-panel/SecurityPanelGame";

/**
 * How the entry shell learns that a game has painted.
 *
 * - `explicit`: the game calls `onEntryReady` itself once its essential visual
 *   assets have painted; the shell waits for that call.
 * - `frame-fallback`: the game never reports; the shell treats it as ready two
 *   animation frames after mounting it.
 */
export type GameReadiness = "explicit" | "frame-fallback";

export interface GameRegistryEntry {
  component: ComponentType<GameComponentProps>;
  readiness: GameReadiness;
}

/**
 * Registry of playable games. Add new entries here when implementing activities.
 */
export const GAME_REGISTRY: Record<GameId, GameRegistryEntry> = {
  "color-sequence": { component: MemoryCircuit3DGame, readiness: "explicit" },
  "escape-maze": { component: RouteStrategyGame, readiness: "explicit" },
  "security-panel": { component: SecurityPanelGame, readiness: "frame-fallback" },
  "number-trail": { component: NumberTrailGame, readiness: "frame-fallback" },
  "seed-garden": { component: SeedGardenGame, readiness: "frame-fallback" },
};
