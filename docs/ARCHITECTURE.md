# MindFlow — Arquitetura Atual

Este documento descreve o estado real do projeto após as limpezas CLEAN-02, CLEAN-03, CLEAN-04 e CLEAN-05. Use como referência antes de mexer em Home, Jornada, Rota Estratégica, Circuito de Memória, assets ou jogos legados.

Regra de produto: leia `docs/MINDFLOW_EXPERIENCE_BOOK.md` antes de qualquer missão. A direção central é **Pensar em paz**. Para decisões visuais, use também `docs/MINDFLOW_VISUAL_SYSTEM.md`.

## Continuidade visual dos mundos

A Rota Estrategica e o Circuito de Memoria compartilham um contrato de cena
mestre entre Home, transicao, intro, setup e game shell. A implementacao fica
em `src/components/worlds/master-scene/` e o contrato completo esta em
`docs/MINDFLOW_WORLD_MASTER_SCENES.md`.

Esse sistema e exclusivamente visual. Ele nao altera hooks, regras, mapas,
sequencias, timing, scoring, persistencia ou registry.

## Fluxo principal

O app roda em uma única rota (`src/app/page.tsx`) e alterna entre três estados:

```text
home (HomeStage)
  -> game (GameScreen)
       -> GameHowToPlay
       -> GAME_REGISTRY[gameId].load() -> componente do jogo
            -> onComplete(result)
  -> result (RewardResultModal)
       -> praticar outra vez
       -> continuar jornada
```

- `src/app/page.tsx` controla a visão atual, a estação selecionada, o `gameSession`, o retorno para Home e a persistência via `saveGameResult`.
- Jogos não salvam direto em `localStorage`; eles chamam `onComplete` com `Omit<GameResult, "id" | "playedAt">`.
- `GameScreen` aplica a intro do jogo e remonta a sessão quando necessário.
- Continuação de jornada: um jogo que retoma em vez de recomeçar grava `GameResult.continuation` (`GameContinuation`, union discriminada por `kind`; hoje só a Rota, `kind: "escape-maze-route"` com `routeNumber` e `difficulty`). `page.tsx` guarda o valor do resultado recém-produzido em "praticar outra vez" e o devolve sem abrir; `GameScreen` só o transporta; uma sessão com continuação pula a intro, e toda entrada pela Home limpa a continuação. Só o jogo dono do `kind` lê o conteúdo (`readRouteContinuation`); qualquer valor malformado vira entrada nova. Um resultado sem `continuation` não tem o que retomar — é o jogo quem decide isso (a Rota, ao concluir a jornada), e o shell não interpreta o motivo. `details` continua sendo histórico/resultado/UI, não canal de controle. Resultados antigos no `localStorage` não têm `continuation` e nunca alimentaram a continuação (o shell só retoma o resultado da sessão atual).
- O código de cada jogo é carregado sob demanda: o registry não importa nenhum jogo estaticamente, e cada `load()` faz o `import()` do chunk daquele jogo quando o `GameScreen` monta. A Home não carrega código de jogo. A prontidão do jogo só conta a partir do mount do componente (o fallback de 2 frames começa depois dele), e falha no carregamento do chunk vai para `onEntryError` → painel de tentar novamente.
- `RewardResultModal` usa os dados do resultado salvo e a cópia de recompensa em `src/engine/rewards.ts`.

## Fontes de verdade

| Área | Arquivo |
| --- | --- |
| Tipos de jogo e resultado (inclui o contrato de continuação) | `src/types/game.ts` |
| Jornada da Rota: tamanho (`ROUTE_JOURNEY_FINAL_ROUTE`), regra de término (`nextJourneyRoute`) e leitura da continuação (só tipos; vai no chunk da Rota) | `src/games/escape-maze/continuation.ts` |
| Configuração estática da Rota: grid 9x9, orçamento de geração, início/saídas/guardiões, templates, cópia de etapa e tabelas de dificuldade (só dados + helpers puros; importado só por módulos da Rota) | `src/games/escape-maze/route-config.ts` |
| Primitivas puras do tabuleiro da Rota como grafo: chave de célula, vizinhos, distâncias e caminhos BFS, grid ↔ paredes (sem RNG, sem estado) | `src/games/escape-maze/route-geometry.ts` |
| Geração + certificação dos mapas da Rota: `generateMaze(difficulty, routeNumber)` devolve um `MazeMap` certificado ou lança | `src/games/escape-maze/route-generation.ts` |
| Estado mutável canônico de uma sessão da Rota (`RouteRuntimeState`) + reducer puro (`routeStateReducer`, `createRouteState`); só tipos, nenhum import em runtime; importado só pelo hook (e, como tipo, por `route-events`) | `src/games/escape-maze/route-state.ts` |
| Contrato tipado dos eventos de domínio da Rota (`RouteDomainEvent`: o que aconteceu no turno) + tradução pura e determinística evento → transições do C5 (`routeStateActionsForEvent`); só tipos, nenhum import em runtime; importado só pelo hook | `src/games/escape-maze/route-events.ts` |
| Fonte única de aleatoriedade da Rota (`routeRandom`, `randomItem`) e o seed de diagnóstico; desde ROUTE-C7A o fluxo seeded tem checkpoint serializável/restaurável (`RouteRandomCheckpoint`, `getRouteRandomCheckpoint`, `restoreRouteRandomCheckpoint`) | `src/engine/route-random.ts` |
| Contrato síncrono e transportável de uma geração (`RouteGenerationRequest`/`RouteGenerationResult`, `createRouteGenerationRequest` → `runRouteGenerationSync` → `acceptRouteGenerationResult`), compatível com um Worker futuro; ainda não usado pelo produto | `src/games/escape-maze/route-generation-job.ts` |
| Contrato de entrada dos jogos (readiness + watchdog; só metadados) | `src/games/entry-contract.ts` |
| Registro de jogos (contrato de entrada + loader do componente) | `src/games/index.ts` |
| Metadados visuais dos mundos | `src/data/worlds.ts` |
| Lista de atividades e estações | `src/data/activities.ts` |
| Intros dos jogos | `src/data/game-intros.ts` |
| Progresso por estação | `src/engine/stage-progress.ts` |
| Pontuação e limites | `src/engine/scoring.ts` |
| Resultado/recompensa | `src/engine/rewards.ts` |
| Persistência local | `src/engine/storage.ts` |

Use `getWorldMeta(gameId)` para dados derivados de histórico salvo. Ele tem fallback seguro para resultados antigos ou ids desconhecidos.

## Jogos ativos

| GameId | Nome atual | Estado |
| --- | --- | --- |
| `escape-maze` | Rota Estratégica | Jogo principal em foco. Usa Babylon + GLBs. |
| `color-sequence` | Circuito de Memória | Jogo de memória em foco. Usa palco 2.5D com board mestre e overlays. |
| `security-panel` | Central de Comandos | Ativo, mas ainda é jogo legado a recriar futuramente. |
| `number-trail` | Trilha Lógica | Ativo, mas ainda é jogo legado a recriar futuramente. |
| `seed-garden` | Jardim de Sementes | Ativo, mas ainda é jogo legado a recriar futuramente. |

Os jogos legados continuam compilando e aparecem no registry. Não remova `GameLayout`, `GameActions`, `StatusBanner` ou `StatCard` enquanto esses três jogos dependerem deles.

## Home ativa

A Home de produção é a experiência 2.5D leve "O Ateliê dos Mundos" em:

- `src/components/home/HomeStage.tsx`
- `src/components/home/HomeGreeting.tsx`
- `src/components/home/WorldObject.tsx`
- `src/components/home/homeLayout.ts`
- `src/styles/home.css`
- `src/components/WorldEntryTransition.tsx`

Contrato da Home:

- `/` não usa Three, R3F, Canvas, `requestAnimationFrame` ou render loop contínuo.
- O CSS novo da Home fica isolado em `src/styles/home.css` e usa prefixo `.hj-*`.
- `Rota Estratégica` e `Circuito de Memória` são mundos-herói.
- `Central de Comandos`, `Trilha Numérica` e `Jardim de Sementes` continuam acessíveis como mundos secundários.

Assets ativos/permitidos da Home:

- `public/illustrations/home/*`
- `public/illustrations/ui/*.svg`

`public/illustrations/station-*.webp` foi removido em MINDFLOW-CLEANUP-03C: a
Home passou a mostrar maquetes em camadas e nenhum código lia mais esses
arquivos. Os masters ficam em `docs/archive/home-station-masters/`.

`public/illustrations/worlds/*-diorama.webp` continua no disco, mas não é asset
de runtime: `route-diorama.webp` e `memory-diorama.webp` são a FONTE de
`world-route-hero.webp` / `world-circuit-hero.webp` (via
`tools/assets/create_world_cohesion_assets.mjs`), e os outros três são masters
visuais sem consumidor em código.

A Home 3D antiga permanece no disco para referência e laboratório:

- `src/components/three/GameHome3D.tsx`
- `src/components/three/WorldSelectorScene.tsx`
- `src/components/three/WorldStage3D.tsx`
- `src/components/three/worlds/*World3D.tsx`

`/lab/3d-home` continua existindo como rota de laboratório, mas a Home de produção está em `/` com `HomeStage`.

## Rota Estratégica

Arquivos principais:

- `src/games/escape-maze/RouteStrategyGame.tsx`
- `src/games/escape-maze/useEscapeMaze.ts`
- `src/games/escape-maze/route-config.ts`
- `src/games/escape-maze/route-geometry.ts`
- `src/games/escape-maze/route-generation.ts`
- `src/games/escape-maze/route-defenders.ts`
- `src/games/escape-maze/route-invariants.ts`
- `src/games/escape-maze/route-state.ts`
- `src/games/escape-maze/route-events.ts`
- `src/games/escape-maze/route-generation-job.ts`
- `src/games/escape-maze/RouteBabylonBoard.tsx`
- `src/games/escape-maze/routeBabylonScene.ts`

Divisão da lógica (ROUTE-C1 + ROUTE-C2 + ROUTE-C3 + ROUTE-C4 + ROUTE-C5 + ROUTE-C6 + ROUTE-C7A):

| Módulo | Papel |
| --- | --- |
| `route-config.ts` | configuração estática (dados + helpers puros que só leem tabelas) |
| `route-geometry.ts` | primitivas puras de grid/grafo, compartilhadas por geração e runtime |
| `route-generation.ts` | geração + certificação de mapas |
| `route-defenders.ts` | política pura do Caçador e da Sentinela (como cada defensor decide) |
| `route-invariants.ts` | contrato puro de validade do estado lógico e de solvabilidade topológica (runtime) |
| `route-state.ts` | estado mutável canônico da sessão (`RouteRuntimeState`) + reducer puro (`routeStateReducer`): COMO o estado muda |
| `route-events.ts` | contrato semântico tipado (`RouteDomainEvent`) + tradução determinística evento → transições do C5 (`routeStateActionsForEvent`): O QUE aconteceu |
| `route-generation-job.ts` | contrato síncrono de uma geração como dado (pedido → `generateMaze` → mapa + checkpoint do fluxo seeded), pronto para atravessar um Worker; ainda não ligado ao hook |
| `useEscapeMaze.ts` | adaptador React/orquestrador do domínio: decide QUAL evento aconteceu e em QUE ORDEM, aplica-o pelo seam `applyDomainEvent`, roda os efeitos e o `onComplete`, calcula as views derivadas |

Grafo de dependências em tempo de execução (sem ciclos): `route-config` ← `route-geometry` ← {`route-generation`, `route-defenders`, `route-invariants`} ← `useEscapeMaze`, e `route-state` ← `useEscapeMaze`, e `route-events` ← `useEscapeMaze`. `route-generation` e `route-defenders` usam também `difficulty.ts` e o seam `route-random.ts`; `route-invariants` usa só configuração e geometria (nada de RNG, `difficulty.ts` ou defensores). `route-state` não importa nada em tempo de execução: conhece `SentinelState`, `MazeMap`, `GameStatus`/`ChestReward` e os tipos do jogo só como tipos. `route-events` também não: conhece `RouteStateAction`/`RouteSessionStart` (de `route-state`), `SentinelState`, `ChestReward` e `GridPosition` só como tipos — nem `route-generation`, nem RNG, nem React. `route-defenders`, `route-invariants` e `route-state` conhecem `MazeMap` só como tipo (`import type`), e `route-generation` não conhece os defensores, os invariantes nem o estado.


- Antes: `useEscapeMaze.ts` concentrava configuração + geração + runtime num arquivo só.
- Agora: `route-config.ts` tem a configuração estática e os helpers puros que só leem essa configuração — `ROWS`/`COLS`, `MAX_GENERATION_ATTEMPTS`/`RECOVERY_*`, `PLAYER_START` e células seguras, candidatos de saída e de guardião por etapa, os 9 templates, `RouteStage`/`RouteProgression` e a cópia de cada etapa, `WALL_LIMITS`, contagens base de luzes e armadilhas, `DIFFICULTY_PLAY_BRIEF`, `ROUTE_STAGE_QUALITY` e `getRouteStage`, `getRouteProgression`, `getWallLimits`, `getStarCount`, `getStarMinSeparation`, `getTrapCount`, `getMinimumPathLength`, `getRouteStageTemplates`. Só importa tipos (`@/types/game`): nada de React, sons, RNG, Babylon ou do hook. Exporta só o que os módulos da Rota consomem (o hook no C1; desde o C2 também `route-generation.ts` e `route-geometry.ts`); as tabelas por trás dos helpers ficam privadas.
- O hook importa a configuração e reexporta `ROWS`/`COLS` (lidos pela Rota e pelo board) e o tipo `RouteProgression`, então a superfície pública do hook não mudou. Input (`ARROW_DELTAS`, `BREAK_DIRECTION_DELTAS`, `MOVE_INPUT_GUARD_MS`, `BreakDirection`, `BreakTarget`) continua no hook, `GameStatus` também ficou fora de `route-config.ts` (no hook até ROUTE-C4; desde então em `route-invariants.ts`, reexportado pelo hook), e as constantes de Sentinela/portal (`PORTAL_*`, `SENTINEL_*`) ficaram fora de `route-config.ts`: são de runtime/algoritmo, não de configuração de grid (desde ROUTE-C3 vivem em `route-defenders.ts`, com a política que as usa).
- A extração não mudou valor nenhum: `tools/validation/route-config-extraction-tests.mjs` fixa os valores, compara mapas e partidas com o hook de um arquivo (`4027baa`) e impede a configuração de voltar a ser declarada no hook.
- ROUTE-C2: `route-geometry.ts` tem as primitivas do tabuleiro como grafo — `keyToPosition`, `posKey`, `positionsEqual`, `cloneGrid`, `gridToWalls`, `countWalls`, `getNeighbors`, `findPathLength`, `findPathCells`, `getReachableDistances`. Puras: importam só `ROWS`/`COLS` de `route-config.ts` e tipos; nada de RNG, React ou estado. Geração e runtime as usam, por isso não pertencem a nenhum dos dois: os defensores e os invariantes (desde ROUTE-C3/C4 em módulos próprios) não dependem de um módulo de "geração" para andar no tabuleiro.
- ROUTE-C2: `route-generation.ts` fabrica e certifica mapas — Guardião, randomização de paredes, luzes, armadilhas/baú, rota objetiva, decomposição em blocos, análise estrutural, `isStructurallyValid`, `isValidMap`, `buildCandidate` e `generateMaze` (fase aleatória → varredura de recuperação pelos MESMOS gates → throw; nenhum mapa não certificado). Exporta só `generateMaze` e o tipo `MazeMap`; importa configuração, geometria, `manhattanDistance` e o seam de RNG — nunca React, o hook, UI, Babylon ou sons. Movido verbatim: mesmos templates, tentativas, ordem de laços e de sorteios, scores, desempates e gates.
- ROUTE-C2: `randomItem` (um sorteio, um item) saiu do hook para `src/engine/route-random.ts`, ao lado de `routeRandom`, porque geração e Caçador o usam e sorteiam do mesmo fluxo, nessa ordem: assim nenhum dos dois depende do outro para compartilhá-lo. `difficulty.ts` mantém seu `pickRandom` (política do Caçador, fora do escopo).
- `useEscapeMaze.ts` só pede `generateMaze(difficulty, routeNumber)` e recebe um `MazeMap` certificado. Ele reexporta `generateMaze`, `posKey`, `positionsEqual` e o tipo `MazeMap`, então quem importava do hook continua importando dele.
- A extração não mudou mapa nem partida: `tools/validation/route-generation-extraction-tests.mjs` compara com `65932cf` (geração ainda no hook) 1080 mapas campo a campo e o fluxo de RNG depois de cada um, fluxos contínuos e seeds armados, cada tentativa de geração explicada, recuperação e throw forçados, e partidas reais passo a passo — e impede que o hook volte a declarar o que saiu.
- ROUTE-C3: `route-defenders.ts` diz COMO os defensores decidem — `PORTAL_ZONE_RADIUS`, `SENTINEL_LEASH`, `SENTINEL_THREAT_HORIZON`, `SENTINEL_COMMIT_TURNS`, `EMPTY_BLOCKED`, os tipos `PortalDefenceZone`/`SentinelState`, `computePortalDefenceZone`, `createSentinelState`, `decideSentinelMove` (Sentinela, contrato c3 do `dual-guardian-lab`) e `chooseGuardianMove` (Caçador). Movido verbatim: mesmo raio, coleira, horizonte, compromisso de 3 turnos, escolha e re-mira da porta, recuo ao portal, proibição do portal, liberação de alvo cortado por armadilha, desempates, ordem de operações e os mesmos sorteios do fluxo único (`routeRandom`/`randomItem`, inclusive o 0.45 do fácil), na mesma ordem. Puro: importa configuração (`ROWS`/`COLS`), geometria, `getPredatorNextPosition`/`manhattanDistance`, o seam de RNG e tipos — nunca React, o hook, UI, Babylon ou sons. Só exporta o que o hook consome (`SENTINEL_COMMIT_TURNS`, as quatro funções e os dois tipos); as demais constantes ficam privadas e os validadores as alcançam pela superfície do C0.
- O hook continua dono do turno: `runDefenderPhase` (texto inalterado) chama `chooseGuardianMove` e depois `decideSentinelMove`, importados de `route-defenders.ts`, e decide o resto — commit das posições, captura, Segunda Chance (rollback dos defensores e consumo da carga), mensagens e estatísticas. O hook não sorteia mais nada diretamente (não importa `route-random`). Ele reexporta `computePortalDefenceZone`, `createSentinelState`, `decideSentinelMove` e os tipos `PortalDefenceZone`/`SentinelState`, como antes; `chooseGuardianMove` continua fora da superfície pública do hook.
- A extração não mudou decisão nenhuma: `tools/validation/route-defenders-extraction-tests.mjs` compara com `de8c94e` (defensores ainda no hook) a Sentinela num corpus de estados, a equivalência com o lab c3 (FEINT/ROLE), o Caçador em cada ramo com contagem de sorteios e os próximos valores do fluxo depois de cada decisão, cadeias de turnos com geração antes e depois, o contrato das armadilhas, a Segunda Chance (captura pelo Caçador, pela Sentinela e pelo próprio passo do Explorador, rollback e carga) e partidas reais passo a passo — e impede que o hook volte a declarar a política dos defensores.
- ROUTE-C4: `route-invariants.ts` responde "este estado lógico da Rota é possível, e cada objetivo ainda não cumprido continua alcançável nas paredes atuais?" — `inspectDynamicMazeState`, o snapshot que ela lê (`DynamicMazeStateSnapshot`) e o veredito que devolve (`DynamicSolvabilityInspection`), com o vocabulário do estado em que o snapshot é escrito: `GameStatus` e `ChestReward`. Os dois tipos foram junto porque o módulo não pode importar o hook para nomeá-los, e ninguém além do hook e do contrato os usa — um módulo de tipos separado teria só esses dois nomes. Movido verbatim: os mesmos 26 códigos de issue na mesma ordem de emissão, as mesmas paredes efetivas (paredes do mapa menos a parede quebrada válida, num `Set` novo — `mazeMap.walls` nunca é tocado), a mesma sobreposição Explorador/defensor só enquanto `status === "playing"`, os mesmos objetivos (luzes não coletadas, portal, baú enquanto fechado). Solvabilidade continua topológica: defensores móveis são ameaça, não parede; o resultado adversarial contra Caçador/Sentinela é do solver dinâmico exato, outra camada. Puro: importa `ROWS`/`COLS`, `getReachableDistances`/`posKey`/`positionsEqual` e tipos (`MazeMap`, `GridPosition`) — nunca React, o hook, os defensores, RNG, UI, Babylon, sons, scoring ou storage.
- O hook continua decidindo QUANDO perguntar: `dynamicSolvability: inspectDynamicMazeState({...})` no retorno, com o mesmo snapshot de 11 campos, a cada render, como antes (texto de `useEscapeMaze` inalterado). Ele importa os cinco nomes de `route-invariants.ts` e os reexporta (`inspectDynamicMazeState`; tipos `GameStatus`, `ChestReward`, `DynamicMazeStateSnapshot`, `DynamicSolvabilityInspection`), então `RouteStrategyGame` continua importando `ChestReward` do hook e `RouteBabylonBoard` continua importando `GameStatus` dele, sem mudança. `getReachableDistances` saiu dos imports do hook (só o contrato o usava).
- A extração não mudou veredito nenhum: `tools/validation/route-invariants-extraction-tests.mjs` compara com `940c856` (invariantes ainda no hook) um corpus adversarial escrito à mão que produz cada um dos 26 códigos (sequências inteiras, não `includes`), milhares de estados aleatórios em mapas gerados (ordem de emissão conferida), as paredes efetivas para cada parede de cada mapa, segurança contra mutação (paredes, luzes, armadilhas, posições, iteráveis lidos uma vez, duas chamadas iguais e sem estado compartilhado) e `game.dynamicSolvability` passo a passo em partidas reais (todos os modos, Rotas 1/2/3, armadilhas, baú, picareta, Segunda Chance, vitória, derrota, setup, restart, próxima Rota) — e impede que o hook volte a declarar o que saiu.
- O que dominava `useEscapeMaze.ts` depois do C4 (984 linhas, eram 1.113): o estado React e a orquestração do turno — `runDefenderPhase` (commit, captura, rollback da Segunda Chance), passo do Explorador, baú/escolha da recompensa, picareta, input (teclado/D-pad e a janela de 150 ms), fim de rota/continuação, mensagens e estatísticas.
- ROUTE-C5: `route-state.ts` responde "qual é o estado da partida e como uma alteração desse estado é aplicada de forma determinística?". Os 18 `useState` independentes que eram o estado mutável da sessão (`difficulty`, `mazeMap`, `player`, `guardian`, `sentinel`, `collectedStars`, `triggeredTraps`, `turns`, `blockedMoves`, `errors`, `status`, `message`, `blockedShake`, `moveTick`, `chestOpened`, `rewardSelected`, `rewardSpent`, `brokenWall`) viraram um valor só, `RouteRuntimeState`, que só muda por `routeStateReducer(state, action)`. O reducer é puro: não toca React, RNG, geração de mapa, sons, `onComplete`, `Date.now`, `window`, Babylon nem storage — o módulo só importa tipos e não alcança nada em tempo de execução. `createRouteState` monta uma sessão nova como UM estado coerente (mapa + peças nas largadas + Sentinela no posto + contadores zerados + nada coletado/armado + baú fechado + status/mensagem), e a ação `START_ROUTE` (start, restart, troca de modo — o modo chega junto com o mapa gerado para ele) é exatamente ela: nada da Rota anterior vaza.
- As 11 ações são transições do estado, cada uma com o conjunto exato de campos que escreve (os demais mantêm a identidade): `START_ROUTE`, `BLOCK_STEP`, `COUNT_TURN`, `MOVE_EXPLORER`, `OPEN_CHEST`, `SELECT_REWARD`, `SPEND_SECOND_CHANCE`, `OPEN_WALL`, `SETTLE_DEFENDERS`, `COMMIT_CAPTURE`, `END_ROUTE`. Não há ação genérica de "patch", e não são eventos de domínio: o contrato de eventos semânticos (o que aconteceu no jogo) é o ROUTE-C6, abaixo.
- O C5 NÃO moveu regra do turno para fora do hook. `useEscapeMaze` continua decidindo QUAL transição se aplica, em que ordem e com que valores (`tryMovePlayer`, `runDefenderPhase` com Caçador antes da Sentinela, captura, Segunda Chance com rollback, baú que pausa o turno, `chooseReward`, `breakWall`, `endGame`, `startNewMaze`); ele gera os mapas (`generateMaze` no inicializador do `useReducer` — uma vez por montagem, onde o inicializador do `useState` gerava — e em `startNewMaze`), toca os sons, chama `onComplete`, guarda a janela de input (`lastMoveInputAtRef`, `MOVE_INPUT_GUARD_MS`) e calcula todas as views derivadas a cada render (`walls`, `portalDefenceZone`, os sets, flags do baú, `breakTargets`, contagens, `portalActive`, `routeProgression`, `score`, `dynamicSolvability`). Ficaram fora do reducer de propósito: `routeNumber` (identidade fixa da sessão; único `useState` restante) e `lastMoveInputAtRef` (controle de input). O objeto devolvido pelo hook é o mesmo, campo a campo; nenhum consumidor conhece `route-state.ts`.
- A consolidação não mudou nada observável: `tools/validation/route-state-reducer-tests.mjs` compara com `74ff2dc` (C4, 18 `useState`) cada render de centenas de sessões roteirizadas (Rotas 1/2/3 × modos × 11 políticas, restart, troca de modo, próxima Rota, jornadas R1→R3) e, no React real (react-dom, Strict Mode em desenvolvimento e produção, `act`, atualizações default e eventos discretos pelo próprio listener de teclado do hook), commits por input, chamadas do componente, completions/finalStats, sons, sorteios do RNG e chamadas de `generateMaze` — e impede que o estado volte a ser células soltas. `tools/validation/route-runtime-harness-tests.mjs` prova que o `useReducer` do shim do harness se comporta como o React.
- Depois do C5, `useEscapeMaze.ts` tem 1.027 linhas (o reducer não diminuiu o hook: os despachos com payload explícito e a desestruturação do estado ocupam mais linhas que os setters) e `route-state.ts` 204. O que domina o hook continua sendo a orquestração do turno — `runDefenderPhase`, passo do Explorador, baú/recompensa, picareta, input, fim de rota/continuação, mensagens e estatísticas — que o C6 vai separar em eventos.
- ROUTE-C6: `route-events.ts` responde "o que acabou de acontecer no domínio da Rota?". `RouteDomainEvent` é uma union discriminada fechada de 13 acontecimentos, cada um com o significado no payload (motivo, causa, autor, desfecho) e só o que o descreve sem ambiguidade e o que o estado precisa dele: `ROUTE_STARTED` (start/restart → `playing`, troca de modo → `setup`; `routeNumber` + o início da sessão), `EXPLORER_STEP_BLOCKED` (`reason: "boundary" | "wall"`, a célula), `EXPLORER_STEP_COMMITTED` (turno, destino, luzes e armadilha armada pelo passo), `LIGHT_COLLECTED`, `PORTAL_ACTIVATED`, `TRAP_ARMED`, `CHEST_OPENED`, `REWARD_SELECTED`, `WALL_OPENED`, `SECOND_CHANCE_USED` (`cause: "explorer" | "hunter" | "sentinel"`), `DEFENDERS_SETTLED`, `EXPLORER_CAPTURED` (`by: "explorer-step" | "hunter" | "sentinel"`) e `ROUTE_ENDED` (`outcome: "won" | "lost"`, `journeyCompleted`). `PORTAL_ACTIVATED` é o acontecimento extra que o fluxo real tem (a última luz abre o portal no mesmo passo). Nenhum evento carrega callback, `any` ou objeto genérico; as mensagens continuam escolhidas pelo hook (byte a byte) e só viajam no evento que as mostra — o módulo não tem copy.
- `routeStateActionsForEvent(event)` traduz um evento JÁ acontecido nas transições do C5 que o registram, em ordem: `ROUTE_STARTED` → `START_ROUTE`; passo → `COUNT_TURN` + `MOVE_EXPLORER`; bloqueio → `BLOCK_STEP`; baú → `OPEN_CHEST`; recompensa → `SELECT_REWARD`; parede → `OPEN_WALL` + `COUNT_TURN`; Segunda Chance → `SPEND_SECOND_CHANCE` (+ `COUNT_TURN` quando a causa é o próprio passo do Explorador, que não aconteceu); defensores → `SETTLE_DEFENDERS`; captura → `COMMIT_CAPTURE` (a mesma transição para os três autores — o evento é que os distingue); fim → `END_ROUTE`. Luz, portal e armadilha são observacionais: o passo já os grava atomicamente, então traduzem em nenhuma transição e não provocam render. A função é pura: não toca React, RNG, geração, sons, `onComplete`, relógio, browser nem storage, não lê o estado e não decide se o evento aconteceu.
- O hook continua dono do QUANDO e da ORDEM: `tryMovePlayer`, `runDefenderPhase` (Caçador antes da Sentinela; captura ou Segunda Chance com descarte dos movimentos), `chooseReward` (retoma o MESMO turno pausado pelo baú), `breakWall`, `endGame` e `startNewMaze` decidem cada evento e o aplicam por um seam único, `applyDomainEvent(event)` (um `useCallback` que despacha, na ordem, as transições que o mapping devolve). Esse é o único `dispatch` do hook: os 20 `dispatch({ type })` diretos do C5 viraram 19 aplicações de evento; a única escrita fora do seam é o estado inicial da montagem (o inicializador do `useReducer`, `createRouteState`), que é um valor de partida e não uma transição. Sons, `onComplete`, `Date.now`/janela de input, geração de mapa e as views derivadas continuam no hook, nos mesmos lugares; o `armedTraps` local continua valendo para os defensores no mesmo turno.
- Os eventos são síncronos e efêmeros: não são persistidos, não há event bus, pub/sub, fila, histórico, analytics nem replay, o objeto devolvido pelo hook é o mesmo e nenhum componente conhece `route-events`. O C6 não mudou gameplay: é o seam por onde sequências de feedback e a Gameplay 2.0 vão ler o que aconteceu.
- A mudança não alterou nada observável: `tools/validation/route-domain-events-tests.mjs` (contra `878057a`) tem o gate estático (union fechada lida pelo type checker, pureza, seam único, inventário de emissão, nenhuma superfície nova), o contrato evento → transição (mesmo estado que a transição do C5 pelo reducer de `878057a`), o trace semântico observado pelo grafo do C0 (fixado em situações montadas à mão e conferido, em partidas reais, contra o render e contra as decisões reais dos defensores), a ordem do turno (P5 do C5 mantido: sem as escritas, o corpo imprime igual a `878057a` e a `74ff2dc`; e cada evento resolvido pelo mapping real imprime exatamente os despachos de `878057a`) e a equivalência render a render no harness e no React real.
- Depois do C6, `useEscapeMaze.ts` tem 1.105 linhas (eram 1.027: os eventos nomeiam o significado — causa, autor, turno — além dos valores) e `route-events.ts` 213.
- ROUTE-C7A (preparação da C7, decidida `C7_GO` em `docs/route-worker-decision.md`): geração e Caçador sorteiam do MESMO fluxo `routeRandom()`, e num diagnóstico seeded (`armRouteRandomSeed` → `generateMaze` chama `beginSeededGeneration`, que reinicia o fluxo no seed armado → a geração consome N sorteios → o Caçador continua exatamente de onde a geração parou; Launch/Start/Restart/troca de modo reiniciam no seed porque cada `generateMaze` chama `beginSeededGeneration`) a posição do fluxo depois da geração faz parte do comportamento. Um Worker é outro realm, com outra cópia de `route-random`; a C7A tornou essa posição um dado. Em `route-random.ts`, o estado do PRNG saiu da closure de `createSeededDraw` para `seededState` no módulo — mesma aritmética, statement por statement (o contador continua sem wrap para uint32: depois de ~4,9M sorteios ele passa de 2^53 e o arredondamento do double faz parte da sequência; o checkpoint guarda esse número verbatim). `RouteRandomCheckpoint` é `{ armedSeed, state }`: dois números, sem função nem bigint, structured-clone-safe e JSON-safe. `getRouteRandomCheckpoint()` devolve um snapshot (ou `null` sem seed armado — não existe checkpoint de `Math.random`); `restoreRouteRandomCheckpoint(cp)` restaura seed armado e posição (o próximo `routeRandom()` é o que o realm de origem sortearia), mantém `beginSeededGeneration()` reiniciando no seed armado, e rejeita um checkpoint malformado sem mudar nada. `clearRouteRandomSeed()` apaga seed, fluxo e estado. As APIs antigas (`routeRandom`, `randomItem`, `armRouteRandomSeed`, `clearRouteRandomSeed`, `getArmedRouteSeed`, `beginSeededGeneration`) não mudaram de assinatura nem de efeito.
- ROUTE-C7A: `route-generation-job.ts` descreve uma geração como unidade transportável: `createRouteGenerationRequest(difficulty, routeNumber)` (no realm que pede: `{ difficulty, routeNumber, random }`, com o checkpoint do fluxo armado ou `null`), `runRouteGenerationSync(request)` (no realm que gera: assume o fluxo do pedido — restaura o checkpoint ou limpa qualquer seed antigo —, faz a ÚNICA chamada `generateMaze` e devolve `{ map, random }` com o checkpoint final) e `acceptRouteGenerationResult(request, result)` (no realm que pediu: restaura o checkpoint final e devolve o mapa; em jogo normal não toca nada; um resultado que não responde ao pedido é recusado). Num realm só, os três são exatamente `generateMaze(difficulty, routeNumber)`. Sem callbacks, React, `AbortSignal`, Worker, `MessagePort`, Promise ou estado de UI; importa só `route-random`, `route-generation` e tipos. Não há `requestId`: o envelope de mensagem (e o descarte de resultados velhos) é do lifecycle async.
- ROUTE-C7A NÃO criou Worker e NÃO tornou a geração assíncrona: `useEscapeMaze` continua chamando `generateMaze` diretamente, de forma síncrona, nos mesmos dois lugares (inicializador do `useReducer` — que o Strict Mode de desenvolvimento continua podendo rodar duas vezes — e `startNewMaze`), sem loading, pending ou token. O seam síncrono não foi ligado ao hook de propósito: num realm só ele não muda nada (restaura o fluxo que já está lá), os dois pontos de chamada são exatamente os que a C7B vai reescrever (o inicializador do reducer não pode esperar uma geração), e o texto do hook é fixado pelos gates do C5/C6. Jogo normal continua `Math.random()`: sem seed, sem determinismo, sem checkpoint — entre realms ele é equivalente em distribuição, não em valor; diagnóstico seeded é exato. Próximos passos: C7B = lifecycle async da geração (pendente, resultados obsoletos, Strict Mode); C7C = o Worker real executando `runRouteGenerationSync`.
- A C7A não mudou nada observável: `tools/validation/route-worker-rng-handoff-tests.mjs` (contra `f19f319`) compara milhares de roteiros de fluxo seeded sorteio a sorteio (arm, sorteios até 60k, `randomItem`, `beginSeededGeneration`, clear, re-arm), dois fluxos além da borda 2^53, geração seeded e o Caçador depois dela em R1–R3 × modos, sessões reais do hook (Launch, Start, passos, Restart, troca de modo) e o React real (Strict Mode, dev, prod); prova o checkpoint restaurado num grafo de módulos novo (N = 0…60 000), a geração num realm → mapa + checkpoint clonados → Caçador em outro realm, o hook real com suas duas gerações desviadas (em memória) para um segundo realm, um Worker real de `node:worker_threads` e um Worker do Chromium; e tem contrafactual e mutantes. Os gates de preservação do C2–C6 continuam comparando `route-random.ts` byte a byte, menos as duas declarações reescritas e as quatro adicionadas pela C7A (`routeRandomBeforeC7A` em `route-module-loader.mjs`).

`RouteStrategyGame` carrega `RouteBabylonBoard` como chunk próprio depois de montar, com um `import()` explícito (não `next/dynamic`), e o Babylon só é buscado quando o board monta. Até o chunk chegar, o canvas mostra "Preparando o tabuleiro Babylon…"; se ele falhar, o erro vai para `onEntryError` → painel de tentar novamente, e o retry (nova sessão) busca o chunk de novo.

Ao terminar uma rota, `useEscapeMaze` grava a continuação `{ kind: "escape-maze-route", routeNumber, difficulty }` com a rota que `nextJourneyRoute` decide (abaixo) — ou nenhuma, quando a jornada termina; `RouteStrategyGame` a valida com `readRouteContinuation` e entrega `routeNumber`/`difficulty` ao hook. Essa continuação é o único caminho para a próxima rota: resultado → `GameResult.continuation` → `playAgain` em `page.tsx` → nova sessão da Rota. Dentro de uma sessão a rota não muda — o hook não tem setter de `routeNumber`, e o `continueJourney` (com o botão "Explorar próxima rota" que a Rota mostrava ao vencer ou perder) foi removido, porque no produto ele nunca chegava à tela: `page.tsx` tira o jogo no mesmo update que salva o resultado. O `/lab/route-launcher` (só em dev) segue o mesmo contrato: o jogo fica montado depois do fim, e "Próxima rota" abre uma sessão nova sobre a continuação que o resultado trouxe. `tools/validation/route-journey-ownership-tests.mjs` prova isso, com contrafactual contra `d258077`.

### Jornada v1: três Rotas (ROUTE-JOURNEY-TERMINAL-01)

A Rota Estratégica v1 tem exatamente 3 Rotas:

| Rota | Vitória | Derrota |
| --- | --- | --- |
| 1 | Rota 2 | Rota 2 |
| 2 | Rota 3 | Rota 3 |
| 3 | jornada concluída (sem continuação) | Rota 3 de novo |

- R1/R2 avançam para N + 1, vencidas ou perdidas, no mesmo modo e com a intro pulada.
- Derrota na R3 repete a R3 no mesmo modo: a continuação aponta para a Rota 3, `details.nextRouteNumber` é 3 (a ação real de "Tentar Rota 3 novamente").
- Vitória na R3 conclui a jornada: o resultado não tem `continuation`, grava `details.journeyCompleted: true` e não grava `nextRouteNumber`/`nextRouteStage`. A tela de resultado mostra "Jornada concluída" com uma única ação, "Voltar aos mundos" (`onDashboard`); ela não chama "praticar outra vez", que seria uma entrada nova parecendo continuação.
- Não existe Rota 4 no fluxo do produto. A regra vive só em `continuation.ts` (`ROUTE_JOURNEY_FINAL_ROUTE = 3`, `nextJourneyRoute`), usada pelo produtor (`endGame`) e pelo leitor: `readRouteContinuation` só aceita Rotas de 1 a 3, então uma continuação de Rota 4+ (ou malformada) — inclusive de resultados antigos — vira entrada nova na Rota 1, nunca uma Rota 4. `page.tsx` e `GameScreen` não conhecem o limite nem `journeyCompleted`; só sabem se há continuação.
- Resultados antigos que citam Rota 4+ continuam carregando no histórico sem migração; só não abrem nada.
- `getRouteStage` continua cíclico (`((n - 1) % 3) + 1`) para quem monta o hook direto numa Rota (ferramentas de validação); isso não é um caminho do produto. O `/lab/route-launcher` aceita Rotas 1 a 3, as da jornada.
- Ao entrar pela Home depois de qualquer resultado, a jornada recomeça na Rota 1 com o modo padrão.

`tools/validation/route-journey-terminal-tests.mjs` prova a regra (matriz R1–R3 × vitória/derrota × modos, leitor, tela de resultado, storage, lab, shell agnóstico), com contrafactual contra `7b740e4`; `route-journey-terminal-browser-probe.mjs` percorre Home → R1 → R2 → R3 (derrota, repetir) → vitória → Home no build de produção.

Runtime visual ativo:

- `public/models/route/board.glb`
- `public/models/route/wall.glb`
- `public/models/route/player.glb`
- `public/models/route/guardian.glb`
- `public/models/route/portal.glb`
- `public/models/route/light.glb`
- `public/models/route/trap.glb`
- `public/models/route/textures/*.png`

Contrato dos assets e regeneração ficam em `public/models/route/README.md`. Previews PNG da Rota não ficam mais em `public/`; foram arquivados em `docs/archive/route-previews/`.

`useEscapeMaze.ts`, `route-config.ts`, `route-geometry.ts`, `route-generation.ts`, `route-defenders.ts`, `route-invariants.ts`, `route-state.ts`, `route-events.ts` e `route-generation-job.ts` são regra de jogo. Não altere geração, dificuldade, portal, guardião, scoring ou fluxo sem missão explícita.

Validação da Rota (ROUTE-C0): os validadores carregam o **grafo de módulos** da Rota por `tools/validation/route-module-loader.mjs` — o hook e tudo o que ele importa, de uma mesma árvore (worktree ou `--rev`), uma instância por módulo — e acham cada binding privado no módulo que o declara. Eles não dependem de `useEscapeMaze.ts` continuar monolítico: desde ROUTE-C1 a configuração vem de `route-config.ts`, desde ROUTE-C2 a geração/certificação de `route-generation.ts` e as primitivas de `route-geometry.ts`, desde ROUTE-C3 a política dos defensores de `route-defenders.ts`, desde ROUTE-C4 os invariantes dinâmicos de `route-invariants.ts`, desde ROUTE-C5 o estado da sessão de `route-state.ts` (o harness de runtime ganhou um `useReducer` fiel ao React), desde ROUTE-C6 os eventos de domínio de `route-events.ts` (o driver de runtime ganhou um trace opcional, lido pelo grafo), desde ROUTE-C7A o checkpoint do fluxo seeded e o contrato de geração de `route-generation-job.ts` (o loader ganhou `routeRandomBeforeC7A`, a edição sancionada do seam), e os validadores (gerador instrumentado, harness de runtime, `validate-route-9x9`, `test-star-selection`, `final-acceptance`, `sentinel-runtime-equivalence`, `trap-strategy-tests`, `dynamic-solvability-02`…) as acham pelo grafo, sem mudança de superfície. O estado da sessão já é um reducer (ROUTE-C5) e o turno diz o que aconteceu por eventos de domínio tipados (ROUTE-C6, `route-events.ts`); os validadores observam o trace desses eventos pelo grafo, sem API de produção. Inventário, exceções declaradas e o gate de acoplamento: `tools/validation/README.md`.

## Circuito de Memória

Arquivos principais:

- `src/games/color-sequence/MemoryCircuit3DGame.tsx`
- `src/games/color-sequence/MemoryCircuitStage.tsx`
- `src/games/color-sequence/MemoryCircuitHud.tsx`
- `src/games/color-sequence/MemoryCircuitPadLayer.tsx`
- `src/games/color-sequence/MemoryCircuitAccessibleControls.tsx`
- `src/games/color-sequence/memoryCircuitLayout.ts`
- `src/games/color-sequence/memoryCircuitVisualState.ts`
- `src/games/color-sequence/useColorSequenceGame.ts`

Runtime visual ativo:

- `public/illustrations/memory-circuit/memory-room-bg.webp`
- `public/assets/memory-circuit/v2/memory-board.webp`
- `public/assets/memory-circuit/v2/overlay-flame.webp`
- `public/assets/memory-circuit/v2/overlay-wave.webp`
- `public/assets/memory-circuit/v2/overlay-leaf.webp`
- `public/assets/memory-circuit/v2/overlay-sun.webp`
- `public/assets/memory-circuit/v2/overlay-core.webp`
- `public/assets/memory-circuit/v2/overlay-complete.webp`
- `src/games/color-sequence/memory-circuit-visual.css`
- `src/games/color-sequence/MemoryCircuitWorldMark.tsx` (emblema SVG inline do mundo)

O contrato oficial do asset kit fica em `docs/MEMORY_CIRCUIT_ASSET_SPEC.md`. O caminho ativo é board mestre 2.5D + overlays transparentes + hitboxes reais. Assets antigos separados foram arquivados em `docs/archive/memory-circuit/`; o primeiro kit PNG (V1) está em `docs/archive/memory-circuit/legacy-kit-v1/`.

A cena mestre do Circuito (Home, transição, introdução, preparação) carrega os MESMOS arquivos de `public/assets/memory-circuit/v2/` que o jogo ativo — não há cópia derivada. Ver `docs/MEMORY_CIRCUIT_ASSET_SPEC.md` para a regra de fonte única e o motivo.

`useColorSequenceGame.ts` é regra de jogo. Não altere sequência, timing, tentativas, scoring, progressão, reward ou localStorage por motivo visual.

## Engine e libs compartilhadas

`src/engine/` contém lógica compartilhada e deve permanecer independente de UI:

- `scoring.ts` — fórmulas, limites e pontuação.
- `rewards.ts` — sinais de ativação, sucesso e cópia de recompensa.
- `storage.ts` — persistência em `localStorage`.
- `stage-progress.ts` — ordem e progresso das estações.
- `difficulty.ts` — suporte de dificuldade/IA da Rota.

`src/lib/` contém utilitários de UI/feedback:

- `game-sounds.ts`
- `feedback-motion.ts`
- `confetti.ts`
- `detail-labels.ts`

## Arquivos arquivados

`docs/archive/` guarda material histórico ou de revisão que não deve ser servido como runtime:

- `docs/archive/route-previews/` — previews PNG dos GLBs da Rota.
- `docs/archive/memory-circuit/` — protótipos visuais antigos do Circuito.
- `docs/archive/home-legacy/` — ilustração antiga da Home.

Não importe nada de `docs/archive/` no app. Se um asset voltar a ser runtime, mova para `public/` com uma missão explícita e atualize a documentação.

## Scripts Blender oficiais

Scripts ativos de geração visual:

- `tools/blender/create_memory_circuit_board.py`
- `tools/blender/create_memory_circuit_visual_v2.py`
- `tools/blender/create_route_board_glb.py`
- `tools/blender/create_route_wall_glb.py`
- `tools/blender/create_route_player_glb.py`
- `tools/blender/create_route_guardian_glb.py`
- `tools/blender/create_route_portal_glb.py`
- `tools/blender/create_route_light_glb.py`
- `tools/blender/create_route_trap_glb.py`
- `tools/blender/route_prop_asset_utils.py`
- `tools/assets/generate_route_board_textures.py`

Geradores com `--preview` podem recriar PNGs dentro de `public/`; esses previews não devem ser commitados como runtime sem nova decisão.

## Não apagar sem missão específica

Preserve obrigatoriamente:

- `docs/MINDFLOW_EXPERIENCE_BOOK.md`
- `src/games/escape-maze/useEscapeMaze.ts`
- `src/games/escape-maze/route-config.ts`
- `src/games/escape-maze/route-geometry.ts`
- `src/games/escape-maze/route-generation.ts`
- `src/games/color-sequence/useColorSequenceGame.ts`
- `src/games/index.ts`
- `src/data/worlds.ts`
- `src/data/activities.ts`
- `src/data/game-intros.ts`
- `src/engine/scoring.ts`
- `src/engine/rewards.ts`
- `src/engine/storage.ts`
- GLBs e texturas ativos em `public/models/route/`
- kit ativo do Circuito em `public/assets/memory-circuit/`
- `public/illustrations/memory-circuit/memory-room-bg.webp`
- `GameLayout`, `GameActions`, `StatusBanner`, `StatCard`
- `RewardResultModal` e `WorldEntryTransition`

## Dívidas restantes

- `globals.css` ainda tem CSS legado misturado com CSS ativo. Use `docs/CSS_CLEANUP_MAP.md` antes de qualquer limpeza e remova apenas com busca de referência e validação visual.
- `security-panel`, `number-trail` e `seed-garden` continuam ativos, mas ainda devem ser recriados no padrão visual atual em missões futuras.
- Home/Jornada ainda pode receber refinamento visual, mas sem quebrar o fluxo de entrada dos mundos.
- Rota Estratégica ainda tem dívidas de evolução visual e possíveis expansões futuras como 9x9/armadilha ativa, fora do escopo atual.
- Circuito de Memória ainda precisa de art pass fino, mas a arquitetura atual deve continuar modular e baseada no board mestre.

## Validação padrão

```bash
npm run lint
npx.cmd tsc --noEmit
npm run build
```

Se o build local falhar por ambiente/bundler, use `npx next build --webpack` apenas como fallback de diagnóstico.
