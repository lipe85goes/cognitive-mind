import type { GameId } from "@/types/game";

export type WorldDioramaState = "idle" | "focused" | "entering";

export type WorldDioramaKind = "route" | "circuit";

export interface WorldDioramaLayerConfig {
  id: string;
  src: string;
  alt: "";
  depth: number;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  className?: string;
  priority?: boolean;
}

export interface WorldDioramaConfig {
  gameId: Extract<GameId, "escape-maze" | "color-sequence">;
  kind: WorldDioramaKind;
  width: number;
  height: number;
  layers: WorldDioramaLayerConfig[];
}

const ROUTE_PATH = "/illustrations/home/dioramas/route";
const CIRCUIT_PATH = "/illustrations/home/dioramas/circuit";

export const WORLD_DIORAMA_CONFIGS: Record<
  "escape-maze" | "color-sequence",
  WorldDioramaConfig
> = {
  "escape-maze": {
    gameId: "escape-maze",
    kind: "route",
    width: 1040,
    height: 780,
    layers: [
      {
        id: "contact-shadow",
        src: `${ROUTE_PATH}/route-contact-shadow.webp`,
        alt: "",
        depth: 0,
        className: "wd-layer-shadow",
      },
      {
        id: "base",
        src: `${ROUTE_PATH}/route-base.webp`,
        alt: "",
        depth: 1,
        className: "wd-layer-base",
        priority: true,
      },
      {
        id: "back-environment",
        src: `${ROUTE_PATH}/route-back-environment.webp`,
        alt: "",
        depth: 2,
        y: -0.6,
        className: "wd-layer-back",
      },
      {
        id: "board",
        src: `${ROUTE_PATH}/route-board.webp`,
        alt: "",
        depth: 3,
        className: "wd-layer-board",
        priority: true,
      },
      {
        id: "walls",
        src: `${ROUTE_PATH}/route-walls.webp`,
        alt: "",
        depth: 4,
        className: "wd-layer-props",
      },
      {
        id: "gameplay-props",
        src: `${ROUTE_PATH}/route-gameplay-props.webp`,
        alt: "",
        depth: 5,
        className: "wd-layer-props",
      },
      {
        id: "portal",
        src: `${ROUTE_PATH}/route-portal.webp`,
        alt: "",
        depth: 6,
        y: -0.4,
        className: "wd-layer-focus wd-layer-portal",
      },
      {
        id: "lights",
        src: `${ROUTE_PATH}/route-lights.webp`,
        alt: "",
        depth: 7,
        className: "wd-layer-energy wd-layer-lights",
      },
      {
        id: "guardian",
        src: `${ROUTE_PATH}/route-guardian.webp`,
        alt: "",
        depth: 8,
        y: -0.25,
        className: "wd-layer-character",
      },
      {
        id: "explorer",
        src: `${ROUTE_PATH}/route-explorer.webp`,
        alt: "",
        depth: 9,
        y: 0.25,
        className: "wd-layer-character wd-layer-explorer",
      },
      {
        id: "front-environment",
        src: `${ROUTE_PATH}/route-front-environment.webp`,
        alt: "",
        depth: 10,
        y: 0.45,
        className: "wd-layer-front",
      },
      {
        id: "energy",
        src: `${ROUTE_PATH}/route-energy.webp`,
        alt: "",
        depth: 11,
        className: "wd-layer-energy wd-layer-route-energy",
      },
    ],
  },
  "color-sequence": {
    gameId: "color-sequence",
    kind: "circuit",
    width: 1040,
    height: 780,
    layers: [
      {
        id: "contact-shadow",
        src: `${CIRCUIT_PATH}/circuit-contact-shadow.webp`,
        alt: "",
        depth: 0,
        className: "wd-layer-shadow",
      },
      {
        id: "back-environment",
        src: `${CIRCUIT_PATH}/circuit-back-environment.webp`,
        alt: "",
        depth: 1,
        y: -0.45,
        className: "wd-layer-back",
      },
      {
        id: "base",
        src: `${CIRCUIT_PATH}/circuit-base.webp`,
        alt: "",
        depth: 2,
        className: "wd-layer-base",
      },
      {
        id: "board",
        src: `${CIRCUIT_PATH}/circuit-board.webp`,
        alt: "",
        depth: 3,
        className: "wd-layer-board",
        priority: true,
      },
      {
        id: "pads",
        src: `${CIRCUIT_PATH}/circuit-pads.webp`,
        alt: "",
        depth: 5,
        className: "wd-layer-focus wd-layer-pads",
      },
      {
        id: "energy",
        src: `${CIRCUIT_PATH}/circuit-energy.webp`,
        alt: "",
        depth: 6,
        className: "wd-layer-energy wd-layer-circuit-energy",
      },
      {
        id: "core",
        src: `${CIRCUIT_PATH}/circuit-core.webp`,
        alt: "",
        depth: 7,
        className: "wd-layer-focus wd-layer-core",
      },
      {
        id: "front-environment",
        src: `${CIRCUIT_PATH}/circuit-front-environment.webp`,
        alt: "",
        depth: 8,
        y: 0.4,
        className: "wd-layer-front",
      },
    ],
  },
};

export function hasWorldDiorama(gameId: GameId): gameId is "escape-maze" | "color-sequence" {
  return gameId === "escape-maze" || gameId === "color-sequence";
}

export function getWorldDioramaConfig(
  gameId: Extract<GameId, "escape-maze" | "color-sequence">,
): WorldDioramaConfig {
  return WORLD_DIORAMA_CONFIGS[gameId];
}
