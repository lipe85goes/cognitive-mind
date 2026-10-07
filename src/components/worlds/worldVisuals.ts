import {
  Route,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { WorldKey } from "@/data/worlds";
import type { GameId } from "@/types/game";

export type WorldMotionKind =
  | "portal"
  | "circuit"
  | "signal"
  | "glint"
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
    homeDescription: "Planeje a rota e atravesse o portal.",
    accent: "#63ddca",
    accentSoft: "rgba(99, 221, 202, 0.24)",
    accentDeep: "#0d4c4a",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
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
    homeDescription: "Observe os sinais e repita no seu ritmo.",
    accent: "#f2c65a",
    accentSoft: "rgba(242, 198, 90, 0.22)",
    accentDeep: "#5c3a18",
    atmosphere: "/illustrations/memory-circuit/memory-room-bg.webp",
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
    homeDescription: "Reative os selos, um comando de cada vez.",
    accent: "#6bc7b7",
    accentSoft: "rgba(107, 199, 183, 0.2)",
    accentDeep: "#214b43",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    transitionArt: "/illustrations/home/world-panel.webp",
    introArt: "/illustrations/home/world-panel.webp",
    artMode: "sprite",
    symbol: SlidersHorizontal,
    entryEyebrow: "Preparando a central",
    entryCopy: "Os comandos estão ao seu alcance.",
    motion: "signal",
  },
  "hidden-objects": {
    gameId: "hidden-objects",
    world: "discovery",
    visualName: "Estúdio das Descobertas",
    homeDescription: "Explore o estúdio e encontre os objetos.",
    accent: "#e8a46f",
    accentSoft: "rgba(232, 164, 111, 0.22)",
    accentDeep: "#5b3320",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    // A crop of the scene's current art kit (still authored by script — GAME03-EXPERIENCE-02's v1).
    transitionArt: "/assets/hidden-objects/explorer-studio/v1/hero.webp",
    introArt: "/assets/hidden-objects/explorer-studio/v1/hero.webp",
    artMode: "rendered",
    symbol: ScanSearch,
    entryEyebrow: "Abrindo o estúdio",
    entryCopy: "A luz da tarde revela os detalhes.",
    motion: "glint",
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    visualName: "Jardim de Sementes",
    homeDescription: "Cuide das sementes e acompanhe o ciclo.",
    accent: "#9fc96a",
    accentSoft: "rgba(159, 201, 106, 0.2)",
    accentDeep: "#365124",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
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
