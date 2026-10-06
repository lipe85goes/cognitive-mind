import type { ComponentType } from "react";
import type { GameComponentProps, GameId } from "@/types/game";
import {
  GAME_ENTRY_CONTRACTS,
  type GameEntryContract,
} from "@/games/entry-contract";

/**
 * Resolves a game's component. The first call fetches the game's code; later
 * calls resolve from the bundler's module cache.
 */
type GameComponentLoader = () => Promise<ComponentType<GameComponentProps>>;

export interface GameRegistryEntry extends GameEntryContract {
  load: GameComponentLoader;
}

/**
 * Nothing here imports a game statically. Each `import()` names its module
 * literally, so the bundler gives every game its own chunk and fetches it only
 * when that game is opened: being registered costs the Home no game code.
 */
const GAME_LOADERS: Record<GameId, GameComponentLoader> = {
  "color-sequence": () =>
    import("@/games/color-sequence/MemoryCircuit3DGame").then(
      (mod) => mod.MemoryCircuit3DGame,
    ),
  "escape-maze": () =>
    import("@/games/escape-maze/RouteStrategyGame").then(
      (mod) => mod.RouteStrategyGame,
    ),
  "security-panel": () =>
    import("@/games/security-panel/SecurityPanelGame").then(
      (mod) => mod.SecurityPanelGame,
    ),
  "hidden-objects": () =>
    import("@/games/hidden-objects/HiddenObjectsGame").then(
      (mod) => mod.HiddenObjectsGame,
    ),
  "seed-garden": () =>
    import("@/games/seed-garden/SeedGardenGame").then(
      (mod) => mod.SeedGardenGame,
    ),
};

/**
 * Registry of playable games: each game's entry contract (see
 * `src/games/entry-contract.ts`), readable right away, paired with the loader
 * of its component. Add new entries to both maps when implementing activities.
 */
export const GAME_REGISTRY: Record<GameId, GameRegistryEntry> = Object.fromEntries(
  (Object.keys(GAME_LOADERS) as GameId[]).map((gameId) => [
    gameId,
    { ...GAME_ENTRY_CONTRACTS[gameId], load: GAME_LOADERS[gameId] },
  ]),
) as Record<GameId, GameRegistryEntry>;
