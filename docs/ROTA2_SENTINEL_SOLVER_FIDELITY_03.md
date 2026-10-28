# ROTA2-SENTINEL-SOLVER-FIDELITY-03 — o solver de referência mede a Sentinela como o hook

Missão de **ferramenta** (tooling-only). Base exata:
`f5826b2e587d8381ac2e9d05be5c1b517b97dcdc`. Branch:
`feat/rota2-sentinel-solver-fidelity-03`. Nenhum arquivo de `src/` mudou; nenhum
comportamento de jogo mudou; nenhuma dependência, estado, ação ou evento novo;
nenhuma exceção nova no Platform Lock. O Caçador Adaptativo **não** faz parte
desta missão.

A produção é a verdade. O modelo analítico passa a representar a Sentinela que
já existe — não uma Sentinela idealizada.

## 1. A lacuna

A ROTA2-DEPENDENT-OBJECTIVES-02 mediu, numa corrida direta ao portal na Rota 1
(seeds 6400–6439, três modos), **25 de 2016** transições do hook fora do
suporte do solver de referência, idênticas na árvore v1 `9f8ebb5` — uma lacuna
anterior à Rota 2.0.

**Produção** (`decideSentinelMove`, `route-defenders.ts`): o grafo dos
defensores é `paredes do turno ∪ armadilhas armadas`; com compromisso ativo a
Sentinela mantém a porta segurada e mede tudo com

```text
toTarget = getReachableDistances(target, graph)
```

e `getReachableDistances` (`route-geometry.ts`) **semeia a célula inicial com 0
mesmo que ela esteja em `graph`** e expande pelos vizinhos legais. Uma porta que
virou armadilha armada continua alcançável a partir dos seus vizinhos: o
compromisso é mantido e a Sentinela anda em direção a ela.

**Solver** (`dynamic-solver-packed-successors.mjs`, `rota2-dynamic-solver.mjs`):
lia a distância à porta de uma tabela todos-os-pares por máscara de armadilhas
(`trapVariant`), cujo BFS **pula** a linha de uma célula bloqueada. Para uma porta
armada a tabela diz UNREACHABLE para toda célula; o solver então

- liberava o compromisso que o hook mantém (alvo e `commitLeft` errados), e
- pontuava todo movimento com 99 (a Sentinela ficava parada ou voltava ao
  portal, onde o hook anda em direção à porta).

Reprodução na base, transição por transição (as 25):

| forma | transições |
| ----- | ---------- |
| porta segurada armada neste turno, peças iguais | 7 (o `heldDoorArmed` da census anterior) |
| porta armada antes, compromisso ainda correndo (inclui recompromisso numa porta armada), peças iguais | 16 |
| porta segurada armada neste turno, Sentinela em outra célula | 1 |
| porta armada antes, Sentinela em outra célula | 1 |

As 25 têm a mesma causa (o "other: 18" da census anterior são os turnos
seguintes do mesmo compromisso e duas diferenças de posição). Nenhuma outra
classe de divergência apareceu.

## 2. A correção

Um helper puro compartilhado, `tools/validation/sentinel-target-distance.mjs`:

```text
alvo caminhável (nem parede, nem armadilha armada)   distances[from][target]          (como antes)
from === target                                      0                                (a semente)
alvo bloqueado                                       1 + min_{n ∈ N(target)} distances[from][n]
                                                     UNREACHABLE se nenhum n alcança from
N(target) = getNeighbors(target, graph): vizinhos no tabuleiro que não são parede nem armadilha armada
```

**Equivalência com o BFS da produção.** A partir de um alvo bloqueado t,
`getReachableDistances` atribui 1 a cada n ∈ N(t) e depois faz um BFS comum no
grafo caminhável G' (t já está no mapa e nunca é reentrado; nenhuma outra célula
bloqueada é entrada): é um BFS multi-fonte em G' semeado com N(t) no nível 1, e a
distância multi-fonte é o mínimo sobre as fontes. G' é não-direcionado, então
d(n, x) = `distances[x][n]`. Um `from` bloqueado nunca é entrado pelo BFS do hook;
a linha dele na tabela é toda UNREACHABLE e o helper responde UNREACHABLE (o
`undefined` do hook). Verificado exaustivamente (S09): todo alvo × todo `from` ×
toda máscara, nas duas topologias, contra a função de produção.

Os dois solvers leem pelo helper **as três** distâncias ao alvo de `sentinelMove`:
o teste de liberação, a nota de cada candidato e a nota de ficar parado. Nada
mais muda: zona do portal, posto inicial, horizonte de ameaça, coleira, duração
do compromisso, ordem de escolha do alvo, desempates, ordem das opções, quais
células a Sentinela pode pisar (`variant.neighbours`, sem armadilhas), Caçador
antes da Sentinela, empacotamento do estado, índice das portas na união.
Custo: no máximo quatro leituras de tabela por chamada, nenhuma alocação, nenhum
pré-processamento novo.

## 3. Evidência

`docs/archive/rota2-sentinel-solver-fidelity-03/` (`fidelity-tests.json`,
`counterfactual-f5826b2.json`, `mutants.json`, `census.json`,
`superseded-records.md`, `regression.md`).

Tudo é comparado com a produção, nunca com outro modelo:

- o **hook real** (`route-runtime-harness.mjs`), turno a turno;
- o **turno de produção composto de peças de produção** (`oracleSuccessors`,
  `rota2-sentinel-solver-fidelity-lib.mjs`): suporte de referência do Caçador,
  e para cada desfecho dele o `decideSentinelMove` e o
  `computePortalDefenceZone` **reais** no labirinto depois do passo. S00 prova
  que ele É o hook (todo turno real está no suporte dele) e, com o elo
  ignorado, é a referência em string (`dynamic-solver.mjs`);
- um gravador só-leitura dentro de `decideSentinelMove` (localizado por
  declaração) classifica cada decisão — alvo bloqueado ou não, alcançado ou
  liberado — para que toda divergência seja arquivada pela sua classe.

### 3.1 Suíte (S00–S12) — `rota2-sentinel-solver-fidelity-tests.mjs`

142 jogos do hook real (a corrida ao portal que mediu a lacuna + passeios por
armadilhas em seeds onde há liberação e re-indexação de portas), 3 059 turnos;
exploração de produção de profundidade 2 em volta de todo turno onde uma
armadilha importa; grade de decisões em volta de toda porta que é armadilha:
107 297 pares no total.

| | verifica | árvore |
| - | - | - |
| S00 `[preserved]` | o oráculo é o hook (3 059/3 059) e, sem o elo, a referência em string (105 167/105 167) | ok |
| S01 `[preserved]` | porta segurada aberta, nada armado: igual à produção e ao solver pré-missão | ok |
| S02 `[fidelity]` | porta armada mantida como o hook: 87 103 pares, 145 turnos reais (11 armando a porta segurada, 60 turnos seguintes do compromisso, 23 recompromissos numa porta armada, 15 em que a Sentinela anda) | ok |
| S03 `[preserved]` | compromisso realmente inalcançável liberado exatamente quando a produção libera (588 com alvo bloqueado, 47 com alvo aberto isolado por outra armadilha; testemunhas reais de ambos) | ok |
| S04 `[preserved]` | armadilha em outra célula: política preservada | ok |
| S05 `[fidelity]` | labirinto aberto: identidade da porta na união (63 turnos com índice re-mapeado, 64 com porta armada, 9 mapas cujo conjunto de portas muda) | ok |
| S06 `[fidelity]` | topologia estática: o solver estático é a referência em string (105 167 pares), o hook na Rota 1 (43 turnos de porta armada), e aceita um passo das testemunhas arquivadas da 02A sse a produção aceita (10 testemunhas, 185 passos) | ok |
| S07 `[preserved]` | sem armadilha: igual ao pré-missão (dinâmico e estático) | ok |
| S08 `[preserved]` | armadilhas comuns sem a sobreposição: igual ao pré-missão | ok |
| S09 `[fidelity]` | helper = BFS de produção em 3 070 548 pares (40 mapas, toda máscara, as duas topologias); 97 848 decisões da grade = produção; as três leituras pelo helper nos dois solvers; a Sentinela nunca numa célula bloqueada | ok |
| S10 `[preserved]` | suporte do Caçador = produção = pré-missão (95 932 pares isolados); sorteios do hook turno a turno iguais na outra árvore; os solvers não sorteiam | ok |
| S11 `[preserved]` | vitórias, capturas pelo passo e pelo Caçador, Segunda Chance (src idêntico nas duas árvores) | ok |
| S12 `[preserved]` | `git diff f5826b2 -- src/` vazio | ok |

Réplica da medição original (S02): corrida ao portal, **2016 turnos, 25 fora
do suporte no solver pré-missão, 0 no corrigido**.

**Contrafactual** (`--rev=f5826b2`): os 4 `[fidelity]` falham (S02: 144 dos 145
turnos reais fora do suporte — 144 com alvo errado, 110 com `commitLeft`
errado, 80 com a Sentinela em outra célula; S06: aceita dois passos arquivados
que a produção não dá; S09: sem helper, 85 050 decisões da grade erradas), os 9
`[preserved]` valem. Réplica: 25 de 2016.

**Mutantes** (`--mutants`, 12/12 pegos pelo check que miram, nenhum inerte ou
quebrado):

| | mutante | pego por |
| - | - | - |
| M01 | alvo bloqueado sempre UNREACHABLE | S02, S09 |
| M02 | a condição antiga de liberação restaurada | S02, S05, S06 |
| M03 | alvo bloqueado a distância zero | S09 |
| M04 | só o primeiro vizinho legal do alvo bloqueado | S09 |
| M05 | candidatos e ficar parado pontuados fora do BFS a partir do alvo | S02, S09 |
| M06 | estático corrigido, Rota 2.0 errado | S02, S05 |
| M07 | Rota 2.0 corrigido, estático errado | S06 |
| M08 | a Sentinela pode pisar numa armadilha armada | S09 |
| M09 | porta segurada lida pela lista do labirinto aberto, não pela união | S05 |
| M10 | desempate sem armadilha muda | S07, S01 |
| M11 | compromisso realmente inalcançável mantido | S03 |
| M12 | desempate aleatório do Caçador modelado como um sorteio fixo | S10 |

### 3.2 Censo — `rota2-sentinel-solver-fidelity-census.mjs`

1080 mapas (3 Rotas × 3 modos × 120 seeds, as seeds das censuses anteriores).

- **Geração:** 1080/1080 mapas idênticos na base, 1080/1080 com o mesmo número
  de sorteios, 0 exceções.
- **Hook real:** 2160 jogos, **64 328 turnos**; o hook da base faz os mesmos
  turnos com os mesmos sorteios (116 524). Porta segurada numa célula de
  armadilha: 2 529 turnos; armadilha armada durante um compromisso: 829.
  Decisões por classe: NO_TRAP 15 787 · OTHER_TRAP 45 912 · BLOCKED_KEPT 1 031 ·
  OPEN_RELEASED 66 · BLOCKED_RELEASED 10 · sem decisão (captura antes) 1 522.

  | | solver da base | solver corrigido |
  | - | - | - |
  | turnos fora do suporte | **1 031** (todos BLOCKED_KEPT) | **0** |
  | Sentinela em outra célula | 409 | 0 |
  | porta segurada errada | 1 027 | 0 |
  | `commitLeft` errado | 785 | 0 |
  | desfecho terminal errado | 4 | 0 |
  | solver estático, Rota 1 no tabuleiro certificado (10 413 turnos) | 241 | 0 |

  Reproduzem a lacuna: 57 seeds, em todas as 9 combinações Rota × modo (R1:
  38 seeds/867 turnos; R2: 10/126; R3: 9/38).
- **Focado (produção):** 242 251 pares (146 843 explorados, 95 408 da grade;
  88 675 BLOCKED_KEPT): base 87 870 divergências (todas BLOCKED_KEPT), corrigido
  **0**. Estático contra a referência em string: 234 562 pares, base 86 824
  (todas BLOCKED_KEPT), corrigido **0**; oráculo = referência em 234 562/234 562.
  Sentinela numa célula bloqueada: 0.
- **Caçador:** 61 485 turnos isolados com o mesmo suporte nos dois solvers; o
  movimento real do Caçador sempre no suporte.
- **Classes exatas PRE_CHEST** (amostra de 72 mapas das censuses anteriores,
  regras do produto): base P45 U4 G16 I7 — exatamente o registro da
  DEPENDENT-OBJECTIVES-02 — e corrigido P46 U4 G16 I6. Uma mudança:
  **R3 easy 9230007, I → P** (a base estourava o limite de 3 M estados; o
  modelo corrigido explora 2 165 940 e conclui). Nenhum mapa ficou mais difícil
  ou mais fácil entre G/P/U; 10 mapas exploram um número diferente de estados.

### 3.3 Desempenho

Medido na mesma execução (metadados, nunca veredito):

| | base | corrigido |
| - | - | - |
| preparar o contexto dinâmico (por mapa) | 1,14 ms | 1,19 ms (mesmo código; ruído) |
| enumerar sucessores (por transição, 60 000) | 1,26 µs | 1,34 µs (+6%) |
| exploração, 24 mapas até 200 k estados | 258 k estados/s | 282 k estados/s |
| pico de heap na exploração | 25,9 MB | 22,7 MB |
| classificar os 72 mapas | 413 s | 427 s (+3%, inclui o mapa que agora conclui) |

O helper não pré-processa nada, não guarda nada e não aloca: no pior caso
quatro leituras de tabela. A censo completa leva ~24 min.

### 3.4 Registros afetados e regressão

`superseded-records.md` e `regression.md` no arquivo da missão. Resumo:

- **Censos de missões anteriores (modo check).** Na base exata os dois
  registros **batem**; nesta árvore todos os checks seguem passando
  (DYNAMIC-TRAPS-01 16/16, DEPENDENT-OBJECTIVES-02 22/22) e só divergem campos
  que são saída do solver: o mapa 9230007 (`I → P`), o `referenceGap` (25 → 0) e
  o `defenderModelGap` do diferencial (8 → 0 — as 8 transições do seed 9231007
  eram desta classe). Os dois registros foram reescritos com `--update`; os
  valores medidos no commit de cada missão estão listados campo a campo em
  `superseded-records.md`, com a reprodução na base. O §7 da
  DEPENDENT-OBJECTIVES-02 fica como escrito (é o que ela mediu).
- **Registros legados que se reescrevem a cada execução** (ROTA-DYNAMIC-
  SOLVABILITY-01, ROTA-ADVERSARIAL-SOLVABILITY-03, DUAL-GUARDIANS-01B,
  DYNAMIC-SOLVABILITY-02): rodados só em worktrees de rascunho das duas
  árvores; nada foi escrito neles aqui. A deriva que eles já têm na base não é
  desta missão; a diferença base → esta árvore é só a classe corrigida (além
  de percentuais de tempo do perfil de desempenho).
- **Testemunhas arquivadas da 02A.** Das 10, cinco passam por um passo que a
  produção de hoje não dá. Dois (8801012 passo 18, 8801108 passo 25) são desta
  classe: o solver antigo os aceitava, o corrigido os rejeita, como a produção.
  Três (8801204 passo 7, 8801207 passo 3, 8801212 passo 2) já eram inválidos na
  base, para os dois solvers e para a produção — é o que já fazia
  `adversarial-resource-analysis.mjs` falhar na base. Lacuna anterior e alheia
  (§4).

### 3.5 Verificações finais

| | resultado |
| - | - |
| `npm run lint` | 0 erros (os 5 avisos da base, nenhum nos arquivos desta missão) |
| `tsc --noEmit` | limpo |
| `next build` | ok; os 263 arquivos estáticos do cliente idênticos byte a byte aos da base (13 194 899 bytes de chunks, fora os manifestos do build id) — Home e Rota sem mudança de bundle |
| `git diff --check` | limpo |
| `git diff f5826b2 -- src/` | vazio (0 linhas) |
| CORE (`validation-hygiene-tests.mjs`) | 15/15, `CORE_BATTERY_PASSED`, imutabilidade provada (0 arquivos criados/alterados/retocados, `git status` idêntico), evidência bate |
| DEEP (`final-acceptance.mjs`) | 1080 estruturais, 270 contínuos, recuperação: ok; as 5 evidências batem |
| suíte de fidelidade / contrafactual / mutantes | 13/13 · fidelity 4/4 falham e preserved 9/9 valem na base · 12/12 |
| censo de fidelidade (`--check` no código final) | 11/11 checks, `ROTA2_SENTINEL_FIDELITY_CENSUS_OK`, evidência bate |
| Dynamic Traps: suíte / censo | 28/28, evidência bate / 16/16, registro atualizado (§3.4) |
| Dependent Objectives: suíte / censo / mutantes | 30/30, evidência bate / 22/22, registro atualizado (§3.4) / 16/16 pegos (M14, o solver com a regra antiga, por O25/O26) |
| Platform Lock | 21/21; `--counterfactuals` valem |
| coupling gate | 6/6 (sem entrada nova na lista de permissões) |
| C1–C7C, jornada, continuação, carregador do tabuleiro | ver `regression.md`; as 5 falhas pré-existentes idênticas na base |

## 4. Outras lacunas do modelo (não desta classe)

Divergências solver × produção encontradas fora da classe corrigida: **nenhuma**
— nem nos 64 328 turnos reais, nem nos 242 251 pares de produção, nem nos
234 562 pares estáticos, nem nas 107 297 da suíte (todas as divergências da base
são BLOCKED_KEPT; o corrigido tem zero em todas as classes testadas: NO_TRAP,
OTHER_TRAP, OPEN_RELEASED, BLOCKED_RELEASED, BLOCKED_KEPT, sem decisão).

Lacunas que existem e **não** são desta missão:

1. **Testemunhas arquivadas desatualizadas.** 8801204 (passo 7), 8801207
   (passo 3) e 8801212 (passo 2) da 02A não são transições da produção atual;
   já inválidas na base exata. Os registros da 02A/ADVERSARIAL-03 descrevem a
   produção da época. Não tocados.
2. **Modelo PRE_CHEST.** Baú, Picareta e Segunda Chance continuam fora dos dois
   solvers (como antes). A Segunda Chance do hook foi verificada igual nas duas
   árvores (S11), não modelada.
3. **O suporte do Caçador é o modelo de referência** (`dynamic-solver.mjs`), não a
   distribuição de produção; ele bate com o hook em todo turno observado (S00,
   S10) e com o pré-missão em todo par isolado. Não mudou.

Possível bug de produto em `route-defenders.ts`: **nenhum** encontrado. O
comportamento "a porta armada continua alcançável a partir dos seus vizinhos"
é o que o código faz e foi modelado como está; se ele é o desejado é uma
pergunta de design, não desta missão (ver §6).

## 5. Limitações

- O helper responde a distância da produção para **qualquer** `from`, mas as
  outras duas leituras de `sentinelMove` (distância ao portal da Sentinela e de
  cada candidato) continuam vindo da tabela, que pressupõe uma origem
  caminhável. Em estado alcançável isso sempre vale: a Sentinela nunca pisa numa
  armadilha armada nem numa parede, e um Explorador que arma a armadilha sob a
  Sentinela é capturado no passo. Num estado inalcançável com a Sentinela numa
  célula bloqueada, `findPathLength` da produção expandiria a partir dela e a
  tabela diz 0. Não modelado (fora do espaço de estados).
- O censo explora a profundidade 2 em volta dos turnos relevantes e uma grade
  limitada por porta (4 máscaras, 8 posições, 5 chegadas); a suíte usa a grade
  maior (8 máscaras, toda a coleira, 10 chegadas) em 40 mapas e o helper é
  exaustivo neles. Não é uma enumeração de todo estado de 1080 mapas.
- As classes exatas são de uma amostra de 72 mapas (a mesma das censuses
  anteriores); 6 seguem INCONCLUSIVE pelo limite de recursos.
- Os registros legados que se reescrevem a cada execução continuam com a deriva
  que já tinham na base; esta missão não os reconcilia.

## 6. Recomendação para a missão do Caçador Adaptativo

- **Partir desta base.** O modelo de referência agora representa a Sentinela
  real; um Caçador adaptativo avaliado contra o modelo antigo teria sido medido
  contra uma Sentinela que abandonava portas que o jogo mantém (409 turnos com
  a Sentinela em outra célula só nesta censo).
- **Manter a regra desta missão:** toda política nova do Caçador entra no
  solver por uma função compartilhada pelos dois solvers (como
  `sentinel-target-distance.mjs`), e é segurada contra a produção pelo oráculo
  composto (`oracleSuccessors`) e pelo hook real — não contra outra cópia do
  modelo. A suíte e o censo desta missão devem continuar verdes sem mudança: o
  Caçador é sorteado ANTES da Sentinela e a Sentinela não pode mudar.
- **O suporte do Caçador é onde a adaptação vai morar.** Hoje ele é um conjunto
  de destinos com probabilidade > 0 (S10). Uma política adaptativa precisa
  dizer, no modelo, de que estado ela depende (memória, contagem de turnos…):
  se depender de algo fora da chave empacotada, o estado do solver cresce e o
  `packFields` precisa mudar nos dois solvers juntos.
- **Pergunta de design para antes:** a Sentinela mantém e persegue uma porta que
  virou armadilha armada (não pode pisar nela, mas fica ao lado). É o
  comportamento atual e agora está modelado; se o Caçador Adaptativo for
  calibrado contra ele, mudar isso depois desfaz a calibragem.
