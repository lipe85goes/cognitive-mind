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
    measured: { visible: 0.953, edge: 1.77, ring: 126880, busy: 16745, near: { "caracol@lambri-a": 1483, "caracol@lambri-b": 197, "chave@tapete-d": 67, "garrafinha@peitoril-3": 48, "garrafinha@peitoril-5": 312, "pedrinhas@mesinha-b": 180, "pedrinhas@peitoril-3": 66, "piao@tapete-d": 44, "tigela-de-latao@mesinha-b": 210, "tinteiros@peitoril-2": 608, "vaso-torneado@peitoril-2": 966, "vaso-torneado@peitoril-6": 1015 } },
  },
  "ampulheta@peitoril-34": {
    sprite: { sx: 2, sy: 261, w: 126, h: 222, x: 711, y: 783 },
    measured: { visible: 0.896, edge: 1.71, ring: 126880, busy: 16229, near: { "caracol@lambri-a": 1736, "garrafinha@mesinha": 119, "garrafinha@peitoril-5": 588, "tinteiros@peitoril-2": 608, "vaso-torneado@mesinha": 841, "vaso-torneado@peitoril-2": 966, "vaso-torneado@peitoril-6": 1016 } },
  },
  "apito@gaveta-a": {
    sprite: { sx: 313, sy: 1302, w: 84, h: 49, x: 753, y: 1219 },
    measured: { visible: 0.742, edge: 1.78, ring: 89440, busy: 14074, near: { "ampulheta@mesinha": 2189, "caracol@lambri-a": 482, "caracol@lambri-b": 135, "chave@tapete-d": 376, "garrafinha@mesinha": 564, "peao-de-xadrez@tapete-a": 456, "peao-de-xadrez@tapete-b": 396, "pedrinhas@mesinha-b": 242, "piao@tapete-a": 1165, "piao@tapete-d": 183, "tigela-de-latao@mesinha": 436, "tigela-de-latao@mesinha-b": 285, "vaso-torneado@mesinha": 797 } },
  },
  "apito@gaveta-b": {
    sprite: { sx: 220, sy: 1302, w: 91, h: 49, x: 737, y: 1219 },
    measured: { visible: 0.912, edge: 1.78, ring: 89440, busy: 14337, near: { "ampulheta@mesinha": 2189, "caracol@lambri-a": 620, "caracol@lambri-b": 305, "chave@tapete-d": 277, "garrafinha@mesinha": 564, "peao-de-xadrez@tapete-a": 456, "peao-de-xadrez@tapete-b": 396, "pedrinhas@mesinha-b": 242, "piao@tapete-a": 1165, "piao@tapete-d": 34, "tigela-de-latao@mesinha": 436, "tigela-de-latao@mesinha-b": 285, "vaso-torneado@mesinha": 797 } },
  },
  "apontador@chao-bau-b": { sprite: { sx: 158, sy: 1394, w: 57, h: 21, x: 621, y: 1531 } },
  "apontador@tapete-b": { sprite: { sx: 276, sy: 1394, w: 57, h: 20, x: 817, y: 1407 } },
  "apontador@tapete-c": { sprite: { sx: 217, sy: 1394, w: 57, h: 21, x: 896, y: 1393 } },
  "barco@s3-barco": {
    baked: true,
    measured: { visible: 0.948, edge: 2.06, ring: 161616, busy: 28079, near: { "caixa-clara@s3-a": -183, "caixa-escura@s3-a": -225, "caixinha-de-musica@s2-pilha": 694, "camera@s2-a": 1986, "camera@s2-camera": 541, "estatueta@s3-a": 830, "lanterna@s4-a": 1516, "pote-de-frutinhas@s2-a": 311 } },
  },
  "binoculo@bau": {
    sprite: { sx: 801, sy: 1005, w: 149, h: 81, x: 442, y: 1223 },
    measured: { visible: 0.899, edge: 1.37, ring: 104416, busy: 12900, near: { "caracol@lambri-a": 388, "caracol@lambri-b": 1566, "guarda-chuva@poltrona": 631, "pedrinhas@mesinha-b": 108, "piao@tapete-a": 130, "tigela-de-latao@mesinha-b": 143 } },
  },
  "binoculo@peitoril-1": {
    sprite: { sx: 2, sy: 1096, w: 143, h: 81, x: 424, y: 929 },
    measured: { visible: 0.846, edge: 1.32, ring: 104416, busy: 14136, near: { "caracol@lambri-a": 1736, "caracol@lambri-b": 121, "guarda-chuva@poltrona": 1824, "pedrinhas@poltrona-assento": 101, "tinteiros@peitoril-2": 608, "tinteiros@poltrona-assento": 87, "vaso-torneado@peitoril-2": 966 } },
  },
  "bolsa@gancho": {
    baked: true,
    measured: { visible: 0.99, edge: 2.25, ring: 101504, busy: 6527, near: { "borboleta@quadro-baixo": 1129, "caixinha-de-musica@s2-pilha": 633, "chapeu@cabide": 784, "folha-emoldurada@quadro-baixo": 1927 } },
  },
  "borboleta@parede-mesa": {
    sprite: { sx: 446, sy: 485, w: 134, h: 150, x: 1653, y: 607 },
    measured: { visible: 1, edge: 1.41, ring: 104000, busy: 6003, near: {  } },
  },
  "borboleta@quadro-alto": {
    sprite: { sx: 582, sy: 485, w: 134, h: 150, x: 1917, y: 317 },
    measured: { visible: 1, edge: 1.32, ring: 104000, busy: 7056, near: { "chapeu@cabide": 1078 } },
  },
  "borboleta@quadro-baixo": {
    sprite: { sx: 718, sy: 485, w: 134, h: 150, x: 1941, y: 597 },
    measured: { visible: 1, edge: 1.38, ring: 104000, busy: 1946, near: { "chapeu@cabide": 591, "pena@mapa-dir-fundo": 512 } },
  },
  "bussola@mapa-borda": {
    sprite: { sx: 90, sy: 653, w: 116, h: 130, x: 1482, y: 1092 },
    measured: { visible: 0.878, edge: 1.97, ring: 111488, busy: 19595, near: { "compasso-de-pontas@livro-pagina": 670, "compasso-de-pontas@mapa-baixo": 683, "compasso-de-pontas@mesa-frente-a": 380, "lata-redonda@mesa-frente-a": 235, "lupa@livro": 1516, "lupa@livro-esq": 172, "lupa@mapa": 1539, "moedas@livro-pagina": 617, "moedas@mesa-frente-a": 414, "moedas@mesa-frente-b": 432, "relogio@livro-borda": 180, "relogio@tapete-mesa-a": 1233, "relogio@tapete-mesa-b": 954, "tesoura@livro-pagina": 1489, "tesoura@mapa-fundo": 439, "xicara@atras-livro": 305 } },
  },
  "bussola@tapete-mesa-a": {
    sprite: { sx: 208, sy: 653, w: 116, h: 130, x: 1392, y: 1262 },
    measured: { visible: 0.991, edge: 1.49, ring: 111488, busy: 13596, near: { "abaco@tapete-mesa-c": 1442, "lata-redonda@mesa-frente-b": 433, "lupa@livro": 122, "moedas@mesa-frente-b": 432, "relogio@livro-borda": 1464, "relogio@tapete-mesa-b": 504 } },
  },
  "caixa-clara@s3-a": { sprite: { sx: 582, sy: 789, w: 136, h: 102, x: 2702, y: 734 } },
  "caixa-clara@s4-b": { sprite: { sx: 720, sy: 789, w: 136, h: 102, x: 2912, y: 964 } },
  "caixa-clara@s4-caixa": { sprite: { sx: 858, sy: 789, w: 136, h: 102, x: 2507, y: 964 } },
  "caixa-de-fosforos@s4-b": { sprite: { sx: 819, sy: 1302, w: 67, h: 39, x: 2943, y: 1027 } },
  "caixa-de-fosforos@s5-a": { sprite: { sx: 888, sy: 1302, w: 67, h: 39, x: 2340, y: 1087 } },
  "caixa-de-fosforos@s5-caixote": { sprite: { sx: 2, sy: 1353, w: 67, h: 39, x: 2469, y: 1107 } },
  "caixa-escura@s3-a": { sprite: { sx: 791, sy: 905, w: 136, h: 89, x: 2701, y: 747 } },
  "caixa-escura@s3-caixa": { sprite: { sx: 2, sy: 1005, w: 136, h: 89, x: 2917, y: 747 } },
  "caixinha-de-musica@s2-pilha": { sprite: { sx: 883, sy: 1249, w: 107, h: 49, x: 2303, y: 479 } },
  "caixinha-de-musica@s4-a": { sprite: { sx: 2, sy: 1302, w: 107, h: 49, x: 2343, y: 1017 } },
  "caixinha-de-musica@s5-a": { sprite: { sx: 111, sy: 1302, w: 107, h: 49, x: 2325, y: 1077 } },
  "camera@s2-a": {
    sprite: { sx: 793, sy: 653, w: 184, h: 114, x: 2468, y: 495 },
    measured: { visible: 0.978, edge: 1.78, ring: 115648, busy: 23314, near: { "caixinha-de-musica@s2-pilha": 531, "estatueta@s1-a": -28, "estatueta@s1-estatueta": 224, "rolo-de-papel@s1-a": 58, "rolo-de-papel@s1-b": 19, "rolo-de-papel@s1-rolo": 126, "vaso-de-porcelana@s1-a": 69, "vaso-de-porcelana@s1-b": 18 } },
  },
  "camera@s2-camera": {
    sprite: { sx: 2, sy: 789, w: 184, h: 114, x: 2711, y: 493 },
    measured: { visible: 0.837, edge: 2.99, ring: 115648, busy: 19279, near: { "estatueta@s1-estatueta": 237, "estatueta@s3-a": 47, "pote-de-frutinhas@s2-pote": 1198, "rolo-de-papel@s1-b": 75, "vaso-de-porcelana@s1-b": 67, "vaso-de-porcelana@s1-vaso": 108 } },
  },
  "camera@s4-a": {
    sprite: { sx: 188, sy: 789, w: 184, h: 114, x: 2303, y: 955 },
    measured: { visible: 0.804, edge: 1.47, ring: 115648, busy: 14705, near: { "caixa-clara@s4-caixa": 1285, "caixa-de-fosforos@s5-caixote": 916, "gaita@s5-a": 2198 } },
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
    measured: { visible: 0.793, edge: 2.02, ring: 87360, busy: 11421, near: { "ampulheta@mesinha": 3877, "ampulheta@peitoril-34": 1673, "binoculo@bau": 246, "binoculo@peitoril-1": 1703, "chave@peitoril-1": 768, "garrafinha@mesinha": 348, "garrafinha@peitoril-3": 552, "pedrinhas@mesinha-b": 242, "pedrinhas@peitoril-3": 376, "tigela-de-latao@mesinha": 307, "tigela-de-latao@mesinha-b": 285, "tigela-de-latao@peitoril-4": 202, "tinteiros@peitoril-1": 301, "tinteiros@peitoril-2": 608, "vaso-torneado@mesinha": 1124, "vaso-torneado@peitoril-2": 457 } },
  },
  "caracol@lambri-b": {
    sprite: { sx: 466, sy: 1179, w: 86, h: 54, x: 549, y: 1123 },
    measured: { visible: 0.897, edge: 1.92, ring: 87360, busy: 14441, near: { "ampulheta@mesinha": 763, "ampulheta@peitoril-34": 6, "binoculo@bau": 2570, "binoculo@peitoril-1": 156, "chave@bau": 1273, "chave@peitoril-1": 6, "garrafinha@peitoril-3": 32, "guarda-chuva@poltrona": -7, "pedrinhas@mesinha-b": 242, "pedrinhas@peitoril-3": 79, "tigela-de-latao@mesinha-b": 285, "tinteiros@peitoril-1": 213, "tinteiros@peitoril-2": 99, "vaso-torneado@peitoril-2": 53 } },
  },
  "caracol@parede-direita": {
    sprite: { sx: 554, sy: 1179, w: 86, h: 54, x: 964, y: 763 },
    measured: { visible: 0.984, edge: 1.42, ring: 87360, busy: 6686, near: { "chapeu@pilha-livros": 39, "garrafinha@peitoril-5": 64, "guarda-chuva@canto": 58, "vaso-torneado@peitoril-6": 646 } },
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
    measured: { visible: 1, edge: 1.91, ring: 96096, busy: 3583, near: { "borboleta@quadro-alto": 4727, "borboleta@quadro-baixo": 883, "caixinha-de-musica@s2-pilha": 135, "folha-emoldurada@quadro-baixo": 1412 } },
  },
  "chapeu@pilha-livros": {
    sprite: { sx: 671, sy: 1096, w: 130, h: 74, x: 1137, y: 919 },
    measured: { visible: 0.99, edge: 2.78, ring: 96096, busy: 13265, near: { "caracol@parede-direita": 190, "guarda-chuva@canto": 2325, "lupa@livro": 1107, "tesoura@livro-pagina": 169 } },
  },
  "chave@bau": {
    sprite: { sx: 200, sy: 1249, w: 128, h: 50, x: 454, y: 1249 },
    measured: { visible: 0.707, edge: 1.67, ring: 95680, busy: 12716, near: { "caracol@lambri-b": 1503, "guarda-chuva@poltrona": 370, "pedrinhas@mesinha-b": 37, "tigela-de-latao@mesinha-b": 83 } },
  },
  "chave@peitoril-1": {
    sprite: { sx: 460, sy: 1249, w: 121, h: 50, x: 436, y: 955 },
    measured: { visible: 0.933, edge: 1.68, ring: 95680, busy: 13557, near: { "caracol@lambri-a": 1736, "caracol@lambri-b": 121, "guarda-chuva@poltrona": 2017, "pedrinhas@poltrona-assento": 40, "tinteiros@peitoril-2": 608, "tinteiros@poltrona-assento": 56, "vaso-torneado@peitoril-2": 966 } },
  },
  "chave@tapete-d": {
    sprite: { sx: 330, sy: 1249, w: 128, h: 50, x: 926, y: 1287 },
    measured: { visible: 0.96, edge: 1.4, ring: 95680, busy: 10829, near: { "ampulheta@mesinha": -14, "apontador@tapete-b": 602, "apontador@tapete-c": 865, "garrafinha@mesinha": 64, "guarda-chuva@canto": 103, "lata-redonda@chao-mesa-e": 643, "lupa@livro-esq": -30, "medalha@chao-mesa-e": 617, "peao-de-xadrez@tapete-b": 806, "relogio@livro-borda": 77, "tigela-de-latao@mesinha": 132, "vaso-torneado@mesinha": 89 } },
  },
  "colar@caixinha-a": {
    sprite: { sx: 642, sy: 1179, w: 84, h: 54, x: 1908, y: 1129 },
    measured: { visible: 0.786, edge: 3.15, ring: 87776, busy: 9823, near: { "carimbo@mapa-direita": 1231, "lupa@mapa": 2808, "pena@frasco": 556, "pena@mapa-direita": 1063, "xicara@frasco": 1407, "xicara@mapa-direita": 1485 } },
  },
  "colar@caixinha-b": {
    sprite: { sx: 728, sy: 1179, w: 84, h: 54, x: 1912, y: 1129 },
    measured: { visible: 0.691, edge: 3.15, ring: 87776, busy: 9913, near: { "carimbo@mapa-direita": 1231, "lupa@mapa": 2739, "pena@frasco": 556, "pena@mapa-direita": 1063, "xicara@frasco": 1407, "xicara@mapa-direita": 1485 } },
  },
  "compasso-de-pontas@livro-pagina": { sprite: { sx: 745, sy: 1353, w: 43, h: 32, x: 1398, y: 1058 } },
  "compasso-de-pontas@mapa-baixo": { sprite: { sx: 790, sy: 1353, w: 43, h: 32, x: 1642, y: 1148 } },
  "compasso-de-pontas@mesa-frente-a": { sprite: { sx: 835, sy: 1353, w: 43, h: 32, x: 1638, y: 1191 } },
  "estatueta@s1-a": {
    sprite: { sx: 326, sy: 653, w: 94, h: 124, x: 2353, y: 253 },
    measured: { visible: 0.989, edge: 2.46, ring: 99424, busy: 13413, near: { "caixinha-de-musica@s2-pilha": 258, "rolo-de-papel@s1-rolo": 1212 } },
  },
  "estatueta@s1-estatueta": {
    sprite: { sx: 518, sy: 653, w: 73, h: 124, x: 2631, y: 250 },
    measured: { visible: 0.754, edge: 2.94, ring: 99424, busy: 13564, near: { "rolo-de-papel@s1-b": 729, "rolo-de-papel@s1-rolo": 1540, "vaso-de-porcelana@s1-b": 313 } },
  },
  "estatueta@s3-a": {
    sprite: { sx: 422, sy: 653, w: 94, h: 124, x: 2723, y: 713 },
    measured: { visible: 0.998, edge: 2.4, ring: 99424, busy: 11743, near: { "caixa-escura@s3-caixa": 51, "camera@s2-a": 19, "camera@s2-camera": 224, "chaleira@s2-pote": 65, "lanterna@s4-lanterna": 2838, "pote-de-frutinhas@s2-pote": 20 } },
  },
  "estojo-de-oculos@s5-b": { sprite: { sx: 71, sy: 1353, w: 68, h: 37, x: 2951, y: 1099 } },
  "estojo-de-oculos@s5-rolos": { sprite: { sx: 141, sy: 1353, w: 68, h: 37, x: 2821, y: 1099 } },
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
    measured: { visible: 1, edge: 1.34, ring: 101920, busy: 9095, near: { "cesta-de-arame@suporte": 316 } },
  },
  "gaiola@varao-b": {
    sprite: { sx: 875, sy: 261, w: 70, h: 187, x: 465, y: 174 },
    measured: { visible: 0.979, edge: 2.19, ring: 101920, busy: 12778, near: {  } },
  },
  "gaita@s5-a": {
    sprite: { sx: 583, sy: 1249, w: 98, h: 50, x: 2329, y: 1071 },
    measured: { visible: 0.971, edge: 1.48, ring: 89024, busy: 15539, near: { "caixa-clara@s4-caixa": 707, "caixa-de-fosforos@s5-caixote": 916, "camera@s4-a": 655, "lanterna@s4-a": 1313 } },
  },
  "gaita@s5-b": {
    sprite: { sx: 683, sy: 1249, w: 98, h: 50, x: 2937, y: 1081 },
    measured: { visible: 0.971, edge: 1.42, ring: 89024, busy: 11979, near: { "caixa-clara@s4-b": -758, "estojo-de-oculos@s5-rolos": 323, "lanterna@s4-lanterna": 1447 } },
  },
  "gaita@s5-livros": {
    sprite: { sx: 783, sy: 1249, w: 98, h: 50, x: 2606, y: 1105 },
    measured: { visible: 0.807, edge: 1.65, ring: 89024, busy: 12222, near: { "caixa-clara@s4-caixa": 1466, "caixa-de-fosforos@s5-caixote": 725, "chaleira@s4-chaleira": 1241, "estojo-de-oculos@s5-rolos": 19, "lanterna@s4-lanterna": 214 } },
  },
  "garrafinha@mesinha": { sprite: { sx: 435, sy: 1096, w: 34, h: 77, x: 782, y: 1104 } },
  "garrafinha@peitoril-3": { sprite: { sx: 471, sy: 1096, w: 34, h: 77, x: 724, y: 930 } },
  "garrafinha@peitoril-5": { sprite: { sx: 507, sy: 1096, w: 34, h: 77, x: 855, y: 930 } },
  "globo@globo": {
    baked: true,
    measured: { visible: 0.99, edge: 1.35, ring: 136448, busy: 16584, near: { "caixa-de-fosforos@s5-a": 962, "caixinha-de-musica@s4-a": -154, "caixinha-de-musica@s5-a": 676, "camera@s4-a": 315, "gaita@s5-a": 2014, "lanterna@s4-a": 1907, "pena@frasco": 2161, "pena@mapa-direita": 59, "xicara@frasco": 1926 } },
  },
  "guarda-chuva@canto": {
    sprite: { sx: 2, sy: 2, w: 64, h: 257, x: 998, y: 935 },
    measured: { visible: 0.947, edge: 1.49, ring: 123552, busy: 14940, near: { "caracol@parede-direita": 378, "chapeu@pilha-livros": 535, "chave@tapete-d": 167, "garrafinha@peitoril-5": 359, "lupa@livro-esq": 267, "piao@tapete-d": 687, "relogio@livro-borda": 15, "vaso-torneado@peitoril-6": 1015 } },
  },
  "guarda-chuva@poltrona": {
    sprite: { sx: 68, sy: 2, w: 64, h: 257, x: 368, y: 935 },
    measured: { visible: 0.918, edge: 1.43, ring: 123552, busy: 17156, near: { "binoculo@bau": 1718, "binoculo@peitoril-1": 2810, "chave@bau": 771, "chave@peitoril-1": 1416, "pedrinhas@poltrona-assento": 402, "tinteiros@peitoril-1": 444, "tinteiros@poltrona-assento": 696 } },
  },
  "lanterna@s4-a": {
    sprite: { sx: 130, sy: 261, w: 158, h: 209, x: 2316, y: 856 },
    measured: { visible: 0.841, edge: 1.33, ring: 126880, busy: 16110, near: { "caixa-clara@s4-caixa": 1070, "caixa-de-fosforos@s5-caixote": 916, "gaita@s5-a": 2198 } },
  },
  "lanterna@s4-lanterna": {
    sprite: { sx: 290, sy: 261, w: 157, h: 209, x: 2764, y: 856 },
    measured: { visible: 0.747, edge: 1.39, ring: 126880, busy: 17647, near: { "caixa-clara@s3-a": -445, "caixa-clara@s4-b": -1278, "caixa-de-fosforos@s4-b": 422, "caixa-escura@s3-a": -490, "caixa-escura@s3-caixa": 706, "chaleira@s4-b": 312, "chaleira@s4-chaleira": 1241, "estatueta@s3-a": 1229, "estojo-de-oculos@s5-b": 279, "estojo-de-oculos@s5-rolos": 323, "gaita@s5-b": 1965, "gaita@s5-livros": 1182 } },
  },
  "lata-redonda@chao-mesa-e": { sprite: { sx: 687, sy: 1302, w: 42, h: 44, x: 1109, y: 1377 } },
  "lata-redonda@mesa-frente-a": { sprite: { sx: 731, sy: 1302, w: 42, h: 44, x: 1639, y: 1185 } },
  "lata-redonda@mesa-frente-b": { sprite: { sx: 775, sy: 1302, w: 42, h: 44, x: 1405, y: 1165 } },
  "lupa@livro": {
    sprite: { sx: 134, sy: 2, w: 241, h: 241, x: 1200, y: 969 },
    measured: { visible: 0.993, edge: 1.77, ring: 133120, busy: 22020, near: { "bussola@mapa-borda": 1378, "bussola@tapete-mesa-a": 4, "chapeu@pilha-livros": 1403, "lata-redonda@mesa-frente-b": 433, "medalha@pilha-livros": 712, "moedas@mesa-frente-b": 432, "tesoura@mapa-fundo": 607 } },
  },
  "lupa@livro-esq": {
    sprite: { sx: 377, sy: 2, w: 241, h: 241, x: 1124, y: 949 },
    measured: { visible: 0.956, edge: 1.84, ring: 133120, busy: 17677, near: { "bussola@mapa-borda": 279, "lata-redonda@mesa-frente-b": 433, "moedas@livro-pagina": 617, "moedas@mesa-frente-b": 432, "relogio@livro-borda": 2354, "xicara@atras-livro": 1271 } },
  },
  "lupa@mapa": {
    sprite: { sx: 620, sy: 2, w: 241, h: 241, x: 1679, y: 959 },
    measured: { visible: 0.998, edge: 1.75, ring: 133120, busy: 17021, near: { "bussola@mapa-borda": 832, "carimbo@mapa-dir-fundo": 756, "carimbo@mapa-direita": 1275, "compasso-de-pontas@mapa-baixo": 683, "compasso-de-pontas@mesa-frente-a": 380, "lata-redonda@mesa-frente-a": 235, "moedas@mesa-frente-a": 414, "pena@mapa-dir-fundo": 1401, "pena@mapa-direita": 2061, "tesoura@mapa-fundo": 190, "tesoura@mapa-fundo-b": 271, "xicara@mapa-direita": 1626 } },
  },
  "medalha@chao-mesa-e": { sprite: { sx: 549, sy: 1302, w: 44, h: 45, x: 1108, y: 1379 } },
  "medalha@pilha-livros": { sprite: { sx: 641, sy: 1302, w: 44, h: 44, x: 1178, y: 943 } },
  "medalha@tapete-mesa-d": { sprite: { sx: 595, sy: 1302, w: 44, h: 45, x: 1878, y: 1369 } },
  "moedas@livro-pagina": { sprite: { sx: 880, sy: 1353, w: 32, h: 30, x: 1404, y: 1062 } },
  "moedas@mesa-frente-a": { sprite: { sx: 914, sy: 1353, w: 32, h: 30, x: 1644, y: 1192 } },
  "moedas@mesa-frente-b": { sprite: { sx: 948, sy: 1353, w: 32, h: 30, x: 1410, y: 1180 } },
  "pandeiro@chao-estante": { sprite: { sx: 147, sy: 1096, w: 76, h: 80, x: 2699, y: 1329 } },
  "pandeiro@chao-estante-b": { sprite: { sx: 225, sy: 1096, w: 76, h: 80, x: 2903, y: 1347 } },
  "peao-de-xadrez@chao-bau-a": { sprite: { sx: 75, sy: 1179, w: 34, h: 66, x: 503, y: 1478 } },
  "peao-de-xadrez@tapete-a": { sprite: { sx: 111, sy: 1179, w: 34, h: 66, x: 722, y: 1338 } },
  "peao-de-xadrez@tapete-b": { sprite: { sx: 147, sy: 1179, w: 34, h: 65, x: 829, y: 1362 } },
  "pedrinhas@mesinha-b": { sprite: { sx: 211, sy: 1353, w: 58, h: 36, x: 683, y: 1148 } },
  "pedrinhas@peitoril-3": { sprite: { sx: 271, sy: 1353, w: 58, h: 36, x: 715, y: 972 } },
  "pedrinhas@poltrona-assento": { sprite: { sx: 331, sy: 1353, w: 58, h: 36, x: 263, y: 1076 } },
  "pena@frasco": {
    sprite: { sx: 449, sy: 261, w: 116, h: 198, x: 1986, y: 878 },
    measured: { visible: 0.999, edge: 2.93, ring: 108992, busy: 13013, near: { "carimbo@mapa-dir-fundo": 756, "carimbo@mapa-direita": 1275, "lupa@mapa": 194, "tesoura@mapa-fundo-b": 278, "xicara@mapa-direita": 1620 } },
  },
  "pena@mapa-dir-fundo": {
    sprite: { sx: 567, sy: 261, w: 116, h: 198, x: 1851, y: 802 },
    measured: { visible: 1, edge: 3, ring: 108992, busy: 7025, near: { "borboleta@parede-mesa": 692, "borboleta@quadro-baixo": 1561, "folha-emoldurada@parede-mesa": 890, "folha-emoldurada@quadro-baixo": 1876, "lupa@mapa": 2567, "xicara@frasco": 1504, "xicara@mapa-direita": 1496 } },
  },
  "pena@mapa-direita": {
    sprite: { sx: 685, sy: 261, w: 116, h: 198, x: 1874, y: 900 },
    measured: { visible: 1, edge: 3.33, ring: 108992, busy: 11080, near: { "lupa@mapa": 3820, "xicara@frasco": 1922 } },
  },
  "piao@tapete-a": {
    sprite: { sx: 543, sy: 1096, w: 62, h: 75, x: 706, y: 1328 },
    measured: { visible: 0.976, edge: 2.3, ring: 89024, busy: 12973, near: { "apontador@tapete-b": 602, "apontador@tapete-c": 62, "binoculo@bau": 220, "chave@bau": 32, "peao-de-xadrez@tapete-b": 806 } },
  },
  "piao@tapete-d": {
    sprite: { sx: 607, sy: 1096, w: 62, h: 75, x: 957, y: 1268 },
    measured: { visible: 0.972, edge: 2.26, ring: 89024, busy: 11105, near: { "ampulheta@mesinha": -319, "apontador@tapete-b": 448, "apontador@tapete-c": 865, "guarda-chuva@canto": 254, "lata-redonda@chao-mesa-e": 631, "lupa@livro-esq": 61, "medalha@chao-mesa-e": 617, "peao-de-xadrez@tapete-b": 806 } },
  },
  "pinha@prateleira-1": {
    sprite: { sx: 526, sy: 905, w: 56, h: 93, x: 1190, y: 611 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 5010, near: { "abacaxi-de-madeira@prateleira-2": 571, "acucareiro@prateleira-2": 972 } },
  },
  "pinha@prateleira-2": {
    sprite: { sx: 584, sy: 905, w: 56, h: 93, x: 1278, y: 609 },
    measured: { visible: 1, edge: 1.51, ring: 86528, busy: 9930, near: { "abacaxi-de-madeira@prateleira-1": 546, "abacaxi-de-madeira@prateleira-livros": 548, "acucareiro@prateleira-1": 879, "acucareiro@prateleira-livros": 961 } },
  },
  "pinha@prateleira-livros": {
    sprite: { sx: 642, sy: 905, w: 56, h: 93, x: 1380, y: 567 },
    measured: { visible: 1, edge: 1.53, ring: 86528, busy: 8428, near: { "abacaxi-de-madeira@prateleira-2": 571, "acucareiro@prateleira-2": 972 } },
  },
  "pote-de-frutinhas@s2-a": { sprite: { sx: 410, sy: 905, w: 56, h: 94, x: 2532, y: 510 } },
  "pote-de-frutinhas@s2-pote": { sprite: { sx: 468, sy: 905, w: 56, h: 94, x: 2902, y: 510 } },
  "relogio@livro-borda": {
    sprite: { sx: 462, sy: 1005, w: 199, h: 88, x: 1169, y: 1138 },
    measured: { visible: 0.86, edge: 1.63, ring: 96512, busy: 21999, near: { "bussola@mapa-borda": 275, "bussola@tapete-mesa-a": 405, "compasso-de-pontas@livro-pagina": 670, "lupa@livro-esq": 1938, "moedas@livro-pagina": 617, "moedas@mesa-frente-b": 432, "tampa-de-pote@chao-mesa": 100, "tesoura@livro-pagina": 1489 } },
  },
  "relogio@tapete-mesa-a": {
    sprite: { sx: 2, sy: 905, w: 202, h: 98, x: 1289, y: 1298 },
    measured: { visible: 0.993, edge: 1.61, ring: 96512, busy: 12682, near: { "abaco@tapete-mesa-c": 722, "bussola@mapa-borda": 460, "lata-redonda@mesa-frente-b": 139, "moedas@mesa-frente-b": 432 } },
  },
  "relogio@tapete-mesa-b": {
    sprite: { sx: 206, sy: 905, w: 202, h: 98, x: 1579, y: 1298 },
    measured: { visible: 0.993, edge: 1.51, ring: 96512, busy: 10385, near: { "abaco@tapete-mesa-d": 1522, "bussola@mapa-borda": 32, "carimbo@tapete-mesa-d": 538, "compasso-de-pontas@mapa-baixo": 2, "compasso-de-pontas@mesa-frente-a": 380, "lata-redonda@mesa-frente-a": 235, "lupa@mapa": 88, "medalha@tapete-mesa-d": 479, "moedas@mesa-frente-a": 414 } },
  },
  "rolo-de-papel@s1-a": { sprite: { sx: 593, sy: 653, w: 34, h: 118, x: 2383, y: 254 } },
  "rolo-de-papel@s1-b": { sprite: { sx: 629, sy: 653, w: 34, h: 118, x: 2748, y: 254 } },
  "rolo-de-papel@s1-rolo": { sprite: { sx: 665, sy: 653, w: 34, h: 118, x: 2536, y: 254 } },
  "roseta-entalhada@roseta": { baked: true },
  "tampa-de-pote@chao-mesa": { sprite: { sx: 577, sy: 1353, w: 54, h: 33, x: 1181, y: 1298 } },
  "tampa-de-pote@tapete-mesa-a": { sprite: { sx: 633, sy: 1353, w: 54, h: 33, x: 1423, y: 1362 } },
  "tampa-de-pote@tapete-mesa-b": { sprite: { sx: 689, sy: 1353, w: 54, h: 33, x: 1713, y: 1362 } },
  "tesoura@livro-pagina": {
    sprite: { sx: 285, sy: 1179, w: 91, h: 54, x: 1374, y: 1034 },
    measured: { visible: 1, edge: 5.42, ring: 88192, busy: 17461, near: { "bussola@mapa-borda": 1614, "chapeu@pilha-livros": 55, "lata-redonda@mesa-frente-b": 433, "moedas@mesa-frente-b": 432, "relogio@livro-borda": 1446, "xicara@atras-livro": 1159 } },
  },
  "tesoura@mapa-fundo": {
    sprite: { sx: 391, sy: 1353, w: 91, h: 33, x: 1512, y: 956 },
    measured: { visible: 0.625, edge: 2, ring: 88192, busy: 12979, near: { "bussola@mapa-borda": 548, "compasso-de-pontas@livro-pagina": 670, "lupa@livro": 1186, "lupa@mapa": 1521, "moedas@livro-pagina": 617, "xicara@atras-livro": 1271 } },
  },
  "tesoura@mapa-fundo-b": {
    sprite: { sx: 484, sy: 1353, w: 91, h: 33, x: 1884, y: 942 },
    measured: { visible: 0.651, edge: 1.41, ring: 88192, busy: 7878, near: { "lupa@mapa": 2645, "pena@frasco": 2316, "xicara@frasco": 1926, "xicara@mapa-direita": 1449 } },
  },
  "tigela-de-latao@mesinha": { sprite: { sx: 2, sy: 1394, w: 50, h: 25, x: 775, y: 1156 } },
  "tigela-de-latao@mesinha-b": { sprite: { sx: 54, sy: 1394, w: 50, h: 25, x: 685, y: 1158 } },
  "tigela-de-latao@peitoril-4": { sprite: { sx: 106, sy: 1394, w: 50, h: 25, x: 781, y: 982 } },
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
    measured: { visible: 0.538, edge: 1.75, ring: 89856, busy: 15752, near: { "bussola@mapa-borda": 508, "chapeu@pilha-livros": 16, "compasso-de-pontas@livro-pagina": 670, "lupa@livro-esq": 1965, "moedas@livro-pagina": 617, "tesoura@livro-pagina": 1489, "tesoura@mapa-fundo": 685 } },
  },
  "xicara@frasco": {
    sprite: { sx: 374, sy: 789, w: 102, h: 113, x: 1984, y: 954 },
    measured: { visible: 0.994, edge: 2.33, ring: 89856, busy: 12474, near: { "carimbo@mapa-dir-fundo": 756, "carimbo@mapa-direita": 1275, "lupa@mapa": 395, "pena@mapa-dir-fundo": 687, "pena@mapa-direita": 2343, "tesoura@mapa-fundo-b": 278 } },
  },
  "xicara@mapa-direita": {
    sprite: { sx: 478, sy: 789, w: 102, h: 113, x: 1872, y: 976 },
    measured: { visible: 1, edge: 1.64, ring: 89856, busy: 11540, near: { "carimbo@mapa-dir-fundo": 740, "lupa@mapa": 4027, "pena@frasco": 2004, "pena@mapa-dir-fundo": 511, "tesoura@mapa-fundo-b": 278 } },
  },
};
