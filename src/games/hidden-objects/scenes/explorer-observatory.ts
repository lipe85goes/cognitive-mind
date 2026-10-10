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
    clues: [
      { level: "direct", text: "Ave que enxerga bem no escuro." },
      { level: "associative", text: "Faz uhu quando a noite chega." },
      { level: "associative", text: "Gira a cabeça quase para trás." },
      { level: "indirect", text: "Símbolo da sabedoria, só acorda à noite." },
      { level: "indirect", text: "De dia dorme; de noite, vigia o celeiro." },
    ],
    tier: "A",
    station: "cupula",
    region: { kind: "rect", x: 300, y: 318, w: 100, h: 136 },
    measured: { visible: 1, edge: 2.48, clutter: 0.146 },
    hintRegion: "no alto da escada de madeira",
    hintDirection: "no alto, à esquerda do telescópio",
    hintContext: "empoleirada perto do teto, onde só se chega subindo",
  },
  {
    id: "pipa",
    label: "Pipa",
    accessibleLabel: "Pipa de papel",
    clues: [
      { level: "direct", text: "Voa presa a uma linha quando venta." },
      { level: "associative", text: "Tem rabiola e sobe com o vento." },
      { level: "associative", text: "Empinada na praia, dança no ar." },
      { level: "indirect", text: "Num dia sem brisa, ela fica no chão." },
      { level: "indirect", text: "Agosto, céu limpo e criança correndo na rua." },
    ],
    tier: "A",
    station: "cupula",
    region: { kind: "rect", x: 1036, y: 296, w: 124, h: 220 },
    measured: { visible: 1, edge: 4.19, clutter: 0.067 },
    hintRegion: "pendurada na parede, à direita da abertura da cúpula",
    hintDirection: "no alto da parede, perto da Bancada",
    hintContext: "presa num prego, com a rabiola caindo",
  },
  {
    id: "luneta",
    label: "Luneta",
    accessibleLabel: "Luneta de bolso",
    clues: [
      { level: "direct", text: "Tubo de bolso que se estica para ver longe." },
      { level: "associative", text: "O pirata a abria no convés." },
      { level: "associative", text: "Tubos que deslizam um dentro do outro." },
      { level: "indirect", text: "Com ela, o vigia gritou: terra à vista!" },
      { level: "indirect", text: "Um olho fechado, o outro bem distante." },
    ],
    tier: "B",
    station: "cupula",
    region: { kind: "rect", x: 370, y: 942, w: 176, h: 56 },
    measured: { visible: 0.77, edge: 1.91, clutter: 0.227 },
    hintRegion: "na mesinha redonda, ao lado do atlas",
    hintDirection: "mais embaixo, à esquerda, perto da escada",
    hintContext: "deitada numa mesinha, junto de um livro de estrelas",
  },
  {
    id: "pantufas",
    label: "Pantufas",
    accessibleLabel: "Pantufas",
    clues: [
      { level: "direct", text: "Calçado macio para os pés descansarem." },
      { level: "associative", text: "Ficam ao pé da cama esperando a noite." },
      { level: "associative", text: "Felpudas, sempre andam em par." },
      { level: "indirect", text: "Chão gelado de manhã? Elas resolvem." },
      { level: "indirect", text: "Saíram do quarto e foram parar no trabalho." },
    ],
    tier: "B",
    station: "cupula",
    region: { kind: "rect", x: 1010, y: 1246, w: 132, h: 58 },
    measured: { visible: 0.887, edge: 2.52, clutter: 0.128 },
    hintRegion: "no chão, ao pé do degrau do telescópio",
    hintDirection: "embaixo, à direita do telescópio",
    hintContext: "no chão, meio cobertas por uma manta que escorregou",
  },
  {
    id: "oculos",
    label: "Óculos",
    accessibleLabel: "Óculos de leitura",
    clues: [
      { level: "direct", text: "Ajudam os olhos a ler de perto." },
      { level: "associative", text: "Ficam na ponta do nariz da vovó." },
      { level: "associative", text: "Duas lentes e hastes que vão nas orelhas." },
      { level: "indirect", text: "Sem eles, as letras do jornal ficam embaçadas." },
      { level: "indirect", text: "Quem os procura às vezes está com eles na testa." },
    ],
    tier: "C",
    station: "cupula",
    region: { kind: "rect", x: 898, y: 1066, w: 116, h: 56 },
    measured: { visible: 0.853, edge: 1.86, clutter: 0.114 },
    hintRegion: "sobre a caixa de oculares, no tablado",
    hintDirection: "no tablado, ao pé do telescópio",
    hintContext: "em cima de uma caixa de madeira, perto de argolas soltas",
  },
  {
    id: "ratinho",
    label: "Ratinho",
    accessibleLabel: "Ratinho",
    clues: [
      { level: "direct", text: "Bichinho que adora queijo." },
      { level: "associative", text: "Rói tudo e foge quando alguém chega." },
      { level: "associative", text: "Tem rabo comprido e bigodes finos." },
      { level: "indirect", text: "Farelos sumindo da despensa? Desconfie dele." },
      { level: "indirect", text: "Um elefante, dizem, morre de medo dele." },
    ],
    tier: "C",
    station: "cupula",
    region: { kind: "rect", x: 556, y: 1124, w: 100, h: 54 },
    measured: { visible: 0.778, edge: 1.87, clutter: 0.125 },
    hintRegion: "saindo de um buraco no rodapé",
    hintDirection: "embaixo, à esquerda do tablado, rente ao chão",
    hintContext: "espiando de um buraquinho na madeira da parede",
  },
  // --- Bancada ----------------------------------------------------------------------------------------
  {
    id: "sistema-solar",
    label: "Sistema solar",
    accessibleLabel: "Sistema solar em miniatura",
    clues: [
      { level: "direct", text: "Planetas que giram em volta do Sol." },
      { level: "associative", text: "Bolinhas em órbita, com a maior no meio." },
      { level: "associative", text: "Mercúrio vem primeiro; Netuno, por último." },
      { level: "indirect", text: "Ali, a Terra é a terceira da fila." },
      { level: "indirect", text: "Nosso bairro no céu, em tamanho de brinquedo." },
    ],
    tier: "A",
    station: "bancada",
    region: { kind: "rect", x: 2050, y: 736, w: 216, h: 214 },
    measured: { visible: 0.998, edge: 2.92, clutter: 0.136 },
    hintRegion: "na ponta direita da bancada",
    hintDirection: "na bancada, do lado direito",
    hintContext: "sobre a mesa, logo abaixo da prateleira da direita",
  },
  {
    id: "vela",
    label: "Vela",
    accessibleLabel: "Vela no castiçal",
    clues: [
      { level: "direct", text: "Pavio aceso que derrete devagar." },
      { level: "associative", text: "Num bolo de aniversário, a gente sopra." },
      { level: "associative", text: "Feita de cera, chora gotas quando acesa." },
      { level: "indirect", text: "Num apagão, alguém sempre vai buscá-la." },
      { level: "indirect", text: "Um sopro e o quarto fica escuro." },
    ],
    tier: "A",
    station: "bancada",
    region: { kind: "rect", x: 1296, y: 790, w: 64, h: 150 },
    measured: { visible: 0.999, edge: 2.02, clutter: 0.117 },
    hintRegion: "na ponta esquerda da bancada",
    hintDirection: "na bancada, do lado esquerdo",
    hintContext: "num castiçal de latão, ao lado da prancheta",
  },
  {
    id: "compasso",
    label: "Compasso",
    accessibleLabel: "Compasso de desenho",
    clues: [
      { level: "direct", text: "Abre as pernas para desenhar círculos." },
      { level: "associative", text: "Uma perna fica parada; a outra dá a volta." },
      { level: "associative", text: "Ponta seca de um lado, grafite do outro." },
      { level: "indirect", text: "Na aula de geometria, faz a roda perfeita." },
      { level: "indirect", text: "Sem ele, a lua do caderno sairia torta." },
    ],
    tier: "B",
    station: "bancada",
    region: { kind: "rect", x: 1560, y: 800, w: 76, h: 112 },
    measured: { visible: 0.884, edge: 2.68, clutter: 0.154 },
    hintRegion: "sobre a carta de estrelas da prancheta",
    hintDirection: "na prancheta inclinada, no meio",
    hintContext: "em cima de um papel cheio de estrelas",
  },
  {
    id: "bule",
    label: "Bule",
    accessibleLabel: "Bule de chá",
    clues: [
      { level: "direct", text: "Serve o chá quente nas xícaras." },
      { level: "associative", text: "Tem bico, tampa e alça." },
      { level: "associative", text: "Pelo bico estreito, sai a infusão." },
      { level: "indirect", text: "Às cinco da tarde, é o centro das atenções." },
      { level: "indirect", text: "Ervas e água fervendo descansam dentro dele." },
    ],
    tier: "B",
    station: "bancada",
    region: { kind: "rect", x: 1846, y: 866, w: 124, h: 92 },
    measured: { visible: 0.848, edge: 1.96, clutter: 0.147 },
    hintRegion: "numa bandeja, atrás de uma pilha de livros",
    hintDirection: "no meio da bancada, logo abaixo da luz pendurada",
    hintContext: "numa bandeja, meio escondido por livros",
  },
  {
    id: "sino",
    label: "Sino",
    accessibleLabel: "Sino de mão",
    clues: [
      { level: "direct", text: "Toca para chamar alguém." },
      { level: "associative", text: "Faz dlim-dlim quando chacoalha." },
      { level: "associative", text: "Tem um badalo escondido na saia." },
      { level: "indirect", text: "Na escola antiga, avisava que o recreio acabou." },
      { level: "indirect", text: "No balcão do hotel, um toque chama o atendente." },
    ],
    tier: "C",
    station: "bancada",
    region: { kind: "rect", x: 1390, y: 552, w: 70, h: 84 },
    measured: { visible: 0.598, edge: 1.93, clutter: 0.098 },
    hintRegion: "na prateleira da esquerda, entre os livros",
    hintDirection: "no alto, à esquerda da janela redonda",
    hintContext: "numa prateleira, entre lombadas de livros",
  },
  {
    id: "maca",
    label: "Maçã",
    accessibleLabel: "Maçã",
    clues: [
      { level: "direct", text: "Fruta crocante que dá em árvore." },
      { level: "associative", text: "Uma por dia, diz o ditado, afasta o médico." },
      { level: "associative", text: "Caiu na cabeça de Newton, conta a história." },
      { level: "indirect", text: "A bruxa ofereceu uma envenenada à princesa." },
      { level: "indirect", text: "Lanche de mão que estala na primeira mordida." },
    ],
    tier: "C",
    station: "bancada",
    region: { kind: "rect", x: 1736, y: 886, w: 80, h: 78 },
    measured: { visible: 0.695, edge: 1.48, clutter: 0.181 },
    hintRegion: "na bancada, atrás do tinteiro",
    hintDirection: "no meio da bancada, à direita da prancheta",
    hintContext: "ao lado de um tinteiro, entre papéis",
  },
  // --- Arquivo ----------------------------------------------------------------------------------------
  {
    id: "violino",
    label: "Violino",
    accessibleLabel: "Violino",
    clues: [
      { level: "direct", text: "Instrumento de quatro cordas tocado com arco." },
      { level: "associative", text: "Fica apoiado no ombro, preso pelo queixo." },
      { level: "associative", text: "Seu irmão maior, o violoncelo, toca sentado." },
      { level: "indirect", text: "Na orquestra, muitos ficam na primeira fila." },
      { level: "indirect", text: "Nas serenatas antigas, ele chorava por amor." },
    ],
    tier: "A",
    station: "arquivo",
    region: { kind: "rect", x: 2964, y: 360, w: 90, h: 260 },
    measured: { visible: 1, edge: 3.31, clutter: 0.093 },
    hintRegion: "pendurado na parede, acima do arquivo de mapas",
    hintDirection: "no alto, no meio do Arquivo",
    hintContext: "pendurado num prego, com o arco ao lado",
  },
  {
    id: "gramofone",
    label: "Gramofone",
    accessibleLabel: "Gramofone",
    clues: [
      { level: "direct", text: "Toca música girando um disco." },
      { level: "associative", text: "Uma corneta grande espalha o som da agulha." },
      { level: "associative", text: "Gira com manivela, sem tomada nem pilha." },
      { level: "indirect", text: "O avô dançava valsa ao som dele." },
      { level: "indirect", text: "Bem antes do celular, a festa dependia dele." },
    ],
    tier: "A",
    station: "arquivo",
    region: { kind: "rect", x: 2690, y: 610, w: 220, h: 290 },
    measured: { visible: 0.931, edge: 1.92, clutter: 0.162 },
    hintRegion: "em cima do arquivo de mapas, à esquerda",
    hintDirection: "no Arquivo, do lado esquerdo, em cima do móvel",
    hintContext: "em cima de um móvel de gavetas, perto da parede",
  },
  {
    id: "microscopio",
    label: "Microscópio",
    accessibleLabel: "Microscópio",
    clues: [
      { level: "direct", text: "Mostra o que é pequeno demais para os olhos." },
      { level: "associative", text: "Lentes empilhadas sobre uma lâmina de vidro." },
      { level: "associative", text: "O cientista encosta o olho e gira o foco." },
      { level: "indirect", text: "Com ele, uma gota d'água vira um zoológico." },
      { level: "indirect", text: "Os micróbios não escapam dele." },
    ],
    tier: "B",
    station: "arquivo",
    region: { kind: "rect", x: 2520, y: 716, w: 110, h: 186 },
    measured: { visible: 0.788, edge: 1.44, clutter: 0.107 },
    hintRegion: "na mesinha alta, entre caixas de amostras",
    hintDirection: "no Arquivo, do lado esquerdo, perto da Bancada",
    hintContext: "numa mesinha, atrás de caixinhas de amostras",
  },
  {
    id: "gato",
    label: "Gato",
    accessibleLabel: "Gato dormindo",
    clues: [
      { level: "direct", text: "Dorme enrolado e ronrona." },
      { level: "associative", text: "Mia quando quer carinho." },
      { level: "associative", text: "Tem sete vidas, dizem por aí." },
      { level: "indirect", text: "Uma caixa de papelão vazia é o castelo dele." },
      { level: "indirect", text: "Passa o dia cochilando no lugar mais quente." },
    ],
    tier: "B",
    station: "arquivo",
    region: { kind: "rect", x: 2944, y: 826, w: 150, h: 78 },
    measured: { visible: 0.819, edge: 3.7, clutter: 0.193 },
    hintRegion: "em cima do arquivo de mapas, à direita",
    hintDirection: "no meio do Arquivo, em cima do móvel de gavetas",
    hintContext: "enrolado em cima de um móvel, entre pastas",
  },
  {
    id: "balanca",
    label: "Balança",
    accessibleLabel: "Balança de pratos",
    clues: [
      { level: "direct", text: "Pesa as coisas em dois pratinhos." },
      { level: "associative", text: "Quando os dois lados se igualam, fica parada." },
      { level: "associative", text: "A justiça segura uma, de olhos vendados." },
      { level: "indirect", text: "Na feira antiga, decidia o preço do feijão." },
      { level: "indirect", text: "Algodão contra pedras? Ela tomba para um lado." },
    ],
    tier: "C",
    station: "arquivo",
    region: { kind: "rect", x: 3140, y: 608, w: 104, h: 92 },
    measured: { visible: 0.884, edge: 1.62, clutter: 0.167 },
    hintRegion: "no armário de vidro, na prateleira do meio",
    hintDirection: "no Arquivo, do lado direito, no meio da altura",
    hintContext: "numa prateleira, entre potes de vidro",
  },
  {
    id: "leque",
    label: "Leque",
    accessibleLabel: "Leque",
    clues: [
      { level: "direct", text: "Abana para refrescar o rosto." },
      { level: "associative", text: "Abre e fecha como uma cauda de pavão." },
      { level: "associative", text: "Varetas e papel dobrado em sanfona." },
      { level: "indirect", text: "Num dia de calor sem ventilador, salva a tarde." },
      { level: "indirect", text: "Atrás dele, uma dama escondia o sorriso." },
    ],
    tier: "C",
    station: "arquivo",
    region: { kind: "rect", x: 2800, y: 926, w: 120, h: 56 },
    measured: { visible: 0.867, edge: 1.49, clutter: 0.285 },
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
    region: { kind: "rect", x: 1050, y: 1086, w: 56, h: 30 },
  },
  {
    id: "escova",
    label: "Escova de sapato",
    resembles: "ratinho",
    tellApart: "cerdas e um cabo de madeira, sem orelhas nem rabo",
    region: { kind: "rect", x: 700, y: 1256, w: 78, h: 32 },
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
    region: { kind: "rect", x: 1452, y: 936, w: 84, h: 24 },
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
