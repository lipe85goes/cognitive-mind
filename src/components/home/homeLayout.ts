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
  title: string;
  description: string;
  kind: HomeWorldKind;
  tier: HomeWorldTier;
  navOrder: number;
  mobileOrder: number;
  desktop: {
    x: number;
    y: number;
    sizeRem: number;
  };
}

export const HOME_WORLD_LAYOUT: Record<GameId, HomeWorldLayout> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    title: "Rota Estratégica",
    description: "Encontre o caminho, no seu tempo.",
    kind: "route",
    tier: "hero",
    navOrder: 1,
    mobileOrder: 1,
    desktop: { x: 41, y: 62, sizeRem: 23.5 },
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "memory",
    title: "Circuito de Memória",
    description: "Observe as luzes e repita.",
    kind: "memory",
    tier: "hero",
    navOrder: 2,
    mobileOrder: 2,
    desktop: { x: 66, y: 43, sizeRem: 18.5 },
  },
  "security-panel": {
    gameId: "security-panel",
    world: "commands",
    title: "Central de Comandos",
    description: "Organize os comandos com calma.",
    kind: "commands",
    tier: "quiet",
    navOrder: 3,
    mobileOrder: 3,
    desktop: { x: 83, y: 31, sizeRem: 12.5 },
  },
  "number-trail": {
    gameId: "number-trail",
    world: "logic",
    title: "Trilha Numérica",
    description: "Siga os números, um a um.",
    kind: "logic",
    tier: "quiet",
    navOrder: 4,
    mobileOrder: 4,
    desktop: { x: 87, y: 49, sizeRem: 11.75 },
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    title: "Jardim de Sementes",
    description: "Cultive padrões com paciência.",
    kind: "garden",
    tier: "quiet",
    navOrder: 5,
    mobileOrder: 5,
    desktop: { x: 80, y: 65, sizeRem: 11.75 },
  },
};

export function getHomeWorldLayout(gameId: GameId): HomeWorldLayout {
  return HOME_WORLD_LAYOUT[gameId];
}
