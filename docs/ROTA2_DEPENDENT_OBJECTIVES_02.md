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

Evidência: `docs/archive/rota2-dependent-objectives-02/`
(`dependent-objectives-tests.json`, `census.json`, `browser/`,
`performance.json`). Comandos em `tools/validation/README.md`.

### 6.1 Suíte dedicada (`rota2-dependent-objectives-tests.mjs`)

O01–O30: **30/30** na árvore da missão. Hook real (harness), gerador real,
módulo de objetivos real, o solver exato contra o hook. Fixtures achadas por
busca (sementes × modos × cautela), nunca escritas à mão.

| | |
| --- | --- |
| O01 Rota 1 ≡ base | 36 partidas aleatórias semeadas (Picareta, Segunda Chance, armadilha ligada, luzes), quadro a quadro, evento a evento, resultado a resultado contra `32c419a`: 0 divergências |
| O02/O03 | plano `[lights, passage]`; todas as luzes com a passagem fechada → portal inativo |
| O04 | o plano não sorteia (`Math.random` que lança: não chamado); 54 mapas idênticos à base |
| O05–O08 | passagem começa incompleta (18/18); armadilha completa; Picareta na parede ligada completa ("Parede aberta: a passagem marcada está aberta. Ainda faltam luzes."); Picareta em outra parede não (`WALL_OPENED` → `DEFENDERS_SETTLED`, sem portal) |
| O09 | Segunda Chance → armadilha → luzes → **vitória** |
| O10/O11 | luzes sozinhas e passagem sozinha não acordam o portal |
| O12–O14 | `STEP → LIGHT_COLLECTED → PORTAL_ACTIVATED → DEFENDERS_SETTLED`; `STEP → TRAP_ARMED → WALL_OPENED_BY_TRAP → PORTAL_ACTIVATED → defensores` (Caçador já sem a parede); `WALL_OPENED → PORTAL_ACTIVATED → DEFENDERS_SETTLED` |
| O15 | `PORTAL_ACTIVATED` ≤ 1 por sessão e = 1 em toda vitória |
| O16/O17 | portal cedo não vence (nada feito, luzes prontas, passagem aberta); as três frases certas, nenhuma estressante |
| O18–O21 | reiniciar zera; a próxima Rota tem plano e progresso próprios (inclusive depois de uma Rota 2 vencida com a passagem aberta); R1 → R2 introduz a passagem; R2 → R3 a mantém |
| O22 | 1193 renders: `passage.open === !walls.has(parede)` e `portalActive === luzes && passagem` sempre |
| O23 | `RouteRuntimeState`, ações C5 e eventos C6 idênticos à base (19 campos, 0 acrescentados) |
| O24 | o módulo só tem `import type`; roda num realm vazio |
| O25 | a transição de vitória do solver: nas Rotas 2/3 só com o bit da armadilha ligada; na Rota 1 como antes |
| O26 | solver × hook (regra da missão): 431 transições, 0 fora do suporte por causa do objetivo |
| O27/O28 | 1080 mapas estruturalmente completáveis; 0 dependência circular; os pré-requisitos são independentes |
| O29/O30 | nada fora de `src/games/escape-maze/` mudou; nenhum cronômetro, pontuação ou recompensa nova |

- **Contrafactual** na base exata `32c419a` (a DYNAMIC-TRAPS-01):
  **23/23** checks `[objectives]` **falham**; os 5 `[preserved]` (O01, O12,
  O15, O29, O30) e os 2 `[structure]` (O27, O28) **passam**.
- **Mutantes: 16/16** pegos — Rota 1 exigindo passagem (O01), Rota 2/3
  esquecendo (O02/O10, O03/O21), luzes sem passagem (O10), passagem sem luzes
  (O11), Picareta ignorada (O07/O14), qualquer parede da Picareta valendo
  (O08), Segunda Chance impossível (O09), portal vencendo cedo (O16),
  `PORTAL_ACTIVATED` duplo (O15/O12/O13), objetivo duplicado no estado (O23),
  `Math.random` no plano (O04), React no avaliador (O24), solver com a regra
  antiga (O25/O26), reinício vazando (O18), próxima Rota herdando (O19/O21).

### 6.2 Censo (`rota2-dependent-objectives-census.mjs`) — 22/22

**A — geração**, 3 Rotas × 3 modos × 120 sementes = **1080 mapas**, nesta
árvore e na base: **1080/1080 idênticos** (0 mudados, 0 exceções, 1080 com a
ligação). Nenhuma retentativa nova: o plano não toca a geração.

**B — estrutura** (oráculo independente, `rota2-objectives-structure.mjs`):

| | Rota 1 | Rotas 2/3 |
| --- | --- | --- |
| mapas | 360 | 720 |
| completáveis | 360 | **720** |
| armadilha alcançável com a passagem fechada | — | 720 |
| luzes alcançáveis | 360 | 720 |
| portal alcançável depois dos pré-requisitos | 360 | 720 |
| ordem luzes → passagem / passagem → luzes | — | 720 / 720 |
| caminho da Picareta (Baú → beira da parede → quebrar) | — | 720 |
| caminho sem Picareta (Segunda Chance / nenhuma) | — | 720 |
| dependência circular | — | **0** |
| objetivo impossível | — | **0** |

O inspetor de produção (`requiredPassageWall`) em **17 820** estados de
passagem fechada (Baú fechado; Segunda Chance guardada ou gasta; Picareta na
mão; Picareta gasta em cada outra parede alcançável): 0 inválidos, 0 sem
solução.

**C — solucionabilidade adversarial exata (pré-Baú)**, 72 mapas
estratificados, regras da DYNAMIC-TRAPS-01 contra as desta missão:

| classe | DYNAMIC-TRAPS-01 | DEPENDENT-OBJECTIVES-02 |
| --- | --- | --- |
| GARANTIDA | 16 | 16 |
| POSSÍVEL, NÃO GARANTIDA | 45 | 45 |
| PROVADA INSOLÚVEL | 4 | 4 |
| INCONCLUSIVA (limite de recurso) | 7 | 7 |

Nenhum mapa mudou de classe (Rota 1: 24/24 iguais por construção; Rotas 2/3:
48/48 iguais). Os grafos explorados mudam (ex.: 2 806 228 → 2 807 504 estados
num mapa da Rota 3), então o modelo mudou de fato (O25 prova a transição); na
amostra, toda estratégia que vencia ou garantia a vitória já podia passar pela
armadilha ligada a tempo. **Nenhum mapa novo provado insolúvel** — então nada a
investigar como bloqueador; os 4 insolúveis são os mesmos 4 da
DYNAMIC-TRAPS-01 (2 na Rota 1, 2 na Rota 3, pelos defensores). O que isso
**não** diz: a amostra é de 72 mapas e pré-Baú; não prova que nenhum mapa em
lugar algum fique mais difícil.

**D — runtime no hook real:**

- Rota 1: **360 partidas** (uma por mapa da Rota 1, política semeada com Baú,
  Picareta, Segunda Chance e a armadilha ligada) contra a base, render por
  render e evento por evento: **0 mapas mudados** (13 740 quadros, 129 vitórias,
  194 ativações de portal).
- Rotas 2/3, 72 mapas × 5 roteiros, cada um tentado com 3 cautelas:

  | roteiro | vitórias | passagem completada por |
  | --- | --- | --- |
  | luzes → armadilha | 11 | armadilha 11 |
  | armadilha → luzes | 19 | armadilha 19 |
  | luzes → Picareta | 11 | Picareta 11 |
  | Picareta → luzes | 9 | Picareta 9 |
  | Segunda Chance → armadilha | 16 | armadilha 16 |

  As derrotas são do Explorador roteirizado contra os defensores reais (é um
  andador cuidadoso, não um solver); o que importa é que cada roteiro vence e
  que nada de errado acontece nos outros: `PORTAL_ACTIVATED` duplicado 0;
  vitória sem ativação 0; portal visitado cedo 50 vezes, vitórias 0; 19 680
  renders, 0 inválidos com a Rota em jogo, 0 discordâncias entre passagem e
  topologia; reiniciar depois da passagem aberta 36/36 zerado; a próxima Rota
  36/36 zerada.
- Solver × hook com a regra da missão: **9149 transições** (2677 depois da
  passagem aberta, 30 vitórias): **0 discordâncias causadas pelo objetivo**.
  8 discordâncias são do modelo de defensores de referência (a mesma
  transição falta com a regra antiga também): ver §7.

### 6.3 Navegador (`rota2-dependent-objectives-browser-probe.mjs`)

Build de produção (`next build && next start`), Chromium headless com
SwiftShader, entrando pela Home (galeria → Rota → intro → "Iniciar rota"). A
Rota 2 é alcançada como o jogador a alcança: a Rota 1 termina (perdida de
propósito) e a ação do resultado abre a próxima. Joga lendo só o que a página
publica (atributos do canvas, inclusive `data-portal-active`, e o painel
`Objetivos da rota` com seu texto e sua árvore de acessibilidade).
`docs/archive/rota2-dependent-objectives-02/browser/` (`browser-probe.json` e
as capturas). **10/10 cenários, 0 erros de página, 0 retentativas da
entrada** (25 entradas).

| cenário | o que provou |
| --- | --- |
| route1 | nenhuma lista; o portal dorme até a última luz e acorda nela, com a parede ligada ainda de pé; "Portal ativado! Vá até a saída."; vitória |
| lightsFirst | 3/3 luzes, portal "Aguardando", passagem "Fechada", título "Abra a passagem marcada para acordar o portal"; portal visitado cedo: "As luzes estão prontas. Falta abrir a passagem marcada.", sem vitória; a armadilha abre a passagem e acorda o portal; vitória. Árvore de acessibilidade: `list "Objetivos da rota"` → `Luzes 3/3 coletadas, concluído` · `Passagem marcada Fechada` · `Portal Aguardando` |
| passageFirst | armadilha primeiro: passagem "Aberta, concluído", portal "Aguardando"; a última luz acorda o portal; vitória (na Rota 3, depois de uma Rota 2 perdida — mesmo plano) |
| pickaxe | Baú → Picareta → a parede marcada quebrada: passagem "Aberta", armadilha ainda adormecida, "Parede aberta: a passagem marcada está aberta. Ainda faltam luzes."; luzes; vitória |
| secondChance | Baú → Segunda Chance → armadilha → luzes → vitória; nenhuma parede da Picareta |
| early | portal antes de tudo: "Faltam luzes e a passagem marcada.", nada de resultado |
| continuation | Rota 1 sem lista → Rota 2 com lista nova (0/3, Fechada, Aguardando) → Rota 3 com lista nova (0/4, Fechada, Aguardando) |
| restart | passagem aberta e "Começar outra rota": "Fechada", 0 luzes, nada aberto |
| mobile | 360×640, toque no D-pad: o painel cabe (34 px de altura, sem rolagem horizontal), a armadilha abre a passagem |
| reduced | prefers-reduced-motion: mesma semântica, painel estável depois de 1,2 s |

Teclado: todos os cenários de desktop andam pelas setas; o painel não exige
nenhuma interação (é lido com a página). Regressão: a sonda da
DYNAMIC-TRAPS-01 no build da missão — **5/5** (main, pickaxe, mobile, reduced,
continuation). Numa primeira rodada o cenário pickaxe falhou no caminho de
nova tentativa da própria sonda (Rota 1, "Começar outra rota" depois de uma
caminhada que terminou no Baú — sem objetivo envolvido); rodado de novo, e na
rodada completa seguinte, passou na 1ª tentativa. A regex da ativação passou a
aceitar também a frase da Rota 2 (a sonda continua para a Rota 2 quando perde
a Rota 1).

**Tempo de entrada (SwiftShader, CPU ociosa, alternado base → missão, 3 × 2,
480×360)**: base 22,0 / 21,0 / 15,9 s, missão 15,2 / 18,5 / 16,1 s; 0
retentativas nas duas (`entry-timing-480x360.json`). Dentro do ruído; nenhuma
regra do jogo mudou para o ambiente.

### 6.4 Performance

- **Renders por entrada** (hook real, mesmas entradas semeadas, 72 partidas,
  2593 entradas): missão **1,0** e base **1,0** em cada Rota — o objetivo é
  derivado dentro do render que já acontece, e `PORTAL_ACTIVATED` não grava
  nada. Nenhum commit novo de React.
- **Custo da avaliação**: ~0,35 µs por chamada (360 000 chamadas sobre mapas
  reais); o hook chama uma vez por render, mais uma por passo e por quebra.
- **Bundle** (`route-generation-bundle-audit.mjs`, `next build` da base e da
  missão): Home **756,1 KB / 237,1 KB gzip nas duas** (idêntica); Worker
  idêntico (34,1 KB); Babylon idêntico; JS preguiçoso da Rota 56,3 → 60,8 KB
  (19,0 → 20,2 KB gzip, +1,2 KB).
- **Geração**: nada mudou nela (1080/1080 mapas idênticos; o DEEP bate com a
  evidência gravada, inclusive o desempenho). Nenhuma geração na thread
  principal; o Worker é o mesmo.

### 6.5 Regressões

- `npm run lint`: 0 erros (os 5 avisos da base); `tsc --noEmit` limpo;
  `next build` ok; `git diff --check` limpo.
- Gameplay/Platform Lock: **21/21** (R4 e R5 novos); `--counterfactuals`:
  os 5 baselines e os **12 mutantes** pegos (5 novos: objetivo no estado, Rota
  1 com passagem, Rota 3 sem passagem, `Math.random` no plano, React no
  módulo); `--rev=32c419a`: 17/17. Coupling gate 6/6. Manifestos dos deltas:
  as duas reversões exatas (objetivos → DYNAMIC-TRAPS-01 → v1).
- DYNAMIC-TRAPS-01: suíte **28/28**, contrafactual na v1 ok (23 falham, 5
  valem), **17/17 mutantes**; censo **bate com a evidência gravada** (o solver
  segue a regra do hook: `requirePassage` quando o hook diz que a passagem é
  exigida); sonda 5/5. A evidência da suíte só mudou em T27 (§9).
- C1 22/22 · C2 21/21 · C3 19/20 · C4 18/19 · C5 41/42 · C6 34/35 · C7B
  (lifecycle) e C7C (worker) com P3: a única falha de cada uma ("todo outro
  módulo intocado") e o H13/H14 do harness são **idênticos byte a byte à
  base** `32c419a` (rodados nas duas árvores) — pré-existentes.
- Jornada (ownership, terminal), continuação (e `--rev=415cead` falhando como
  deve), carregador do tabuleiro (e `--rev=c34b274`), readiness, watchdog,
  projeção, validate-9x9, worker RNG handoff, memory-circuit, Sentinela
  (equivalência), Dynamic Solvability 02, lock do Game 03 (e
  `--counterfactuals`: o mutante "a Rota muda fora do delta aprovado" ainda é
  pego), kit do Home (e `--counterfactuals`), module-loader: ok.
- **CORE 15/15** (`CORE_BATTERY_PASSED`, evidência batendo, imutabilidade da
  árvore provada) — `production-diagnostic-boundary` exige um `.next`; num
  contêiner novo sem build ele diverge, com build passa (igual na base).
  **DEEP**: as 5 evidências batem (1080 estruturais, 270 contínuas,
  recuperação, desempenho).
- Game 03, Home, Circuito: nenhum arquivo de produto tocado (O29: só
  `src/games/escape-maze/` mudou).

## 7. Limitações

- Uma variante só: as Rotas 2 e 3 sempre têm a passagem, a Rota 1 nunca. Sem
  variedade de objetivos ainda (deliberado).
- A solucionabilidade adversarial exata é pré-Baú e amostral (72 mapas): o
  caminho da Picareta não está no modelo adversarial; está no estrutural (720
  mapas) e no runtime (20 vitórias pela Picareta).
- **Achado pré-existente (não desta missão):** o solver de referência
  (ROTA-DYNAMIC-SOLVABILITY-01) discorda do hook em algumas transições quando
  há armadilhas armadas perto das portas da Sentinela — a contabilidade de
  compromisso da Sentinela (alvo/turnos restantes), não as posições
  (subconjunto "porta segurada virou armadilha armada"). Medido numa corrida
  direta ao portal na Rota 1: 25 de 2016 transições, **idênticas** na árvore
  v1 `9f8ebb5` e nesta. Não muda nenhuma classe da DYNAMIC-TRAPS-01 nem desta
  missão (nenhum mapa mudou de classe), mas é uma lacuna real do modelo.
- O painel foi lido em SwiftShader a 480×360 e 360×640; em telas reais
  maiores ele fica numa linha. Só o playtest diz se "Passagem marcada" é
  entendido sem abrir os detalhes.

## 8. Perguntas para o playtest

1. Na Rota 2, a pessoa entende **antes** de andar que o portal também espera a
   passagem marcada? Ela olha a lista?
2. "Passagem marcada" + a runa lilás bastam para achar a parede certa no
   tabuleiro?
3. Quem escolhe a Picareta pensa em usá-la na passagem? Quem escolhe a Segunda
   Chance se sente punido?
4. Chegar ao portal cedo e ler "As luzes estão prontas. Falta abrir a passagem
   marcada." é calmo, ou frustra?
5. A ordem (luzes primeiro / passagem primeiro) vira uma decisão real ou um
   detalhe?
6. A Rota 1 continua parecendo a mesma (nenhuma lista nova)?

## 9. Validadores anteriores que leem o delta aprovado

O que mudou nas ferramentas, e por quê (nenhum contrato enfraquecido):

- `route-module-loader.mjs` `treeBeforeRota2`: a cadeia — os hunks desta
  missão (`rota2-dependent-objectives-edit.json`) primeiro, depois os da
  DYNAMIC-TRAPS-01; o módulo novo some da visão. As suítes C1–C7C, o lock do
  Game 03 e o kit do Home leem a Rota de antes da Rota 2.0 como antes.
- `rota2-dynamic-traps-edit.mjs`: confere o manifesto dele depois de reverter
  esta missão (o manifesto é da árvore para a qual foi escrito).
- `gameplay-platform-lock-v1.mjs`: a missão em `ROTA2_APPROVED_MISSIONS` (sem
  ação, evento ou campo), R4 (campos do estado = v1 + aprovados) e R5 (módulo
  de objetivos puro, plano aprovado).
- `route-runtime-harness.mjs` `playToEnd("win")`: com o portal ainda dormindo
  depois da última luz, vai à armadilha ligada. Em árvore anterior (ou na Rota
  1) o portal acorda com as luzes e nada muda.
- `rota2-dynamic-traps-tests.mjs` T27 ("Rota sem ativação ≡ v1"): nas Rotas
  2/3 esse contrato é **substituído** por esta missão (O10/O16) numa árvore cujo
  hook diz que a passagem é exigida; a Rota 1 continua presa à v1 (9 partidas).
- `rota2-dynamic-traps-census.mjs`: o solver recebe a regra de vitória do
  próprio hook (`requirePassage`); a evidência bate sem mudança.
- `rota2-dynamic-traps-browser-probe.mjs`: a frase da ativação na Rota 2.
- `hidden-objects-final-lock-tests.mjs` P01, `home-atelier-kit-tests.mjs` K10:
  um arquivo que a visão revertida diz não existir e que a base não tinha é
  exatamente o módulo acrescentado por uma missão aprovada.
- `game-continuation-contract-tests.mjs` I1: os imports de runtime do hook
  incluem `route-objectives` numa árvore que o tem. `route-board-loader-tests`
  R2: a prop `portalActive`. Os stubs do estado do hook
  (continuação, carregador, jornada) carregam `objectives` (uma árvore
  anterior não o lê).
