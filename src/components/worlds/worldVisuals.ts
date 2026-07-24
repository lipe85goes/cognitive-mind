import {
  Route,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { WorldKey } from "@/data/worlds";
import type { GameId } from "@/types/game";

export type WorldMotionKind =
  | "portal"
  | "circuit"
  | "signal"
  | "path"
  | "bloom";

export type WorldArtMode = "rendered" | "sprite";

export interface WorldVisualContract {
  gameId: GameId;
  world: WorldKey;
  visualName: string;
  homeDescription: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  atmosphere: string;
  homeArt: string;
  transitionArt: string;
  introArt: string;
  artMode: WorldArtMode;
  symbol: LucideIcon;
  entryEyebrow: string;
  entryCopy: string;
  motion: WorldMotionKind;
}

/**
 * Visual-only bridge shared by Home, world entry, and game introductions.
 * Functional metadata, rules, scoring, and registration remain in their
 * existing modules.
 */
export const WORLD_VISUALS: Record<GameId, WorldVisualContract> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    visualName: "Rota Estratégica",
    homeDescription: "Encontre o caminho, no seu tempo.",
    accent: "#63ddca",
    accentSoft: "rgba(99, 221, 202, 0.24)",
    accentDeep: "#0d4c4a",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    homeArt: "/illustrations/home/world-route-hero.webp",
    transitionArt: "/illustrations/home/world-route-hero.webp",
    introArt: "/illustrations/home/world-route-hero.webp",
    artMode: "rendered",
    symbol: Route,
    entryEyebrow: "Abrindo a rota",
    entryCopy: "O caminho está pronto para você.",
    motion: "portal",
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "memory",
    visualName: "Circuito de Memória",
    homeDescription: "Observe as luzes e repita.",
    accent: "#f2c65a",
    accentSoft: "rgba(242, 198, 90, 0.22)",
    accentDeep: "#5c3a18",
    atmosphere: "/illustrations/memory-circuit/memory-room-bg.webp",
    homeArt: "/illustrations/home/world-circuit-hero.webp",
    transitionArt: "/illustrations/home/world-circuit-hero.webp",
    introArt: "/illustrations/home/world-circuit-hero.webp",
    artMode: "rendered",
    symbol: Sparkles,
    entryEyebrow: "Ativando o circuito",
    entryCopy: "As quatro luzes começam a despertar.",
    motion: "circuit",
  },
  "security-panel": {
    gameId: "security-panel",
    world: "commands",
    visualName: "Central de Comandos",
    homeDescription: "Organize os comandos com calma.",
    accent: "#6bc7b7",
    accentSoft: "rgba(107, 199, 183, 0.2)",
    accentDeep: "#214b43",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    homeArt: "/illustrations/home/world-panel.webp",
    transitionArt: "/illustrations/home/world-panel.webp",
    introArt: "/illustrations/home/world-panel.webp",
    artMode: "sprite",
    symbol: SlidersHorizontal,
    entryEyebrow: "Preparando a central",
    entryCopy: "Os comandos estão ao seu alcance.",
    motion: "signal",
  },
  "number-trail": {
    gameId: "number-trail",
    world: "logic",
    visualName: "Trilha Lógica",
    homeDescription: "Siga os números, um a um.",
    accent: "#b69ada",
    accentSoft: "rgba(182, 154, 218, 0.2)",
    accentDeep: "#432d59",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    homeArt: "/illustrations/home/world-trail.webp",
    transitionArt: "/illustrations/home/world-trail.webp",
    introArt: "/illustrations/home/world-trail.webp",
    artMode: "sprite",
    symbol: Waypoints,
    entryEyebrow: "Iluminando a trilha",
    entryCopy: "O próximo passo aparece com calma.",
    motion: "path",
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    visualName: "Jardim de Sementes",
    homeDescription: "Cultive padrões com paciência.",
    accent: "#9fc96a",
    accentSoft: "rgba(159, 201, 106, 0.2)",
    accentDeep: "#365124",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    homeArt: "/illustrations/home/world-garden.webp",
    transitionArt: "/illustrations/home/world-garden.webp",
    introArt: "/illustrations/home/world-garden.webp",
    artMode: "sprite",
    symbol: Sprout,
    entryEyebrow: "Cuidando do jardim",
    entryCopy: "As sementes esperam por uma escolha.",
    motion: "bloom",
  },
};

export function getWorldVisual(gameId: GameId): WorldVisualContract {
  return WORLD_VISUALS[gameId];
}
