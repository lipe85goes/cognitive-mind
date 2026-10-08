# Estúdio das Descobertas — relatório de justiça das rodadas (GAME03-EXPERIENCE-02)

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v1`, plate `bd874d6590f0…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 18 objetos · tiers A6 B6 C6 · Janela 5, Mesa 7, Estante 6.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A3 B2 C0 | 12 | 148 | 148 | 1.51 | 2.19 |
| Médio | silhouette | 6 | A1 B3 C2 | 17 | 243 | 243 | -0.27 | 2.51 |
| Difícil | clue | 8 | A1 B3 C4 | 18 | 692 | 692 | -0.84 | 2.35 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 57.4% | 57.5% | 1.77 | 11.5% | 1.149 |
| binoculo | B | janela | 40.5% | 40.5% | -0.88 | 8.1% | 1.216 |
| chave | C | janela | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| guarda-chuva | A | janela | 57.4% | 57.3% | -1.91 | 11.5% | 1.149 |
| gaiola | C | janela | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| lupa | A | mesa | 43.2% | 43.2% | -0.02 | 8.6% | 0.865 |
| bussola | B | mesa | 29.7% | 29.8% | 0.6 | 6.0% | 0.892 |
| relogio | C | mesa | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| xicara | C | mesa | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| pena | B | mesa | 29.7% | 29.7% | -0.22 | 5.9% | 0.892 |
| borboleta | A | mesa | 43.2% | 43.3% | 0.68 | 8.6% | 0.865 |
| chapeu | B | mesa | 29.7% | 29.7% | -1.27 | 5.9% | 0.892 |
| barco | A | estante | 49.3% | 49.3% | -0.19 | 9.9% | 0.986 |
| lanterna | B | estante | 35.1% | 35.1% | -0.43 | 7.0% | 1.054 |
| camera | C | estante | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| estatueta | C | estante | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| globo | A | estante | 49.3% | 49.3% | -0.32 | 9.9% | 0.986 |
| bolsa | B | estante | 35.1% | 35.2% | 2.19 | 7.0% | 1.054 |

Tiers por rodada: A3 B2 C0 em 100.0%.
Tier da 1ª linha: A 60.0% (esperado 60.0%) · B 40.0% (esperado 40.0%) · C 0.0% (esperado 0.0%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 44.6% | 44.6% |
| 2-1-2 | 24.3% | 24.3% |
| 2-2-1 | 31.1% | 31.0% |

Parte dos listados: janela 31.1% · mesa 35.1% · estante 33.8% · 1ª linha: janela 31.1% · mesa 35.1% · estante 33.8%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 94.8% · borda 1.771:1 · sósias por objeto 0.412 · objetos abaixo de 80% visíveis por rodada 0.351 (máx. 1).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 26.3% | 26.4% | 0.33 | 4.4% | 1.317 |
| binoculo | B | janela | 64.2% | 64.2% | -0.7 | 10.7% | 1.284 |
| chave | C | janela | 41.6% | 41.6% | 0.27 | 7.0% | 1.247 |
| guarda-chuva | A | janela | 26.3% | 26.4% | 0.5 | 4.4% | 1.317 |
| gaiola | C | janela | 41.6% | 41.5% | -0.32 | 6.9% | 1.247 |
| lupa | A | mesa | 12.8% | 12.8% | 0.33 | 2.1% | 0.638 |
| bussola | B | mesa | 44.9% | 44.9% | 0.45 | 7.5% | 0.897 |
| relogio | C | mesa | 26.3% | 26.4% | 1.52 | 4.4% | 0.79 |
| xicara | C | mesa | 26.3% | 26.3% | 0 | 4.4% | 0.79 |
| pena | B | mesa | 44.9% | 44.9% | 0.49 | 7.5% | 0.897 |
| borboleta | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| chapeu | B | mesa | 44.9% | 44.7% | -2.51 | 7.4% | 0.897 |
| barco | A | estante | 17.3% | 17.3% | -0.2 | 2.9% | 0.864 |
| lanterna | B | estante | 50.6% | 50.7% | 0.94 | 8.4% | 1.012 |
| camera | C | estante | 32.1% | 32.1% | -0.36 | 5.3% | 0.963 |
| estatueta | C | estante | 32.1% | 32.0% | -1.02 | 5.3% | 0.963 |
| globo | A | estante | 17.3% | 17.2% | -1.05 | 2.9% | 0.864 |
| bolsa | B | estante | 50.6% | 50.7% | 1.29 | 8.4% | 1.012 |

Tiers por rodada: A1 B3 C2 em 100.0%.
Tier da 1ª linha: A 16.7% (esperado 16.7%) · B 50.0% (esperado 50.0%) · C 33.3% (esperado 33.3%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: janela 33.3% · mesa 33.3% · estante 33.3% · 1ª linha: janela 33.4% · mesa 33.3% · estante 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 87.5% · borda 1.939:1 · sósias por objeto 0.674 · objetos abaixo de 80% visíveis por rodada 1.506 (máx. 3).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 22.0% | 21.9% | -1.49 | 2.7% | 1.318 |
| binoculo | B | janela | 63.0% | 63.0% | 0.57 | 7.9% | 1.26 |
| chave | C | janela | 74.6% | 74.5% | -0.96 | 9.3% | 1.118 |
| guarda-chuva | A | janela | 22.0% | 22.0% | 0.97 | 2.8% | 1.318 |
| gaiola | C | janela | 74.6% | 74.6% | 0.39 | 9.3% | 1.118 |
| lupa | A | mesa | 12.1% | 12.2% | 1.08 | 1.5% | 0.728 |
| bussola | B | mesa | 44.5% | 44.6% | 1.06 | 5.6% | 0.89 |
| relogio | C | mesa | 59.0% | 59.0% | -0.1 | 7.3% | 0.884 |
| xicara | C | mesa | 59.0% | 59.0% | 0 | 7.4% | 0.884 |
| pena | B | mesa | 44.5% | 44.4% | -2.35 | 5.5% | 0.89 |
| borboleta | A | mesa | 12.1% | 12.1% | 0.14 | 1.5% | 0.728 |
| chapeu | B | mesa | 44.5% | 44.5% | 0.22 | 5.6% | 0.89 |
| barco | A | estante | 15.9% | 15.9% | -0.88 | 2.0% | 0.954 |
| lanterna | B | estante | 51.7% | 51.8% | 0.69 | 6.5% | 1.035 |
| camera | C | estante | 66.5% | 66.5% | 1.27 | 8.3% | 0.997 |
| estatueta | C | estante | 66.5% | 66.4% | -0.65 | 8.3% | 0.997 |
| globo | A | estante | 15.9% | 15.9% | 0.37 | 2.0% | 0.954 |
| bolsa | B | estante | 51.7% | 51.7% | -0.17 | 6.5% | 1.035 |

Tiers por rodada: A1 B3 C4 em 100.0%.
Tier da 1ª linha: A 12.5% (esperado 12.5%) · B 37.5% (esperado 37.5%) · C 49.9% (esperado 50.0%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 43.9% | 44.0% |
| 3-2-3 | 24.3% | 24.3% |
| 3-3-2 | 31.8% | 31.8% |

Parte dos listados: janela 32.0% · mesa 34.5% · estante 33.5% · 1ª linha: janela 32.0% · mesa 34.4% · estante 33.6%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.9% · borda 1.973:1 · sósias por objeto 0.751 · objetos abaixo de 80% visíveis por rodada 2.517 (máx. 4).

Nenhum invariante falhou.
