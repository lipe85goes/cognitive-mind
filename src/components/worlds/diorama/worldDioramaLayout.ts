import type { GameId } from "@/types/game";

export type WorldDioramaState = "idle" | "focused" | "entering";

export type WorldDioramaKind =
  | "route"
  | "circuit"
  | "commands"
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
 * HOME-WORLD-VISUAL-UNIFICATION-01 — o contrato do ateliê.
 *
 * Toda maquete da Home é a mesma construção: o mesmo pedestal, a mesma câmera,
 * a mesma luz e os mesmos passes, na mesma ordem — os do Estúdio das
 * Descobertas, a referência de qualidade. Só o assunto muda de mundo para
 * mundo, e ele vive nos arquivos de cada kit, não no código.
 *
 * Canvas único 1040×780 (4:3) com margem transparente real: como o pedestal
 * ocupa o mesmo lugar em todos os kits, a escala, a sombra e a placa caem no
 * mesmo ponto em todos os mundos.
 */
export const DIORAMA_CANVAS = { width: 1040, height: 780 } as const;

/** Os passes, de trás para a frente: sombra de contato, base, fundo, peça principal, detalhes, energia e frente. */
export const DIORAMA_PASSES = [
  { id: "contact-shadow", depth: 0, className: "wd-layer-shadow", priority: false },
  { id: "base", depth: 1, className: "wd-layer-base", priority: true },
  { id: "back", depth: 2, className: "wd-layer-back", priority: false, y: -0.5 },
  { id: "main", depth: 3, className: "wd-layer-board", priority: true },
  { id: "detail", depth: 4, className: "wd-layer-focus", priority: false },
  { id: "energy", depth: 5, className: "wd-layer-energy", priority: false },
  { id: "front", depth: 6, className: "wd-layer-front", priority: false, y: 0.45 },
] as const;

export type DioramaPassId = (typeof DIORAMA_PASSES)[number]["id"];

/**
 * Onde moram os arquivos de um kit: `<prefix>-<pass>.webp`, e os passes que o
 * kit divide com outros mundos (a sombra de contato do ateliê é uma só).
 */
interface WorldDioramaKit {
  kind: WorldDioramaKind;
  prefix: string;
  shared?: Partial<Record<DioramaPassId, string>>;
}

/** Kits pintados por tools/assets/create_home_atelier_dioramas.mjs. */
const ATELIER = "/illustrations/home/atelier";
const ATELIER_SHARED = { "contact-shadow": `${ATELIER}/shared/atelier-contact-shadow.webp` };

const WORLD_DIORAMA_KITS: Record<GameId, WorldDioramaKit> = {
  "escape-maze": { kind: "route", prefix: `${ATELIER}/route/route`, shared: ATELIER_SHARED },
  "color-sequence": { kind: "circuit", prefix: `${ATELIER}/circuit/circuit`, shared: ATELIER_SHARED },
  "security-panel": { kind: "commands", prefix: `${ATELIER}/commands/commands`, shared: ATELIER_SHARED },
  // A referência: pintada pelo próprio kit de arte do Estúdio
  // (tools/assets/create_hidden_objects_scene.mjs --home), já no contrato.
  "hidden-objects": { kind: "discovery", prefix: "/illustrations/home/dioramas/discovery/discovery" },
  "seed-garden": { kind: "garden", prefix: `${ATELIER}/garden/garden`, shared: ATELIER_SHARED },
};

function buildLayers(kit: WorldDioramaKit): WorldDioramaLayerConfig[] {
  return DIORAMA_PASSES.map((pass) => ({
    id: pass.id,
    src: kit.shared?.[pass.id] ?? `${kit.prefix}-${pass.id}.webp`,
    alt: "" as const,
    depth: pass.depth,
    className: pass.className,
    priority: pass.priority,
    ...("y" in pass ? { y: pass.y } : {}),
  }));
}

export const WORLD_DIORAMA_CONFIGS: Record<GameId, WorldDioramaConfig> =
  Object.fromEntries(
    (Object.entries(WORLD_DIORAMA_KITS) as [GameId, WorldDioramaKit][]).map(
      ([gameId, kit]) => [
        gameId,
        {
          gameId,
          kind: kit.kind,
          width: DIORAMA_CANVAS.width,
          height: DIORAMA_CANVAS.height,
          layers: buildLayers(kit),
        },
      ],
    ),
  ) as Record<GameId, WorldDioramaConfig>;

export function hasWorldDiorama(gameId: GameId): boolean {
  return Boolean(WORLD_DIORAMA_CONFIGS[gameId]);
}

export function getWorldDioramaConfig(gameId: GameId): WorldDioramaConfig {
  return WORLD_DIORAMA_CONFIGS[gameId];
}
