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

/** Which scene a session explored (the result records it; one scene exists today). */
export const SCENE_ID = "explorer-studio";

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

/**
 * Findability, not score: A is in plain sight, B is partly covered or sits
 * among one look-alike, C is tucked into its surroundings among up to two —
 * always with its identifying part in view (Discovery §9, F1/F8).
 */
export type TargetTier = "A" | "B" | "C";

export type SceneRegion =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export interface HiddenObjectDefinition {
  id: TargetId;
  /** The word on the list: a concrete noun, never a colour. Difícil shows it only once found. */
  label: string;
  /** What assistive technology announces. */
  accessibleLabel: string;
  /**
   * Difícil's list: what the object is for, never its name — the Explorador
   * works out the idea, then looks for the thing. One object in the room fits it.
   */
  clue: string;
  tier: TargetTier;
  station: StationId;
  /** The tappable shape: the visible part of the object, in su. */
  region: SceneRegion;
  /** Fácil's second hint, "Procure …": the spot itself. */
  hintRegion: string;
  /** Médio's last hint, "Olhe …": a direction inside the station, never the spot. */
  hintDirection: string;
  /** Difícil's last hint, "Está …": what the object is near, never where exactly. */
  hintContext: string;
}

/**
 * The pool: ten objects, each painted exactly once in the scene (A3 · B3 · C4).
 * GAME03-EXPERIENCE-02 moved the lanterna to B (dimmer, behind books, beside a
 * look-alike) and the câmera to C (darker, half behind a leaning book), so
 * Difícil can be 1A + 3B + 4C.
 */
export const HIDDEN_OBJECTS: readonly HiddenObjectDefinition[] = [
  {
    id: "ampulheta",
    label: "Ampulheta",
    accessibleLabel: "Ampulheta",
    clue: "Marca a passagem do tempo sem ponteiros.",
    tier: "A",
    station: "janela",
    region: { kind: "rect", x: 742, y: 952, w: 116, h: 222 },
    hintRegion: "na mesinha junto à janela",
    hintDirection: "mais abaixo, ao lado da poltrona",
    hintContext: "perto de onde alguém se senta para ler",
  },
  {
    id: "binoculo",
    label: "Binóculo",
    accessibleLabel: "Binóculo",
    clue: "Aproxima o que está distante.",
    tier: "B",
    station: "janela",
    region: { kind: "rect", x: 424, y: 930, w: 152, h: 78 },
    hintRegion: "no peitoril da janela",
    hintDirection: "na base da janela, do lado esquerdo",
    hintContext: "onde a luz da tarde entra, entre vasos e pedrinhas",
  },
  {
    id: "chave",
    label: "Chave antiga",
    accessibleLabel: "Chave antiga",
    clue: "Abre o que está trancado.",
    tier: "C",
    station: "janela",
    region: { kind: "rect", x: 452, y: 1246, w: 132, h: 56 },
    hintRegion: "sobre o baú",
    hintDirection: "mais embaixo, perto do chão",
    hintContext: "em cima de algo que guarda coisas fechadas",
  },
  {
    id: "lupa",
    label: "Lupa",
    accessibleLabel: "Lupa",
    clue: "Amplia pequenos detalhes.",
    tier: "A",
    station: "mesa",
    region: { kind: "circle", cx: 1760, cy: 1040, r: 92 },
    hintRegion: "sobre o mapa",
    hintDirection: "no meio da mesa, um pouco à direita",
    hintContext: "sobre um papel cheio de caminhos",
  },
  {
    id: "bussola",
    label: "Bússola",
    accessibleLabel: "Bússola",
    clue: "Aponta sempre para o norte.",
    tier: "B",
    station: "mesa",
    region: { kind: "circle", cx: 1540, cy: 1160, r: 66 },
    hintRegion: "na borda do mapa",
    hintDirection: "na frente da mesa, perto da beirada",
    hintContext: "entre um livro aberto e um mapa",
  },
  {
    id: "relogio",
    label: "Relógio",
    accessibleLabel: "Relógio de bolso",
    clue: "Mostra as horas e cabe no bolso.",
    tier: "C",
    station: "mesa",
    region: { kind: "circle", cx: 1330, cy: 1178, r: 48 },
    hintRegion: "perto do livro aberto",
    hintDirection: "no lado esquerdo da mesa, bem na frente",
    hintContext: "junto de moedas, preso a uma corrente",
  },
  {
    id: "barco",
    label: "Barco em miniatura",
    accessibleLabel: "Barco em miniatura",
    clue: "Viaja sobre a água.",
    tier: "A",
    station: "estante",
    region: { kind: "rect", x: 2360, y: 615, w: 290, h: 215 },
    hintRegion: "na prateleira do meio",
    hintDirection: "no meio da estante, do lado esquerdo",
    hintContext: "entre livros, numa prateleira do meio",
  },
  {
    id: "lanterna",
    label: "Lanterna",
    accessibleLabel: "Lanterna",
    clue: "Leva a luz para onde você for.",
    tier: "B",
    station: "estante",
    region: { kind: "rect", x: 2780, y: 848, w: 126, h: 212 },
    hintRegion: "nas prateleiras de baixo",
    hintDirection: "na parte de baixo da estante, à direita",
    hintContext: "numa prateleira baixa, cercada de livros",
  },
  {
    id: "camera",
    label: "Câmera",
    accessibleLabel: "Câmera fotográfica antiga",
    clue: "Captura uma cena com um clique.",
    tier: "C",
    station: "estante",
    region: { kind: "rect", x: 2720, y: 480, w: 166, h: 118 },
    hintRegion: "na segunda prateleira",
    hintDirection: "no alto da estante, do lado direito",
    hintContext: "numa prateleira cheia de livros, perto de potes de vidro",
  },
  {
    id: "estatueta",
    label: "Estatueta",
    accessibleLabel: "Estatueta",
    clue: "Uma pequena figura esculpida.",
    tier: "C",
    station: "estante",
    region: { kind: "rect", x: 2615, y: 245, w: 84, h: 122 },
    hintRegion: "na prateleira mais alta",
    hintDirection: "bem no alto da estante",
    hintContext: "entre lombadas de livros, perto do teto",
  },
];

/**
 * A look-alike: an ordinary thing of the room painted near a target because it
 * shares its shape or material — never its kind, never its use, so no clue fits
 * it and a careful look tells them apart. It is decoration: a tap on it is a
 * free tap like any other. The art script paints each exactly in its region.
 */
export interface SceneLookAlike {
  id: string;
  /** What it is: a concrete noun that is not any target's. */
  label: string;
  /** The target it can be mistaken for at a glance. */
  resembles: TargetId;
  /** What a careful look sees that the target does not have (or the other way round). */
  tellApart: string;
  region: SceneRegion;
}

/**
 * Look-alikes per target, by tier: A ≤ 1, B ≤ 2, C ≤ 3. Each sits in its
 * target's station and at least LOOKALIKE_CLEARANCE_SU from every target's
 * shape, so the tolerance of a tap never turns it into a find.
 */
export const LOOKALIKE_CLEARANCE_SU = 32;

export const SCENE_LOOKALIKES: readonly SceneLookAlike[] = [
  {
    id: "vaso-torneado",
    label: "Vaso torneado",
    resembles: "ampulheta",
    tellApart: "madeira de cintura fina, sem vidro e sem areia",
    region: { kind: "rect", x: 912, y: 892, w: 40, h: 108 },
  },
  {
    id: "tinteiros",
    label: "Tinteiros",
    resembles: "binoculo",
    tellApart: "dois frascos escuros lado a lado, sem lentes",
    region: { kind: "rect", x: 624, y: 950, w: 58, h: 50 },
  },
  {
    id: "alca-do-bau",
    label: "Alça do baú",
    resembles: "chave",
    tellApart: "um arco de latão preso à tampa, sem dentes",
    region: { kind: "rect", x: 628, y: 1258, w: 48, h: 24 },
  },
  {
    id: "fivela",
    label: "Fivela da correia",
    resembles: "chave",
    tellApart: "um aro quadrado na correia, sem haste",
    region: { kind: "rect", x: 606, y: 1386, w: 28, h: 28 },
  },
  {
    id: "carimbo",
    label: "Carimbo de lacre",
    resembles: "lupa",
    tellApart: "cabo e base de latão maciça, sem vidro",
    region: { kind: "rect", x: 1900, y: 1004, w: 46, h: 84 },
  },
  {
    id: "lata-redonda",
    label: "Lata redonda",
    resembles: "bussola",
    tellApart: "tampa lisa, sem mostrador nem agulha",
    region: { kind: "circle", cx: 1660, cy: 1206, r: 22 },
  },
  {
    id: "moedas",
    label: "Moedas",
    resembles: "relogio",
    tellApart: "discos de latão empilhados, sem mostrador nem corrente",
    region: { kind: "rect", x: 1410, y: 1180, w: 32, h: 28 },
  },
  {
    id: "chaleira",
    label: "Chaleira de latão",
    resembles: "lanterna",
    tellApart: "bico e tampa, sem vidro e sem chama",
    region: { kind: "rect", x: 2666, y: 990, w: 72, h: 70 },
  },
  {
    id: "caixinha-de-musica",
    label: "Caixinha de música",
    resembles: "camera",
    tellApart: "caixa escura com manivela, sem lente",
    region: { kind: "rect", x: 2300, y: 468, w: 110, h: 54 },
  },
  {
    id: "vaso-de-porcelana",
    label: "Vaso de porcelana",
    resembles: "estatueta",
    tellApart: "branco e liso, sem rosto e sem braços",
    region: { kind: "rect", x: 2834, y: 282, w: 40, h: 88 },
  },
  {
    id: "rolo-de-papel",
    label: "Rolo de papel",
    resembles: "estatueta",
    tellApart: "um cilindro claro em pé, sem forma de figura",
    region: { kind: "rect", x: 2540, y: 252, w: 26, h: 118 },
  },
];

/** How the list shows a pending object: picture + name → silhouette + name → what it is for. */
export type ListStyle = "picture" | "silhouette" | "clue";

/**
 * One press of Pista, in the order a difficulty climbs them:
 *   station   — names the station and takes the camera there (every difficulty);
 *   area      — a soft pool of light holding the object off-centre + the spot in words (Fácil);
 *   wide-area — a wider pool, no words for the spot (Médio);
 *   direction — a direction inside the station, in words only (Médio);
 *   context   — what the object is near, in words only (Difícil);
 *   reveal    — "Mostrar onde está": frames the object under a halo (Fácil only).
 */
export type HintRung = "station" | "area" | "wide-area" | "direction" | "context" | "reveal";

export interface DifficultyPreset {
  label: string;
  /** Fixed (no draw): the list, in the order it is shown. */
  targets: readonly TargetId[];
  listStyle: ListStyle;
  /** What each press of Pista adds, per object; the ladder stops at its last rung. */
  hintLadder: readonly HintRung[];
  /** Radius of the area pool of light, in su (unused by a ladder without one). */
  hintRadius: number;
  /** Extra reach around a target's shape, in screen px, per pointer kind. */
  tolerancePx: { touch: number; mouse: number };
}

/**
 * GAME03-EXPERIENCE-02. Each difficulty changes what the Explorador is TOLD,
 * not only how much there is to find:
 *   Fácil   5 · 3A+2B · picture + name · station → spot + pool → "Mostrar onde está";
 *   Médio   6 · 1A+3B+2C · silhouette + name · station → wide pool → direction;
 *   Difícil 8 · 1A+3B+4C · what it is for (the name only once found) · station → context.
 * Médio and Difícil never point at the object; Difícil never lights anything.
 * The tolerances are the skeleton's: difficulty never comes from smaller targets.
 */
export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyLevel, DifficultyPreset>> = {
  easy: {
    label: "Fácil",
    targets: ["lupa", "ampulheta", "barco", "lanterna", "bussola"],
    listStyle: "picture",
    hintLadder: ["station", "area", "reveal"],
    hintRadius: 240,
    tolerancePx: { touch: 16, mouse: 8 },
  },
  medium: {
    label: "Médio",
    targets: ["ampulheta", "binoculo", "bussola", "relogio", "camera", "lanterna"],
    listStyle: "silhouette",
    hintLadder: ["station", "wide-area", "direction"],
    hintRadius: 400,
    tolerancePx: { touch: 12, mouse: 6 },
  },
  hard: {
    label: "Difícil",
    targets: ["binoculo", "chave", "lupa", "bussola", "relogio", "lanterna", "camera", "estatueta"],
    listStyle: "clue",
    hintLadder: ["station", "context"],
    hintRadius: 0,
    tolerancePx: { touch: 10, mouse: 5 },
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

/** Versioned folder: a new art kit is a new folder, never an overwrite (v0 was the skeleton's). */
export const SCENE_ASSET_BASE = "/assets/hidden-objects/explorer-studio/v1";

export interface SceneLayer {
  id: "back" | "plate" | "front" | "front-right";
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
  {
    // GAME03-EXPERIENCE-02: the right edge gets its own foreground, so the room
    // is framed in depth on both sides — vines from the beam, books on the floor.
    id: "front-right",
    src: `${SCENE_ASSET_BASE}/front-right.webp`,
    rect: { x: 2700, y: 0, w: 500, h: SCENE_HEIGHT },
    parallax: 1.05,
    opaque: [
      { x: 2700, y: 0, w: 500, h: 156 },
      { x: 3008, y: 0, w: 192, h: 400 },
      { x: 3024, y: 1440, w: 176, h: 160 },
    ],
  },
];

export const thumbnailSrc = (id: TargetId) => `${SCENE_ASSET_BASE}/thumbs/${id}.webp`;
