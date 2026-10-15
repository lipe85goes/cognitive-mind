import type { CSSProperties } from "react";
import type { GameId } from "@/types/game";
import { WORLD_DIORAMA_CONFIGS } from "@/components/worlds/diorama/worldDioramaLayout";

/**
 * HOME-WORLD-VISUAL-UNIFICATION-01: every world painted with the atelier kit
 * has a master scene — the same maquette from the Home into the threshold and
 * the introduction. The Estúdio's entry keeps its room picture (Game 03's own
 * world visuals).
 */
export type MasterSceneGameId = Extract<
  GameId,
  "escape-maze" | "color-sequence" | "security-panel" | "seed-garden"
>;

/**
 * The Home draws every world's maquette directly (WorldDiorama, at rest and
 * uncropped — the same files); the master scene picks it up at the threshold.
 */
export type WorldMasterSceneContext =
  | "transition"
  | "intro"
  | "setup"
  | "game-shell";

export type WorldMasterSceneState = "idle" | "focused" | "entering";

interface WorldMasterSceneCrop {
  scale: number;
  x: string;
  y: string;
}

export interface WorldMasterSceneConfig {
  gameId: MasterSceneGameId;
  world: "route" | "circuit" | "commands" | "garden";
  renderer: "world-diorama";
  focalElement: "portal" | "core" | "seal" | "bloom";
  accessibleLabel: string;
  atmosphere: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  warmLight: string;
  essentialAssets: readonly string[];
  crops: Record<WorldMasterSceneContext, WorldMasterSceneCrop>;
}

/**
 * CIRCUIT-PRESENTATION-FINAL-01-FIX: the master scene now points at the SAME
 * runtime kit the active game renders. There is no second derived copy to
 * drift, and no stale optimizer entry keyed to a legacy URL can resurrect an
 * older artifact — Home, transition, intro, setup and game all read one source.
 */
const CIRCUIT_MASTER_PATH = "/assets/memory-circuit/v2";

/**
 * HOME-HERO-WORLDS-3D-01: os dois heróis usam o MESMO renderer em camadas, e a
 * prontidão espera exatamente os passes que serão pintados. Uma fonte só para
 * Home, transição, introdução e preparação — nada de cópia derivada.
 */
function dioramaAssets(gameId: MasterSceneGameId): readonly string[] {
  return WORLD_DIORAMA_CONFIGS[gameId].layers.map((layer) => layer.src);
}

export const CIRCUIT_MASTER_ASSETS = {
  board: `${CIRCUIT_MASTER_PATH}/memory-board.webp`,
  core: `${CIRCUIT_MASTER_PATH}/overlay-core.webp`,
  pads: [
    `${CIRCUIT_MASTER_PATH}/overlay-flame.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-wave.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-leaf.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-sun.webp`,
  ],
} as const;

export const WORLD_MASTER_SCENES: Record<
  MasterSceneGameId,
  WorldMasterSceneConfig
> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    renderer: "world-diorama",
    focalElement: "portal",
    accessibleLabel:
      "Maquete da Rota Estrategica: tabuleiro com explorador, guardiao, luzes, ruina e portal teal.",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    accent: "#63ddca",
    accentSoft: "rgba(99, 221, 202, 0.24)",
    accentDeep: "#0d4c4a",
    warmLight: "#e1b45e",
    essentialAssets: dioramaAssets("escape-maze"),
    crops: {
      transition: { scale: 1.14, x: "-2%", y: "1%" },
      intro: { scale: 1.08, x: "-1%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "circuit",
    renderer: "world-diorama",
    focalElement: "core",
    accessibleLabel:
      "Circuito de Memoria: disco de pedra com quatro pads coloridos e cristal central, num berco de bronze.",
    atmosphere: "/illustrations/memory-circuit/memory-room-bg.webp",
    accent: "#f2c65a",
    accentSoft: "rgba(242, 198, 90, 0.22)",
    accentDeep: "#5c3a18",
    warmLight: "#f2c65a",
    essentialAssets: dioramaAssets("color-sequence"),
    crops: {
      transition: { scale: 1.16, x: "0%", y: "2%" },
      intro: { scale: 1.08, x: "0%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
  "security-panel": {
    gameId: "security-panel",
    world: "commands",
    renderer: "world-diorama",
    focalElement: "seal",
    accessibleLabel:
      "Central de Comandos: console de madeira com o grande selo teal, alavancas e o armario de mostradores.",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    accent: "#6bc7b7",
    accentSoft: "rgba(107, 199, 183, 0.2)",
    accentDeep: "#214b43",
    warmLight: "#e1b45e",
    essentialAssets: dioramaAssets("security-panel"),
    crops: {
      transition: { scale: 1.14, x: "0%", y: "2%" },
      intro: { scale: 1.08, x: "0%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
  "seed-garden": {
    gameId: "seed-garden",
    world: "garden",
    renderer: "world-diorama",
    focalElement: "bloom",
    accessibleLabel:
      "Jardim de Sementes: banco de semeadura com seis vasos (sementes, broto e flor), regador, redoma de vidro e trelica de feijao.",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    accent: "#9fc96a",
    accentSoft: "rgba(159, 201, 106, 0.2)",
    accentDeep: "#365124",
    warmLight: "#e1b45e",
    essentialAssets: dioramaAssets("seed-garden"),
    crops: {
      transition: { scale: 1.14, x: "0%", y: "2%" },
      intro: { scale: 1.08, x: "0%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
};

export function hasWorldMasterScene(
  gameId: GameId,
): gameId is MasterSceneGameId {
  // hasOwnProperty, not Object.hasOwn: older tablets (Safari < 15.4) still visit.
  return Object.prototype.hasOwnProperty.call(WORLD_MASTER_SCENES, gameId);
}

export function getWorldMasterSceneConfig(
  gameId: MasterSceneGameId,
): WorldMasterSceneConfig {
  return WORLD_MASTER_SCENES[gameId];
}

export function getWorldMasterSceneStyle(
  gameId: MasterSceneGameId,
  context: WorldMasterSceneContext,
): CSSProperties {
  const config = getWorldMasterSceneConfig(gameId);
  const crop = config.crops[context];

  return {
    "--wms-accent": config.accent,
    "--wms-accent-soft": config.accentSoft,
    "--wms-accent-deep": config.accentDeep,
    "--wms-warm-light": config.warmLight,
    "--wms-atmosphere": `url(${config.atmosphere})`,
    "--wms-scene-scale": crop.scale,
    "--wms-scene-x": crop.x,
    "--wms-scene-y": crop.y,
  } as CSSProperties;
}
