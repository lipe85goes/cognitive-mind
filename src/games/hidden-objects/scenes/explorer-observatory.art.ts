import type { PlacementArt, SceneAtlas } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Observatório do Explorador — the pictures of the things that move, and their audit (GAME03-REPLAYABILITY-05).
 *
 * Written by tools/assets/create_observatory_scene.mjs: never edit by hand. Each placement
 * ("thing@slot") is a rectangle of the room's sprite atlas painted at (x, y) su; a pool object's
 * `measured` is what the art kit's audit measured for it on that slot (hidden-objects-scene.ts,
 * PlacementMeasure; hidden-objects-layout.ts, measureIn).
 */
export const OBSERVATORY_ATLAS: SceneAtlas = { src: "/assets/hidden-objects/explorer-observatory/v4/atlas.webp", width: 1024, height: 776 };

export const OBSERVATORY_PLACEMENT_ART: Readonly<Record<string, PlacementArt>> = {
  "almofada@chao-almofada": { sprite: { sx: 44, sy: 566, w: 122, h: 56, x: 2699, y: 1205 } },
  "almofada@chao-arquivo-b": { sprite: { sx: 168, sy: 566, w: 122, h: 56, x: 2499, y: 1385 } },
  "argolas@caixa-argolas": { sprite: { sx: 753, sy: 722, w: 53, h: 25, x: 1051, y: 1090 } },
  "argolas@caixa-ocular": { sprite: { sx: 808, sy: 722, w: 53, h: 25, x: 929, y: 1096 } },
  "balanca@vitrine-700": {
    sprite: { sx: 294, sy: 292, w: 106, h: 92, x: 3139, y: 610 },
    measured: { visible: 0.887, edge: 1.62, ring: 97344, busy: 13710, near: { "cavalo-marinho@vitrine-836": 1102, "concha@vitrine-836": 1386, "violino@prego-a": 753 } },
  },
  "balanca@vitrine-836": {
    sprite: { sx: 402, sy: 292, w: 106, h: 92, x: 3157, y: 746 },
    measured: { visible: 1, edge: 2.01, ring: 97344, busy: 14883, near: { "cavalo-marinho@vitrine-980": 1110, "concha@armario-gato": 150, "concha@vitrine-700": 1543, "gato@armario-gato": 643 } },
  },
  "bola-de-borracha@chao-bola": { sprite: { sx: 816, sy: 566, w: 46, h: 51, x: 1702, y: 1193 } },
  "bola-de-borracha@chao-carretel": { sprite: { sx: 864, sy: 566, w: 46, h: 51, x: 1877, y: 1189 } },
  "bule@mesa-bule": {
    sprite: { sx: 826, sy: 292, w: 102, h: 87, x: 1866, y: 873 },
    measured: { visible: 0.848, edge: 1.96, ring: 101504, busy: 14382, near: { "compasso@mesa-maca": 816, "maca@mesa-maca": 245, "xicara-azul@mesa-xicara": 642 } },
  },
  "bule@mesa-esquerda": {
    sprite: { sx: 578, sy: 292, w: 122, h: 87, x: 1388, y: 873 },
    measured: { visible: 1, edge: 1.64, ring: 101504, busy: 14845, near: { "compasso@prancheta": 1678, "maca@mesa-frente": 378, "pinca@mesa-frente": 331, "xicara-azul@mesa-frente": 308 } },
  },
  "bule@mesa-frente": {
    sprite: { sx: 702, sy: 292, w: 122, h: 87, x: 1568, y: 877 },
    measured: { visible: 1, edge: 1.42, ring: 101504, busy: 16624, near: { "compasso@mesa-maca": 816, "compasso@mesa-pinca": 1711, "maca@mesa-maca": 245, "pinca@mesa-pinca": 823 } },
  },
  "cadeado@puxador-a": {
    sprite: { sx: 680, sy: 410, w: 54, h: 73, x: 2858, y: 1054 },
    measured: { visible: 0.967, edge: 1.89, ring: 85280, busy: 19077, near: { "almofada@chao-almofada": 1001, "gato@atras-cesto": 13, "gato@chao-almofada": 1528, "medalhao@puxador-c": 258 } },
  },
  "cadeado@puxador-b": {
    sprite: { sx: 736, sy: 410, w: 54, h: 73, x: 2858, y: 1107 },
    measured: { visible: 0.957, edge: 1.84, ring: 85280, busy: 14234, near: { "almofada@chao-almofada": 1306, "gato@atras-cesto": 13, "lata-de-biscoitos@chao-lata": 283, "medalhao@puxador-c": 258 } },
  },
  "cadeado@puxador-c": {
    sprite: { sx: 792, sy: 410, w: 54, h: 73, x: 2985, y: 1004 },
    measured: { visible: 0.975, edge: 1.92, ring: 85280, busy: 20036, near: { "concha@armario-gato": 696, "gato@armario-gato": 884, "medalhao@puxador-a": 247, "medalhao@puxador-b": 462 } },
  },
  "caleidoscopio@mesinha": { sprite: { sx: 393, sy: 722, w: 118, h: 28, x: 399, y: 970 } },
  "caleidoscopio@rodape-a": { sprite: { sx: 513, sy: 722, w: 118, h: 28, x: 641, y: 845 } },
  "caleidoscopio@rodape-cupula": { sprite: { sx: 633, sy: 722, w: 118, h: 28, x: 1071, y: 852 } },
  "caneca@estante-600": {
    sprite: { sx: 930, sy: 292, w: 75, h: 85, x: 482, y: 521 },
    measured: { visible: 1, edge: 1.39, ring: 89440, busy: 16780, near: { "coruja@coroa-a": 498, "coruja@coroa-c": 1435, "ferradura@estante-prego-b": 1020, "pote-de-ceramica@estante-740": 813, "vaso-de-ceramica@coroa-a": 107, "vaso-de-ceramica@coroa-b": 340 } },
  },
  "caneca@estante-740": {
    sprite: { sx: 77, sy: 410, w: 65, h: 85, x: 497, y: 659 },
    measured: { visible: 0.892, edge: 1.67, ring: 89440, busy: 14955, near: { "caleidoscopio@rodape-a": 446, "ferradura@estante-prego": 262, "ferradura@estante-prego-b": 162, "ferradura@sobre-porta": 166, "oculos@estante-600": 1155, "pote-de-ceramica@estante-600": 965, "pote-de-ceramica@estante-880": 747 } },
  },
  "caneca@estante-880": {
    sprite: { sx: 2, sy: 410, w: 73, h: 85, x: 489, y: 799 },
    measured: { visible: 1, edge: 1.41, ring: 89440, busy: 18043, near: { "caleidoscopio@mesinha": 1081, "caleidoscopio@rodape-a": 509, "ferradura@sobre-porta": 166, "luneta@mesinha": 814, "oculos@mesinha": 1267, "pote-de-ceramica@estante-740": 1122 } },
  },
  "carretel@chao-bancada-a": { sprite: { sx: 191, sy: 627, w: 42, h: 45, x: 1419, y: 1201 } },
  "carretel@chao-bola": { sprite: { sx: 235, sy: 627, w: 42, h: 45, x: 1704, y: 1201 } },
  "carretel@chao-carretel": { sprite: { sx: 279, sy: 627, w: 42, h: 45, x: 1879, y: 1197 } },
  "cavalo-marinho@vitrine-836": {
    sprite: { sx: 194, sy: 410, w: 41, h: 78, x: 3189, y: 751 },
    measured: { visible: 1, edge: 1.44, ring: 85280, busy: 12052, near: { "balanca@vitrine-700": 840, "concha@vitrine-700": 1543, "gato@armario-gato": 447 } },
  },
  "cavalo-marinho@vitrine-980": {
    sprite: { sx: 637, sy: 410, w: 41, h: 75, x: 3240, y: 869 },
    measured: { visible: 0.968, edge: 1.41, ring: 85280, busy: 9749, near: { "balanca@vitrine-836": 1861, "concha@vitrine-836": 1733 } },
  },
  "chapeu-de-mago@chao-chapeu": { sprite: { sx: 927, sy: 497, w: 40, h: 59, x: 470, y: 1231 } },
  "chapeu-de-mago@chao-cupula-b": { sprite: { sx: 969, sy: 497, w: 40, h: 59, x: 310, y: 1247 } },
  "chapeu-de-mago@chao-meia": { sprite: { sx: 2, sy: 566, w: 40, h: 59, x: 610, y: 1219 } },
  "compasso@mesa-maca": {
    sprite: { sx: 59, sy: 292, w: 35, h: 116, x: 1760, y: 852 },
    measured: { visible: 0.8, edge: 1.32, ring: 95680, busy: 15573, near: { "bule@mesa-bule": 486, "bule@mesa-frente": 696, "maca@mesa-frente": 376, "pinca@mesa-frente": 574, "xicara-azul@mesa-frente": 427 } },
  },
  "compasso@mesa-pinca": {
    sprite: { sx: 948, sy: 2, w: 55, h: 116, x: 1458, y: 848 },
    measured: { visible: 0.994, edge: 2.54, ring: 95680, busy: 13162, near: { "bule@mesa-frente": 990, "maca@mesa-frente": 479, "pinca@mesa-frente": 555, "xicara-azul@mesa-frente": 588 } },
  },
  "compasso@prancheta": {
    sprite: { sx: 2, sy: 292, w: 55, h: 116, x: 1562, y: 800 },
    measured: { visible: 0.884, edge: 2.68, ring: 95680, busy: 13466, near: { "bule@mesa-esquerda": 1049, "maca@mesa-maca": 79, "pinca@mesa-pinca": 823, "xicara-azul@mesa-frente": 604 } },
  },
  "concha@armario-gato": { sprite: { sx: 552, sy: 566, w: 70, h: 52, x: 2982, y: 851 } },
  "concha@vitrine-700": { sprite: { sx: 400, sy: 566, w: 74, h: 52, x: 3155, y: 647 } },
  "concha@vitrine-836": { sprite: { sx: 476, sy: 566, w: 74, h: 52, x: 3173, y: 783 } },
  "coruja@coroa-a": {
    sprite: { sx: 451, sy: 2, w: 74, h: 135, x: 313, y: 321 },
    measured: { visible: 1, edge: 2.49, ring: 105664, busy: 15301, near: { "caneca@estante-600": 878, "ferradura@estante-prego": 1826, "ferradura@estante-prego-b": 1390, "oculos@estante-600": 309, "pote-de-ceramica@estante-600": 301 } },
  },
  "coruja@coroa-c": {
    sprite: { sx: 527, sy: 2, w: 74, h: 135, x: 495, y: 321 },
    measured: { visible: 0.993, edge: 2.37, ring: 105664, busy: 9761, near: { "caneca@estante-600": 1467, "ferradura@estante-prego": 1826, "ferradura@estante-prego-b": 1000, "oculos@estante-600": 612, "pote-de-ceramica@estante-600": 535, "vaso-de-ceramica@coroa-a": 106 } },
  },
  "escova@chao-chapeu": { sprite: { sx: 165, sy: 722, w: 74, h: 29, x: 454, y: 1253 } },
  "escova@chao-escova": { sprite: { sx: 241, sy: 722, w: 74, h: 29, x: 703, y: 1257 } },
  "escova@chao-meia": { sprite: { sx: 317, sy: 722, w: 74, h: 29, x: 594, y: 1241 } },
  "esfera-armilar@prateleira-dir-a": { baked: true },
  "esquadro@carta-dir": {
    sprite: { sx: 196, sy: 292, w: 96, h: 98, x: 2217, y: 355 },
    measured: { visible: 0.491, edge: 1.75, ring: 91520, busy: 8490, near: { "regador@prateleira-dir-b": 496 } },
  },
  "esquadro@carta-esq": {
    sprite: { sx: 96, sy: 292, w: 98, h: 99, x: 1322, y: 315 },
    measured: { visible: 0.992, edge: 1.67, ring: 91520, busy: 9999, near: {  } },
  },
  "fechadura@fechadura": { baked: true },
  "ferradura@estante-prego": {
    sprite: { sx: 445, sy: 410, w: 62, h: 77, x: 450, y: 480 },
    measured: { visible: 0.999, edge: 2.96, ring: 87360, busy: 16796, near: { "caneca@estante-740": 583, "coruja@coroa-a": 2730, "coruja@coroa-c": 3069, "vaso-de-ceramica@coroa-a": 564, "vaso-de-ceramica@coroa-b": 454 } },
  },
  "ferradura@estante-prego-b": {
    sprite: { sx: 509, sy: 410, w: 62, h: 77, x: 349, y: 480 },
    measured: { visible: 0.994, edge: 2.04, ring: 87360, busy: 20038, near: { "caneca@estante-600": 1363, "caneca@estante-740": 308, "coruja@coroa-a": 3114, "coruja@coroa-c": 1636, "oculos@estante-600": 806, "pote-de-ceramica@estante-600": 838 } },
  },
  "ferradura@sobre-porta": {
    sprite: { sx: 573, sy: 410, w: 62, h: 77, x: 681, y: 836 },
    measured: { visible: 0.999, edge: 2.33, ring: 87360, busy: 9148, near: { "caneca@estante-740": -4, "caneca@estante-880": 246, "pote-de-ceramica@estante-740": 3 } },
  },
  "flamula@flamula": { baked: true },
  "foguete@cubby-a": {
    sprite: { sx: 816, sy: 2, w: 64, h: 125, x: 685, y: 947 },
    measured: { visible: 0.764, edge: 1.78, ring: 102336, busy: 16447, near: { "caleidoscopio@rodape-a": 1296, "caneca@estante-880": 253, "ferradura@sobre-porta": 1820, "pote-de-ceramica@estante-880": 3, "ratinho@toca": 1011, "rolo-de-mapas@mesinha-baixo": 84 } },
  },
  "foguete@cubby-b": {
    sprite: { sx: 882, sy: 2, w: 64, h: 125, x: 697, y: 947 },
    measured: { visible: 0.82, edge: 1.88, ring: 102336, busy: 16340, near: { "caleidoscopio@rodape-a": 1296, "caneca@estante-880": 49, "ferradura@sobre-porta": 1820, "ratinho@toca": 857 } },
  },
  "funil@prateleira-esq-a": { sprite: { sx: 697, sy: 679, w: 52, h: 32, x: 1302, y: 601 } },
  "funil@prateleira-esq-b": { sprite: { sx: 751, sy: 679, w: 40, h: 32, x: 1399, y: 605 } },
  "gato@armario-gato": {
    sprite: { sx: 366, sy: 497, w: 137, h: 65, x: 2953, y: 841 },
    measured: { visible: 0.819, edge: 3.69, ring: 104000, busy: 19279, near: { "balanca@vitrine-836": 1282, "cadeado@puxador-c": 181, "cavalo-marinho@vitrine-836": 511, "concha@vitrine-836": 968, "medalhao@puxador-c": 141 } },
  },
  "gato@atras-cesto": {
    sprite: { sx: 810, sy: 497, w: 66, h: 60, x: 2670, y: 1204 },
    measured: { visible: 0.43, edge: 3.37, ring: 104000, busy: 17621, near: { "cadeado@puxador-a": 97, "cadeado@puxador-b": 106 } },
  },
  "gato@banquinho": {
    sprite: { sx: 78, sy: 497, w: 142, h: 65, x: 3114, y: 1261 },
    measured: { visible: 0.994, edge: 3.22, ring: 104000, busy: 11387, near: {  } },
  },
  "gato@chao-almofada": {
    sprite: { sx: 222, sy: 497, w: 142, h: 65, x: 2689, y: 1197 },
    measured: { visible: 0.998, edge: 3.1, ring: 104000, busy: 15466, near: { "cadeado@puxador-a": 136, "lata-de-biscoitos@chao-arquivo-c": 103, "lata-de-biscoitos@chao-lata": 974, "medalhao@puxador-a": 218, "medalhao@puxador-b": 462, "peca-de-xadrez@chao-arquivo-c": 38 } },
  },
  "gramofone@armario-gramofone": {
    baked: true,
    measured: { visible: 0.931, edge: 1.92, ring: 162656, busy: 22198, near: { "cadeado@puxador-c": 121, "concha@armario-gato": 840, "gato@armario-gato": 1245, "medalhao@puxador-c": 82, "violino@prego-a": 2640, "violino@prego-b": 1782 } },
  },
  "ioio@gaveta-a": {
    sprite: { sx: 878, sy: 497, w: 47, h: 60, x: 2098, y: 1069 },
    measured: { visible: 0.767, edge: 3.92, ring: 86944, busy: 14896, near: { "xicara-azul@mesa-xicara": 153 } },
  },
  "ioio@gaveta-b": {
    sprite: { sx: 731, sy: 497, w: 77, h: 60, x: 2064, y: 1069 },
    measured: { visible: 0.999, edge: 3.89, ring: 86944, busy: 14739, near: { "bule@mesa-bule": 8, "regador@chao-carretel": 16, "xicara-azul@mesa-xicara": 153 } },
  },
  "lata-de-biscoitos@chao-arquivo-b": { sprite: { sx: 624, sy: 566, w: 62, h: 52, x: 2529, y: 1393 } },
  "lata-de-biscoitos@chao-arquivo-c": { sprite: { sx: 688, sy: 566, w: 62, h: 52, x: 2929, y: 1373 } },
  "lata-de-biscoitos@chao-lata": { sprite: { sx: 752, sy: 566, w: 62, h: 52, x: 2860, y: 1293 } },
  "leque@gaveta-leque": {
    baked: true,
    measured: { visible: 0.867, edge: 1.49, ring: 93184, busy: 25481, near: { "cadeado@puxador-a": 126, "cadeado@puxador-c": 276, "concha@armario-gato": 1007, "gato@armario-gato": 1388, "medalhao@puxador-a": 168, "medalhao@puxador-c": 258 } },
  },
  "luminaria@luminaria": { baked: true },
  "luneta@mesinha": {
    sprite: { sx: 844, sy: 627, w: 176, h: 42, x: 371, y: 952 },
    measured: { visible: 0.77, edge: 1.92, ring: 104832, busy: 24141, near: { "caleidoscopio@rodape-a": 341, "caneca@estante-880": 1357, "pote-de-ceramica@estante-880": 1096, "rolo-de-mapas@mesinha-baixo": 1329 } },
  },
  "luneta@rodape-cupula": {
    sprite: { sx: 656, sy: 627, w: 186, h: 42, x: 1033, y: 834 },
    measured: { visible: 0.991, edge: 1.41, ring: 104832, busy: 11274, near: {  } },
  },
  "luvas@chao-luvas": { sprite: { sx: 2, sy: 679, w: 69, h: 41, x: 880, y: 1332 } },
  "luvas@cobertor": { sprite: { sx: 73, sy: 679, w: 69, h: 41, x: 1041, y: 1266 } },
  "maca@chao-bancada-a": {
    sprite: { sx: 237, sy: 410, w: 68, h: 77, x: 1406, y: 1165 },
    measured: { visible: 1, edge: 2.79, ring: 89440, busy: 8017, near: { "novelo@caixote": 380 } },
  },
  "maca@mesa-frente": {
    sprite: { sx: 307, sy: 410, w: 68, h: 77, x: 1596, y: 887 },
    measured: { visible: 0.999, edge: 1.52, ring: 89440, busy: 15240, near: { "bule@mesa-esquerda": 729, "compasso@mesa-maca": 748, "compasso@mesa-pinca": 1544, "pinca@mesa-pinca": 733 } },
  },
  "maca@mesa-maca": {
    sprite: { sx: 377, sy: 410, w: 66, h: 77, x: 1744, y: 889 },
    measured: { visible: 0.695, edge: 1.48, ring: 89440, busy: 15625, near: { "bule@mesa-bule": 503, "bule@mesa-frente": 701, "compasso@prancheta": 15, "pinca@mesa-frente": 593, "xicara-azul@mesa-frente": 452 } },
  },
  "medalhao@puxador-a": { sprite: { sx: 292, sy: 566, w: 34, h: 54, x: 2868, y: 1052 } },
  "medalhao@puxador-b": { sprite: { sx: 328, sy: 566, w: 34, h: 54, x: 2868, y: 1105 } },
  "medalhao@puxador-c": { sprite: { sx: 364, sy: 566, w: 34, h: 54, x: 2995, y: 1002 } },
  "meia@chao-cupula-b": { sprite: { sx: 517, sy: 679, w: 58, h: 33, x: 301, y: 1270 } },
  "meia@chao-escova": { sprite: { sx: 577, sy: 679, w: 58, h: 33, x: 710, y: 1258 } },
  "meia@chao-meia": { sprite: { sx: 637, sy: 679, w: 58, h: 33, x: 601, y: 1242 } },
  "microscopio@mesa-micro": {
    baked: true,
    measured: { visible: 0.788, edge: 1.44, ring: 118144, busy: 17227, near: {  } },
  },
  "mobile@mobile": { baked: true },
  "novelo@caixote": { sprite: { sx: 912, sy: 566, w: 58, h: 50, x: 1567, y: 1165 } },
  "novelo@chao-bancada-a": { sprite: { sx: 2, sy: 627, w: 58, h: 50, x: 1415, y: 1189 } },
  "novelo@chao-bola": { sprite: { sx: 62, sy: 627, w: 58, h: 50, x: 1700, y: 1189 } },
  "oculos@caixa-ocular": {
    sprite: { sx: 323, sy: 627, w: 114, h: 44, x: 899, y: 1074 },
    measured: { visible: 0.853, edge: 1.86, ring: 92352, busy: 10530, near: { "argolas@caixa-argolas": 606 } },
  },
  "oculos@estante-600": {
    sprite: { sx: 555, sy: 627, w: 99, h: 44, x: 463, y: 552 },
    measured: { visible: 0.932, edge: 1.83, ring: 92352, busy: 17520, near: { "caneca@estante-740": 1373, "coruja@coroa-a": 555, "coruja@coroa-c": 727, "ferradura@estante-prego-b": 1390, "pote-de-ceramica@estante-740": 813, "vaso-de-ceramica@coroa-a": 146, "vaso-de-ceramica@coroa-b": 179 } },
  },
  "oculos@mesinha": {
    sprite: { sx: 439, sy: 627, w: 114, h: 44, x: 401, y: 950 },
    measured: { visible: 1, edge: 1.72, ring: 92352, busy: 20312, near: { "caneca@estante-880": 1357, "pote-de-ceramica@estante-880": 1096, "rolo-de-mapas@mesinha-baixo": 1329 } },
  },
  "pantufas@chao-cupula-a": {
    sprite: { sx: 144, sy: 679, w: 132, h: 40, x: 694, y: 1382 },
    measured: { visible: 0.973, edge: 2.7, ring: 96096, busy: 9183, near: { "chapeu-de-mago@chao-meia": 525, "escova@chao-escova": 908, "escova@chao-meia": 717, "luvas@chao-luvas": 913, "meia@chao-escova": 736, "meia@chao-meia": 508, "ratinho@bau-cupula": 892 } },
  },
  "pantufas@cobertor": {
    sprite: { sx: 278, sy: 679, w: 132, h: 40, x: 1010, y: 1266 },
    measured: { visible: 0.887, edge: 2.51, ring: 96096, busy: 12202, near: { "luvas@chao-luvas": 792 } },
  },
  "peca-de-xadrez@banquinho-peca": { sprite: { sx: 505, sy: 497, w: 36, h: 65, x: 3152, y: 1262 } },
  "peca-de-xadrez@chao-arquivo-c": { sprite: { sx: 543, sy: 497, w: 36, h: 65, x: 2942, y: 1360 } },
  "pinca@chao-bancada-a": { sprite: { sx: 2, sy: 754, w: 81, h: 20, x: 1400, y: 1219 } },
  "pinca@mesa-frente": { sprite: { sx: 85, sy: 754, w: 81, h: 20, x: 1590, y: 941 } },
  "pinca@mesa-pinca": { sprite: { sx: 168, sy: 754, w: 81, h: 20, x: 1454, y: 939 } },
  "pipa@parede-pipa": {
    sprite: { sx: 2, sy: 2, w: 116, h: 288, x: 1040, y: 295 },
    measured: { visible: 1, edge: 4.14, ring: 128128, busy: 8043, near: {  } },
  },
  "pipa@parede-pipa-b": {
    sprite: { sx: 120, sy: 2, w: 116, h: 288, x: 1082, y: 589 },
    measured: { visible: 1, edge: 4.97, ring: 128128, busy: 9743, near: { "caleidoscopio@rodape-cupula": 858, "funil@prateleira-esq-a": 116, "sino@prateleira-esq-a": 584 } },
  },
  "pote-de-ceramica@estante-600": { sprite: { sx: 581, sy: 497, w: 48, h: 62, x: 499, y: 544 } },
  "pote-de-ceramica@estante-740": { sprite: { sx: 631, sy: 497, w: 48, h: 62, x: 514, y: 682 } },
  "pote-de-ceramica@estante-880": { sprite: { sx: 681, sy: 497, w: 48, h: 62, x: 506, y: 822 } },
  "ratinho@bau-cupula": {
    sprite: { sx: 412, sy: 679, w: 103, h: 39, x: 565, y: 1340 },
    measured: { visible: 0.433, edge: 1.74, ring: 88608, busy: 6808, near: { "chapeu-de-mago@chao-chapeu": 671, "chapeu-de-mago@chao-meia": 613, "escova@chao-chapeu": 673, "escova@chao-escova": 908, "escova@chao-meia": 767, "meia@chao-escova": 736, "meia@chao-meia": 508, "pantufas@chao-cupula-a": 1607 } },
  },
  "ratinho@toca": {
    sprite: { sx: 122, sy: 627, w: 67, h: 49, x: 549, y: 1128 },
    measured: { visible: 0.778, edge: 1.87, ring: 88608, busy: 10855, near: { "chapeu-de-mago@chao-chapeu": 671, "chapeu-de-mago@chao-meia": 613, "escova@chao-chapeu": 673, "escova@chao-escova": 898, "escova@chao-meia": 767, "meia@chao-escova": 736, "meia@chao-meia": 508, "rolo-de-mapas@mesinha-baixo": 1148 } },
  },
  "regador@chao-bancada-a": { sprite: { sx: 603, sy: 2, w: 69, h: 125, x: 1415, y: 1116 } },
  "regador@chao-carretel": { sprite: { sx: 674, sy: 2, w: 69, h: 125, x: 1875, y: 1112 } },
  "regador@prateleira-dir-b": { sprite: { sx: 745, sy: 2, w: 69, h: 125, x: 2289, y: 508 } },
  "rolo-de-mapas@chao-cupula-a": { sprite: { sx: 793, sy: 679, w: 161, h: 30, x: 683, y: 1391 } },
  "rolo-de-mapas@mesinha-baixo": { sprite: { sx: 2, sy: 722, w: 161, h: 30, x: 391, y: 1039 } },
  "sino@prateleira-esq-a": {
    sprite: { sx: 510, sy: 292, w: 66, h: 88, x: 1294, y: 546 },
    measured: { visible: 1, edge: 1.79, ring: 88608, busy: 7463, near: { "funil@prateleira-esq-b": 352, "pipa@parede-pipa-b": 461 } },
  },
  "sino@prateleira-esq-b": {
    sprite: { sx: 144, sy: 410, w: 48, h: 81, x: 1391, y: 557 },
    measured: { visible: 0.598, edge: 1.93, ring: 88608, busy: 9569, near: { "funil@prateleira-esq-a": 435 } },
  },
  "sistema-solar@sistema": {
    baked: true,
    measured: { visible: 0.998, edge: 2.92, ring: 146016, busy: 19412, near: { "bule@mesa-bule": 709, "regador@prateleira-dir-b": 247, "xicara-azul@mesa-xicara": 626 } },
  },
  "tambor@cortina-a": {
    sprite: { sx: 932, sy: 410, w: 74, h: 69, x: 2459, y: 1032 },
    measured: { visible: 0.613, edge: 3.09, ring: 91104, busy: 18414, near: {  } },
  },
  "tambor@cortina-b": {
    sprite: { sx: 2, sy: 497, w: 74, h: 67, x: 2447, y: 1032 },
    measured: { visible: 0.547, edge: 3.47, ring: 91104, busy: 16963, near: {  } },
  },
  "transferidor@transferidor": { baked: true },
  "vaso-de-ceramica@coroa-a": { sprite: { sx: 848, sy: 410, w: 40, h: 70, x: 330, y: 388 } },
  "vaso-de-ceramica@coroa-b": { sprite: { sx: 890, sy: 410, w: 40, h: 70, x: 548, y: 386 } },
  "vela@castical": {
    baked: true,
    measured: { visible: 0.999, edge: 2.02, ring: 101088, busy: 11688, near: { "bule@mesa-esquerda": 1580, "caleidoscopio@rodape-cupula": 156, "compasso@mesa-pinca": 347, "luneta@rodape-cupula": 558, "pinca@mesa-pinca": 174, "pipa@parede-pipa-b": 166 } },
  },
  "violino@prego-a": {
    sprite: { sx: 345, sy: 2, w: 104, h: 255, x: 2974, y: 348 },
    measured: { visible: 1, edge: 3.19, ring: 129376, busy: 12029, near: { "balanca@vitrine-700": 130, "concha@vitrine-700": 301 } },
  },
  "violino@prego-b": {
    sprite: { sx: 238, sy: 2, w: 105, h: 256, x: 2625, y: 310 },
    measured: { visible: 1, edge: 2.51, ring: 129376, busy: 12458, near: {  } },
  },
  "xicara-azul@mesa-frente": { sprite: { sx: 863, sy: 722, w: 48, h: 24, x: 1605, y: 939 } },
  "xicara-azul@mesa-xicara": { sprite: { sx: 913, sy: 722, w: 48, h: 24, x: 1987, y: 929 } },
};
