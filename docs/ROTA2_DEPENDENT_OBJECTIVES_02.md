# ROTA2-DEPENDENT-OBJECTIVES-02 — the first dependent objective

Missão Rota 2.0 explicitamente aprovada (classe 4 do §12 de
`docs/GAMEPLAY_PLATFORM_LOCK_V1.md`). Base exata:
`32c419a2784b54043f38f08afd60c8628f44f54c` (a árvore final da
ROTA2-DYNAMIC-TRAPS-01). Branch: `feat/rota2-dependent-objectives-02`.

A DYNAMIC-TRAPS-01 provou que a topologia pode mudar com segurança durante a
partida. Esta missão faz essa mudança importar para o objetivo da Rota:

```text
Rota 1        luzes ───────────────────→ portal          (idêntica à v1)

Rotas 2 e 3   luzes ─────────────┐
                                 ├──→ portal
              passagem marcada ──┘                        (qualquer ordem)
```

A passagem marcada é a parede já ligada à armadilha dinâmica (runa lilás). Ela
abre pela armadilha **ou** pela Picareta — o objetivo é sobre o mundo ("a
passagem está aberta"), não sobre quem a abriu.

## 1. Contrato de gameplay

- **Rota 1:** todas as luzes acordam o portal; nada mais. A armadilha ligada, o
  Baú, a Picareta e a Segunda Chance continuam opcionais. Mensagens, eventos,
  pontuação e resultado são os da DYNAMIC-TRAPS-01, byte a byte (provado: §6).
- **Rotas 2 e 3:** o portal acorda quando **as duas** condições valem — todas
  as luzes coletadas **e** a parede ligada fora das paredes atuais. As duas
  podem ser cumpridas em qualquer ordem.
- **Passagem aberta** = a parede ligada não está em
  `currentWalls(mazeMap.walls, brokenWall, trapOpenedWalls)`:
  - a armadilha abre a parede → completo;
  - a Picareta abre **essa** parede → completo;
  - a Picareta abre outra parede → continua incompleto;
  - a armadilha arma depois que a Picareta já abriu a parede → continua
    completo; a armadilha arma normalmente, nada mais abre, nenhum evento
    novo (comportamento da DYNAMIC-TRAPS-01).
- **Recompensas justas:** a Segunda Chance (ou nenhuma recompensa) completa a
  passagem pela armadilha; a Picareta é um caminho alternativo, nunca
  obrigatório.
- **Portal visitado cedo:** não vence; mensagem calma do que falta:
  - nada feito: "Faltam luzes e a passagem marcada.";
  - luzes prontas: "As luzes estão prontas. Falta abrir a passagem marcada.";
  - passagem aberta: "A passagem está aberta. Ainda faltam luzes.".
- Sem cronômetro, sem pontuação nova, sem recompensa nova, sem coletável novo,
  sem objeto novo no mundo. O mapa é o mesmo mapa da DYNAMIC-TRAPS-01 para a
  mesma semente.

## 2. Arquitetura — `route-objectives.ts`

Um módulo puro (só `import type { MazeMap }`; sem React, Babylon, sons,
browser, storage, Worker ou sorteio):

- `RoutePrerequisiteId = "collect-all-lights" | "open-linked-passage"`,
  `RouteObjectiveId = RoutePrerequisiteId | "reach-portal"`;
- `routeObjectivePlan(routeNumber)` — tabela fixa: Rota 1 `[lights]`, Rotas 2
  e 3 `[lights, passage]` (um número fora da jornada lê a Rota mais próxima);
- `linkedPassageWall(mazeMap)` — `trapLinks[0].mutation.wall`;
- `evaluateRouteObjectives({ plan, mazeMap, collectedStars, walls })` →
  `{ plan, lights: { collected, total, complete }, passage: { required, wall,
  open, complete }, missing, portalReady }`. A regra das luzes é a da v1
  (`total === 0 || collected >= total`). Um mapa sem ligação tem a passagem
  completa (nada a abrir).

O avaliador devolve estrutura; as palavras são do hook (mensagens) e do
componente (painel).

**Estado derivado, não outra máquina de estados.** Nenhum campo novo em
`RouteRuntimeState`, nenhuma ação C5, nenhum evento C6: as luzes já são
`collectedStars`, a passagem já é a topologia. O hook avalia a cada render
(`portalActive = objectives.portalReady`) e de novo dentro do turno, sobre a
topologia do turno (`turnWalls`) e as luzes do passo. Reiniciar ou abrir a
próxima Rota zera tudo naturalmente: o estado novo tem luzes vazias e paredes
certificadas.

## 3. Ativação do portal e ordem do turno

`PORTAL_ACTIVATED` continua significando "o portal ficou utilizável" e sai
**uma vez**, no turno em que o último pré-requisito que faltava completa
(`!portalActive && nextPortalActive`):

```text
passo do Explorador
→ EXPLORER_STEP_COMMITTED
→ LIGHT_COLLECTED          (se o passo pegou uma luz)
→ TRAP_ARMED               (se o passo armou uma armadilha)
→ WALL_OPENED_BY_TRAP      (se ela abriu a parede ligada)
→ PORTAL_ACTIVATED         (se o portal acabou de ficar pronto)
→ [vitória?] → [Baú?] → defensores, na topologia atual

Picareta
→ WALL_OPENED
→ PORTAL_ACTIVATED         (se essa parede era a passagem e as luzes já estavam)
→ defensores na topologia aberta (semântica de turno da Picareta, inalterada)
```

Luz e armadilha nunca são a mesma célula (o gerador mantém armadilhas a ≥ 2 de
toda luz), então na Rota 1 a sequência é exatamente a da v1 (luz → portal).
Ninguém lê topologia meio velha: `turnWalls` é calculado antes de qualquer
evento e é o que o avaliador, o Caçador, a Sentinela e a região do portal leem.

## 4. Invariantes

`inspectDynamicMazeState` aceita `requiredPassageWall` (o hook o passa nas
Rotas 2/3). Uma passagem exigida ainda de pé é um objetivo não terminado, e
continua abrível se a armadilha ligada está desarmada e alcançável, ou se uma
Picareta (na mão, ou ainda no Baú alcançável, ou a escolha pendente) pode ser
levada a uma casa caminhável ao lado da parede. Senão: `UNREACHABLE_OBJECTIVE`
(nenhum código novo). Abrir a passagem nunca exige a passagem aberta.

## 5. Interface

- **Rotas 2/3:** sob "Objetivo atual", uma lista compacta
  (`<ul aria-label="Objetivos da rota">`): **Luzes** `2/3` · **Passagem
  marcada** `Fechada`/`Aberta` · **Portal** `Aguardando`/`Ativado`/`Alcançado`.
  Estado sempre em texto (e um ✓ quando completo, com "concluído" para leitor
  de tela); a runa lilás do tabuleiro é o ícone da passagem — nenhum marcador
  novo. Não é região viva: a mensagem acima (`role="status"`) já narra as
  mudanças, então nada é anunciado duas vezes. Sem modal, sem interação para
  ler. O título do objetivo diz o que falta ("Colete 2 luzes e abra a passagem
  marcada", "Abra a passagem marcada para acordar o portal").
- **Rota 1:** a linha de objetivo de sempre; nenhuma lista.
- O tabuleiro recebe `portalActive` do hook (o portal 3D acende pela regra, não
  pelas luzes); `data-portal-active` no canvas.
- Detalhes da rota (Rotas 2/3): "Nesta rota o portal também espera a passagem
  marcada: abra-a pela armadilha da mesma runa ou com a Picareta."

## 6. Validação

RESULTS_PLACEHOLDER
