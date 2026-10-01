import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
import {
  GAME_ENTRY_CONTRACTS,
  type GameEntryContract,
} from "@/games/entry-contract";
import { MemoryCircuit3DGame } from "@/games/color-sequence/MemoryCircuit3DGame";
import { RouteStrategyGame } from "@/games/escape-maze/RouteStrategyGame";
import { NumberTrailGame } from "@/games/number-trail/NumberTrailGame";
import { SeedGardenGame } from "@/games/seed-garden/SeedGardenGame";
import { SecurityPanelGame } from "@/games/security-panel/SecurityPanelGame";

export interface GameRegistryEntry extends GameEntryContract {
  component: ComponentType<GameComponentProps>;
}

const GAME_COMPONENTS: Record<GameId, ComponentType<GameComponentProps>> = {
  "color-sequence": MemoryCircuit3DGame,
  "escape-maze": RouteStrategyGame,
  "security-panel": SecurityPanelGame,
  "number-trail": NumberTrailGame,
  "seed-garden": SeedGardenGame,
};

/**
 * Registry of playable games: each game's entry contract (see
 * `src/games/entry-contract.ts`) paired with its component. Add new entries to
 * both maps when implementing activities.
 */
export const GAME_REGISTRY: Record<GameId, GameRegistryEntry> = Object.fromEntries(
  (Object.keys(GAME_COMPONENTS) as GameId[]).map((gameId) => [
    gameId,
    { ...GAME_ENTRY_CONTRACTS[gameId], component: GAME_COMPONENTS[gameId] },
  ]),
) as Record<GameId, GameRegistryEntry>;
