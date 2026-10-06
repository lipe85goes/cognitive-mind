import type { GameId } from "@/types/game";

export type WorldDioramaState = "idle" | "focused" | "entering";

export type WorldDioramaKind =
  | "route"
  | "circuit"
  | "panel"
  | "discovery"
  | "garden";

/** Mundos com maquete em camadas (todos, desde HOME-WORLDS-FINAL-01). */
export type DioramaGameId = GameId;

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
  gameId: GameId;
  kind: WorldDioramaKind;
  width: number;
  height: number;
  layers: WorldDioramaLayerConfig[];
}


/**
 * Os três mundos secundários usam o mesmo vocabulário de passes:
 * sombra de contato, base, fundo, peça principal, detalhes, energia e frente.
 * Mesma câmera, mesma luz e mesmo canvas dos mundos-herói.
 */
const SECONDARY_SUFFIXES = [
  ["contact-shadow", 0, "wd-layer-shadow"],
  ["base", 1, "wd-layer-base"],
  ["back", 2, "wd-layer-back"],
  ["main", 3, "wd-layer-board"],
  ["detail", 4, "wd-layer-focus"],
  ["energy", 5, "wd-layer-energy"],
  ["front", 6, "wd-layer-front"],
] as const;

function buildSecondaryLayers(kind: "panel" | "discovery" | "garden") {
  const base = `/illustrations/home/dioramas/${kind}`;
  return SECONDARY_SUFFIXES.map(([suffix, depth, className]) => ({
    id: suffix,
    src: `${base}/${kind}-${suffix}.webp`,
    alt: "" as const,
    depth,
    className,
    priority: suffix === "base" || suffix === "main",
    ...(suffix === "back" ? { y: -0.5 } : {}),
    ...(suffix === "front" ? { y: 0.45 } : {}),
  }));
}

/**
 * HOME-HERO-WORLDS-3D-01 — os dois mundos-herói viraram maquetes ambientais.
 *
 * Antes a Home mostrava o próprio jogo (o GLB do tabuleiro deitado num plinto,
 * o board V2 do Circuito). Agora cada herói é uma pequena ilha: terreno, ruína,
 * caminho, portal, altar, energia e primeiro plano em passes independentes.
 * O canvas é 1120x840 com margem transparente real em todos os lados — o kit
 * anterior do Circuito terminava exatamente na última linha de pixels, e era
 * isso que fazia a base parecer decepada.
 */
const HERO_SUFFIXES = [
  ["shadow", 0, "wd-layer-shadow", 0],
  ["base", 1, "wd-layer-base", 0],
  ["terrain", 2, "wd-layer-back", -0.35],
  ["structure", 3, "wd-layer-board", 0],
  ["props", 4, "wd-layer-props", 0.2],
  ["characters", 5, "wd-layer-character", 0.35],
  ["energy", 6, "wd-layer-energy", 0],
  ["front", 7, "wd-layer-front", 0.6],
] as const;

/** O Circuito não tem passe de personagens: o artefato é o sujeito. */
const HERO_SKIPPED: Record<"route" | "circuit", readonly string[]> = {
  route: [],
  circuit: ["characters"],
};

function buildHeroLayers(kind: "route" | "circuit") {
  const base = `/illustrations/home/dioramas/${kind}-world`;
  return HERO_SUFFIXES.filter(
    ([suffix]) => !HERO_SKIPPED[kind].includes(suffix),
  ).map(([suffix, depth, className, y]) => ({
    id: suffix,
    src: `${base}/${kind}-${suffix}.webp`,
    alt: "" as const,
    depth,
    className,
    priority: suffix === "base" || suffix === "structure",
    ...(y ? { y } : {}),
  }));
}

export const WORLD_DIORAMA_CONFIGS: Record<GameId, WorldDioramaConfig> = {
  "escape-maze": {
    gameId: "escape-maze",
    kind: "route",
    width: 1120,
    height: 840,
    layers: buildHeroLayers("route"),
  },
  "color-sequence": {
    gameId: "color-sequence",
    kind: "circuit",
    width: 1120,
    height: 840,
    layers: buildHeroLayers("circuit"),
  },
  "security-panel": {
    gameId: "security-panel",
    kind: "panel",
    width: 1040,
    height: 780,
    layers: buildSecondaryLayers("panel"),
  },
  "hidden-objects": {
    gameId: "hidden-objects",
    kind: "discovery",
    width: 1040,
    height: 780,
    // GAME03-SKELETON-01: provisional maquette from tools/assets/create_hidden_objects_scene.mjs.
    layers: buildSecondaryLayers("discovery"),
  },
  "seed-garden": {
    gameId: "seed-garden",
    kind: "garden",
    width: 1040,
    height: 780,
    layers: buildSecondaryLayers("garden"),
  },
};

export function hasWorldDiorama(gameId: GameId): boolean {
  return Boolean(WORLD_DIORAMA_CONFIGS[gameId]);
}

export function getWorldDioramaConfig(gameId: GameId): WorldDioramaConfig {
  return WORLD_DIORAMA_CONFIGS[gameId];
}
