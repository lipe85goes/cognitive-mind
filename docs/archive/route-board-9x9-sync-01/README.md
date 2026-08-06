# Route Board 9x9 Sync 01 - o tabuleiro físico alcança o grid lógico

Material de aceitacao da `ROTA-BOARD-9X9-SYNC-01`. Nada nesta pasta e carregado
em runtime. As capturas vem de `next build` + `next start`, com Chromium sobre o
mesmo backend grafico do navegador da maquina (ANGLE / D3D11, GeForce GTX 1060).

## 1. A divergencia

O grid logico foi para 9x9 na `ROTA-9X9-FOUNDATION-01`, mas o asset do tabuleiro
continuou sendo o que sempre foi: um board 7x7. `create_route_board_glb.py`
declarava `GRID_SIZE = 7` e a docstring registrava o contrato antigo —
"tile centres at x = col-3" — enquanto `cellToPosition` ja calculava `col - 4`.

Medido no proprio asset (`tools/validation/inspect-route-board-glb.mjs`):

| | 7x7 (HEAD) | 9x9 (entregue) |
| --- | --- | --- |
| tiles | **49** (7 col x 7 lin) | **81** (9 col x 9 lin) |
| centros de tile em X/Z | -3 … +3 | **-4 … +4** |
| passo de celula | 1,00 | 1,00 (inalterado) |
| face do tile | 0,86 | 0,86 (inalterado) |
| topo do tile (Y) | 0,185 | 0,185 (inalterado) |
| sulcos internos | 12 (6 X + 6 Z) | **16 (8 X + 8 Z)** |
| campo jogavel | 7,00 | **9,00** |
| leito de ardosia | 7,66 | **9,66** |
| moldura (trilhos) | 8,65 | **10,65** |
| corpo de madeira | 8,65 | **10,65** |
| footprint total | 9,123 | **11,123** |
| malhas / materiais | 169 / 13 | 219 / 13 |
| peso | 1.817 KB | **2.181 KB** (+20%) |

O grid logico 9x9 ocupa 9,00 unidades. O campo de tiles ocupava 7,00. Com os
dois centrados na origem, **32 das 81 celulas nao tinham tile embaixo**: o anel
externo caia no fosso e no trilho da moldura. O Explorador nasce em (8,0), fora
do campo — ele literalmente comecava a rota em cima da moldura.

`board-7x7-physical-vs-9x9-logical.png` mostra isso na mesma escala.

Nao era escala nem projecao nem camera: `BOARD_SCALE` ja era 1, `cellToPosition`
ja derivava de `rows`/`cols`, e `data-cell-centers` ja publicava os 81 centros
corretos. A unica camada errada era a geometria do asset.

## 2. Fonte do board antigo

`tools/blender/create_route_board_glb.py`. Tiles, sulcos e rebites ja eram
parametricos em `GRID_SIZE`; corpo, leito, borda interna, fosso, moldura e lip
eram constantes escritas a mao (8.65, 7.66, 3.72, 3.55, 4.135, 3.835, 7.74).
Por isso trocar `GRID_SIZE` sozinho nunca teria funcionado: os tiles cresceriam
e a moldura ficaria onde estava.

## 3. Implementacao

Cada uma daquelas constantes virou uma formula sobre `GRID_SIZE`:

```
FIELD  = GRID_SIZE * CELL_SIZE
BED    = FIELD + BED_MARGIN          (0,66)
BODY   = FIELD + BODY_MARGIN         (1,65)
LEDGE  = BED/2 - 0.11    MOAT = LEDGE - 0.17    MOAT_SPAN = BED - 0.36
FRAME_EDGE = BODY/2 - 0.19    FRAME_LIP = FRAME_EDGE - 0.30
FRAME_LIP_SPAN = 2*FRAME_LIP + 0.07
```

As margens sao o que sempre foram — uma quantidade fixa de material em volta do
campo, nao uma proporcao. **Com `GRID_SIZE = 7` as formulas devolvem exatamente
os literais originais** (7.66, 8.65, 3.72, 3.55, 4.135, 3.835, 7.74, 6.88).

Isso foi verificado no asset, nao so na aritmetica: `--grid 7` regera um board
cujas medidas batem com o `board.glb` do HEAD casa por casa — 49 tiles, leito
7,66, moldura 8,65, corpo 8,65, footprint 9,123, 12 sulcos, centros -3…+3. Ou
seja, **a parametrizacao e o mesmo desenho, nao um desenho novo**. Nada foi
esticado e nenhuma proporcao foi inventada.

Tambem deixaram de ser literais de 7: as runas de perimetro (agora nos cantos e
meios derivados do grid) e os modulos `% 7` da variacao de ardosia.

## 4. Moldura e base

Cresceram junto, pelo mesmo caminho: leito 7,66 → 9,66, trilhos 8,65 → 10,65,
corpo 8,65 → 10,65, fosso e lip acompanhando. Cantos, gemas, capsulas e rebites
sao os mesmos objetos do desenho aprovado — os cantos foram reaproveitados e so
os segmentos retos ganharam extensao, como a missao pedia.

`board-frame-bounds.png` mostra os aneis aninhados: campo 9,00 &lt; tiles 8,86 &lt;
leito 9,66 &lt; moldura 10,65 &lt; corpo 10,65 &lt; footprint 11,12. Cada um contem o
anterior, que e a condicao que faltava.

## 5. Sincronizacao dos 81 centros

`tools/validation/verify-route-board-alignment.mjs` prova a correspondencia sem
instrumentar o produto:

- o lado **logico** vem de `data-cell-centers`, que o canvas ja publica;
- os tiles estao todos num plano, entao o mapa (x,z) → pixel e uma homografia.
  Ela e ajustada por minimos quadrados sobre os 81 pares. O residuo do ajuste
  ficou em **0,000 px**, o que confirma que os centros publicados estao mesmo no
  plano dos tiles;
- o lado **fisico** vem do GLB medido, projetado pela mesma homografia. Isso
  tambem permite projetar os quatro cantos do corpo, que o jogo nunca publica, e
  checar se a moldura cabe no canvas.

Resultado, em producao:

| viewport | canvas | centros | erro logico vs fisico | corpo no canvas | scroll | overflow X |
| --- | --- | --- | --- | --- | --- | --- |
| desktop 1440x900 | 993x621 | 81 | **0,000 px** | 94,9% (dentro) | 0 | 0 |
| tablet 820x1180 | 796x597 | 81 | **0,000 px** | 93,5% (dentro) | 0 | 0 |
| mobile 390x844 | 372x279 | 81 | **0,000 px** | 94,2% (dentro) | 0 | 0 |

Testados explicitamente os quatro cantos, o centro, a primeira e a ultima linha,
a primeira e a ultima coluna — os 81, na verdade, porque a checagem percorre a
grade inteira. `board-81-centers.png`, `board-grid-alignment.png`,
`board-corners-review.png`.

O verificador falha com codigo 1 se qualquer centro divergir mais de 1 px, se a
moldura sair do canvas, se a pagina rolar ou se houver erro de console.

## 6. Guarda de contrato

`node tools/validation/inspect-route-board-glb.mjs --assert` le `ROWS`/`COLS` de
`useEscapeMaze.ts` (sem alterar o arquivo) e exige do asset: 81 tiles, 9 colunas,
9 linhas, passo 1,0, 8+8 sulcos, topo de tile unico, cada centro de tile igual a
`cellToPosition` daquela celula, leito cobrindo o campo e moldura envolvendo o
campo.

Rodando contra o `board.glb` do HEAD (o 7x7), a guarda **reprova com 7 falhas**.
O bug que originou esta missao nao pode voltar em silencio.

## 7. Paredes

Nao foi alterado onde as paredes nascem. `wall.glb` continua com escala 1 sobre
`cellToPosition`, e agora cada parede tem um tile proprio embaixo em vez de, no
anel externo, apoiar no fosso. `board-walls-alignment.png` mostra quatro paredes
reais da rota, cada uma centrada na sua celula, sem cobrir vizinha nem invadir a
moldura.

## 8. Personagens e itens

`board-characters-alignment.png` e um percurso real: o Explorador foi conduzido
pelo D-pad ate o canto inferior esquerdo (8,0), o inferior direito (8,8), o
centro (4,4) e o superior esquerdo (0,0). Em todos ele pousa sobre um tile, com
a marca do centro logico sob os pes e a moldura ao lado — nunca embaixo. O
percurso para o quinto alvo terminou porque a rota foi concluida pelo fluxo
normal, o que tambem e evidencia de que o jogo segue jogavel.

Portal, escudo, luzes, armadilhas e guardiao seguem em `cellToPosition` com as
mesmas escalas. O portal continua apoiado na celula de saida como no contrato
atual; nada da logica dele mudou.

## 9. Camera

Ajustada **depois** da geometria, e so porque a geometria mudou.

O ajuste anterior era `max(rows, cols)/2 + margem` — o grid mais folga. Isso
valia enquanto o corpo era mais largo que o grid que carregava. Com um corpo
9x9 real (campo 9,00, madeira 10,65), o grid deixou de ser a borda externa de
qualquer coisa, entao quem precisa caber e a moldura.

O segundo problema era o eixo vertical. Reservar a meia-extensao inteira nos
dois eixos ignorava que a camera 3/4 achata um tabuleiro: o board cobria 92% da
largura do canvas e so 65% da altura. Com o corpo maior, essa reserva empurrava
a distancia para alem de `MAX_CAMERA_RADIUS` — o clamp, e nao a composicao,
decidiria o enquadramento, e o board sairia cortado.

O ajuste agora resolve a distancia em forma fechada, considerando que a borda
proxima esta mais perto da camera do que o alvo:

```
d_perto = hypot(R*sin(beta) - meio, R*cos(beta))
R = meio*sin(beta) + sqrt(T^2 - (meio*cos(beta))^2)
```

Validacao do modelo: aplicado ao corpo antigo de 8,65 ele devolve R = 13,12
contra os 13,15 que a formula anterior produzia, e preve 84,8 px por celula
contra os 84,8 px medidos. **E a mesma composicao, resolvida corretamente.**

`MIN/MAX_CAMERA_RADIUS` foram de 9,5/14,5 para 11,5/18, porque estavam
calibrados para o corpo de 8,65.

### Proporcao do canvas

A `ROTA-RUNTIME-STABILITY-01` fixou o canvas do desktop em 4/3, com o argumento
de que o tamanho do board segue so a altura — verdade apenas sob o ajuste antigo,
que reservava demais na vertical. Com o achatamento modelado, os dois eixos
prendem em proporcoes diferentes, e o cruzamento fica em `1/0,62 = 1,613`:
abaixo disso manda a horizontal, acima manda a vertical e largura extra vira
pixel transparente. O canvas foi para **1,6**, logo abaixo do cruzamento.

Efeito medido no desktop, na mesma altura de linha: **71 px por celula a 4/3 →
85 px a 1,6**.

### Resultado

| | antes desta missao | depois |
| --- | --- | --- |
| corpo fisico | 8,65 un | **10,65 un (+23%)** |
| tiles sob o grid | 49 de 81 | **81 de 81** |
| board na tela (desktop) | 735 px de 827 (88,9%) | **942 px de 993 (94,9%)** |
| passo de celula (linha proxima) | 84,8 px | **85,3 px** |

O board e 23% maior fisicamente, ocupa mais do canvas, e a celula na tela ficou
do mesmo tamanho de antes — com um tile de verdade embaixo de cada uma.

## 10. Preparacao e partida

`board-setup-desktop.png` (escolha de modo) e `board-playing-desktop.png` (HUD
essencial, D-pad, detalhes fechados). O board tem o mesmo tamanho nos dois
estados: o enquadramento nao depende do status, so do canvas. Medido: o botao
`Centralizar` nao cobre nenhuma celula em nenhum dos tres viewports (desktop
botao x=868 contra grade terminando em x=806).

## 11. Tablet e mobile

| viewport | canvas | corpo no canvas | margens (esq/dir/topo/base) | D-pad | scroll | overflow X |
| --- | --- | --- | --- | --- | --- | --- |
| tablet 820x1180 | 796x597 | 93,5% | 16 / 36 / 176 / 73 px | ok | 0 | 0 |
| mobile 390x844 | 372x279 | 94,2% | 6 / 16 / 76 / 23 px | >= 44 px | 0 | 0 |

As margens sao proporcionais ao canvas (o ajuste e derivado da proporcao), entao
elas acompanham o aparelho em vez de serem valores fixos. Nao ha pinch zoom,
camera livre nem drag; o D-pad continua sendo a interacao principal.

`board-tablet.png`, `board-mobile.png`, `board-81-centers-tablet.png`,
`board-81-centers-mobile.png`.

## 12. Arquivos alterados

- `tools/blender/create_route_board_glb.py` — geometria parametrica, `--grid`
- `public/models/route/board.glb` — regerado 9x9 (1.817 → 2.181 KB)
- `src/games/escape-maze/routeBabylonScene.ts` — ajuste de camera, terreno e
  margem do corpo derivados do grid
- `src/games/escape-maze/route-visual.css` — proporcao do canvas do desktop
- `tools/validation/inspect-route-board-glb.mjs` — novo (medicao + `--assert`)
- `tools/validation/verify-route-board-alignment.mjs` — novo (81 centros)

Pesos dos assets da Rota apos a missao: board 2.181 KB, player 379 KB, guardian
344 KB, portal 242 KB, light 133 KB, wall 89 KB, shield 88 KB, trap 65 KB.

## 13. Gameplay

`useEscapeMaze.ts` **sem uma linha de diff**. Validador 9x9 reexecutado apos a
mudanca: 2.160 mapas, 360 execucoes de template forcado, 2.261 candidatos
rejeitados, **0 fallback**, **0 erro de validacao**, 4 templates unicos —
numeros identicos aos de antes da missao. Mapas, dificuldade, luzes, paredes,
armadilhas, movimento, colisao, IA, turnos, scoring, progressao, reward,
localStorage, registry, HUD e portal logico intocados. Home e Circuito sem diff.

## 14. Pendencias honestas

1. O board pesa 364 KB a mais. Ele e carregado uma vez por sessao da Rota e nao
   entra na Home, mas em conexao lenta e mais 20% no unico asset grande do mundo.
   Um passe de otimizacao de malha (os 81 tiles sao caixas biseladas separadas)
   provavelmente devolveria isso e mais.
2. A margem esquerda no mobile e de 6 px. E proporcional, nao fixa, entao
   acompanha o aparelho — mas e a folga mais apertada dos tres viewports.
3. `BOARD_BODY_MARGIN` existe em dois lugares: `BODY_MARGIN` no gerador Blender e
   `BOARD_BODY_MARGIN` no cena Babylon. Nao ha como compartilhar uma constante
   entre um script Python de build e o runtime; a guarda `--assert` cobre a
   divergencia de grid, mas nao a de margem. Um passe futuro poderia fazer o
   gerador emitir um pequeno JSON de contrato que os dois lados leem.
4. A legibilidade das casas no mobile continua sendo o ponto fraco (canvas de
   372x279 para nove colunas), agora com tile real embaixo mas ainda pequeno.
