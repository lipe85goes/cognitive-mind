# Contrato de `routeCellsHaveEscape`

O gate que hoje responde por 96,2% das rejeições estruturais. Este documento
formaliza o que ele exige e mede se ele está rejeitando o que deveria.
**Nada aqui foi alterado** — a missão é diagnóstica.

## O que o gate promete

Que a rota objetiva não contenha uma célula onde dois defensores possam
transformar um susto em xeque-mate. Ele não fala de estados: fala de **largura
de fuga**, porque ocupação não é parede e um corredor com duas saídas é fechado
por dois corpos.

Regra, por célula da rota objetiva (`objective.cells`):

| condição | escopo |
|---|---|
| `grau >= 2` | toda célula, exceto o início |
| `grau >= 3` | apenas dentro da região de convergência, e o portal é isento |
| partilha bloco biconexo com o Explorador | células do meio (`slice(1, -1)`) |

Região de convergência = células a distância BFS ≤ 3 do portal. É onde a
Sentinela vive e onde o Caçador chega; fora dela o tabuleiro mantém seus
corredores e cantos.

## Relação com o resto

- **objective route** — o gate avalia `objective.cells`, que é a rota escolhida
  por `computeObjectiveRoute`. Uma escolha, não uma propriedade do layout.
  Este é o ponto central da análise abaixo.
- **lights** — as luzes são células da rota, logo estão sujeitas às três regras.
- **portal** — isento da regra ≥3 (senão um portal de canto seria impossível) e
  isento da regra de bloco (é a última célula).
- **alternative route / gate 13** — a terceira condição é a mesma noção de bloco
  biconexo, aplicada às células do meio em vez de às luzes.
- **recovery / degree** — o grau é medido no grafo completo com todas as
  paredes, nunca no subgrafo da rota.

## A propriedade que torna a análise exata

A admissibilidade de uma célula depende **só das paredes**, nunca da rota. Então
defina

```
ADMISSÍVEL = grau >= 2
           ∧ (fora da convergência ∨ grau >= 3 ∨ é o portal)
           ∧ partilha bloco com o Explorador
             (início isento de tudo; portal isento das duas últimas)
```

Uma rota que satisfaz o gate existe **se e somente se** o início, cada luz e o
portal estiverem numa mesma componente conexa do subgrafo induzido em
ADMISSÍVEL — uma caminhada pode repetir células, então conectividade é
necessária e suficiente.

Isso transforma "o gerador poderia ter feito melhor?" numa pergunta decidível,
e não numa impressão.

## Medição — 255 rejeições nas quatro seeds

| classe | contagem | % |
|---|---|---|
| **A** LEGITIMATE_STRUCTURAL_REJECTION | 192 | 75,3% |
| **B** AVOIDABLE_GENERATION_WASTE | 63 | 24,7% |

As 63 testemunhas foram construídas no subgrafo admissível e **confirmadas pelo
`routeCellsHaveEscape` de produção**: 63 verificadas, 0 reprovadas. Não são
hipóteses.

Dimensão do desperdício nos 63 casos B: `objective_route_ordering_or_path_choice`.
Mesmas paredes, mesmas luzes, mesmos limiares — outra ordenação/traçado da rota
objetiva passaria. Nenhum caso B exigiu trocar luzes, saída ou template.

Bloqueador nos 192 casos A: **100% `portal_unreachable_through_admissible_cells`**.
Não é que a rota escolhida foi infeliz — é que o portal não é alcançável por
célula admissível nenhuma. Nenhuma escolha posterior salvaria esses layouts.

## Subtipo da falha: um só

| subtipo | ocorrências |
|---|---|
| `convergence_degree_lt_3` | 797 (100%) |
| `degree_lt_2` | 0 |
| `no_alternative_route` | 0 |

Todas as 797 células ofensoras têm **grau exatamente 2** e estão **dentro** da
região de convergência. A regra de largura ≥3 perto do portal é, sozinha, a
origem de todas as rejeições.

## Por que: a geometria do portal

As células ofensoras se concentram na borda do tabuleiro.

| posição | ocorrências | grau máximo possível |
|---|---|---|
| canto | 107 (13,4%) | **2** |
| borda | 576 (72,3%) | **3** |
| interior | 114 (14,3%) | 4 |

85,7% das ocorrências estão em células cujo grau máximo é 3 ou menos. Só 14
células distintas do tabuleiro aparecem como ofensoras, e 8 delas são de borda.

O caso limite é exato e vale a pena registrar:

- os portais da etapa 3 são `0,7` e `0,8`;
- `0,8` é um **canto**: no máximo dois vizinhos, sempre;
- quando o portal é `0,7`, a célula `0,8` cai na região de convergência e
  **não** é o portal, então precisa de grau ≥3 — geometricamente impossível.
  Aparece como ofensora 107 vezes, todas com portal `0,7`, nunca com portal `0,8`;
- simetricamente, `0,7` só ofende quando o portal é `0,8` (70 vezes): é célula
  de borda, grau máximo 3, precisa dos três vizinhos abertos.

Ou seja: com portal de canto, a vizinhança do portal é composta de células cujo
grau máximo já é o mínimo exigido. Qualquer parede ali as reprova.

## Veredito

`MIXED`. O gate não está errado: 75,3% das rejeições são layouts que realmente
não oferecem a largura prometida perto do portal, e devem mesmo ser recusados.

Mas 24,7% são desperdício demonstrável — o layout servia e a rota escolhida não.
Existe testemunha reproduzível para cada um dos 63.

Nenhuma correção foi aplicada. Se um dia for, a pergunta a atacar é a escolha da
rota objetiva, não o limiar de largura — e os 63 casos com testemunha são o
conjunto de teste pronto. Dados completos em
[`route-cells-have-escape-255-analysis.json`](route-cells-have-escape-255-analysis.json).
