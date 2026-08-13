# Contrato de runtime do Baú

Fonte: `src/games/escape-maze/useEscapeMaze.ts`.
Testes: `chest-controlled-tests.json` (A–H).

---

## 1. O Baú no mapa

`MazeMap.chest: GridPosition | null` — uma célula andável, um desvio opcional.

Herda **integralmente** o slot estrutural do antigo escudo (§10):

| | Antes (escudo) | Agora (baú) |
|---|---|---|
| Escolha da célula | `chooseTrapsAndShield` | `chooseTrapsAndChest` (mesma função, renomeada) |
| Distância mínima do start | `shieldMinStartDistance` | `chestMinStartDistance` — **mesmos números** |
| Distância alvo | `shieldTargetDistance` | `chestTargetDistance` — **mesmos números** |
| Pontuação da célula | `30 - |d - alvo|*4 + dSaída*0.6 + grau` | idêntica |
| Gate de validação | `shieldUseful` | `chestUseful` — mesma condição |
| Ordem na geração | antes das traps | antes das traps |

Como nada mudou de número, a taxa de aceitação de mapas é a mesma do baseline
pré-Chest. O que mudou foi o significado da célula.

Nunca existem duas mecânicas em paralelo: o escudo saiu do produto (§10, §22).

---

## 2. Estado mínimo

Quatro campos. Tudo o mais é derivado.

```ts
chestOpened:     boolean
rewardSelected:  "pickaxe" | "second-chance" | null
rewardSpent:     boolean
brokenWall:      string | null      // "row,col" da única parede aberta
```

Derivados (§11 — "evitar estados redundantes"):

```ts
rewardChoicePending    = chestOpened && rewardSelected === null
pickaxeAvailable       = rewardSelected === "pickaxe"        && !rewardSpent
pickaxeSpent           = rewardSelected === "pickaxe"        &&  rewardSpent
secondChanceAvailable  = rewardSelected === "second-chance"  && !rewardSpent
secondChanceSpent      = rewardSelected === "second-chance"  &&  rewardSpent
```

Duas decisões de desenho que valem a pena registrar:

* **Um único slot de recompensa.** "Nunca as duas" (§33 F) não é uma regra que
  alguém precisa lembrar de checar: é uma propriedade do tipo. Não existe estado
  em que as duas estejam disponíveis.
* **Uma única flag de gasto.** `rewardSpent` cobre as duas recompensas, porque só
  uma pode ser possuída. Duas flags seriam a mesma informação escrita duas vezes.

`brokenWall` é `string | null` e não um conjunto: a Picareta tem **um** uso, então
"no máximo uma parede aberta" também é estrutural, não vigiado.

> **Revisão pós-playtest.** `MazeMap.breakableWalls` existia aqui e listava as
> paredes certificadas que a Picareta podia abrir. Saiu do modelo: a Picareta
> abre qualquer parede interna, então aquela lista era metadata sem função (§20).
> O que resta é `walls` (estático) + `brokenWall` (da partida).
> Ver [`pickaxe-free-wall-choice-contract.md`](pickaxe-free-wall-choice-contract.md).

Invariante mantida pelo runtime:
`brokenWall !== null` ⟹ `rewardSelected === "pickaxe" && rewardSpent`.

---

## 3. Abertura

`tryMovePlayer`, quando o destino é a célula do Baú e `chestOpened === false`:

1. o passo é aplicado (posição, turno, luz, armadilha);
2. `chestOpened = true`;
3. **o turno para** — a fase dos defensores não roda;
4. a UI mostra as duas escolhas e o runtime espera.

Um Baú já aberto não abre de novo: a condição é `!chestOpened`, então voltar à
célula é um passo comum (§33 G).

Detalhe de ordem: a captura é resolvida **antes** da abertura. Se um defensor
estiver parado sobre a célula do Baú, entrar nela é uma captura, não uma coleta.

---

## 4. Paredes efetivas

```ts
const walls = brokenWall === null
  ? mazeMap.walls                       // o MESMO objeto
  : new Set(mazeMap.walls) menos brokenWall;
```

Com nada quebrado a identidade é preservada, então todo comportamento pré-Chest
é idêntico por construção, não por comparação. A zona do Sentinela é derivada
desse conjunto, de modo que uma parede aberta remodela o território dele como um
mapa diferente teria feito (§37).

Este é o único conjunto que responde "isto é andável?" para o Explorer, o
Caçador e o Sentinela. Não existe buraco exclusivo do jogador (§15).

---

## 5. Reset

`startNewMaze` (chamado por `startGame`, `restartGame`, `continueJourney`,
`changeDifficulty`) zera os quatro campos:

```
chestOpened = false;  rewardSelected = null;  rewardSpent = false;  brokenWall = null;
```

Cobre restart, derrota/retry, próxima Rota, troca de modo, Home → Rota e nova
sessão (o hook remonta e os `useState` iniciais são os mesmos valores).

A definição do mapa **nunca** é escrita. `breakWall` só grava `brokenWall`; o
template e `mazeMap.walls` continuam intactos. Verificado remontando a mesma seed
depois de uma quebra e comparando os conjuntos de parede
(`pickaxe-controlled-tests.json` → N).

---

## 6. Resultado da partida

`GameResult.details` deixa de carregar `shieldCollected` / `shieldUsed` e passa a
carregar:

```
chestOpened:   boolean
rewardChosen:  "Picareta" | "Segunda Chance" | "Nenhuma"
rewardSpent:   boolean
wallBroken:    boolean
```

Rótulos em `src/lib/detail-labels.ts`.

---

## 7. Observabilidade para o Solver 02 (§42)

O hook retorna, sem nada escondido em ref, UI ou renderer:

```
chestPosition, chestOpened, rewardSelected, rewardSpent, rewardChoicePending,
pickaxeAvailable, pickaxeSpent, secondChanceAvailable, secondChanceSpent,
brokenWall, breakTargets, walls
```

Custo de estado para a próxima missão, sobre o contrato pré-Chest
`{ e, h, s, t, c, lights, traps }`:

| Campo | Domínio | Bits |
|---|---|---:|
| `chestOpened` | 2 | 1 |
| `rewardSelected` | none / pickaxe / second-chance | 2 |
| `rewardSpent` | 2 | 1 |
| `brokenWall` | índice na lista de paredes do mapa, ou nenhuma (≤ 29 valores) | 5 |

**+9 bits**. `walls` é dado estático do mapa e fica fora do estado, como as luzes
e as armadilhas. `rewardChoicePending` é derivado e não ocupa bits.

> A largura de `brokenWall` subiu de 2 para 5 bits na revisão pós-playtest: ele
> indexava um conjunto marcado de ≤ 3 paredes e agora indexa a lista inteira de
> paredes do mapa (13–28 conforme o modo). É o preço direto da escolha livre.

As duas ações novas do Explorer são discretas e explícitas:

* `chooseReward(reward)` → um OR de dois ramos, decidido pelo jogador, sem RNG (§43);
* `breakWall(wallId)` → uma ação por parede **adjacente** ainda de pé, no máximo
  quatro por célula, e no máximo uma ao longo de toda a rota (§44).

Nenhuma delas está escondida em animação ou render.

**Esta missão não altera `dynamic-solver.mjs`** (§45).
