import type { HiddenObjectDefinition, SceneDefinition, SceneLayer, SceneLookAlike, SceneStation, TargetId } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Observatório do Explorador — Game 03's second room (GAME03-MULTISCENE-03), as data.
 *
 * The top floor of an old observatory at dusk: under the opened dome a brass
 * refractor points at the first stars (Cúpula); in the middle, a work bench
 * under a hanging lamp and a round window full of the last light (Bancada); on
 * the right, map drawers, a glass cabinet and an explorer's curiosities
 * (Arquivo). Cool sky light comes in through the dome and the window, warm light
 * from the lamp, a candle and a small green lamp.
 *
 * 3600×1600 su. tools/assets/create_observatory_scene.mjs paints every target
 * exactly where its `region` says, every look-alike in its own, and keeps the
 * foreground layers inside their `opaque` rects — it reads this module to do it.
 */

/** Which room a session explored (the result records it). */
export const SCENE_ID = "explorer-observatory";

export const SCENE_WIDTH = 3600;
export const SCENE_HEIGHT = 1600;

export const SCENE_STATIONS: readonly SceneStation[] = [
  {
    id: "cupula",
    label: "Cúpula",
    center: { x: 700, y: 820 },
    span: { x0: 0, x1: 1240 },
    hintPhrase: "sob a cúpula, perto do telescópio",
  },
  {
    id: "bancada",
    label: "Bancada",
    center: { x: 1820, y: 820 },
    span: { x0: 1240, x1: 2400 },
    hintPhrase: "na bancada de trabalho",
  },
  {
    id: "arquivo",
    label: "Arquivo",
    center: { x: 2900, y: 780 },
    span: { x0: 2400, x1: SCENE_WIDTH },
    hintPhrase: "no arquivo de mapas e curiosidades",
  },
];

/**
 * Eighteen objects, six of each tier, two of each tier in every station:
 * A in plain sight, B partly covered or beside one look-alike, C tucked into
 * its surroundings among up to two — always with its identifying part in
 * view. None of them is one of the Estúdio's: the rooms are different places.
 * Positions are authored, never drawn at random: only which of them a round
 * lists is.
 */
export const HIDDEN_OBJECTS: readonly HiddenObjectDefinition[] = [
  // --- Cúpula -----------------------------------------------------------------------------------------
  {
    id: "coruja",
    label: "Coruja",
    accessibleLabel: "Coruja empoleirada",
    clue: "Ave que enxerga bem no escuro.",
    tier: "A",
    station: "cupula",
    region: { kind: "rect", x: 300, y: 318, w: 100, h: 136 },
    hintRegion: "no alto da escada de madeira",
    hintDirection: "no alto, à esquerda do telescópio",
    hintContext: "empoleirada perto do teto, onde só se chega subindo",
  },
  {
    id: "pipa",
    label: "Pipa",
    accessibleLabel: "Pipa de papel",
    clue: "Voa presa a uma linha quando venta.",
    tier: "A",
    station: "cupula",
    region: { kind: "rect", x: 1036, y: 296, w: 124, h: 220 },
    hintRegion: "pendurada na parede, à direita da abertura da cúpula",
    hintDirection: "no alto da parede, perto da Bancada",
    hintContext: "presa num prego, com a rabiola caindo",
  },
  {
    id: "luneta",
    label: "Luneta",
    accessibleLabel: "Luneta de bolso",
    clue: "Tubo de bolso que se estica para ver longe.",
    tier: "B",
    station: "cupula",
    region: { kind: "rect", x: 370, y: 948, w: 176, h: 50 },
    hintRegion: "na mesinha redonda, ao lado do atlas",
    hintDirection: "mais embaixo, à esquerda, perto da escada",
    hintContext: "deitada numa mesinha, junto de um livro de estrelas",
  },
  {
    id: "pantufas",
    label: "Pantufas",
    accessibleLabel: "Pantufas",
    clue: "Calçado macio para os pés descansarem.",
    tier: "B",
    station: "cupula",
    region: { kind: "rect", x: 1010, y: 1246, w: 132, h: 58 },
    hintRegion: "no chão, ao pé do degrau do telescópio",
    hintDirection: "embaixo, à direita do telescópio",
    hintContext: "no chão, meio cobertas por uma manta que escorregou",
  },
  {
    id: "oculos",
    label: "Óculos",
    accessibleLabel: "Óculos de leitura",
    clue: "Ajudam os olhos a ler de perto.",
    tier: "C",
    station: "cupula",
    region: { kind: "rect", x: 905, y: 1076, w: 96, h: 40 },
    hintRegion: "sobre a caixa de oculares, no tablado",
    hintDirection: "no tablado, ao pé do telescópio",
    hintContext: "em cima de uma caixa de madeira, perto de argolas soltas",
  },
  {
    id: "ratinho",
    label: "Ratinho",
    accessibleLabel: "Ratinho",
    clue: "Bichinho que adora queijo.",
    tier: "C",
    station: "cupula",
    region: { kind: "rect", x: 466, y: 1124, w: 100, h: 54 },
    hintRegion: "saindo de um buraco no rodapé",
    hintDirection: "embaixo, à esquerda do tablado, rente ao chão",
    hintContext: "espiando de um buraquinho na madeira da parede",
  },
  // --- Bancada ----------------------------------------------------------------------------------------
  {
    id: "sistema-solar",
    label: "Sistema solar",
    accessibleLabel: "Sistema solar em miniatura",
    clue: "Planetas que giram em volta do Sol.",
    tier: "A",
    station: "bancada",
    region: { kind: "rect", x: 2050, y: 736, w: 216, h: 214 },
    hintRegion: "na ponta direita da bancada",
    hintDirection: "na bancada, do lado direito",
    hintContext: "sobre a mesa, logo abaixo da prateleira da direita",
  },
  {
    id: "vela",
    label: "Vela",
    accessibleLabel: "Vela no castiçal",
    clue: "Pavio aceso que derrete devagar.",
    tier: "A",
    station: "bancada",
    region: { kind: "rect", x: 1296, y: 790, w: 64, h: 150 },
    hintRegion: "na ponta esquerda da bancada",
    hintDirection: "na bancada, do lado esquerdo",
    hintContext: "num castiçal de latão, ao lado da prancheta",
  },
  {
    id: "compasso",
    label: "Compasso",
    accessibleLabel: "Compasso de desenho",
    clue: "Abre as pernas para desenhar círculos.",
    tier: "B",
    station: "bancada",
    region: { kind: "rect", x: 1560, y: 800, w: 76, h: 112 },
    hintRegion: "sobre a carta de estrelas da prancheta",
    hintDirection: "na prancheta inclinada, no meio",
    hintContext: "em cima de um papel cheio de estrelas",
  },
  {
    id: "bule",
    label: "Bule",
    accessibleLabel: "Bule de chá",
    clue: "Serve o chá quente nas xícaras.",
    tier: "B",
    station: "bancada",
    region: { kind: "rect", x: 1846, y: 866, w: 124, h: 92 },
    hintRegion: "numa bandeja, atrás de uma pilha de livros",
    hintDirection: "no meio da bancada, logo abaixo da luz pendurada",
    hintContext: "numa bandeja, meio escondido por livros",
  },
  {
    id: "sino",
    label: "Sino",
    accessibleLabel: "Sino de mão",
    clue: "Toca para chamar alguém.",
    tier: "C",
    station: "bancada",
    region: { kind: "rect", x: 1390, y: 552, w: 70, h: 84 },
    hintRegion: "na prateleira da esquerda, entre os livros",
    hintDirection: "no alto, à esquerda da janela redonda",
    hintContext: "numa prateleira, entre lombadas de livros",
  },
  {
    id: "maca",
    label: "Maçã",
    accessibleLabel: "Maçã",
    clue: "Fruta crocante que dá em árvore.",
    tier: "C",
    station: "bancada",
    region: { kind: "rect", x: 1752, y: 900, w: 64, h: 62 },
    hintRegion: "na bancada, atrás do tinteiro",
    hintDirection: "no meio da bancada, à direita da prancheta",
    hintContext: "ao lado de um tinteiro, entre papéis",
  },
  // --- Arquivo ----------------------------------------------------------------------------------------
  {
    id: "violino",
    label: "Violino",
    accessibleLabel: "Violino",
    clue: "Instrumento de cordas tocado com um arco.",
    tier: "A",
    station: "arquivo",
    region: { kind: "rect", x: 2964, y: 360, w: 90, h: 260 },
    hintRegion: "pendurado na parede, acima do arquivo de mapas",
    hintDirection: "no alto, no meio do Arquivo",
    hintContext: "pendurado num prego, com o arco ao lado",
  },
  {
    id: "gramofone",
    label: "Gramofone",
    accessibleLabel: "Gramofone",
    clue: "Toca música girando um disco.",
    tier: "A",
    station: "arquivo",
    region: { kind: "rect", x: 2690, y: 610, w: 220, h: 290 },
    hintRegion: "em cima do arquivo de mapas, à esquerda",
    hintDirection: "no Arquivo, do lado esquerdo, em cima do móvel",
    hintContext: "em cima de um móvel de gavetas, perto da parede",
  },
  {
    id: "microscopio",
    label: "Microscópio",
    accessibleLabel: "Microscópio",
    clue: "Mostra o que é pequeno demais para os olhos.",
    tier: "B",
    station: "arquivo",
    region: { kind: "rect", x: 2520, y: 716, w: 110, h: 186 },
    hintRegion: "na mesinha alta, entre caixas de amostras",
    hintDirection: "no Arquivo, do lado esquerdo, perto da Bancada",
    hintContext: "numa mesinha, atrás de caixinhas de amostras",
  },
  {
    id: "gato",
    label: "Gato",
    accessibleLabel: "Gato dormindo",
    clue: "Dorme enrolado e ronrona.",
    tier: "B",
    station: "arquivo",
    region: { kind: "rect", x: 2944, y: 826, w: 150, h: 78 },
    hintRegion: "em cima do arquivo de mapas, à direita",
    hintDirection: "no meio do Arquivo, em cima do móvel de gavetas",
    hintContext: "enrolado em cima de um móvel, entre pastas",
  },
  {
    id: "balanca",
    label: "Balança",
    accessibleLabel: "Balança de pratos",
    clue: "Pesa as coisas em dois pratinhos.",
    tier: "C",
    station: "arquivo",
    region: { kind: "rect", x: 3140, y: 608, w: 104, h: 92 },
    hintRegion: "no armário de vidro, na prateleira do meio",
    hintDirection: "no Arquivo, do lado direito, no meio da altura",
    hintContext: "numa prateleira, entre potes de vidro",
  },
  {
    id: "leque",
    label: "Leque",
    accessibleLabel: "Leque",
    clue: "Abana para refrescar o rosto.",
    tier: "C",
    station: "arquivo",
    region: { kind: "rect", x: 2800, y: 930, w: 120, h: 50 },
    hintRegion: "na gaveta de cima, meio aberta",
    hintDirection: "no Arquivo, na frente do móvel de gavetas",
    hintContext: "dentro de uma gaveta entreaberta",
  },
];

/** The room's look-alikes (the rules are the contract's: hidden-objects-scene.ts). */
export const SCENE_LOOKALIKES: readonly SceneLookAlike[] = [
  {
    id: "rolo-de-mapas",
    label: "Rolo de mapas",
    resembles: "luneta",
    tellApart: "papel enrolado e amarrado, sem anéis de latão nem lente",
    region: { kind: "rect", x: 384, y: 1034, w: 168, h: 34 },
  },
  {
    id: "argolas",
    label: "Argolas de latão",
    resembles: "oculos",
    tellApart: "duas argolas soltas, sem ponte e sem hastes",
    region: { kind: "rect", x: 1040, y: 1086, w: 56, h: 30 },
  },
  {
    id: "escova",
    label: "Escova de sapato",
    resembles: "ratinho",
    tellApart: "cerdas e um cabo de madeira, sem orelhas nem rabo",
    region: { kind: "rect", x: 660, y: 1256, w: 78, h: 32 },
  },
  {
    id: "esfera-armilar",
    label: "Esfera armilar",
    resembles: "sistema-solar",
    tellApart: "só anéis cruzados de latão, sem bolinhas em volta",
    region: { kind: "rect", x: 2150, y: 512, w: 112, h: 118 },
  },
  {
    id: "pinca",
    label: "Pinça",
    resembles: "compasso",
    tellApart: "duas hastes presas na ponta de cima, sem dobradiça nem ponta de grafite",
    region: { kind: "rect", x: 1452, y: 950, w: 84, h: 24 },
  },
  {
    id: "regador",
    label: "Regador",
    resembles: "bule",
    tellApart: "bico comprido para as plantas e alça por cima, sem tampa",
    region: { kind: "rect", x: 2276, y: 568, w: 76, h: 64 },
  },
  {
    id: "funil",
    label: "Funil",
    resembles: "sino",
    tellApart: "aberto embaixo e em cima, sem cabo e sem badalo",
    region: { kind: "rect", x: 1300, y: 572, w: 56, h: 60 },
  },
  {
    id: "novelo",
    label: "Novelo de lã",
    resembles: "maca",
    tellApart: "fios enrolados, sem cabinho e sem folha",
    region: { kind: "rect", x: 1560, y: 1160, w: 64, h: 56 },
  },
  {
    id: "luminaria",
    label: "Luminária de mesa",
    resembles: "microscopio",
    tellApart: "uma cúpula de luz no braço, sem lentes nem tubo",
    region: { kind: "rect", x: 2420, y: 760, w: 60, h: 140 },
  },
  {
    id: "almofada",
    label: "Almofada",
    resembles: "gato",
    tellApart: "tecido com franjas, sem orelhas e sem rabo",
    region: { kind: "rect", x: 2700, y: 1200, w: 120, h: 60 },
  },
  {
    id: "mobile",
    label: "Móbile de estrelas",
    resembles: "balanca",
    tellApart: "estrelas de papel penduradas em fios, sem pratos",
    region: { kind: "rect", x: 3120, y: 236, w: 92, h: 124 },
  },
  {
    id: "concha",
    label: "Concha",
    resembles: "leque",
    tellApart: "uma concha do mar, dura e sem varetas",
    region: { kind: "rect", x: 3170, y: 782, w: 80, h: 54 },
  },
];

/** Versioned folder: a new art kit is a new folder, never an overwrite. */
export const SCENE_ASSET_BASE = "/assets/hidden-objects/explorer-observatory/v1";

export const SCENE_LAYERS: readonly SceneLayer[] = [
  {
    // the dusk sky, seen through the opened dome and the round window
    id: "back",
    src: `${SCENE_ASSET_BASE}/back.webp`,
    rect: { x: 400, y: 0, w: 1840, h: 820 },
    parallax: 0.9,
    opaque: [{ x: 400, y: 0, w: 1840, h: 820 }],
  },
  {
    id: "plate",
    src: `${SCENE_ASSET_BASE}/plate.webp`,
    rect: { x: 0, y: 0, w: SCENE_WIDTH, h: SCENE_HEIGHT },
    parallax: 1,
    opaque: [{ x: 0, y: 0, w: SCENE_WIDTH, h: SCENE_HEIGHT }],
  },
  {
    // the dome's nearest rib across the top, with its hanging brass stars
    id: "front-top",
    src: `${SCENE_ASSET_BASE}/front-top.webp`,
    rect: { x: 0, y: 0, w: SCENE_WIDTH, h: 180 },
    parallax: 1.04,
    opaque: [{ x: 0, y: 0, w: SCENE_WIDTH, h: 150 }],
  },
  {
    // a heavy curtain and the travel trunks at the left edge
    id: "front",
    src: `${SCENE_ASSET_BASE}/front.webp`,
    rect: { x: 0, y: 0, w: 420, h: SCENE_HEIGHT },
    parallax: 1.05,
    opaque: [
      { x: 0, y: 0, w: 180, h: SCENE_HEIGHT },
      { x: 0, y: 1400, w: 380, h: 200 },
    ],
  },
  {
    // a pierced brass lantern and a tall fern at the right edge
    id: "front-right",
    src: `${SCENE_ASSET_BASE}/front-right.webp`,
    rect: { x: 3180, y: 0, w: 420, h: SCENE_HEIGHT },
    parallax: 1.05,
    opaque: [
      { x: 3370, y: 0, w: 140, h: 470 },
      { x: 3380, y: 1060, w: 220, h: 540 },
    ],
  },
];

export const thumbnailSrc = (id: TargetId) => `${SCENE_ASSET_BASE}/thumbs/${id}.webp`;

/** The Observatório as the engine plays it. */
export const EXPLORER_OBSERVATORY: SceneDefinition = {
  id: SCENE_ID,
  name: "Observatório do Explorador",
  copy: {
    tagline: "Estrelas, instrumentos e o céu do anoitecer",
    viewportLabel: "Cena do Observatório do Explorador",
    completeTitle: "Observatório explorado",
    summary: "Você encontrou todos os objetos do Observatório.",
  },
  preview: `${SCENE_ASSET_BASE}/hero.webp`,
  width: SCENE_WIDTH,
  height: SCENE_HEIGHT,
  stations: SCENE_STATIONS,
  initialStation: "bancada",
  pool: HIDDEN_OBJECTS,
  lookAlikes: SCENE_LOOKALIKES,
  layers: SCENE_LAYERS,
  thumbnail: thumbnailSrc,
  backdrop: "#0c0d16",
};
