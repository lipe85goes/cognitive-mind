# Contrato das armadilhas

O Explorador não destrói os defensores. Ele **muda o tabuleiro** e obriga os
dois a reconsiderar o caminho.

## Estados

| | Explorador | Caçador | Sentinela |
|---|---|---|---|
| **dormente** | atravessa | atravessa | atravessa |
| **armada** | **atravessa** | **bloqueado** | **bloqueado** |

Uma armadilha armada **não** é parede global. Ela não bloqueia o Explorador,
nem as luzes, nem o objetivo, nem o portal, nem o caminho lógico do jogador.

## Ativação

Arma quando o Explorador **conclui um movimento válido** e sua nova posição é a
célula da armadilha. Nunca por tentativa inválida, por defensor, por spawn, por
render, por proximidade ou por cálculo de rota.

Armar de novo é idempotente — o conjunto é indexado por célula.

Permanece armada pelo resto daquela partida. Um mapa novo começa dormente:
`startNewMaze` limpa `triggeredTraps`, e o conjunto armado é derivado dele.

## Ordem do turno

```
EXPLORADOR move
  → valida
  → atualiza posição
  → detecta armadilha sob o Explorador
  → ARMA
  → CAÇADOR decide com a armadilha já armada  → captura
  → SENTINELA decide com a armadilha já armada → captura
```

O ponto delicado é o off-by-one. O conjunto entregue aos defensores é montado
**localmente** a partir do passo, não lido de volta do estado React — o
`setTriggeredTraps` é assíncrono e chegaria um turno atrasado. Testado em
`SAME_TURN`.

## Caçador

Política **intocada**: Manhattan-guloso, mesmo scoring, mesmo desempate. A
única coisa que muda é quais células são **destino legal**. Quando a armadilha
remove o movimento que ele queria, ele reconsidera entre os legais restantes com
a regra de sempre. Sem movimento legal, permanece parado — nunca atravessa,
nunca teleporta.

Medido: mesma seed, mesmo estado, 40 execuções. Dormente entrou **40/40**.
Armada entrou **0/40**.

## Sentinela

O algoritmo c3 foi **estendido**, não duplicado. As células armadas entram no
grafo de pathfinding como paredes — só para ele. Com nenhuma armada, o grafo
**é** `walls`, então toda decisão da 01B é idêntica.

Preservados: patrulha, `commitTurns = 3`, alvo de acesso, coleira, zona de
defesa, reposicionamento, finta.

### Compromisso quebrado por armadilha

Se a armadilha cortar o Sentinela do acesso que ele segurava, o compromisso é
**liberado** e ele volta ao portal, livre para escolher outro acesso no turno
seguinte.

Segurar uma porta que ele não alcança mais não é patrulhar, é congelar. Ele
nunca tenta atravessar, nunca teleporta e a coleira continua valendo.

## Múltiplas armadilhas

Cada uma tem estado independente. Não existe regra escondida de "só uma ativa".
O Explorador pode armar várias; todas permanecem; os defensores respeitam o
conjunto inteiro. Testado com **6 armadas** simultaneamente, 0 violações.

## O que NÃO mudou — e uma pergunta para você

O contrato acima trata do efeito sobre os **defensores**. O efeito sobre o
**Explorador** ficou exatamente como estava: pisar numa armadilha dormente ainda
conta um erro, e o escudo azul ainda o absorve.

Não mexi nisso porque a missão não pediu, e porque remover o dano deixaria o
escudo sem função — e o escudo está congelado até `ROTA-CHEST-REWARDS-01`.

Mas há uma tensão de design que vale nomear: a armadilha agora é uma
**ferramenta do jogador**, e o jogador ainda paga um erro para usá-la. Pode ser
intencional (o preço da manobra) ou pode ser resíduo do contrato antigo. É
decisão sua, não minha.
