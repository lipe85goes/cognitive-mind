# Follow-ups visuais — registrados, não implementados

Decisões do usuário após o playtest manual da 01B. **Nenhuma foi implementada
nesta missão** e nenhuma altera os gates funcionais da 01B.

## 1. Sentinela — silhueta

**Rejeitado:** a forma atual de coluna/totem (plinto octogonal + coluna + coroa).

Ela foi escolhida para maximizar contraste de silhueta com o Caçador, e o
contraste saiu forte demais: o Sentinela deixou de parecer uma entidade e virou
mobiliário do cenário.

**Direção aprovada para a passagem futura:**

- aproximar a silhueta da família visual do Caçador — mesma sensação de
  entidade/personagem;
- não ser clone exato dele;
- Sentinela em paleta fria/teal;
- Caçador permanece bronze/âmbar;
- **manter** o elemento territorial teal no chão (o anel funciona);
- o comportamento continua sendo a diferença principal entre os dois, não a forma.

Estado atual do código: `renderSentinel` em
[`routeBabylonScene.ts`](../../../src/games/escape-maze/routeBabylonScene.ts) —
sete meshes primitivos. O tabuleiro de fallback usa `kind="sentinel"` em
`RouteToken3D`, que já herda a silhueta do Caçador; a divergência está só no
caminho Babylon.

Regra a preservar na reescrita: **nenhuma Babylon Light nova.** A cena tem 3 e
`ROUTE_MAX_LIGHTS = 3`. Todo brilho por `emissive` + `GlowLayer` existente.

## 2. Armadilhas vermelhas — silhueta

**Rejeitado:** os pinos/cones vermelhos atuais.

**Direção aprovada para a passagem futura:**

- armadilha baixa, integrada ao piso;
- runa ou placa de chão;
- vermelho escuro quando passiva;
- linguagem visual já preparada para uma futura ativação.

**A mecânica não muda aqui.** As armadilhas continuam no contrato passivo atual.
O comportamento novo permanece reservado para `ROTA-TRAPS-STRATEGY-01`.

## O que isto não altera

Os gates funcionais da 01B seguem válidos e não foram tocados: equivalência
lab↔runtime 0 divergências em 658 estados, finta, coleira, papéis distintos,
`commitTurns = 3`, Sentinela nunca no portal, 3 luzes Babylon, e a regressão do
gerador da 01A.
