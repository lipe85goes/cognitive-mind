# MindFlow — Gameplay / Platform Lock v1

`GAMEPLAY_PLATFORM_LOCK_V1 = PASS`

Missão: MINDFLOW-GAMEPLAY-PLATFORM-LOCK-V1. Pergunta única que este documento
responde: **a base atual está suficientemente estável, validada e documentada
para congelarmos a v1 e começar o Game 03 sem carregar dúvida arquitetural?**
Resposta: sim — nenhum BLOCKER real foi encontrado; as dívidas restantes estão
classificadas abaixo (§9).

Esta missão não criou feature, não refatorou o produto, não iniciou o Game 03
nem a Rota 2.0. **Nenhum arquivo de `src/` foi alterado.** Mudou só
documentação e o tooling de validação estritamente necessário (o gate do lock e
a declaração dele no gate de acoplamento). Nenhuma evidência em `docs/archive/`
foi alterada.

Gate automático do lock: `node tools/validation/gameplay-platform-lock-v1.mjs`
(§13). Ele é um manifesto/checksum de contratos — não um segundo CORE.

---

## 1. Canonical commit

Canonical commit: `da551b17eddbf0a156228c7e2a5fc9ca178180c9`

- `da551b1 perf(route): move generation to worker` (ROUTE-C7C) — HEAD de
  `v06-portal-requires-lights` (integração canônica) e base desta missão.
- O commit do lock (`chore(platform): lock gameplay platform v1`, branch
  `chore/gameplay-platform-lock-v1`) fica em cima dele e só acrescenta
  documentação e tooling; o código de produto travado é exatamente o de
  `da551b1`.

## 2. Lock date

Lock date: 2026-10-05.

Ambiente da validação: container de nuvem Linux (4 vCPU, 15 GB), Node 22.22.0,
npm 10.9.4 (`npm ci` limpo a partir do `package-lock.json`), Next 16.3.6
(Turbopack), Chromium 1194 headless com SwiftShader (sem GPU) via Playwright
1.56.1.

## 3. Games covered

| GameId | Nome | Escopo do lock |
| --- | --- | --- |
| `escape-maze` | Rota Estratégica | **v1 travada** (contrato §4.1) |
| `color-sequence` | Circuito de Memória | **v1 travado** (contrato §4.2) |
| plataforma | App Shell, GameScreen, registry, entrada, resultado, persistência, Home | **contrato v1 travado** (§4.3) |
| `security-panel`, `number-trail`, `seed-garden` | jogos legados | **fora do lock** — continuam ativos e compilando; serão recriados em missões próprias (dívida D11) |

> **Pós-lock — GAME03-SKELETON-01 (classe 5 do §12):** `number-trail` foi
> aposentado como jogo ativo e o Estúdio das Descobertas (`hidden-objects`)
> ocupou o slot dele; o produto continua com cinco jogos ativos. O Estúdio fica
> fora deste lock, como os legados — é o segundo consumidor da plataforma, não
> um contrato travado —, e a dívida D11 perde os 3 timers da Trilha. Nenhum
> contrato do §4 mudou (o gate segue verde). Ver `docs/GAME03_SKELETON_01.md`.
>
> **Pós-lock — GAME03-EXPERIENCE-02 (classe 5 do §12):** a tela de resultado
> ganhou apresentação por jogo como metadado, pedida pelo segundo consumidor
> real: `ResultPresentation` em `src/engine/rewards.ts` (rótulo do placar,
> detalhes listados, nomes dos modos; `getResultPresentation`) e
> `formatResultDetails` em `src/lib/detail-labels.ts`, lidos pelo
> `RewardResultModal`. Um jogo sem `presentation` aparece exatamente como antes —
> Rota, Circuito, legados e resultados antigos da Trilha
> (`hidden-objects-experience-tests.mjs` E15). Isso paga a parte de
> rótulo/detalhes da D14; o ramo da Rota no modal (`routeNumber`,
> `journeyCompleted`) continua como estava. Nenhum contrato do §4 mudou (o gate
> segue verde). Ver `docs/GAME03_EXPERIENCE_02.md`.

## 4. Frozen contracts

### 4.1 Rota Estratégica v1 — contrato de produto

Jornada (fonte única: `src/games/escape-maze/continuation.ts`,
`ROUTE_JOURNEY_FINAL_ROUTE = 3`, `nextJourneyRoute`, `readRouteContinuation`):

| Rota | Vitória | Derrota |
| --- | --- | --- |
| 1 | Rota 2 | Rota 2 |
| 2 | Rota 3 | Rota 3 |
| 3 | jornada concluída (sem `continuation`, `details.journeyCompleted: true`, "Jornada concluída" → "Voltar aos mundos") | Rota 3 de novo |

- Exatamente 3 Rotas no produto; nenhuma continuação abre Rota 4+ (o leitor só
  aceita 1–3; malformado = entrada nova na Rota 1). Toda entrada pela Home
  recomeça na Rota 1, modo padrão, com intro.
- Modos: `easy` / `medium` / `hard` (rótulos "Mais aberto" / "Equilibrado" /
  "Mais caminhos"); o modo viaja com a continuação (R1 → R2 → R3 no mesmo modo,
  intro pulada).
- Tabuleiro 9×9; geração + certificação atuais (`route-generation.ts`:
  `generateMaze(difficulty, routeNumber)` devolve mapa certificado ou lança;
  orçamento, templates, luzes, armadilhas, separação e caminho mínimo de
  `route-config.ts`).
- Baú com exatamente duas recompensas: **Picareta** (abre, uma vez, qualquer
  parede interna vizinha ao Explorador — a dificuldade é escolher qual) e
  **Segunda Chance** (1 carga; resiste a uma captura).
  `ChestReward = "pickaxe" | "second-chance"`.
- Armadilhas atuais: o passo do Explorador arma a armadilha (`TRAP_ARMED`,
  observacional); armadilha armada bloqueia os defensores; não altera o mapa.
- Caçador atual (`chooseGuardianMove`, inclusive o ramo aleatório 0.45 do
  fácil) e Sentinela atual (`decideSentinelMove`: zona do portal, coleira,
  horizonte, compromisso de 3 turnos) — política pura em `route-defenders.ts`.
- Solvabilidade dinâmica atual: `inspectDynamicMazeState` (26 códigos de issue,
  "solvable" topológico — defensores móveis não são paredes).
- Estado: `RouteRuntimeState` + `routeStateReducer` com 11 ações (C5); eventos
  de domínio: união fechada de 13 tipos (C6).
- Geração assíncrona (C7B: pending / ready / error + Retry, latest-wins) em Web
  Worker dedicado (C7C: um Worker por comando, `terminate()` no cancelamento,
  sem fallback para a main thread).
- Resultado/persistência: `onComplete(Omit<GameResult, "id" | "playedAt">)` com
  `details` (turns, won, luzes, bloqueios, erros, modo, routeNumber,
  nextRouteNumber/nextRouteStage ou journeyCompleted) e `continuation`
  (`kind: "escape-maze-route"`); salvo pelo shell em `localStorage`
  (`cognitive-mind-recent-results`, máx. 12).

**Não pertencem à v1 — ficam para a Rota 2.0 (não implementados, dívida D16):**
microsequência de morte/captura; armadilha alterando o mapa; objetivos
dependentes; mapa mudando durante o jogo; Caçador adaptativo/interceptador;
qualquer outra mudança de gameplay não aprovada.

### 4.2 Circuito de Memória v1 — contrato

- Máquina de estados `idle → showing → input → round-complete` em
  `useColorSequenceGame.ts`; tempos fixos `SHOW_MS = 850`, `GAP_MS = 400`,
  `TAP_FLASH_MS = 280`, janela de erro 750 ms, avanço de etapa 700 ms;
  `COLOR_SEQUENCE_MAX_ERRORS` erros encerram a sessão.
- **Timers pertencem à sessão** (MEMORY-CIRCUIT-LIFECYCLE-01): a única chamada
  `window.setTimeout` está em `scheduleForSession`, que registra o id na sessão e
  só executa se a sessão ainda for a viva; `revokeSession` limpa todos os timers;
  o unmount revoga a sessão; Recomeçar/Encerrar abrem/fecham sessão. Sem
  `setInterval`.
- Um resultado por sessão: `onComplete` com `details` (level, sequenceLength,
  errors, maxErrors) e score de `calculateColorSequenceScore`; sem
  `continuation` (o "praticar outra vez" recomeça do início).
- Entrada: `readiness: "explicit"` (o palco chama `onEntryReady` depois de
  pintar o board; erro de asset → `onEntryError`); carregado sob demanda pelo
  registry.

### 4.3 Platform contract v1 — o que o Game 03 pode assumir

Interface conceitual de um jogo novo (tudo isto já existe e é usado pelos 5
jogos):

```text
GameId (src/types/game.ts, união)                       ← o compilador exige as tabelas abaixo
  → GAME_ENTRY_CONTRACTS[id] = { readiness, entryWatchdogMs? }   (src/games/entry-contract.ts, só metadados)
  → GAME_LOADERS[id] = () => import("@/games/<id>/<Component>")  (src/games/index.ts, import() literal = chunk próprio)
  → GAME_REGISTRY[id] = contrato + load
  → GameScreen: intro (GAME_INTROS) → registry.load() → <Component {...GameComponentProps}/>
       GameComponentProps = { onComplete, onExit, continuation?, onEntryReady?, onEntryError? }
  → entrada: useWorldEntryController + WorldEntryTransition (preparing → watchdog → error → "Tentar novamente" = nova sessão)
       readiness "explicit": o jogo chama onEntryReady; "frame-fallback": 2 frames depois do mount
       falha no chunk do jogo → onEntryError → mesmo painel de retry
  → onComplete(result) → page.tsx: saveGameResult (localStorage) → RewardResultModal
  → continuation opcional: GameContinuation (união por `kind`), carregada pelo shell SEM abrir;
       "praticar outra vez" devolve a continuação ao mesmo jogo; entrada pela Home limpa
  → Home/mundos: ACTIVITIES + PLAYABLE_STAGE_IDS + GAME_WORLDS/WORLD_VISUALS/HOME_WORLD_LAYOUT
```

Provado no código atual (gate §13, A3/A4/A9/A10, e suites donas):

- **sem hardcode no App Shell**: `page.tsx`/`layout.tsx`, `GameScreen`,
  `WorldEntryTransition` e o controller de entrada não citam nenhum `GameId`,
  "Rota", `routeNumber`, `journeyCompleted`, Babylon nem importam nada de
  `src/games/<jogo>/` (A9);
- **sem import eager**: o grafo estático da Home (37 módulos) não contém código
  de jogo, Babylon, three nem Worker (A3); o registry só tem `import()` — um por
  `GameId` — e o contrato de entrada não importa nada em runtime (A4);
- **sem acoplamento à Rota**: a continuação é tipada e só a Rota a lê
  (`readRouteContinuation` só em `src/games/escape-maze/`); shell e GameScreen
  não acessam campo nenhum dela (A10).

## 5. Architecture snapshot

Grafo real em `da551b1` (arestas de runtime; imports só de tipo omitidos; lido
pelo gate com o TypeScript):

```text
app/page.tsx ── GameScreen ── GameHowToPlay, data/game-intros, games/index ── entry-contract (sem imports)
            ├── HomeStage, RewardResultModal, WorldEntryTransition, useWorldEntryController
            └── data/activities, data/worlds, engine/stage-progress, engine/storage
games/index ··dynamic··> MemoryCircuit3DGame | RouteStrategyGame | SecurityPanelGame | NumberTrailGame | SeedGardenGame

RouteStrategyGame ── useEscapeMaze, continuation, lib/feedback-motion, master-scene config/css, route-visual.css
                  ··dynamic··> RouteBabylonBoard ── useEscapeMaze (já carregado)
                                   ··dynamic··> @babylonjs/core, @babylonjs/loaders/glTF, routeBabylonScene
useEscapeMaze ── route-config, route-geometry, route-defenders, route-invariants, route-session,
                 route-events, route-generation-client, continuation, engine/difficulty, engine/scoring, lib/game-sounds
route-geometry ── route-config            route-invariants ── route-config, route-geometry
route-defenders ── route-config, route-geometry, engine/difficulty, engine/route-random
route-session ── route-state (sem imports) route-events (sem imports de runtime)
route-generation-client ── route-generation-job ── engine/route-random
                        └─ route-generation-worker-executor ── route-generation-worker-protocol
                                ══worker══> route-generation.worker            (OUTRO realm)
route-generation.worker ── route-generation-runner ── route-generation ── route-config, route-geometry,
                        └─ route-generation-worker-protocol                    engine/difficulty, engine/route-random

MemoryCircuit3DGame ── useColorSequenceGame (── lib/game-sounds, engine/scoring), Stage, Hud, PadLayer,
                       AccessibleControls, visual state, parallax, master-scene config/css
```

| Confirmação | Resultado | Prova |
| --- | --- | --- |
| sem ciclos de runtime relevantes | 0 SCC em 79 módulos (main + Worker) | gate A2 |
| geração não executa na main | `route-generation`/`runner`/`worker` fora do grafo da main; única aresta Worker = executor → entrada | gate A6; `route-generation-worker-tests` 41/41; bundle audit `--gate`; probe de trace |
| Worker não importa UI/Babylon | grafo do Worker = 8 módulos de lógica, 0 pacotes, sem `.tsx`/sessão/estado/storage | gate A7 |
| Home não puxa Rota/Babylon/Worker eager | grafo estático da Home sem `src/games/<jogo>/`, sem `@babylonjs`/three, sem Worker | gate A3; `game-readiness-registry-tests` |
| Babylon continua lazy | único importador de `@babylonjs/*` = `RouteBabylonBoard`, só via `import()`; board e cena sem importador estático | gate A5; `route-board-loader-tests` |
| GameScreen game-agnostic | só conhece o registry | gate A9 |
| App Shell game-agnostic | nenhum id/termo de jogo | gate A9 |
| continuação tipada, do domínio do jogo | `GameContinuation` união por `kind`; leitores só na Rota | gate A10; `game-continuation-contract-tests` |

Nada foi reestruturado: o grafo já estava como o estado desejado.

## 6. Validation summary

Todas as execuções a partir do `npm ci` limpo, na árvore de `da551b1` (o
lock só acrescenta tooling/docs). Validadores que gravam evidência
incondicionalmente rodaram numa worktree descartável (nada em `docs/archive/`
do repositório mudou).

### 6.1 STATIC

| Check | Resultado |
| --- | --- |
| `npm ci` | ok (lockfile v3, sem mudança) |
| `npm run lint` | 0 problemas |
| `npx tsc --noEmit` | 0 erros |
| `npx next build` | ok (Turbopack; `/`, `/lab/3d-home`, `/lab/route-launcher`, manifest) |
| `git diff --check` | limpo |

### 6.2 PLATFORM

| Validador | Resultado |
| --- | --- |
| `production-diagnostic-boundary-tests` | PASS |
| `validation-hygiene-tests` (CORE completo + prova de imutabilidade + evidência) | `CORE_BATTERY_PASSED`, `VALIDATION_CHECK_IS_READ_ONLY`, evidência MATCHES |
| `game-readiness-registry-tests` | PASS |
| `game-entry-watchdog-registry-tests` | PASS |
| `game-continuation-contract-tests` | PASS |
| `route-validation-coupling-gate` | 6/6 (com o gate do lock declarado) |
| `route-module-loader-tests` | 23/23 |
| `route-generation-bundle-audit --gate` | gate held |
| `gameplay-platform-lock-v1` | 18/18; contrafactuais CAUGHT 5/5; mutantes do gate 6/6 |

### 6.3 ROTA

| Validador | Resultado |
| --- | --- |
| `route-config-extraction-tests` (C1) | 22/22 |
| `route-generation-extraction-tests` (C2) | 21/21 |
| `route-defenders-extraction-tests` (C3) | 20/20 |
| `route-invariants-extraction-tests` (C4) | 19/19 |
| `route-state-reducer-tests` (C5) | 42/42 |
| `route-domain-events-tests` (C6) | 35/35 |
| `route-worker-rng-handoff-tests` (C7A) | `ROUTE_WORKER_RNG_HANDOFF_OK` |
| `route-generation-lifecycle-tests` (C7B) | 36/36 |
| `route-generation-worker-tests` (C7C) | 41/41 |
| `route-runtime-harness-tests` | 13/15 — H13, H14 falham (dívida D01, DEV/TOOLING) |
| `validate-route-9x9` | PASS |
| `test-star-selection` | PASS |
| `chest-controlled-tests`, `chest-runtime-gameplay` (CORE) | PASS |
| `chest-acceptance` (ledger histórico) | exit 0; reescreve o próprio ledger (D04) |
| `difficulty-baseline-tests`, `difficulty-rebalance-tests`, `difficulty-remount-persistence-tests`, `route-difficulty-identity-tests` (CORE) | PASS |
| `dynamic-solvability-02` | PASS |
| `sentinel-runtime-equivalence` | PASS |
| `trap-strategy-tests` (CORE) | PASS |
| `route-journey-terminal-tests` | PASS |
| `route-journey-ownership-tests` | PASS |
| `route-board-loader-tests` | PASS |
| `babylon-lifecycle-tests` (+ CORE) | PASS |
| `route-projection-tests` | 12/12 |
| `adversarial-runtime-replay` | FALHA: 8801214 map mismatch (dívida D02, DEV/TOOLING; idêntico em `e384d76`, `e8971eb`, `bd75e69`) |

### 6.4 CIRCUITO

| Validador | Resultado |
| --- | --- |
| `memory-circuit-lifecycle-tests` | 13/13 `MEMORY_CIRCUIT_LIFECYCLE_OK` |
| `memory-circuit-lifecycle-tests --rev=61c3b04` (contrafactual) | casos 1–5 FALHAM, como registrado |

### 6.5 CORE e DEEP

| Conjunto | Resultado |
| --- | --- |
| CORE (`validation-hygiene-tests`, completo, 15 validadores) | PASS |
| DEEP (`final-acceptance`) | PASS, evidência MATCHES |

### 6.6 MUTANTS

| Runner | Resultado |
| --- | --- |
| C7C `route-generation-worker-tests --mutants` | 12/12 caught |
| C7B `route-generation-lifecycle-tests --mutants` | 14/14 caught |
| C7A `route-worker-rng-handoff-tests --mutants` | 16/16 caught |
| C6 `route-domain-events-tests --mutants` | 10/13 caught, 3 BROKEN (âncora textual achada 0× no hook) — nenhum sobrevivente; em `e8971eb` (pré-C7B) o mesmo runner pega 13/13: âncoras obsoletas desde C7B (dívida D17, DEV/TOOLING) |
| C5 `route-state-reducer-tests --mutants` | 9/13 caught — 3 NÃO APLICADOS (âncora achada 0× no hook; o runner os conta como "missed" sem imprimir linha) e 1 sobrevivente: "a cell put back: moveTick in its own useState", porque o gate estrutural do C5 lê o hook pela reconstrução `treeBeforeC7B`, que descarta a linha adicionada (dívida D19, DEV/TOOLING). O produto não tem a mutação (hook ao vivo: 1 `useState`, `routeNumber`); o gate do lock agora pina esse formato no texto real (R3) e pega o mesmo mutante |

Um mutante BROKEN/não aplicado não conta como "caught" e não é declarado PASS.
As âncoras dos runners C5/C6 existem em `e8971eb` e somem em `bd75e69`
(C7B reescreveu o turno do hook como builder e tirou `generateMaze` do hook).
Gate do lock em modo `--counterfactuals`: 6/6 mutantes em memória pegos (§14).

## 7. Browser summary

Build de produção (`next build && next start -p 3100`); o launcher seeded e a
comparação de pixels usam `next dev -p 3101` (o launcher é só de
desenvolvimento). Chromium headless + SwiftShader, sem GPU. As probes são
read-only (só observam DOM/rede/Worker); nada virou feature.

| # | Passo | Probe | Resultado |
| --- | --- | --- | --- |
| 1 | Home → Rota | `route-generation-worker-browser-probe` (entry), `game-continuation-browser-probe` (journey) | PASS |
| 2 | primeira geração via Worker | worker probe `entry` + `thread-entry` | PASS — 1 Worker `rota-generation`, terminado na resposta; trace: 0 amostras de geração na main, 150 no Worker (frio), 308 (quente) |
| 3 | Start | worker probe `start`; `route-generation-lifecycle-browser-probe` `start`, `setup-pending-start-disabled` | PASS |
| 4 | movimentos normais | journey/continuation/ownership/projection probes (setas sobre o que o canvas publica) | PASS |
| 5 | armadilha | `lock-browser-probe` (scratch desta missão) | PASS — passo na armadilha `0,1` → `data-triggered-trap-cells` = `0,1` |
| 6 | Baú / recompensa | `lock-browser-probe` | PASS — Baú `5,1` aberto, oferta "Picareta" + "Segunda Chance", Segunda Chance escolhida, oferta some, segue `playing` |
| 7 | Restart | worker probe `restart`/`double-restart`/`thread-restart`; lifecycle `restart`/`double-restart`; `lock-browser-probe` (Detalhes → "Começar outra rota": `playing`, nada armado/coletado, Baú fechado, Explorador na largada) | PASS |
| 8 | troca rápida de dificuldade | worker probe `rapid-mode` (1 Worker, pedido só para `hard`); lifecycle `rapid-mode` | PASS |
| 9 | sair durante a geração | worker probe `exit-pending` (Worker terminado, 0 vivos); lifecycle `exit-pending` | PASS |
| 10 | falha do Worker → Retry | worker probe `failure-constructor`, `failure-script`; lifecycle `error-retry` | PASS — erro calmo "Não foi possível preparar esta rota." → Retry → novo Worker → `playing` |
| 11 | R1 → R2 → R3 | `route-journey-terminal-browser-probe`; `route-journey-ownership-browser-probe --scenario product`; `game-continuation-browser-probe` | PASS |
| 12 | R3 derrota → R3 | journey-terminal ("Tentar Rota 3 novamente") | PASS |
| 13 | R3 vitória → Jornada concluída → Home | journey-terminal (easy; Rota 3 vencida na 2ª tentativa; "Voltar aos mundos" → Home → Rota de novo na Rota 1 com intro) | PASS |
| 14 | falha do chunk do board / retry | `route-board-chunk-browser-probe` (normal, failure-retry com `ChunkLoadError` no `onEntryError`, leave-fails, leave-arrives, retry-while-pending) | PASS 5/5 |
| 15 | testemunhas seeded do launcher | worker probe `--launcher-base` `seeded-launcher` (Launch, modo, Start, Restart, Relançar, outro cenário: mapa e fluxo iguais ao runner em Node) ; `route-journey-ownership-browser-probe --scenario lab` | PASS (15/15 held; lab PASS) |
| 16 | projeção / pixel | `route-projection-browser-probe` (Home: 7 passos, erro máx. 0 px, `PROJECTED_CENTRES_FRESH`); `--entry launcher` duas vezes, a 2ª com `--baseline` da 1ª | PASS — 7/7 buffers do board comparados, todos idênticos |
| 17 | Home → Circuito | `lock-browser-probe`; continuation probe (`journey` termina no Circuito) | PASS — intro própria, `idle`, Etapa 1 |
| 18 | Start | `lock-browser-probe` | PASS — "Ativar circuito" → `showing` → `input`; rodada repetida a partir do que o board acendeu → `round-complete` |
| 19 | restart | `lock-browser-probe` ("Começar outro circuito" dentro da janela de 700 ms) | PASS — nova sessão em Etapa 1 (o callback antigo não avançou a etapa), nada salvo |
| 20 | sair/unmount durante timers | `lock-browser-probe`: "Voltar à jornada" durante `showing`; depois um erro e "Voltar" dentro da janela de 750 ms | PASS — Home, jogo desmontado, nenhum resultado salvo nem tela de resultado após 4 s / 3 s, nenhum erro de página |
| 21 | reentrada | `lock-browser-probe` | PASS — intro de novo, `idle`, Etapa 1 |

Totais: worker probe 14/14 (produção) e 15/15 (com launcher); lifecycle 9/9;
journey-terminal PASS; board-chunk 5/5; continuation 2/2; ownership product +
lab PASS; projection PASS (Home e launcher, pixels idênticos); lock probe PASS
(Rota 5–7 + Circuito 17–21); 0 erros de página/console em todas.

Ambiente (D18): com a CPU ocupada pelos mutantes em paralelo, a primeira rodada
das probes worker/lifecycle falhou ao clicar na intro enquanto a entrada ainda
estava "preparing" (o board sob SwiftShader passou do tempo do clique); com a
máquina ociosa as duas passaram inteiras. A journey-terminal precisou de 4
"Tentar novamente" na primeira entrada (watchdog sob carga) — o caminho de
retry do produto, contado pela própria probe.

## 8. Performance / bundle snapshot (baseline v1)

Snapshot do estado final — não é projeto de otimização. Números de
`route-generation-bundle-audit.mjs --gate` sobre o `next build` de `da551b1`
(gzip do audit) e, para CSS e Circuito, das requisições reais do browser:

| Conjunto | Arquivos | Raw | Gzip |
| --- | --- | --- | --- |
| Home — JS inicial | 10 | 754,8 KB | 236,8 KB |
| Home — JS + CSS requisitados pelo browser | 9 JS + 7 CSS | 848,7 KB | 242,2 KB |
| Rota — lazy main (chunk do jogo) | 3 | 54,2 KB | 18,4 KB |
| Rota — Worker de geração | 3 (1 entrada Worker) | 32,1 KB | 11,4 KB |
| Rota — Babylon lazy (board + engine + loaders) | 36 | 7 840,2 KB | 1 725,8 KB |
| Circuito — lazy | 1 JS + 1 CSS | 19,2 KB + 17,2 KB | 6,4 KB + 4,1 KB |

- O literal de geração está só no chunk do Worker (`generation: no` na Home,
  na Rota e no Babylon).
- Módulos que os dois realms carregam (duplicação aceita): `route-config` +
  `difficulty` + `route-geometry` (7,4 KB) e `route-random` (0,9 KB).
- Nenhum pacote three/R3F no conjunto da Rota (a string `fflate` que aparece
  num chunk é do Babylon).

Smoke de geração Worker: `route-generation-worker-performance-probe.mjs --gate --samples 10`
(build de produção, primeiro mapa da sessão, pendente → aceito; 1 frio + 9
quentes por taxa; wall-clock é metadado de execução, não evidência):

| CPU | janela p50 / p95 (quente) | Worker construção → resposta p50 | CPU de geração na main | amostras quentes com Long Task | Long Tasks atribuídas à geração |
| --- | --- | --- | --- | --- | --- |
| 1× | 83 / 143 ms | 80 ms | 0 ms | 0/9 | 0 |
| 4× | 119 / 310 ms | 103 ms | 0 ms | 0/9 | 0 |
| 6× | 131 / 167 ms | 89 ms | 0 ms | 0/9 | 0 |

Frio: 0 ms de geração na main nas três taxas; uma Long Task de 65 ms no frio a
6× sem nenhuma amostra de geração (perfil: idle/program/chunk do app). `gate
held`. O probe de trace (`route-generation-worker-browser-probe`) confirmou
0 amostras de CPU da geração na `CrRendererMain` e 150 / 308 / 122 na
`DedicatedWorker thread` (entrada fria, entrada quente, Restart). Isto é a
baseline v1 para comparações futuras.

## 9. Known debt

Classes: **BLOCKER** (impede o lock) · **POST-LOCK** (dívida conhecida, depois)
· **ROTA-2.0** (pertence à fase seguinte da Rota) · **DEV/TOOLING** (só
ferramenta/processo). Cada item foi auditado nesta missão — nada foi assumido.

| ID | Dívida | Classe | Evidência atual | Impacto | Por que não bloqueia | Dono / fase |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | `route-runtime-harness-tests` H13/H14 falham | DEV/TOOLING | 13/15. H13: o harness aplica o edit `directDifficulty` na forma `lifecycle` (C7B) mas o teste só procura a âncora `reducer` (`landed.reducer=false`), embora `sameAsSetterEngine` e `startsPlayingOnTheSameBoard` sejam `true`. H14: desde C7B o mount agenda a geração, então o render 0 vem `scheduled=true`. Passam em `e8971eb` (pré-C7B), falham em `bd75e69` e `da551b1` | o auto-teste do harness está desatualizado; a equivalência que ele protege segue provada (H11/H12, suites C5–C7C) | não toca produto; nenhum outro validador depende do veredito H13/H14 | manutenção do harness (atualizar as expectativas para C7B) |
| D02 | `adversarial-runtime-replay`: 8801214 "direct hook map differs from solver map" | DEV/TOOLING | falha idêntica em `e384d76` (pré-C7), `e8971eb`, `bd75e69`, `da551b1`; o arquivo de testemunhas é de ROTA-ADVERSARIAL-SOLVABILITY-03 e o gerador mudou depois dele; o script grava evidência incondicionalmente | replay histórico não reproduz o mapa do testemunho | não é regressão do C0–C7 (pré-existente); solvabilidade atual coberta por `dynamic-solvability-02`, `final-acceptance` e C4 | tooling: regravar testemunhas ou aposentar o replay |
| D03 | packed SCC: `Math.max(0, ...componentSizes)` | DEV/TOOLING | `tools/validation/dynamic-solver-packed-scc.mjs:126`; `Math.max(...)` com 200k argumentos lança `RangeError: Maximum call stack size exceeded` no Node 22 | campanhas de suspeitos muito grandes podem estourar | só tooling de campanha (solver exato), fora de CORE/DEEP | tooling: trocar por redução em loop |
| D04 | evidência histórica obsoleta / escritores legados | DEV/TOOLING | `test-star-selection`, `sentinel-runtime-equivalence`, `dynamic-solvability-02` e `chest-acceptance` reescrevem 8 arquivos de missões fechadas com números atuais (mesmos bytes em `e384d76` e `da551b1` → anterior ao C7); `chest-acceptance` regrava o veredito como `AWAITING_VALIDATIONS` (item 19 é manual); flags de follow-up antigas continuam escritas nos arquivos (`DUAL_GUARDIAN_CO_OCCUPANCY_FOLLOWUP_REQUIRED` — corrigido por DS-02; `ROUTE_JOURNEY_TERMINATION_DECISION_REQUIRED` — fechado por `5d541b2`; `DIFFICULTY_NOT_PERSISTED_ACROSS_REMOUNT_FOLLOWUP_REQUIRED` — fechado pelo 04B) | rodar esses scripts no repositório suja o worktree; leitura literal das flags antigas engana | o registro é histórico por definição; os validadores atuais (CORE/DEEP) são read-only e batem com a evidência | tooling: modo `--check` ou OUT por variável para todos; nota de supersedência nos arquivos |
| D05 | `next dev` reescreve `AGENTS.md` | DEV/TOOLING | reproduzido neste lock: ao subir `next dev` (16.3.6) o log diz "Generated AGENTS.md for AI agents. Set `agentRules: false` in next.config to disable." e o arquivo ganha 5 linhas (texto novo do bloco `nextjs-agent-rules`); restaurado com `git checkout`, nada commitado | um diff alheio aparece no worktree de quem roda o servidor de desenvolvimento e pode entrar num commit por engano | só ambiente de desenvolvimento | processo: revisar `git status` antes de commitar |
| D06 | branch default do GitHub ainda histórica | DEV/TOOLING | default = `v03-route-board-2` (API do GitHub, 2026-10-05); canônica = `v06-portal-requires-lights` (= `da551b1`) | clones/PRs podem nascer da base errada | `SOURCE_OF_TRUTH.md` já manda nunca usar a default como base implícita | decisão do dono do repositório |
| D07 | validação de runtime em Codespaces | DEV/TOOLING | `.devcontainer/devcontainer.json` existe; este lock rodou num container de nuvem do Claude, não num Codespace | o caminho Codespaces não foi reexecutado agora | o fluxo clone → `npm ci` → build → validação foi reprovado do zero neste lock | processo: rodar a matriz uma vez num Codespace |
| D08 | `npm audit`: vulnerabilidades de tooling | DEV/TOOLING | 11 no total (1 low, 2 moderate, 8 high, 0 critical); as 8 high são todas da cadeia de dev `eslint-config-next` / `@next/eslint-plugin-next` / `fast-glob` / `micromatch` / `braces`, `brace-expansion`, `js-yaml`, `browserslist`, `@babel/core` | ferramentas de lint/build | nada disso entra no bundle; o fix sugerido (`eslint-config-next@14`) seria downgrade | missão security/dependency |
| D09 | `npm audit --omit=dev`: 2 moderate no grafo de produção | POST-LOCK | `fflate` (via `@react-three/drei` → `three-stdlib`, Home 3D de laboratório) e `baseline-browser-mapping` (via `next`, build-time) | `fflate` só importa ao descompactar zip malformado; nenhum fluxo do produto faz isso | não alcançável pelo produto travado | missão security/dependency |
| D10 | suites fora do CORE | DEV/TOOLING | CORE = 15 validadores; `memory-circuit-lifecycle-tests`, as suites C1–C7C, jornada, continuação, registry e este gate rodam à parte | uma sessão que só roda CORE não vê regressão do Circuito | este lock rodou todas; adicionar ao CORE mudaria a evidência do hygiene (nova missão) | tooling: promover ao CORE com `--update` deliberado |
| D11 | timers sem dono nos jogos legados | POST-LOCK | `window.setTimeout` sem cancelamento: security-panel (3), number-trail (3), seed-garden (2 sem dono + 1 com ref limpa) | callback pode rodar depois do unmount nesses jogos | esses jogos estão fora do lock e serão recriados; o padrão correto (sessão dona dos timers) já existe no Circuito | missão de recriação de cada jogo legado |
| D12 | dívidas baixas da Rota: listener de teclado e `moveTick` | POST-LOCK | `useEscapeMaze.ts` registra `keydown` num `useEffect` sem deps (re-inscreve a cada render); `moveTick` é campo do estado (C5) sem consumidor de produto | custo marginal por render | comportamento correto e coberto (C5/C6 e harness React real) | só com medição (classe 3) ou Rota 2.0 |
| D13 | confete sem cancelamento | POST-LOCK | `celebrateSuccess` agenda `setTimeout` sem limpar no unmount; respeita `prefers-reduced-motion` | confete pode disparar após sair do resultado | efeito visual inofensivo | missão visual futura |
| D14 | superfícies compartilhadas com ramo por jogo | POST-LOCK | `RewardResultModal` tem ramo da Rota lendo `details` (routeNumber, journeyCompleted…); `GameHowToPlay` (rótulo do CTA), `HomeStage` (mundo padrão = Rota) e `rewards.ts` (cópia por `GameId`) | um jogo novo cai nos defaults genéricos | `details` é contrato de apresentação; nada decide fluxo por ele (fluxo = `continuation`); shell e GameScreen seguem limpos | Game 03 Discovery: promover para metadado só com o segundo consumidor |
| D15 | metadados de registro espalhados | POST-LOCK | um `GameId` novo exige entradas em `types/game.ts`, `entry-contract.ts`, `games/index.ts`, `activities.ts`, `stage-progress.ts`, `worlds.ts`, `game-intros.ts`, `rewards.ts`, `homeLayout.ts`, `worldVisuals.ts`, `WorldEmblem.tsx`, `worldDioramaLayout.ts` | checklist longo | o TypeScript obriga cada `Record<GameId, …>` (o build falha até completar) | Game 03 Discovery: consolidar só se o Game 03 provar a dor |
| D16 | ideias de gameplay da Rota 2.0 | ROTA-2.0 | não implementadas: microsequência de morte/captura, armadilha alterando mapa, objetivos dependentes, mapa mudando durante o jogo, Caçador adaptativo/interceptador | — | fora da v1 por definição | missão Rota 2.0 aprovada explicitamente |
| D17 | âncoras obsoletas nos mutantes C6 | DEV/TOOLING | 3 de 13 mutantes de `route-domain-events-tests --mutants` BROKEN ("anchor found 0x" no hook): troca LIGHT_COLLECTED/TRAP_ARMED, ROUTE_ENDED antes de EXPLORER_CAPTURED, hook expondo o último evento. Em `e8971eb` (pré-C7B) o mesmo runner pega 13/13 | 3 mutações históricas não são aplicadas | nenhum mutante C6 sobreviveu; os 10 aplicados são pegos; C7A/C7B/C7C 42/42 | tooling: re-ancorar no texto pós-C7B |
| D18 | watchdog de entrada sob SwiftShader | DEV/TOOLING | em Chromium headless sem GPU, com a CPU disputada, o board pode passar dos 28 s do watchdog da Rota; as probes pressionam "Tentar novamente" (mesma sessão) e reportam quantas vezes | ruído de ambiente nas probes | é o caminho de retry do produto funcionando; em GPU real a medição de produção é 9,5–14,8 s | tooling: rodar probes com a CPU ociosa |
| D19 | gate estrutural do C5 cego a uma célula `useState` reposta | DEV/TOOLING | o mutante "a cell put back: moveTick in its own useState" é aplicado e sobrevive: `structureChecks(treeBeforeC7B(tree))` reconstrói o hook a partir de `e8971eb` + edição sancionada e a linha adicionada some (verificado: `moveTickCell` ausente na visão); os outros 3 mutantes C5 não são aplicados (âncoras 0× desde `bd75e69`) | o contrato "nenhuma célula fora do reducer" do C5 deixou de ser vigiado pelo runner histórico | o produto está correto (1 `useState`); o gate do lock pina o formato no texto real (R3) e seu mutante em memória é pego | tooling: o C5 ler o hook ao vivo para S2/S3 e re-ancorar os mutantes |

**Auditadas e não existentes (não são dívida hoje):** timers do Circuito sem
dono (corrigido em `a93c6b3`, gate M1 + harness); co-ocupação
Caçador/Sentinela (corrigida em DS-02); Rota 4 no produto (fechada em
`5d541b2`); reduced motion — respeitado na Home, transição, resultado, confete,
Rota (`useReducedMotion`) e CSS do Circuito/Rota (`prefers-reduced-motion`).

**BLOCKERS: nenhum.**

## 10. Game 03 readiness — superfície reutilizável

"Se amanhã criarmos `src/games/<game-03>/`, o que já podemos reutilizar?"

**REUSABLE PLATFORM** (já tem dois ou mais consumidores ou é contrato da
plataforma):

- registry + lazy loading (`GAME_LOADERS` com `import()` literal, chunk próprio);
- contrato de entrada: readiness `explicit`/`frame-fallback` + watchdog por jogo
  (`entryWatchdogMs`) + painel de erro/retry; falha de chunk → `onEntryError`;
- `GameComponentProps` / `onComplete` / `onExit`;
- `GameResult` + persistência (`saveGameResult`, `getRecentResults`) feita pelo
  shell — o jogo nunca toca `localStorage`;
- fronteira do resultado: `RewardResultModal` com cópia por jogo em
  `rewards.ts` e `details` como dado de apresentação;
- `GameContinuation`: acrescentar um membro com `kind` próprio, se o jogo
  retomar; o shell carrega sem abrir;
- entrada pelo mundo na Home (`ACTIVITIES`, `PLAYABLE_STAGE_IDS`, metadados de
  mundo/visual/layout), transição e intro (`GAME_INTROS`);
- convenções de validação: loader de módulos, `--rev` contrafactual, mutantes,
  probes Playwright read-only, gate de acoplamento, evidência read-only;
- padrões de lifecycle: sessão dona dos timers (Circuito); geração
  assíncrona latest-wins com executor substituível (Rota C7B);
- padrão Worker (C7C: um Worker por comando, protocolo fechado, sem fallback),
  **se um dia precisar** — como padrão a copiar, não como módulo compartilhado.

**ROTA-SPECIFIC** (ficam em `src/games/escape-maze/`): `route-state`,
`route-events`, `route-session`, `route-generation` (+ job/client/runner/
worker/protocol/executor), `route-defenders`, `route-invariants`,
`route-config`, `route-geometry`, `continuation.ts`, `RouteBabylonBoard` +
`routeBabylonScene`, `route-random`/`difficulty` (seam de RNG da Rota).

Regra: **second consumer first, abstraction second.** Nenhuma peça da Rota foi
promovida a shared nesta missão; o Game 03 Discovery decide, com um segundo
consumidor real, se algo merece virar plataforma.

## 11. Explicit exclusions

Este lock NÃO cobre e NÃO autoriza:

- Game 03 (nada criado; "Game 03 Discovery" é a próxima fase);
- Rota 2.0 (D16) e qualquer mudança de gameplay da Rota/Circuito;
- os três jogos legados (D11) além de continuarem compilando;
- `/lab/3d-home` e `/lab/route-launcher` como produto (são diagnóstico; o
  launcher é só de desenvolvimento);
- performance de render Babylon/GPU (só a geração foi medida);
- refactors estéticos, limpeza de CSS legado (`docs/CSS_CLEANUP_MAP.md`).

## 12. Change policy (depois do lock)

Mudanças em Rota, Circuito ou plataforma exigem **uma** destas classes, citada
no commit/PR:

1. **regression fix** — algo travado aqui quebrou;
2. **security/dependency fix**;
3. **measured performance fix** — com medição antes/depois;
4. **explicitly approved Rota 2.0 mission**;
5. **platform requirement discovered by a real second consumer (Game 03)**.

Não fazer refactor "porque ficaria mais bonito". Uma mudança que altere um
contrato do §4 deve atualizar este documento e o manifesto em
`tools/validation/gameplay-platform-lock-v1.mjs` no mesmo commit, dizendo a
classe; o gate falha até isso acontecer.

## 13. Lock gate

```bash
node tools/validation/gameplay-platform-lock-v1.mjs                   # o gate (<5 s)
node tools/validation/gameplay-platform-lock-v1.mjs --rev=<commit>    # checks de código em outro commit ([doc] pulado)
node tools/validation/gameplay-platform-lock-v1.mjs --counterfactuals # prova que o gate pega a ausência dos contratos
```

| ID | Check |
| --- | --- |
| A1 | 32 módulos canônicos existem (plataforma, Rota C0–C7C, Babylon, Circuito) |
| A2 | sem ciclos de runtime (Tarjan sobre arestas estáticas, main + Worker) |
| A3 | grafo estático da Home sem código de jogo, `@babylonjs`, three/R3F ou Worker |
| A4 | registry: zero import estático de jogo, um `import()` por `GameId`; chaves de loaders = chaves de contratos = união `GameId`; contrato sem imports |
| A5 | Babylon só por `import()` e só a partir de `RouteBabylonBoard`; board/cena sem importador estático |
| A6 | `route-generation`/`runner`/`worker` fora do grafo da main; única aresta Worker = executor → entrada; o Worker alcança a geração |
| A7 | grafo do Worker sem pacotes, `.tsx`, app/components/lib/data, hook, estado, sessão, eventos, storage, client/executor |
| A8 | `routeGenerationExecutor = runRouteGenerationInWorker`; URL estática do Worker; executor sem caminho para geração local; runner importado só pelo Worker |
| A9 | App Shell e GameScreen sem id/termo de jogo e sem import de `src/games/<jogo>/` |
| A10 | `GameContinuation` tipada com `kind`; shell não lê campos; `readRouteContinuation` só na Rota |
| R1 | `continuation.ts` avaliado: final = 3; tabela R1–R3 × vitória/derrota; leitor aceita só 1–3 |
| R2 | modos, recompensas do Baú, 11 ações C5 e 13 eventos C6 exatamente os da v1 |
| R3 | estado do hook da Rota: um único `useState` (`routeNumber`) e um único `useReducer` (`routeSessionReducer`) — lido no texto real (cobre a lacuna D19) |
| M1 | Circuito: 1 `setTimeout`, dentro de `scheduleForSession` (registrado e guardado pela sessão); revoke limpa; unmount revoga; sem `setInterval` |
| M2 | Circuito: readiness `explicit`, `GameComponentProps`, `onReady/onError` ligados, carregado por `import()` |
| D1 | este documento: decisão, commit canônico ancestral do HEAD, seções obrigatórias |
| D2 | dívida: toda linha D01–D19 classificada, IDs exigidos presentes, nenhum BLOCKER |
| D3 | decisões anteriores não reabertas (`GITHUB_SOURCE_OF_TRUTH = YES`, `DECISION: C7_GO`) e lock referenciado em SOURCE_OF_TRUTH e ARCHITECTURE |

## 14. Contrafactual

`--counterfactuals` roda os checks de código em commits anteriores ao
fechamento de cada contrato e exige que os checks listados FALHEM lá (e que a
árvore atual passe todos):

| Baseline | Antes de | Exigido falhar | Resultado |
| --- | --- | --- | --- |
| `bd75e69` | ROUTE-C7C | A6, A8 | CAUGHT — `route-generation` no grafo da main, Worker ausente |
| `7b740e4` | ROUTE-JOURNEY-TERMINAL-01 (P4B) | R1 | CAUGHT — sem `nextJourneyRoute`; leitor aceita Rotas `[1,2,3,4,999]` |
| `61c3b04` | MEMORY-CIRCUIT-LIFECYCLE-01 | M1 | CAUGHT — 5 `setTimeout` sem dono, sem revoke no unmount |
| `3e30148` | lazy loading da plataforma | A3, A4 | CAUGHT — Home estática com os 5 jogos (62 módulos); registry com 5 imports estáticos |
| `415cead` | contrato tipado de continuação | A10 | CAUGHT — sem `GameContinuation`; `page.tsx` lê a continuação |

E edições em memória da árvore atual (nada é gravado) que reabrem um contrato;
cada uma precisa derrubar exatamente o check dela:

| Mutante | Exigido falhar | Resultado |
| --- | --- | --- |
| executor da Rota religado à geração local | A6, A8 | CAUGHT (falham A6, A8) |
| `ROUTE_JOURNEY_FINAL_ROUTE = 4` | R1 | CAUGHT (falha R1) |
| registry importando a Rota estaticamente | A3, A4 | CAUGHT (falham A3, A4) |
| GameScreen testando `gameId === "escape-maze"` | A9 | CAUGHT (falha A9) |
| célula `useState` reposta no hook (o mutante C5 que o runner histórico não vê) | R3 | CAUGHT (falha R3) |
| Circuito sem revogar a sessão no unmount | M1 | CAUGHT (falha M1) |

Saída: `LOCK_GATE_COUNTERFACTUALS_HOLD`.

## 15. Decision

- Rota Estratégica v1: **locked**.
- Circuito de Memória v1: **locked**.
- Shared platform contract v1: **locked**.
- **Game 03 Discovery está liberado.**

`GAMEPLAY_PLATFORM_LOCK_V1 = PASS`
