# Estúdio das Descobertas · Observatório do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v4`, plate `7e1a3158d1e8…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 26 objetos · tiers A6 B7 C13 · Cúpula 9, Bancada 8, Arquivo 9.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 26 | 1327 | 1327 | 0.78 | 2.03 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 26 | 4027 | 4027 | 0.69 | 1.71 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 20 | 19414 | 19414 | -0.19 | 1.58 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 11.8% | 11.8% | 2.03 | 2.4% | — |
| pipa | A | cupula | 19.1% | 19.2% | 0.38 | 3.8% | — |
| luneta | B | cupula | 20.3% | 20.3% | -1.03 | 4.1% | — |
| pantufas | B | cupula | 27.7% | 27.7% | 0.22 | 5.5% | — |
| oculos | C | cupula | 20.3% | 20.3% | 1.72 | 4.1% | — |
| ratinho | C | cupula | 15.9% | 15.9% | 0.37 | 3.2% | — |
| caneca | C | cupula | 16.4% | 16.4% | -0.42 | 3.3% | — |
| ferradura | B | cupula | 24.0% | 24.0% | -1.31 | 4.8% | — |
| sistema-solar | A | bancada | 16.9% | 16.9% | 0.57 | 3.4% | — |
| vela | A | bancada | 16.0% | 16.0% | -0.42 | 3.2% | — |
| compasso | B | bancada | 30.1% | 30.2% | 0.45 | 6.0% | — |
| bule | B | bancada | 30.3% | 30.4% | 1.43 | 6.0% | — |
| sino | C | bancada | 22.0% | 21.9% | -1.21 | 4.4% | — |
| maca | C | bancada | 11.8% | 11.8% | 0.09 | 2.4% | — |
| esquadro | C | bancada | 18.8% | 18.8% | -0.22 | 3.8% | — |
| violino | A | arquivo | 17.7% | 17.7% | -1.05 | 3.5% | — |
| gramofone | A | arquivo | 14.6% | 14.6% | -1.47 | 2.9% | — |
| microscopio | B | arquivo | 27.4% | 27.3% | -0.64 | 5.5% | — |
| gato | B | arquivo | 26.8% | 26.9% | 1.61 | 5.4% | — |
| balanca | C | arquivo | 19.0% | 19.0% | 0.87 | 3.8% | — |
| leque | C | arquivo | 15.0% | 15.0% | 0.17 | 3.0% | — |
| cavalo-marinho | C | arquivo | 19.2% | 19.2% | -1.17 | 3.8% | — |
| cadeado | C | arquivo | 15.5% | 15.6% | 0.78 | 3.1% | — |
| foguete | C | cupula | 12.4% | 12.3% | -0.6 | 2.5% | — |
| ioio | C | bancada | 17.9% | 17.8% | -0.75 | 3.6% | — |
| tambor | C | arquivo | 13.0% | 13.0% | -0.61 | 2.6% | — |

Tiers por rodada: A1 B1 C3 em 28.2%; A1 B2 C2 em 60.4%; A1 B3 C1 em 7.5%; A0 B4 C1 em 3.6%; A0 B3 C2 em 0.3%.
Tier da 1ª linha: A 19.3% (esperado 19.2%) · B 37.4% (esperado 37.4%) · C 43.4% (esperado 43.4%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 32.0% | 32.0% |
| 2-1-2 | 36.3% | 36.2% |
| 2-2-1 | 31.7% | 31.8% |

Parte dos listados: cupula 33.6% · bancada 32.8% · arquivo 33.7% · 1ª linha: cupula 33.6% · bancada 32.8% · arquivo 33.7%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.9% · borda 2.325:1 · sósias por objeto 0.982 · objetos abaixo de 80% visíveis por rodada 1.595 (máx. 4).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 12.1% | 12.1% | -0.16 | 2.0% | — |
| pipa | A | cupula | 15.1% | 15.1% | 0.03 | 2.5% | — |
| luneta | B | cupula | 22.8% | 22.8% | 0.66 | 3.8% | — |
| pantufas | B | cupula | 26.3% | 26.2% | -1.55 | 4.3% | — |
| oculos | C | cupula | 23.3% | 23.3% | 0.5 | 3.9% | — |
| ratinho | C | cupula | 18.6% | 18.5% | -1.7 | 3.1% | — |
| caneca | C | cupula | 19.9% | 20.0% | 0.52 | 3.3% | — |
| ferradura | B | cupula | 23.9% | 24.0% | 1.01 | 4.0% | — |
| sistema-solar | A | bancada | 18.1% | 18.1% | -0.44 | 3.0% | — |
| vela | A | bancada | 15.3% | 15.4% | 0.65 | 2.6% | — |
| compasso | B | bancada | 28.8% | 28.7% | -0.19 | 4.8% | — |
| bule | B | bancada | 28.2% | 28.2% | 0.89 | 4.7% | — |
| sino | C | bancada | 23.7% | 23.8% | 1.63 | 3.9% | — |
| maca | C | bancada | 17.0% | 17.0% | -1.71 | 2.9% | — |
| esquadro | C | bancada | 21.4% | 21.4% | 0.32 | 3.6% | — |
| violino | A | arquivo | 14.6% | 14.6% | 0.29 | 2.4% | — |
| gramofone | A | arquivo | 14.3% | 14.3% | -0.14 | 2.4% | — |
| microscopio | B | arquivo | 25.4% | 25.4% | 0.2 | 4.3% | — |
| gato | B | arquivo | 25.8% | 25.8% | -0.53 | 4.3% | — |
| balanca | C | arquivo | 21.6% | 21.6% | -0.54 | 3.6% | — |
| leque | C | arquivo | 18.4% | 18.3% | -1.04 | 3.1% | — |
| cavalo-marinho | C | arquivo | 22.2% | 22.3% | 0.56 | 3.7% | — |
| cadeado | C | arquivo | 18.7% | 18.7% | 1.04 | 3.1% | — |
| foguete | C | cupula | 38.0% | 38.1% | 0.54 | 6.4% | — |
| ioio | C | bancada | 47.5% | 47.4% | -1.13 | 7.9% | — |
| tambor | C | arquivo | 39.0% | 39.0% | 0.16 | 6.5% | — |

Tiers por rodada: A1 B2 C3 em 46.5%; A1 B1 C4 em 36.2%; A1 B3 C2 em 5.7%; A0 B4 C2 em 4.1%; A0 B3 C3 em 6.2%; A1 B0 C5 em 1.3%; A0 B2 C4 em 0.1%.
Tier da 1ª linha: A 14.9% (esperado 14.9%) · B 30.2% (esperado 30.2%) · C 54.9% (esperado 54.9%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.3% · bancada 33.3% · arquivo 33.3%.

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
| Fácil | 30000 | 30000 | 0 | 0 | 317–1303–1837 | 0.78 · 1.1 | 2.55 | 88.4% |
| Médio | 30000 | 30000 | 0 | 0 | 1961–3623–4797 | -0.99 · 0.77 | 1.84 | 86.0% |
| Difícil | 30000 | 30000 | 0 | 0 | 2562–9709–19489 | -0.53 · 0.6 | 1.79 | 83.2% |

### Fácil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | sim | 11.2% | 2.3% | 11.4% | 9.8% | -1.13 |
| pipa | sim | 13.6% | 2.8% | 14.1% | 16.2% | 1.35 |
| luneta | sim | 25.1% | 5.0% | 24.9% | 29.8% | 2.55 |
| pantufas | sim | 20.8% | 4.1% | 20.6% | 21.2% | 0.34 |
| oculos | sim | 23.7% | 4.8% | 23.9% | 20.4% | -1.84 |
| ratinho | sim | 18.3% | 3.7% | 18.2% | 19.2% | 0.6 |
| caneca | sim | 19.4% | 4.0% | 19.2% | 20.4% | 0.69 |
| ferradura | sim | 19.9% | 4.0% | 19.9% | 18.4% | -0.85 |
| sistema-solar | sim | 15.2% | 3.1% | 15.3% | 14.6% | -0.43 |
| vela | sim | 11.8% | 2.1% | 11.3% | 14.8% | 2.53 |
| compasso | sim | 21.4% | 4.3% | 21.8% | 21.8% | -0.01 |
| bule | sim | 30.4% | 5.8% | 30.6% | 31.6% | 0.5 |
| sino | sim | 26.7% | 5.6% | 26.5% | 25.0% | -0.78 |
| maca | sim | 17.8% | 3.6% | 18.0% | 15.8% | -1.31 |
| esquadro | sim | 23.0% | 4.7% | 22.4% | 20.6% | -0.95 |
| violino | sim | 12.8% | 2.5% | 13.0% | 11.0% | -1.35 |
| gramofone | sim | 12.8% | 2.6% | 12.8% | 13.2% | 0.29 |
| microscopio | sim | 28.5% | 5.7% | 28.1% | 27.0% | -0.54 |
| gato | sim | 18.9% | 3.8% | 19.0% | 20.6% | 0.94 |
| balanca | sim | 24.2% | 4.9% | 24.1% | 26.2% | 1.1 |
| leque | sim | 17.0% | 3.2% | 17.0% | 17.4% | 0.25 |
| cavalo-marinho | sim | 22.8% | 4.5% | 23.0% | 20.0% | -1.61 |
| cadeado | sim | 17.0% | 3.5% | 17.2% | 15.4% | -1.05 |
| foguete | sim | 14.5% | 3.0% | 14.3% | 13.0% | -0.86 |
| ioio | sim | 19.4% | 3.7% | 19.7% | 21.4% | 0.97 |
| tambor | sim | 13.9% | 2.6% | 13.9% | 15.2% | 0.87 |

Tiers (todas as linhas): A 19.2% · B 43.1% · C 37.7% · estação da 1ª linha: cupula 33.7% · bancada 33.0% · arquivo 33.4%.

### Médio nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | sim | 11.9% | 1.9% | 12.2% | 11.4% | -0.56 |
| pipa | sim | 10.2% | 1.7% | 10.3% | 11.4% | 0.79 |
| luneta | sim | 25.2% | 4.2% | 25.0% | 24.0% | -0.52 |
| pantufas | sim | 18.9% | 3.2% | 19.1% | 20.2% | 0.65 |
| oculos | sim | 26.2% | 4.4% | 25.8% | 23.6% | -1.13 |
| ratinho | sim | 23.8% | 3.9% | 23.5% | 23.0% | -0.26 |
| caneca | sim | 23.5% | 4.1% | 23.8% | 23.8% | 0.02 |
| ferradura | sim | 18.6% | 3.2% | 18.7% | 20.2% | 0.85 |
| sistema-solar | sim | 14.6% | 2.3% | 14.5% | 12.0% | -1.59 |
| vela | sim | 12.8% | 2.1% | 12.8% | 12.4% | -0.25 |
| compasso | sim | 22.5% | 3.9% | 22.9% | 24.4% | 0.8 |
| bule | sim | 28.6% | 4.8% | 28.5% | 32.2% | 1.84 |
| sino | sim | 27.1% | 4.5% | 27.0% | 25.6% | -0.69 |
| maca | sim | 22.4% | 3.6% | 22.4% | 21.4% | -0.54 |
| esquadro | sim | 26.0% | 4.3% | 25.9% | 24.0% | -0.95 |
| violino | sim | 9.8% | 1.7% | 9.9% | 9.0% | -0.68 |
| gramofone | sim | 11.5% | 1.9% | 11.4% | 11.8% | 0.3 |
| microscopio | sim | 24.6% | 4.2% | 24.7% | 24.4% | -0.18 |
| gato | sim | 18.2% | 3.1% | 18.1% | 20.2% | 1.23 |
| balanca | sim | 24.9% | 4.1% | 24.6% | 24.8% | 0.12 |
| leque | sim | 23.0% | 3.9% | 22.7% | 22.2% | -0.29 |
| cavalo-marinho | sim | 25.0% | 4.1% | 25.1% | 25.2% | 0.03 |
| cadeado | sim | 22.8% | 3.9% | 23.0% | 22.6% | -0.2 |
| foguete | sim | 41.6% | 7.1% | 41.6% | 42.4% | 0.37 |
| ioio | sim | 46.0% | 7.5% | 46.1% | 48.0% | 0.85 |
| tambor | sim | 40.3% | 6.5% | 40.5% | 39.8% | -0.3 |

Tiers (todas as linhas): A 14.9% · B 36.3% · C 48.8% · estação da 1ª linha: cupula 33.7% · bancada 32.9% · arquivo 33.5%.

### Difícil nos layouts

| Objeto | Pedido na sala pintada | Medido (todas as sementes) | 1ª linha | Exato nos layouts | Observado | z |
| --- | --- | --- | --- | --- | --- | --- |
| coruja | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| pipa | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| luneta | sim | 48.4% | 6.1% | 48.0% | 51.2% | 1.45 |
| pantufas | sim | 18.7% | 2.2% | 18.4% | 17.8% | -0.4 |
| oculos | sim | 36.9% | 4.8% | 37.5% | 37.2% | -0.15 |
| ratinho | sim | 57.0% | 7.2% | 57.6% | 55.2% | -1.08 |
| caneca | sim | 42.5% | 5.3% | 42.7% | 40.2% | -1.15 |
| ferradura | sim | 9.0% | 1.2% | 8.3% | 9.0% | 0.6 |
| sistema-solar | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| vela | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| compasso | sim | 24.9% | 3.3% | 25.0% | 25.2% | 0.12 |
| bule | sim | 37.6% | 4.7% | 37.4% | 37.6% | 0.1 |
| sino | sim | 40.2% | 5.0% | 40.0% | 40.2% | 0.09 |
| maca | sim | 54.6% | 6.8% | 54.4% | 57.0% | 1.19 |
| esquadro | sim | 54.6% | 6.8% | 54.6% | 54.2% | -0.18 |
| violino | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| gramofone | não | 0.0% | 0.0% | 0.0% | 0.0% | 0 |
| microscopio | sim | 32.3% | 4.0% | 31.9% | 28.2% | -1.79 |
| gato | sim | 17.1% | 2.2% | 17.6% | 16.8% | -0.53 |
| balanca | sim | 36.3% | 4.6% | 35.4% | 35.2% | -0.12 |
| leque | sim | 39.8% | 4.8% | 40.4% | 40.4% | 0.02 |
| cavalo-marinho | sim | 39.6% | 5.2% | 40.0% | 43.2% | 1.45 |
| cadeado | sim | 54.3% | 6.6% | 54.2% | 52.6% | -0.72 |
| foguete | sim | 53.8% | 6.7% | 54.4% | 56.4% | 0.89 |
| ioio | sim | 51.2% | 6.3% | 51.2% | 50.0% | -0.56 |
| tambor | sim | 51.1% | 6.3% | 50.9% | 52.4% | 0.67 |

Tiers (todas as linhas): A 0.0% · B 37.5% · C 62.5% · estação da 1ª linha: cupula 33.4% · bancada 32.9% · arquivo 33.7%.

Nenhum invariante falhou.
