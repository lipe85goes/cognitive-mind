# Estúdio das Descobertas · Estúdio do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v2`, plate `53e36d0ff3a8…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 23 objetos · tiers A6 B7 C10 · Janela 7, Mesa 9, Estante 7.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 23 | 414 | 414 | 0.61 | 2.52 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 23 | 1693 | 1693 | 1.52 | 1.5 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 15 | 1890 | 1890 | 0.83 | 1.61 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 10.9% | 10.9% | 1.04 | 2.2% | — |
| binoculo | B | janela | 38.4% | 38.5% | 1.82 | 7.7% | — |
| chave | C | janela | 19.1% | 19.1% | 1.29 | 3.8% | — |
| guarda-chuva | A | janela | 10.1% | 10.1% | -0.24 | 2.0% | — |
| gaiola | C | janela | 34.1% | 34.0% | -1.34 | 6.8% | — |
| caracol | C | janela | 20.1% | 20.0% | -2.52 | 4.0% | — |
| piao | C | janela | 31.2% | 31.2% | 0.33 | 6.2% | — |
| lupa | A | mesa | 11.1% | 11.1% | -0.05 | 2.2% | — |
| bussola | B | mesa | 30.7% | 30.7% | 0.1 | 6.2% | — |
| relogio | C | mesa | 10.6% | 10.6% | -0.62 | 2.1% | — |
| xicara | C | mesa | 6.3% | 6.2% | -1.55 | 1.3% | — |
| pena | B | mesa | 9.9% | 9.9% | -1.13 | 2.0% | — |
| borboleta | A | mesa | 8.5% | 8.5% | -0.01 | 1.7% | — |
| chapeu | B | mesa | 43.5% | 43.5% | 0.1 | 8.7% | — |
| tesoura | C | mesa | 11.1% | 11.1% | 0.72 | 2.2% | — |
| pinha | B | mesa | 38.4% | 38.4% | -0.07 | 7.7% | — |
| barco | A | estante | 14.2% | 14.3% | 0.42 | 2.8% | — |
| lanterna | B | estante | 34.5% | 34.5% | -0.17 | 6.9% | — |
| camera | C | estante | 36.2% | 36.3% | 1.18 | 7.3% | — |
| estatueta | C | estante | 37.0% | 36.9% | -0.5 | 7.4% | — |
| globo | A | estante | 21.3% | 21.2% | -1.28 | 4.2% | — |
| bolsa | B | estante | 9.9% | 9.9% | 0.97 | 2.0% | — |
| gaita | C | estante | 13.0% | 13.1% | 0.97 | 2.6% | — |

Tiers por rodada: A1 B2 C2 em 42.7%; A1 B3 C1 em 8.9%; A1 B1 C3 em 24.1%; A0 B2 C3 em 6.0%; A0 B3 C2 em 14.8%; A0 B4 C1 em 3.2%; A1 B0 C4 em 0.2%.
Tier da 1ª linha: A 15.2% (esperado 15.2%) · B 41.1% (esperado 41.1%) · C 43.7% (esperado 43.7%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 36.2% | 36.2% |
| 2-1-2 | 29.9% | 30.0% |
| 2-2-1 | 33.8% | 33.8% |

Parte dos listados: janela 32.8% · mesa 34.0% · estante 33.3% · 1ª linha: janela 32.7% · mesa 34.1% · estante 33.2%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 88.3% · borda 1.938:1 · sósias por objeto 1.003 · objetos abaixo de 80% visíveis por rodada 1.28 (máx. 3).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 10.9% | 10.8% | -0.52 | 1.8% | — |
| binoculo | B | janela | 39.3% | 39.3% | 0.76 | 6.6% | — |
| chave | C | janela | 31.1% | 31.2% | 1.46 | 5.2% | — |
| guarda-chuva | A | janela | 11.3% | 11.3% | 0.44 | 1.9% | — |
| gaiola | C | janela | 38.7% | 38.6% | -1.12 | 6.5% | — |
| caracol | C | janela | 30.5% | 30.5% | -0.36 | 5.1% | — |
| piao | C | janela | 38.3% | 38.2% | -0.65 | 6.4% | — |
| lupa | A | mesa | 9.1% | 9.1% | -1.36 | 1.5% | — |
| bussola | B | mesa | 32.6% | 32.6% | -0.02 | 5.4% | — |
| relogio | C | mesa | 22.2% | 22.2% | -0.95 | 3.7% | — |
| xicara | C | mesa | 21.0% | 21.1% | 0.69 | 3.5% | — |
| pena | B | mesa | 9.0% | 9.0% | 0.31 | 1.5% | — |
| borboleta | A | mesa | 9.0% | 9.0% | -0.03 | 1.5% | — |
| chapeu | B | mesa | 35.7% | 35.7% | 0.16 | 6.0% | — |
| tesoura | C | mesa | 23.9% | 23.9% | 0.71 | 4.0% | — |
| pinha | B | mesa | 37.5% | 37.5% | 0.1 | 6.2% | — |
| barco | A | estante | 16.0% | 16.0% | 0.87 | 2.7% | — |
| lanterna | B | estante | 45.0% | 45.0% | 0.94 | 7.5% | — |
| camera | C | estante | 43.6% | 43.6% | -1.5 | 7.3% | — |
| estatueta | C | estante | 38.5% | 38.5% | 0.08 | 6.4% | — |
| globo | A | estante | 16.1% | 16.1% | 0.75 | 2.7% | — |
| bolsa | B | estante | 12.3% | 12.3% | -0.74 | 2.1% | — |
| gaita | C | estante | 28.5% | 28.5% | -0.25 | 4.8% | — |

Tiers por rodada: A1 B2 C3 em 39.6%; A1 B1 C4 em 22.5%; A0 B4 C2 em 5.3%; A1 B3 C2 em 9.7%; A0 B3 C3 em 15.0%; A0 B2 C4 em 7.2%; A1 B0 C5 em 0.5%; A0 B1 C5 em 0.2%.
Tier da 1ª linha: A 12.1% (esperado 12.0%) · B 35.3% (esperado 35.2%) · C 52.7% (esperado 52.7%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: janela 33.3% · mesa 33.3% · estante 33.3% · 1ª linha: janela 33.4% · mesa 33.3% · estante 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 85.7% · borda 1.928:1 · sósias por objeto 1.088 · objetos abaixo de 80% visíveis por rodada 1.9 (máx. 4).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| binoculo | B | janela | 50.9% | 50.9% | 0.5 | 6.4% | — |
| chave | C | janela | 62.9% | 62.8% | -0.86 | 7.8% | — |
| guarda-chuva | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaiola | C | janela | 51.2% | 51.2% | 0.45 | 6.4% | — |
| caracol | C | janela | 52.0% | 52.0% | 0.3 | 6.5% | — |
| piao | C | janela | 51.2% | 51.2% | -0.04 | 6.4% | — |
| lupa | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bussola | B | mesa | 54.4% | 54.4% | -0.88 | 6.8% | — |
| relogio | C | mesa | 56.0% | 56.0% | -0.41 | 7.0% | — |
| xicara | C | mesa | 45.2% | 45.2% | -0.28 | 5.6% | — |
| pena | B | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| borboleta | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| chapeu | B | mesa | 30.5% | 30.5% | -0.19 | 3.8% | — |
| tesoura | C | mesa | 45.2% | 45.3% | 1.61 | 5.6% | — |
| pinha | B | mesa | 43.8% | 43.8% | 0.66 | 5.5% | — |
| barco | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| lanterna | B | estante | 58.5% | 58.5% | 0.5 | 7.3% | — |
| camera | C | estante | 58.9% | 58.9% | -0.54 | 7.4% | — |
| estatueta | C | estante | 69.4% | 69.3% | -0.9 | 8.7% | — |
| globo | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bolsa | B | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaita | C | estante | 70.1% | 70.1% | -0.03 | 8.8% | — |

Tiers por rodada: A0 B3 C5 em 35.2%; A0 B2 C6 em 37.9%; A0 B1 C7 em 14.9%; A0 B4 C4 em 10.5%; A0 B0 C8 em 1.6%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 29.8% (esperado 29.8%) · C 70.2% (esperado 70.2%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 31.9% | 31.9% |
| 3-2-3 | 24.9% | 24.9% |
| 3-3-2 | 43.2% | 43.2% |

Parte dos listados: janela 33.5% · mesa 34.4% · estante 32.1% · 1ª linha: janela 33.5% · mesa 34.4% · estante 32.1%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 81.4% · borda 1.937:1 · sósias por objeto 1.353 · objetos abaixo de 80% visíveis por rodada 3.33 (máx. 6).

Nenhum invariante falhou.
