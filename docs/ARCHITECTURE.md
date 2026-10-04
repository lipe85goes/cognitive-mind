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
| Fonte única de aleatoriedade da Rota (`routeRandom`, `randomItem`) e o seed de diagnóstico | `src/engine/route-random.ts` |
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
- `src/games/escape-maze/RouteBabylonBoard.tsx`
- `src/games/escape-maze/routeBabylonScene.ts`

Divisão da lógica (ROUTE-C1 + ROUTE-C2 + ROUTE-C3 + ROUTE-C4):

| Módulo | Papel |
| --- | --- |
| `route-config.ts` | configuração estática (dados + helpers puros que só leem tabelas) |
| `route-geometry.ts` | primitivas puras de grid/grafo, compartilhadas por geração e runtime |
| `route-generation.ts` | geração + certificação de mapas |
| `route-defenders.ts` | política pura do Caçador e da Sentinela (como cada defensor decide) |
| `route-invariants.ts` | contrato puro de validade do estado lógico e de solvabilidade topológica (runtime) |
| `useEscapeMaze.ts` | estado React + orquestração do turno |

Grafo de dependências em tempo de execução (sem ciclos): `route-config` ← `route-geometry` ← {`route-generation`, `route-defenders`, `route-invariants`} ← `useEscapeMaze`. `route-generation` e `route-defenders` usam também `difficulty.ts` e o seam `route-random.ts`; `route-invariants` usa só configuração e geometria (nada de RNG, `difficulty.ts` ou defensores). `route-defenders` e `route-invariants` conhecem `MazeMap` só como tipo (`import type`), e `route-generation` não conhece os defensores nem os invariantes.


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
- O que ainda domina `useEscapeMaze.ts` (984 linhas, eram 1.113): o estado React e a orquestração do turno — `runDefenderPhase` (commit, captura, rollback da Segunda Chance), passo do Explorador, baú/escolha da recompensa, picareta, input (teclado/D-pad e a janela de 150 ms), fim de rota/continuação, mensagens e estatísticas. Reducer/eventos do turno (ROUTE-C5/C6) não foram feitos.

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

`useEscapeMaze.ts`, `route-config.ts`, `route-geometry.ts`, `route-generation.ts`, `route-defenders.ts` e `route-invariants.ts` são regra de jogo. Não altere geração, dificuldade, portal, guardião, scoring ou fluxo sem missão explícita.

Validação da Rota (ROUTE-C0): os validadores carregam o **grafo de módulos** da Rota por `tools/validation/route-module-loader.mjs` — o hook e tudo o que ele importa, de uma mesma árvore (worktree ou `--rev`), uma instância por módulo — e acham cada binding privado no módulo que o declara. Eles não dependem de `useEscapeMaze.ts` continuar monolítico: desde ROUTE-C1 a configuração vem de `route-config.ts`, desde ROUTE-C2 a geração/certificação de `route-generation.ts` e as primitivas de `route-geometry.ts`, desde ROUTE-C3 a política dos defensores de `route-defenders.ts`, desde ROUTE-C4 os invariantes dinâmicos de `route-invariants.ts`, e os validadores (gerador instrumentado, harness de runtime, `validate-route-9x9`, `test-star-selection`, `final-acceptance`, `sentinel-runtime-equivalence`, `trap-strategy-tests`, `dynamic-solvability-02`…) as acham pelo grafo, sem mudança de superfície. Ainda não há reducer/eventos do turno (ROUTE-C5/C6). Inventário, exceções declaradas e o gate de acoplamento: `tools/validation/README.md`.

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
