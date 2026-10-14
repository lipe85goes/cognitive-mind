# Estúdio das Descobertas · Observatório do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v4`, plate `7e1a3158d1e8…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 26 objetos · tiers A6 B7 C13 · Cúpula 9, Bancada 8, Arquivo 9.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 26 | 1326 | 1326 | 0.64 | 2.11 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 26 | 4021 | 4021 | 0.77 | 1.71 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 20 | 19414 | 19414 | -0.19 | 1.58 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 11.7% | 11.8% | 2.11 | 2.4% | — |
| pipa | A | cupula | 19.1% | 19.1% | 0.01 | 3.8% | — |
| luneta | B | cupula | 20.5% | 20.5% | -1.18 | 4.1% | — |
| pantufas | B | cupula | 27.8% | 27.8% | 0.27 | 5.5% | — |
| oculos | C | cupula | 20.2% | 20.3% | 2.03 | 4.1% | — |
| ratinho | C | cupula | 15.8% | 15.8% | 0.38 | 3.2% | — |
| caneca | C | cupula | 16.4% | 16.4% | -0.4 | 3.3% | — |
| ferradura | B | cupula | 24.0% | 23.9% | -1.18 | 4.8% | — |
| sistema-solar | A | bancada | 17.0% | 17.0% | 0.23 | 3.4% | — |
| vela | A | bancada | 15.9% | 15.9% | -0.41 | 3.2% | — |
| compasso | B | bancada | 30.1% | 30.1% | 0.33 | 6.0% | — |
| bule | B | bancada | 30.3% | 30.4% | 1.62 | 6.0% | — |
| sino | C | bancada | 22.1% | 22.1% | -1.09 | 4.4% | — |
| maca | C | bancada | 11.9% | 11.9% | 0.3 | 2.4% | — |
| esquadro | C | bancada | 18.6% | 18.6% | -0.38 | 3.7% | — |
| violino | A | arquivo | 17.9% | 17.8% | -0.85 | 3.6% | — |
| gramofone | A | arquivo | 14.6% | 14.5% | -1.1 | 2.9% | — |
| microscopio | B | arquivo | 27.4% | 27.4% | -0.51 | 5.5% | — |
| gato | B | arquivo | 26.9% | 26.9% | 1.62 | 5.4% | — |
| balanca | C | arquivo | 19.0% | 19.0% | 0.59 | 3.8% | — |
| leque | C | arquivo | 15.0% | 15.0% | 0.01 | 3.0% | — |
| cavalo-marinho | C | arquivo | 19.3% | 19.3% | -1.41 | 3.8% | — |
| cadeado | C | arquivo | 15.5% | 15.5% | 0.95 | 3.1% | — |
| foguete | C | cupula | 12.4% | 12.3% | -0.79 | 2.5% | — |
| ioio | C | bancada | 17.8% | 17.8% | -0.67 | 3.6% | — |
| tambor | C | arquivo | 13.1% | 13.0% | -0.71 | 2.6% | — |

Tiers por rodada: A1 B1 C3 em 28.1%; A1 B2 C2 em 60.5%; A1 B3 C1 em 7.5%; A0 B4 C1 em 3.6%; A0 B3 C2 em 0.3%.
Tier da 1ª linha: A 19.2% (esperado 19.2%) · B 37.4% (esperado 37.4%) · C 43.4% (esperado 43.4%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 32.2% | 32.2% |
| 2-1-2 | 36.3% | 36.3% |
| 2-2-1 | 31.5% | 31.6% |

Parte dos listados: cupula 33.6% · bancada 32.8% · arquivo 33.7% · 1ª linha: cupula 33.5% · bancada 32.8% · arquivo 33.7%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.9% · borda 2.325:1 · sósias por objeto 0.982 · objetos abaixo de 80% visíveis por rodada 1.596 (máx. 4).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 12.2% | 12.2% | -0.18 | 2.0% | — |
| pipa | A | cupula | 15.1% | 15.1% | 0.02 | 2.5% | — |
| luneta | B | cupula | 22.7% | 22.7% | 0.79 | 3.8% | — |
| pantufas | B | cupula | 26.3% | 26.2% | -1.51 | 4.3% | — |
| oculos | C | cupula | 23.2% | 23.3% | 0.43 | 3.9% | — |
| ratinho | C | cupula | 18.7% | 18.6% | -1.71 | 3.1% | — |
| caneca | C | cupula | 19.8% | 19.8% | 0.49 | 3.3% | — |
| ferradura | B | cupula | 23.9% | 24.0% | 0.94 | 4.0% | — |
| sistema-solar | A | bancada | 18.1% | 18.1% | -0.45 | 3.0% | — |
| vela | A | bancada | 15.3% | 15.3% | 0.78 | 2.6% | — |
| compasso | B | bancada | 28.8% | 28.8% | -0.22 | 4.8% | — |
| bule | B | bancada | 28.2% | 28.2% | 0.79 | 4.7% | — |
| sino | C | bancada | 23.8% | 23.8% | 1.54 | 3.9% | — |
| maca | C | bancada | 16.9% | 16.9% | -1.67 | 2.8% | — |
| esquadro | C | bancada | 21.3% | 21.4% | 0.44 | 3.6% | — |
| violino | A | arquivo | 14.6% | 14.6% | 0.22 | 2.4% | — |
| gramofone | A | arquivo | 14.3% | 14.3% | -0.14 | 2.4% | — |
| microscopio | B | arquivo | 25.4% | 25.4% | 0.38 | 4.2% | — |
| gato | B | arquivo | 25.9% | 25.8% | -0.49 | 4.3% | — |
| balanca | C | arquivo | 21.6% | 21.6% | -0.39 | 3.6% | — |
| leque | C | arquivo | 18.3% | 18.3% | -1.2 | 3.1% | — |
| cavalo-marinho | C | arquivo | 22.2% | 22.2% | 0.53 | 3.7% | — |
| cadeado | C | arquivo | 18.6% | 18.7% | 0.9 | 3.1% | — |
| foguete | C | cupula | 38.0% | 38.0% | 0.56 | 6.4% | — |
| ioio | C | bancada | 47.5% | 47.4% | -1.14 | 7.9% | — |
| tambor | C | arquivo | 39.0% | 39.0% | 0.15 | 6.5% | — |

Tiers por rodada: A1 B2 C3 em 46.5%; A1 B1 C4 em 36.1%; A1 B3 C2 em 5.7%; A0 B4 C2 em 4.1%; A0 B3 C3 em 6.2%; A1 B0 C5 em 1.3%; A0 B2 C4 em 0.1%.
Tier da 1ª linha: A 14.9% (esperado 14.9%) · B 30.2% (esperado 30.2%) · C 54.9% (esperado 54.9%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.3% · bancada 33.3% · arquivo 33.4%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 82.7% · borda 2.364:1 · sósias por objeto 1.025 · objetos abaixo de 80% visíveis por rodada 2.533 (máx. 5).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| pipa | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| luneta | B | cupula | 51.1% | 51.0% | -1.32 | 6.4% | — |
| pantufas | B | cupula | 33.3% | 33.3% | 0.38 | 4.2% | — |
| oculos | C | cupula | 34.4% | 34.4% | 0.27 | 4.3% | — |
| ratinho | C | cupula | 52.2% | 52.2% | -0.39 | 6.5% | — |
| caneca | C | cupula | 34.4% | 34.4% | -0.19 | 4.3% | — |
| ferradura | B | cupula | 13.7% | 13.7% | -0.05 | 1.7% | — |
| sistema-solar | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| vela | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| compasso | B | bancada | 34.7% | 34.8% | 1.06 | 4.3% | — |
| bule | B | bancada | 34.7% | 34.7% | -0.76 | 4.3% | — |
| sino | C | bancada | 35.9% | 35.9% | 0.4 | 4.5% | — |
| maca | C | bancada | 54.3% | 54.4% | 1.58 | 6.8% | — |
| esquadro | C | bancada | 54.3% | 54.3% | -0.68 | 6.8% | — |
| violino | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gramofone | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| microscopio | B | arquivo | 33.0% | 33.0% | 0.01 | 4.1% | — |
| gato | B | arquivo | 33.0% | 33.0% | -0.03 | 4.1% | — |
| balanca | C | arquivo | 34.2% | 34.2% | -0.14 | 4.3% | — |
| leque | C | arquivo | 34.2% | 34.2% | -0.3 | 4.3% | — |
| cavalo-marinho | C | arquivo | 34.2% | 34.2% | -0.4 | 4.3% | — |
| cadeado | C | arquivo | 51.5% | 51.5% | 0.23 | 6.5% | — |
| foguete | C | cupula | 48.2% | 48.3% | 1.3 | 6.0% | — |
| ioio | C | bancada | 50.9% | 50.8% | -1.56 | 6.3% | — |
| tambor | C | arquivo | 47.7% | 47.7% | 0.58 | 5.9% | — |

Tiers por rodada: A0 B2 C6 em 36.0%; A0 B0 C8 em 2.8%; A0 B1 C7 em 17.1%; A0 B3 C5 em 32.0%; A0 B4 C4 em 12.1%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 29.2% (esperado 29.2%) · C 70.8% (esperado 70.8%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 32.6% | 32.6% |
| 3-2-3 | 35.2% | 35.2% |
| 3-3-2 | 32.2% | 32.2% |

Parte dos listados: cupula 33.4% · bancada 33.1% · arquivo 33.5% · 1ª linha: cupula 33.4% · bancada 33.1% · arquivo 33.5%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 78.8% · borda 2.126:1 · sósias por objeto 1.312 · objetos abaixo de 80% visíveis por rodada 4.276 (máx. 8).

## A sala como cada exploração a joga (GAME03-REPLAYABILITY-05)

As tabelas acima são a sala como foi pintada (cada coisa no seu primeiro lugar), com a seleção do produto.
Aqui, a seleção real (`selectRound`): cada semente compõe o seu layout e sorteia entre as rodadas válidas dele — 30.000 sementes por dificuldade;
nas primeiras 500, as rodadas válidas de cada layout são enumeradas: a rodada sorteada deve ser uniforme entre elas (posto aleatorizado: χ² e KS) e cada objeto, listado tanto quanto as probabilidades exatas de cada layout dizem.

| Dificuldade | Explorações | Layouts distintos | Inválidas | Fallbacks | Rodadas válidas por layout (mín–média–máx) | Posto: χ² (z) · KS (√n·D) | maior \|z\| por objeto | Visível medido |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 30000 | 30000 | 0 | 0 | 303–1290–1840 | 0.63 · 0.8 | 2.51 | 88.2% |
| Médio | 30000 | 30000 | 0 | 0 | 1964–3608–4807 | -0.69 · 0.82 | 2.2 | 85.7% |
| Difícil | 30000 | 30000 | 0 | 0 | 2562–9716–19489 | -0.56 · 0.6 | 1.8 | 82.6% |

### Fácil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | sim | 11.2% | 2.4% | 11.4% | 10.2% | -0.85 |
| pipa | sim | 13.7% | 2.8% | 14.2% | 16.8% | 1.67 |
| luneta | sim | 25.3% | 5.0% | 25.0% | 29.0% | 2.06 |
| pantufas | sim | 21.0% | 4.2% | 20.7% | 21.4% | 0.39 |
| oculos | sim | 23.8% | 4.9% | 24.1% | 21.0% | -1.6 |
| ratinho | sim | 17.4% | 3.5% | 17.3% | 17.4% | 0.08 |
| caneca | sim | 19.4% | 4.0% | 19.3% | 20.2% | 0.53 |
| ferradura | sim | 20.0% | 4.0% | 20.0% | 17.8% | -1.24 |
| sistema-solar | sim | 15.2% | 3.1% | 15.3% | 14.6% | -0.45 |
| vela | sim | 11.7% | 2.1% | 11.1% | 14.6% | 2.51 |
| compasso | sim | 21.4% | 4.3% | 21.9% | 21.4% | -0.25 |
| bule | sim | 30.5% | 5.9% | 30.7% | 31.8% | 0.56 |
| sino | sim | 26.7% | 5.5% | 26.5% | 25.4% | -0.57 |
| maca | sim | 17.7% | 3.6% | 18.0% | 15.8% | -1.3 |
| esquadro | sim | 23.2% | 4.8% | 22.5% | 21.4% | -0.58 |
| violino | sim | 13.0% | 2.5% | 13.2% | 12.2% | -0.64 |
| gramofone | sim | 12.8% | 2.6% | 12.7% | 12.8% | 0.08 |
| microscopio | sim | 28.5% | 5.7% | 28.1% | 27.0% | -0.55 |
| gato | sim | 18.8% | 3.8% | 18.9% | 19.0% | 0.04 |
| balanca | sim | 24.2% | 4.9% | 24.1% | 26.2% | 1.1 |
| leque | sim | 17.1% | 3.3% | 17.0% | 17.8% | 0.45 |
| cavalo-marinho | sim | 22.8% | 4.5% | 23.0% | 20.0% | -1.59 |
| cadeado | sim | 17.2% | 3.5% | 17.3% | 15.6% | -0.98 |
| foguete | sim | 14.5% | 2.9% | 14.4% | 13.2% | -0.78 |
| ioio | sim | 19.4% | 3.7% | 19.7% | 21.8% | 1.19 |
| tambor | sim | 13.9% | 2.6% | 13.8% | 15.6% | 1.15 |

Tiers (todas as linhas): A 19.2% · B 43.2% · C 37.6% · estação da 1ª linha: cupula 33.7% · bancada 33.0% · arquivo 33.3%.

### Médio nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | sim | 11.9% | 1.9% | 12.2% | 11.2% | -0.71 |
| pipa | sim | 10.3% | 1.7% | 10.4% | 11.8% | 1.02 |
| luneta | sim | 25.3% | 4.2% | 25.1% | 24.0% | -0.56 |
| pantufas | sim | 19.0% | 3.2% | 19.1% | 20.0% | 0.5 |
| oculos | sim | 26.3% | 4.4% | 25.9% | 23.6% | -1.15 |
| ratinho | sim | 23.4% | 3.8% | 23.2% | 23.0% | -0.09 |
| caneca | sim | 23.6% | 4.1% | 23.8% | 24.0% | 0.12 |
| ferradura | sim | 18.7% | 3.2% | 18.8% | 19.8% | 0.59 |
| sistema-solar | sim | 14.5% | 2.3% | 14.5% | 12.0% | -1.57 |
| vela | sim | 12.7% | 2.1% | 12.7% | 12.4% | -0.21 |
| compasso | sim | 22.5% | 3.9% | 22.9% | 23.6% | 0.37 |
| bule | sim | 28.6% | 4.8% | 28.6% | 33.0% | 2.2 |
| sino | sim | 27.2% | 4.5% | 27.0% | 25.6% | -0.7 |
| maca | sim | 22.3% | 3.6% | 22.3% | 21.8% | -0.29 |
| esquadro | sim | 26.1% | 4.3% | 25.9% | 24.4% | -0.75 |
| violino | sim | 9.9% | 1.7% | 10.0% | 9.2% | -0.6 |
| gramofone | sim | 11.5% | 1.9% | 11.4% | 12.2% | 0.57 |
| microscopio | sim | 24.6% | 4.3% | 24.8% | 24.2% | -0.32 |
| gato | sim | 18.2% | 3.1% | 18.1% | 20.4% | 1.34 |
| balanca | sim | 24.8% | 4.1% | 24.6% | 24.0% | -0.3 |
| leque | sim | 22.9% | 3.9% | 22.7% | 22.6% | -0.05 |
| cavalo-marinho | sim | 24.9% | 4.2% | 25.1% | 24.8% | -0.15 |
| cadeado | sim | 22.8% | 3.9% | 22.9% | 22.6% | -0.18 |
| foguete | sim | 41.5% | 7.1% | 41.6% | 42.6% | 0.46 |
| ioio | sim | 46.0% | 7.5% | 46.2% | 47.2% | 0.46 |
| tambor | sim | 40.3% | 6.5% | 40.4% | 40.0% | -0.17 |

Tiers (todas as linhas): A 15.0% · B 36.4% · C 48.7% · estação da 1ª linha: cupula 33.6% · bancada 32.9% · arquivo 33.5%.

### Difícil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| pipa | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| luneta | sim | 48.4% | 6.1% | 48.0% | 51.2% | 1.45 |
| pantufas | sim | 18.7% | 2.2% | 18.4% | 17.8% | -0.41 |
| oculos | sim | 36.9% | 4.8% | 37.5% | 37.2% | -0.15 |
| ratinho | sim | 57.0% | 7.2% | 57.6% | 55.2% | -1.09 |
| caneca | sim | 42.5% | 5.3% | 42.7% | 40.2% | -1.14 |
| ferradura | sim | 9.0% | 1.2% | 8.3% | 9.0% | 0.6 |
| sistema-solar | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| vela | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| compasso | sim | 24.9% | 3.3% | 25.0% | 25.2% | 0.12 |
| bule | sim | 37.6% | 4.7% | 37.4% | 37.6% | 0.1 |
| sino | sim | 40.3% | 5.0% | 40.0% | 40.2% | 0.09 |
| maca | sim | 54.6% | 6.8% | 54.4% | 57.0% | 1.19 |
| esquadro | sim | 54.6% | 6.8% | 54.6% | 54.2% | -0.17 |
| violino | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| gramofone | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| microscopio | sim | 32.3% | 4.0% | 31.9% | 28.2% | -1.8 |
| gato | sim | 17.1% | 2.2% | 17.6% | 16.8% | -0.54 |
| balanca | sim | 36.3% | 4.6% | 35.4% | 35.2% | -0.12 |
| leque | sim | 39.7% | 4.8% | 40.3% | 40.4% | 0.03 |
| cavalo-marinho | sim | 39.7% | 5.2% | 40.1% | 43.2% | 1.44 |
| cadeado | sim | 54.3% | 6.6% | 54.2% | 52.6% | -0.71 |
| foguete | sim | 53.8% | 6.7% | 54.4% | 56.4% | 0.89 |
| ioio | sim | 51.2% | 6.4% | 51.2% | 50.0% | -0.56 |
| tambor | sim | 51.1% | 6.3% | 50.9% | 52.4% | 0.67 |

Tiers (todas as linhas): A 0.0% · B 37.5% · C 62.5% · estação da 1ª linha: cupula 33.4% · bancada 32.9% · arquivo 33.7%.

Nenhum invariante falhou.
