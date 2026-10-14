import type { PlacementArt, SceneAtlas } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Estúdio do Explorador — the pictures of the things that move, and their audit (GAME03-REPLAYABILITY-05).
 *
 * Written by tools/assets/create_hidden_objects_scene.mjs: never edit by hand. Each placement
 * ("thing@slot") is a rectangle of the room's sprite atlas painted at (x, y) su; a pool object's
 * `measured` is what the art kit's audit measured for it on that slot (hidden-objects-scene.ts,
 * PlacementMeasure; hidden-objects-layout.ts, measureIn).
 */
export const STUDIO_ATLAS: SceneAtlas = { src: "/assets/hidden-objects/explorer-studio/v4/atlas.webp", width: 1024, height: 1391 };

export const STUDIO_PLACEMENT_ART: Readonly<Record<string, PlacementArt>> = {
  "abacaxi-de-madeira@prateleira-1": { sprite: { sx: 598, sy: 1122, w: 32, h: 59, x: 1202, y: 644 } },
  "abacaxi-de-madeira@prateleira-2": { sprite: { sx: 632, sy: 1122, w: 32, h: 59, x: 1290, y: 642 } },
  "abacaxi-de-madeira@prateleira-livros": { sprite: { sx: 666, sy: 1122, w: 32, h: 59, x: 1392, y: 600 } },
  "abaco@tapete-mesa-a": { sprite: { sx: 460, sy: 1201, w: 64, h: 51, x: 1418, y: 1350 } },
  "abaco@tapete-mesa-c": { sprite: { sx: 526, sy: 1201, w: 64, h: 51, x: 1252, y: 1356 } },
  "abaco@tapete-mesa-d": { sprite: { sx: 592, sy: 1201, w: 64, h: 51, x: 1868, y: 1364 } },
  "acucareiro@prateleira-1": { sprite: { sx: 831, sy: 1257, w: 48, h: 48, x: 1194, y: 654 } },
  "acucareiro@prateleira-2": { sprite: { sx: 881, sy: 1257, w: 48, h: 48, x: 1282, y: 652 } },
  "acucareiro@prateleira-livros": { sprite: { sx: 931, sy: 1257, w: 48, h: 48, x: 1384, y: 610 } },
  "alca-do-bau@alca": { baked: true },
  "ampulheta@mesinha": {
    sprite: { sx: 834, sy: 2, w: 126, h: 222, x: 737, y: 957 },
    measured: { visible: 0.953, edge: 1.77, ring: 126880, busy: 16918, near: { "binoculo@tapete-d": 436, "caracol@lambri-a": 1468, "caracol@lambri-b": 200, "chave@tapete-d": 66, "garrafinha@peitoril-3": 48, "garrafinha@peitoril-5": 299, "pedrinhas@mesinha-b": 204, "pedrinhas@peitoril-3": 66, "piao@tapete-d": 42, "tigela-de-latao@mesinha-b": 245, "tinteiros@peitoril-2": 685, "vaso-torneado@peitoril-2": 995, "vaso-torneado@peitoril-6": 986 } },
  },
  "ampulheta@peitoril-34": {
    sprite: { sx: 2, sy: 304, w: 126, h: 222, x: 711, y: 783 },
    measured: { visible: 0.896, edge: 1.71, ring: 126880, busy: 16395, near: { "caracol@lambri-a": 1715, "garrafinha@mesinha": 118, "garrafinha@peitoril-5": 568, "tinteiros@peitoril-2": 685, "vaso-torneado@mesinha": 838, "vaso-torneado@peitoril-2": 995, "vaso-torneado@peitoril-6": 986 } },
  },
  "apito@gaveta-a": {
    sprite: { sx: 745, sy: 1257, w: 84, h: 49, x: 753, y: 1219 },
    measured: { visible: 0.742, edge: 1.78, ring: 89440, busy: 14058, near: { "ampulheta@mesinha": 2165, "apontador@tapete-d": 99, "binoculo@tapete-d": 972, "caracol@lambri-a": 479, "caracol@lambri-b": 138, "chave@tapete-d": 403, "garrafinha@mesinha": 553, "peao-de-xadrez@tapete-a": 470, "peao-de-xadrez@tapete-b": 391, "pedrinhas@mesinha-b": 267, "piao@tapete-a": 1103, "piao@tapete-d": 185, "tigela-de-latao@mesinha": 437, "tigela-de-latao@mesinha-b": 322, "tinteiros@mesinha-b": 599, "vaso-torneado@mesinha": 824 } },
  },
  "apito@gaveta-b": {
    sprite: { sx: 652, sy: 1257, w: 91, h: 49, x: 737, y: 1219 },
    measured: { visible: 0.912, edge: 1.78, ring: 89440, busy: 14339, near: { "ampulheta@mesinha": 2165, "binoculo@tapete-d": 846, "caracol@lambri-a": 620, "caracol@lambri-b": 318, "chave@tapete-d": 291, "garrafinha@mesinha": 553, "peao-de-xadrez@tapete-a": 470, "peao-de-xadrez@tapete-b": 391, "pedrinhas@mesinha-b": 267, "piao@tapete-a": 1103, "piao@tapete-d": 34, "tigela-de-latao@mesinha": 437, "tigela-de-latao@mesinha-b": 322, "tinteiros@mesinha-b": 599, "vaso-torneado@mesinha": 824 } },
  },
  "apontador@tapete-b": { sprite: { sx: 621, sy: 1356, w: 57, h: 20, x: 817, y: 1407 } },
  "apontador@tapete-c": { sprite: { sx: 503, sy: 1356, w: 57, h: 21, x: 896, y: 1393 } },
  "apontador@tapete-d": { sprite: { sx: 562, sy: 1356, w: 57, h: 21, x: 961, y: 1323 } },
  "barco@s3-barco": {
    baked: true,
    measured: { visible: 0.948, edge: 2.06, ring: 161616, busy: 27690, near: { "caixa-clara@s3-a": -154, "caixa-escura@s3-a": -105, "caixinha-de-musica@s2-pilha": 669, "camera@s2-camera": 440, "pote-de-frutinhas@s2-a": 389 } },
  },
  "binoculo@peitoril-1": {
    sprite: { sx: 492, sy: 1032, w: 143, h: 81, x: 424, y: 929 },
    measured: { visible: 0.846, edge: 1.32, ring: 104416, busy: 14078, near: { "caracol@lambri-a": 1715, "caracol@lambri-b": 125, "pedrinhas@poltrona-assento": 101, "tinteiros@peitoril-2": 685, "vaso-torneado@peitoril-2": 995 } },
  },
  "binoculo@tapete-d": {
    sprite: { sx: 341, sy: 1032, w: 149, h: 81, x: 914, y: 1261 },
    measured: { visible: 0.978, edge: 1.46, ring: 104416, busy: 12465, near: { "ampulheta@mesinha": -115, "apontador@tapete-b": 608, "apontador@tapete-c": 830, "garrafinha@mesinha": 129, "guarda-chuva@canto": 308, "lata-redonda@chao-mesa-e": 647, "lupa@livro-esq": 209, "medalha@chao-mesa-e": 673, "peao-de-xadrez@tapete-b": 791, "relogio@livro-borda": 184, "tampa-de-pote@chao-mesa": 23, "tesoura@chao-mesa": 7, "tigela-de-latao@mesinha": 268, "vaso-torneado@mesinha": 219 } },
  },
  "bolsa@gancho": {
    baked: true,
    measured: { visible: 0.99, edge: 2.25, ring: 101504, busy: 6614, near: { "borboleta@quadro-baixo": 1094, "caixinha-de-musica@s2-pilha": 628, "chapeu@cabide": 790, "folha-emoldurada@quadro-baixo": 1876 } },
  },
  "borboleta@parede-mesa": {
    sprite: { sx: 150, sy: 528, w: 134, h: 150, x: 1653, y: 607 },
    measured: { visible: 1, edge: 1.41, ring: 104000, busy: 6012, near: {  } },
  },
  "borboleta@quadro-alto": {
    sprite: { sx: 286, sy: 528, w: 134, h: 150, x: 1917, y: 317 },
    measured: { visible: 1, edge: 1.32, ring: 104000, busy: 7054, near: { "chapeu@cabide": 1107 } },
  },
  "borboleta@quadro-baixo": {
    sprite: { sx: 422, sy: 528, w: 134, h: 150, x: 1941, y: 597 },
    measured: { visible: 1, edge: 1.38, ring: 104000, busy: 1924, near: { "chapeu@cabide": 601, "pena@mapa-dir-fundo": 510 } },
  },
  "bussola@mapa-borda": {
    sprite: { sx: 783, sy: 528, w: 116, h: 130, x: 1482, y: 1092 },
    measured: { visible: 0.878, edge: 1.97, ring: 111488, busy: 19397, near: { "compasso-de-pontas@livro-pagina": 675, "compasso-de-pontas@mapa-baixo": 703, "compasso-de-pontas@mesa-frente-a": 385, "lata-redonda@mesa-frente-a": 236, "lupa@livro": 1587, "lupa@livro-esq": 175, "lupa@mapa": 1568, "moedas@livro-pagina": 613, "moedas@mesa-frente-a": 377, "moedas@mesa-frente-b": 403, "relogio@livro-borda": 171, "relogio@tapete-mesa-a": 1284, "relogio@tapete-mesa-b": 990, "tesoura@mapa-fundo": 439, "xicara@atras-livro": 314 } },
  },
  "bussola@tapete-mesa-a": {
    sprite: { sx: 901, sy: 528, w: 116, h: 130, x: 1392, y: 1262 },
    measured: { visible: 0.991, edge: 1.49, ring: 111488, busy: 13266, near: { "abaco@tapete-mesa-c": 1450, "lata-redonda@mesa-frente-b": 391, "lupa@livro": 116, "moedas@mesa-frente-b": 403, "relogio@livro-borda": 1528, "relogio@tapete-mesa-b": 497 } },
  },
  "caixa-clara@s3-a": { sprite: { sx: 210, sy: 822, w: 136, h: 102, x: 2702, y: 734 } },
  "caixa-clara@s4-caixa": { sprite: { sx: 348, sy: 822, w: 136, h: 102, x: 2507, y: 964 } },
  "caixa-de-fosforos@s5-a": { sprite: { sx: 272, sy: 1309, w: 67, h: 39, x: 2340, y: 1087 } },
  "caixa-de-fosforos@s5-caixote": { sprite: { sx: 341, sy: 1309, w: 67, h: 39, x: 2469, y: 1107 } },
  "caixa-escura@s3-a": { sprite: { sx: 267, sy: 937, w: 136, h: 89, x: 2701, y: 747 } },
  "caixa-escura@s3-caixa": { sprite: { sx: 405, sy: 937, w: 136, h: 89, x: 2917, y: 747 } },
  "caixinha-de-musica@s2-pilha": { sprite: { sx: 325, sy: 1257, w: 107, h: 49, x: 2303, y: 479 } },
  "caixinha-de-musica@s4-a": { sprite: { sx: 434, sy: 1257, w: 107, h: 49, x: 2368, y: 1017 } },
  "caixinha-de-musica@s5-a": { sprite: { sx: 543, sy: 1257, w: 107, h: 49, x: 2325, y: 1077 } },
  "camera@s1-a": {
    sprite: { sx: 373, sy: 696, w: 184, h: 114, x: 2308, y: 265 },
    measured: { visible: 0.97, edge: 1.33, ring: 115648, busy: 12368, near: { "caixinha-de-musica@s2-pilha": 248, "rolo-de-papel@s1-rolo": 1442 } },
  },
  "camera@s2-camera": {
    sprite: { sx: 559, sy: 696, w: 184, h: 114, x: 2711, y: 493 },
    measured: { visible: 0.837, edge: 2.99, ring: 115648, busy: 19418, near: { "chaleira@s1-b": -10, "estatueta@s1-estatueta": 237, "pote-de-frutinhas@s2-pote": 1133, "rolo-de-papel@s1-b": 89, "vaso-de-porcelana@s1-b": 84, "vaso-de-porcelana@s1-vaso": 116 } },
  },
  "camera@s4-a": {
    sprite: { sx: 745, sy: 696, w: 184, h: 114, x: 2328, y: 955 },
    measured: { visible: 0.806, edge: 1.45, ring: 115648, busy: 15566, near: { "caixa-clara@s4-caixa": 1023, "caixa-de-fosforos@s5-caixote": 968, "estojo-de-oculos@s5-caixote": 387, "gaita@s5-livros": 196 } },
  },
  "cantil@cesto-a": {
    sprite: { sx: 543, sy: 937, w: 96, h: 89, x: 2326, y: 1337 },
    measured: { visible: 0.846, edge: 2.48, ring: 91520, busy: 7485, near: {  } },
  },
  "cantil@cesto-b": {
    sprite: { sx: 641, sy: 937, w: 96, h: 89, x: 2338, y: 1337 },
    measured: { visible: 0.873, edge: 3.06, ring: 91520, busy: 7731, near: {  } },
  },
  "caracol@lambri-a": {
    sprite: { sx: 793, sy: 1122, w: 86, h: 54, x: 601, y: 1055 },
    measured: { visible: 0.793, edge: 2.02, ring: 87360, busy: 11321, near: { "ampulheta@mesinha": 3848, "ampulheta@peitoril-34": 1664, "binoculo@peitoril-1": 1658, "chave@peitoril-1": 780, "garrafinha@mesinha": 337, "garrafinha@peitoril-3": 542, "pedrinhas@mesinha-b": 267, "pedrinhas@peitoril-3": 355, "tigela-de-latao@mesinha": 292, "tigela-de-latao@mesinha-b": 322, "tigela-de-latao@peitoril-4": 185, "tigela-de-latao@poltrona": 258, "tinteiros@peitoril-1": 323, "tinteiros@peitoril-2": 685, "vaso-torneado@mesinha": 1155, "vaso-torneado@peitoril-2": 507 } },
  },
  "caracol@lambri-b": {
    sprite: { sx: 881, sy: 1122, w: 86, h: 54, x: 549, y: 1123 },
    measured: { visible: 0.897, edge: 1.92, ring: 87360, busy: 14249, near: { "ampulheta@mesinha": 708, "ampulheta@peitoril-34": 9, "binoculo@peitoril-1": 155, "chave@bau": 1266, "chave@peitoril-1": 6, "garrafinha@peitoril-3": 24, "pedrinhas@mesinha-b": 267, "pedrinhas@peitoril-3": 54, "tigela-de-latao@mesinha-b": 322, "tigela-de-latao@poltrona": 450, "tinteiros@mesinha-b": 599, "tinteiros@peitoril-1": 213, "tinteiros@peitoril-2": 111, "vaso-torneado@peitoril-2": 56 } },
  },
  "caracol@parede-direita": {
    sprite: { sx: 2, sy: 1201, w: 86, h: 54, x: 964, y: 763 },
    measured: { visible: 0.984, edge: 1.42, ring: 87360, busy: 6871, near: { "chapeu@pilha-livros": 33, "garrafinha@peitoril-5": 64, "guarda-chuva@canto": 55, "vaso-torneado@peitoril-6": 664 } },
  },
  "carimbo@mapa-dir-fundo": { sprite: { sx: 203, sy: 1032, w: 44, h: 84, x: 1878, y: 909 } },
  "carimbo@mapa-direita": { sprite: { sx: 249, sy: 1032, w: 44, h: 84, x: 1901, y: 1007 } },
  "carimbo@tapete-mesa-d": { sprite: { sx: 295, sy: 1032, w: 44, h: 84, x: 1878, y: 1329 } },
  "cesta-de-arame@suporte": { sprite: { sx: 298, sy: 1122, w: 44, h: 71, x: 976, y: 446 } },
  "cesta-de-arame@varao-a": { sprite: { sx: 281, sy: 696, w: 44, h: 117, x: 904, y: 174 } },
  "cesta-de-arame@varao-b": { sprite: { sx: 327, sy: 696, w: 44, h: 117, x: 478, y: 174 } },
  "chaleira@s1-b": { sprite: { sx: 344, sy: 1122, w: 71, h: 68, x: 2731, y: 306 } },
  "chaleira@s4-chaleira": { sprite: { sx: 417, sy: 1122, w: 71, h: 68, x: 2668, y: 996 } },
  "chapeu@cabide": {
    sprite: { sx: 793, sy: 1032, w: 130, h: 78, x: 2065, y: 429 },
    measured: { visible: 1, edge: 1.91, ring: 96096, busy: 3622, near: { "borboleta@quadro-alto": 4897, "borboleta@quadro-baixo": 1030, "caixinha-de-musica@s2-pilha": 134, "folha-emoldurada@quadro-baixo": 1446 } },
  },
  "chapeu@pilha-livros": {
    sprite: { sx: 166, sy: 1122, w: 130, h: 74, x: 1137, y: 919 },
    measured: { visible: 0.99, edge: 2.78, ring: 96096, busy: 13620, near: { "caracol@parede-direita": 193, "guarda-chuva@canto": 2365, "lupa@livro": 1078 } },
  },
  "chave@bau": {
    sprite: { sx: 658, sy: 1201, w: 128, h: 50, x: 454, y: 1249 },
    measured: { visible: 0.707, edge: 1.67, ring: 95680, busy: 12453, near: { "caracol@lambri-b": 1533, "pedrinhas@mesinha-b": 52, "tigela-de-latao@mesinha-b": 94, "tigela-de-latao@poltrona": 450, "tinteiros@mesinha-b": 241 } },
  },
  "chave@peitoril-1": {
    sprite: { sx: 2, sy: 1257, w: 121, h: 50, x: 436, y: 955 },
    measured: { visible: 0.933, edge: 1.68, ring: 95680, busy: 13491, near: { "caracol@lambri-a": 1715, "caracol@lambri-b": 125, "pedrinhas@poltrona-assento": 40, "tinteiros@peitoril-2": 685, "vaso-torneado@peitoril-2": 995 } },
  },
  "chave@tapete-d": {
    sprite: { sx: 788, sy: 1201, w: 128, h: 50, x: 926, y: 1287 },
    measured: { visible: 0.96, edge: 1.4, ring: 95680, busy: 10717, near: { "ampulheta@mesinha": 3, "apontador@tapete-b": 608, "apontador@tapete-c": 830, "garrafinha@mesinha": 64, "guarda-chuva@canto": 123, "lata-redonda@chao-mesa-e": 647, "lupa@livro-esq": 2, "medalha@chao-mesa-e": 673, "peao-de-xadrez@tapete-b": 791, "relogio@livro-borda": 77, "tesoura@chao-mesa": -2, "tigela-de-latao@mesinha": 140, "vaso-torneado@mesinha": 86 } },
  },
  "colar@caixinha-a": {
    sprite: { sx: 90, sy: 1201, w: 84, h: 54, x: 1908, y: 1129 },
    measured: { visible: 0.786, edge: 3.15, ring: 87776, busy: 9857, near: { "carimbo@mapa-direita": 1206, "lupa@mapa": 2784, "pena@frasco": 542, "pena@mapa-direita": 1040, "xicara@mapa-direita": 1473 } },
  },
  "colar@caixinha-b": {
    sprite: { sx: 176, sy: 1201, w: 84, h: 54, x: 1912, y: 1129 },
    measured: { visible: 0.691, edge: 3.15, ring: 87776, busy: 9945, near: { "carimbo@mapa-direita": 1206, "lupa@mapa": 2718, "pena@frasco": 542, "pena@mapa-direita": 1040, "xicara@mapa-direita": 1473 } },
  },
  "compasso-de-pontas@livro-pagina": { sprite: { sx: 58, sy: 1356, w: 43, h: 32, x: 1398, y: 1058 } },
  "compasso-de-pontas@mapa-baixo": { sprite: { sx: 103, sy: 1356, w: 43, h: 32, x: 1642, y: 1148 } },
  "compasso-de-pontas@mesa-frente-a": { sprite: { sx: 148, sy: 1356, w: 43, h: 32, x: 1638, y: 1191 } },
  "estatueta@s1-a": {
    sprite: { sx: 2, sy: 696, w: 94, h: 124, x: 2353, y: 253 },
    measured: { visible: 0.989, edge: 2.46, ring: 99424, busy: 13483, near: { "caixinha-de-musica@s2-pilha": 248, "rolo-de-papel@s1-rolo": 1110 } },
  },
  "estatueta@s1-estatueta": {
    sprite: { sx: 98, sy: 696, w: 73, h: 124, x: 2631, y: 250 },
    measured: { visible: 0.754, edge: 2.94, ring: 99424, busy: 13564, near: { "rolo-de-papel@s1-b": 796, "rolo-de-papel@s1-rolo": 1442, "vaso-de-porcelana@s1-b": 370 } },
  },
  "estojo-de-oculos@s5-b": { sprite: { sx: 410, sy: 1309, w: 68, h: 37, x: 2846, y: 1099 } },
  "estojo-de-oculos@s5-caixote": { sprite: { sx: 480, sy: 1309, w: 68, h: 37, x: 2472, y: 1109 } },
  "estojo-de-oculos@s5-rolos": { sprite: { sx: 550, sy: 1309, w: 68, h: 37, x: 2821, y: 1099 } },
  "fivela@fivela": { baked: true },
  "folha-emoldurada@parede-mesa": { sprite: { sx: 628, sy: 304, w: 146, h: 166, x: 1647, y: 599 } },
  "folha-emoldurada@quadro-alto": { sprite: { sx: 776, sy: 304, w: 146, h: 166, x: 1911, y: 309 } },
  "folha-emoldurada@quadro-baixo": { sprite: { sx: 2, sy: 528, w: 146, h: 166, x: 1935, y: 589 } },
  "gaiola@suporte": {
    sprite: { sx: 558, sy: 528, w: 91, h: 149, x: 963, y: 455 },
    measured: { visible: 0.941, edge: 1.5, ring: 101920, busy: 4866, near: {  } },
  },
  "gaiola@varao-a": {
    sprite: { sx: 484, sy: 304, w: 70, h: 187, x: 891, y: 174 },
    measured: { visible: 1, edge: 1.34, ring: 101920, busy: 9138, near: { "cesta-de-arame@suporte": 306 } },
  },
  "gaiola@varao-b": {
    sprite: { sx: 556, sy: 304, w: 70, h: 187, x: 465, y: 174 },
    measured: { visible: 0.979, edge: 2.19, ring: 101920, busy: 12752, near: {  } },
  },
  "gaita@s5-a": {
    sprite: { sx: 125, sy: 1257, w: 98, h: 50, x: 2329, y: 1071 },
    measured: { visible: 0.971, edge: 1.48, ring: 89024, busy: 15487, near: { "caixa-clara@s4-caixa": 481, "caixa-de-fosforos@s5-caixote": 968, "estojo-de-oculos@s5-caixote": 387 } },
  },
  "gaita@s5-livros": {
    sprite: { sx: 225, sy: 1257, w: 98, h: 50, x: 2606, y: 1105 },
    measured: { visible: 0.807, edge: 1.65, ring: 89024, busy: 12215, near: { "caixa-clara@s4-caixa": 1222, "caixa-de-fosforos@s5-caixote": 775, "camera@s4-a": 317, "chaleira@s4-chaleira": 1190, "estojo-de-oculos@s5-caixote": 331, "estojo-de-oculos@s5-rolos": 3 } },
  },
  "garrafinha@mesinha": { sprite: { sx: 925, sy: 1032, w: 34, h: 77, x: 782, y: 1104 } },
  "garrafinha@peitoril-3": { sprite: { sx: 961, sy: 1032, w: 34, h: 77, x: 724, y: 930 } },
  "garrafinha@peitoril-5": { sprite: { sx: 2, sy: 1122, w: 34, h: 77, x: 855, y: 930 } },
  "globo@globo": {
    baked: true,
    measured: { visible: 0.99, edge: 1.35, ring: 136448, busy: 16566, near: { "caixa-de-fosforos@s5-a": 957, "caixinha-de-musica@s4-a": -41, "caixinha-de-musica@s5-a": 654, "camera@s4-a": 448, "gaita@s5-a": 1971, "pena@frasco": 2121, "pena@mapa-direita": 59 } },
  },
  "guarda-chuva@canto": {
    sprite: { sx: 39, sy: 2, w: 64, h: 257, x: 998, y: 935 },
    measured: { visible: 0.947, edge: 1.49, ring: 123552, busy: 15381, near: { "binoculo@tapete-d": 1320, "caracol@parede-direita": 366, "chapeu@pilha-livros": 506, "chave@tapete-d": 148, "garrafinha@peitoril-5": 341, "lupa@livro-esq": 288, "peao-de-xadrez@tapete-d": 289, "piao@tapete-d": 651, "relogio@livro-borda": 15, "tesoura@chao-mesa": 16, "vaso-torneado@peitoril-6": 986 } },
  },
  "guarda-chuva@varao-b": {
    sprite: { sx: 2, sy: 2, w: 35, h: 300, x: 493, y: 174 },
    measured: { visible: 0.989, edge: 2.21, ring: 123552, busy: 16247, near: {  } },
  },
  "lanterna@s4-lanterna": {
    baked: true,
    measured: { visible: 0.747, edge: 1.39, ring: 126880, busy: 17453, near: { "caixa-clara@s3-a": -408, "caixa-escura@s3-a": -312, "caixa-escura@s3-caixa": 937, "chaleira@s4-chaleira": 1190, "estojo-de-oculos@s5-b": 298, "estojo-de-oculos@s5-rolos": 282, "gaita@s5-livros": 1164 } },
  },
  "lata-redonda@chao-mesa-e": { sprite: { sx: 140, sy: 1309, w: 42, h: 44, x: 1109, y: 1377 } },
  "lata-redonda@mesa-frente-a": { sprite: { sx: 184, sy: 1309, w: 42, h: 44, x: 1639, y: 1185 } },
  "lata-redonda@mesa-frente-b": { sprite: { sx: 228, sy: 1309, w: 42, h: 44, x: 1405, y: 1165 } },
  "lupa@livro": {
    sprite: { sx: 105, sy: 2, w: 241, h: 241, x: 1200, y: 969 },
    measured: { visible: 0.993, edge: 1.77, ring: 133120, busy: 22187, near: { "bussola@mapa-borda": 1414, "chapeu@pilha-livros": 1338, "lata-redonda@mesa-frente-b": 391, "medalha@pilha-livros": 718, "moedas@mesa-frente-b": 403, "tesoura@mapa-fundo": 608 } },
  },
  "lupa@livro-esq": {
    sprite: { sx: 348, sy: 2, w: 241, h: 241, x: 1124, y: 949 },
    measured: { visible: 0.956, edge: 1.84, ring: 133120, busy: 18161, near: { "bussola@mapa-borda": 296, "lata-redonda@mesa-frente-b": 391, "moedas@livro-pagina": 613, "moedas@mesa-frente-b": 403 } },
  },
  "lupa@mapa": {
    sprite: { sx: 591, sy: 2, w: 241, h: 241, x: 1679, y: 959 },
    measured: { visible: 0.998, edge: 1.75, ring: 133120, busy: 17416, near: { "bussola@mapa-borda": 796, "carimbo@mapa-dir-fundo": 760, "carimbo@mapa-direita": 1250, "compasso-de-pontas@mapa-baixo": 703, "compasso-de-pontas@mesa-frente-a": 385, "lata-redonda@mesa-frente-a": 236, "moedas@mesa-frente-a": 377, "pena@mapa-direita": 1994, "tesoura@mapa-fundo": 189 } },
  },
  "medalha@chao-mesa-e": { sprite: { sx: 2, sy: 1309, w: 44, h: 45, x: 1108, y: 1379 } },
  "medalha@pilha-livros": { sprite: { sx: 94, sy: 1309, w: 44, h: 44, x: 1178, y: 943 } },
  "medalha@tapete-mesa-d": { sprite: { sx: 48, sy: 1309, w: 44, h: 45, x: 1878, y: 1369 } },
  "moedas@livro-pagina": { sprite: { sx: 193, sy: 1356, w: 32, h: 30, x: 1404, y: 1062 } },
  "moedas@mesa-frente-a": { sprite: { sx: 227, sy: 1356, w: 32, h: 30, x: 1644, y: 1192 } },
  "moedas@mesa-frente-b": { sprite: { sx: 261, sy: 1356, w: 32, h: 30, x: 1410, y: 1180 } },
  "pandeiro@chao-estante": { sprite: { sx: 637, sy: 1032, w: 76, h: 80, x: 2699, y: 1329 } },
  "pandeiro@chao-estante-b": { sprite: { sx: 715, sy: 1032, w: 76, h: 80, x: 2843, y: 1347 } },
  "peao-de-xadrez@tapete-a": { sprite: { sx: 490, sy: 1122, w: 34, h: 66, x: 722, y: 1338 } },
  "peao-de-xadrez@tapete-b": { sprite: { sx: 562, sy: 1122, w: 34, h: 65, x: 829, y: 1362 } },
  "peao-de-xadrez@tapete-d": { sprite: { sx: 526, sy: 1122, w: 34, h: 66, x: 973, y: 1278 } },
  "pedrinhas@mesinha-b": { sprite: { sx: 620, sy: 1309, w: 58, h: 36, x: 683, y: 1148 } },
  "pedrinhas@peitoril-3": { sprite: { sx: 680, sy: 1309, w: 58, h: 36, x: 715, y: 972 } },
  "pedrinhas@poltrona-assento": { sprite: { sx: 740, sy: 1309, w: 58, h: 36, x: 263, y: 1076 } },
  "pena@frasco": {
    sprite: { sx: 130, sy: 304, w: 116, h: 198, x: 1986, y: 878 },
    measured: { visible: 0.999, edge: 2.93, ring: 108992, busy: 13079, near: { "carimbo@mapa-dir-fundo": 760, "carimbo@mapa-direita": 1250, "lupa@mapa": 190, "xicara@mapa-dir-fundo": 1317 } },
  },
  "pena@mapa-dir-fundo": {
    sprite: { sx: 248, sy: 304, w: 116, h: 198, x: 1851, y: 802 },
    measured: { visible: 1, edge: 3, ring: 108992, busy: 7106, near: { "borboleta@parede-mesa": 657, "borboleta@quadro-baixo": 1624, "folha-emoldurada@parede-mesa": 854, "folha-emoldurada@quadro-baixo": 1861, "xicara@mapa-direita": 1482 } },
  },
  "pena@mapa-direita": {
    sprite: { sx: 366, sy: 304, w: 116, h: 198, x: 1874, y: 900 },
    measured: { visible: 1, edge: 3.33, ring: 108992, busy: 11155, near: { "lupa@mapa": 3736 } },
  },
  "piao@tapete-a": {
    sprite: { sx: 38, sy: 1122, w: 62, h: 75, x: 706, y: 1328 },
    measured: { visible: 0.976, edge: 2.3, ring: 89024, busy: 12862, near: { "apontador@tapete-b": 608, "apontador@tapete-c": 62, "chave@bau": 28, "peao-de-xadrez@tapete-b": 791 } },
  },
  "piao@tapete-d": {
    sprite: { sx: 102, sy: 1122, w: 62, h: 75, x: 957, y: 1268 },
    measured: { visible: 0.972, edge: 2.26, ring: 89024, busy: 11000, near: { "ampulheta@mesinha": -303, "apontador@tapete-b": 442, "apontador@tapete-c": 830, "guarda-chuva@canto": 266, "lata-redonda@chao-mesa-e": 634, "lupa@livro-esq": 75, "medalha@chao-mesa-e": 673, "peao-de-xadrez@tapete-b": 791 } },
  },
  "pinha@prateleira-1": {
    sprite: { sx: 2, sy: 937, w: 56, h: 93, x: 1190, y: 611 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 4981, near: { "abacaxi-de-madeira@prateleira-2": 590, "acucareiro@prateleira-2": 957 } },
  },
  "pinha@prateleira-2": {
    sprite: { sx: 60, sy: 937, w: 56, h: 93, x: 1278, y: 609 },
    measured: { visible: 1, edge: 1.51, ring: 86528, busy: 9874, near: { "abacaxi-de-madeira@prateleira-1": 548, "abacaxi-de-madeira@prateleira-livros": 539, "acucareiro@prateleira-1": 887, "acucareiro@prateleira-livros": 921 } },
  },
  "pinha@prateleira-livros": {
    sprite: { sx: 118, sy: 937, w: 56, h: 93, x: 1380, y: 567 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 8409, near: { "abacaxi-de-madeira@prateleira-2": 590, "acucareiro@prateleira-2": 957 } },
  },
  "pote-de-frutinhas@s2-a": { sprite: { sx: 894, sy: 822, w: 56, h: 94, x: 2532, y: 510 } },
  "pote-de-frutinhas@s2-pote": { sprite: { sx: 952, sy: 822, w: 56, h: 94, x: 2902, y: 510 } },
  "relogio@livro-borda": {
    sprite: { sx: 2, sy: 1032, w: 199, h: 88, x: 1169, y: 1138 },
    measured: { visible: 0.86, edge: 1.63, ring: 96512, busy: 21812, near: { "bussola@mapa-borda": 289, "bussola@tapete-mesa-a": 458, "compasso-de-pontas@livro-pagina": 675, "moedas@livro-pagina": 613, "moedas@mesa-frente-b": 403, "tampa-de-pote@chao-mesa": 147, "tesoura@chao-mesa": 312 } },
  },
  "relogio@tapete-mesa-a": {
    sprite: { sx: 486, sy: 822, w: 202, h: 98, x: 1289, y: 1298 },
    measured: { visible: 0.993, edge: 1.61, ring: 96512, busy: 12482, near: { "abaco@tapete-mesa-c": 733, "bussola@mapa-borda": 429, "lata-redonda@mesa-frente-b": 103, "moedas@mesa-frente-b": 403 } },
  },
  "relogio@tapete-mesa-b": {
    sprite: { sx: 690, sy: 822, w: 202, h: 98, x: 1579, y: 1298 },
    measured: { visible: 0.993, edge: 1.51, ring: 96512, busy: 10277, near: { "abaco@tapete-mesa-d": 1524, "bussola@mapa-borda": 23, "carimbo@tapete-mesa-d": 507, "compasso-de-pontas@mapa-baixo": 2, "compasso-de-pontas@mesa-frente-a": 385, "lata-redonda@mesa-frente-a": 236, "lupa@mapa": 95, "medalha@tapete-mesa-d": 496, "moedas@mesa-frente-a": 377 } },
  },
  "rolo-de-papel@s1-a": { sprite: { sx: 173, sy: 696, w: 34, h: 118, x: 2383, y: 254 } },
  "rolo-de-papel@s1-b": { sprite: { sx: 209, sy: 696, w: 34, h: 118, x: 2748, y: 254 } },
  "rolo-de-papel@s1-rolo": { sprite: { sx: 245, sy: 696, w: 34, h: 118, x: 2536, y: 254 } },
  "roseta-entalhada@roseta": { baked: true },
  "tampa-de-pote@chao-mesa": { sprite: { sx: 893, sy: 1309, w: 54, h: 33, x: 1181, y: 1298 } },
  "tampa-de-pote@tapete-mesa-a": { sprite: { sx: 949, sy: 1309, w: 54, h: 33, x: 1423, y: 1362 } },
  "tampa-de-pote@tapete-mesa-b": { sprite: { sx: 2, sy: 1356, w: 54, h: 33, x: 1713, y: 1362 } },
  "tesoura@chao-mesa": {
    sprite: { sx: 700, sy: 1122, w: 91, h: 54, x: 1162, y: 1276 },
    measured: { visible: 0.999, edge: 1.31, ring: 88192, busy: 9641, near: { "binoculo@tapete-d": 185, "chave@tapete-d": 79, "lata-redonda@chao-mesa-e": 647, "lupa@livro": 648, "lupa@livro-esq": 61, "medalha@chao-mesa-e": 673, "relogio@livro-borda": 2112, "relogio@tapete-mesa-a": 761 } },
  },
  "tesoura@mapa-fundo": {
    sprite: { sx: 800, sy: 1309, w: 91, h: 33, x: 1512, y: 956 },
    measured: { visible: 0.625, edge: 2, ring: 88192, busy: 13196, near: { "bussola@mapa-borda": 520, "compasso-de-pontas@livro-pagina": 675, "lupa@livro": 1194, "lupa@mapa": 1559, "moedas@livro-pagina": 613, "xicara@atras-livro": 1209 } },
  },
  "tigela-de-latao@mesinha": { sprite: { sx: 295, sy: 1356, w: 50, h: 25, x: 775, y: 1156 } },
  "tigela-de-latao@mesinha-b": { sprite: { sx: 347, sy: 1356, w: 50, h: 25, x: 685, y: 1158 } },
  "tigela-de-latao@peitoril-4": { sprite: { sx: 399, sy: 1356, w: 50, h: 25, x: 781, y: 982 } },
  "tigela-de-latao@poltrona": { sprite: { sx: 451, sy: 1356, w: 50, h: 25, x: 457, y: 1170 } },
  "tinteiros@mesinha-b": { sprite: { sx: 262, sy: 1201, w: 64, h: 53, x: 678, y: 1131 } },
  "tinteiros@peitoril-1": { sprite: { sx: 328, sy: 1201, w: 64, h: 53, x: 468, y: 963 } },
  "tinteiros@peitoril-2": { sprite: { sx: 394, sy: 1201, w: 64, h: 53, x: 621, y: 955 } },
  "vaso-de-porcelana@s1-a": { sprite: { sx: 739, sy: 937, w: 40, h: 89, x: 2380, y: 283 } },
  "vaso-de-porcelana@s1-b": { sprite: { sx: 781, sy: 937, w: 40, h: 89, x: 2745, y: 283 } },
  "vaso-de-porcelana@s1-vaso": { sprite: { sx: 823, sy: 937, w: 40, h: 89, x: 2834, y: 283 } },
  "vaso-torneado@mesinha": { sprite: { sx: 651, sy: 528, w: 42, h: 134, x: 779, y: 1047 } },
  "vaso-torneado@peitoril-2": { sprite: { sx: 695, sy: 528, w: 42, h: 134, x: 632, y: 873 } },
  "vaso-torneado@peitoril-6": { sprite: { sx: 739, sy: 528, w: 42, h: 134, x: 911, y: 873 } },
  "xicara@atras-livro": {
    sprite: { sx: 176, sy: 937, w: 89, h: 92, x: 1387, y: 898 },
    measured: { visible: 0.538, edge: 1.75, ring: 89856, busy: 16077, near: { "bussola@mapa-borda": 480, "chapeu@pilha-livros": 16, "compasso-de-pontas@livro-pagina": 675, "moedas@livro-pagina": 613, "tesoura@mapa-fundo": 685 } },
  },
  "xicara@mapa-dir-fundo": {
    sprite: { sx: 2, sy: 822, w: 102, h: 113, x: 1849, y: 878 },
    measured: { visible: 1, edge: 1.88, ring: 89856, busy: 8097, near: { "pena@frasco": 1697 } },
  },
  "xicara@mapa-direita": {
    sprite: { sx: 106, sy: 822, w: 102, h: 113, x: 1872, y: 976 },
    measured: { visible: 1, edge: 1.64, ring: 89856, busy: 11672, near: { "carimbo@mapa-dir-fundo": 754, "pena@mapa-dir-fundo": 518 } },
  },
};
