import type { WorldKey } from "@/data/worlds";
import type { GameId } from "@/types/game";

export type HomeWorldTier = "hero" | "quiet";

export type HomeWorldKind =
  | "route"
  | "memory"
  | "commands"
  | "discovery"
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

/**
 * HOME-WORLD-VISUAL-UNIFICATION-01: every maquette is the atelier kit's — the
 * same canvas, with the pedestal in the same place — so every world is shown
 * at the same size. The pedestal, the shadow and the plaque then land on the
 * same line whichever world is chosen; the tier still says which worlds lead.
 */
export const HOME_DIORAMA_SIZE_REM = 46;

export const HOME_WORLD_LAYOUT: Record<GameId, HomeWorldLayout> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    kind: "route",
    tier: "hero",
    navOrder: 1,
    mobileOrder: 1,
    desktop: { sizeRem: HOME_DIORAMA_SIZE_REM },
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "memory",
    kind: "memory",
    tier: "hero",
    navOrder: 2,
    mobileOrder: 2,
    desktop: { sizeRem: HOME_DIORAMA_SIZE_REM },
  },
  "security-panel": {
    gameId: "security-panel",
    world: "commands",
    kind: "commands",
    tier: "quiet",
    navOrder: 3,
    mobileOrder: 3,
    desktop: { sizeRem: HOME_DIORAMA_SIZE_REM },
  },
  "hidden-objects": {
    gameId: "hidden-objects",
    world: "discovery",
    kind: "discovery",
    tier: "quiet",
    navOrder: 4,
    mobileOrder: 4,
    desktop: { sizeRem: HOME_DIORAMA_SIZE_REM },
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    kind: "garden",
    tier: "quiet",
    navOrder: 5,
    mobileOrder: 5,
    desktop: { sizeRem: HOME_DIORAMA_SIZE_REM },
  },
};

export function getHomeWorldLayout(gameId: GameId): HomeWorldLayout {
  return HOME_WORLD_LAYOUT[gameId];
}
