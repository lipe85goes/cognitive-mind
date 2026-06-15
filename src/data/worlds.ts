import { Grid3x3, Hash, LayoutGrid, Palette, Sprout } from "lucide-react";
import type { GameId } from "@/types/game";

/**
 * Visual theme key shared with the CSS world classes
 * (game-world-*, game-intro-*, reward-world-*, recent-circuit-*).
 */
export type WorldKey = "memory" | "route" | "commands" | "logic" | "garden";

/**
 * Per-world presentation for the shared game HUD.
 * - `boardLabel`: the kind of board (eyebrow above the title).
 * - `tagline`: calm station status / action language shown in the console bar.
 */
export const WORLDS: Record<
  WorldKey,
  { icon: typeof Palette; boardLabel: string; tagline: string }
> = {
  memory: {
    icon: Palette,
    boardLabel: "Circuito de memória",
    tagline: "Circuito em andamento",
  },
  route: {
    icon: Grid3x3,
    boardLabel: "Tabuleiro de rota",
    tagline: "Planeje sua rota",
  },
  commands: {
    icon: LayoutGrid,
    boardLabel: "Console de comandos",
    tagline: "Ative os sistemas",
  },
  logic: {
    icon: Hash,
    boardLabel: "Caminho lógico",
    tagline: "Ilumine a trilha",
  },
  garden: {
    icon: Sprout,
    boardLabel: "Tabuleiro de sementes",
    tagline: "Equilibre o jardim",
  },
};

/** Canonical presentation metadata for one cognitive mini-world. */
export interface WorldMeta {
  world: WorldKey;
  /** Station / mini-world display name (e.g. "Circuito de Memória"). */
  name: string;
  /** Skill line shown on the dashboard, results and intro. */
  skill: string;
  /** Short invitation line on the station card. */
  purpose: string;
  /** Illustration under /public/illustrations. */
  image: string;
  /** Final rendered Home diorama under /public/illustrations/worlds. */
  dioramaImage: string;
  icon: typeof Palette;
}

export const WORLD_DIORAMA_IMAGES: Record<WorldKey, string> = {
  memory: "/illustrations/worlds/memory-diorama.webp",
  route: "/illustrations/worlds/route-diorama.webp",
  commands: "/illustrations/worlds/command-diorama.webp",
  logic: "/illustrations/worlds/logic-diorama.webp",
  garden: "/illustrations/worlds/garden-diorama.webp",
};

/**
 * Single source of truth for per-game world presentation.
 * Dashboard, intro, in-game shell and reward screens all read from here —
 * add new games to this map (plus GAME_INTROS and GAME_COMPONENTS).
 */
export const GAME_WORLDS: Record<GameId, WorldMeta> = {
  "color-sequence": {
    world: "memory",
    name: "Circuito de Memória",
    skill: "Memória e atenção",
    purpose: "Exercite sua lembrança com leveza.",
    image: "/illustrations/station-memory.png",
    dioramaImage: WORLD_DIORAMA_IMAGES.memory,
    icon: WORLDS.memory.icon,
  },
  "escape-maze": {
    world: "route",
    name: "Rota Estratégica",
    skill: "Planejamento e estratégia",
    purpose: "Planeje caminhos e tome boas decisões.",
    image: "/illustrations/station-route.png",
    dioramaImage: WORLD_DIORAMA_IMAGES.route,
    icon: WORLDS.route.icon,
  },
  "security-panel": {
    world: "commands",
    name: "Central de Comandos",
    skill: "Foco e sequência",
    purpose: "Atenção e controle em cada movimento.",
    image: "/illustrations/station-command.png",
    dioramaImage: WORLD_DIORAMA_IMAGES.commands,
    icon: WORLDS.commands.icon,
  },
  "number-trail": {
    world: "logic",
    name: "Trilha Lógica",
    skill: "Atenção e ordem lógica",
    purpose: "Conecte ideias e resolva passo a passo.",
    image: "/illustrations/station-logic.png",
    dioramaImage: WORLD_DIORAMA_IMAGES.logic,
    icon: WORLDS.logic.icon,
  },
  "seed-garden": {
    world: "garden",
    name: "Jardim de Sementes",
    skill: "Contagem, planejamento e atenção",
    purpose: "Cultive foco, paciência e constância.",
    image: "/illustrations/station-garden.png",
    dioramaImage: WORLD_DIORAMA_IMAGES.garden,
    icon: WORLDS.garden.icon,
  },
};

/**
 * World metadata with a safe fallback for unknown ids (e.g. results saved by
 * an older version of the app). Never throws on stored data.
 */
export function getWorldMeta(gameId: string): WorldMeta {
  return GAME_WORLDS[gameId as GameId] ?? GAME_WORLDS["color-sequence"];
}

/**
 * The cognitive skill line for a visual world, sourced from the game registry
 * so the in-game HUD never diverges from the dashboard/intro skill text.
 */
export function skillForWorld(world: WorldKey): string {
  return Object.values(GAME_WORLDS).find((meta) => meta.world === world)?.skill ?? "";
}
