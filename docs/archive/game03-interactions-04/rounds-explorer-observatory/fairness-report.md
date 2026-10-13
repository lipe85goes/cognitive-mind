# Estúdio das Descobertas · Observatório do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v3`, plate `71c34eabd464…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 26 objetos · tiers A6 B7 C13 · Cúpula 9, Bancada 8, Arquivo 9.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A0–1 B0–5 C1–5 | 26 | 1343 | 1343 | 0.03 | 2.65 |
| Médio | clue (associative) | 6 | A0–1 B0–6 C2–6 | 26 | 4053 | 4053 | 2.16 | 1.82 |
| Difícil | clue (indirect) | 8 | A0–0 B0–4 C4–8 | 20 | 19413 | 19413 | -0.55 | 2.51 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 12.4% | 12.4% | 0.62 | 2.5% | — |
| pipa | A | cupula | 18.8% | 18.9% | 1.87 | 3.8% | — |
| luneta | B | cupula | 20.0% | 20.0% | -0.78 | 4.0% | — |
| pantufas | B | cupula | 28.1% | 28.0% | -0.59 | 5.6% | — |
| oculos | C | cupula | 19.7% | 19.7% | -0.65 | 3.9% | — |
| ratinho | C | cupula | 15.9% | 15.9% | 0.1 | 3.2% | — |
| caneca | C | cupula | 16.8% | 16.8% | 0.18 | 3.4% | — |
| ferradura | B | cupula | 24.4% | 24.4% | -0.01 | 4.9% | — |
| sistema-solar | A | bancada | 16.8% | 16.7% | -1.52 | 3.4% | — |
| vela | A | bancada | 15.8% | 15.8% | -0.8 | 3.2% | — |
| compasso | B | bancada | 29.9% | 29.9% | -1.11 | 6.0% | — |
| bule | B | bancada | 29.7% | 29.7% | -0.48 | 5.9% | — |
| sino | C | bancada | 22.0% | 22.1% | 1.11 | 4.5% | — |
| maca | C | bancada | 11.4% | 11.4% | -0.91 | 2.3% | — |
| esquadro | C | bancada | 19.7% | 19.8% | 2.65 | 4.0% | — |
| violino | A | arquivo | 18.1% | 18.1% | 0.87 | 3.6% | — |
| gramofone | A | arquivo | 14.0% | 14.0% | -0.99 | 2.8% | — |
| microscopio | B | arquivo | 27.3% | 27.3% | 0.89 | 5.5% | — |
| gato | B | arquivo | 26.9% | 26.8% | -0.84 | 5.3% | — |
| balanca | C | arquivo | 19.3% | 19.3% | 0.33 | 3.8% | — |
| leque | C | arquivo | 15.0% | 14.9% | -2.54 | 3.0% | — |
| cavalo-marinho | C | arquivo | 19.3% | 19.4% | 1.67 | 3.9% | — |
| cadeado | C | arquivo | 15.9% | 15.9% | 0.48 | 3.2% | — |
| foguete | C | cupula | 12.0% | 12.0% | -0.88 | 2.4% | — |
| ioio | C | bancada | 17.9% | 17.9% | 0.81 | 3.6% | — |
| tambor | C | arquivo | 13.0% | 13.0% | 0.2 | 2.6% | — |

Tiers por rodada: A1 B2 C2 em 60.0%; A1 B1 C3 em 28.8%; A0 B4 C1 em 3.7%; A1 B3 C1 em 7.1%; A0 B3 C2 em 0.5%.
Tier da 1ª linha: A 19.2% (esperado 19.2%) · B 37.2% (esperado 37.3%) · C 43.5% (esperado 43.6%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 31.9% | 31.9% |
| 2-1-2 | 36.8% | 36.8% |
| 2-2-1 | 31.4% | 31.3% |

Parte dos listados: cupula 33.6% · bancada 32.6% · arquivo 33.7% · 1ª linha: cupula 33.6% · bancada 32.7% · arquivo 33.7%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 85.3% · borda 2.333:1 · sósias por objeto 0.983 · objetos abaixo de 80% visíveis por rodada 1.592 (máx. 4).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 12.3% | 12.3% | -0.23 | 2.0% | — |
| pipa | A | cupula | 15.0% | 15.0% | 0.8 | 2.5% | — |
| luneta | B | cupula | 23.0% | 23.1% | 0.77 | 3.9% | — |
| pantufas | B | cupula | 26.1% | 26.1% | 0.69 | 4.4% | — |
| oculos | C | cupula | 23.1% | 23.0% | -0.86 | 3.8% | — |
| ratinho | C | cupula | 18.5% | 18.5% | 0.27 | 3.1% | — |
| caneca | C | cupula | 19.7% | 19.6% | -0.55 | 3.3% | — |
| ferradura | B | cupula | 24.1% | 24.1% | -0.79 | 4.0% | — |
| sistema-solar | A | bancada | 18.1% | 18.2% | 0.54 | 3.0% | — |
| vela | A | bancada | 15.3% | 15.3% | -1.82 | 2.6% | — |
| compasso | B | bancada | 28.6% | 28.7% | 1.29 | 4.8% | — |
| bule | B | bancada | 27.9% | 28.0% | 1.02 | 4.7% | — |
| sino | C | bancada | 23.5% | 23.5% | -0.61 | 3.9% | — |
| maca | C | bancada | 17.0% | 16.9% | -0.71 | 2.8% | — |
| esquadro | C | bancada | 22.3% | 22.3% | -1.34 | 3.7% | — |
| violino | A | arquivo | 14.8% | 14.8% | 0.1 | 2.5% | — |
| gramofone | A | arquivo | 14.2% | 14.2% | 0.48 | 2.4% | — |
| microscopio | B | arquivo | 25.3% | 25.3% | -1.52 | 4.2% | — |
| gato | B | arquivo | 25.9% | 25.9% | 0.21 | 4.3% | — |
| balanca | C | arquivo | 21.5% | 21.5% | 0.41 | 3.6% | — |
| leque | C | arquivo | 18.3% | 18.3% | 0.77 | 3.0% | — |
| cavalo-marinho | C | arquivo | 22.5% | 22.5% | 1.02 | 3.7% | — |
| cadeado | C | arquivo | 18.5% | 18.5% | -0.18 | 3.1% | — |
| foguete | C | cupula | 38.2% | 38.2% | -0.04 | 6.4% | — |
| ioio | C | bancada | 47.2% | 47.2% | 0.99 | 7.9% | — |
| tambor | C | arquivo | 39.0% | 39.0% | -0.94 | 6.5% | — |

Tiers por rodada: A1 B1 C4 em 36.0%; A1 B2 C3 em 46.7%; A0 B4 C2 em 4.0%; A0 B3 C3 em 6.1%; A1 B3 C2 em 5.7%; A1 B0 C5 em 1.4%; A0 B2 C4 em 0.1%.
Tier da 1ª linha: A 14.9% (esperado 15.0%) · B 30.3% (esperado 30.2%) · C 54.8% (esperado 54.9%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.4% · bancada 33.3% · arquivo 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 83.0% · borda 2.368:1 · sósias por objeto 1.026 · objetos abaixo de 80% visíveis por rodada 2.541 (máx. 5).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| pipa | A | cupula | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| luneta | B | cupula | 51.1% | 51.1% | 0.14 | 6.4% | — |
| pantufas | B | cupula | 33.3% | 33.2% | -1.45 | 4.1% | — |
| oculos | C | cupula | 34.4% | 34.5% | 1.01 | 4.3% | — |
| ratinho | C | cupula | 52.2% | 52.2% | -0.51 | 6.5% | — |
| caneca | C | cupula | 34.4% | 34.6% | 2.51 | 4.3% | — |
| ferradura | B | cupula | 13.7% | 13.7% | -0.02 | 1.7% | — |
| sistema-solar | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| vela | A | bancada | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| compasso | B | bancada | 34.7% | 34.7% | -0.64 | 4.4% | — |
| bule | B | bancada | 34.7% | 34.8% | 1 | 4.4% | — |
| sino | C | bancada | 35.9% | 35.9% | 0.32 | 4.5% | — |
| maca | C | bancada | 54.3% | 54.3% | -0.14 | 6.8% | — |
| esquadro | C | bancada | 54.3% | 54.4% | 0.41 | 6.8% | — |
| violino | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| gramofone | A | arquivo | nunca (a lista não o mostra) | 0.0% | — | 0.0% | — |
| microscopio | B | arquivo | 33.0% | 33.0% | 0.44 | 4.2% | — |
| gato | B | arquivo | 33.0% | 33.1% | 0.73 | 4.1% | — |
| balanca | C | arquivo | 34.2% | 34.1% | -1.3 | 4.3% | — |
| leque | C | arquivo | 34.2% | 34.3% | 0.99 | 4.3% | — |
| cavalo-marinho | C | arquivo | 34.2% | 34.2% | -0.89 | 4.3% | — |
| cadeado | C | arquivo | 51.5% | 51.4% | -0.89 | 6.5% | — |
| foguete | C | cupula | 48.2% | 48.1% | -1.23 | 6.0% | — |
| ioio | C | bancada | 50.8% | 50.8% | -0.96 | 6.4% | — |
| tambor | C | arquivo | 47.7% | 47.7% | 0.6 | 5.9% | — |

Tiers por rodada: A0 B2 C6 em 35.9%; A0 B3 C5 em 32.1%; A0 B4 C4 em 12.1%; A0 B1 C7 em 17.1%; A0 B0 C8 em 2.8%.
Tier da 1ª linha: A 0.0% (esperado 0.0%) · B 29.2% (esperado 29.2%) · C 70.8% (esperado 70.8%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 32.6% | 32.6% |
| 3-2-3 | 35.2% | 35.2% |
| 3-3-2 | 32.2% | 32.2% |

Parte dos listados: cupula 33.4% · bancada 33.1% · arquivo 33.5% · 1ª linha: cupula 33.4% · bancada 33.1% · arquivo 33.5%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 79.4% · borda 2.127:1 · sósias por objeto 1.312 · objetos abaixo de 80% visíveis por rodada 4.276 (máx. 8).

Nenhum invariante falhou.
