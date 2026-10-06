import type { DifficultyLevel } from "@/types/game";

/**
 * Estúdio das Descobertas — the first scene, as data.
 *
 * Everything here is in scene units (su): the plate is 3200×1600 su and its
 * image is drawn at 1 px per su, origin top-left. Nothing in this module runs:
 * the game, its tests and the art script (tools/assets/
 * create_hidden_objects_scene.mjs, which paints every target exactly where its
 * `region` says) all read the same values.
 */

export const SCENE_WIDTH = 3200;
export const SCENE_HEIGHT = 1600;

/**
 * No target may sit in these margins: the zoom buttons live in a corner of the
 * scene, and the margins guarantee nothing is ever stuck under them.
 */
export const SAFE_MARGIN_X = 256;
export const SAFE_MARGIN_Y = 160;

export type StationId = "janela" | "mesa" | "estante";

export interface SceneStation {
  id: StationId;
  label: string;
  /** Where the camera centres when the Explorador asks for this station. */
  center: { x: number; y: number };
  /** The stretch of the scene the station names (hints, "você está em"). */
  span: { x0: number; x1: number };
  /** Hint 1 copy: "Procure …". */
  hintPhrase: string;
}

export const SCENE_STATIONS: readonly SceneStation[] = [
  {
    id: "janela",
    label: "Janela",
    center: { x: 620, y: 860 },
    span: { x0: 0, x1: 1060 },
    hintPhrase: "perto da janela",
  },
  {
    id: "mesa",
    label: "Mesa",
    center: { x: 1600, y: 900 },
    span: { x0: 1060, x1: 2140 },
    hintPhrase: "na mesa",
  },
  {
    id: "estante",
    label: "Estante",
    center: { x: 2620, y: 760 },
    span: { x0: 2140, x1: SCENE_WIDTH },
    hintPhrase: "na estante",
  },
];

export type TargetId =
  | "ampulheta"
  | "binoculo"
  | "chave"
  | "lupa"
  | "bussola"
  | "relogio"
  | "barco"
  | "lanterna"
  | "camera"
  | "estatueta";

/** Findability, not score: A is in plain sight, C is tucked into its surroundings. */
export type TargetTier = "A" | "B" | "C";

export type SceneRegion =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export interface HiddenObjectDefinition {
  id: TargetId;
  /** The word on the list: a concrete noun, never a colour. */
  label: string;
  /** What assistive technology announces. */
  accessibleLabel: string;
  tier: TargetTier;
  station: StationId;
  /** The tappable shape: the visible part of the object, in su. */
  region: SceneRegion;
  /** Hint 2 copy: "Procure …". */
  hintRegion: string;
}

/** The pool: ten objects, each painted exactly once in the scene (A4 · B3 · C3). */
export const HIDDEN_OBJECTS: readonly HiddenObjectDefinition[] = [
  {
    id: "ampulheta",
    label: "Ampulheta",
    accessibleLabel: "Ampulheta",
    tier: "A",
    station: "janela",
    region: { kind: "rect", x: 742, y: 952, w: 116, h: 222 },
    hintRegion: "na mesinha junto à janela",
  },
  {
    id: "binoculo",
    label: "Binóculo",
    accessibleLabel: "Binóculo",
    tier: "B",
    station: "janela",
    region: { kind: "rect", x: 424, y: 930, w: 152, h: 78 },
    hintRegion: "no peitoril da janela",
  },
  {
    id: "chave",
    label: "Chave antiga",
    accessibleLabel: "Chave antiga",
    tier: "C",
    station: "janela",
    region: { kind: "rect", x: 452, y: 1246, w: 132, h: 56 },
    hintRegion: "sobre o baú",
  },
  {
    id: "lupa",
    label: "Lupa",
    accessibleLabel: "Lupa",
    tier: "A",
    station: "mesa",
    region: { kind: "circle", cx: 1760, cy: 1040, r: 92 },
    hintRegion: "sobre o mapa",
  },
  {
    id: "bussola",
    label: "Bússola",
    accessibleLabel: "Bússola",
    tier: "B",
    station: "mesa",
    region: { kind: "circle", cx: 1540, cy: 1160, r: 66 },
    hintRegion: "na borda do mapa",
  },
  {
    id: "relogio",
    label: "Relógio",
    accessibleLabel: "Relógio de bolso",
    tier: "C",
    station: "mesa",
    region: { kind: "circle", cx: 1330, cy: 1178, r: 48 },
    hintRegion: "perto do livro aberto",
  },
  {
    id: "barco",
    label: "Barco em miniatura",
    accessibleLabel: "Barco em miniatura",
    tier: "A",
    station: "estante",
    region: { kind: "rect", x: 2360, y: 615, w: 290, h: 215 },
    hintRegion: "na prateleira do meio",
  },
  {
    id: "lanterna",
    label: "Lanterna",
    accessibleLabel: "Lanterna",
    tier: "A",
    station: "estante",
    region: { kind: "rect", x: 2780, y: 848, w: 126, h: 212 },
    hintRegion: "nas prateleiras de baixo",
  },
  {
    id: "camera",
    label: "Câmera",
    accessibleLabel: "Câmera fotográfica antiga",
    tier: "B",
    station: "estante",
    region: { kind: "rect", x: 2720, y: 480, w: 166, h: 118 },
    hintRegion: "na segunda prateleira",
  },
  {
    id: "estatueta",
    label: "Estatueta",
    accessibleLabel: "Estatueta",
    tier: "C",
    station: "estante",
    region: { kind: "rect", x: 2615, y: 245, w: 84, h: 122 },
    hintRegion: "na prateleira mais alta",
  },
];

export type ListStyle = "picture" | "silhouette" | "word";

export interface DifficultyPreset {
  label: string;
  /** Fixed in the skeleton (no draw): the list, in the order it is shown. */
  targets: readonly TargetId[];
  /** How the list shows an object: picture → silhouette → word. */
  listStyle: ListStyle;
  /** Radius of the hint-2 halo, in su; never smaller than the object needs. */
  hintRadius: number;
  /** Extra reach around a target's shape, in screen px, per pointer kind. */
  tolerancePx: { touch: number; mouse: number };
}

/**
 * Fácil 4A+1B, Médio 2A+3B+1C, Difícil 2A+3B+3C. The mission preferred
 * 1A+4B+3C for Difícil, but a ten-object pool cannot hold Fácil's four A, four
 * B and three C at once (4 + 4 + 3 = 11): Difícil keeps the Discovery's two
 * warm-up A instead of a fourth B.
 */
export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyLevel, DifficultyPreset>> = {
  easy: {
    label: "Fácil",
    targets: ["lupa", "ampulheta", "barco", "lanterna", "bussola"],
    listStyle: "picture",
    hintRadius: 240,
    tolerancePx: { touch: 16, mouse: 8 },
  },
  medium: {
    label: "Médio",
    targets: ["ampulheta", "binoculo", "bussola", "relogio", "camera", "lanterna"],
    listStyle: "silhouette",
    hintRadius: 300,
    tolerancePx: { touch: 12, mouse: 6 },
  },
  hard: {
    label: "Difícil",
    targets: ["binoculo", "chave", "lupa", "bussola", "relogio", "barco", "camera", "estatueta"],
    listStyle: "word",
    hintRadius: 380,
    tolerancePx: { touch: 10, mouse: 5 },
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

/** Versioned folder: a new art kit is a new folder, never an overwrite. */
export const SCENE_ASSET_BASE = "/assets/hidden-objects/explorer-studio/v0";

export interface SceneLayer {
  id: "back" | "plate" | "front";
  src: string;
  rect: { x: number; y: number; w: number; h: number };
  /**
   * How far the layer travels relative to the plate when the camera pans:
   * < 1 drifts behind (the view through the window), > 1 slides in front.
   */
  parallax: number;
  /** Where the layer has paint, in su: front paint must never cover a target. */
  opaque: readonly { x: number; y: number; w: number; h: number }[];
}

export const SCENE_LAYERS: readonly SceneLayer[] = [
  {
    id: "back",
    src: `${SCENE_ASSET_BASE}/back.webp`,
    rect: { x: 160, y: 90, w: 920, h: 1000 },
    parallax: 0.92,
    opaque: [{ x: 160, y: 90, w: 920, h: 1000 }],
  },
  {
    id: "plate",
    src: `${SCENE_ASSET_BASE}/plate.webp`,
    rect: { x: 0, y: 0, w: SCENE_WIDTH, h: SCENE_HEIGHT },
    parallax: 1,
    opaque: [{ x: 0, y: 0, w: SCENE_WIDTH, h: SCENE_HEIGHT }],
  },
  {
    id: "front",
    src: `${SCENE_ASSET_BASE}/front.webp`,
    rect: { x: 0, y: 0, w: 360, h: SCENE_HEIGHT },
    parallax: 1.05,
    opaque: [
      { x: 0, y: 0, w: 300, h: 360 },
      { x: 0, y: 1150, w: 340, h: 450 },
    ],
  },
];

export const thumbnailSrc = (id: TargetId) => `${SCENE_ASSET_BASE}/thumbs/${id}.webp`;
