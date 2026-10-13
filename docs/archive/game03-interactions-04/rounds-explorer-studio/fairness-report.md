# Estúdio das Descobertas · Estúdio do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v3`, plate `58d6403dd026…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 26 objetos · tiers A6 B8 C12 · Janela 8, Mesa 10, Estante 8.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 26 | 898 | 898 | -0.4 | 2.29 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 26 | 3153 | 3153 | 2.27 | 1.95 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 18 | 8001 | 8001 | -0.15 | 1.88 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 12.9% | 13.0% | 1.48 | 2.6% | — |
| binoculo | B | janela | 33.4% | 33.4% | 0.57 | 6.7% | — |
| chave | C | janela | 19.0% | 19.1% | 0.89 | 3.8% | — |
| guarda-chuva | A | janela | 12.8% | 12.8% | 0.34 | 2.5% | — |
| gaiola | C | janela | 31.6% | 31.5% | -2.12 | 6.3% | — |
| caracol | C | janela | 17.0% | 17.0% | -1.86 | 3.4% | — |
| piao | C | janela | 27.3% | 27.3% | 0.1 | 5.4% | — |
| lupa | A | mesa | 10.8% | 10.8% | -1.52 | 2.2% | — |
| bussola | B | mesa | 26.7% | 26.8% | 0.81 | 5.3% | — |
| relogio | C | mesa | 10.5% | 10.4% | -0.6 | 2.1% | — |
| xicara | C | mesa | 7.9% | 7.9% | -1.76 | 1.6% | — |
| pena | B | mesa | 10.5% | 10.4% | -1.13 | 2.1% | — |
| borboleta | A | mesa | 9.8% | 9.8% | 0.55 | 1.9% | — |
| chapeu | B | mesa | 34.7% | 34.8% | 1.22 | 7.0% | — |
| tesoura | C | mesa | 11.3% | 11.3% | 1.54 | 2.3% | — |
| pinha | B | mesa | 33.2% | 33.1% | -1.3 | 6.6% | — |
| barco | A | estante | 12.8% | 12.8% | 0.47 | 2.5% | — |
| lanterna | B | estante | 32.2% | 32.1% | -1.14 | 6.4% | — |
| camera | C | estante | 31.3% | 31.4% | 1.98 | 6.3% | — |
| estatueta | C | estante | 24.6% | 24.6% | 0.25 | 4.9% | — |
| globo | A | estante | 15.0% | 15.0% | 0.36 | 3.0% | — |
| bolsa | B | estante | 9.5% | 9.4% | -0.47 | 1.9% | — |
| gaita | C | estante | 10.6% | 10.6% | -0.19 | 2.1% | — |
| apito | C | janela | 7.5% | 7.5% | 1.33 | 1.5% | — |
| colar | C | mesa | 14.2% | 14.3% | 2.29 | 2.9% | — |
| cantil | B | estante | 32.9% | 32.8% | -1.74 | 6.6% | — |

Tiers por rodada: A1 B2 C2 em 43.7%; A0 B4 C1 em 5.2%; A0 B2 C3 em 4.9%; A1 B1 C3 em 21.3%; A1 B3 C1 em 8.8%; A0 B3 C2 em 15.7%; A1 B0 C4 em 0.3%.
Tier da 1ª linha: A 14.8% (esperado 14.8%) · B 42.6% (esperado 42.6%) · C 42.6% (esperado 42.6%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 38.4% | 38.4% |
| 2-1-2 | 30.4% | 30.4% |
| 2-2-1 | 31.2% | 31.2% |

Parte dos listados: janela 32.3% · mesa 33.9% · estante 33.8% · 1ª linha: janela 32.3% · mesa 34.0% · estante 33.8%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 87.5% · borda 1.982:1 · sósias por objeto 0.992 · objetos abaixo de 80% visíveis por rodada 1.337 (máx. 3).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | 10.9% | 10.9% | -0.43 | 1.8% | — |
| binoculo | B | janela | 30.7% | 30.7% | 1.24 | 5.1% | — |
| chave | C | janela | 25.6% | 25.6% | 0.79 | 4.3% | — |
| guarda-chuva | A | janela | 11.2% | 11.2% | 0.16 | 1.9% | — |
| gaiola | C | janela | 30.8% | 30.7% | -0.76 | 5.1% | — |
| caracol | C | janela | 25.5% | 25.4% | -1.95 | 4.2% | — |
| piao | C | janela | 29.8% | 29.9% | 0.75 | 5.0% | — |
| lupa | A | mesa | 9.9% | 9.9% | -0.87 | 1.7% | — |
| bussola | B | mesa | 26.3% | 26.3% | -0.24 | 4.4% | — |
| relogio | C | mesa | 18.8% | 18.7% | -1.63 | 3.1% | — |
| xicara | C | mesa | 17.2% | 17.2% | 1.94 | 2.9% | — |
| pena | B | mesa | 10.1% | 10.1% | 0.14 | 1.7% | — |
| borboleta | A | mesa | 9.7% | 9.7% | -0.56 | 1.6% | — |
| chapeu | B | mesa | 23.5% | 23.5% | 0.22 | 3.9% | — |
| tesoura | C | mesa | 19.5% | 19.5% | 0.4 | 3.3% | — |
| pinha | B | mesa | 26.8% | 26.8% | -0.07 | 4.4% | — |
| barco | A | estante | 12.5% | 12.5% | 0.74 | 2.1% | — |
| lanterna | B | estante | 30.4% | 30.3% | -1.26 | 5.1% | — |
| camera | C | estante | 30.0% | 30.0% | 0.01 | 5.0% | — |
| estatueta | C | estante | 27.9% | 27.9% | 0.69 | 4.6% | — |
| globo | A | estante | 13.5% | 13.6% | 0.67 | 2.3% | — |
| bolsa | B | estante | 10.7% | 10.7% | 0.06 | 1.8% | — |
| gaita | C | estante | 18.4% | 18.4% | -0.46 | 3.0% | — |
| apito | C | janela | 35.5% | 35.5% | 0.06 | 5.9% | — |
| colar | C | mesa | 38.2% | 38.2% | 0.35 | 6.4% | — |
| cantil | B | estante | 56.7% | 56.7% | -0.1 | 9.4% | — |

Tiers por rodada: A1 B2 C3 em 36.1%; A0 B4 C2 em 6.6%; A0 B2 C4 em 8.0%; A1 B0 C5 em 1.6%; A1 B1 C4 em 20.8%; A0 B3 C3 em 17.3%; A1 B3 C2 em 9.2%; A0 B1 C5 em 0.4%.
Tier da 1ª linha: A 11.3% (esperado 11.3%) · B 35.8% (esperado 35.9%) · C 52.8% (esperado 52.8%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: janela 33.3% · mesa 33.3% · estante 33.3% · 1ª linha: janela 33.4% · mesa 33.4% · estante 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.7% · borda 2.043:1 · sósias por objeto 1.059 · objetos abaixo de 80% visíveis por rodada 2.197 (máx. 4).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ampulheta | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| binoculo | B | janela | 38.6% | 38.6% | 0.71 | 4.8% | — |
| chave | C | janela | 55.4% | 55.3% | -1.1 | 6.9% | — |
| guarda-chuva | A | janela | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaiola | C | janela | 39.6% | 39.6% | 0.29 | 5.0% | — |
| caracol | C | janela | 40.6% | 40.6% | -0.78 | 5.1% | — |
| piao | C | janela | 39.9% | 40.0% | 1.85 | 5.0% | — |
| lupa | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bussola | B | mesa | 48.9% | 48.9% | -0.86 | 6.1% | — |
| relogio | C | mesa | 51.6% | 51.6% | 0.06 | 6.4% | — |
| xicara | C | mesa | 37.0% | 37.0% | 0.31 | 4.6% | — |
| pena | B | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| borboleta | A | mesa | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| chapeu | B | mesa | 16.2% | 16.2% | -1.1 | 2.0% | — |
| tesoura | C | mesa | 36.9% | 37.0% | 1.88 | 4.6% | — |
| pinha | B | mesa | 34.6% | 34.7% | 1.02 | 4.3% | — |
| barco | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| lanterna | B | estante | 42.1% | 42.1% | -1.18 | 5.3% | — |
| camera | C | estante | 43.5% | 43.4% | -1.18 | 5.4% | — |
| estatueta | C | estante | 59.4% | 59.4% | -1.6 | 7.4% | — |
| globo | A | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| bolsa | B | estante | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gaita | C | estante | 60.6% | 60.7% | 1.16 | 7.6% | — |
| apito | C | janela | 53.1% | 53.0% | -0.51 | 6.7% | — |
| colar | C | mesa | 46.8% | 46.8% | -0.81 | 5.8% | — |
| cantil | B | estante | 55.1% | 55.2% | 1.7 | 6.9% | — |

Tiers por rodada: A0 B1 C7 em 16.3%; A0 B3 C5 em 33.2%; A0 B2 C6 em 36.6%; A0 B4 C4 em 11.6%; A0 B0 C8 em 2.3%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 29.5% (esperado 29.4%) · C 70.5% (esperado 70.5%).

Estações (Janela-Mesa-Estante por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 32.8% | 32.8% |
| 3-2-3 | 28.0% | 28.0% |
| 3-3-2 | 39.2% | 39.3% |

Parte dos listados: janela 33.4% · mesa 34.0% · estante 32.6% · 1ª linha: janela 33.4% · mesa 34.0% · estante 32.6%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 80.7% · borda 2.034:1 · sósias por objeto 1.325 · objetos abaixo de 80% visíveis por rodada 3.713 (máx. 8).

Nenhum invariante falhou.
