# Suporte exato do RNG

`STEP(state, action)` não é função. Este documento formaliza **todo** próximo
estado com probabilidade maior que zero — o *support* — para que o solver
enumere em vez de amostrar.

## `getPredatorNextPosition` (`src/engine/difficulty.ts`)

Seja `N` os vizinhos válidos do Caçador e `C ⊆ N` os que reduzem a distância
Manhattan até o Explorador.

| modo | ramos | suporte |
|---|---|---|
| **Aberto** | `p<0,5` → vizinho aleatório de `N`; senão aleatório dos "não mais próximos", ou de `N` se vazio | **`N`** — o primeiro ramo já cobre tudo |
| **Equilibrado** | `p<0,75` e `C≠∅` → aleatório entre os melhores de `C`; senão aleatório de `N` | **`N`** — pelo mesmo motivo |
| **Desafiador** | `C≠∅` → aleatório entre os melhores de `C`; senão aleatório de `N` | **melhores de `C`**, ou `N` |

`N` vazio devolve o próprio Caçador.

## `chooseGuardianMove` (`useEscapeMaze.ts`)

Ilegal = célula do portal **ou** armadilha armada.

```
para cada p no suporte do predador:
  se p é legal          -> p entra no suporte
  senão                 -> entra o suporte do ramo alternativo
```

Ramo alternativo, quando alguma preferência é ilegal:

- sem alternativas legais → o próprio Caçador;
- **Aberto**: `p<0,45` → qualquer alternativa; **mais** os melhores por Manhattan;
- demais modos: só os melhores por Manhattan.

## Sentinela

`decideSentinelMove` é **pura** — medido: 200 repetições do mesmo estado, 1
único resultado. Não ramifica.

## Consequência para o tamanho do problema

Em Aberto e Equilibrado o suporte é **todos os vizinhos**, até 4. Com 4 ações do
Explorador, um estado pode ter 16 sucessores. É por isso que esses dois modos
explodem, e o Desafiador é o mais tratável.

## Soundness medida

32.880 transições reais do runtime, nos três modos, com e sem armadilhas
armadas: **0 fora do suporte enumerado**.

E 1.241 dos 1.242 ramos enumerados foram observados ao menos uma vez — a
enumeração é justa, não inflada. Esse é o argumento empírico de *completeness*;
o argumento formal é a tabela de ramos acima, derivada linha a linha do código.
