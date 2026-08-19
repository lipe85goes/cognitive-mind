# ROTA-DIFFICULTY-04B — a dificuldade sobrevive ao remount

`ROTA-DIFFICULTY-04A` fechou a metade Route do contrato de identidade e deixou um
follow-up: terminar uma Rota e continuar **remonta** o componente, e a escolha de
modo morria com a instância anterior.

```
R1 / hard  →  conclusão  →  próxima Rota  →  remount  →  R2 / easy
```

---

## DIFFICULTY OWNERSHIP — ANTES

```
useEscapeMaze                      ← dono do `difficulty` DURANTE o jogo
        │  useState<DifficultyLevel>("easy")
        │
        ▼  endGame()
GameResult.details.difficulty      ← o modo JÁ viajava aqui
        │
        ▼  saveGameResult / lastResult
app/page.tsx#playAgain             ← lia só `details.nextRouteNumber`
        │
        ▼  setInitialRouteNumber(...)
GameScreen → RouteStrategyGame     ← só `initialRouteNumber` descia
        │
        ▼  remount (key = gameSession)
useEscapeMaze                      ← nova instância, `"easy"` de novo
```

| Coisa | Dono antes |
|---|---|
| `difficulty` durante o jogo | `useEscapeMaze` — autoritativo |
| `difficulty` entre instâncias | **ninguém** |
| `routeNumber` entre instâncias | `page.tsx#initialRouteNumber`, de `details.nextRouteNumber` |
| Boundary de continuação | `GameResult.details` — **já carregava `difficulty`** |

---

## ROOT CAUSE

**O transporte nunca faltou. Faltava a leitura.**

`endGame` escreve `details.difficulty` desde sempre — está ao lado de
`details.nextRouteNumber`, no mesmo objeto, escrito na mesma linha de código.
`playAgain` lia apenas o segundo.

Não era falta de arquitetura: era meia leitura de um boundary que já existia.

### Contrato histórico (§2)

Verificado antes de adicionar plumbing:

* `initialDifficulty` — **nunca existiu em nenhum commit** (`git log -S` em toda a
  história);
* não há callback com difficulty, activity/session state equivalente, tipo
  pensado para isso, implementação removida, nem TODO relacionado;
* o único conceito preexistente é `details.difficulty`, e ele foi **reutilizado**,
  não duplicado.

---

## STATE CONTRACT — DEPOIS

```
useEscapeMaze(onComplete, initialRouteNumber, initialDifficulty = "easy")
        │  useState<DifficultyLevel>(initialDifficulty)
        │  generateMaze(initialDifficulty, initialRouteNumber)
        ▼
endGame → details.difficulty  +  details.nextRouteNumber
        ▼
playAgain lê os DOIS, sob a MESMA guarda de gameId
        ▼
initialRouteNumber + initialDifficulty  →  GameScreen  →  RouteStrategyGame
        ▼
nova instância monta na Rota e no modo da jornada
```

Regras:

* o modo escolhido acompanha a progressão entre Rotas;
* trocar o modo dentro de uma Rota mantém a Rota (04A) e **é esse novo modo que
  viaja**;
* restart preserva Rota e modo;
* `openActivity` (entrada nova pela Home) limpa **os dois** carriers → default
  normal;
* o modo viaja **só quando uma Rota viaja** — `nextDifficulty` só é calculado se
  `nextRouteNumber` existe.

Não é preferência global: `initialDifficulty` vive no estado do `page.tsx`, é
escrito só por `playAgain`, limpo por `openActivity`, e não toca storage.

---

## PRODUCTION FIX

Cinco arquivos, ~30 linhas úteis:

| Arquivo | Mudança |
|---|---|
| `src/types/game.ts` | `initialDifficulty?: DifficultyLevel` em `GameComponentProps` |
| `src/app/page.tsx` | `readDifficulty()` (narrowing), estado `initialDifficulty`, `playAgain` lê `details.difficulty`, `openActivity` limpa |
| `src/components/GameScreen.tsx` | repasse |
| `src/games/escape-maze/RouteStrategyGame.tsx` | repasse ao hook |
| `src/games/escape-maze/useEscapeMaze.ts` | 3º parâmetro; `useState(initialDifficulty)`; mapa inicial gerado com ele |

Sem localStorage, sem sessionStorage, sem global, sem singleton, sem query
string, sem timeout, sem `useEffect` corretivo, sem flag de remount, sem estado
duplicado.

`details` é `Record<string, number | string | boolean>`, então o valor é
estreitado antes de voltar ao produto. Qualquer coisa não reconhecida vira
`undefined` — que é exatamente o default de entrada nova. Sem throw, sem branch
de fallback.

---

## RESULTADOS

`difficulty-remount-persistence.json` — `DIFFICULTY_REMOUNT_PERSISTENCE_OK`

| Teste | Resultado |
|---|---|
| A — matriz de remount | **6/6** |
| B — instância que chega gera a combinação carregada | 6/6 |
| C — restart preserva os dois | **9/9** (R1/R2/R3 × 3 modos) |
| D — troca no meio da Rota viaja | 3/3 |
| E — entrada nova não herda nada | 3/3 |
| F — Rota 3 / fim da jornada | 3/3 |
| G — nada vaza pelo boundary | 4/4 |

### Matriz de remount

| Origem | Modo | Destino | ✓ |
|---|---|---|---|
| R1 | easy | R2 easy | ✓ |
| R1 | medium | R2 medium | ✓ |
| R1 | hard | R2 hard | ✓ |
| R2 | easy | R3 easy | ✓ |
| R2 | medium | R3 medium | ✓ |
| R2 | hard | R3 hard | ✓ |

**Os testes não presumem o formato do payload.** Onde uma jornada é medida, a
Rota é jogada até o fim no harness, o `details` que o jogo realmente emitiu passa
pela **mesma** função de narrowing que o `playAgain` executa, e a próxima
instância é montada a partir disso — objeto real, leitura real.

### Troca no meio da Rota (D)

`R2 easy → jogador escolhe hard → R2 hard → termina → R3 hard`. Também
`easy→medium` e `hard→easy`. Em todos, a Rota se manteve durante a troca (04A) e
o **novo** modo foi o que viajou.

### Entrada nova pela Home (E)

`openActivity` limpa os dois carriers. Medido com jornadas anteriores em easy,
medium e hard: a entrada nova sempre chega em **R1 / easy**. O modo anterior está
visível no payload e comprovadamente não é adotado.

### Rota 3 / fim da jornada (F)

**Não existe Rota terminal hoje.** `getRouteStage(n) = ((n-1) % 3) + 1`, então as
Rotas são ilimitadas e a *etapa* cicla: a Rota 4 é etapa 1.

Este modelo é preexistente e **não foi alterado**. Nenhuma Rota 4 foi
"introduzida" — ela já existia. O que foi feito é verificar que o carry funciona
através do wrap (R3/hard → R4/hard, etapa 1) em vez de inventar uma parada.

### Nada vaza (G)

`playAgain` só calcula o modo quando há `nextRouteNumber`. Verificado contra a
narrowing real:

| Caso | Modo carregado |
|---|---|
| resultado de outro jogo | nenhum |
| resultado de rota sem `nextRouteNumber` | nenhum |
| modo não reconhecido (`"nightmare"`) | nenhum |
| modo não-string (`3`) | nenhum |

---

## RNG / MAP IDENTITY

`EXPECTED_RNG_SEQUENCE_DIFFERENCE` da 04A permanece válido e não foi tocado.
Nenhum parâmetro de RNG ou geração foi alterado.

O que o teste B prova é o que a missão pede — que a geração recebe a combinação
certa:

* o mapa da instância que chega é **idêntico** a `generateMaze(modoCarregado, rotaCarregada)` na mesma posição de seed;
* e para medium/hard é **provavelmente diferente** do antigo default easy — a
  prova de que algo mudou de fato;
* para easy o mapa carregado **é** o antigo default, que é o no-op correto.

---

## REGRESSÕES

| Suíte | Veredito |
|---|---|
| `route-difficulty-identity-tests` (04A) | `ROUTE_DIFFICULTY_IDENTITY_OK` |
| `difficulty-baseline-tests` | `DIFFICULTY_BASELINE_TESTS_OK` |
| `chest-controlled-tests` | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests` | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests` | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay` | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit` | `STATIC_RENDER_AUDIT_OK` |

**3 Babylon lights.** Nenhum parâmetro de dificuldade, wall, light, trap, Hunter,
Sentinel, RNG, Chest, Pickaxe, Second Chance, geração, regra de vitória ou timer
foi tocado.

### Um hack de teste ficou obsoleto e encolheu

O harness tinha um `directDifficulty` que **reescrevia o código-fonte do hook**
para montar no modo pedido. Ele parou o build com
`"production hook shape changed"` assim que o `useState` mudou — que é
exatamente o que aquele guard existia para fazer.

Duas das três reescritas viraram desnecessárias: montar no modo pedido e gerar o
primeiro mapa com ele são agora o que `initialDifficulty` faz **em produção**. O
harness passou a pedir, em vez de remendar.

Sobrou só a terceira, que produção legitimamente faz e uma comparação de uma
chamada não pode pagar: `startGame` gerando um **segundo** tabuleiro.

---

## RISCOS REMANESCENTES

* **Sem Rota terminal.** As Rotas crescem sem limite e a etapa cicla mod 3. É o
  modelo que já existia; se o produto quiser um fim de jornada, é decisão de
  produto e não foi antecipada aqui.
* **O modo não sobrevive a sair para a Home e voltar.** É intencional — §4 pede
  que uma entrada nova use o default — mas vale registrar que "continuar" e
  "entrar de novo" são caminhos com semânticas diferentes de propósito.

---

## Reproduzir

```bash
node tools/validation/difficulty-remount-persistence-tests.mjs
```
```bash
node tools/validation/route-difficulty-identity-tests.mjs
```
```bash
node tools/validation/difficulty-baseline-tests.mjs
```
