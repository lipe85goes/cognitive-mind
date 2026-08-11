# Ordem do turno com armadilhas

## Antes desta missão

```
EXPLORADOR move
  → armadilha dormente? → ERRO (ou escudo consumido)
  → luz / portal
  → CAÇADOR move → captura
  → SENTINELA move → captura
```

A armadilha era uma punição passiva. Pisar nela custava um erro.

## Agora

```
EXPLORADOR move
  → valida
  → atualiza posição
  → detecta armadilha sob o Explorador
  → ARMA                      ← sem erro, sem dano, sem escudo consumido
  → luz / portal
  → CAÇADOR decide com a armadilha já armada  → captura
  → SENTINELA decide com a armadilha já armada → captura
  → mensagem → render
```

## O off-by-one

O conjunto armado entregue aos defensores é montado **localmente**:

```ts
const armedTraps = isUntriggeredTrap
  ? new Set([...triggeredTrapSet, nextKey])
  : triggeredTrapSet;
```

`setTriggeredTraps` é assíncrono; ler o estado de volta entregaria o conjunto do
turno anterior e os defensores atravessariam a armadilha recém-armada uma vez.
Testado em `SAME_TURN` e no trace da Fase 13.

## O que ficou fora do conjunto

O conjunto armado é passado **apenas** para `chooseGuardianMove` e
`decideSentinelMove`. A validação de movimento do Explorador nunca o vê — por
isso ele atravessa a própria armadilha livremente, dormente ou armada.

## Erros que permanecem

Pisar no Caçador continua contando erro. Movimento bloqueado continua contando
em `blockedMoves`. O sistema de erro não foi removido — só a armadilha saiu
dele.
