import type { WorldKey } from "@/data/worlds";
import type { GameId } from "@/types/game";

export type HomeWorldTier = "hero" | "quiet";

export type HomeWorldKind =
  | "route"
  | "memory"
  | "commands"
  | "logic"
  | "garden";

export interface HomeWorldLayout {
  gameId: GameId;
  world: WorldKey;
  kind: HomeWorldKind;
  tier: HomeWorldTier;
  navOrder: number;
  mobileOrder: number;
  desktop: {
    sizeRem: number;
  };
}

export const HOME_WORLD_LAYOUT: Record<GameId, HomeWorldLayout> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    kind: "route",
    tier: "hero",
    navOrder: 1,
    mobileOrder: 1,
    // UNIFIED-VISUAL-01: heroes grew slightly to compensate for the wider
    // diorama render framing (the maquette now fits fully inside the frame).
    desktop: { sizeRem: 47 },
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "memory",
    kind: "memory",
    tier: "hero",
    navOrder: 2,
    mobileOrder: 2,
    desktop: { sizeRem: 45 },
  },
  "security-panel": {
    gameId: "security-panel",
    world: "commands",
    kind: "commands",
    tier: "quiet",
    navOrder: 3,
    mobileOrder: 3,
    desktop: { sizeRem: 27.5 },
  },
  "number-trail": {
    gameId: "number-trail",
    world: "logic",
    kind: "logic",
    tier: "quiet",
    navOrder: 4,
    mobileOrder: 4,
    desktop: { sizeRem: 27 },
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    kind: "garden",
    tier: "quiet",
    navOrder: 5,
    mobileOrder: 5,
    desktop: { sizeRem: 27 },
  },
};

export function getHomeWorldLayout(gameId: GameId): HomeWorldLayout {
  return HOME_WORLD_LAYOUT[gameId];
}
