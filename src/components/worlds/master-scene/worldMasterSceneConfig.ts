import type { CSSProperties } from "react";
import type { GameId } from "@/types/game";

export type MasterSceneGameId = Extract<
  GameId,
  "escape-maze" | "color-sequence"
>;

export type WorldMasterSceneContext =
  | "home"
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
  world: "route" | "circuit";
  renderer: "route-diorama" | "circuit-board";
  focalElement: "portal" | "core";
  accessibleLabel: string;
  atmosphere: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  warmLight: string;
  essentialAssets: readonly string[];
  crops: Record<WorldMasterSceneContext, WorldMasterSceneCrop>;
}

const ROUTE_DIORAMA_PATH = "/illustrations/home/dioramas/route";
const CIRCUIT_MASTER_PATH =
  "/illustrations/worlds/master-scenes/circuit";

const ROUTE_ASSETS = [
  "route-contact-shadow.webp",
  "route-base.webp",
  "route-back-environment.webp",
  "route-board.webp",
  "route-walls.webp",
  "route-gameplay-props.webp",
  "route-portal.webp",
  "route-lights.webp",
  "route-guardian.webp",
  "route-explorer.webp",
  "route-front-environment.webp",
  "route-energy.webp",
].map((asset) => `${ROUTE_DIORAMA_PATH}/${asset}`);

export const CIRCUIT_MASTER_ASSETS = {
  board: `${CIRCUIT_MASTER_PATH}/memory-board-master.webp`,
  core: `${CIRCUIT_MASTER_PATH}/overlay-core-pulse.webp`,
  pads: [
    `${CIRCUIT_MASTER_PATH}/overlay-flame-active.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-wave-active.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-leaf-active.webp`,
    `${CIRCUIT_MASTER_PATH}/overlay-sun-active.webp`,
  ],
} as const;

export const WORLD_MASTER_SCENES: Record<
  MasterSceneGameId,
  WorldMasterSceneConfig
> = {
  "escape-maze": {
    gameId: "escape-maze",
    world: "route",
    renderer: "route-diorama",
    focalElement: "portal",
    accessibleLabel:
      "Maquete da Rota Estrategica com explorador, guardiao, luzes e portal teal.",
    atmosphere: "/illustrations/home/home-background-desktop.webp",
    accent: "#63ddca",
    accentSoft: "rgba(99, 221, 202, 0.24)",
    accentDeep: "#0d4c4a",
    warmLight: "#e1b45e",
    essentialAssets: ROUTE_ASSETS,
    crops: {
      home: { scale: 1, x: "0%", y: "0%" },
      transition: { scale: 1.14, x: "-2%", y: "1%" },
      intro: { scale: 1.08, x: "-1%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
  "color-sequence": {
    gameId: "color-sequence",
    world: "circuit",
    renderer: "circuit-board",
    focalElement: "core",
    accessibleLabel:
      "Circuito de Memoria circular com quatro pads coloridos e cristal central.",
    atmosphere: "/illustrations/memory-circuit/memory-room-bg.webp",
    accent: "#f2c65a",
    accentSoft: "rgba(242, 198, 90, 0.22)",
    accentDeep: "#5c3a18",
    warmLight: "#f2c65a",
    essentialAssets: [
      CIRCUIT_MASTER_ASSETS.board,
      CIRCUIT_MASTER_ASSETS.core,
      ...CIRCUIT_MASTER_ASSETS.pads,
    ],
    crops: {
      home: { scale: 0.96, x: "0%", y: "1%" },
      transition: { scale: 1.16, x: "0%", y: "2%" },
      intro: { scale: 1.08, x: "0%", y: "1%" },
      setup: { scale: 1.02, x: "0%", y: "0%" },
      "game-shell": { scale: 1, x: "0%", y: "0%" },
    },
  },
};

export function hasWorldMasterScene(
  gameId: GameId,
): gameId is MasterSceneGameId {
  return gameId === "escape-maze" || gameId === "color-sequence";
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
