# MindFlow — Game 03 Skeleton 01 · Estúdio das Descobertas (V0)

Missão GAME03-SKELETON-01. Branch `feat/game03-skeleton-01`, base
`f9254429feac68fb03329c28dec0d6e97686de14` (`docs(game03): define hidden-object
discovery`). Decisão humana: a Trilha Lógica (`number-trail`) sai do produto e o
Estúdio das Descobertas (`hidden-objects`) ocupa o slot dela —
`GAME03_REPLACEMENT_DECISION = APPROVED` (`docs/GAME03_DISCOVERY_01.md` §20.4).

**Estado: skeleton V0 / protótipo jogável.** A arte é provisória, a mecânica é a
da Discovery e o que vem depois depende do playtest humano (§7,
`GAME03_FUN_GATE`). Rota Estratégica e Circuito de Memória continuam travados
pelo `docs/GAMEPLAY_PLATFORM_LOCK_V1.md` e não foram tocados.

---

## 1. O que existe

Pela Home, no slot onde estava a Trilha: transição → intro → preparar
(Fácil/Médio/Difícil) → cena → arrastar, aproximar (roda, pinça, + e −),
estações Janela/Mesa/Estante, Recentrar → tocar nos objetos da lista →
progresso → Pista (3 degraus) → lista completa → "Estúdio explorado" →
"Concluir exploração" → `RewardResultModal` → "Praticar outra vez" (sessão
nova) ou "Continuar jornada". Recomeçar e Voltar à jornada a qualquer momento.
Desktop (painel lateral) e celular (bandeja inferior), retrato e paisagem.

## 2. Arquitetura (`src/games/hidden-objects/`)

| Módulo | Papel | Depende de |
| --- | --- | --- |
| `hidden-objects-scene.ts` | a cena como **dados**: 3200×1600 su, 3 estações, 10 alvos (forma de hit, nível, estação, pistas), listas por dificuldade, camadas e suas áreas pintadas | só tipos |
| `hidden-objects-camera.ts` | câmera **pura**: cover, clamp, zoom focal, pinça, estações, Recentrar, enquadramentos de pista, parallax, roda, conversões client → viewport → cena | cena |
| `hidden-objects-gesture.ts` | **um** reconhecedor TAP/DRAG/PINCH puro (máquina de estados) | câmera (tipos) |
| `hidden-objects-model.ts` | regras **puras**: hit test, sessão (`setup → playing → completed`), escada de pistas, halos, textos, `GameResult` | cena |
| `hidden-objects-controller.ts` | liga o DOM à câmera **sem React**: Pointer Events + captura, roda, teclado, `ResizeObserver`; o único lugar que escreve no DOM, dentro de `requestAnimationFrame` | câmera, gesto |
| `HiddenObjectsScene.tsx` | a sala: viewport focável, mundo 3200×1600 com as camadas WebP, camada de feedback, botões de câmera, `SceneReadiness` | controlador, modelo |
| `HiddenObjectsGame.tsx` | sessão (`useReducer`), HUD, preparação, conclusão, contrato com o shell | tudo acima |
| `hidden-objects.css` | estilos `.hos-*`, só deste jogo | — |

- A câmera **não passa pelo React**: o controlador guarda a câmera, escreve
  `transform` e `--hos-scale` no máximo uma vez por frame e só fala com o React
  em momentos discretos — um toque aceito (`onTap`) e uma vista assentada
  (`onSettle`, deduplicada). Zero render por `pointermove` (medido, §9).
- Sem mega-hook, event bus, Worker, framework de reducer, ECS, scene engine ou
  câmera genérica. Nada da Rota (`route-*`, `useEscapeMaze`, Babylon) nem do
  Circuito (`color-sequence`) é importado; o grafo do jogo são estes 8 arquivos.
- Plataforma: `GameId` `hidden-objects`; loader com `import()` literal (chunk
  próprio, fora do grafo inicial da Home); contrato de entrada
  `{ readiness: "explicit" }` com o watchdog padrão (12 s); sem continuação
  (“Praticar outra vez” é sessão nova pelo fluxo normal do App Shell).
  `GameScreen` e o App Shell não conhecem o jogo.
- **Readiness**: `onEntryReady` só depois de as três camadas essenciais
  (fundo da janela, prancha, primeiro plano) carregarem **e** decodificarem, do
  controlador estar montado (layout medido, câmera escrita) e de mais dois
  frames (uma oportunidade de pintura). Falha de carga ou de decode de camada
  essencial → `onEntryError` uma vez (retry do shell, sem esperar o watchdog).

### 2.1 Mudanças compartilhadas (classe 5 do lock: requisito do segundo consumidor real)

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/types/game.ts` | `GameId`: `number-trail` → `hidden-objects` | substituição aprovada |
| `src/games/entry-contract.ts` | entrada `hidden-objects: { readiness: "explicit" }` | o jogo reporta a própria pintura |
| `src/games/index.ts` | loader `import("@/games/hidden-objects/HiddenObjectsGame")` | registry lazy |
| `src/data/activities.ts`, `src/engine/stage-progress.ts` | a atividade e a posição 4 do mapa passam a ser do Estúdio | mesmo slot |
| `src/data/worlds.ts`, `src/data/game-intros.ts` | mundo `discovery`, nome, habilidade, intro | metadados do jogo |
| `src/components/home/homeLayout.ts`, `src/styles/home.css`, `src/components/worlds/worldVisuals.ts`, `src/components/worlds/WorldEmblem.tsx`, `src/components/worlds/diorama/worldDioramaLayout.ts` | o slot da Trilha (mesma geometria) vira o do Estúdio; emblema, cores, transição e maquete provisória | Home sem redesenho |
| `src/engine/rewards.ts` | `isSuccessfulResult`: `details.completed === true` conta como sucesso; cópia "Estúdio explorado" | um jogo sem vitória/derrota (não havia esse caso) |
| `src/lib/detail-labels.ts` | rótulos de `foundObjects`, `totalObjects`, `completed` | tela de resultado |
| `src/engine/scoring.ts` | sai a pontuação da Trilha | código morto após a aposentadoria |
| `src/components/three/*` (lab `/lab/3d-home`) | `LogicWorld3D` → `DiscoveryWorld3D`, paleta `discovery` | o laboratório lê as mesmas tabelas |
| `tools/validation/game-readiness-registry-tests.mjs`, `game-entry-watchdog-registry-tests.mjs`, `game-continuation-contract-tests.mjs` | os cinco jogos fixados passam a ser os cinco ativos (Estúdio no lugar da Trilha); em `--rev` anterior, o pino do Estúdio cai fora porque o arquivo não existe | asserts mantidos, com a verdade nova |

Nenhum contrato do §4 do lock mudou: `gameplay-platform-lock-v1` segue 18/18 e
os contrafactuais seguem válidos.

## 3. Cena, alvos e dificuldade

**Cena** "Estúdio do Explorador", 3200×1600 su (2:1), DOM 2.5D: três camadas
WebP num elemento-mundo com `transform` — fundo da janela (parallax 0,92),
prancha (1,0) e primeiro plano à esquerda (1,05) — mais a camada de feedback.
Estações: **Janela** (0–1060 su), **Mesa** (1060–2140), **Estante** (2140–3200).
Arte: opção B — prancha limpa provisória desenhada em SVG por
`tools/assets/create_hidden_objects_scene.mjs` (determinística; lê as regiões de
`hidden-objects-scene.ts`, então a arte não deriva dos dados do hit test). O
mockup conceitual fica só como referência em
`docs/archive/hidden-objects/explorer-studio/reference/`.

| Alvo | Nível | Estação | Forma (su) | Pista 2 |
| --- | --- | --- | --- | --- |
| Ampulheta | A | Janela | rect 742,952 116×222 | na mesinha junto à janela |
| Binóculo | B | Janela | rect 424,930 152×78 | no peitoril da janela |
| Chave antiga | C | Janela | rect 452,1246 132×56 | sobre o baú |
| Lupa | A | Mesa | círculo 1760,1040 r92 | sobre o mapa |
| Bússola | B | Mesa | círculo 1540,1160 r66 | na borda do mapa |
| Relógio (de bolso) | C | Mesa | círculo 1330,1178 r48 | perto do livro aberto |
| Barco em miniatura | A | Estante | rect 2360,615 290×215 | na prateleira do meio |
| Lanterna | A | Estante | rect 2780,848 126×212 | nas prateleiras de baixo |
| Câmera (fotográfica antiga) | B | Estante | rect 2720,480 166×118 | na segunda prateleira |
| Estatueta | C | Estante | rect 2615,245 84×122 | na prateleira mais alta |

| Dificuldade | Lista (fixa, sem sorteio) | Níveis | Lista mostra | Raio da pista 2 | Tolerância toque / mouse |
| --- | --- | --- | --- | --- | --- |
| Fácil | Lupa, Ampulheta, Barco, Lanterna, Bússola | 4A + 1B | imagem | 240 su | 16 / 8 px |
| Médio | Ampulheta, Binóculo, Bússola, Relógio, Câmera, Lanterna | 2A + 3B + 1C | silhueta | 300 su | 12 / 6 px |
| Difícil | Binóculo, Chave, Lupa, Bússola, Relógio, Barco, Câmera, Estatueta | 2A + 3B + 3C | palavra | 380 su | 10 / 5 px |

Difícil é 2A+3B+3C, não o 1A+4B+3C preferido: com um pool de 10 que precisa dos
4 A do Fácil, 4 B e 3 C não cabem (4 + 4 + 3 = 11). Sem cronômetro, vidas,
erros, ranking, pontuação ou sequência.

**Fairness automatizada** (`hidden-objects-skeleton-tests.mjs` H27): todo alvo
dentro da sala e fora das margens de segurança; nenhuma sobreposição (menor
distância entre alvos: 72 su); cada alvo na sua estação, cada estação com ≥ 3,
cada lista visita as três; a pintura do primeiro plano, no seu deslocamento
máximo de parallax mais 24 su, não cobre nenhum alvo; em 6 viewports
(desktop, laptop, tablet, celular, celular pequeno, celular deitado) a câmera
enquadra cada alvo inteiro e fora do HUD; no celular de referência todo alvo
tem ≥ 32 px na vista inteira e ≥ 44 px efetivos no zoom máximo; nenhum nome de
alvo é uma cor. Percepção (reconhecível, inequívoco) fica para o playtest.

## 4. Câmera e gestos

- **HYBRID**: pan livre dentro dos limites "cover" (nunca aparece vazio fora da
  sala), zoom, três estações e Recentrar só quando pedidos; nenhum snap.
- `MIN_ZOOM = 1` (cover), `DEFAULT_ZOOM = 1`, máximo
  `clamp(1,25 px/su ÷ cover, MAX_ZOOM_FLOOR 2, MAX_ZOOM_CEILING 4)`,
  `ZOOM_STEP = 1,25` (+/−). Roda: fator `2^(−Δ/500)` (pinça de trackpad
  `2^(−Δ/100)`), limitado a 0,8–1,25 por evento, no cursor. Pinça ancorada no
  centróide inicial, que acompanha os dedos (pinça + pan num gesto só).
- Teclado na cena (focável, mira no centro): setas (12 % da vista; Shift 30 %),
  + e −, 1/2/3 para as estações, 0 Recentrar, Enter/Espaço tocam na mira.
- Deslizamentos de estação/pista: 450 ms com ease; **reduced motion** corta
  direto, sem parallax e sem fades.
- **Um reconhecedor**: toque se mover no máximo 14 px (toque/caneta) ou 6 px
  (mouse) e durar ≤ 1 s; o ponto do toque é o do `pointerdown`. Arrastar nunca
  seleciona; um gesto que teve dois ponteiros nunca seleciona (o segundo vira
  pinça); `pointercancel`/perda de captura nunca seleciona; o toque que para um
  deslizamento da câmera nunca seleciona. Botão não primário e terceiro dedo
  são ignorados. Pointer capture por ponteiro, liberado no fim e no unmount.
- **Sem inércia** nesta missão: a sala para quando o dedo sai.
- Coordenadas: `clientToViewport` → `viewportToScene` (inverso da câmera) →
  `hitTest` nas formas em su; a tolerância é em px de tela, convertida pela
  escala do momento.

## 5. Pistas, fim e resultado

- **Pista** (botão explícito, sem custo, nunca automática), por objeto — o
  escolhido na lista ou o primeiro que falta: 1) nomeia a zona e leva a câmera
  à estação; 2) acende um halo suave que contém o objeto sem centrar nele;
  3) "Mostrar onde está": enquadra o objeto (25 % do lado menor) com um halo
  temporário (6,5 s). Achar o objeto apaga a pista.
- Achado: brilho suave + selo de check no objeto, item marcado na lista,
  anúncio `aria-live`. Toque livre: só uma onda discreta, nada registrado.
- Fim: o cartão "Estúdio explorado" aparece 700 ms depois do último achado;
  "Concluir exploração" chama `onComplete` **uma vez**; "Continuar olhando"
  fecha o cartão e mantém "Concluir exploração" no painel.
- `GameResult`: `activityId`/`gameId` `hidden-objects`, `activityTitle`
  "Estúdio das Descobertas", `score` = objetos encontrados (5/6/8; valor neutro,
  nunca reduzido por pistas ou toques), `summary` "Você encontrou todos os
  objetos do Estúdio.", `details` `{ difficulty, foundObjects, totalObjects,
  completed }`. Sem `elapsedTime`.
- Recomeçar: mesma dificuldade e lista, limpa achados, pista e câmera, volta a
  `playing`, sem recarregar. Voltar à jornada: `onExit`, sem resultado parcial;
  o unmount solta listeners, rAF, timers, captura e o `ResizeObserver`.

## 6. Trilha aposentada e histórico

- Saíram do produto: `NumberTrailGame.tsx`, a pontuação da Trilha, o
  `LogicWorld3D` do laboratório e a Trilha de todas as tabelas. A arte da Home
  foi para `docs/archive/number-trail-retired/` (nada em `public/` a serve).
- **Histórico** (compatibilidade de leitura, sem migração): nenhum resultado é
  apagado, filtrado ou convertido; `getRecentResults` devolve os resultados da
  Trilha como foram gravados e um resultado novo entra à frente. Um id
  aposentado não abre nada (sem loader, contrato ou atividade); como resultado
  mais recente ele só deixa de pré-selecionar um mundo (a Home cai no primeiro
  do mapa). Hoje nenhuma tela lista o histórico salvo; a primeira que listar
  precisa de um metadado de exibição para mundos aposentados (o fallback de
  `getWorldMeta` é o Circuito).

## 7. `GAME03_FUN_GATE` — protocolo de playtest

O teste humano acontece com o skeleton publicado (preview do Vercel). Não é um
estudo formal: é a prova de que "explorar essa cena e procurar coisas é
gostoso".

- **Quem**: 5 a 8 pessoas, ao menos 3 com 60+ anos; ao menos metade no celular.
- **Como**: abrir pela Home sem explicação além da intro; jogar Fácil e depois
  Médio (Difícil para quem quiser). Observar em silêncio; anotar; perguntar no
  fim.
- **Perguntas centrais** (resposta + uma frase do porquê):
  1. Entendeu o objetivo sem explicação extra?
  2. A câmera pareceu natural (arrastar, aproximar, estações)?
  3. Encontrou os objetos de forma justa? Algum pareceu injusto ou invisível?
  4. Teve vontade de explorar a sala além da lista?
  5. A pista ajudou sem entregar cedo demais?
  6. No celular: confortável? Algo pequeno demais ou escondido pelo painel?
  7. Jogaria outra cena?
- **Observar**: tempo até o primeiro achado; toques livres por achado; uso de
  Pista e de "Mostrar onde está" por objeto; uso de zoom (Médio/Difícil);
  seleções acidentais; pans acidentais em toques; onde desistiu; reação ao
  resultado.
- **Passa** quando: ≥ 4 de 5 entendem sozinhos; ninguém descreve a câmera como
  confusa ou enjoativa; nenhum alvo é apontado como injusto por mais de uma
  pessoa; seleções acidentais ≤ 1 por sessão; a maioria responde "sim" à
  pergunta 7.
- **Resultado**: `GAME03_FUN_GATE = PASS` (próxima missão: arte definitiva e
  segunda cena), `ADJUST` (calibrar os itens de §8 e repetir) ou `FAIL` (rever o
  conceito antes de investir em arte).

## 8. `TO_VALIDATE_IN_SKELETON`

| # | Item | Valor no skeleton |
| --- | --- | --- |
| T1 | Limiar e duração do toque | 14 px toque/caneta, 6 px mouse, 1000 ms, ponto do `pointerdown` |
| T2 | Tolerância de toque por dificuldade | 16/12/10 px (toque), 8/6/5 px (mouse) |
| T3 | Níveis A/B/C e listas 5/6/8 | §3 (Difícil 2A+3B+3C) |
| T4 | Pistas | raios 240/300/380 su, deslocamento 40 %, enquadramento 25 %, halo 6,5 s |
| T5 | Parallax | 0,92 / 1,05 (desligado em reduced motion) |
| T6 | Zoom | máx. `clamp(1,25 px/su ÷ cover, 2, 4)`, passo 1,25, roda 500/100, 0,8–1,25 por evento |
| T7 | Tempos | deslizamento 450 ms, cartão final 700 ms, roda assenta em 160 ms |
| T8 | Inércia | não implementada |
| T9 | Respiro para toques repetidos | hipótese, não implementado (toque livre não custa nada) |
| T10 | Bandeja do celular | cena com 74 % da altura em 390×844; lista em uma linha rolável; coluna de 15,5 rem deitado |
| T11 | Tela de resultado compartilhada | mostra "Modo: Aberto" (formatador comum), "Continue sua rota no seu ritmo", confete e o placar 5/6/8 em destaque — aceita como está |
| T12 | Mira de teclado, `role="application"`, anúncios | testado só em Chromium; falta NVDA/VoiceOver |
| T13 | Nitidez e custo do zoom DOM | medido só em Chromium/SwiftShader; falta iOS Safari e Android Chrome |
| T14 | Prontidão em rede lenta | watchdog padrão de 12 s; essenciais 205 KB |
| T15 | Rejogabilidade | listas fixas; a dificuldade não é lembrada entre sessões |
| T16 | Estado "encontrado" | brilho + selo (a Discovery pedia recorte alinhado; fica para a arte final) |
| T17 | Som | não ligado |
| T18 | Maquete da Home | vetorial provisória ao lado de mundos renderizados |
| T19 | Convite à pista após inatividade | não existe |

## 9. Medições

- **Bundle** (build de produção, mesmo medidor no base e aqui):
  Home inicial JS 772 946 → 773 153 B (+207 B; gzip +21 B), CSS 208 934 →
  206 111 B (−2,8 KB: utilitários usados só pela Trilha); chunk da Trilha
  (16,1 KB) sai; conjunto lazy do Estúdio 31 937 B JS (10 537 gzip) + 12 926 B
  CSS (3 551 gzip), sem Babylon, Rota ou Circuito; Rota 55 385 B, Circuito
  19 502 B (−146 B cada: ids de chunk; fonte idêntica), Babylon 8 028 358 B
  (idêntico), ainda lazy.
- **Assets** (WebP, versionados em `public/assets/hidden-objects/explorer-studio/v0/`):
  prancha 3200×1600 173,1 KB, janela 920×1000 10,5 KB, primeiro plano
  360×1600 21,2 KB (essenciais 204,7 KB), 10 miniaturas 160×160 30,6 KB, arte
  de transição/intro 960×720 32,0 KB — entrada 267,4 KB (meta ≤ 1,3 MB). Sem
  variante mobile (uma prancha serve os dois). Maquete da Home: 7 passes
  1040×780, 96,8 KB.
- **Performance** (Chromium headless, SwiftShader): arrasto no desktop, 24
  `pointermove` → 0 commits React, 24 escritas de estilo, 0 long tasks; no
  celular, 16 movimentos de toque → 0 commits. Clique em Entrar → cena revelada:
  4,1–6,6 s no desktop (1,5 s é a animação fixa de cobertura; cada frame em
  rasterização por software leva 0,4–0,8 s — a Central de Comandos leva 1,34 s
  de `preparing` a `ready` nas mesmas condições, o Estúdio 2,06 s, dos quais
  ~150 ms de decode), 1,2–1,9 s no celular. 60 fps não é prometido: não foi
  medido em GPU real.

## 10. Validação

```bash
node tools/validation/hidden-objects-skeleton-tests.mjs                    # 38 checks, sem browser (~8 s)
node tools/validation/hidden-objects-skeleton-tests.mjs --counterfactuals  # base f9254429 + 18 mutantes em memória (~35 s)
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-browser-probe.mjs                     # 61 checks; --out/--json gravam testemunhas
```

Testemunhas visuais e o registro da última execução do probe:
`docs/archive/game03-skeleton-01/`.

## 11. Limitações visuais e próximos passos

- A prancha é um desenho vetorial limpo e plano — clara para o hit test, mas
  longe da densidade e da luz do mockup. A maquete da Home é vetorial ao lado de
  mundos renderizados. Não há recortes de "encontrado", som, inércia nem cena 2.
- Próximos passos, nesta ordem: publicar e rodar o `GAME03_FUN_GATE`; calibrar
  os itens de §8 com o que o playtest mostrar; só então arte definitiva
  (pipeline da Discovery §17), recortes de "encontrado" e a segunda cena; a
  primeira tela de histórico precisa de metadado para mundos aposentados.
