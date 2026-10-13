import type { PlacementArt, SceneAtlas } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Estúdio do Explorador — the pictures of the things that move, and their audit (GAME03-REPLAYABILITY-05).
 *
 * Written by tools/assets/create_hidden_objects_scene.mjs: never edit by hand. Each placement
 * ("thing@slot") is a rectangle of the room's sprite atlas painted at (x, y) su; a pool object's
 * `measured` is what the art kit's audit measured for it on that slot (hidden-objects-scene.ts,
 * PlacementMeasure; hidden-objects-layout.ts, measureIn).
 */
export const STUDIO_ATLAS: SceneAtlas = { src: "/assets/hidden-objects/explorer-studio/v4/atlas.webp", width: 1024, height: 1421 };

export const STUDIO_PLACEMENT_ART: Readonly<Record<string, PlacementArt>> = {
  "abacaxi-de-madeira@prateleira-1": { sprite: { sx: 183, sy: 1179, w: 32, h: 59, x: 1202, y: 644 } },
  "abacaxi-de-madeira@prateleira-2": { sprite: { sx: 217, sy: 1179, w: 32, h: 59, x: 1290, y: 642 } },
  "abacaxi-de-madeira@prateleira-livros": { sprite: { sx: 251, sy: 1179, w: 32, h: 59, x: 1392, y: 600 } },
  "abaco@tapete-mesa-a": { sprite: { sx: 2, sy: 1249, w: 64, h: 51, x: 1418, y: 1350 } },
  "abaco@tapete-mesa-c": { sprite: { sx: 68, sy: 1249, w: 64, h: 51, x: 1252, y: 1356 } },
  "abaco@tapete-mesa-d": { sprite: { sx: 134, sy: 1249, w: 64, h: 51, x: 1868, y: 1364 } },
  "acucareiro@prateleira-1": { sprite: { sx: 399, sy: 1302, w: 48, h: 48, x: 1194, y: 654 } },
  "acucareiro@prateleira-2": { sprite: { sx: 449, sy: 1302, w: 48, h: 48, x: 1282, y: 652 } },
  "acucareiro@prateleira-livros": { sprite: { sx: 499, sy: 1302, w: 48, h: 48, x: 1384, y: 610 } },
  "alca-do-bau@alca": { baked: true },
  "ampulheta@mesinha": {
    sprite: { sx: 863, sy: 2, w: 126, h: 222, x: 737, y: 957 },
    measured: { visible: 0.953, edge: 1.77, ring: 126880, busy: 16745, near: { "caracol@lambri-a": 1466, "caracol@lambri-b": 200, "chave@tapete-d": 68, "garrafinha@peitoril-3": 48, "garrafinha@peitoril-5": 311, "pedrinhas@mesinha-b": 195, "pedrinhas@peitoril-3": 64, "piao@tapete-d": 43, "tigela-de-latao@mesinha-b": 226, "tinteiros@peitoril-2": 620, "vaso-torneado@peitoril-2": 959, "vaso-torneado@peitoril-6": 981 } },
  },
  "ampulheta@peitoril-34": {
    sprite: { sx: 2, sy: 261, w: 126, h: 222, x: 711, y: 783 },
    measured: { visible: 0.896, edge: 1.71, ring: 126880, busy: 16229, near: { "caracol@lambri-a": 1725, "garrafinha@mesinha": 119, "garrafinha@peitoril-5": 588, "tinteiros@peitoril-2": 620, "vaso-torneado@mesinha": 838, "vaso-torneado@peitoril-2": 959, "vaso-torneado@peitoril-6": 982 } },
  },
  "apito@gaveta-a": {
    sprite: { sx: 313, sy: 1302, w: 84, h: 49, x: 753, y: 1219 },
    measured: { visible: 0.742, edge: 1.79, ring: 89440, busy: 14074, near: { "ampulheta@mesinha": 2212, "caracol@lambri-a": 471, "caracol@lambri-b": 136, "chave@tapete-d": 390, "garrafinha@mesinha": 562, "peao-de-xadrez@tapete-a": 481, "peao-de-xadrez@tapete-b": 398, "pedrinhas@mesinha-b": 258, "piao@tapete-a": 1181, "piao@tapete-d": 182, "tigela-de-latao@mesinha": 450, "tigela-de-latao@mesinha-b": 299, "vaso-torneado@mesinha": 810 } },
  },
  "apito@gaveta-b": {
    sprite: { sx: 220, sy: 1302, w: 91, h: 49, x: 737, y: 1219 },
    measured: { visible: 0.912, edge: 1.77, ring: 89440, busy: 14337, near: { "ampulheta@mesinha": 2212, "caracol@lambri-a": 616, "caracol@lambri-b": 308, "chave@tapete-d": 292, "garrafinha@mesinha": 562, "peao-de-xadrez@tapete-a": 481, "peao-de-xadrez@tapete-b": 398, "pedrinhas@mesinha-b": 258, "piao@tapete-a": 1181, "piao@tapete-d": 33, "tigela-de-latao@mesinha": 450, "tigela-de-latao@mesinha-b": 299, "vaso-torneado@mesinha": 810 } },
  },
  "apontador@chao-bau-b": { sprite: { sx: 106, sy: 1394, w: 57, h: 21, x: 621, y: 1531 } },
  "apontador@tapete-b": { sprite: { sx: 224, sy: 1394, w: 57, h: 20, x: 817, y: 1407 } },
  "apontador@tapete-c": { sprite: { sx: 165, sy: 1394, w: 57, h: 21, x: 896, y: 1393 } },
  "barco@s3-barco": {
    baked: true,
    measured: { visible: 0.948, edge: 2.06, ring: 161616, busy: 28079, near: { "caixa-clara@s3-a": -188, "caixa-escura@s3-a": -235, "caixinha-de-musica@s2-pilha": 706, "camera@s2-a": 2003, "camera@s2-camera": 546, "estatueta@s3-a": 810, "lanterna@s4-a": 1545, "pote-de-frutinhas@s2-a": 322 } },
  },
  "binoculo@bau": {
    sprite: { sx: 801, sy: 1005, w: 149, h: 81, x: 442, y: 1223 },
    measured: { visible: 0.899, edge: 1.37, ring: 104416, busy: 12900, near: { "caracol@lambri-a": 385, "caracol@lambri-b": 1544, "guarda-chuva@poltrona": 636, "pedrinhas@mesinha-b": 117, "piao@tapete-a": 129, "tigela-de-latao@mesinha-b": 163 } },
  },
  "binoculo@peitoril-1": {
    sprite: { sx: 2, sy: 1096, w: 143, h: 81, x: 424, y: 929 },
    measured: { visible: 0.846, edge: 1.32, ring: 104416, busy: 14136, near: { "caracol@lambri-a": 1725, "caracol@lambri-b": 117, "guarda-chuva@poltrona": 1856, "pedrinhas@poltrona-assento": 101, "tinteiros@peitoril-2": 620, "tinteiros@poltrona-assento": 82, "vaso-torneado@peitoril-2": 959 } },
  },
  "bolsa@gancho": {
    baked: true,
    measured: { visible: 0.99, edge: 2.25, ring: 101504, busy: 6527, near: { "borboleta@quadro-baixo": 1144, "caixinha-de-musica@s2-pilha": 653, "chapeu@cabide": 783, "folha-emoldurada@quadro-baixo": 1944 } },
  },
  "borboleta@parede-mesa": {
    sprite: { sx: 446, sy: 485, w: 134, h: 150, x: 1653, y: 607 },
    measured: { visible: 1, edge: 1.41, ring: 104000, busy: 6003, near: {  } },
  },
  "borboleta@quadro-alto": {
    sprite: { sx: 582, sy: 485, w: 134, h: 150, x: 1917, y: 317 },
    measured: { visible: 1, edge: 1.33, ring: 104000, busy: 7056, near: { "chapeu@cabide": 1089 } },
  },
  "borboleta@quadro-baixo": {
    sprite: { sx: 718, sy: 485, w: 134, h: 150, x: 1941, y: 597 },
    measured: { visible: 1, edge: 1.38, ring: 104000, busy: 1946, near: { "chapeu@cabide": 591, "pena@mapa-dir-fundo": 510 } },
  },
  "bussola@mapa-borda": {
    sprite: { sx: 90, sy: 653, w: 116, h: 130, x: 1482, y: 1092 },
    measured: { visible: 0.878, edge: 1.98, ring: 111488, busy: 19595, near: { "compasso-de-pontas@livro-pagina": 668, "compasso-de-pontas@mapa-baixo": 687, "compasso-de-pontas@mesa-frente-a": 386, "lata-redonda@mesa-frente-a": 299, "lupa@livro": 1541, "lupa@livro-esq": 177, "lupa@mapa": 1560, "moedas@livro-pagina": 621, "moedas@mesa-frente-a": 408, "moedas@mesa-frente-b": 425, "relogio@livro-borda": 181, "relogio@tapete-mesa-a": 1237, "relogio@tapete-mesa-b": 959, "tesoura@livro-pagina": 1486, "tesoura@mapa-fundo": 445, "xicara@atras-livro": 314 } },
  },
  "bussola@tapete-mesa-a": {
    sprite: { sx: 208, sy: 653, w: 116, h: 130, x: 1392, y: 1262 },
    measured: { visible: 0.991, edge: 1.49, ring: 111488, busy: 13596, near: { "abaco@tapete-mesa-c": 1440, "lata-redonda@mesa-frente-b": 419, "lupa@livro": 124, "moedas@mesa-frente-b": 425, "relogio@livro-borda": 1555, "relogio@tapete-mesa-b": 502 } },
  },
  "caixa-clara@s3-a": { sprite: { sx: 582, sy: 789, w: 136, h: 102, x: 2702, y: 734 } },
  "caixa-clara@s4-b": { sprite: { sx: 720, sy: 789, w: 136, h: 102, x: 2912, y: 964 } },
  "caixa-clara@s4-caixa": { sprite: { sx: 858, sy: 789, w: 136, h: 102, x: 2507, y: 964 } },
  "caixa-de-fosforos@s4-b": { sprite: { sx: 912, sy: 1302, w: 67, h: 39, x: 2943, y: 1027 } },
  "caixa-de-fosforos@s5-a": { sprite: { sx: 2, sy: 1353, w: 67, h: 39, x: 2340, y: 1087 } },
  "caixa-de-fosforos@s5-caixote": { sprite: { sx: 71, sy: 1353, w: 67, h: 39, x: 2469, y: 1107 } },
  "caixa-escura@s3-a": { sprite: { sx: 791, sy: 905, w: 136, h: 89, x: 2701, y: 747 } },
  "caixa-escura@s3-caixa": { sprite: { sx: 2, sy: 1005, w: 136, h: 89, x: 2917, y: 747 } },
  "caixinha-de-musica@s2-pilha": { sprite: { sx: 883, sy: 1249, w: 107, h: 49, x: 2303, y: 479 } },
  "caixinha-de-musica@s4-a": { sprite: { sx: 2, sy: 1302, w: 107, h: 49, x: 2343, y: 1017 } },
  "caixinha-de-musica@s5-a": { sprite: { sx: 111, sy: 1302, w: 107, h: 49, x: 2325, y: 1077 } },
  "camera@s2-a": {
    sprite: { sx: 793, sy: 653, w: 184, h: 114, x: 2468, y: 495 },
    measured: { visible: 0.978, edge: 1.78, ring: 115648, busy: 23314, near: { "caixinha-de-musica@s2-pilha": 528, "estatueta@s1-a": -23, "estatueta@s1-estatueta": 224, "rolo-de-papel@s1-a": 62, "rolo-de-papel@s1-b": 20, "rolo-de-papel@s1-rolo": 122, "vaso-de-porcelana@s1-a": 66, "vaso-de-porcelana@s1-b": 18 } },
  },
  "camera@s2-camera": {
    sprite: { sx: 2, sy: 789, w: 184, h: 114, x: 2711, y: 493 },
    measured: { visible: 0.837, edge: 2.99, ring: 115648, busy: 19279, near: { "estatueta@s1-estatueta": 237, "estatueta@s3-a": 47, "pote-de-frutinhas@s2-pote": 1190, "rolo-de-papel@s1-b": 77, "vaso-de-porcelana@s1-b": 70, "vaso-de-porcelana@s1-vaso": 105 } },
  },
  "camera@s4-a": {
    sprite: { sx: 188, sy: 789, w: 184, h: 114, x: 2303, y: 955 },
    measured: { visible: 0.804, edge: 1.47, ring: 115648, busy: 14705, near: { "caixa-clara@s4-caixa": 1273, "caixa-de-fosforos@s5-caixote": 960, "gaita@s5-a": 2167 } },
  },
  "cantil@cesto-a": {
    sprite: { sx: 140, sy: 1005, w: 96, h: 89, x: 2326, y: 1337 },
    measured: { visible: 0.846, edge: 2.48, ring: 91520, busy: 7519, near: {  } },
  },
  "cantil@cesto-b": {
    sprite: { sx: 238, sy: 1005, w: 96, h: 89, x: 2338, y: 1337 },
    measured: { visible: 0.873, edge: 3.06, ring: 91520, busy: 7787, near: {  } },
  },
  "caracol@lambri-a": {
    sprite: { sx: 378, sy: 1179, w: 86, h: 54, x: 601, y: 1055 },
    measured: { visible: 0.793, edge: 2.02, ring: 87360, busy: 11421, near: { "ampulheta@mesinha": 3899, "ampulheta@peitoril-34": 1662, "binoculo@bau": 243, "binoculo@peitoril-1": 1723, "chave@peitoril-1": 758, "garrafinha@mesinha": 349, "garrafinha@peitoril-3": 557, "pedrinhas@mesinha-b": 258, "pedrinhas@peitoril-3": 377, "tigela-de-latao@mesinha": 305, "tigela-de-latao@mesinha-b": 299, "tigela-de-latao@peitoril-4": 197, "tinteiros@peitoril-1": 297, "tinteiros@peitoril-2": 620, "vaso-torneado@mesinha": 1123, "vaso-torneado@peitoril-2": 458 } },
  },
  "caracol@lambri-b": {
    sprite: { sx: 466, sy: 1179, w: 86, h: 54, x: 549, y: 1123 },
    measured: { visible: 0.897, edge: 1.92, ring: 87360, busy: 14441, near: { "ampulheta@mesinha": 769, "ampulheta@peitoril-34": 7, "binoculo@bau": 2560, "binoculo@peitoril-1": 150, "chave@bau": 1274, "chave@peitoril-1": 5, "garrafinha@peitoril-3": 37, "guarda-chuva@poltrona": -6, "pedrinhas@mesinha-b": 258, "pedrinhas@peitoril-3": 74, "tigela-de-latao@mesinha-b": 299, "tinteiros@peitoril-1": 211, "tinteiros@peitoril-2": 100, "vaso-torneado@peitoril-2": 54 } },
  },
  "caracol@parede-direita": {
    sprite: { sx: 554, sy: 1179, w: 86, h: 54, x: 964, y: 763 },
    measured: { visible: 0.984, edge: 1.42, ring: 87360, busy: 6686, near: { "chapeu@pilha-livros": 38, "garrafinha@peitoril-5": 64, "guarda-chuva@canto": 57, "vaso-torneado@peitoril-6": 640 } },
  },
  "carimbo@mapa-dir-fundo": { sprite: { sx: 663, sy: 1005, w: 44, h: 84, x: 1878, y: 909 } },
  "carimbo@mapa-direita": { sprite: { sx: 709, sy: 1005, w: 44, h: 84, x: 1901, y: 1007 } },
  "carimbo@tapete-mesa-d": { sprite: { sx: 755, sy: 1005, w: 44, h: 84, x: 1878, y: 1329 } },
  "cesta-de-arame@suporte": { sprite: { sx: 803, sy: 1096, w: 44, h: 71, x: 976, y: 446 } },
  "cesta-de-arame@varao-a": { sprite: { sx: 701, sy: 653, w: 44, h: 117, x: 904, y: 174 } },
  "cesta-de-arame@varao-b": { sprite: { sx: 747, sy: 653, w: 44, h: 117, x: 478, y: 174 } },
  "chaleira@s2-pote": { sprite: { sx: 849, sy: 1096, w: 71, h: 68, x: 2896, y: 536 } },
  "chaleira@s4-b": { sprite: { sx: 922, sy: 1096, w: 71, h: 68, x: 2946, y: 996 } },
  "chaleira@s4-chaleira": { sprite: { sx: 2, sy: 1179, w: 71, h: 68, x: 2668, y: 996 } },
  "chapeu@cabide": {
    sprite: { sx: 303, sy: 1096, w: 130, h: 78, x: 2065, y: 429 },
    measured: { visible: 1, edge: 1.91, ring: 96096, busy: 3583, near: { "borboleta@quadro-alto": 4762, "borboleta@quadro-baixo": 877, "caixinha-de-musica@s2-pilha": 129, "folha-emoldurada@quadro-baixo": 1461 } },
  },
  "chapeu@pilha-livros": {
    sprite: { sx: 671, sy: 1096, w: 130, h: 74, x: 1137, y: 919 },
    measured: { visible: 0.99, edge: 2.78, ring: 96096, busy: 13265, near: { "caracol@parede-direita": 196, "guarda-chuva@canto": 2302, "lupa@livro": 1100, "tesoura@livro-pagina": 169 } },
  },
  "chave@bau": {
    sprite: { sx: 200, sy: 1249, w: 128, h: 50, x: 454, y: 1249 },
    measured: { visible: 0.707, edge: 1.67, ring: 95680, busy: 12716, near: { "caracol@lambri-b": 1484, "guarda-chuva@poltrona": 371, "pedrinhas@mesinha-b": 42, "tigela-de-latao@mesinha-b": 92 } },
  },
  "chave@peitoril-1": {
    sprite: { sx: 460, sy: 1249, w: 121, h: 50, x: 436, y: 955 },
    measured: { visible: 0.933, edge: 1.67, ring: 95680, busy: 13557, near: { "caracol@lambri-a": 1725, "caracol@lambri-b": 117, "guarda-chuva@poltrona": 2062, "pedrinhas@poltrona-assento": 40, "tinteiros@peitoril-2": 620, "tinteiros@poltrona-assento": 59, "vaso-torneado@peitoril-2": 959 } },
  },
  "chave@tapete-d": {
    sprite: { sx: 330, sy: 1249, w: 128, h: 50, x: 926, y: 1287 },
    measured: { visible: 0.96, edge: 1.4, ring: 95680, busy: 10829, near: { "ampulheta@mesinha": -4, "apontador@tapete-b": 622, "apontador@tapete-c": 870, "garrafinha@mesinha": 62, "guarda-chuva@canto": 110, "lata-redonda@chao-mesa-e": 636, "lupa@livro-esq": -20, "medalha@chao-mesa-e": 676, "peao-de-xadrez@tapete-b": 807, "relogio@livro-borda": 76, "tigela-de-latao@mesinha": 147, "vaso-torneado@mesinha": 81 } },
  },
  "colar@caixinha-a": {
    sprite: { sx: 642, sy: 1179, w: 84, h: 54, x: 1908, y: 1129 },
    measured: { visible: 0.786, edge: 3.13, ring: 87776, busy: 9823, near: { "carimbo@mapa-direita": 1250, "lupa@mapa": 2798, "pena@frasco": 551, "pena@mapa-direita": 1048, "xicara@frasco": 1403, "xicara@mapa-direita": 1479 } },
  },
  "colar@caixinha-b": {
    sprite: { sx: 728, sy: 1179, w: 84, h: 54, x: 1912, y: 1129 },
    measured: { visible: 0.691, edge: 3.12, ring: 87776, busy: 9913, near: { "carimbo@mapa-direita": 1250, "lupa@mapa": 2725, "pena@frasco": 551, "pena@mapa-direita": 1048, "xicara@frasco": 1403, "xicara@mapa-direita": 1479 } },
  },
  "compasso-de-pontas@livro-pagina": { sprite: { sx: 721, sy: 1353, w: 43, h: 32, x: 1398, y: 1058 } },
  "compasso-de-pontas@mapa-baixo": { sprite: { sx: 766, sy: 1353, w: 43, h: 32, x: 1642, y: 1148 } },
  "compasso-de-pontas@mesa-frente-a": { sprite: { sx: 811, sy: 1353, w: 43, h: 32, x: 1638, y: 1191 } },
  "estatueta@s1-a": {
    sprite: { sx: 326, sy: 653, w: 94, h: 124, x: 2353, y: 253 },
    measured: { visible: 0.989, edge: 2.46, ring: 99424, busy: 13413, near: { "caixinha-de-musica@s2-pilha": 254, "rolo-de-papel@s1-rolo": 1179 } },
  },
  "estatueta@s1-estatueta": {
    sprite: { sx: 518, sy: 653, w: 73, h: 124, x: 2631, y: 250 },
    measured: { visible: 0.754, edge: 2.94, ring: 99424, busy: 13564, near: { "rolo-de-papel@s1-b": 686, "rolo-de-papel@s1-rolo": 1507, "vaso-de-porcelana@s1-b": 331 } },
  },
  "estatueta@s3-a": {
    sprite: { sx: 422, sy: 653, w: 94, h: 124, x: 2723, y: 713 },
    measured: { visible: 0.998, edge: 2.4, ring: 99424, busy: 11743, near: { "caixa-escura@s3-caixa": 55, "camera@s2-a": 18, "camera@s2-camera": 234, "chaleira@s2-pote": 75, "lanterna@s4-lanterna": 2802, "pote-de-frutinhas@s2-pote": 21 } },
  },
  "estojo-de-oculos@s5-b": { sprite: { sx: 140, sy: 1353, w: 68, h: 37, x: 2951, y: 1099 } },
  "estojo-de-oculos@s5-rolos": { sprite: { sx: 210, sy: 1353, w: 68, h: 37, x: 2821, y: 1099 } },
  "fivela@fivela": { baked: true },
  "folha-emoldurada@parede-mesa": { sprite: { sx: 2, sy: 485, w: 146, h: 166, x: 1647, y: 599 } },
  "folha-emoldurada@quadro-alto": { sprite: { sx: 150, sy: 485, w: 146, h: 166, x: 1911, y: 309 } },
  "folha-emoldurada@quadro-baixo": { sprite: { sx: 298, sy: 485, w: 146, h: 166, x: 1935, y: 589 } },
  "gaiola@suporte": {
    sprite: { sx: 854, sy: 485, w: 91, h: 149, x: 963, y: 455 },
    measured: { visible: 0.941, edge: 1.5, ring: 101920, busy: 4771, near: {  } },
  },
  "gaiola@varao-a": {
    sprite: { sx: 803, sy: 261, w: 70, h: 187, x: 891, y: 174 },
    measured: { visible: 1, edge: 1.34, ring: 101920, busy: 9095, near: { "cesta-de-arame@suporte": 321 } },
  },
  "gaiola@varao-b": {
    sprite: { sx: 875, sy: 261, w: 70, h: 187, x: 465, y: 174 },
    measured: { visible: 0.979, edge: 2.19, ring: 101920, busy: 12777, near: {  } },
  },
  "gaita@s5-a": {
    sprite: { sx: 583, sy: 1249, w: 98, h: 50, x: 2329, y: 1071 },
    measured: { visible: 0.971, edge: 1.48, ring: 89024, busy: 15539, near: { "caixa-clara@s4-caixa": 702, "caixa-de-fosforos@s5-caixote": 960, "camera@s4-a": 610, "lanterna@s4-a": 1351 } },
  },
  "gaita@s5-b": {
    sprite: { sx: 683, sy: 1249, w: 98, h: 50, x: 2937, y: 1081 },
    measured: { visible: 0.971, edge: 1.42, ring: 89024, busy: 11979, near: { "caixa-clara@s4-b": -725, "estojo-de-oculos@s5-rolos": 291, "lanterna@s4-lanterna": 1454 } },
  },
  "gaita@s5-livros": {
    sprite: { sx: 783, sy: 1249, w: 98, h: 50, x: 2606, y: 1105 },
    measured: { visible: 0.807, edge: 1.65, ring: 89024, busy: 12222, near: { "caixa-clara@s4-caixa": 1421, "caixa-de-fosforos@s5-caixote": 770, "chaleira@s4-chaleira": 1228, "estojo-de-oculos@s5-rolos": 4, "lanterna@s4-lanterna": 215 } },
  },
  "garrafinha@mesinha": { sprite: { sx: 435, sy: 1096, w: 34, h: 77, x: 782, y: 1104 } },
  "garrafinha@peitoril-3": { sprite: { sx: 471, sy: 1096, w: 34, h: 77, x: 724, y: 930 } },
  "garrafinha@peitoril-5": { sprite: { sx: 507, sy: 1096, w: 34, h: 77, x: 855, y: 930 } },
  "globo@globo": {
    baked: true,
    measured: { visible: 0.99, edge: 1.35, ring: 136448, busy: 16584, near: { "caixa-de-fosforos@s5-a": 979, "caixinha-de-musica@s4-a": -118, "caixinha-de-musica@s5-a": 723, "camera@s4-a": 264, "gaita@s5-a": 1981, "lanterna@s4-a": 1912, "pena@frasco": 2151, "pena@mapa-direita": 59, "xicara@frasco": 1923 } },
  },
  "guarda-chuva@canto": {
    sprite: { sx: 2, sy: 2, w: 64, h: 257, x: 998, y: 935 },
    measured: { visible: 0.947, edge: 1.49, ring: 123552, busy: 14940, near: { "caracol@parede-direita": 383, "chapeu@pilha-livros": 534, "chave@tapete-d": 150, "garrafinha@peitoril-5": 360, "lupa@livro-esq": 294, "piao@tapete-d": 673, "relogio@livro-borda": 15, "tesoura@sob-rolo": 2, "vaso-torneado@peitoril-6": 981 } },
  },
  "guarda-chuva@poltrona": {
    sprite: { sx: 68, sy: 2, w: 64, h: 257, x: 368, y: 935 },
    measured: { visible: 0.918, edge: 1.43, ring: 123552, busy: 17156, near: { "binoculo@bau": 1738, "binoculo@peitoril-1": 2810, "chave@bau": 769, "chave@peitoril-1": 1425, "pedrinhas@poltrona-assento": 407, "tinteiros@peitoril-1": 439, "tinteiros@poltrona-assento": 692 } },
  },
  "lanterna@s4-a": {
    sprite: { sx: 130, sy: 261, w: 158, h: 209, x: 2316, y: 856 },
    measured: { visible: 0.841, edge: 1.33, ring: 126880, busy: 16109, near: { "caixa-clara@s4-caixa": 1060, "caixa-de-fosforos@s5-caixote": 960, "gaita@s5-a": 2167 } },
  },
  "lanterna@s4-lanterna": {
    sprite: { sx: 290, sy: 261, w: 157, h: 209, x: 2764, y: 856 },
    measured: { visible: 0.747, edge: 1.39, ring: 126880, busy: 17647, near: { "caixa-clara@s3-a": -455, "caixa-clara@s4-b": -1282, "caixa-de-fosforos@s4-b": 364, "caixa-escura@s3-a": -518, "caixa-escura@s3-caixa": 720, "chaleira@s4-b": 314, "chaleira@s4-chaleira": 1228, "estatueta@s3-a": 1213, "estojo-de-oculos@s5-b": 279, "estojo-de-oculos@s5-rolos": 291, "gaita@s5-b": 2004, "gaita@s5-livros": 1166 } },
  },
  "lata-redonda@chao-mesa-e": { sprite: { sx: 780, sy: 1302, w: 42, h: 44, x: 1109, y: 1377 } },
  "lata-redonda@mesa-frente-a": { sprite: { sx: 824, sy: 1302, w: 42, h: 44, x: 1639, y: 1185 } },
  "lata-redonda@mesa-frente-b": { sprite: { sx: 868, sy: 1302, w: 42, h: 44, x: 1405, y: 1165 } },
  "lupa@livro": {
    sprite: { sx: 134, sy: 2, w: 241, h: 241, x: 1200, y: 969 },
    measured: { visible: 0.993, edge: 1.77, ring: 133120, busy: 22019, near: { "bussola@mapa-borda": 1171, "bussola@tapete-mesa-a": 4, "chapeu@pilha-livros": 1413, "lata-redonda@mesa-frente-b": 419, "medalha@pilha-livros": 729, "moedas@mesa-frente-b": 425, "tesoura@mapa-fundo": 611, "tesoura@sob-rolo": 445 } },
  },
  "lupa@livro-esq": {
    sprite: { sx: 377, sy: 2, w: 241, h: 241, x: 1124, y: 949 },
    measured: { visible: 0.956, edge: 1.82, ring: 133120, busy: 17704, near: { "bussola@mapa-borda": 290, "lata-redonda@mesa-frente-b": 419, "moedas@livro-pagina": 621, "moedas@mesa-frente-b": 425, "relogio@livro-borda": 2482, "xicara@atras-livro": 1277 } },
  },
  "lupa@mapa": {
    sprite: { sx: 620, sy: 2, w: 241, h: 241, x: 1679, y: 959 },
    measured: { visible: 0.998, edge: 1.75, ring: 133120, busy: 17015, near: { "bussola@mapa-borda": 810, "carimbo@mapa-dir-fundo": 773, "carimbo@mapa-direita": 1294, "compasso-de-pontas@mapa-baixo": 687, "compasso-de-pontas@mesa-frente-a": 386, "lata-redonda@mesa-frente-a": 299, "moedas@mesa-frente-a": 408, "pena@mapa-dir-fundo": 1405, "pena@mapa-direita": 2038, "tesoura@mapa-fundo": 191, "xicara@mapa-direita": 1626 } },
  },
  "medalha@chao-mesa-e": { sprite: { sx: 642, sy: 1302, w: 44, h: 45, x: 1108, y: 1379 } },
  "medalha@pilha-livros": { sprite: { sx: 734, sy: 1302, w: 44, h: 44, x: 1178, y: 943 } },
  "medalha@tapete-mesa-d": { sprite: { sx: 688, sy: 1302, w: 44, h: 45, x: 1878, y: 1369 } },
  "moedas@livro-pagina": { sprite: { sx: 856, sy: 1353, w: 32, h: 30, x: 1404, y: 1062 } },
  "moedas@mesa-frente-a": { sprite: { sx: 890, sy: 1353, w: 32, h: 30, x: 1644, y: 1192 } },
  "moedas@mesa-frente-b": { sprite: { sx: 924, sy: 1353, w: 32, h: 30, x: 1410, y: 1180 } },
  "pandeiro@chao-estante": { sprite: { sx: 147, sy: 1096, w: 76, h: 80, x: 2699, y: 1329 } },
  "pandeiro@chao-estante-b": { sprite: { sx: 225, sy: 1096, w: 76, h: 80, x: 2903, y: 1347 } },
  "peao-de-xadrez@chao-bau-a": { sprite: { sx: 75, sy: 1179, w: 34, h: 66, x: 503, y: 1478 } },
  "peao-de-xadrez@tapete-a": { sprite: { sx: 111, sy: 1179, w: 34, h: 66, x: 722, y: 1338 } },
  "peao-de-xadrez@tapete-b": { sprite: { sx: 147, sy: 1179, w: 34, h: 65, x: 829, y: 1362 } },
  "pedrinhas@mesinha-b": { sprite: { sx: 280, sy: 1353, w: 58, h: 36, x: 683, y: 1148 } },
  "pedrinhas@peitoril-3": { sprite: { sx: 340, sy: 1353, w: 58, h: 36, x: 715, y: 972 } },
  "pedrinhas@poltrona-assento": { sprite: { sx: 400, sy: 1353, w: 58, h: 36, x: 263, y: 1076 } },
  "pena@frasco": {
    sprite: { sx: 449, sy: 261, w: 116, h: 198, x: 1986, y: 878 },
    measured: { visible: 0.999, edge: 2.93, ring: 108992, busy: 13013, near: { "carimbo@mapa-dir-fundo": 773, "carimbo@mapa-direita": 1294, "lupa@mapa": 186, "xicara@mapa-direita": 1617 } },
  },
  "pena@mapa-dir-fundo": {
    sprite: { sx: 567, sy: 261, w: 116, h: 198, x: 1851, y: 802 },
    measured: { visible: 1, edge: 2.99, ring: 108992, busy: 7023, near: { "borboleta@parede-mesa": 718, "borboleta@quadro-baixo": 1551, "folha-emoldurada@parede-mesa": 881, "folha-emoldurada@quadro-baixo": 1874, "lupa@mapa": 2574, "xicara@frasco": 1504, "xicara@mapa-direita": 1490 } },
  },
  "pena@mapa-direita": {
    sprite: { sx: 685, sy: 261, w: 116, h: 198, x: 1874, y: 900 },
    measured: { visible: 1, edge: 3.34, ring: 108992, busy: 11082, near: { "lupa@mapa": 3813, "xicara@frasco": 1919 } },
  },
  "piao@tapete-a": {
    sprite: { sx: 543, sy: 1096, w: 62, h: 75, x: 706, y: 1328 },
    measured: { visible: 0.976, edge: 2.3, ring: 89024, busy: 12973, near: { "apontador@tapete-b": 622, "apontador@tapete-c": 60, "binoculo@bau": 221, "chave@bau": 33, "peao-de-xadrez@tapete-b": 807 } },
  },
  "piao@tapete-d": {
    sprite: { sx: 607, sy: 1096, w: 62, h: 75, x: 957, y: 1268 },
    measured: { visible: 0.972, edge: 2.26, ring: 89024, busy: 11105, near: { "ampulheta@mesinha": -308, "apontador@tapete-b": 459, "apontador@tapete-c": 870, "guarda-chuva@canto": 258, "lata-redonda@chao-mesa-e": 623, "lupa@livro-esq": 73, "medalha@chao-mesa-e": 676, "peao-de-xadrez@tapete-b": 807 } },
  },
  "pinha@prateleira-1": {
    sprite: { sx: 526, sy: 905, w: 56, h: 93, x: 1190, y: 611 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 5010, near: { "abacaxi-de-madeira@prateleira-2": 581, "acucareiro@prateleira-2": 966 } },
  },
  "pinha@prateleira-2": {
    sprite: { sx: 584, sy: 905, w: 56, h: 93, x: 1278, y: 609 },
    measured: { visible: 1, edge: 1.51, ring: 86528, busy: 9930, near: { "abacaxi-de-madeira@prateleira-1": 581, "abacaxi-de-madeira@prateleira-livros": 533, "acucareiro@prateleira-1": 897, "acucareiro@prateleira-livros": 958 } },
  },
  "pinha@prateleira-livros": {
    sprite: { sx: 642, sy: 905, w: 56, h: 93, x: 1380, y: 567 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 8428, near: { "abacaxi-de-madeira@prateleira-2": 581, "acucareiro@prateleira-2": 966 } },
  },
  "pote-de-frutinhas@s2-a": { sprite: { sx: 410, sy: 905, w: 56, h: 94, x: 2532, y: 510 } },
  "pote-de-frutinhas@s2-pote": { sprite: { sx: 468, sy: 905, w: 56, h: 94, x: 2902, y: 510 } },
  "relogio@livro-borda": {
    sprite: { sx: 462, sy: 1005, w: 199, h: 88, x: 1169, y: 1138 },
    measured: { visible: 0.86, edge: 1.84, ring: 96512, busy: 22022, near: { "bussola@mapa-borda": 290, "bussola@tapete-mesa-a": 427, "compasso-de-pontas@livro-pagina": 668, "lupa@livro-esq": 1949, "moedas@livro-pagina": 621, "moedas@mesa-frente-b": 425, "tampa-de-pote@chao-mesa": 109, "tesoura@livro-pagina": 1486 } },
  },
  "relogio@tapete-mesa-a": {
    sprite: { sx: 2, sy: 905, w: 202, h: 98, x: 1289, y: 1298 },
    measured: { visible: 0.993, edge: 1.61, ring: 96512, busy: 12682, near: { "abaco@tapete-mesa-c": 719, "bussola@mapa-borda": 435, "lata-redonda@mesa-frente-b": 128, "moedas@mesa-frente-b": 425 } },
  },
  "relogio@tapete-mesa-b": {
    sprite: { sx: 206, sy: 905, w: 202, h: 98, x: 1579, y: 1298 },
    measured: { visible: 0.993, edge: 1.52, ring: 96512, busy: 10383, near: { "abaco@tapete-mesa-d": 1508, "bussola@mapa-borda": 22, "carimbo@tapete-mesa-d": 521, "compasso-de-pontas@mapa-baixo": 2, "compasso-de-pontas@mesa-frente-a": 386, "lata-redonda@mesa-frente-a": 299, "lupa@mapa": 85, "medalha@tapete-mesa-d": 494, "moedas@mesa-frente-a": 408 } },
  },
  "rolo-de-papel@s1-a": { sprite: { sx: 593, sy: 653, w: 34, h: 118, x: 2383, y: 254 } },
  "rolo-de-papel@s1-b": { sprite: { sx: 629, sy: 653, w: 34, h: 118, x: 2748, y: 254 } },
  "rolo-de-papel@s1-rolo": { sprite: { sx: 665, sy: 653, w: 34, h: 118, x: 2536, y: 254 } },
  "roseta-entalhada@roseta": { baked: true },
  "tampa-de-pote@chao-mesa": { sprite: { sx: 553, sy: 1353, w: 54, h: 33, x: 1181, y: 1298 } },
  "tampa-de-pote@tapete-mesa-a": { sprite: { sx: 609, sy: 1353, w: 54, h: 33, x: 1423, y: 1362 } },
  "tampa-de-pote@tapete-mesa-b": { sprite: { sx: 665, sy: 1353, w: 54, h: 33, x: 1713, y: 1362 } },
  "tesoura@livro-pagina": {
    sprite: { sx: 285, sy: 1179, w: 91, h: 54, x: 1374, y: 1034 },
    measured: { visible: 1, edge: 5.41, ring: 88192, busy: 17461, near: { "bussola@mapa-borda": 1394, "chapeu@pilha-livros": 55, "lata-redonda@mesa-frente-b": 419, "moedas@mesa-frente-b": 425, "relogio@livro-borda": 1569, "xicara@atras-livro": 1166 } },
  },
  "tesoura@mapa-fundo": {
    sprite: { sx: 460, sy: 1353, w: 91, h: 33, x: 1512, y: 956 },
    measured: { visible: 0.625, edge: 2.01, ring: 88192, busy: 12979, near: { "bussola@mapa-borda": 462, "compasso-de-pontas@livro-pagina": 668, "lupa@livro": 1194, "lupa@mapa": 1546, "moedas@livro-pagina": 621, "xicara@atras-livro": 1277 } },
  },
  "tesoura@sob-rolo": {
    sprite: { sx: 549, sy: 1302, w: 91, h: 45, x: 1169, y: 944 },
    measured: { visible: 0.846, edge: 1.13, ring: 88192, busy: 12886, near: { "lupa@livro": 1532 } },
  },
  "tigela-de-latao@mesinha": { sprite: { sx: 958, sy: 1353, w: 50, h: 25, x: 775, y: 1156 } },
  "tigela-de-latao@mesinha-b": { sprite: { sx: 2, sy: 1394, w: 50, h: 25, x: 685, y: 1158 } },
  "tigela-de-latao@peitoril-4": { sprite: { sx: 54, sy: 1394, w: 50, h: 25, x: 781, y: 982 } },
  "tinteiros@peitoril-1": { sprite: { sx: 814, sy: 1179, w: 64, h: 53, x: 468, y: 963 } },
  "tinteiros@peitoril-2": { sprite: { sx: 880, sy: 1179, w: 64, h: 53, x: 621, y: 955 } },
  "tinteiros@poltrona-assento": { sprite: { sx: 946, sy: 1179, w: 64, h: 53, x: 258, y: 1059 } },
  "vaso-de-porcelana@s1-a": { sprite: { sx: 336, sy: 1005, w: 40, h: 89, x: 2380, y: 283 } },
  "vaso-de-porcelana@s1-b": { sprite: { sx: 378, sy: 1005, w: 40, h: 89, x: 2745, y: 283 } },
  "vaso-de-porcelana@s1-vaso": { sprite: { sx: 420, sy: 1005, w: 40, h: 89, x: 2834, y: 283 } },
  "vaso-torneado@mesinha": { sprite: { sx: 947, sy: 485, w: 42, h: 134, x: 779, y: 1047 } },
  "vaso-torneado@peitoril-2": { sprite: { sx: 2, sy: 653, w: 42, h: 134, x: 632, y: 873 } },
  "vaso-torneado@peitoril-6": { sprite: { sx: 46, sy: 653, w: 42, h: 134, x: 911, y: 873 } },
  "xicara@atras-livro": {
    sprite: { sx: 700, sy: 905, w: 89, h: 92, x: 1387, y: 898 },
    measured: { visible: 0.538, edge: 1.75, ring: 89856, busy: 15752, near: { "bussola@mapa-borda": 428, "chapeu@pilha-livros": 16, "compasso-de-pontas@livro-pagina": 668, "lupa@livro-esq": 1961, "moedas@livro-pagina": 621, "tesoura@livro-pagina": 1486, "tesoura@mapa-fundo": 689 } },
  },
  "xicara@frasco": {
    sprite: { sx: 374, sy: 789, w: 102, h: 113, x: 1984, y: 954 },
    measured: { visible: 0.994, edge: 2.33, ring: 89856, busy: 12474, near: { "carimbo@mapa-dir-fundo": 773, "carimbo@mapa-direita": 1294, "lupa@mapa": 395, "pena@mapa-dir-fundo": 696, "pena@mapa-direita": 2321 } },
  },
  "xicara@mapa-direita": {
    sprite: { sx: 478, sy: 789, w: 102, h: 113, x: 1872, y: 976 },
    measured: { visible: 1, edge: 1.64, ring: 89856, busy: 11543, near: { "carimbo@mapa-dir-fundo": 759, "lupa@mapa": 4021, "pena@frasco": 1999, "pena@mapa-dir-fundo": 515 } },
  },
};
