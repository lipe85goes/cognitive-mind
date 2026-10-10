import type { HiddenObjectDefinition, SceneDefinition, SceneLayer, SceneLookAlike, SceneStation, TargetId } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Estúdio do Explorador — Game 03's first room (GAME03-SKELETON-01, GAME03-EXPERIENCE-02),
 * as data. Moved here unchanged by GAME03-MULTISCENE-03: the same 3200×1600 su
 * room, the same pool of eighteen, the same look-alikes and the same art kit v1.
 * tools/assets/create_hidden_objects_scene.mjs paints every target exactly where
 * its `region` says, and reads this module to do it.
 */

/** Which room a session explored (the result records it; results saved before it existed are all this room). */
export const SCENE_ID = "explorer-studio";

export const SCENE_WIDTH = 3200;
export const SCENE_HEIGHT = 1600;

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

/**
 * The pool: every object a round may ask for, each painted exactly once and
 * always in the room — a round lists a handful (DIFFICULTY_PRESETS), the rest
 * stay scenery and distractors, never marked as candidates.
 * GAME03-EXPERIENCE-02 moved the lanterna to B (dimmer, behind books, beside a
 * look-alike) and the câmera to C (darker, half behind a leaning book), then
 * grew the pool from the skeleton's ten to eighteen: six things the room
 * already showed (xícara, pena, borboleta, chapéu, bolsa, globo — the same
 * paint, now with a region) and two new ones by the window (guarda-chuva,
 * gaiola), so every station holds every tier. Positions are authored, never
 * drawn at random: only which of them a round lists is.
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
    id: "guarda-chuva",
    label: "Guarda-chuva",
    accessibleLabel: "Guarda-chuva",
    clue: "Abre-se para proteger da água do céu.",
    tier: "A",
    station: "janela",
    region: { kind: "rect", x: 986, y: 930, w: 64, h: 258 },
    hintRegion: "encostado na parede, entre a janela e a mesa",
    hintDirection: "mais embaixo, à direita da janela",
    hintContext: "encostado num canto, perto da mesa redonda",
  },
  {
    id: "gaiola",
    label: "Gaiola",
    accessibleLabel: "Gaiola de passarinho",
    clue: "Casinha com grades para um passarinho.",
    tier: "C",
    station: "janela",
    region: { kind: "rect", x: 960, y: 446, w: 76, h: 142 },
    hintRegion: "pendurada na parede, à direita da janela",
    hintDirection: "no alto, entre a janela e os quadros",
    hintContext: "presa num gancho, perto de uma planta pendurada",
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
    id: "xicara",
    label: "Xícara",
    accessibleLabel: "Xícara de chá",
    clue: "Leva o chá quentinho até a boca.",
    tier: "C",
    station: "mesa",
    region: { kind: "rect", x: 1380, y: 950, w: 100, h: 60 },
    hintRegion: "atrás do livro aberto",
    hintDirection: "no fundo da mesa, à esquerda do mapa",
    hintContext: "soltando vapor, perto de páginas abertas",
  },
  {
    id: "pena",
    label: "Pena",
    accessibleLabel: "Pena de escrever",
    clue: "Escrevia molhando a ponta na tinta.",
    tier: "B",
    station: "mesa",
    region: { kind: "rect", x: 1994, y: 896, w: 82, h: 170 },
    hintRegion: "na ponta direita da mesa",
    hintDirection: "na beirada direita da mesa, junto da parede",
    hintContext: "de pé num frasco escuro, na beira da mesa",
  },
  {
    id: "borboleta",
    label: "Borboleta",
    accessibleLabel: "Borboleta emoldurada",
    clue: "Tem asas coloridas, mas não voa mais.",
    tier: "A",
    station: "mesa",
    region: { kind: "rect", x: 1932, y: 318, w: 104, h: 124 },
    hintRegion: "no quadrinho mais alto da parede",
    hintDirection: "no alto da parede, à direita dos quadros grandes",
    hintContext: "atrás de um vidro, entre molduras douradas",
    listedAs: ["picture", "clue"],
  },
  {
    id: "chapeu",
    label: "Chapéu",
    accessibleLabel: "Chapéu de explorador",
    clue: "Vai na cabeça de quem viaja.",
    tier: "B",
    station: "mesa",
    region: { kind: "rect", x: 2066, y: 428, w: 124, h: 66 },
    hintRegion: "no cabideiro da parede",
    hintDirection: "na parede, logo antes da estante",
    hintContext: "pendurado num gancho de madeira, perto da estante",
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
  {
    id: "globo",
    label: "Globo",
    accessibleLabel: "Globo terrestre",
    clue: "Mostra o mundo inteiro numa bola.",
    tier: "A",
    station: "estante",
    region: { kind: "circle", cx: 2200, cy: 990, r: 96 },
    hintRegion: "entre a mesa e a estante",
    hintDirection: "embaixo, na beirada esquerda da estante",
    hintContext: "num pé alto, ao lado da mesa redonda",
  },
  {
    id: "bolsa",
    label: "Bolsa de couro",
    accessibleLabel: "Bolsa de couro",
    clue: "Leva as coisas pendurada no ombro.",
    tier: "B",
    station: "estante",
    region: { kind: "rect", x: 2168, y: 594, w: 96, h: 120 },
    hintRegion: "pendurada junto à estante",
    hintDirection: "à esquerda da estante, no alto",
    hintContext: "presa por uma alça comprida, num gancho",
  },
];

/** The room's look-alikes (the rules are the contract's: hidden-objects-scene.ts). */
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

/** Versioned folder: a new art kit is a new folder, never an overwrite (v0 was the skeleton's). */
export const SCENE_ASSET_BASE = "/assets/hidden-objects/explorer-studio/v1";

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

/** The Estúdio as the engine plays it. */
export const EXPLORER_STUDIO: SceneDefinition = {
  id: SCENE_ID,
  name: "Estúdio do Explorador",
  copy: {
    tagline: "Uma sala de viagens no fim da tarde",
    viewportLabel: "Cena do Estúdio das Descobertas",
    completeTitle: "Estúdio explorado",
    summary: "Você encontrou todos os objetos do Estúdio.",
  },
  // the intro's art: already on the device when the selector shows it
  preview: `${SCENE_ASSET_BASE}/hero.webp`,
  width: SCENE_WIDTH,
  height: SCENE_HEIGHT,
  stations: SCENE_STATIONS,
  initialStation: "mesa",
  pool: HIDDEN_OBJECTS,
  lookAlikes: SCENE_LOOKALIKES,
  layers: SCENE_LAYERS,
  thumbnail: thumbnailSrc,
  backdrop: "#120c08",
};
