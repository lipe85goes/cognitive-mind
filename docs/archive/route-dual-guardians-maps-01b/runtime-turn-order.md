# Ordem do turno no runtime

## Antes (um defensor)

```
Explorador valida e move
  → armadilha / escudo / luz / portal
  → Explorador entrou no Guardião?  → derrota
  → chegou ao portal com ele ativo?  → vitória
  → Guardião move
  → Guardião alcançou o Explorador?  → derrota
  → mensagem → render
```

Estado do Caçador: `useState<GridPosition>` no hook. Movimento em
`chooseGuardianMove`, chamado uma vez por movimento válido do Explorador.
Captura é testada duas vezes: quando o Explorador entra na célula dele, e
depois que ele se move.

## Agora (dois defensores)

```
Explorador valida e move
  → armadilha / escudo / luz / portal
  → Explorador entrou no Caçador OU no Sentinela?  → derrota
  → chegou ao portal com ele ativo?                 → vitória
  → CAÇADOR move    → alcançou o Explorador? → derrota
  → SENTINELA move  → alcançou o Explorador? → derrota
  → mensagem → render
```

A ordem **não foi inventada**: é a do `simulateDual` do lab, que a 01A validou
em 270 mapas dinâmicos. O lab move o Caçador antes do Sentinela e testa captura
após cada um; o runtime faz o mesmo.

## Conflito de destino

O Sentinela decide por último, já vendo a posição nova do Caçador. Se o
movimento que ele escolheria terminasse na célula do Caçador, ele permanece onde
está. Regra determinística, sem depender de render.

## Reset

`startNewMaze` recria o Sentinela a partir do mapa novo — posição, alvo e
contador de compromisso. Nenhum compromisso sobrevive a um restart, a uma troca
de rota, de modo, ou a uma volta para a Home.

A zona é derivada por `useMemo` do mapa; no reset ela é recalculada
explicitamente a partir do mapa novo, porque o memo ainda contém o anterior
naquele render.
