# Estúdio das Descobertas · Estúdio do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v4`, plate `9062078bc5b5…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 26 objetos · tiers A6 B8 C12 · Janela 8, Mesa 10, Estante 8.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 26 | 884 | 884 | 1.5 | 2.8 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 26 | 3160 | 3160 | -0.39 | 1.56 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 18 | 8005 | 8005 | 0.53 | 2.05 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 12.9% | 12.8% | -2.8 | 2.5% | — |
| binoculo | B | janela | 31.4% | 31.4% | -1.57 | 6.3% | — |
| chave | C | janela | 19.0% | 19.0% | -0.25 | 3.8% | — |
| guarda-chuva | A | janela | 13.0% | 13.0% | -0.71 | 2.6% | — |
| gaiola | C | janela | 31.3% | 31.4% | 1.3 | 6.3% | — |
| caracol | C | janela | 16.6% | 16.6% | -1.3 | 3.3% | — |
| piao | C | janela | 28.4% | 28.5% | 1.45 | 5.7% | — |
| lupa | A | mesa | 11.7% | 11.6% | -0.99 | 2.3% | — |
| bussola | B | mesa | 26.4% | 26.4% | 0.31 | 5.3% | — |
| relogio | C | mesa | 10.1% | 10.1% | 0.16 | 2.0% | — |
| xicara | C | mesa | 7.5% | 7.5% | 0.33 | 1.5% | — |
| pena | B | mesa | 10.9% | 10.9% | 1.02 | 2.2% | — |
| borboleta | A | mesa | 10.3% | 10.3% | -0.35 | 2.1% | — |
| chapeu | B | mesa | 36.0% | 35.9% | -0.82 | 7.2% | — |
| tesoura | C | mesa | 10.8% | 10.8% | 2.25 | 2.2% | — |
| pinha | B | mesa | 33.8% | 33.8% | -0.39 | 6.8% | — |
| barco | A | estante | 13.2% | 13.3% | 0.77 | 2.6% | — |
| lanterna | B | estante | 32.1% | 32.2% | 0.8 | 6.4% | — |
| camera | C | estante | 30.3% | 30.4% | 0.97 | 6.0% | — |
| estatueta | C | estante | 25.6% | 25.5% | -1.31 | 5.1% | — |
| globo | A | estante | 13.4% | 13.4% | 2.41 | 2.7% | — |
| bolsa | B | estante | 9.3% | 9.3% | -0.48 | 1.9% | — |
| gaita | C | estante | 11.1% | 11.1% | -0.61 | 2.2% | — |
| apito | C | janela | 7.1% | 7.1% | -0.63 | 1.4% | — |
| colar | C | mesa | 13.7% | 13.7% | -0.14 | 2.7% | — |
| cantil | B | estante | 34.3% | 34.3% | 0.33 | 6.9% | — |

Tiers por rodada: A0 B2 C3 em 5.1%; A1 B2 C2 em 43.4%; A1 B1 C3 em 20.7%; A1 B3 C1 em 9.9%; A0 B3 C2 em 15.4%; A0 B4 C1 em 5.1%; A1 B0 C4 em 0.3%.
Tier da 1ª linha: A 14.8% (esperado 14.9%) · B 42.9% (esperado 42.8%) · C 42.3% (esperado 42.3%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 40.2% | 40.3% |
| 2-1-2 | 29.1% | 29.0% |
| 2-2-1 | 30.8% | 30.6% |

Parte dos listados: janela 31.9% · mesa 34.2% · estante 33.9% · 1ª linha: janela 31.9% · mesa 34.2% · estante 33.9%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 87.5% · borda 1.971:1 · sósias por objeto 0.993 · objetos abaixo de 80% visíveis por rodada 1.324 (máx. 3).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 11.1% | 11.1% | -0.09 | 1.9% | — |
| binoculo | B | janela | 30.8% | 30.8% | 0.57 | 5.1% | — |
| chave | C | janela | 25.8% | 25.8% | 0.74 | 4.3% | — |
| guarda-chuva | A | janela | 11.2% | 11.2% | -1.56 | 1.9% | — |
| gaiola | C | janela | 30.8% | 30.7% | -1.23 | 5.1% | — |
| caracol | C | janela | 25.7% | 25.7% | 0.27 | 4.3% | — |
| piao | C | janela | 30.0% | 30.0% | 0.77 | 5.0% | — |
| lupa | A | mesa | 9.9% | 9.9% | 0.46 | 1.6% | — |
| bussola | B | mesa | 26.4% | 26.4% | 1.17 | 4.4% | — |
| relogio | C | mesa | 18.3% | 18.3% | -1.01 | 3.1% | — |
| xicara | C | mesa | 16.9% | 17.0% | 0.82 | 2.8% | — |
| pena | B | mesa | 10.1% | 10.2% | 0.92 | 1.7% | — |
| borboleta | A | mesa | 10.0% | 10.0% | -0.24 | 1.7% | — |
| chapeu | B | mesa | 23.5% | 23.5% | 0.04 | 3.9% | — |
| tesoura | C | mesa | 19.3% | 19.3% | -0.33 | 3.2% | — |
| pinha | B | mesa | 26.9% | 26.9% | 0.06 | 4.5% | — |
| barco | A | estante | 12.8% | 12.8% | -1.14 | 2.1% | — |
| lanterna | B | estante | 30.2% | 30.2% | 0.08 | 5.0% | — |
| camera | C | estante | 29.9% | 29.9% | -0.21 | 5.0% | — |
| estatueta | C | estante | 27.9% | 27.9% | 0.01 | 4.6% | — |
| globo | A | estante | 13.1% | 13.1% | 1.39 | 2.2% | — |
| bolsa | B | estante | 10.6% | 10.6% | 0.77 | 1.8% | — |
| gaita | C | estante | 18.5% | 18.5% | -0.72 | 3.1% | — |
| apito | C | janela | 34.7% | 34.7% | 0.07 | 5.8% | — |
| colar | C | mesa | 38.6% | 38.6% | -1.41 | 6.4% | — |
| cantil | B | estante | 57.1% | 57.1% | 0.03 | 9.5% | — |

Tiers por rodada: A0 B2 C4 em 8.0%; A1 B2 C3 em 36.3%; A0 B3 C3 em 17.2%; A1 B3 C2 em 9.6%; A1 B1 C4 em 20.6%; A0 B4 C2 em 6.5%; A0 B1 C5 em 0.4%; A1 B0 C5 em 1.5%.
Tier da 1ª linha: A 11.3% (esperado 11.3%) · B 35.9% (esperado 35.9%) · C 52.7% (esperado 52.7%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: janela 33.3% · mesa 33.3% · estante 33.3% · 1ª linha: janela 33.4% · mesa 33.3% · estante 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.7% · borda 2.032:1 · sósias por objeto 1.059 · objetos abaixo de 80% visíveis por rodada 2.191 (máx. 4).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| binoculo | B | janela | 38.6% | 38.6% | -0.33 | 4.9% | — |
| chave | C | janela | 55.3% | 55.3% | 0.1 | 6.9% | — |
| guarda-chuva | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaiola | C | janela | 39.6% | 39.7% | 0.82 | 5.0% | — |
| caracol | C | janela | 40.6% | 40.6% | -0.43 | 5.1% | — |
| piao | C | janela | 40.0% | 39.9% | -0.19 | 5.0% | — |
| lupa | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bussola | B | mesa | 49.0% | 48.9% | -1.33 | 6.1% | — |
| relogio | C | mesa | 51.6% | 51.6% | 0.69 | 6.5% | — |
| xicara | C | mesa | 37.0% | 37.0% | 2.05 | 4.6% | — |
| pena | B | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| borboleta | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| chapeu | B | mesa | 16.2% | 16.2% | -0.36 | 2.0% | — |
| tesoura | C | mesa | 36.9% | 36.9% | 1.28 | 4.6% | — |
| pinha | B | mesa | 34.5% | 34.5% | -1.07 | 4.3% | — |
| barco | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| lanterna | B | estante | 42.2% | 42.2% | 0.53 | 5.3% | — |
| camera | C | estante | 43.5% | 43.4% | -0.89 | 5.4% | — |
| estatueta | C | estante | 59.5% | 59.5% | 0.18 | 7.5% | — |
| globo | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bolsa | B | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaita | C | estante | 60.6% | 60.5% | -1.39 | 7.6% | — |
| apito | C | janela | 53.0% | 53.1% | 0.58 | 6.7% | — |
| colar | C | mesa | 46.8% | 46.7% | -1.2 | 5.8% | — |
| cantil | B | estante | 55.1% | 55.2% | 0.89 | 6.9% | — |

Tiers por rodada: A0 B1 C7 em 16.4%; A0 B2 C6 em 36.5%; A0 B3 C5 em 33.2%; A0 B4 C4 em 11.6%; A0 B0 C8 em 2.3%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 29.4% (esperado 29.5%) · C 70.5% (esperado 70.5%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 32.8% | 32.8% |
| 3-2-3 | 28.0% | 28.0% |
| 3-3-2 | 39.2% | 39.2% |

Parte dos listados: janela 33.4% · mesa 34.0% · estante 32.6% · 1ª linha: janela 33.4% · mesa 34.0% · estante 32.6%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 80.7% · borda 2.026:1 · sósias por objeto 1.325 · objetos abaixo de 80% visíveis por rodada 3.713 (máx. 8).

## A sala como cada exploração a joga (GAME03-REPLAYABILITY-05)

As tabelas acima são a sala como foi pintada (cada coisa no seu primeiro lugar), com a seleção do produto.
Aqui, a seleção real (`selectRound`): cada semente compõe o seu layout e sorteia entre as rodadas válidas dele — 30.000 sementes por dificuldade;
nas primeiras 500, as rodadas válidas de cada layout são enumeradas: a rodada sorteada deve ser uniforme entre elas (posto aleatorizado: χ² e KS) e cada objeto, listado tanto quanto as probabilidades exatas de cada layout dizem.

| Dificuldade | Explorações | Layouts distintos | Inválidas | Fallbacks | Rodadas válidas por layout (mín–média–máx) | Posto: χ² (z) · KS (√n·D) | maior \|z\| por objeto | Visível medido |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 30000 | 30000 | 0 | 0 | 793–1310–1797 | -0.29 · 0.87 | 1.78 | 88.9% |
| Médio | 30000 | 30000 | 0 | 0 | 1333–2998–3789 | 0.46 · 0.7 | 1.62 | 86.1% |
| Difícil | 30000 | 30000 | 0 | 0 | 207–4352–7624 | 0.32 · 1.21 | 2.29 | 83.8% |

### Fácil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| ampulheta | sim | 11.2% | 2.3% | 11.4% | 9.4% | -1.38 |
| binoculo | sim | 28.6% | 5.8% | 28.7% | 29.6% | 0.46 |
| chave | sim | 22.5% | 4.5% | 22.5% | 22.6% | 0.05 |
| guarda-chuva | sim | 10.7% | 2.2% | 10.6% | 12.6% | 1.49 |
| gaiola | sim | 23.1% | 4.7% | 23.0% | 23.4% | 0.21 |
| caracol | sim | 26.1% | 5.4% | 26.2% | 26.6% | 0.2 |
| piao | sim | 27.6% | 5.3% | 27.8% | 30.2% | 1.21 |
| lupa | sim | 9.2% | 2.0% | 9.4% | 9.4% | -0.02 |
| bussola | sim | 24.5% | 5.0% | 24.5% | 24.6% | 0.07 |
| relogio | sim | 21.1% | 4.3% | 20.8% | 23.0% | 1.2 |
| xicara | sim | 17.1% | 3.4% | 16.8% | 17.2% | 0.23 |
| pena | sim | 9.3% | 1.9% | 9.4% | 9.4% | -0.04 |
| borboleta | sim | 9.2% | 1.8% | 9.1% | 7.6% | -1.15 |
| chapeu | sim | 21.4% | 4.5% | 21.4% | 19.0% | -1.3 |
| tesoura | sim | 19.1% | 3.8% | 19.1% | 16.2% | -1.68 |
| pinha | sim | 25.5% | 5.0% | 25.7% | 29.2% | 1.78 |
| barco | sim | 12.6% | 2.5% | 12.3% | 12.6% | 0.19 |
| lanterna | sim | 29.9% | 5.9% | 29.9% | 29.0% | -0.43 |
| camera | sim | 30.1% | 5.9% | 30.2% | 29.0% | -0.6 |
| estatueta | sim | 28.4% | 5.7% | 28.4% | 27.6% | -0.39 |
| globo | sim | 12.4% | 2.3% | 12.2% | 13.8% | 1.06 |
| bolsa | sim | 10.9% | 2.1% | 11.3% | 11.2% | -0.03 |
| gaita | sim | 19.5% | 3.8% | 19.5% | 18.0% | -0.87 |
| apito | sim | 14.6% | 2.9% | 14.5% | 12.8% | -1.09 |
| colar | sim | 15.3% | 3.1% | 15.2% | 17.4% | 1.4 |
| cantil | sim | 19.9% | 4.0% | 20.1% | 18.6% | -0.84 |

Tiers (todas as linhas): A 13.7% · B 49.3% · C 37.0% · estação da 1ª linha: janela 33.0% · mesa 34.8% · estante 32.2%.

### Médio nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| ampulheta | sim | 9.9% | 1.7% | 9.7% | 10.4% | 0.55 |
| binoculo | sim | 25.7% | 4.5% | 25.4% | 24.8% | -0.29 |
| chave | sim | 31.7% | 5.3% | 31.8% | 35.2% | 1.62 |
| guarda-chuva | sim | 8.4% | 1.4% | 8.4% | 6.8% | -1.32 |
| gaiola | sim | 21.4% | 3.4% | 21.2% | 19.8% | -0.78 |
| caracol | sim | 26.5% | 4.5% | 26.4% | 28.2% | 0.92 |
| piao | sim | 29.9% | 4.9% | 30.3% | 28.8% | -0.72 |
| lupa | sim | 7.4% | 1.3% | 7.5% | 7.2% | -0.3 |
| bussola | sim | 21.9% | 3.8% | 21.9% | 21.0% | -0.49 |
| relogio | sim | 27.5% | 4.4% | 27.2% | 30.0% | 1.41 |
| xicara | sim | 23.2% | 3.8% | 23.6% | 22.6% | -0.51 |
| pena | sim | 7.7% | 1.2% | 7.7% | 7.2% | -0.45 |
| borboleta | sim | 8.1% | 1.4% | 8.1% | 7.6% | -0.37 |
| chapeu | sim | 15.5% | 2.6% | 15.3% | 15.2% | -0.03 |
| tesoura | sim | 27.5% | 4.7% | 27.5% | 28.2% | 0.33 |
| pinha | sim | 20.3% | 3.3% | 20.1% | 21.2% | 0.63 |
| barco | sim | 10.6% | 1.8% | 10.7% | 12.4% | 1.21 |
| lanterna | sim | 28.7% | 4.7% | 28.9% | 27.0% | -0.92 |
| camera | sim | 30.6% | 5.1% | 30.5% | 30.0% | -0.23 |
| estatueta | sim | 31.9% | 5.4% | 32.4% | 31.6% | -0.38 |
| globo | sim | 10.5% | 1.7% | 10.7% | 10.6% | -0.04 |
| bolsa | sim | 12.6% | 2.1% | 12.2% | 13.2% | 0.68 |
| gaita | sim | 32.9% | 5.4% | 33.0% | 33.6% | 0.29 |
| apito | sim | 46.5% | 7.7% | 46.8% | 46.0% | -0.37 |
| colar | sim | 41.0% | 6.8% | 41.1% | 39.8% | -0.6 |
| cantil | sim | 42.1% | 7.0% | 41.7% | 41.6% | -0.04 |

Tiers (todas as linhas): A 9.6% · B 43.2% · C 47.2% · estação da 1ª linha: janela 33.5% · mesa 33.2% · estante 33.3%.

### Difícil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| ampulheta | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| binoculo | sim | 35.4% | 4.5% | 35.0% | 38.2% | 1.5 |
| chave | sim | 62.4% | 7.8% | 62.1% | 63.8% | 0.78 |
| guarda-chuva | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| gaiola | sim | 26.6% | 3.4% | 26.4% | 23.8% | -1.42 |
| caracol | sim | 38.3% | 4.8% | 38.1% | 33.4% | -2.18 |
| piao | sim | 47.3% | 5.9% | 47.5% | 47.8% | 0.14 |
| lupa | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| bussola | sim | 38.9% | 4.7% | 39.0% | 36.2% | -1.27 |
| relogio | sim | 56.6% | 6.9% | 56.3% | 61.4% | 2.29 |
| xicara | sim | 40.2% | 5.1% | 39.7% | 38.2% | -0.7 |
| pena | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| borboleta | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| chapeu | sim | 11.9% | 1.5% | 12.0% | 11.6% | -0.28 |
| tesoura | sim | 46.9% | 5.8% | 47.3% | 49.0% | 0.77 |
| pinha | sim | 27.8% | 3.5% | 27.7% | 28.4% | 0.38 |
| barco | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| lanterna | sim | 40.0% | 5.0% | 39.8% | 39.4% | -0.16 |
| camera | sim | 45.1% | 5.5% | 45.8% | 49.2% | 1.56 |
| estatueta | sim | 58.9% | 7.3% | 58.1% | 55.6% | -1.16 |
| globo | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| bolsa | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| gaita | sim | 69.1% | 8.6% | 69.5% | 70.4% | 0.42 |
| apito | sim | 57.1% | 7.0% | 58.3% | 57.6% | -0.3 |
| colar | sim | 52.4% | 7.0% | 52.5% | 51.4% | -0.48 |
| cantil | sim | 45.2% | 5.7% | 45.0% | 44.6% | -0.19 |

Tiers (todas as linhas): A 0.0% · B 39.9% · C 60.1% · estação da 1ª linha: janela 33.4% · mesa 34.6% · estante 32.0%.

Nenhum invariante falhou.
