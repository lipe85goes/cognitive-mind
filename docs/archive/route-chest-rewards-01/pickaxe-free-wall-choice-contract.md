# Picareta — escolha livre de parede

Este documento existe porque o contrato mudou **depois** de a missão já ter
chegado a `READY_FOR_MANUAL_PLAYTEST`. A cronologia é registrada como aconteceu.

---

## 1. As três versões, em ordem

### CONTRATO ORIGINAL — paredes quebráveis certificadas

O gerador escolhia 2 ou 3 paredes por mapa, sob uma regra de significância
topológica, e a Picareta só podia abrir uma delas. As paredes marcadas tinham
rachaduras visíveis para que o jogador as reconhecesse.

A pergunta que o jogo fazia era:

> *"Encontre uma das paredes que o sistema marcou como estratégica."*

Isso foi implementado, testado e entregue. A FASE 1 mediu 324 mapas para provar
que a mecânica era viável antes de existir.

### REVISÃO DE DESENHO — playtest manual

Ao jogar, ficou claro que marcar as paredes **respondia a pergunta que a Picareta
deveria fazer**. O jogador não escolhia onde abrir; procurava a rachadura.

### CONTRATO ATUAL — qualquer parede interna

> *"Observe o tabuleiro inteiro. Você pode abrir uma parede. Escolha bem."*

Uma Picareta, um uso, e **qualquer parede interna real** do labirinto ao lado do
Explorer. A dificuldade passou a ser a decisão.

---

## 2. Congelado

```
PICKAXE_USES                    = 1
PICKAXE_TARGET                  = ANY_INTERNAL_MAZE_WALL
PLAYER_SELECTS_WALL             = true
NO_GENERATOR_PRESELECTION       = true
NO_VISUAL_CORRECT_WALL_HINT     = true
BROKEN_WALL_WALKABLE_BY_ALL     = true
BREAK_WALL_CONSUMES_TURN        = true
BAD_STRATEGIC_WALL_CHOICE_ALLOWED = true
```

---

## 3. A regra de desenho central

> Difícil porque **"eu escolhi mal"** é aceitável.
> Difícil porque **"o jogo escondia qual parede era permitida"** não é.

`NO_HIDDEN_CORRECT_WALL`.

Nenhuma parede interna é secretamente a certa. A mecânica oferece liberdade; a
consequência vem da decisão.

---

## 4. O que "qualquer parede" significa no código

O modelo lógico do labirinto é uma grade 9×9 em que uma célula é parede ou é
andável. O **frame** do tabuleiro — a moldura de madeira e bronze do GLB, a
borda física, a decoração — não pertence à grade: fica fora dela, em geometria
que o jogo nunca consulta para andabilidade.

Logo, o conjunto "paredes internas reais do labirinto" **é** exatamente
`mazeMap.walls`. E portal, baú, armadilha, luz, Explorer, Caçador e Sentinela
vivem obrigatoriamente em células **andáveis**, então nenhum deles pode estar
nesse conjunto.

Isso torna o guard de permissão uma única linha:

```ts
if (!walls.has(wallKey)) return;
```

As exclusões de §4 não precisam de código porque são impossíveis por construção —
mas os testes E, F e G as afirmam explicitamente em vez de confiar no argumento.

---

## 5. Guards — todos físicos, nenhum estratégico

`breakWall(wall)` age somente quando **todas** valem:

| Guarda | Por quê |
|---|---|
| `status === "playing"` | |
| `!rewardChoicePending` | nada acontece com o Baú aberto |
| `pickaxeAvailable` | escolheu Picareta e ainda não gastou |
| dentro de `0..8 × 0..8` | não existe parede fora da grade |
| `walls.has(wallKey)` | é parede real, ainda de pé |
| `manhattanDistance(wall, player) === 1` | sem quebra remota |

E **nada mais**. Não existe:

```
rewardEligibility(wall)     ← deliberadamente não implementado
```

Não há checagem de shortest path, de portal, de utilidade, de benefício ao
Caçador, nem consulta ao certificador aposentado. Quebrar uma parede que não
ajuda em nada — ou que ajuda o Caçador — é uma jogada legal.

Provado em `pickaxe-controlled-tests.json`:
**BAD_CHOICE** (o runtime abriu a pior das duas opções adjacentes, sem recusar) e
**DEFENDER_BENEFIT** (aberturas que encurtam o caminho do Caçador são permitidas).

---

## 6. O certificador não foi apagado — foi aposentado

```
BREAKABLE_WALL_FEASIBILITY_GATE     = SUPERSEDED_AS_RUNTIME_RESTRICTION
BREAKABLE_WALL_FEASIBILITY_EVIDENCE = PRESERVED
CERTIFIED_WALL_RUNTIME_RESTRICTION  = false
CERTIFIED_WALL_ANALYSIS_PRESERVED   = true
```

A separação pedida em §5 é física, não uma convenção:

| | Antes | Agora |
|---|---|---|
| Onde a regra vive | `src/games/escape-maze/useEscapeMaze.ts` | `tools/validation/breakable-wall-certifier.mjs` |
| Quem a consulta | o runtime, a cada quebra | ninguém em `src/` |
| O que ela decide | quais paredes podem ser abertas | nada |
| Para que serve | permissão | evidência histórica |

**Fidelidade da mudança, verificada:** ao ser movida, a campanha foi re-executada
e comparada com os números publicados originalmente — 324 mapas, 0 sem candidata,
min 2 / média 11,448 / max 21, e as três contagens de recusa idênticas
(`NO_TOPOLOGICAL_EFFECT` 2.059, `WOULD_ADD_DEAD_END` 755, `WOULD_ADD_ISLAND` 57).
`reproducedExactly = true` fica gravado em `breakable-wall-feasibility.json`.

Por que preservar: a campanha respondeu *"abrir uma parede muda alguma coisa
nestes tabuleiros, ou a Picareta seria decoração?"*. A resposta foi sim, e é o
motivo pelo qual a mecânica foi construída. Continua verdadeira.

---

## 7. Estado de runtime

`breakableWalls` saiu de `MazeMap`. Era metadata cuja única função era restringir
a Picareta (§20), e sem essa função virava redundância.

O que resta é o mínimo:

```
walls        (estático, do mapa)
brokenWall   (string | null — a única parede aberta nesta partida)
```

Com **um** uso, "no máximo uma parede aberta" é estrutural, não vigiado.

Também saiu o gate `pickaxeHasATarget` de `isValidMap`: ele exigia ≥ 1 parede
certificada por mapa. Todo mapa certificado tem entre 13 e 28 paredes por
construção, então não há nada a verificar.

---

## 8. UX da escolha (§15–§18)

### Alvo válido ≠ alvo bom

| Tipo de informação | Exemplo | O jogo mostra? |
|---|---|---|
| **VALID TARGET** — controle | *"a Picareta alcança esta parede"* | **sim** |
| **GOOD TARGET** — estratégia | *"esta parede é a melhor"* | **nunca** |

### Como aparece

* Um botão por parede adjacente, **nomeado pela direção**
  (`Quebrar parede · acima`). Duas paredes adjacentes são duas escolhas
  distinguíveis; nada depende de ordem de array.
* No tabuleiro, um anel de bronze na base de cada parede alcançável — a cor da
  própria Picareta, não o vermelho da armadilha, nem o teal do Sentinela, nem o
  verde do anel de movimento.
* Apontar (mouse, toque ou foco de teclado) para um botão acende **aquela** parede
  com um anel mais forte e um segundo anel mais alto, para que a que vai abrir
  seja inconfundível.
* Tudo isso nasce com a Picareta e some quando ela é gasta. Nenhuma parede carrega
  marca própria.

Os anéis vivem no **board dinâmico**, não no estático: eles mudam a cada passo do
Explorer, e a assinatura do board estático não os inclui.

### Teclado (§17)

`Enter` abre a parede **somente quando existe exatamente uma** ao alcance — porque
só então não há o que escolher. Com duas ou mais, `Enter` não faz nada e a escolha
pertence aos botões, que são focáveis por `Tab`. O jogo nunca adivinha qual o
jogador quis dizer.

### Mobile (§18)

Os mesmos botões, na mesma linguagem dos controles da Rota. Sem painel novo.

### Nunca por acidente (§10)

Andar contra uma parede — qualquer parede — é um movimento bloqueado normal:
conta em `blockedMoves`, treme, toca o tom de erro, **não** gasta a Picareta e
**não** consome turno. A mensagem aponta a ação sem recomendá-la:

> *"Parede no caminho. A Picareta pode abri-la."*

---

## 9. O que não mudou

Preservado integralmente, e re-testado:

* **Baú** — abre, pausa o turno, oferece exatamente duas recompensas, escolhe uma;
* **Segunda Chance** — resolução, carga única, segunda captura derrota;
* **turno da quebra** — custa um turno, o Explorer não se move, a parede abre
  antes da resposta dos defensores;
* **topologia real** — a abertura serve a Explorer, Caçador e Sentinela;
* **reset** — restart devolve tudo; a definição do mapa nunca é escrita;
* **armadilhas, Sentinela c3, Caçador, portal e luzes**.

---

## 10. Preparação para o Solver 02 (§21, §22)

O espaço de ações do Explorer cresceu, e de propósito:

```
BREAK_WALL(w)  para cada parede adjacente ainda de pé
```

com no máximo quatro por célula, e **uma só** ao longo da rota inteira.

Modelável sem UI:

```
rewardSelected  : none | pickaxe | second-chance
rewardSpent     : bool
brokenWall      : identidade da célula, ou nenhuma
walls           : estático do mapa
```

O Solver 02 poderá descobrir que a parede A leva a uma região não vencível, a B a
*possible but not guaranteed*, e a C a uma solução garantida. **Isso é exatamente
o comportamento desejado**, e esta missão não tenta responder qual é qual.

`dynamic-solver.mjs` não foi alterado.
