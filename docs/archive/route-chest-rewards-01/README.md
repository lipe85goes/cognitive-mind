# ROTA-CHEST-REWARDS-01 — evidências

O antigo escudo azul deixou de existir. No seu lugar há um **baú**: um desvio
opcional que faz uma pergunta — *"qual ferramenta faz mais sentido para este
tabuleiro?"* — e entrega **uma** resposta.

E a Picareta, escolhida no baú, faz a segunda pergunta:
*"você pode abrir uma parede. Qual?"*

---

## Duas etapas, nesta ordem

Esta missão foi entregue, jogada, e **teve uma decisão de design revista antes do
checkpoint**. A cronologia importa e está registrada como aconteceu:

| | |
|---|---|
| **Entrega original** | Baú, Picareta restrita a paredes certificadas, Segunda Chance, visuais, testes → `READY_FOR_MANUAL_PLAYTEST` |
| **Playtest humano** | marcar as paredes **respondia** a pergunta que a Picareta deveria fazer |
| **Continuação** | Picareta abre **qualquer parede interna**; escolher qual virou a dificuldade |

Nenhum commit foi feito entre as duas etapas: o working tree carrega as duas.

Contrato vigente da Picareta:
[`pickaxe-free-wall-choice-contract.md`](pickaxe-free-wall-choice-contract.md).

---

## Flags registradas (§34 / §50)

```
PRE_CHEST_BASELINE_COMMIT           = eb26368
CHEST_REPLACES_SHIELD               = true
REWARD_OPTIONS_V1                   = [PICKAXE, SECOND_CHANCE]
REWARD_SELECTION_RANDOM             = false

PICKAXE_USES                        = 1
PICKAXE_TARGET_POLICY               = ANY_INTERNAL_MAZE_WALL
PLAYER_SELECTS_WALL                 = true
NO_GENERATOR_PRESELECTION           = true
NO_VISUAL_CORRECT_WALL_HINT         = true
NO_PERMANENT_GOOD_WALL_HINT         = true
BAD_STRATEGIC_WALL_CHOICE_ALLOWED   = true
BROKEN_WALL_WALKABLE_BY_ALL         = true
BREAK_WALL_CONSUMES_TURN            = true

CERTIFIED_WALL_RUNTIME_RESTRICTION  = false
CERTIFIED_WALL_ANALYSIS_PRESERVED   = true
BREAKABLE_WALL_FEASIBILITY_GATE     = SUPERSEDED_AS_RUNTIME_RESTRICTION
BREAKABLE_WALL_FEASIBILITY_EVIDENCE = PRESERVED

SECOND_CHANCE_CHARGES               = 1
CHEST_MANUAL_PLAYTEST               = PASS
FREE_WALL_PICKAXE_MANUAL_PLAYTEST   = PASS
WALL_BREAK_VISUAL_POLISH_OPTIONAL   = true
DYNAMIC_SOLVABILITY_02_REQUIRED     = true
MAP_REPAIR_PERFORMED                = false
SOLVER_RUN_IN_THIS_MISSION          = false

DUAL_GUARDIAN_CO_OCCUPANCY_FOLLOWUP_REQUIRED = true
ROUTE_VISUAL_FLICKER_FOLLOWUP_REQUIRED       = true
SENTINEL_STALL_FOLLOWUP_REQUIRED             = true
DIFFICULTY_REBALANCE_REQUIRED                = true
```

Registrado do trabalho original, ainda verdadeiro como medição:

```
BREAKABLE_WALL_HAS_TOPOLOGICAL_EFFECT = true
```

---

## Veredito

**`ROTA-CHEST-REWARDS-01_FREE_WALL_PICKAXE_MANUAL_PLAYTEST_PASS`**

20 / 20 itens de §38, validações automatizadas e playtest humano em navegador
passaram. O usuário aprovou o Chest, a escolha de reward e a Picareta livre como
parte do quebra-cabeça.

Um único checkpoint local foi autorizado para proteger este estado. Push,
follow-ups e próxima missão continuam fora do escopo.

---

## O que aconteceu, em ordem

### FASE 0 — auditoria (`shield-to-chest-audit.md`)

O achado que dirigiu todo o resto: **`setShieldUsed(true)` não era chamado em
lugar nenhum**. O escudo perdeu seu único consumidor (a penalidade de armadilha)
na missão anterior e era, na prática, um colecionável sem efeito — enquanto o HUD
prometia *"Use o escudo para se proteger uma vez."*

Consequências:

* substituir o escudo não remove gameplay; remove uma promessa não cumprida;
* o slot estrutural dele é reaproveitável inteiro (mesmos números, mesmo gate);
* não há código antigo de resolução de captura a reaproveitar — a Segunda Chance
  é desenho novo.

### FASE 1 — feasibility, antes de implementar (`breakable-wall-contract.md`, `breakable-wall-feasibility.json`)

Mediu se abrir uma parede muda alguma coisa nestes tabuleiros, **antes** de a
Picareta existir.

| | |
|---|---|
| Templates × modos | 9 × 3 |
| Seeds por combinação | 12 |
| Mapas medidos | **324** |
| Mapas com zero paredes com efeito topológico | **0** |
| Com efeito, por mapa | min **2** · média **11,4** · max **21** |
| Violações de determinismo | **0** |

`BREAKABLE_WALL_FEASIBILITY_PASSED` → não houve bloqueio, e a Picareta pôde ser
implementada.

> **Papel hoje:** esta campanha **decidia** quais paredes podiam ser abertas. Não
> decide mais nada (`SUPERSEDED_AS_RUNTIME_RESTRICTION`), mas continua sendo o
> motivo pelo qual a mecânica existe (`EVIDENCE = PRESERVED`). A regra saiu de
> `src/` para `tools/validation/breakable-wall-certifier.mjs`, e a mudança foi
> verificada re-executando a campanha: **números idênticos**
> (`reproducedExactly = true`).

### FASES 2–4 — Chest, Picareta, Segunda Chance, visual

Estado mínimo (quatro campos), turno com pausa, quebra que custa um turno, e um
baú de pedra e bronze com uma brasa teal discreta, no Babylon e no fallback.

### FASE 5 — testes

Os contratos são uma máquina de estados, então são testados **rodando a máquina**:
`route-runtime-harness.mjs` é um React de ~70 linhas que dirige o
`useEscapeMaze` de produção sem modificá-lo.

### CONTINUAÇÃO — Picareta de escolha livre

Permissão de runtime reduzida a guards físicos; `MazeMap.breakableWalls`
removido; rachaduras permanentes removidas dos dois renderers e substituídas por
alvo contextual; suíte da Picareta reescrita para provar a **ausência** de
restrição.

---

## Resultados

| Suíte | Veredito |
|---|---|
| `breakable-wall-feasibility.json` | `BREAKABLE_WALL_FEASIBILITY_PASSED` · reproduz a campanha original exatamente |
| `chest-controlled-tests.json` — A–H | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests.json` — A–N + BAD_CHOICE + DEFENDER_BENEFIT | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests.json` — P–T | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay.json` — regressões + 9 combinações | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit.json` | `STATIC_RENDER_AUDIT_OK` |
| `route-chest-rewards-01-acceptance.json` — 20 itens (§38) | **20 / 20** |

Regressões, com números:

| | |
|---|---|
| Sentinela c3 | 648 estados · 0 divergências · 0 ocupação do portal · leash intacto |
| Caçador | 648 estados · 0 divergências |
| Armadilhas | 33 armadas na chegada · 0 falhas · 0 defensores sobre armada · 0 penalidades ao Explorer · 0 armadas após reset |
| Portal / luzes | portal recusou sem as luzes · 0 vitórias antecipadas · 0 luz coletada por quebra · requisito de luzes inalterado |
| 9 combinações × 2 recompensas | 18 cenários · 0 crashes · resets limpos |

A prova de que a escolha é mesmo livre:

| | |
|---|---|
| Paredes quebradas que o certificador aposentado **recusaria** | **4** nos testes controlados · **4** na bateria de gameplay |
| Paredes quebradas que ele aprovaria (para comparação) | 3 na bateria |
| Opções fracas quebradas sem o runtime recusar | **6** fixtures |
| `rewardEligibility(wall)` implementado | **não** |
| Aberturas que encurtam o caminho do Caçador, permitidas | **3** fixtures |

O validador estrutural de mapas (`validate-route-9x9.mjs`) roda limpo:
`errors: []`, `generationThrows: []`.

---

## Condição pré-existente registrada, não corrigida

**`HUNTER_MAY_STAND_ON_THE_SENTINEL`**

`chooseGuardianMove` exclui o portal e as armadilhas armadas das células legais do
Caçador — nunca a do Sentinela — enquanto `decideSentinelMove` é protegido no
sentido inverso. Os dois defensores podem, portanto, compartilhar célula.

Medido em jogo comum, **sem Baú, sem recompensa e sem parede quebrada**:
**23 de 1.466 turnos (~1,6%)**.

* Não é introduzida por esta missão.
* A resolução da Segunda Chance não a cria nem a agrava: cada peça volta para a
  casa que já ocupava. O teste S verifica separadamente que **nenhuma sobreposição
  nova** é introduzida (0 em 19 ativações).
* A política do Caçador não pode ser alterada nesta missão, então fica registrada.

```
DUAL_GUARDIAN_CO_OCCUPANCY_FOLLOWUP_REQUIRED = true
```

Encaminhamento: item próprio antes de `ROTA-DYNAMIC-SOLVABILITY-02`. Nada foi
alterado no Caçador nem no Sentinela para esconder o problema.

## Follow-ups preservados — não implementados aqui

O playtest manual também produziu observações separadas. Elas ficam registradas,
sem converter hipótese em causa ou expandir o escopo do checkpoint:

* **Wall break polish:** um pouco mais de peso visual é opcional e não bloqueia.
* **Flicker:** piscadas ocasionais serão investigadas em `ROTA-RUNTIME-STABILITY-02`; a causa não está provada.
* **Sentinel stall:** o aparente travamento exige reprodução completa antes de ser chamado de bug.
* **Difficulty:** o rebalanceamento pertence a `ROTA-DIFFICULTY-FINAL-01`.
* **Timer:** direção futura apenas para o nível mais alto, com contrato ainda não definido.

```
WALL_BREAK_VISUAL_POLISH_OPTIONAL          = true
ROUTE_VISUAL_FLICKER_FOLLOWUP_REQUIRED    = true
SENTINEL_STALL_FOLLOWUP_REQUIRED          = true
DIFFICULTY_REBALANCE_REQUIRED             = true
```

Nenhum desses itens alterou Sentinel, Hunter, render loop, dificuldade, timer,
rebalanceamento ou solver neste checkpoint.

---

## Golden seeds (§23 / §41)

`golden-seeds-post-chest-input.json` — **inspecionadas, não tunadas**.

| seed | modo/rota | baú | paredes legais para a Picareta | (o certificador aposentado aprovaria) |
|---|---|---|---|---|
| 8801214 | hard / r1 | `8,4` | **20** | 13 |
| 8801107 | medium / r1 | `5,1` | **20** | 9 |

Com escolha livre, a lista de alvos **é** a lista de paredes do mapa. A coluna da
direita existe só para que a `SOLVABILITY-02` possa separar as duas populações se
quiser; ela não restringe nada.

Nenhum hack: sem parede especial, sem template hack, sem exceção de dificuldade,
sem spawn dedicado, sem reward dedicada a seed, e **nenhuma parede escolhida para
resolver estas seeds** (§23).

**Nenhuma conclusão de solvabilidade foi tirada.** `dynamic-solver.mjs` não foi
alterado; nenhum dos 136 inconclusivos, dos 180 mapas ou das golden seeds foi
reprocessado. Que parede A leve a uma região não vencível, B a *possible but not
guaranteed* e C a uma solução garantida é **o comportamento desejado**, e
descobrir isso pertence a `ROTA-DYNAMIC-SOLVABILITY-02`.

---

## Validações (§51)

```bash
npm.cmd run lint
```
```bash
npx.cmd tsc --noEmit
```
```bash
npm.cmd run build
```
```bash
git diff --check
```

| | |
|---|---|
| lint | **0 errors, 0 warnings** |
| TypeScript | passa |
| build | passa (Next.js 16.2.6) |
| `git diff --check` | passa |
| Babylon lights | **3** (`route-key-light`, `route-fill-light`, `route-rim-light`), `ROUTE_MAX_LIGHTS = 3` |
| Nova Light adicionada | nenhuma — baú, anéis de alvo e escombros são material + emissive + GlowLayer existente |
| Debug temporário | nenhum |
| Servidor/processo órfão | nenhum (o dev server foi iniciado para conferência e encerrado) |
| Checkpoint / push | um commit local autorizado · push fora do escopo |

### Cobertura visual externa

O `next dev` sobe e serve `200`, e o console não reporta nenhum erro da
aplicação — apenas o WebSocket de HMR, por causa do host usado na conferência.
Mas **o painel deste ambiente não compõe frames**, então nenhuma cena WebGL
monta: a home não cria canvas, e a transição de entrada do mundo — que espera o
`onEntryReady` da cena 3D — nunca conclui. É a mesma limitação registrada em
`route-traps-strategy-01/trap-static-render-audit.json`, e vale para o aplicativo
inteiro, não para esta mudança.

O que cobre esse vão: o `next build` compila e tipa os dois renderers, a auditoria
estática lê os dois como fonte, e as 18 partidas automatizadas exercitam o hook
real de ponta a ponta. O julgamento visual é exatamente o que §54 reserva para o
playtest humano.

Esse julgamento foi executado pelo usuário em navegador real: Chest e Picareta
livre receberam `PASS`, inclusive com múltiplas paredes adjacentes e continuidade
de portal/luzes.
Quatro avisos de lint apareceram durante o trabalho, todos em ferramentas novas
desta missão (três imports não usados e uma chamada de hook fora de um
componente), e todos foram corrigidos.

> Na continuação, o `next build` volta a ser a cobertura principal do render: ele
> compila e tipa os dois renderers com a linguagem de alvo contextual no lugar
> das rachaduras, e a auditoria estática afirma mecanicamente que **nenhuma marca
> permanente** identifica uma parede.

---

## Reproduzir

```bash
node tools/validation/breakable-wall-feasibility.mjs --seeds 12
```

> `--seeds 12` é o tamanho da campanha original e o único em que a comparação de
> fidelidade (`reproducedExactly`) é feita. Rodar com menos sobrescreve o
> `breakable-wall-feasibility.json` com uma amostra menor e marca a comparação
> como `comparable: false` — útil para um smoke test, não para a evidência.
```bash
node tools/validation/chest-controlled-tests.mjs
```
```bash
node tools/validation/pickaxe-controlled-tests.mjs
```
```bash
node tools/validation/second-chance-controlled-tests.mjs
```
```bash
node tools/validation/chest-runtime-gameplay.mjs
```
```bash
node tools/validation/chest-static-render-audit.mjs
```
```bash
node tools/validation/golden-seeds-post-chest-input.mjs
```
```bash
node tools/validation/chest-acceptance.mjs --validations-passed
```

---

## Mapa das evidências

| Arquivo | O que decide |
|---|---|
| `shield-to-chest-audit.md` | FASE 0 — o que o escudo era, e o que já existia |
| **`pickaxe-free-wall-choice-contract.md`** | **contrato vigente da Picareta, e a cronologia da revisão** |
| `breakable-wall-contract.md` | a regra de certificação original — supersedida como restrição |
| `breakable-wall-feasibility.json` | FASE 1 — a medição preservada, e a prova de que a mudança não a alterou |
| `chest-runtime-contract.md` | estado mínimo, paredes efetivas, reset, observabilidade |
| `chest-turn-order.md` | a pausa, a retomada, as quatro capturas, o turno da quebra |
| `reward-choice-contract.md` | duas opções, sem RNG, escolha do Explorer |
| `pickaxe-runtime-contract.md` | guards, custo do turno, abertura física, UX |
| `second-chance-design.md` | as opções comparadas e por que esta foi escolhida |
| `second-chance-runtime-contract.md` | contrato mínimo e cobertura medida |
| `chest-controlled-tests.json` | A–H |
| `pickaxe-controlled-tests.json` | A–N + BAD_CHOICE + DEFENDER_BENEFIT |
| `second-chance-controlled-tests.json` | P–T |
| `chest-runtime-gameplay.json` | regressões + 9 combinações, com escolha livre de parede |
| `chest-static-render-audit.json` | 3 luzes, os dois renderers, escudo removido, **nenhuma marca permanente** |
| `golden-seeds-post-chest-input.json` | entrada para a 02, sem veredito |
| `route-chest-rewards-01-acceptance.json` | os 20 itens de §38 |

---

## Roteiro e resultado do playtest manual (§37)

O usuário executou este roteiro em navegador real e aprovou a versão de escolha
livre. Os itens abaixo permanecem como registro do que foi observado.

**Baú** — é bonito? parece opcional? a escolha é clara?
Pedra e bronze, brasa teal discreta, mais quieto que o portal. Fechado: tampa
baixada e brasa acesa. Aberto: tampa recostada, brasa apagada, pedra cinza — ele
**fica** no tabuleiro, gasto. *(inalterado)*

**Picareta — o foco desta rodada.**

1. pegue a Picareta no baú;
2. fique perto de paredes **comuns**;
3. **confirme que paredes que antes não tinham rachadura agora também são alvos** —
   nenhuma parede tem marca própria; o anel de bronze aparece **porque você tem a
   Picareta e está do lado dela**, e some quando ela é gasta;
4. **escolha entre duas paredes possíveis** — cada botão diz a direção
   (`acima`, `à esquerda`…) e apontar para ele acende **aquela** parede no
   tabuleiro;
5. **quebre uma parede "ruim" de propósito** — o jogo não vai impedir, e é para
   ser assim;
6. confirme que a Picareta acaba: um uso, mesmo com dezenas de paredes de pé;
7. verifique que a abertura serve aos defensores também;
8. **confirme que não existe nenhuma indicação permanente de qual parede é
   melhor**;
9. veja se escolher a parede parece parte do quebra-cabeça.

Bater na parede nunca gasta a Picareta — só diz que ela poderia abri-la.
`Enter` funciona quando há exatamente uma ao alcance; com duas, a escolha é sua.

**Segunda Chance** — entendo quando me salvou? não parece bug? fica claro que
acabou?
Duas mensagens distintas conforme quem invadiu quem, e o HUD passa de `2ª Chance`
para `2ª Chance usada` no mesmo instante. *(inalterado)*

**Estratégia** — a escolha entre as duas recompensas parece real? E a escolha da
parede? Essas são as perguntas que só o jogo responde.

Resultado externo registrado:

```
CHEST_MANUAL_PLAYTEST             = PASS
FREE_WALL_PICKAXE_MANUAL_PLAYTEST = PASS
```

Chest, reward choice, paredes comuns, seleção direcional, gasto da Picareta e
continuidade de portal/luzes foram observados funcionando.

---

## Depois

1. este checkpoint não inicia nenhum follow-up;
2. `ROTA-RUNTIME-STABILITY-02` investiga flicker e o aparente Sentinel stall;
3. `DUAL_GUARDIAN_CO_OCCUPANCY` é tratado antes do solver pós-Chest;
4. `ROTA-DIFFICULTY-FINAL-01` define rebalanceamento e o contrato futuro do timer;
5. `ROTA-DYNAMIC-SOLVABILITY-02` reavalia o espaço de estados pós-Chest;
6. só então `MAP REPAIR / FINAL MAP AUDIT`.
