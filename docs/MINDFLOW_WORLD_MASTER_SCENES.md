# MindFlow World Master Scenes

Este documento define o contrato visual compartilhado entre Home, transicao,
introducao, preparacao e game shell dos dois mundos principais do MindFlow:
Rota Estrategica e Circuito de Memoria.

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

1. `home`
2. `transition`
3. `intro`
4. `setup`
5. `game-shell`

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

A cena mestre reutiliza o kit em camadas V02 em:

`public/illustrations/home/dioramas/route/`

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

A cena mestre usa derivados WebP leves do mesmo board e dos mesmos overlays do
runtime ativo:

`public/illustrations/worlds/master-scenes/circuit/`

Os masters PNG continuam em `public/assets/memory-circuit/` porque ainda sao
usados no jogo. Os WebPs existem para Home, transicao e introducao, evitando
duplicar uma segunda identidade visual.

## Crops por contexto

Os valores ficam centralizados em `WORLD_MASTER_SCENES`.

| Contexto | Rota | Circuito | Intencao |
| --- | --- | --- | --- |
| Home | cena completa | board completo | reconhecer o mundo na estante |
| Transition | aproximacao leve | aproximacao do core | entrar sem trocar a arte |
| Intro | board e objetivo legiveis | quatro pads e core legiveis | explicar usando o mundo real |
| Setup | enquadramento de preparacao | board em repouso | preparar sem ruptura |
| Game shell | runtime em escala natural | runtime em escala natural | jogar no mesmo ambiente |

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

Central de Comandos, Trilha Logica e Jardim de Sementes continuam jogaveis.
Nesta fase recebem somente o shell leve `.wms-secondary-shell`, que unifica:

- fundo e espacamento externo;
- temperatura visual;
- borda e foco dos containers compartilhados.

Eles nao reutilizam a cena mestre da Rota ou do Circuito e nao foram
redesenhados. Cada um precisa de um futuro kit visual proprio.

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
- O Circuito usa o board mestre real, mas ainda precisa de um art pass de
  textura e contraste para reduzir o aspecto claro/provisorio.
- Em viewports desktop muito baixas, o setup/game da Rota pode exigir scroll
  vertical para mostrar simultaneamente cabecalho, board e controles.
- Os mundos secundarios ainda nao possuem cenas mestre proprias.
- Esta missao nao inclui 9x9, armadilha ativa, HOME-02 ou redesign dos jogos
  legados.

