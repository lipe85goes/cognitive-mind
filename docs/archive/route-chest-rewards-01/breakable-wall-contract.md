# Contrato da parede quebrável — **SUPERSEDIDO COMO RESTRIÇÃO DE RUNTIME**

> ## ⚠ Leia isto antes do resto
>
> Este documento descreve o contrato **original**, em que o gerador certificava um
> pequeno conjunto de paredes e a Picareta só podia abrir uma delas.
>
> **Depois do playtest manual, o produto mudou.** A Picareta passa a abrir
> **qualquer parede interna** do labirinto ao lado do Explorer, e escolher qual
> virou a dificuldade da mecânica.
>
> ```
> BREAKABLE_WALL_FEASIBILITY_GATE     = SUPERSEDED_AS_RUNTIME_RESTRICTION
> BREAKABLE_WALL_FEASIBILITY_EVIDENCE = PRESERVED
> CERTIFIED_WALL_RUNTIME_RESTRICTION  = false
> ```
>
> **Contrato vigente:** [`pickaxe-free-wall-choice-contract.md`](pickaxe-free-wall-choice-contract.md).
>
> O texto abaixo fica **como estava**, porque descreve com precisão a medição que
> justificou construir a mecânica — 324 mapas, e a prova de que abrir uma parede
> muda estes tabuleiros. Essa medição continua válida; o que deixou de valer é o
> uso dela como permissão de runtime.
>
> A regra saiu de `src/games/escape-maze/useEscapeMaze.ts` e agora vive em
> `tools/validation/breakable-wall-certifier.mjs`, onde nada do jogo a consulta.
> A mudança foi verificada re-executando a campanha e comparando com os números
> publicados: idênticos (`reproducedExactly = true`).

---

`BREAKABLE_WALL` é uma propriedade **do tabuleiro**, decidida por medição, nunca
por seed, template, dificuldade ou exceção.

Fonte única da regra:
`src/games/escape-maze/useEscapeMaze.ts` → `certifyBreakableWall` /
`auditBreakableWalls` / `chooseBreakableWalls`.
A prova offline (`tools/validation/breakable-wall-feasibility.mjs`) **dirige essas
mesmas funções** através do sandbox instrumentado — não existe segunda cópia da regra.

---

## 1. Dois estados, não um

| Estado | Significado | Pathfinding |
|---|---|---|
| `BREAKABLE` | a parede **existe** e foi marcada como quebrável | continua sendo parede para todos |
| `BROKEN` | a parede **foi removida** nesta partida | célula andável para todos |

Marcar não abre. Só a Picareta abre, e só uma vez.

---

## 2. Elegibilidade — o que é afirmado

Uma candidata precisa ser uma célula de parede do mapa atual. Como luz, trap, baú,
spawn e portal vivem obrigatoriamente em células **andáveis**, essas exclusões são
*asserções*, não uma busca. `certifyBreakableWall` as verifica e recusa com um código
explícito se alguma disparar — um mapa que viole isso é um bug, não um caso a tratar.

| Recusa | Condição |
|---|---|
| `OUT_OF_BOARD` | fora de `0..8 × 0..8` |
| `NOT_A_WALL` | a célula não é parede |
| `IS_PORTAL` | é o portal |
| `IS_SPAWN` | é o spawn do Explorer ou do Caçador |
| `IS_START_ZONE` | está em `START_SAFE_CELLS` |
| `IS_LIGHT` / `IS_TRAP` / `IS_CHEST` | é luz / armadilha / baú |

Coordenada inválida é impossível por construção: abrir uma parede existente devolve
uma célula que já estava dentro do tabuleiro. Render também é seguro:
`renderStaticTiles` desenha as 81 células sempre, e `getStaticBoardSignature`
já inclui a lista de paredes — abrir uma reconstrói o board estático sozinho.

---

## 3. Elegibilidade — o que é medido

### 3.1 Grau mínimo

`BREAKABLE_MIN_DEGREE = 2` — a abertura precisa unir pelo menos **duas** células
andáveis.

| Grau | O que a abertura cria | Veredito |
|---|---|---|
| 0 | uma ilha inalcançável | `WOULD_ADD_ISLAND` |
| 1 | um beco sem saída novo | `WOULD_ADD_DEAD_END` |
| ≥ 2 | pelo menos um ciclo novo (`degree - 1`) | segue para o teste de significância |

Grau 1 é recusado por dois motivos ao mesmo tempo: não muda nada topologicamente
(`μ' = μ`) e cria exatamente o lugar onde um pincer vira xeque-mate — o oposto do
que a Picareta promete.

### 3.2 Campo conectado

Depois de abrir, o tabuleiro precisa continuar sendo **um único campo conectado**
com o portal alcançável (`WOULD_SPLIT_BOARD`, `PORTAL_UNREACHABLE`). Abrir só pode
unir, então isto nunca deveria disparar — está no código para que uma quebra de
invariante apareça, em vez de ser assumida.

### 3.3 Teste de significância

Medido **antes e depois**, sobre o mesmo tabuleiro:

| Medida | Como | Certifica? |
|---|---|---|
| `objectiveMovesSaved` | custo da rota objetivo completa (todas as luzes na ordem ótima, depois o portal) — `computeObjectiveRoute` | **sim**, se ≥ 1 |
| `portalAccessesGained` | portas da região do portal — `computePortalDefenceZone().accesses` | **sim**, se ≥ 1 |
| `escapeCellsGained` | células da rota objetivo que passam de `< 3` para `≥ 3` saídas | **sim**, se ≥ 1 |
| `alternativeRouteCellsGained` | células **já existentes** que passam a compartilhar bloco biconexo com o start | **sim**, se ≥ 1 |
| `cyclesGained` | `degree - 1`, exato em campo conectado | não — é consequência |
| `portalZoneCellsGained` | tamanho do território do Sentinela | não — registrado (relação com o Sentinela) |
| `hunterMovesSaved` | `d(caçador, explorer)` antes − depois | **nunca** — é o *trade-off*, registrado |

```
BREAKABLE_WALL_HAS_TOPOLOGICAL_EFFECT =
    objectiveMovesSaved     >= 1     // atalho
 || portalAccessesGained    >= 1     // acesso alternativo relevante
 || escapeCellsGained       >= 1     // fuga
 || alternativeRouteCellsGained >= 1 // rota alternativa
```

Nenhuma delas → `NO_TOPOLOGICAL_EFFECT`. A parede fica sendo parede.

`alternativeRouteCellsGained` conta apenas células que **já eram andáveis** dos dois
lados da medição, então a célula recém-aberta nunca certifica a si própria.

O ganho do Caçador é medido e guardado porque §15 quer o trade-off explícito: a
Picareta abre uma fuga para o Explorer e, na mesma jogada, um caminho para os
defensores. Ele nunca é razão para certificar — só para o jogador pensar duas vezes.

---

## 4. Preferência e quantidade

Certificação é o piso; a ordenação é a preferência (§6 — *"preferir paredes cuja
remoção…"*):

```
score = objectiveMovesSaved * 12
      + portalAccessesGained * 10
      + escapeCellsGained * 8
      + alternativeRouteCellsGained * 2
      + cyclesGained * 3
```

Empate → menor linha, depois menor coluna. Determinístico, sem `Math.random()`.

| Etapa | Marcas | Motivo |
|---|---|---|
| Rota 1 | 2 | tabuleiro mais aberto, a pergunta já é clara com duas |
| Rota 2 | 2 | |
| Rota 3 | 3 | mais paredes e corredores mais longos suportam uma pergunta a mais |

`BREAKABLE_WALL_MAX = 3` é o teto absoluto.
`BREAKABLE_MIN_SEPARATION = 2` (Manhattan) é **preferência**: a primeira passada
respeita o espaçamento, a segunda completa a contagem a partir da *mesma lista
certificada*. O critério do que pode ser marcado nunca é afrouxado — só o espaçamento.

A Picareta tem **um uso**. Marcar 2 ou 3 não dá 2 ou 3 quebras: dá a segunda decisão
— *qual* parede vale a pena abrir.

---

## 5. Determinismo

`chooseBreakableWalls` não chama `Math.random()` em nenhum ponto. A varredura é em
ordem de tabuleiro (`row`, depois `col`), a ordenação tem desempate total e a
seleção é uma função pura do mapa. Como o mapa é determinístico dada a seed, as
marcas são determinísticas dada a seed — sem que a seleção precise saber o que é
uma seed.

Verificado na campanha: `chooseBreakableWalls` chamado duas vezes sobre o mesmo mapa
em 324 mapas → **0 divergências**, e todas as marcas ⊂ conjunto certificado.

---

## 6. Resultado da FASE 1

`docs/archive/route-chest-rewards-01/breakable-wall-feasibility.json`

| | |
|---|---|
| Templates × modos | 9 × 3 |
| Seeds por combinação | 12 |
| Mapas medidos | **324** |
| Falhas de geração | 0 |
| Mapas com **zero** paredes certificadas | **0** |
| Certificadas por mapa | min **2** · média **11,4** · max **21** |
| Templates que atingem o alvo 2 sempre | **9 / 9** |
| Violações de determinismo | 0 |
| Recusas | `NO_TOPOLOGICAL_EFFECT` 2.059 · `WOULD_ADD_DEAD_END` 755 · `WOULD_ADD_ISLAND` 57 |

`BREAKABLE_WALL_FEASIBILITY_PASSED`.
Nenhum template ficou abaixo do mínimo de 1, então **não houve bloqueio** e a
Picareta pôde ser implementada. Nenhuma parede foi desenhada à mão, nenhum template
foi editado, nenhuma seed recebeu tratamento.

---

## 7. O que a parede quebrada NÃO faz

- não coleta luz (§40);
- não conta como luz nem reduz o requisito do portal;
- não abre o portal bloqueado nem contorna a prontidão — a entrada no portal
  continua exigindo `portalActive`, verificado no movimento, não na topologia (§39);
- não vira "buraco exclusivo do jogador": vira célula andável para Explorer,
  Caçador e Sentinela (§15);
- não altera o template nem a definição do mapa — a quebra é estado de partida (§19).
