# Estúdio das Descobertas · Observatório do Explorador — relatório de justiça das rodadas

Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.
Cada dificuldade: 1.000.000 explorações simuladas com a seleção real do jogo
(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).
"Exato" é a probabilidade enumerada (toda rodada válida igualmente provável); "medido" é o que as
sementes de fato sortearam. Kit de arte `v1`, plate `9a252cb9bb83…`. Veredito: **ROUND_FAIRNESS_OK**.

Pool: 18 objetos · tiers A6 B6 C6 · Cúpula 6, Bancada 6, Arquivo 6.

| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \|z\| por objeto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | picture | 5 | A3 B2 C0 | 12 | 156 | 156 | -0.41 | 1.25 |
| Médio | silhouette | 6 | A1 B3 C2 | 18 | 312 | 312 | -0.02 | 1.89 |
| Difícil | clue | 8 | A1 B3 C4 | 18 | 768 | 768 | -0.33 | 2.12 |

## Fácil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 50.0% | 50.1% | 1.13 | 10.0% | 1 |
| pipa | A | cupula | 50.0% | 50.0% | 0.38 | 10.0% | 1 |
| luneta | B | cupula | 33.3% | 33.3% | 0.05 | 6.7% | 1 |
| pantufas | B | cupula | 33.3% | 33.3% | -0.31 | 6.6% | 1 |
| oculos | C | cupula | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| ratinho | C | cupula | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| sistema-solar | A | bancada | 50.0% | 49.9% | -1.25 | 10.0% | 1 |
| vela | A | bancada | 50.0% | 50.0% | -0.8 | 10.0% | 1 |
| compasso | B | bancada | 33.3% | 33.4% | 0.62 | 6.7% | 1 |
| bule | B | bancada | 33.3% | 33.4% | 0.99 | 6.7% | 1 |
| sino | C | bancada | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| maca | C | bancada | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| violino | A | arquivo | 50.0% | 50.0% | -0.62 | 10.0% | 1 |
| gramofone | A | arquivo | 50.0% | 50.1% | 1.16 | 10.0% | 1 |
| microscopio | B | arquivo | 33.3% | 33.3% | -0.44 | 6.7% | 1 |
| gato | B | arquivo | 33.3% | 33.3% | -0.91 | 6.7% | 1 |
| balanca | C | arquivo | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |
| leque | C | arquivo | nunca (tier fora da dificuldade) | 0.0% | — | 0.0% | — |

Tiers por rodada: A3 B2 C0 em 100.0%.
Tier da 1ª linha: A 60.0% (esperado 60.0%) · B 40.0% (esperado 40.0%) · C 0.0% (esperado 0.0%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 1-2-2 | 33.3% | 33.3% |
| 2-1-2 | 33.3% | 33.4% |
| 2-2-1 | 33.3% | 33.4% |

Parte dos listados: cupula 33.4% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.3% · bancada 33.4% · arquivo 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 92.6% · borda 2.631:1 · sósias por objeto 0.433 · objetos abaixo de 80% visíveis por rodada 0.667 (máx. 2).

## Médio

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 16.7% | 16.7% | 0.36 | 2.8% | 1 |
| pipa | A | cupula | 16.7% | 16.7% | 0.95 | 2.8% | 1 |
| luneta | B | cupula | 50.0% | 50.0% | -0.99 | 8.3% | 1 |
| pantufas | B | cupula | 50.0% | 50.0% | -0.34 | 8.4% | 1 |
| oculos | C | cupula | 33.3% | 33.4% | 1.56 | 5.6% | 1 |
| ratinho | C | cupula | 33.3% | 33.3% | -1.17 | 5.5% | 1 |
| sistema-solar | A | bancada | 16.7% | 16.7% | -0.51 | 2.8% | 1 |
| vela | A | bancada | 16.7% | 16.7% | 0.67 | 2.8% | 1 |
| compasso | B | bancada | 50.0% | 50.0% | -0.51 | 8.4% | 1 |
| bule | B | bancada | 50.0% | 50.0% | 0.06 | 8.4% | 1 |
| sino | C | bancada | 33.3% | 33.3% | -0.9 | 5.5% | 1 |
| maca | C | bancada | 33.3% | 33.4% | 1.25 | 5.5% | 1 |
| violino | A | arquivo | 16.7% | 16.7% | -0.38 | 2.8% | 1 |
| gramofone | A | arquivo | 16.7% | 16.6% | -1.09 | 2.8% | 1 |
| microscopio | B | arquivo | 50.0% | 50.0% | -0.1 | 8.3% | 1 |
| gato | B | arquivo | 50.0% | 50.1% | 1.89 | 8.3% | 1 |
| balanca | C | arquivo | 33.3% | 33.3% | -1.01 | 5.5% | 1 |
| leque | C | arquivo | 33.3% | 33.4% | 0.27 | 5.5% | 1 |

Tiers por rodada: A1 B3 C2 em 100.0%.
Tier da 1ª linha: A 16.7% (esperado 16.7%) · B 50.0% (esperado 50.0%) · C 33.3% (esperado 33.3%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-2-2 | 100.0% | 100.0% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.4% · bancada 33.3% · arquivo 33.3%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 84.1% · borda 2.221:1 · sósias por objeto 0.778 · objetos abaixo de 80% visíveis por rodada 2 (máx. 4).

## Difícil

Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):

| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coruja | A | cupula | 16.7% | 16.6% | -1.16 | 2.1% | 1 |
| pipa | A | cupula | 16.7% | 16.7% | 0.45 | 2.1% | 1 |
| luneta | B | cupula | 50.0% | 50.0% | 0.43 | 6.3% | 1 |
| pantufas | B | cupula | 50.0% | 50.0% | 0.8 | 6.3% | 1 |
| oculos | C | cupula | 66.7% | 66.7% | 0.93 | 8.3% | 1 |
| ratinho | C | cupula | 66.7% | 66.6% | -0.41 | 8.3% | 1 |
| sistema-solar | A | bancada | 16.7% | 16.7% | -0.01 | 2.1% | 1 |
| vela | A | bancada | 16.7% | 16.7% | 1.06 | 2.1% | 1 |
| compasso | B | bancada | 50.0% | 50.1% | 1.64 | 6.3% | 1 |
| bule | B | bancada | 50.0% | 49.9% | -2.12 | 6.2% | 1 |
| sino | C | bancada | 66.7% | 66.6% | -0.53 | 8.3% | 1 |
| maca | C | bancada | 66.7% | 66.7% | 0.94 | 8.3% | 1 |
| violino | A | arquivo | 16.7% | 16.6% | -0.65 | 2.1% | 1 |
| gramofone | A | arquivo | 16.7% | 16.7% | 0.31 | 2.1% | 1 |
| microscopio | B | arquivo | 50.0% | 49.9% | -1.26 | 6.3% | 1 |
| gato | B | arquivo | 50.0% | 50.0% | 0.52 | 6.3% | 1 |
| balanca | C | arquivo | 66.7% | 66.7% | 0.69 | 8.4% | 1 |
| leque | C | arquivo | 66.7% | 66.6% | -1.62 | 8.3% | 1 |

Tiers por rodada: A1 B3 C4 em 100.0%.
Tier da 1ª linha: A 12.5% (esperado 12.5%) · B 37.5% (esperado 37.5%) · C 50.0% (esperado 50.0%).

Estações (Cúpula-Bancada-Arquivo por rodada; parte dos objetos listados; 1ª linha):

| Padrão J-M-E | Exato | Medido |
| --- | --- | --- |
| 2-3-3 | 33.3% | 33.3% |
| 3-2-3 | 33.3% | 33.3% |
| 3-3-2 | 33.3% | 33.4% |

Parte dos listados: cupula 33.3% · bancada 33.3% · arquivo 33.3% · 1ª linha: cupula 33.3% · bancada 33.3% · arquivo 33.4%.

Carga perceptiva (auditoria medida, média exata das rodadas): visível 82.5% · borda 2.093:1 · sósias por objeto 0.833 · objetos abaixo de 80% visíveis por rodada 3 (máx. 5).

Nenhum invariante falhou.
