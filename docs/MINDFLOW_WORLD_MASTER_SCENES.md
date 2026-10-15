# MindFlow World Master Scenes

Este documento define o contrato visual compartilhado entre Home, transicao,
introducao, preparacao e game shell dos mundos do MindFlow pintados com o kit
do atelie: Rota Estrategica e Circuito de Memoria (os mundos principais) e,
desde HOME-WORLD-VISUAL-UNIFICATION-01, Central de Comandos e Jardim de
Sementes.

O sistema existe para que o Explorador reconheca o mesmo mundo durante toda a
entrada. Ele nao altera regras, mapas, sequencias, pontuacao, dificuldade,
persistencia ou resultados.

## Objetivo

Cada mundo principal possui uma cena mestre com:

- os mesmos assets-base;
- um elemento focal constante;
- uma atmosfera e paleta reconheciveis;
- materiais e profundidade coerentes;
- placas e acoes com a mesma linguagem;
- crops especificos para cada contexto, sem trocar a identidade.

Os contextos oficiais sao:

1. `transition`
2. `intro`
3. `setup`
4. `game-shell`

A Home (HOME-WORLD-VISUAL-UNIFICATION-01) desenha a maquete de todo mundo
direto, pelo mesmo `WorldDiorama`, em repouso e sem recorte — os mesmos
arquivos que a cena mestre usa a partir do limiar. O contexto `home` deixou de
existir: nao havia nada a recortar.

O crop pode aproximar ou afastar a cena. O mundo, seus materiais e seu foco
visual nao podem ser substituidos por uma arte desconectada entre etapas.

## Arquitetura

O contrato fica isolado em:

- `src/components/worlds/master-scene/worldMasterSceneConfig.ts`
- `src/components/worlds/master-scene/WorldMasterScene.tsx`
- `src/components/worlds/master-scene/world-master-scene.css`

`WorldMasterScene` e um renderer visual. Ele recebe `gameId`, `context` e
`state`, resolve o kit correto e informa readiness somente depois de:

- carregar e decodificar os assets essenciais;
- montar a composicao;
- aguardar dois frames de pintura.

Isso permite que `WorldEntryTransition` preserve a cobertura ate o proximo
estado visual estar realmente pronto.

## Rota Estrategica

Identidade oficial:

- elemento focal: portal teal;
- silhueta: tabuleiro fisico em perspectiva leve;
- personagens: Explorador azul e Guardiao escuro;
- leitura do objetivo: luzes, portal e obstaculos;
- materiais: madeira, pedra/slate e bronze envelhecido;
- atmosfera: biblioteca magica, luz quente e preenchimento teal;
- profundidade: base, ambiente traseiro, tabuleiro, props, personagens,
  ambiente frontal, energia e sombra de contato.

A cena mestre reutiliza o kit em camadas em:

`public/illustrations/home/atelier/route/` (+ a sombra de contato
compartilhada em `atelier/shared/`)

`essentialAssets` em `worldMasterSceneConfig.ts` deriva de
`WORLD_DIORAMA_CONFIGS`, que resolve para esse diretório. O kit-ilha de
HOME-HERO-WORLDS-3D-01 (`dioramas/route-world/`) foi substituído pelo kit do
atelie em HOME-WORLD-VISUAL-UNIFICATION-01 e removido.

O runtime Babylon continua sendo a implementacao jogavel. A cena mestre nao
substitui o board 3D e nao interfere em picking, camera, D-pad ou teclado.

## Circuito de Memoria

Identidade oficial:

- elemento focal: cristal/core central;
- silhueta: board circular com quatro pads;
- leitura do objetivo: pads, core e trilhas de energia;
- materiais: pedra clara, bronze controlado e cristal;
- atmosfera: sala acolhedora com livros, plantas e luz natural quente;
- cores: teal e ambar como base, com coral, azul, verde e dourado nos pads;
- energia contida: brilho orienta, sem neon agressivo.

O jogo desenha o board V2 de `public/assets/memory-circuit/v2/` (gerado por
`tools/blender/create_memory_circuit_visual_v2.py`; `CIRCUIT_MASTER_ASSETS`
aponta direto para esse kit). Home, limiar e introducao mostram, desde
HOME-HERO-WORLDS-3D-01, a maquete em camadas do mundo — hoje a do kit do
atelie, `public/illustrations/home/atelier/circuit/` (HOME-WORLD-VISUAL-
UNIFICATION-01): o mesmo artefato no vocabulario do board (quatro pads nos
mesmos lugares em volta do core, bronze, pedra), assentado no pedestal comum.
Nao existe copia derivada de nenhum dos dois kits.

A pasta `public/illustrations/worlds/master-scenes/circuit/` foi removida na
CIRCUIT-PRESENTATION-FINAL-01-FIX: manter uma segunda copia com nomes antigos
fez o otimizador de imagens do Next continuar servindo a variante V1 em cache
para a Home e a introducao enquanto o jogo ja mostrava a V2. O primeiro kit PNG
continua arquivado em `docs/archive/memory-circuit/legacy-kit-v1/`.

## Central de Comandos e Jardim de Sementes

HOME-WORLD-VISUAL-UNIFICATION-01 deu aos dois a mesma continuidade: a Home, o
limiar e a introducao mostram a mesma maquete (`atelier/commands/`,
`atelier/garden/`), no lugar dos sprites planos `world-panel.webp` /
`world-garden.webp` (que ficam como `transitionArt`/`introArt` de reserva, como
os `-hero` da Rota e do Circuito). Elemento focal: o grande selo (Central) e a
flor do quarto vaso (Jardim). Os jogos legados em si nao mudaram.

## Crops por contexto

Os valores ficam centralizados em `WORLD_MASTER_SCENES`.

| Contexto | Rota | Circuito | Central / Jardim | Intencao |
| --- | --- | --- | --- | --- |
| Home | — (maquete inteira, sem recorte) | — | — | reconhecer o mundo na estante |
| Transition | aproximacao leve | aproximacao do core | aproximacao do selo / da flor | entrar sem trocar a arte |
| Intro | board e objetivo legiveis | quatro pads e core legiveis | maquete legivel | explicar usando o mundo real |
| Setup | enquadramento de preparacao | board em repouso | — | preparar sem ruptura |
| Game shell | runtime em escala natural | runtime em escala natural | — | jogar no mesmo ambiente |

## Placas e acoes

O sistema compartilhado usa:

- `.wms-plate`
- `.wms-button-primary`
- `.wms-button-secondary`

Essas classes fornecem borda, material, sombra, foco e feedback tatil
consistentes. As cores continuam especificas por mundo via custom properties:

- `--wms-accent`
- `--wms-accent-soft`
- `--wms-accent-deep`
- `--wms-warm-light`

O CTA principal deve ser evidente, mas nao deve competir com o objeto-mundo.
O foco por teclado deve permanecer sempre visivel.

## Mundos secundarios

Central de Comandos e Jardim de Sementes continuam jogaveis (a Trilha Logica
foi aposentada em GAME03-SKELETON-01). Dentro do jogo recebem somente o shell
leve `.wms-secondary-shell`, que unifica:

- fundo e espacamento externo;
- temperatura visual;
- borda e foco dos containers compartilhados.

Os jogos em si nao foram redesenhados; a maquete de cada um (Home, limiar e
introducao) e do kit do atelie desde HOME-WORLD-VISUAL-UNIFICATION-01.

## Limites protegidos

Este sistema nao pode alterar:

- `src/games/escape-maze/useEscapeMaze.ts`
- `src/games/color-sequence/useColorSequenceGame.ts`
- `src/games/index.ts`
- mapas, sequencias, timing, dificuldade ou scoring;
- `RewardResultModal`, localStorage e formato de resultados;
- input do Babylon, D-pad, teclado ou hitboxes dos pads.

## Review sheets

As evidencias visuais ficam fora do runtime em:

`docs/archive/world-master-scene-01/`

- `route-flow-strip.png`
- `circuit-flow-strip.png`
- `route-circuit-system.png`

Elas comparam Home, transicao, intro, setup e game shell. Nao devem ser
importadas pelo app.

## Gaps conhecidos

- O kit da Rota ainda usa a maquete V02 na entrada e o GLB atual durante o
  jogo; um art pass futuro deve aproximar ainda mais materiais e proporcoes.
- O Circuito recebeu o art pass V2 (pedra mineral, bronze envelhecido, core
  material) e a cena mestre agora deriva do mesmo kit do jogo
  (CIRCUIT-MASTER-FINAL-01).
- Em viewports desktop muito baixas, o setup/game da Rota pode exigir scroll
  vertical para mostrar simultaneamente cabecalho, board e controles.
- Central e Jardim tem cena mestre ate a introducao; os jogos legados ainda
  nao tem um game shell visual proprio.
- O Circuito na Home e no limiar e a maquete do kit do atelie (o mesmo
  vocabulario do board V2: quatro pads, core, bronze); o jogo continua
  desenhando o board V2 de `public/assets/memory-circuit/v2/`.
- Esta missao nao inclui 9x9, armadilha ativa, HOME-02 ou redesign dos jogos
  legados.

