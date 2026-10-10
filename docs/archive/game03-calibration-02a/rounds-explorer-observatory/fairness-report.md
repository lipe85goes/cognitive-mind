# Estúdio das Descobertas · Observatório do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v2`, plate `945f4e935354…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 23 objetos · tiers A6 B7 C10 · Cúpula 8, Bancada 7, Arquivo 8.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 23 | 767 | 767 | 0.52 | 2.96 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 23 | 2886 | 2886 | 0.41 | 1.32 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 17 | 5899 | 5899 | 1.35 | 1.59 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 14.0% | 14.0% | 0.32 | 2.8% | — |
| pipa | A | cupula | 16.4% | 16.5% | 2.24 | 3.3% | — |
| luneta | B | cupula | 22.3% | 22.3% | -0.8 | 4.5% | — |
| pantufas | B | cupula | 27.9% | 27.9% | -0.41 | 5.6% | — |
| oculos | C | cupula | 22.0% | 22.0% | -0.9 | 4.4% | — |
| ratinho | C | cupula | 20.6% | 20.6% | 0.28 | 4.1% | — |
| caneca | C | cupula | 20.3% | 20.4% | 1.02 | 4.1% | — |
| ferradura | B | cupula | 24.8% | 24.7% | -1.55 | 5.0% | — |
| sistema-solar | A | bancada | 15.9% | 15.8% | -1.49 | 3.2% | — |
| vela | A | bancada | 17.3% | 17.4% | 0.94 | 3.5% | — |
| compasso | B | bancada | 30.1% | 30.1% | 0.42 | 6.0% | — |
| bule | B | bancada | 32.1% | 32.1% | 0.96 | 6.4% | — |
| sino | C | bancada | 27.1% | 27.1% | 0.51 | 5.4% | — |
| maca | C | bancada | 15.3% | 15.2% | -1.61 | 3.0% | — |
| esquadro | C | bancada | 24.5% | 24.5% | -0.47 | 4.9% | — |
| violino | A | arquivo | 16.8% | 16.7% | -2.96 | 3.4% | — |
| gramofone | A | arquivo | 14.2% | 14.2% | 0.67 | 2.8% | — |
| microscopio | B | arquivo | 26.7% | 26.8% | 2.33 | 5.3% | — |
| gato | B | arquivo | 27.9% | 27.9% | -0.39 | 5.6% | — |
| balanca | C | arquivo | 21.6% | 21.7% | 0.55 | 4.3% | — |
| leque | C | arquivo | 19.2% | 19.1% | -0.33 | 3.9% | — |
| cavalo-marinho | C | arquivo | 24.1% | 24.1% | -0.09 | 4.8% | — |
| cadeado | C | arquivo | 18.8% | 18.8% | 0.4 | 3.8% | — |

Tiers por rodada: A1 B2 C2 em 60.9%; A1 B1 C3 em 26.1%; A0 B4 C1 em 4.8%; A1 B3 C1 em 7.7%; A0 B3 C2 em 0.5%.
Tier da 1ª linha: A 19.0% (esperado 18.9%) · B 38.3% (esperado 38.4%) · C 42.7% (esperado 42.7%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 31.7% | 31.7% |
| 2-1-2 | 37.7% | 37.7% |
| 2-2-1 | 30.6% | 30.6% |

Parte dos listados: cupula 33.7% · bancada 32.5% · arquivo 33.9% · 1ª linha: cupula 33.6% · bancada 32.5% · arquivo 33.9%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 85.9% · borda 2.208:1 · sósias por objeto 1.024 · objetos abaixo de 80% visíveis por rodada 1.365 (máx. 4).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 13.3% | 13.3% | 0.02 | 2.2% | — |
| pipa | A | cupula | 12.6% | 12.6% | 0.39 | 2.1% | — |
| luneta | B | cupula | 29.1% | 29.1% | 0.43 | 4.9% | — |
| pantufas | B | cupula | 29.6% | 29.6% | 0.18 | 5.0% | — |
| oculos | C | cupula | 30.1% | 30.1% | 0.87 | 5.0% | — |
| ratinho | C | cupula | 28.8% | 28.8% | -0.45 | 4.8% | — |
| caneca | C | cupula | 28.5% | 28.5% | -0.04 | 4.8% | — |
| ferradura | B | cupula | 28.0% | 27.9% | -1.32 | 4.6% | — |
| sistema-solar | A | bancada | 17.3% | 17.3% | 0.43 | 2.9% | — |
| vela | A | bancada | 17.6% | 17.6% | 0.56 | 2.9% | — |
| compasso | B | bancada | 33.6% | 33.6% | 0.06 | 5.6% | — |
| bule | B | bancada | 33.3% | 33.4% | 1.1 | 5.5% | — |
| sino | C | bancada | 33.8% | 33.8% | -0.37 | 5.7% | — |
| maca | C | bancada | 30.8% | 30.8% | -0.94 | 5.1% | — |
| esquadro | C | bancada | 33.6% | 33.5% | -0.66 | 5.6% | — |
| violino | A | arquivo | 12.2% | 12.1% | -0.98 | 2.0% | — |
| gramofone | A | arquivo | 13.9% | 13.9% | -0.4 | 2.3% | — |
| microscopio | B | arquivo | 29.4% | 29.4% | 0.37 | 4.9% | — |
| gato | B | arquivo | 29.4% | 29.5% | 0.24 | 4.9% | — |
| balanca | C | arquivo | 29.6% | 29.6% | 0.47 | 4.9% | — |
| leque | C | arquivo | 27.8% | 27.8% | 0.51 | 4.7% | — |
| cavalo-marinho | C | arquivo | 29.9% | 29.8% | -1.31 | 5.0% | — |
| cadeado | C | arquivo | 27.8% | 27.9% | 0.75 | 4.6% | — |

Tiers por rodada: A1 B2 C3 em 51.6%; A1 B1 C4 em 21.4%; A0 B3 C3 em 5.8%; A1 B3 C2 em 13.7%; A0 B4 C2 em 7.3%; A1 B0 C5 em 0.2%.
Tier da 1ª linha: A 14.5% (esperado 14.5%) · B 35.4% (esperado 35.4%) · C 50.1% (esperado 50.1%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.4% · bancada 33.3% · arquivo 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.7% · borda 2.117:1 · sósias por objeto 1.11 · objetos abaixo de 80% visíveis por rodada 1.856 (máx. 5).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| pipa | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| luneta | B | cupula | 54.1% | 54.1% | 0.18 | 6.8% | — |
| pantufas | B | cupula | 40.6% | 40.6% | -0.38 | 5.1% | — |
| oculos | C | cupula | 44.9% | 44.9% | 0.46 | 5.6% | — |
| ratinho | C | cupula | 58.4% | 58.4% | 0.3 | 7.3% | — |
| caneca | C | cupula | 45.3% | 45.2% | -1.04 | 5.7% | — |
| ferradura | B | cupula | 24.8% | 24.8% | 1.1 | 3.1% | — |
| sistema-solar | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| vela | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| compasso | B | bancada | 44.2% | 44.2% | 0.33 | 5.5% | — |
| bule | B | bancada | 44.3% | 44.2% | -0.87 | 5.5% | — |
| sino | C | bancada | 49.2% | 49.2% | 0.11 | 6.2% | — |
| maca | C | bancada | 62.7% | 62.7% | -0.59 | 7.8% | — |
| esquadro | C | bancada | 62.4% | 62.4% | 0.44 | 7.8% | — |
| violino | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gramofone | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| microscopio | B | arquivo | 39.5% | 39.4% | -1.34 | 4.9% | — |
| gato | B | arquivo | 39.5% | 39.6% | 0.58 | 4.9% | — |
| balanca | C | arquivo | 44.3% | 44.2% | -1.59 | 5.5% | — |
| leque | C | arquivo | 44.4% | 44.5% | 1.07 | 5.6% | — |
| cavalo-marinho | C | arquivo | 44.2% | 44.3% | 1.16 | 5.5% | — |
| cadeado | C | arquivo | 57.4% | 57.4% | 0.2 | 7.2% | — |

Tiers por rodada: A0 B3 C5 em 40.4%; A0 B2 C6 em 25.6%; A0 B4 C4 em 27.0%; A0 B1 C7 em 6.5%; A0 B0 C8 em 0.5%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 35.8% (esperado 35.9%) · C 64.2% (esperado 64.1%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 32.0% | 31.9% |
| 3-2-3 | 37.3% | 37.3% |
| 3-3-2 | 30.8% | 30.8% |

Parte dos listados: cupula 33.5% · bancada 32.8% · arquivo 33.7% · 1ª linha: cupula 33.5% · bancada 32.8% · arquivo 33.7%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 81.5% · borda 1.953:1 · sósias por objeto 1.338 · objetos abaixo de 80% visíveis por rodada 3.263 (máx. 6).

Nenhum invariante falhou.
