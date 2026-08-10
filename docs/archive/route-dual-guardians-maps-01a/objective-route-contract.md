# Contrato da rota objetiva

O que `computeObjectiveRoute` faz, o que ele não sabia, e o que mudou.

## Entrada

```
computeObjectiveRoute(playerStart, stars, exitPosition, walls, admissible?)
```

Nós: `[início, ...luzes, portal]`. A rota parte do Explorador, visita **todas**
as luzes em alguma ordem e termina no portal.

## Custo

Matriz completa de distâncias BFS entre todos os pares de nós, sobre as paredes
reais. Distância inalcançável é `+Infinity`.

## Ordenação das luzes

Busca exaustiva sobre as permutações das luzes (`walk`), com poda por
`total >= bestTotal`. Minimiza a soma dos trechos:

```
custo = d(início, l₁) + d(l₁, l₂) + … + d(lₙ, portal)
```

Com 6 luzes são 720 ordenações; a poda corta a maioria.

## Desempate

`if (full < bestTotal)` — comparação **estrita**. A primeira ordenação
encontrada com o custo mínimo vence, e a ordem de exploração é a ordem dos
índices em `remaining`. Determinístico: mesma entrada, mesma rota. Nenhum
`Math.random()` participa.

## Concatenação dos trechos

Para cada par consecutivo, `findPathCells` devolve **um** caminho mínimo — o que
o BFS encontrar primeiro. Os trechos são concatenados descartando a célula
repetida na junção. Quando existem vários caminhos mínimos entre duas luzes, a
escolha entre eles é do BFS, não do custo.

## O que ele não sabia

**Nada sobre admissibilidade.** `routeCellsHaveEscape` exige grau ≥2 em toda
célula da rota, grau ≥3 dentro da região de convergência do portal, e partilha
de bloco biconexo nas células do meio. A rota mais barata desconhece
integralmente essas três regras.

### A resposta à pergunta da missão

*Por que em 38 casos ele escolhe uma rota reprovada quando existe outra válida?*

Porque ele otimiza a coisa errada e não tem como saber. Perto do portal, a rota
mais curta encosta na borda do tabuleiro, e ali as células têm grau 2 — é
exatamente onde o contrato de largura de fuga exige 3. O caminho mais barato e o
caminho admissível divergem, e nada no algoritmo preferia o segundo.

Medido nas 255 rejeições de largura das quatro seeds:

| dimensão | casos | reparável sem mudar nada além da rota |
|---|---|---|
| ordenação/traçado da rota | 38 | **sim** |
| conjunto de luzes | 25 | não — exigiria outras luzes |
| portal inalcançável | 192 | não — rejeição legítima |

## O que mudou

`resolveObjectiveRoute` decide qual rota os gates vão julgar:

1. calcula a rota mais barata, exatamente como antes;
2. se ela satisfaz `routeCellsHaveEscape`, **devolve essa mesma rota** — byte
   por byte a de antes, então nenhum mapa que já passava muda;
3. só se ela reprova, repete a mesma busca confinada às células admissíveis:
   mesma matriz de custo, mesma busca por permutações, mesmo desempate, ainda a
   rota mais curta — agora escolhida entre as que o contrato permite;
4. se nem assim existe rota admissível, devolve a original e o gate rejeita,
   como sempre fez.

A restrição é expressa tratando toda célula inadmissível como parede **apenas
para o pathfinding**. Graus, blocos e os gates continuam medindo as paredes
reais.

Nenhum limiar mudou. Nada foi relaxado. A eficiência da rota é preservada: o
critério continua sendo custo mínimo, apenas dentro do conjunto legal.

## Custo pago

Nos 38 casos reparados, comparando a rota antiga (reprovada) com a nova
(aprovada), com paredes, luzes e portal idênticos:

| delta de custo | valor |
|---|---|
| mínimo | 0 movimentos |
| médio | +4,84 movimentos |
| máximo | +20 movimentos |

Delta zero significa que existia uma rota igualmente curta e admissível — o
algoritmo antigo simplesmente não tinha motivo para preferi-la.

`AVOIDABLE_ROUTE_SELECTION_FAILURES = 0 / 38`. Dados em
[`objective-route-63-before-after.json`](objective-route-63-before-after.json).
