# Contrato de `chooseStars`

Quais luzes a Rota Estratégica pode colocar num mapa, e o que a função promete
quando não consegue colocá-las. Vale para as nove combinações
dificuldade × etapa; os números citados são de `route3-hard`, a mais apertada.

`chooseStars(walls, playerStart, guardianStart, exitPosition, difficulty, routeStage, blocks)`

## 1. Regras de candidatura

Uma célula só entra em `candidates` se passar em **todas**:

| regra | fonte | route3-hard |
|---|---|---|
| não é parede | `walls` | — |
| não é célula protegida | início, guardião, portal e `START_SAFE_CELLS` | 6 células |
| é alcançável a partir do Explorador | `getReachableDistances` | — |
| tem caminho até o portal | `findPathLength` | — |
| distância do início ≥ `starMinStartDistance` | `ROUTE_STAGE_QUALITY` | 4 |
| distância do portal ≥ `starMinExitDistance` | `ROUTE_STAGE_QUALITY` | 2 |
| **partilha bloco biconexo com o Explorador** | `sharesBlock(blocks, …)` | — |

A última regra é a correção do ROTA-01A. Ela existia só no validador
(gate 13); agora existe também na candidatura. É o mecanismo causal
que levou 2.330 candidatos rejeitados a 2.330 aceitos.

Significado prático: uma luz atrás de um ponto de articulação — alcançável
por um único corredor — nunca é candidata. O Explorador sempre tem duas
rotas independentes até cada luz, então nenhum guardião pode trancá-lo
numa luz obrigatória.

## 2. Score

Preferência, não regra. Nunca decide validade.

```
etapa 1: 36 − |distânciaInício − 5| × 5 + grau × 3
etapa 2: distânciaInício × 1,4 + distânciaPortal + grau × 4
etapa 3: distânciaInício × 1,8 + distânciaPortal × 1,2 + grau × 3
todas:   + distânciaManhattanAoGuardião × 0,4 + Math.random() × 0,25
```

O jitter de 0,25 desempata sem inverter diferenças reais.
Ele vem de `Math.random()`, então a seleção é determinística
para um mesmo estado de RNG — provado pelo teste E.

## 3. Separação

Todo par de luzes escolhidas respeita
`manhattanDistance(a, b) ≥ starMinSeparation`
(3 na etapa 3, 2 nas etapas 1 e 2).

Esta regra **acopla** as escolhas: elegibilidade célula a célula não
garante que exista um conjunto completo. É por isso que a seleção é uma
busca sobre conjuntos, não uma varredura sobre células.

## 4. Quantidade

`getStarCount(difficulty, routeStage)` — 3/4/5 por dificuldade, +1 na etapa 3.
`route3-hard` = 6.

A quantidade **nunca** é reduzida silenciosamente.

## 5. Contrato de falha

Quando não existe conjunto completo que satisfaça (1) + (3) + (4),
`chooseStars` devolve **menos** luzes do que o exigido.

Não inventa posição. Não repete posição. Não viola separação.
Não usa célula inelegível. Não reduz o alvo.

`isStructurallyValid` rejeita o candidato pela contagem, e o gerador
tenta outro layout. Se nem a fase aleatória nem a varredura de recuperação
produzirem um mapa certificado, `generateMaze` **lança** — o produto nunca
aceita silenciosamente um mapa que não passou.

### Defeito corrigido nesta missão

Até o teste controlado B, a cauda da função fazia o oposto do contrato
acima: depois do greedy curto, um segundo laço completava a lista até
`targetCount` **ignorando a separação**. O teste flagrou seis luzes com
oito violações de separação num mesmo mapa.

Nada a jusante reexaminava separação — o gate 13 só verifica alcance —
então esses mapas eram certificados com luzes coladas. O laço foi
removido. A devolução curta agora é literal.

## 6. Defesa final

O gate 13 continua em `isStructurallyValid` e continua independente de
`chooseStars`. O teste F prova isso por diferencial: no mesmo layout aceito,
trocar uma única luz por uma célula sem `sharesBlock` faz o validador
rejeitar.

A candidatura torna o gate uma formalidade, não uma redundância removível.
