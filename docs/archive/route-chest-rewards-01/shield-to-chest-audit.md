# FASE 0 — Auditoria: do Escudo azul ao Baú

Levantamento feito **antes** de qualquer alteração de produção, sobre
`HEAD = eb26368` (`PRE_CHEST_BASELINE_COMMIT`), working tree limpo.

Nada aqui é proposta. É o que existe hoje.

---

## 1. Escudo atual — inventário completo

### 1.1 Geração / spawn

| Item | Onde | Detalhe |
|---|---|---|
| Campo do mapa | `src/games/escape-maze/useEscapeMaze.ts:479` | `MazeMap.shield: GridPosition \| null` — *"Single walkable shield power-up tile, or null. Purely additive overlay."* |
| Escolha da célula | `chooseTrapsAndShield()` — `useEscapeMaze.ts:850-886` | Percorre `getReachableDistances(playerStart, walls)`, exclui start/guardian/portal/START_SAFE_CELLS/luzes, exige `distance >= profile.shieldMinStartDistance`, pontua `30 - |distance - shieldTargetDistance| * 4 + exitDistance * 0.6 + degree` e pega **o melhor** (`shieldCandidates[0]`). |
| Perfil por etapa | `ROUTE_STAGE_QUALITY` — `useEscapeMaze.ts:365-408` | Rota 1: `shieldMinStartDistance 3 / shieldTargetDistance 4`; Rota 2: `4 / 5`; Rota 3: `4 / 6`. |
| Ordem de escolha | `chooseTrapsAndShield()` | O escudo é escolhido **antes** das traps e entra em `blocked`, então nenhuma trap cai sobre ele. |
| Entrega | `buildCandidate()` — `useEscapeMaze.ts:2145-2164` | `const { traps, shield } = chooseTrapsAndShield(...)` → `map.shield`. |

**Consequência estrutural:** o escudo é escolhido *depois* de `isStructurallyValid`
(que já certificou geometria, luzes e rota objetivo) e nunca influencia paredes,
guardiões, luzes ou o caminho objetivo. É um overlay puro sobre célula andável.

### 1.2 Validação

| Gate | Onde | Regra |
|---|---|---|
| `shieldUseful` | `isValidMap()` — `useEscapeMaze.ts:1742-1744, 1810` | `distances.get(shield) >= profile.shieldMinStartDistance`. Se `map.shield === null`, `shieldDistance === undefined` → `shieldUseful === false` → **mapa rejeitado**. Ou seja: hoje **todo mapa certificado tem escudo**. |
| Dead-ends | `countIdleDeadEnds()` chamado em `useEscapeMaze.ts:1763-1768` | O escudo entra no `payload`, então um beco que segura o escudo não conta como "idle". |
| Ferramentas offline | `tools/validation/validate-route-9x9.mjs:523` | `if (map.shield === null) errors.push("shield was not placed")`. Também `final-acceptance.mjs:80`, `route-lab.mjs:432/557/567`, `instrumented-generator.mjs:235`, `final-rejection-autopsy.mjs:222/277`, `render-route-9x9-evidence.mjs:148`, `verify-route-board-alignment.mjs:169/270`, `analyse-route-maps.mjs:39`, `test-pincer-classifier.mjs:39`. |

### 1.3 Estado de runtime

| Estado | Onde | Observação |
|---|---|---|
| `shieldCollected` | `useEscapeMaze.ts:2283` | `useState(false)` |
| `shieldUsed` | `useEscapeMaze.ts:2284` | `useState(false)` |
| `shieldActive` | `useEscapeMaze.ts:2295` | derivado: `shieldCollected && !shieldUsed` |

### 1.4 Coleta

`tryMovePlayer()` — `useEscapeMaze.ts:2486-2489, 2526-2528`:

```ts
const collectShield =
  mazeMap.shield !== null &&
  positionsEqual(next, mazeMap.shield) &&
  !shieldCollected;
...
if (collectShield) setShieldCollected(true);
```

Coleta acontece **no mesmo passo do movimento**, sem custo de turno extra, sem UI,
sem pausa. Mensagem: `"Escudo coletado."`.

### 1.5 Efeito — **NÃO EXISTE**

Este é o achado central da auditoria.

`setShieldUsed(true)` **não é chamado em lugar nenhum do código**. Verificado por
varredura completa de `src/`. `shieldUsed` só é:

- inicializado como `false` (`:2284`),
- resetado para `false` (`:2344`),
- lido para derivar `shieldActive` (`:2295`),
- copiado para o resultado final (`:2516`, `:2414`).

O comentário em `useEscapeMaze.ts:2480-2485` documenta a razão:

> *"ROTA-TRAPS-STRATEGY-01-CLOSEOUT: arming a trap is not a mistake. […] no error,
> no shake, no error tone, and no shield spent. The shield keeps its current
> contract and is simply no longer consumed here — it is redesigned in
> ROTA-CHEST-REWARDS-01, not invented a new job in this mission."*

Ou seja: o escudo **perdeu seu único consumidor** (a trap) na missão anterior e
hoje é um colecionável **sem efeito mecânico algum**. Não protege contra captura
do Caçador, não protege contra o Sentinela, não protege contra nada.

> **Semântica antiga do escudo, para o registro de §20 da missão:**
> `SHIELD_LEGACY_SEMANTICS = ABSORVE_UMA_PENALIDADE_DE_TRAP` (removida) →
> `SHIELD_CURRENT_SEMANTICS = NENHUMA`.
> Nunca houve resolução espacial de captura ligada ao escudo. Não existe código
> antigo de rollback/reposicionamento a reaproveitar — a Segunda Chance parte do zero.

### 1.6 HUD

| Elemento | Onde |
|---|---|
| Token "Escudo" no topo | `RouteStrategyGame.tsx:337-343` — valor `Ativo` / `Usado` / `No mapa`, ícone `ShieldPlus` |
| Classe ativa | `.rsg-hud-shield-active` — `globals.css:9830` (ciano) |
| Legenda do tabuleiro | `RouteStrategyGame.tsx:398` — `{ label: "Escudo", Icon: ShieldPlus }` |
| Passo "como jogar" | `RouteStrategyGame.tsx:677-680` — *"Use o escudo para se proteger uma vez."* (promessa **não cumprida** hoje) |
| Mensagens positivas | `RouteStrategyGame.tsx:225-226` — `"Escudo coletado."`, `"Escudo protegeu você."` (a segunda **nunca é emitida**) |
| CSS morto | `.rsg-shield-chip` (+ `.is-active` / `.is-used`) — `globals.css:9915-9946`. **Nenhum TSX referencia.** Também `.rsg-chips`. |
| Resultado final | `src/lib/detail-labels.ts:20-21` — `shieldCollected: "Escudo coletado"`, `shieldUsed: "Escudo usado"`, exibidos pelo `RewardResultModal`. |

### 1.7 Render Babylon

| Item | Onde |
|---|---|
| Estado enviado | `RouteBabylonBoard.tsx:74-75` — `shield`, `shieldCollected`; interface `RouteBabylonState` em `routeBabylonScene.ts:20-21` |
| Asset | `ROUTE_PROP_ASSET_PATHS.shield = "/models/route/shield.glb"` — `routeBabylonScene.ts:117`; 89.876 bytes |
| Prototipo carregado | `propAssets.shield` — `routeBabylonScene.ts:532`; `loadPropAssetOnce("shield")` — `:2108` |
| Desenho | `renderPickups()` — `routeBabylonScene.ts:1768-1803`. GLB clonado com `SHIELD_TILT_X = 0.1`, `SHIELD_ROTATION_Y = 0.06`; fallback procedural = cilindro hexagonal + caixa (`materials.shield`) |
| Material | `materials.shield` — `routeBabylonScene.ts:330-333`: diffuse `#3ba8ff`, emissive `#1554d1`, specular `#cae8ff` — **o azul que sai do produto** |
| Tuning de material GLB | `tunePropMaterial()` — `:925/954/968/972`: `shieldbronze`, `shielddarkbase`, `shieldblue`, `shieldcyanglow` |
| Ocultação | `if (state.shield && !state.shieldCollected)` — some ao ser coletado |
| Data-attributes | `RouteBabylonBoard.tsx:183-184` — `data-shield-cell`, `data-shield-collected` (consumidos por `verify-route-board-alignment.mjs`) |
| Fonte do asset | `tools/blender/create_route_shield_glb.py` (+ usos decorativos em `create_route_home_diorama.py:364` e `create_hero_world_dioramas.py:417`) |

### 1.8 Render fallback (react-three-fiber)

`USE_BABYLON_ROUTE_BOARD = true` em `RouteStrategyGame.tsx:73`, então este caminho
está **desligado em produção**, mas é código vivo e compilado.

| Item | Onde |
|---|---|
| Props | `RouteBoardScene.tsx:49-50` — `shield`, `shieldCollected` |
| Componente | `src/components/three/route/RouteShield3D.tsx` — icosaedro azul `#bae6fd`/emissive `#38bdf8` flutuando + disco + **`pointLight` própria** |
| Uso | `RouteBoardScene.tsx:289-296` |

### 1.9 Reset / persistência

| Momento | Comportamento |
|---|---|
| `startNewMaze()` — `useEscapeMaze.ts:2342-2344` | `setShieldCollected(false)`, `setShieldUsed(false)`; mapa novo → escudo novo |
| `startGame` / `restartGame` | chamam `startNewMaze(difficulty, "playing")` |
| `continueJourney` | `startNewMaze(difficulty, "playing", routeNumber + 1)` |
| `changeDifficulty` | `setRouteNumber(1)` + `startNewMaze(next, "setup", 1)` |
| Home → Rota / nova sessão | o hook remonta; `useState` inicial `false` |
| Persistência | **nenhuma**. Nada de escudo é gravado em `src/engine/storage.ts`. Só o `GameResult.details` (histórico read-only) carrega `shieldCollected` / `shieldUsed`. |

### 1.10 Testes existentes

Não existe teste de contrato do escudo. Existe apenas:

- `validate-route-9x9.mjs:523` — presença (`shield was not placed`),
- `final-acceptance.mjs:80` — distância mínima,
- `route-lab.mjs:557-568` — métrica `shieldDistance` / `hasShield`,
- `docs/archive/route-traps-strategy-01/trap-damage-removal-tests.json` — registra que a trap **deixou** de consumir o escudo.

Nenhum teste afirma efeito, porque não há efeito.

---

## 2. Paredes — representação e consumo

### 2.1 Representação estrutural

| Camada | Forma | Onde |
|---|---|---|
| Template | `number[][][]` 9×9, `1 = parede`, `0 = andável` | `STAGE_ONE/TWO/THREE_TEMPLATES` — `useEscapeMaze.ts:115-221` (3 por etapa = **9 templates**) |
| Grid do candidato | `number[][]` clonado + randomizado | `randomizeWalls()` — `:655-716` |
| Conjunto runtime | `Set<string>` de `"row,col"` | `gridToWalls()` — `:500-508`; `MazeMap.walls` |
| Contagem | `countWalls(grid)` conta células `=== 1` | `:563` |

`MazeMap` carrega **as duas** (`grid` e `walls`) e elas precisam permanecer coerentes:
`countWalls(map.grid)` é o que `isValidMap` compara com `getWallLimits`.

### 2.2 Onde as paredes são lidas

`getNeighbors(pos, walls)` — `useEscapeMaze.ts:510-529` — é **o único** filtro de
andabilidade do jogo. Tudo o mais deriva dele:

- `findPathLength`, `findPathCells`, `getReachableDistances`
- `decomposeBoardBlocks` / `sharesBlock` (biconectividade)
- `countReachableJunctions`, `countIdleDeadEnds`, `measureRouteFlow`
- `computeObjectiveRoute` / `resolveObjectiveRoute` / `admissibleRouteCells`
- `computePortalDefenceZone` (zona + acessos do Sentinela)
- `decideSentinelMove`, `chooseGuardianMove`
- validação de movimento do Explorer (`tryMovePlayer` — `:2455-2467`)
- `scoreTrapForFuture`, `hasStrategicIdentity`, `routeCellsHaveEscape`

**Implicação para a Picareta:** quebrar uma parede = remover a chave de `walls`
(e zerar `grid[r][c]`). Como *tudo* passa por `getNeighbors`, a topologia nova é
vista por Explorer, Caçador e Sentinela **sem tocar em nenhuma política**.

### 2.3 Bloqueio para defensores é separado

`chooseGuardianMove(..., blockedForDefenders)` e
`decideSentinelMove(..., blockedForDefenders)` recebem um `Set` extra (traps armadas)
que é unido a `walls` **só dentro do defensor** (`:1940-1943`). Este é o precedente
para "parede que bloqueia uns e não outros" — e é exatamente o que a §15 da missão
**proíbe** para paredes quebradas: a quebra é física para todos.

### 2.4 Render de parede

| Camada | Onde |
|---|---|
| Babylon | `renderWalls()` — `routeBabylonScene.ts:1461-1518`. Clona `wall.glb` por célula; fallback procedural = `route-wall-base` (`materials.wall`, `#725636`) + `route-wall-cap` (`materials.brass`) |
| Assinatura de cache estático | `getStaticBoardSignature()` — `:1806-1814` inclui `state.walls.sort().join("|")`. **Mudou a lista de paredes → o board estático é reconstruído.** Ponto de entrada natural para BREAKABLE/BROKEN. |
| Fallback R3F | `RouteTile3D` com `isWall` — `RouteBoardScene.tsx:241` |
| Data-attribute | `data-wall-cells` — `RouteBabylonBoard.tsx:178` |

### 2.5 Restrições de geração já existentes sobre paredes

`randomizeWalls()` só aceita um toggle se `wouldKeepStructure()` continuar valendo:
campo conectado único, portal e guardião alcançáveis, `playerStart` e `guardianStart`
com grau ≥ 2, e `sharesBlock(playerStart, exitPosition)`.
`protectedKeys()` protege start, guardião, portal e `START_SAFE_CELLS`.

---

## 3. Interações

### 3.1 Teclado

`useEscapeMaze.ts:2617-2633`: `keydown` global, `ARROW_DELTAS` (4 setas),
`event.preventDefault()`, ignora `event.repeat`. Sem array de dependências —
sempre enxerga o estado mais novo. Só ativo com `status === "playing"`.

**Nenhuma outra tecla é consumida pelo jogo.** A câmera Babylon tem
`camera.inputs.clear()` (`routeBabylonScene.ts:393`), então nem a câmera disputa teclado.

### 3.2 Mobile / D-pad

`RouteStrategyGame.tsx:602-630` — painel `rsg-dpad-panel` com 4 botões
(`renderMoveButton`), visível apenas em `status === "playing"` e com `detailsOpen === false`.

### 3.3 Toque no tabuleiro

`routeBabylonScene.ts:1996-2081` — um dedo = tap em tile; dois dedos = órbita.
O tap resolve para `bridge.onMove(delta)` apenas em tiles de `moveTargets`.

### 3.4 Progressão de turno (`tryMovePlayer`, `:2440-2613`)

1. `status !== "playing"` → sai.
2. Guarda anti-duplo-disparo: `MOVE_INPUT_GUARD_MS = 150` via `lastMoveInputAtRef`.
3. Fora do tabuleiro **ou** `walls.has(next)` → `blockedMoves++`, shake, tom de erro,
   mensagem *"Caminho bloqueado."* — **não consome turno**.
4. Movimento válido → `turns++`, `setPlayer(next)`, coleta luz/trap/escudo.
5. Explorer entrou na célula de um defensor → derrota imediata.
6. Explorer no portal com portal ativo → vitória.
7. Caçador decide (`chooseGuardianMove`) com `armedTraps` construído **localmente**
   (não do estado assíncrono) → se alcança o Explorer, derrota.
8. Sentinela decide (`decideSentinelMove`) sobre o estado **já produzido** pelo Caçador;
   se o destino colide com o Caçador, o Sentinela **fica parado** (`sentinelBlocked`);
   se alcança o Explorer, derrota.
9. Mensagem contextual.

**Não existe hoje nenhuma ação do Explorer que não seja "mover".** Não existe pausa,
modal, nem espera de input no meio de um turno. O Baú introduz a primeira.

### 3.5 Semântica de captura (o que a Segunda Chance precisa resolver)

Há **três** eventos de captura distintos, todos dentro de `tryMovePlayer`:

| # | Evento | Linha | Posições ao disparar |
|---|---|---|---|
| C1 | Explorer anda para cima do Caçador | `:2471, 2529` | Explorer *entra* na célula do Caçador. Defensores ainda **não** se moveram nesse turno. |
| C2 | Explorer anda para cima do Sentinela | `:2472, 2529` | idem, com o Sentinela. |
| C3 | Caçador anda para cima do Explorer | `:2558` | `nextGuardian === next`. Sentinela ainda **não** decidiu. |
| C4 | Sentinela anda para cima do Explorer | `:2584` | `settledSentinel.position === next`. Turno terminaria aqui. |

Todos chamam `endGame(false, ...)` e incrementam `errors`.

Observações que restringem o desenho da Segunda Chance:

- Em C1/C2 **o Explorer é quem invade**. "Devolver o defensor à posição anterior"
  não resolve nada: quem se moveu foi o Explorer.
- Em C3/C4 o defensor invadiu, e a posição anterior dele é conhecida e livre
  (ele acabou de sair dela) — logo *não pode* haver sobreposição ao devolvê-lo,
  exceto se o outro defensor tiver ocupado no mesmo turno; a ordem
  Caçador→Sentinela e a guarda `sentinelBlocked` (`:2576-2581`) tornam isso verificável.
- `endGame` é chamado com snapshots locais (`finalStats`), porque `setState` é assíncrono.
  Qualquer resolução nova precisa seguir o mesmo padrão: decidir sobre valores locais,
  nunca sobre o estado lido do React no mesmo tick.

### 3.6 Sobreposição entre entidades

O único tratamento existente é `sentinelBlocked` (`:2576-2581`): o Sentinela nunca
termina o turno em cima do Caçador. Não existe regra impedindo Caçador e Sentinela
de ocuparem a mesma célula por outra via, nem defensor sobre luz/trap/escudo.

---

## 4. Pontos de acoplamento que a missão vai tocar

| Área | Arquivos | Risco |
|---|---|---|
| Tipo do mapa | `useEscapeMaze.ts` (`MazeMap`) | `shield` é lido por 8 ferramentas offline — trocar o nome quebra todas. |
| Gate `shieldUseful` | `useEscapeMaze.ts:1810` | Se o Baú herdar o slot, o gate vira `chestUseful` e a taxa de aceitação de mapas **não muda**. |
| Estado do runtime | `useEscapeMaze.ts` | Precisa passar de 2 booleanos para o conjunto de §11/§42, todos observáveis no retorno do hook. |
| Render Babylon | `routeBabylonScene.ts` | `RouteBabylonState` (`shield`/`shieldCollected`) + `renderPickups` + `materials.shield` + `getStaticBoardSignature` (paredes). |
| Render fallback | `RouteBoardScene.tsx`, `RouteShield3D.tsx` | Precisa de identidade equivalente; `RouteShield3D` usa `pointLight` (fora do orçamento de 3 luzes do Babylon, mas é outra cena — R3F não tem `ROUTE_MAX_LIGHTS`). |
| HUD / cópia | `RouteStrategyGame.tsx`, `globals.css`, `detail-labels.ts` | Toda a palavra "Escudo" sai. `.rsg-shield-chip` é CSS morto e deve sair junto. |
| Ferramentas | 10 arquivos em `tools/validation/` | Precisam acompanhar o rename para continuar rodando. |
| Solver 02 | `tools/validation/dynamic-solver*.mjs` | **Não alterar nesta missão** (§45). O estado novo precisa ser *observável*, não modelado. |

---

## 5. Conclusões que dirigem o desenho

1. **O escudo não tem efeito.** Substituí-lo não remove nada do gameplay atual —
   remove uma promessa de HUD que o jogo não cumpre. `CHEST_REPLACES_SHIELD` é seguro.
2. **O slot estrutural do escudo é reaproveitável.** A seleção já garante distância
   mínima do start, célula andável, fora de luz/trap/spawn/portal, e já é um gate de
   validação. O Baú pode herdar isso inteiro (§10) sem mexer na taxa de geração.
3. **Não existe código de resolução de captura para reaproveitar.** A Segunda Chance
   é desenho novo (documentado em `second-chance-design.md`).
4. **Paredes são um `Set<string>` consultado por um único `getNeighbors`.** Uma parede
   quebrada é fisicamente igual a uma parede que nunca existiu — para todos.
   Isso satisfaz §15 sem nenhuma exceção por entidade.
5. **`getStaticBoardSignature` já reage à lista de paredes**, então a quebra
   reconstrói o board estático sozinha; não é preciso pipeline novo de render.
6. **`grid` e `walls` precisam ser mantidos coerentes** ao quebrar, senão
   `countWalls(map.grid)` e `isValidMap` divergem. A quebra é de *runtime*, não pode
   escrever no template (§19).
7. **Não há nenhuma ação de turno que não seja mover.** `BREAK_WALL` é a primeira,
   e precisa passar pelo mesmo pipeline de resposta dos defensores (§16).
