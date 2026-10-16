# ROTA2-DYNAMIC-TRAPS-01 — the first dynamic-topology mechanic

Missão Rota 2.0 explicitamente aprovada (classe 4 do §12 de
`docs/GAMEPLAY_PLATFORM_LOCK_V1.md`). Base exata:
`9f8ebb5d8c0c747e68d8719e523ecab3ecbdab00`. Branch:
`feat/rota2-dynamic-traps-01`.

Uma fatia vertical, e só uma:

```text
o jogador vê a consequência (runa lilás na armadilha e na parede)
→ escolhe pisar na armadilha
→ a armadilha arma (bloqueia os defensores, como na v1)
→ a parede ligada abre, pelo resto da Rota
→ o jogo continua válido e solucionável
→ Caçador e Sentinela respondem no labirinto novo, no mesmo turno
```

## 1. Contrato de gameplay

- Cada mapa certificado tem **exatamente uma** armadilha dinâmica: uma das
  armadilhas da v1, ligada pelo gerador a uma parede fechada. As outras
  armadilhas continuam exatamente como na v1.
- Antes: a armadilha dorme, a parede está de pé, as duas carregam a mesma runa
  lilás e um fio tênue de runas liga uma à outra no chão.
- O Explorador pisa na armadilha: ela arma (como na v1 — o Explorador pode
  ficar e atravessar; armada, bloqueia os dois defensores) **e** a parede ligada
  abre. A mensagem diz o que aconteceu: "Armadilha ativada: a parede da mesma
  runa se abriu. A passagem serve para todos."
- A passagem vale para todos: o Caçador e a Sentinela podem usá-la.
- Só abrir. Nenhuma armadilha fecha parede nesta missão.
- Picareta antes da armadilha (a Picareta abriu justamente a parede ligada):
  a armadilha arma normalmente e não abre nada — no-op idempotente; nenhuma
  parede é sorteada no lugar. Mensagem: "Armadilha ativada. A parede da mesma
  runa já estava aberta." A Picareta continua de uso único e continua escolhendo
  qualquer parede interna vizinha; depois que a armadilha abriu a parede, ela
  não é mais alvo da Picareta (não é mais parede).
- Segunda Chance: inalterada. Abrir uma parede por armadilha não a gasta nem a
  altera.

## 2. Geração — o contrato da ligação

`MazeMap.trapLinks: RouteTrapLink[]`, com
`RouteTrapLink = { trap: "r,c", mutation: RouteTopologyMutation }` e
`RouteTopologyMutation = { kind: "open-wall"; wall: "r,c" }` (única variante).

Uma parede da Rota é uma **célula** do grafo 9×9 (`grid` = 1). A forma canônica
de uma parede é a chave da célula — o mesmo vocabulário do `brokenWall` da
Picareta. Abri-la devolve esse vértice ao grafo, com as arestas para as células
abertas ao redor. Quando a parede toca exatamente duas células abertas em lados
opostos (uma "porta"), isso é exatamente uma aresta nova; a escolha prefere
portas, depois quinas, depois junções.

`chooseTrapLinks` (em `buildCandidate`) lê a ligação do mapa já terminado, sem
sorteio: o fluxo aleatório da geração não é tocado (nenhum mapa e nenhum sorteio
do Caçador mudam por causa dela). Mesmo mapa / mesma semente = mesma ligação.
`isValidMap` certifica (`trapLinksAreLegal`); um mapa sem ligação legal não é
certificado e o gerador tenta de novo.

Uma parede é ligável quando:

- está de pé no início da Rota, dentro da grade;
- toca **2 ou 3** células abertas (nunca um bolsão, nunca uma praça);
- a abertura economiza **≥ 2 passos** entre duas dessas células;
- nenhuma célula que ela toca fica na região de convergência do portal
  (distância ≤ 3 do portal) — região da Sentinela, portas e largura de fuga
  ficam exatamente como certificados;
- nenhuma célula que ela toca é armadilha (a passagem não nasce selada);
- a armadilha fica a **2–4** casas (Manhattan) da parede.

Abrir uma célula só **acrescenta** grafo: nenhuma rota some, nenhuma célula
fica inalcançável, nenhum beco novo aparece (a célula aberta toca ≥ 2
abertas). Início, células seguras, assento do Caçador e portal são caminháveis
por construção — nunca são paredes.

## 3. Topologia mutável em runtime

Uma fonte de verdade: o mapa certificado nunca é escrito; o que abriu durante a
Rota fica em `RouteRuntimeState` (`brokenWall` da Picareta e o novo
`trapOpenedWalls`). A topologia atual é
`currentWalls(mazeMap.walls, brokenWall, trapOpenedWalls)`
(`route-geometry.ts`), e **todos** a leem: o movimento do Explorador, o Caçador,
a Sentinela e a região do portal, as dicas de movimento e de perigo do
tabuleiro, os alvos da Picareta, o tabuleiro Babylon e o inspetor de
invariantes. Com nada aberto ela devolve o próprio `mazeMap.walls` (identidade
da v1).

Ordem do turno, fixa, numa única sequência síncrona:

```text
EXPLORER_STEP_COMMITTED → (LIGHT_COLLECTED, PORTAL_ACTIVATED) → TRAP_ARMED
→ WALL_OPENED_BY_TRAP → [vitória?] → [Baú?] → defensores
```

Os defensores do turno da ativação recebem `turnWalls` (a parede já aberta) e a
região do portal recalculada nesse labirinto — exatamente como já acontecia com
a parede da Picareta. Ninguém lê topologia meio velha, meio nova.

## 4. Estado e eventos

- `RouteRuntimeState.trapOpenedWalls: string[]` (vazio em `createRouteState`).
- Ação C5 `OPEN_WALL_BY_TRAP { wall }` — acrescenta a parede; nada é gasto.
- Evento C6 `WALL_OPENED_BY_TRAP { turn, trap, wall }` → `[OPEN_WALL_BY_TRAP]`.
  Distinto de `WALL_OPENED` (Picareta → `OPEN_WALL` + `COUNT_TURN`), então o
  traço diz qual causa abriu qual parede, e qual armadilha. Só é emitido quando
  a parede realmente abre. `TRAP_ARMED` continua observacional.
- `inspectDynamicMazeState` lê a topologia atual e verifica as ligações e o que
  elas abriram: `TRAP_LINK_UNKNOWN_MUTATION`, `TRAP_LINK_UNKNOWN_TRAP`,
  `TRAP_LINK_WALL_NOT_IN_BASE_MAP`, `TRAP_LINK_DUPLICATE_TRAP`,
  `TRAP_LINK_DUPLICATE_WALL`, `TRAP_OPENED_WALL_NOT_IN_BASE_MAP`,
  `TRAP_OPENED_WALL_TWICE`, `TRAP_OPENED_WALL_ALSO_BROKEN`,
  `TRAP_OPENED_WALL_WITHOUT_ARMED_LINK`, `ARMED_TRAP_LINK_WALL_STILL_CLOSED`.
- Worker: continua o realm da geração; o protocolo só passou a exigir
  `map.trapLinks` como array na resposta (um mapa de outro build é malformado).

## 5. Visual

- Adormecida: runa de losango lilás no centro da runa da armadilha; a mesma
  runa no topo da parede ligada, com um anel fino no pé; um fio de pequenos
  losangos no chão entre as duas. Lilás é uma cor que nenhuma outra peça da
  Rota usa.
- Ativação: a parede some no mesmo quadro em que a lógica a abre (o tabuleiro
  estático é reconstruído a partir de `walls`); um anel lilás suave cresce e
  some em 0,9 s sobre a célula aberta e sobre a armadilha. Sem tremor, sem
  flash, sem câmera.
- Depois: a armadilha fica armada (vinho aceso) com a runa acesa; no chão da
  passagem fica a runa acesa com um anel — sem entulho (essa é a marca da
  Picareta).
- Movimento reduzido: nenhum pulso; a passagem aparece já aberta, com a runa.
- Não há bloqueio de input: como a parede some no mesmo quadro em que a lógica
  muda, imagem e lógica nunca discordam; o pulso é decoração.
- O render não decide nada: recebe `walls`, `trapLinks` e
  `trapOpenedWallKeys` e desenha.
- Detalhes da rota: legenda "Runa: armadilha e parede" e a linha "Runa lilás:
  pisar nessa armadilha abre a parede com a mesma runa, para todos."

## 6. Validação

Ver a seção de resultados no fim deste documento e
`docs/archive/rota2-dynamic-traps-01/`.
