# Estúdio do Explorador — referência e revisão (Game 03)

Material da primeira cena do Estúdio das Descobertas (`hidden-objects`). Nada
aqui é runtime: não importe nem sirva estes arquivos. A arte que o jogo carrega
fica em `public/assets/hidden-objects/explorer-studio/v0/`.

## `reference/`

`mockup-conceitual.webp` (1672×941) é o mockup conceitual enviado com a missão
GAME03-SKELETON-01. Ele define atmosfera, direção visual, densidade, sensação de
descoberta, composição, a ideia de câmera e a relação cena/HUD.

Ele **não** é screenshot final, contrato pixel a pixel, asset garantido nem
justificativa para 3D. Tem HUD e textos desenhados dentro da imagem, então não
serve como prancha de jogo. O skeleton persegue a experiência, não o
acabamento.

## `review/`

Pranchas de revisão geradas por `tools/assets/create_hidden_objects_scene.mjs`
junto com a arte de runtime (mesma execução, determinística):

| Arquivo | O que mostra |
| --- | --- |
| `scene.webp` | a cena composta (janela + prancha + primeiro plano), metade do tamanho |
| `regions.webp` | a cena com as formas de hit dos 10 alvos, as margens de segurança, as faixas das estações e as áreas pintadas do primeiro plano |
| `scene-grayscale.webp` | a cena em tons de cinza: nenhum alvo depende só de cor |

Elas servem para a revisão de fairness feita por gente (reconhecível,
inequívoco, sem iscas); a parte geométrica é verificada por
`tools/validation/hidden-objects-skeleton-tests.mjs` (H27).
