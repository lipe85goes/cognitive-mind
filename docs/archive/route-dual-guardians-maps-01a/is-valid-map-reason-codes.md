# Reason codes de `isValidMap`

Observabilidade do gate final. Nenhum gate foi alterado nesta missão.

`isValidMap` terminava numa única expressão booleana de 23 conjunções, então um
candidato reprovado dizia apenas "não". O harness
`tools/validation/final-rejection-autopsy.mjs` reescreve essa expressão **em
memória** numa lista de verificações nomeadas e publica todas as que falharam.

Efeito colateral proposital: o curto-circuito é abandonado, então um candidato
reporta **todos** os gates que reprovou, não só o primeiro. As expressões são
puras — avaliá-las todas não muda veredito nenhum. Provado pelos números: o
histograma estrutural e a contagem de certificados são idênticos aos da
execução não instrumentada (265 tentativas, 4 mapas, 2 rejeitados no final).

Os nomes são extraídos do próprio código-fonte, não digitados à mão. Se um
gate for adicionado, removido ou renomeado, a tabela abaixo muda sozinha na
próxima execução.

## Códigos

| # | gate | o que protege |
|---|---|---|
| — | `objectiveRouteExists` | retorno antecipado: não há rota objetiva |
| 0 | `alternativeRoute` | portal alcançável por duas rotas independentes |
| 1 | `lightsHaveAlternatives` | **gate 13** — toda luz partilha bloco biconexo com o Explorador |
| 2 | `routeHasEscape` | largura de fuga na rota objetiva |
| 3 | `strategicIdentity` | o mapa oferece alguma decisão |
| 4 | `flow.decisionRatio >= brief.minDecisionRatio` | densidade de escolhas |
| 5 | `flow.longestForcedStreak <= brief.maxForcedStreak` | corredores forçados |
| 6 | `idleDeadEnds <= brief.maxIdleDeadEnds` | becos sem nada dentro |
| 7 | `pathLength !== null` | portal alcançável |
| 8 | `pathLength >= getMinimumPathLength(routeStage)` | rota não trivial |
| 9 | `guardianDistance >= profile.guardianMinStartDistance` | guardião não nasce em cima |
| 10 | `firstChoices >= 2` | primeira jogada não é forçada |
| 11 | `wallCount >= limits.min` | densidade mínima |
| 12 | `wallCount <= limits.max` | densidade máxima |
| 13 | `distances.size >= profile.minReachableCells` | tabuleiro não estrangulado |
| 14 | `junctions >= profile.minJunctions` | bifurcações suficientes |
| 15 | `countStartZoneWalls(...) <= profile.maxStartZoneWalls` | zona inicial limpa |
| 16 | `map.collectibleStars.length === expectedLights` | contagem de luzes |
| 17 | `starsReachable` | toda luz alcançável e com saída ao portal |
| 18 | `starsSeparated` | separação mínima entre luzes |
| 19 | `map.traps.length === expectedTraps` | contagem de armadilhas |
| 20 | `trapsValid` | **segurança de armadilha**: distância do início e ≥2 de qualquer luz |
| 21 | `shieldUseful` | **colocação de recompensa**: escudo longe o bastante do início |
| 22 | `getNeighbors(map.guardianStart, ...).length >= 2` | **validade final do guardião** |

## Cobertura pedida pela missão

| pedido | onde está |
|---|---|
| trap safety | gate 20 |
| idle deadends | gate 6 |
| guardian final validity | gates 9 e 22 |
| portal final validity | gates 0, 7, 8 |
| strategic/tradeoff final gate | gates 3, 4, 5 |
| chest/reward placement | gate 21 (escudo). O baú ainda não existe em runtime — o contrato foi arquitetado em 01A mas não implementado, então não há gate para ele |
| trap usefulness | **não é gate de validação.** Resolvido na geração, em `chooseTrapsAndShield` (`scoreTrapForFuture`) |
| unsafe trap combination | **não é gate de validação.** Resolvido na geração, em `combinationIsSafe` |

Os dois últimos são deliberados: a decisão de 01A foi resolver combinações de
armadilhas na construção e não como regra invisível em runtime. Registro isso
aqui porque a missão pediu cobertura diagnóstica para eles, e a resposta
honesta é que não existe gate final a instrumentar — a garantia está a montante.

## O que os códigos mostraram nas quatro seeds

265 tentativas, 6 passam estrutural, 4 viram mapa. Os **dois** que passam
estrutural e morrem no final reprovam exatamente **um** gate cada, e é o mesmo:

```
gate 6 — idleDeadEnds <= brief.maxIdleDeadEnds
```

Detalhes completos em [`post-structural-two-rejections.json`](post-structural-two-rejections.json).
