# ROTA-DIFFICULTY-04C — launcher diagnóstico

O baseline apontou seeds específicas que precisam ser **jogadas por uma pessoa**.
Esta missão cria o menor caminho seguro para isso: iniciar a Rota Estratégica
real com Route, Difficulty e Seed explícitos, sem mudar nada do produto.

Não é rebalanceamento. Nenhum parâmetro de jogo foi tocado.

---

## RNG OWNERSHIP — ANTES

A pergunta obrigatória:

> **CAN PRODUCTION GAMEPLAY BE SEEDED WITHOUT CHANGING NORMAL GAMEPLAY SEMANTICS?**

**Não. Não existia seam algum.** `Math.random()` era chamado direto, em dois
módulos, e ambos são da Rota:

| Módulo | Sites | O quê |
|---|---|---|
| `games/escape-maze/useEscapeMaze.ts` | 6 | template/exit pick, randomização de paredes, jitter de luzes, jitter de traps, desempate do Caçador em easy |
| `engine/difficulty.ts` | 3 | `pickRandom` + as duas decisões estocásticas de `getPredatorNextPosition` (a política do Caçador) |

`engine/difficulty.ts` é importado **apenas** por `useEscapeMaze.ts` — é Rota na
prática, apesar do nome genérico.

A tooling de validação já seedava, mas por um caminho que o navegador não tem:
`instrumented-generator.mjs` roda o hook compilado dentro de um sandbox `vm` com
o global `Math` trocado. Impossível em produção.

**Padrão dev-only existente:** `src/app/lab/3d-home/page.tsx` — uma rota `/lab/*`
que reutiliza o fluxo real via `GameScreen`. Foi esse precedente que o launcher
seguiu, em vez de inventar um mecanismo novo.

---

## ARQUITETURA DIAGNÓSTICA

```
/lab/route-launcher  (dev-only, só por URL)
        │  armRouteRandomSeed(seed)   ← antes de montar
        │  initialRouteNumber + initialDifficulty
        ▼
GameScreen → RouteStrategyGame → useEscapeMaze
        │                              (o jogo REAL, sem cópia de regra)
        ▼
engine/route-random.ts   ← o único seam
   routeRandom()  →  seededDraw ?? Math.random
```

`src/engine/route-random.ts` é a abstração mínima:

* `routeRandom()` — todo sorteio da Rota passa aqui;
* `armRouteRandomSeed(seed)` / `clearRouteRandomSeed()` — só o launcher chama;
* `beginSeededGeneration()` — chamado no topo de `generateMaze`; **no-op** sem
  seed armada.

O PRNG é **caractere por caractere** o `createSeededRandom` de
`tools/validation/route-lab.mjs`. Reproduzir uma witness exige a mesma
aritmética, não "um" gerador seedado qualquer.

### Por que `beginSeededGeneration`

O hook gera um tabuleiro na montagem e **outro** no "Iniciar rota". As seeds do
baseline foram medidas como **uma** chamada `generateMaze` a partir de um fluxo
limpo. Reiniciar o fluxo no topo de cada geração faz três coisas ao mesmo tempo:

* a witness fica alcançável (senão o jogador jogaria a segunda geração);
* o cenário é o mesmo tabuleiro no Launch, no Iniciar e em **todo Restart** —
  que é exatamente o que um playtester precisa para repetir uma decisão;
* sorteios **depois** da geração (o Caçador, sobretudo) seguem no mesmo fluxo,
  então as decisões de runtime também são reprodutíveis.

---

## CONTRATO DO MODO NORMAL

Com nada armado:

| | |
|---|---|
| `routeRandom()` | é `Math.random()` |
| geração | estocástica, como sempre |
| Route / Difficulty | inalterados |
| seed fixa | nenhuma |
| UI extra | nenhuma |
| storage | nenhum |

Provado (teste A): 2000 sorteios, **2000 distintos**; e 9 pares de
`generateMaze(mode, route)` repetidos → **0 tabuleiros idênticos**.

Provado (teste E): armar → gerar → `clearRouteRandomSeed()` → a geração volta a
ser estocástica e **nenhuma** das gerações seguintes repete o tabuleiro seedado.

---

## CONTRATO DO MODO SEEDED

`route + difficulty + seed` → mesmo estado inicial relevante.

| Prova | Resultado |
|---|---|
| **Generation determinism** (B) | 5/5 — mesmo tabuleiro re-armando **e** em gerações consecutivas sob a mesma arma |
| **Runtime RNG determinism** (D) | 5/5 — estado inicial idêntico **e** posições de Caçador e Sentinela idênticas turno a turno, ao longo de 12 turnos roteirizados |

Runtime determinism foi investigado **em separado** da geração, como pedido, e
sim: o fluxo runtime inteiro é reprodutível, porque a política do Caçador
(`engine/difficulty.ts`) passa pelo mesmo seam. Não ficou como follow-up.

Nenhuma probabilidade mudou: cada call site sorteia um número, na mesma ordem de
sempre.

---

## REPRODUÇÃO DAS WITNESSES

Comparado contra o **`mapHash` gravado** em `difficulty-baseline.json` — não
contra um re-run da tooling. Um re-run poderia concordar consigo mesmo enquanto
os dois derivavam juntos; o artefato commitado não pode.

| ID | Cenário | Seed | Bate com o hash gravado | Traço registrado |
|---|---|---|---|---|
| A | R3 hard | `12432045` | ✅ | objective route de **43** moves |
| B | R3 hard | `12432116` | ✅ | forced streak de 10 |
| C | R3 easy | `12430048` | ✅ | Chest detour de 10 |
| D | R2 medium | `12421027` | ✅ | Pickaxe melhora 10 moves |
| E | R2 easy | `12420031` | ✅ | Hunter a distância 9 |

Cada seed também **decodifica sozinha** para o cenário declarado, pela fórmula do
baseline `12400000 + route*10000 + modeIndex*1000 + sample` — nenhuma delas foi
aceita só porque o hash bateu.

Nada foi alterado no baseline nem na geração para fabricar correspondência.

---

## UI DIAGNÓSTICA

`/lab/route-launcher`. Estilos inline de propósito: não deve crescer um design
system nem contaminar o CSS do produto.

* campos Route / Difficulty / Seed + **Launch**;
* bateria de 5 cenários em um clique;
* faixa fixa no topo durante a partida com Route, Difficulty, Seed e a seed
  armada — para o operador conferir antes de jogar;
* **Relançar** (mesmo cenário, do zero) e **Sair do diagnóstico** (desarma).

Validação: seed inteiro `0..4294967295`; route inteiro `1..999`; difficulty
apenas `easy` / `medium` / `hard`. Entrada inválida não lança e mostra o motivo.

> O teto de 999 em Route é limite sensato de campo de texto, **não** regra de
> produto. Route 4 é aceita porque as Rotas são ilimitadas por desenho.

---

## O QUE NÃO PUDE VERIFICAR AQUI

A rota existe, o build a emite (`○ /lab/route-launcher`) e o servidor a entrega:
o formulário, a bateria e os textos renderizam.

Mas **a página não hidrata neste ambiente** — nenhum fiber do React em nenhum nó,
então nenhum clique dispara. Testei o controle: **a Home do próprio produto
também não hidrata aqui** (`hydrated: false`, com as 20 tags de script
carregadas). É limitação do painel, não do launcher — e é o diagnóstico preciso
do "clicar não faz nada" que apareceu nas duas missões anteriores.

O que cobre esse vão: a suíte dirige os módulos reais — os parsers, o seam, o
determinismo, as witnesses e a contenção — e o `next build` compila a página.
Interatividade real fica para o operador.

---

## DELTAS

### PRODUCTION-SHARED CODE DELTA

Sim, foi necessário mexer em código compartilhado — não havia seam. Mínimo e
opt-in:

| Arquivo | Mudança |
|---|---|
| `src/engine/route-random.ts` | **novo** — o seam inteiro |
| `src/engine/difficulty.ts` | 3 × `Math.random()` → `routeRandom()` + import |
| `src/games/escape-maze/useEscapeMaze.ts` | 6 × `Math.random()` → `routeRandom()`, import, e `beginSeededGeneration()` no topo de `generateMaze` |

Default preservado por construção: sem seed armada, `routeRandom()` **é**
`Math.random()` e `beginSeededGeneration()` retorna imediatamente. Coberto pelas
regressões e pelos testes A e E.

Não substitui o `Math.random` global. Não usa storage, cookie ou query string.

### DIAGNOSTIC UI DELTA
`src/app/lab/route-launcher/page.tsx` — novo, isolado, code-split.

### TEST / TOOLING DELTA
`diagnostic-launcher-tests.mjs` (novo); `instrumented-generator.mjs` passa a
carregar o seam **uma vez** e entregar a mesma instância aos dois módulos —
duas cópias dessincronizariam o Caçador da geração; `route-runtime-harness.mjs`
expõe o seam.

### EVIDENCE / DOC DELTA
Este README, `human-playtest-card.md`, `diagnostic-launcher.json`.

---

## REGRESSÕES

| Suíte | Veredito |
|---|---|
| `diagnostic-launcher-tests` | `DIAGNOSTIC_LAUNCHER_OK` |
| `route-difficulty-identity-tests` (04A) | `ROUTE_DIFFICULTY_IDENTITY_OK` |
| `difficulty-remount-persistence-tests` (04B) | `DIFFICULTY_REMOUNT_PERSISTENCE_OK` |
| `difficulty-baseline-tests` | `DIFFICULTY_BASELINE_TESTS_OK` |
| `chest-controlled-tests` | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests` | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests` | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay` | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit` | `STATIC_RENDER_AUDIT_OK` |

**3 Babylon lights.**

---

## FOLLOW-UP

```
ROUTE_JOURNEY_TERMINATION_DECISION_REQUIRED = true
```

O runtime permite `R1 → R2 → R3 → R4(stage 1) → …` sem fim. Registrado, **não
alterado** nesta missão.

---

## RISCOS REMANESCENTES

* **O seam é estado de módulo.** É o preço de seedar sem tocar no `Math` global.
  A contenção é o `useEffect` de unmount do launcher; se alguém armar uma seed de
  outro lugar sem desarmar, o produto ficaria seedado. Mitigação atual: nada no
  produto chama `armRouteRandomSeed`, e o teste G falha se isso mudar.
* **A interatividade do launcher não foi verificada em navegador** por limitação
  do ambiente (a Home do produto também não hidrata aqui).

---

## Reproduzir

```bash
node tools/validation/diagnostic-launcher-tests.mjs
```
