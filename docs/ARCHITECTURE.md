# MindFlow — Arquitetura Atual

Este documento descreve o estado real do projeto após as limpezas CLEAN-02, CLEAN-03, CLEAN-04 e CLEAN-05. Use como referência antes de mexer em Home, Jornada, Rota Estratégica, Circuito de Memória, assets ou jogos legados.

Regra de produto: leia `docs/MINDFLOW_EXPERIENCE_BOOK.md` antes de qualquer missão. A direção central é **Pensar em paz**. Para decisões visuais, use também `docs/MINDFLOW_VISUAL_SYSTEM.md`.

## Gameplay / Platform Lock v1

`GAMEPLAY_PLATFORM_LOCK_V1 = PASS` (2026-10-05, commit canônico `da551b1`):
Rota Estratégica v1, Circuito de Memória v1 e o contrato compartilhado da
plataforma v1 estão travados. Contratos, snapshot do grafo, matriz de
validação, baseline de bundle/performance, registro de dívidas classificadas e
política de mudança: `docs/GAMEPLAY_PLATFORM_LOCK_V1.md`. Gate:
`node tools/validation/gameplay-platform-lock-v1.mjs`.

- `v06-portal-requires-lights` continua a integração canônica; ROUTE-C0 a
  ROUTE-C7 (C7A/C7B/C7C) estão fechadas.
- Game 03 — Estúdio das Descobertas (`hidden-objects`) — é o segundo
  consumidor real da plataforma: skeleton V0 jogável desde GAME03-SKELETON-01,
  no slot da Trilha Lógica (aposentada); experiência V2 e pool de alvos V1
  (rodadas sorteadas por semente) em GAME03-EXPERIENCE-02. Ver "Estúdio das
  Descobertas (Game 03)" abaixo, `docs/GAME03_SKELETON_01.md` e
  `docs/GAME03_EXPERIENCE_02.md`. Regra: segundo consumidor primeiro,
  abstração depois.
- Rota 2.0 é uma fase posterior, separada da v1 (microsequência de captura,
  armadilha que altera o mapa, objetivos dependentes, mapa que muda em jogo,
  Caçador adaptativo — nada disso existe na v1).
- Depois do lock, mudança em Rota/Circuito/plataforma só por: correção de
  regressão, segurança/dependência, performance medida, missão Rota 2.0
  aprovada, ou requisito de plataforma achado pelo Game 03.

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
| Contrato transportável de uma geração (ROUTE-C7A): `RouteGenerationRequest`/`RouteGenerationResult`; desde ROUTE-C7C só a metade do realm que pede — `createRouteGenerationRequest` e `acceptRouteGenerationResult`, `MazeMap` só como tipo (não alcança `generateMaze`); usado só pelo client de geração | `src/games/escape-maze/route-generation-job.ts` |
| Metade do realm que gera (ROUTE-C7C, movida verbatim): `runRouteGenerationSync` (C7A: assume o fluxo do pedido, a ÚNICA chamada `generateMaze`, checkpoint final) e `runRouteGenerationLocally` (o executor local do C7B, só para tooling/contrafactual — nunca o binding do produto); importado só pelo Worker | `src/games/escape-maze/route-generation-runner.ts` |
| Entrada do Web Worker de geração (ROUTE-C7C): um comando → `runRouteGenerationSync` → uma resposta (pronta ou falha); a única raiz de execução de produção de `runRouteGenerationSync`/`generateMaze`; não importa UI, React, Babylon, sons, storage nem estado de sessão | `src/games/escape-maze/route-generation.worker.ts` |
| Executor da Rota (ROUTE-C7C): um Worker dedicado por comando (`new Worker(new URL("./route-generation.worker.ts", import.meta.url), { type: "module" })`), terminado na resposta, na falha ou no cancelamento; toda falha (construtor, `error`, `messageerror`, resposta malformada, Worker mudo) vira a resposta de falha do C7B, sem fallback local | `src/games/escape-maze/route-generation-worker-executor.ts` |
| Protocolo do Worker (ROUTE-C7C): `{ protocol, command }` → `{ protocol, response }` e a checagem de forma da resposta no main (tag, request id, `walls` como `Set`, fluxo `null` ou dois números) | `src/games/escape-maze/route-generation-worker-protocol.ts` |
| Seam assíncrono de geração da Rota (ROUTE-C7B): envelope de lifecycle (`RouteGenerationCommand` = request id + intent + request do C7A, `RouteGenerationResponse`), `RouteGenerationExecutor` e `startRouteGeneration` (latest-wins: confere o token e o id ANTES de aceitar o RNG); desde ROUTE-C7C `routeGenerationExecutor` é o executor Worker; importado só pelo hook | `src/games/escape-maze/route-generation-client.ts` |
| Estado do hook da Rota (ROUTE-C7B): a partida (`route: RouteRuntimeState \| null`, nula só antes do primeiro mapa da montagem) + onde está a geração do próximo mapa (`pending`/`ready`/`error`, com o alvo e o request id); reducer puro que delega as transições da partida ao `routeStateReducer`; importado só pelo hook | `src/games/escape-maze/route-session.ts` |
| Contrato de entrada dos jogos (readiness + watchdog; só metadados) | `src/games/entry-contract.ts` |
| Registro de jogos (contrato de entrada + loader do componente) | `src/games/index.ts` |
| Metadados visuais dos mundos | `src/data/worlds.ts` |
| Lista de atividades e estações | `src/data/activities.ts` |
| Intros dos jogos | `src/data/game-intros.ts` |
| Progresso por estação | `src/engine/stage-progress.ts` |
| Pontuação e limites | `src/engine/scoring.ts` |
| Resultado/recompensa | `src/engine/rewards.ts` |
| Persistência local | `src/engine/storage.ts` |
| Estúdio das Descobertas: a cena como dados (pool de alvos e metadados, estações, presets de dificuldade, sósias, camadas) | `src/games/hidden-objects/hidden-objects-scene.ts` |
| Estúdio: quais objetos uma rodada pede (seleção pura por dificuldade + semente) | `src/games/hidden-objects/hidden-objects-rounds.ts` |
| Estúdio: câmera, gestos e regras da sessão (puros) e o controlador DOM da câmera | `src/games/hidden-objects/hidden-objects-{camera,gesture,model,controller}.ts` |

Use `getWorldMeta(gameId)` para dados derivados de histórico salvo. Ele tem fallback seguro para resultados antigos ou ids desconhecidos — para um jogo aposentado (`number-trail`) o fallback é o Circuito, então a primeira tela que listar o histórico deve dar aos mundos aposentados um metadado de exibição próprio.

## Jogos ativos

| GameId | Nome atual | Estado |
| --- | --- | --- |
| `escape-maze` | Rota Estratégica | Jogo principal em foco. Usa Babylon + GLBs. |
| `color-sequence` | Circuito de Memória | Jogo de memória em foco. Usa palco 2.5D com board mestre e overlays. |
| `security-panel` | Central de Comandos | Ativo, mas ainda é jogo legado a recriar futuramente. |
| `hidden-objects` | Estúdio das Descobertas | Game 03 no slot da antiga Trilha: skeleton V0 (GAME03-SKELETON-01), experiência V2 e pool de alvos V1 (GAME03-EXPERIENCE-02, `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`); arte ainda gerada por script; o próximo passo depende do playtest humano 02. |
| `seed-garden` | Jardim de Sementes | Ativo, mas ainda é jogo legado a recriar futuramente. |

São exatamente esses cinco. Os dois jogos legados continuam compilando e aparecem no registry. Não remova `GameLayout`, `GameActions`, `StatusBanner` ou `StatCard` enquanto eles dependerem deles.

### Histórico da Trilha (`number-trail`, aposentada)

A Trilha Lógica deixou de ser jogo ativo em GAME03-SKELETON-01 (decisão humana registrada em `docs/GAME03_DISCOVERY_01.md` §20.4): saiu do `GameId`, do registry, do contrato de entrada, das estações e das tabelas de mundo/intro/Home/visual/maquete/recompensa; o componente foi removido e a arte da Home está em `docs/archive/number-trail-retired/`.

Resultados antigos com `gameId: "number-trail"` continuam no `localStorage` exatamente como foram gravados — compatibilidade de leitura, sem migração: nada os apaga, filtra ou converte em resultado do Estúdio, e um resultado novo só entra à frente da lista. Um id aposentado não abre nada (não tem loader, contrato nem atividade); como resultado mais recente, só deixa de pré-selecionar um mundo e a Home cai no primeiro do mapa. `hidden-objects-skeleton-tests.mjs` (H13) e o cenário `legacy` de `hidden-objects-browser-probe.mjs` fixam esse comportamento.

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
- `Central de Comandos`, `Estúdio das Descobertas` (no slot da antiga Trilha, mesma geometria) e `Jardim de Sementes` são os mundos secundários.

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
- `src/games/escape-maze/route-generation-client.ts`
- `src/games/escape-maze/route-session.ts`
- `src/games/escape-maze/RouteBabylonBoard.tsx`
- `src/games/escape-maze/routeBabylonScene.ts`

Divisão da lógica (ROUTE-C1 + ROUTE-C2 + ROUTE-C3 + ROUTE-C4 + ROUTE-C5 + ROUTE-C6 + ROUTE-C7A + ROUTE-C7B + ROUTE-C7C):

| Módulo | Papel |
| --- | --- |
| `route-config.ts` | configuração estática (dados + helpers puros que só leem tabelas) |
| `route-geometry.ts` | primitivas puras de grid/grafo, compartilhadas por geração e runtime |
| `route-generation.ts` | geração + certificação de mapas |
| `route-defenders.ts` | política pura do Caçador e da Sentinela (como cada defensor decide) |
| `route-invariants.ts` | contrato puro de validade do estado lógico e de solvabilidade topológica (runtime) |
| `route-state.ts` | estado mutável canônico da sessão (`RouteRuntimeState`) + reducer puro (`routeStateReducer`): COMO o estado muda |
| `route-events.ts` | contrato semântico tipado (`RouteDomainEvent`) + tradução determinística evento → transições do C5 (`routeStateActionsForEvent`): O QUE aconteceu |
| `route-generation-job.ts` | contrato de uma geração como dado (C7A); desde C7C só a metade do main: criar o pedido (checkpoint do fluxo seeded) e aceitar o resultado (continuar o fluxo); chamado só pelo client |
| `route-generation-runner.ts` | metade do realm que gera (C7C): `runRouteGenerationSync` (pedido → `generateMaze` → mapa + checkpoint) e o executor local do C7B para tooling; só o Worker o importa no produto |
| `route-generation.worker.ts` | entrada do Web Worker de geração (C7C): comando → runner → resposta |
| `route-generation-worker-executor.ts` | executor do produto (C7C): um Worker por comando, `terminate()` no cancelamento, falhas como resposta de falha |
| `route-generation-worker-protocol.ts` | as duas mensagens do Worker e a checagem de forma da resposta (C7C) |
| `route-generation-client.ts` | seam assíncrono da geração (C7B): comando/resposta com request id, executor substituível (o Worker desde C7C), aceitação latest-wins (confere, DEPOIS aceita o RNG, DEPOIS entrega o mapa) |
| `route-session.ts` | estado do hook (C7B): a partida do C5 (ou nenhuma, antes do primeiro mapa) + o lifecycle da geração do próximo mapa (pending/ready/error); reducer puro |
| `useEscapeMaze.ts` | adaptador React/orquestrador do domínio: decide QUAL evento aconteceu e em QUE ORDEM, aplica-o pelo seam `applyDomainEvent`, roda os efeitos e o `onComplete`, calcula as views derivadas |

Grafo de dependências em tempo de execução (sem ciclos): `route-config` ← `route-geometry` ← {`route-generation`, `route-defenders`, `route-invariants`} ← `useEscapeMaze`, e `route-state` ← `route-session` ← `useEscapeMaze` (desde C7B o hook conhece `route-state` só como tipo), e `route-events` ← `useEscapeMaze`, e `route-generation-job` ← `route-generation-client` ← `useEscapeMaze` com `route-generation-worker-protocol` ← `route-generation-worker-executor` ← `route-generation-client` (main thread, C7B/C7C), e — em OUTRO realm, o Worker — `route-generation` ← `route-generation-runner` ← `route-generation.worker` (C7C). Desde C7C nenhum módulo da main thread importa `route-generation` em tempo de execução (o job, o client, o hook e os demais conhecem `MazeMap` só como tipo; o reexport `generateMaze` do hook saiu): a geração só é alcançada pelo Worker. `route-generation` e `route-defenders` usam também `difficulty.ts` e o seam `route-random.ts`; `route-invariants` usa só configuração e geometria (nada de RNG, `difficulty.ts` ou defensores). `route-state` não importa nada em tempo de execução: conhece `SentinelState`, `MazeMap`, `GameStatus`/`ChestReward` e os tipos do jogo só como tipos. `route-events` também não: conhece `RouteStateAction`/`RouteSessionStart` (de `route-state`), `SentinelState`, `ChestReward` e `GridPosition` só como tipos — nem `route-generation`, nem RNG, nem React. `route-defenders`, `route-invariants` e `route-state` conhecem `MazeMap` só como tipo (`import type`), e `route-generation` não conhece os defensores, os invariantes nem o estado.


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
- ROUTE-C7B (lifecycle assíncrono da geração, ainda na main thread): `useEscapeMaze` não depende mais de "`generateMaze` termina antes da próxima linha". Ele PEDE cada mapa — o da montagem, Start, Restart, troca de modo — e só abre a sessão quando o mapa chega. Zero chamadas diretas a `generateMaze` (ou a qualquer função do job) no hook; ele só conversa com `route-generation-client.ts`.
- Estado (ownership): uma única fonte, um `useReducer(routeSessionReducer)` com `RouteSessionState = { route, generation, requests }` (`route-session.ts`). `route` é a partida do C5 (`RouteRuntimeState`), `null` apenas antes do primeiro mapa aceito da montagem — sem mapa falso/placeholder: o hook devolve então só `routeNumber`, `routeProgression`, `mazeMap: null` e o lifecycle. `generation` é `ready` | `pending` | `error`; pendente/erro carregam o alvo (`requestId`, `intent` = `mount`/`start`/`restart`/`difficulty`, modo, status em que a sessão abre). `requests` é o contador monotônico de request ids da instância. O mapa existe em um só lugar (`route.mazeMap`): não há `pendingMazeMap`, ref ou `useState` paralelo. O reducer é puro (importa só `route-state`), delega as 11 transições da partida ao `routeStateReducer` (inalterado) e as recusa enquanto um mapa está pendente/falhou. Aceitar um mapa é UMA transição: `START_ROUTE` (via o mesmo evento `ROUTE_STARTED` do C6) instala a sessão e marca a geração `ready`; o mapa da montagem entra como `INITIAL_ROUTE` = o mesmo `createRouteState` do antigo inicializador (valor de partida, não evento). As outras ações do lifecycle (`GENERATION_REQUESTED`, `GENERATION_RETRIED`, `GENERATION_FAILED`) são infraestrutura, não `RouteDomainEvent`: nenhum `MAP_GENERATED`, `route-events.ts` intocado.
- Lifecycle (controle de efeito): um único `useEffect` chaveado na geração pendente roda `startRouteGeneration(routeGenerationExecutor, { requestId, intent, difficulty, routeNumber }, { onReady, onFailed })` e devolve o `withdraw` como cleanup. Latest-wins, unmount e Strict Mode saem da semântica de efeito do React: um pedido novo é uma `generation` nova e o cleanup do efeito anterior retira o pedido anterior; sair da Rota (Home, continuação, desmontagem) retira o pendente; o mount → cleanup → mount do Strict Mode retira o primeiro pedido antes de ele rodar e repete o pedido (mesmo request id). O token é a execução do efeito (o `withdraw` de cada `startRouteGeneration`), não o id: uma instância nova reinicia ids em 1 e mesmo assim nenhuma resposta da instância anterior entra nela (provado com respostas de mesmo id).
- Executor local (`runRouteGenerationLocally`): `setTimeout(…, 0)` — fronteira assíncrona real (o commit de "pendente" acontece antes do cálculo, e o browser pode pintar entre as tasks); cancelar antes de rodar limpa o timer de verdade (a geração nunca roda e nunca toca o RNG); depois de começar, JS síncrono não é interrompível e a resposta é ignorada pelo token — sem cancelamento cooperativo fingido. O executor é callback (`(command, deliver) => cancel`), não Promise: é o formato de uma mensagem de Worker, e entregar na mesma task em que a resposta chega não deixa microtask em que um pedido retirado ainda pareça vivo. `routeGenerationExecutor` é o único binding que a C7C troca pelo Worker; o hook não conhece `postMessage`/Worker.
- RNG: pedido criado no main (`createRouteGenerationRequest`, checkpoint do C7A) → executor → resposta → `startRouteGeneration` confere token e id → SÓ ENTÃO `acceptRouteGenerationResult` continua o fluxo seeded → `onReady(map)` → commit. Uma resposta obsoleta nunca restaura seu checkpoint no realm principal. Seeded: o Caçador continua exatamente de onde a geração parou (mesmos mapas e decisões do C7A); jogo normal continua `Math.random`, sem seed inventado.
- Pendente/erro na UI: enquanto um mapa está pendente ou falhou, a partida na tela congela — movimento, recompensa, picareta, Start, defensores, fim de rota e sorteios de runtime são no-ops (guarda `if (awaitingRoute) return;` nas três entradas do turno + o reducer recusa), os botões ficam `disabled`, o quadro não sugere movimentos, e a mensagem do objetivo diz "Preparando a rota…" (ou "Não foi possível preparar esta rota." com "Tentar novamente", visível também com Detalhes aberto, onde fica o Restart). Restart e troca de modo podem substituir um pedido pendente (só o último aparece); Start não. `GameStatus` continua `setup`/`playing`/`won`/`lost`: o lifecycle é `generationPhase` (+ `requestedDifficulty`, `retryGeneration`) no retorno do hook. Sem som, `onComplete` ou pontuação no lifecycle. Pronto o mapa, a interface volta exatamente à de antes (provado nó a nó).
- Primeiro mapa e entrada: `RouteStrategyGame` virou o componente externo (código do board carregado em paralelo, hook, tela calma de preparo/erro do primeiro mapa) sobre `RouteSessionView` (a view de sempre); o board Babylon só monta depois do primeiro mapa aceito, então a readiness da entrada inclui a geração. Se o primeiro mapa falha, a entrada ouve `onEntryError` uma vez (o watchdog não espera até estourar) e o retry da entrada (sessão nova) gera de novo; falha de geração depois da entrada fica dentro da Rota com retry próprio (novo request id, mesmo modo/Rota/intent). Falha do chunk do board continua independente (retry do board); sair durante a geração pendente não monta board atrasado.
- Launcher (lab): a sessão ativa passou a ser dona do seed — `useLayoutEffect` arma o seed da sessão e o desarma no cleanup (troca de sessão, saída, unmount da página); o `useEffect(() => clearRouteRandomSeed, [])` da página saiu, porque um re-run dele (Strict Mode/Fast Refresh) podia desarmar DEPOIS do arm e mandar a primeira geração sem seed. Todo layout effect de um commit roda antes do primeiro passive effect, então o pedido da Rota (passive) sempre leva o seed da sessão. O fluxo normal do produto não mudou.
- C7B NÃO usa Worker e AINDA BLOQUEIA A MAIN THREAD durante o cálculo local: ela muda QUANDO a geração roda (uma macrotask depois do commit de pendente), não ONDE. Não há ganho de performance; ele só chega com a C7C (executor Worker). Overhead medido (informativo, Node): agendamento p50 ≈ 1 ms; o cálculo continua o mesmo (dezenas a centenas de ms, na main thread). No browser de produção (SwiftShader headless) o estado pendente dura ~60–200 ms e nenhum frame de animação foi observado dentro dele: a "oportunidade de pintura" garantida é a fronteira de macrotask, não uma pintura medida.
- Prova: `tools/validation/route-generation-lifecycle-tests.mjs` (contra `e8971eb`): gate estático, edição sancionada exata (`routeHookBeforeC7B`/`routeGameBeforeC7B`/`routeVisualBeforeC7B` devolvem `e8971eb` byte a byte), lifecycle no shim e no React real (dev Strict Mode e produção: latest-wins fora de ordem, RNG obsoleto, unmount, token por instância, Strict Mode, erro/retry, continuação, launcher seeded), equivalência do estado pronto com `e8971eb` (shim, React real em 4 configurações, sessões seeded) e a view real (`RouteStrategyGame` e o launcher pelo reconciler do React) nó a nó depois de cada mapa aceito; contrafactual (`--rev=e8971eb`) e mutantes. `route-generation-lifecycle-browser-probe.mjs` cobre o build de produção. Próximo passo: C7C = executor Worker (troca só `routeGenerationExecutor`).
- ROUTE-C7C (a geração sai da main thread): `routeGenerationExecutor` deixou de ser o executor local e passou a ser `runRouteGenerationInWorker` (`route-generation-worker-executor.ts`). `generateMaze` e toda a certificação rodam num Web Worker dedicado (`route-generation.worker.ts`, construído com `new Worker(new URL("./route-generation.worker.ts", import.meta.url), { type: "module", name: "rota-generation" })`, que o Turbopack transforma num chunk próprio). O lifecycle do C7B não mudou — `route-session`, request ids, pending/error/retry, intent, reducer, efeito do hook e UI são os mesmos, byte a byte: ele continua vendo pedido → pendente → resposta → checagem de latest-wins → aceite do RNG → pronto/erro; só mudou ONDE `runRouteGenerationSync` executa.
- Ownership do Worker: UM Worker por comando, criado quando o efeito do hook pede (nunca na avaliação do módulo nem no SSR), terminado assim que responde, falha ou é cancelado. Escolha medida, não presumida: o start-up de um Worker é pequeno perto da geração (ver números abaixo) e a geração só acontece em montagem/Start/Restart/troca de modo. Com isso: cancelamento é real em qualquer instante (`terminate()` interrompe um `generateMaze` no meio — um pedido substituído nunca atrasa o seguinte; um Worker persistente teria de terminar a geração velha primeiro, e uma mensagem de cancel só seria lida depois dela, por isso não existe "cancel message"); a identidade de uma resposta é o Worker de onde ela veio, então duas instâncias do hook com request id 1 (ids recomeçam por instância) nunca compartilham Worker e não é preciso id de transporte (o request id do C7B continua conferido no executor e no `startRouteGeneration`); nada sobrevive ao comando (unmount, cleanup do Strict Mode e pedido substituído terminam o Worker).
- Protocolo (`route-generation-worker-protocol.ts`): main → Worker `{ protocol: "rota-generation/1", command }` (o `RouteGenerationCommand` do C7B, intacto), Worker → main `{ protocol, response }` (a `RouteGenerationResponse` do C7B). Tudo structured-clone-safe; o `MazeMap` volta com `walls` como `Set`, na mesma ordem. A checagem de forma no main exige a tag, o request id do comando, `walls instanceof Set`, `grid` array, fluxo `null` ou dois números, e falha com mensagem; o resto (o fluxo é o do pedido?) é do `acceptRouteGenerationResult`.
- Erros: construtor que lança (sem suporte a Worker, CSP), script que não carrega ou lança (`error`), comando ilegível no Worker (o Worker lança de propósito → `error`), resposta ilegível (`messageerror`), resposta malformada, e o Worker que nunca responde (único caso sem evento: falha depois de `ROUTE_GENERATION_WORKER_TIMEOUT_MS` = 30 s) viram TODOS a resposta de falha do C7B → erro calmo → Retry (novo request id, novo Worker). Um `generateMaze` que lança no Worker é respondido como falha, com a mensagem dele. Não há fallback silencioso para gerar na main thread: ele esconderia um problema de deploy/CSP atrás do mesmo bloqueio que a C7C remove. O executor nunca entrega de forma síncrona nem depois do cancel.
- RNG seeded (exato): main `createRouteGenerationRequest` (checkpoint atual, com o seed do launcher já armado pelo layout effect da sessão) → Worker restaura o checkpoint → `generateMaze` → checkpoint final → main confere token/latest → SÓ ENTÃO `acceptRouteGenerationResult` restaura o checkpoint final → o Caçador continua exatamente do próximo sorteio. Uma resposta obsoleta (mesmo já chegada, mesmo com o Worker terminado, mesmo depois do unmount) nunca chama `acceptRouteGenerationResult`.
- RNG em jogo normal: sem seed, `request.random === null`; o Worker sorteia do SEU `Math.random` e o realm principal não tem checkpoint nem tenta reproduzir o fluxo invisível do Worker. Distribuição e probabilidades iguais; diagnósticos seeded exatos; jogo normal NÃO é igual em valor à antiga sequência oculta de `Math.random` da main thread (decisão C7/C7A). Nada de seed inventado, pré-geração de números ou RPC de sorteio.
- Split protocolo/runner: o job do C7A ficou só com a metade do main (`createRouteGenerationRequest`, `acceptRouteGenerationResult`, tipos; `MazeMap` como tipo), e `runRouteGenerationSync` + o executor local do C7B foram movidos verbatim para `route-generation-runner.ts`, que só o Worker importa no produto (o executor local fica para tooling/contrafactual, nunca como binding). O reexport histórico `generateMaze` do hook saiu: nenhum módulo do produto o importava, e ele mantinha a geração inteira no chunk da Rota na main thread (`e.i(...)` no chunk do hook). Grafo da main: hook → client → {job, executor Worker → protocolo} — sem `route-generation`, sem runner. Grafo do Worker: entrada → {runner → `route-generation` → config/geometria/`difficulty`/`route-random`, protocolo}; nada de React, UI, Babylon, CSS, sons, storage, shell, `route-state`, `route-events` ou sessão.
- Babylon e render continuam na main thread/GPU como antes; a C7C não toca o board, a cena nem OffscreenCanvas — resolve SOMENTE o bloqueio da geração. Gameplay depois do mapa pronto é o mesmo (sessões seeded idênticas ao bd75e69 render a render).
- Bundle (produção, `route-generation-bundle-audit.mjs`): Home inicial 236,8 KB gzip (inalterada, sem geração, sem Babylon); conjunto lazy da Rota na main 20,7 → 18,4 KB gzip (60,5 → 54,2 KB raw), sem a geração; chunk(s) do Worker 11,4 KB gzip (bootstrap do Turbopack 0,6 + runtime do Worker 3,8 + geração/certificação 7,2), o ÚNICO lugar com a geração; Babylon 1,73 MB gzip, inalterado e lazy (só quando o board monta). Duplicação inevitável e pequena (~8,2 KB raw): `route-random`, `route-config`/`difficulty`/`route-geometry`, que os dois realms usam (o hook e o Caçador na main, a geração no Worker); o Turbopack ainda emite um módulo de URL de asset não referenciado (uma linha) e uma cópia estática do `.ts` da entrada, nunca carregados.
- Medido (informativo, Chromium headless/SwiftShader, primeiro mapa — pendente → aceito, antes do board Babylon montar —, 20 amostras por taxa, `route-generation-worker-performance-probe.mjs`): C7B (local, main thread) gastava p50 36 / 156 / 210 ms de CPU de geração na main a 1× / 4× / 6× e tinha Long Task em 8/19, 16/19 e 18/19 das amostras quentes (máx. 93 / 317 / 883 ms). C7C: 0 ms de CPU de geração na main e 0/19 amostras com Long Task nas três taxas; o heartbeat de 10 ms da main continua rodando enquanto o Worker calcula (p50 7–11 batidas por janela). O mapa chega do Worker em p50 82 / 136 / 127 ms (construção → resposta, quente); a janela total é um pouco maior que a do C7B a 1× (p50 87 vs 39 ms: start-up do Worker + cálculo em paralelo) e menor a 6× (187 vs 256 ms). Start-up do Worker (trace: construção → primeira amostra da geração na thread do Worker) ~20–55 ms, frio ou quente; nenhuma amostra de CPU da geração na thread principal (trace do Chromium, entrada fria, entrada quente, Restart). Três de 57 amostras quentes da C7C tiveram uma parada de ~1,5–2 s do processo inteiro (o Worker atrasou junto, nenhuma Long Task registrada) — escalonamento do ambiente de 4 núcleos com SwiftShader, não trabalho na main. O throttling de CPU do CDP também desacelera o Worker dedicado neste Chromium, mas não necessariamente na mesma proporção.
- Prova: `tools/validation/route-generation-worker-tests.mjs` (contra `bd75e69`): gate estático (binding do produto, entrada do Worker, protocolo fechado, grafo do Worker só de geração, grafo da main sem geração, nenhum Worker na avaliação de módulo/SSR, URL estática, sem fallback), edição sancionada exata (`routeFileBeforeC7C` devolve `bd75e69` byte a byte; run e executor local movidos byte a byte; demais arquivos do produto intocados), o executor REAL com a entrada REAL do Worker num host de Workers (um realm por Worker, `structuredClone`, relógio virtual; pronto, erro de geração, construtor, script, `messageerror` dos dois lados, respostas malformadas, Worker mudo, cancel antes e durante a geração, resposta enfileirada após cancel, colisão de request id entre instâncias, RNG obsoleto), o hook real com o binding do produto (primeiro mapa, Start/Restart, Restarts e modos rápidos sem esperar os substituídos, unmount, 200 Restarts sem vazar Worker, erro → Retry em Worker novo, continuação), 27 sessões seeded idênticas ao `bd75e69` render a render e checkpoint a checkpoint, jogo normal sem fluxo, isolado `node:worker_threads` real; 12 mutantes. `route-generation-worker-browser-probe.mjs` cobre o build de produção (trace por thread, Worker real, falhas, vazamento, launcher seeded no `next dev`).

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

Validação da Rota (ROUTE-C0): os validadores carregam o **grafo de módulos** da Rota por `tools/validation/route-module-loader.mjs` — o hook e tudo o que ele importa, de uma mesma árvore (worktree ou `--rev`), uma instância por módulo — e acham cada binding privado no módulo que o declara. Eles não dependem de `useEscapeMaze.ts` continuar monolítico: desde ROUTE-C1 a configuração vem de `route-config.ts`, desde ROUTE-C2 a geração/certificação de `route-generation.ts` e as primitivas de `route-geometry.ts`, desde ROUTE-C3 a política dos defensores de `route-defenders.ts`, desde ROUTE-C4 os invariantes dinâmicos de `route-invariants.ts`, desde ROUTE-C5 o estado da sessão de `route-state.ts` (o harness de runtime ganhou um `useReducer` fiel ao React), desde ROUTE-C6 os eventos de domínio de `route-events.ts` (o driver de runtime ganhou um trace opcional, lido pelo grafo), desde ROUTE-C7A o checkpoint do fluxo seeded e o contrato de geração de `route-generation-job.ts` (o loader ganhou `routeRandomBeforeC7A`, a edição sancionada do seam), desde ROUTE-C7B o lifecycle assíncrono de `route-generation-client.ts`/`route-session.ts` (o harness de runtime roda efeitos, drena timers virtuais e memoiza como o React; o driver do React real deixa o mapa chegar dentro do input, separa os commits do lifecycle e alinha o Strict Mode; o loader ganhou `treeBeforeC7B`, a edição sancionada do hook, da view e do CSS), desde ROUTE-C7C o segundo realm da Rota — a entrada do Worker (`route-generation.worker.ts`) é uma raiz do grafo ao lado do hook, `import.meta.url` compila para a URL do módulo, `loadRouteModules` liga o executor da Rota ao executor local do runner no realm do validador (`generationExecutor: "product"` mantém o Worker) e `treeBeforeC7C` é a edição sancionada do job, do client e do hook, sob a qual `treeBeforeC7B` passou a ler), e os validadores (gerador instrumentado, harness de runtime, `validate-route-9x9`, `test-star-selection`, `final-acceptance`, `sentinel-runtime-equivalence`, `trap-strategy-tests`, `dynamic-solvability-02`…) as acham pelo grafo, sem mudança de superfície. O estado da sessão já é um reducer (ROUTE-C5) e o turno diz o que aconteceu por eventos de domínio tipados (ROUTE-C6, `route-events.ts`); os validadores observam o trace desses eventos pelo grafo, sem API de produção. Inventário, exceções declaradas e o gate de acoplamento: `tools/validation/README.md`.

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

## Estúdio das Descobertas (Game 03)

Skeleton V0 (GAME03-SKELETON-01) e experiência V2 + pool de alvos V1 (GAME03-EXPERIENCE-02), fora do lock como os legados: é o segundo consumidor da plataforma, não um contrato travado. Registro completo — arquitetura, alvos, dificuldade, câmera, gestos, medições, `TO_VALIDATE_IN_SKELETON` e o protocolo `GAME03_FUN_GATE` — em `docs/GAME03_SKELETON_01.md`; a experiência V2, o pool, as rodadas, a justiça medida e o que fica para o playtest humano 02 em `docs/GAME03_EXPERIENCE_02.md`; decisões de produto em `docs/GAME03_DISCOVERY_01.md`.

Arquivos (`src/games/hidden-objects/`):

- `hidden-objects-scene.ts` — a cena como dados (3200×1600 su, estações, pool de 18 alvos autorais com tier, estação, região e textos de lista/pista, 11 sósias, presets 5/6/8, camadas);
- `hidden-objects-rounds.ts` — a seleção da rodada, pura: (dificuldade, semente) → lista; mistura exata de tiers, distribuição pelas três estações, só o que o estilo de lista mostra; toda rodada válida igualmente provável; sem `Math.random` nem relógio;
- `hidden-objects-camera.ts`, `hidden-objects-gesture.ts`, `hidden-objects-model.ts` — câmera, reconhecedor TAP/DRAG/PINCH e regras da sessão, puros;
- `hidden-objects-controller.ts` — Pointer Events, roda, teclado e `ResizeObserver` ligados à câmera sem React; escreve o `transform` só dentro de `requestAnimationFrame`;
- `HiddenObjectsScene.tsx`, `HiddenObjectsGame.tsx`, `hidden-objects.css` (`.hos-*`).

Contrato com a plataforma: `GameId` `hidden-objects`; loader com `import()` literal (chunk próprio, nada no grafo inicial da Home); `readiness: "explicit"` com o watchdog padrão (pronto só depois de as camadas essenciais decodificarem e de uma oportunidade de pintura; falha de camada → `onEntryError`); sem continuação; resultado com `score` = objetos encontrados e `details` `{ difficulty, foundObjects, totalObjects, completed, sceneId, roundSeed }` (a semente, com a dificuldade, refaz a mesma lista). A semente da rodada é a única aleatoriedade do jogo: um `crypto.getRandomValues` por "Explorar"; "Recomeçar" mantém a lista. A tela de resultado lê a apresentação do jogo em `rewards.ts` (`getResultPresentation`: rótulo do placar, detalhes listados, nomes dos modos — classe 5 do lock). Não importa nada da Rota, do Circuito nem Babylon.

Runtime visual: `public/assets/hidden-objects/explorer-studio/v1/` (prancha, janela, dois primeiros planos, 18 miniaturas, arte de transição) e a maquete da Home em `public/illustrations/home/dioramas/discovery/`, todos gerados por `tools/assets/create_hidden_objects_scene.mjs` (determinístico — o grão tem semente —, lê as regiões da cena; `--audit` mede visibilidade, contraste e borda de cada alvo em `docs/archive/hidden-objects/explorer-studio/review/v1/fairness.json`). Pasta versionada: arte nova é pasta nova, nunca sobrescrita.

Validação: `node tools/validation/hidden-objects-skeleton-tests.mjs` e `node tools/validation/hidden-objects-experience-tests.mjs` (cada um com `--counterfactuals` para as bases e os mutantes), `node tools/validation/hidden-objects-round-fairness.mjs` (relatório de justiça das rodadas) e `node tools/validation/hidden-objects-browser-probe.mjs` (build de produção; `--scenario` roda qualquer cenário sozinho).

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
- `docs/archive/number-trail-retired/` — arte da Home da Trilha Lógica aposentada.
- `docs/archive/hidden-objects/explorer-studio/` — mockup conceitual (só referência) e pranchas de revisão do Estúdio.
- `docs/archive/game03-skeleton-01/` — testemunhas visuais e o registro do probe do skeleton do Game 03.
- `docs/archive/game03-experience-02/` — testemunhas, registro do probe V2, cenários rodados sozinhos e o relatório de justiça das rodadas do Game 03.

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

Arte provisória do Estúdio das Descobertas (sem Blender): `tools/assets/create_hidden_objects_scene.mjs`.

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

- Registro classificado (BLOCKER / POST-LOCK / ROTA-2.0 / DEV/TOOLING) do Gameplay/Platform Lock v1: `docs/GAMEPLAY_PLATFORM_LOCK_V1.md` §9.
- `globals.css` ainda tem CSS legado misturado com CSS ativo. Use `docs/CSS_CLEANUP_MAP.md` antes de qualquer limpeza e remova apenas com busca de referência e validação visual.
- `security-panel` e `seed-garden` continuam ativos, mas ainda devem ser recriados no padrão visual atual em missões futuras; `number-trail` foi aposentado em GAME03-SKELETON-01. O CSS que só a Trilha usava (`.logic-*`, `.game-world-logic`, `.reward-world-number-trail` em `globals.css`) ficou sem consumidor e sai numa limpeza de CSS própria (`docs/CSS_CLEANUP_MAP.md`).
- Estúdio das Descobertas: arte definitiva, recortes de "encontrado", som e segunda cena dependem do playtest humano 02 (`docs/GAME03_EXPERIENCE_02.md` §10–§11); a primeira tela que listar o histórico precisa de metadado de exibição para mundos aposentados.
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
