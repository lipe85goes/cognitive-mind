# MindFlow — Game 03 Discovery 01 · Estúdio das Descobertas

Missão: GAME03-DISCOVERY-01. Pergunta que este documento responde: **o que
exatamente é o Game 03, com que tecnologia ele nasce, o que ele usa da
plataforma travada e qual é o menor skeleton jogável que vale construir?**

- Repositório `lipe85goes/cognitive-mind`, branch
  `discovery/game03-hidden-objects-01`, base
  `0e5e7642b83a9900847ec546b1cc0d3bd001e18f`
  (`chore(platform): lock gameplay platform v1`).
- Missão **somente de documentação**: nenhum arquivo de `src/`, nenhum
  `package.json`/lockfile, nenhum contrato travado e nenhum documento do lock
  foi alterado. Este arquivo é a única mudança.
- Respeita `docs/GAMEPLAY_PLATFORM_LOCK_V1.md`: o Game 03 é o primeiro novo
  consumidor da plataforma depois do lock. Regra aplicada em todo o documento:
  **second consumer first, abstraction second**.

Convenções: **su** = unidade de cena (1 su = 1 px da prancha no tier `m`,
§16); "Explorador" = quem joga; números marcados `TO_VALIDATE_IN_SKELETON`
são escolhas concretas que o playtest do skeleton pode ajustar (§24).

---

## 1. Executive summary

O Game 03 é um jogo de **exploração visual / objetos escondidos**: o
Explorador recebe uma pequena lista de objetos, explora uma sala ilustrada
rica em detalhes (arrastar, aproximar, três "estações" nomeadas), toca no
objeto quando o encontra e recebe um retorno calmo. Não há cronômetro,
ranking, vidas nem erro punido. A sessão termina quando a lista está
completa, com um fechamento tranquilo e o `GameResult` normal da plataforma.

### 1.1 Decisões em uma tela

| Chave | Decisão |
| --- | --- |
| `GAME03_PROVISIONAL_NAME` | **Estúdio das Descobertas** — "Explore e encontre". `GameId` proposto `hidden-objects`; `WorldKey` `discovery`; primeira cena `explorer-studio` (§2) |
| `GAME03_CORE_LOOP` | preparar (dificuldade) → explorar → tocar → retorno calmo → marcar na lista → … → lista completa → fechamento → `onComplete` (§4) |
| `GAME03_SCENE_THEME` | Estúdio do Explorador na hora dourada, cena 2:1 (3200×1600 su), 3 zonas: **Janela · Mesa · Estante** (§5) |
| `GAME03_SCENE_TECH` | **`DOM_2_5D`** — camadas WebP com `transform` num elemento-mundo; câmera, gestos e hit test independentes do renderer (§14, §15) |
| `GAME03_CAMERA_MODEL` | **HYBRID** — livre dentro de limites "cover" + 3 estações por ação explícita + Recentrar; nenhum snap automático (§6) |
| `GAME03_INPUT_MODEL` | um reconhecedor de Pointer Events na superfície da cena: toque = sem movimento além de 14 px (toque/caneta) ou 6 px (mouse), nunca multitoque; hit test geométrico em su; mira de teclado (§7) |
| `GAME03_TARGET_MODEL` | alvos **pintados na prancha mestre** + recorte alinhado por construção para o estado "encontrado" + forma de hit da parte visível; pool de 10 alvos em 3 níveis de encontrabilidade A/B/C (§8) |
| `GAME03_DIFFICULTY_MODEL` | quais alvos são pedidos (5/6/8, mistura de níveis A/B/C) + como a lista mostra o objeto (imagem → silhueta → palavra) + força da pista + tolerância de toque. Tempo nunca (§10) |
| `GAME03_HINT_MODEL` | botão **Pista** explícito, progressivo por objeto (2 estágios que enfraquecem com a dificuldade) → **Mostrar onde está** opcional. Sem espera, sem custo (§11) |
| `GAME03_ASSET_PIPELINE` | mockup → briefing → geração por zona → master Photoshop 6400×3200 com camadas nomeadas → limpeza e auditoria de iscas → passe de fairness → exports sem perda → script `sharp` → `public/assets/hidden-objects/explorer-studio/v1/` (§17) |
| `GAME03_PLATFORM_REUSE` | registry + `import()` próprio, contrato de entrada `explicit` com watchdog padrão, `GameScreen`, transição/retry, intro, `GameComponentProps`, `GameResult` + persistência do shell, `RewardResultModal`, metadados de mundo, `lib/game-sounds`, convenções de validação. **Zero refactor da plataforma** (§18) |
| `GAME03_LEGACY_SLOT_RECOMMENDATION` | **`number-trail` (Trilha Lógica)** — aposentar quando o Game 03 for promovido; `security-panel` é o segundo candidato, mais tarde; `seed-garden` fica (§20) |
| `GAME03_SKELETON_SCOPE` | entrada **só por rota de laboratório** pelos componentes reais da plataforma; 1 cena, 3 estações, pool de 10 alvos, listas 5/6/8, pan/zoom/pinch/teclado, pista, conclusão, resultado, restart, readiness (§22) |
| Babylon | **NÃO** (quebraria o gate A5 do lock; §15) |
| `GAME03_NEW_RUNTIME_DEPENDENCY_REQUIRED` | **NO** (§15.3) |

### 1.2 O que a auditoria mudou em relação à intuição inicial

1. **A preferência A (2.5D) estava certa, e por um motivo mais forte que
   "é mais simples"**: a linguagem 2.5D oficial do MindFlow *já é* DOM +
   WebP em camadas (Home "Ateliê dos Mundos", maquetes em camadas, board
   mestre do Circuito). Babylon, além de 1,73 MB gzip lazy e 9,5–14,8 s de
   entrada medidos no mobile da Rota, **violaria o gate A5 do lock** ("Babylon
   só por `import()` e só a partir de `RouteBabylonBoard`").
2. **A lição do Circuito vale para os alvos**: PNGs soltos colados em
   perspectiva "nunca encaixaram" (`MEMORY_CIRCUIT_ASSET_SPEC.md`). Por isso
   os alvos são pintados na prancha mestre e o estado "encontrado" usa um
   recorte da mesma composição, alinhado por construção — nada de adesivos.
3. **A dificuldade não precisa de arte por dificuldade**: a mesma cena tem
   10 alvos de encontrabilidade diferente; a dificuldade escolhe quais pedir
   e como apresentá-los. Uma prancha serve às três dificuldades.
4. **O mockup esconde dois problemas de fairness**: "Planta" num quarto com
   dezenas de plantas e "Livro azul" (depende de cor) não são alvos justos;
   e cerca de 30% da imagem está coberta por UI sobreposta à cena (§3).
5. **A Trilha Lógica é um exercício de busca visual em forma de teste**: a
   ordem dos alvos é sorteada (`shuffledValues`) — o Explorador procura o
   número mostrado entre pedras embaralhadas. É o mesmo domínio cognitivo do
   Game 03, numa forma abstrata que lembra teste clínico (§20).
6. **A plataforma aguenta o Game 03 sem refactor**, mas o registro de um
   `GameId` toca 12 tabelas de `src/` (D15) e 3 suítes de validação que fixam
   a lista de jogos. O skeleton mede essa dor; não consolida nada (§18.3).

### 1.3 Contrafactual da Discovery

| | Game 03 |
| --- | --- |
| **ANTES** | ideia + mockup + intenção ("hidden objects calmo, talvez 2.5D") |
| **DEPOIS** | contrato de produto (loop, câmera, gestos, alvos, fairness, dificuldade, pistas, feedback, acessibilidade) + decisão técnica explícita (`DOM_2_5D`, sem Babylon, sem dependência nova) + orçamentos + pipeline de assets + fronteiras com a Rota + slot legado escolhido + skeleton com escopo, critérios de aceite e gate de diversão |

### 1.4 As 20 perguntas da missão

| # | Pergunta | Resposta curta | Seção |
| --- | --- | --- | --- |
| 1 | Loop principal | preparar → explorar → tocar → retorno → lista → fechamento | §4 |
| 2 | Câmera | livre em limites "cover" + 3 estações + Recentrar | §6 |
| 3 | Construção da cena | janela (fundo) + prancha mestre + frente + efeitos, em DOM | §5, §15 |
| 4 | Representação dos alvos | pintados na prancha + recorte alinhado + forma de hit da parte visível | §8 |
| 5 | Como encontrar | toque/clique sem arrasto sobre a forma visível, com tolerância em px de tela | §7.4 |
| 6 | Toque × pan | limiar de 14 px (6 px no mouse); multitoque nunca vira toque; toque que para a câmera não seleciona | §7 |
| 7 | Celular | retrato como referência; uma zona por tela; dock inferior; gestos padrão + botões | §5.7, §6, §7, §13 |
| 8 | Zoom/pinch | pinch ancorado no centróide; roda no cursor; +/−; limites por escala absoluta | §6.2, §7 |
| 9 | Dificuldade sem timer | alvos pedidos + forma da lista + força da pista + tolerância | §10 |
| 10 | Pista | botão explícito, progressiva, depois "Mostrar onde está" | §11 |
| 11 | Objeto injusto | contrato de fairness F1–F14 | §9 |
| 12 | Fim | lista completa → fechamento → "Concluir exploração" → resultado | §4, §12 |
| 13 | Reuso da plataforma | registry, entrada, intro, props, resultado, persistência, metadados | §18 |
| 14 | Específico do Game 03 | câmera, gestos, hit test, sessão, cena, HUD, assets | §18.4, §19 |
| 15 | Slot legado | `number-trail` | §20 |
| 16 | Menor skeleton | rota de lab + 1 cena + 10 alvos + listas 5/6/8 | §22 |
| 17 | Assets do skeleton | prancha m/s, janela, 1 recorte de frente, 10 recortes, 10 miniaturas, arte de intro | §17.6, §22 |
| 18 | Ferramentas | GPT (geração) + Adobe (composição/limpeza) + `sharp` do repo (export) | §17 |
| 19 | Riscos | caça ao pixel, "mush" de IA, nitidez do zoom, lista que vira planilha… | §21 |
| 20 | Provar diversão cedo | teste de prancha antes do código + gate de diversão do skeleton | §22.7, §24 |

---

## 2. Product concept

**Nome provisório:** Estúdio das Descobertas. **Subtítulo:** Explore e
encontre. **Linha de habilidade:** "Atenção e observação". **Convite:**
"Observe com calma e descubra o que se esconde."

**Intenção cognitiva** (princípio 7 do Experience Book):

- atenção visual seletiva e busca visual (achar um alvo entre distratores);
- percepção figura-fundo (objeto parcialmente encoberto, camuflado no
  material ao redor);
- atenção sustentada sem pressa (explorar uma cena inteira);
- memória espacial leve ("eu já olhei a estante");
- correspondência semântica no Difícil (palavra → objeto, sem imagem).

**Promessa de experiência:** "Há mais do que parece à primeira vista." O
Explorador deve sentir curiosidade e calma — vontade de aproximar e olhar de
novo, não de varrer a tela tocando em tudo.

**Não deve parecer:** jogo infantil (arte adulta/premium, palavras
concretas sem tom escolar); teste clínico (nada de grade, cronômetro,
contagem de erros, "acertos"); caça-palavras escolar (a lista é de objetos
com imagem/silhueta, não uma planilha de palavras); jogo mobile genérico
(sem moedas, energia, estrelas, recompensas diárias); ranking ou pressão.

**Para quem** (Experience Book): idosos, pessoas com Alzheimer, crianças com
autismo, pessoas ansiosas. Consequências diretas no design: lista com
imagem no Fácil; nomes simples ("Lupa", "Xícara", não "astrolábio"); nenhum
limite de tempo; nenhum fim por falha; nenhum beco sem saída (sempre há
"Mostrar onde está"); feedback previsível; nada pisca.

**Teste "Isso ajuda o Explorador a pensar em paz?"** aplicado às escolhas
deste documento: sem cronômetro (sim); toque errado silencioso (sim);
pista sem custo (sim); câmera que não se mexe sozinha (sim); fechamento sem
explosão dentro da cena (sim); confete da tela de resultado da plataforma
(a validar, §24).

---

## 3. Mockup analysis

O mockup (1672×941, "Mockup conceitual") mostra: barra superior com marca
MindFlow, título "Estúdio das Descobertas" e o lema "Observe · Explore ·
Descubra · Exercite sua mente"; à esquerda um cartão "Mover — Arraste para
explorar a cena / Zoom — Use o scroll para aproximar ou afastar"; à
direita um seletor "Dificuldade: Fácil | Médio | Difícil", um painel
"Objetos para encontrar — 3/8 encontrados" com barra de progresso e seis
itens (Lupa ✓, Relógio ✓, Chave ✓, Planta, Livro azul, Lanterna), um botão
"Explorar →" e a frase "Um pequeno grande mundo de descobertas o espera";
no canto inferior esquerdo "Observe com calma… Há mais do que parece à
primeira vista." A cena: sala de explorador na hora dourada — janela em
arco com lago, vila e montanhas; poltrona de couro com manta e um gato
dormindo; mesa redonda com livro aberto, mapa, lupa grande, bússola,
xícara com vapor, caixas; estantes com barco, câmera, busto, quadros
(borboleta), relógio de parede, globo, lanterna acesa, muitas plantas;
baú, esfera armilar e tapete persa.

Ele é tratado como **direção** (atmosfera, composição, densidade, qualidade,
HUD), não como screenshot, asset final nem exigência pixel-perfect.

### 3.1 KEEP — vale perseguir

- **Luz e paleta**: hora dourada quente + acentos teal; madeira, latão,
  sálvia. Bate com `MINDFLOW_VISUAL_SYSTEM.md` §3 (luz quente acolhe, teal
  foca, dourado controlado).
- **Composição em três zonas legíveis** da esquerda para a direita (janela /
  leitura, mesa, estantes) — vira o modelo de estações (§6).
- **Densidade organizada**: objetos agrupados em superfícies (estante, mesa,
  peitoril), com áreas calmas entre elas (céu, parede, tapete).
- **Painel da lista**: cartão marfim, ícone + palavra + círculo de
  confirmação, contagem "3/8 encontrados" com barra — progresso sem
  competição.
- **Confirmação por forma**: o check dentro do círculo não depende só de
  cor.
- **Copy**: "Observe com calma… Há mais do que parece à primeira vista." é
  exatamente o tom.
- **CTA "Explorar"** em pílula teal e o seletor de dificuldade em segmentos.
- **Cartão de controles** (Mover/Zoom) como orientação inicial.

### 3.2 SIMPLIFY — reduzir para a v1

- **Cabeçalho de marca/título/lema** sai da tela de jogo: a intro da
  plataforma já apresenta o mundo, e no celular a barra come altura útil.
  Fica uma barra mínima: voltar, nome curto, som.
- **UI sobreposta à cena**: somando cabeçalho (~11%), painel direito (~11%),
  CTA + frase (~4%), seletor (~1%), cartão de controles (~3%) e dica
  inferior (~2%), **≈30% da imagem fica sob UI**. Na v1 a lista vira uma
  coluna/bandeja **encaixada** (a área da cena exclui o HUD), e sobre a cena
  ficam só os botões de zoom e Recentrar num canto sem alvos (§5.6, F5).
- **Seletor de dificuldade** sai do HUD de jogo e vai para o painel de
  preparação (trocar no meio = recomeçar).
- **"Explorar →" e "Um pequeno grande mundo…"** só no painel de preparação.
- **Cartão Mover/Zoom** vira uma linha no painel de preparação (não um
  overlay permanente). "Use o scroll" é instrução só de desktop; a linha
  precisa ter a versão de toque ("Arraste · Pince ou use + e −").
- **Vapor, chama da lanterna, gato, plantas**: estáticos na v1 (cozidos na
  arte). Nenhum loop de animação ambiente.
- **Luz volumétrica, bloom, profundidade de campo**: cozidos na prancha; nada
  disso em runtime. Desfoque de profundidade só em primeiro plano extremo
  sem alvo — objeto borrado não é identificável (F1).
- **Quantidade de microdetalhes**: o mockup tem centenas; a v1 mira ~75
  objetos decorativos legíveis (§5.4).
- **A lupa gigante em primeiro plano e o relógio de parede**: como alvos
  seriam busca zero. A lupa fica como alvo A menor; o relógio vira
  decoração.

### 3.3 DO NOT PROMISE — aspiracional demais para o primeiro skeleton

- Nitidez fotográfica no zoom máximo do celular (o limite é a resolução do
  tier da prancha, §16).
- Gato, vapor, chama, plantas vivas (animação ambiente).
- Câmera 3D: girar, mudar perspectiva, "olhar atrás" de objetos. O 2.5D é
  pan, zoom e parallax leve.
- O mockup como arte final: ele tem perspectiva inconsistente (curvatura da
  mesa × linhas da estante), duas luzes dominantes competindo (janela e
  lanterna) e regiões de "massa" de IA que parecem objetos mas não são.
- Oito itens com imagem visíveis ao mesmo tempo numa bandeja de celular com
  o mesmo tamanho do painel de desktop.
- Várias cenas, narrativa, coleção, metaprogressão.
- Alvos distinguíveis só por cor.

### 3.4 Problemas do mockup que viram regra

| Observado no mockup | Regra derivada |
| --- | --- |
| Lista mostra 6 itens e o contador diz "3/8" | a lista sempre mostra todos os itens pedidos; no máximo 8 (§10) |
| "Planta" numa sala com dezenas de plantas | rótulo único dentro da cena; categoria com muitos semelhantes não é alvo (F8) |
| "Livro azul" entre dezenas de livros | rótulo nunca depende só de cor (F8, §13) |
| Lupa, relógio e lanterna são os três objetos mais salientes da cena | nível A é "visível", não "o maior da sala"; nenhum alvo é o foco da composição |
| ~30% da cena sob UI | HUD encaixado fora da área da cena; nenhum alvo em margem segura (F5) |
| Dificuldade trocável durante a busca | dificuldade escolhida antes; trocar recomeça a sessão |

**Veredito:** a atmosfera e o HUD do mockup são o alvo de qualidade certo;
a composição precisa de disciplina de fairness e o layout precisa tirar a UI
de cima da cena.

---

## 4. Core loop

```text
[GameScreen monta o jogo sob a intro]  ← assets carregam; NADA começa (mount ≠ start)
        │ onEntryReady (prancha + janela + frente + miniaturas decodificadas, +2 frames)
        ▼
PREPARAR   painel: "Estúdio das Descobertas" · Fácil / Médio / Difícil · linha de controles · [Explorar]
        │ START(dificuldade)
        ▼
EXPLORAR ◄──────────────────────────────────────────────┐
   arrastar · pinçar · roda · +/− · estações · teclado   │
   toque ──► hit test                                    │
      ├─ alvo não encontrado ─► ENCONTRADO: brilho suave, │
      │                         check na lista, "3 de 6" ─┤
      ├─ alvo já encontrado  ─► lembrete leve ────────────┤
      └─ nada                ─► onda discreta ────────────┤
   Pista ─► estágio 1 ─► estágio 2 ─► "Mostrar onde está" ┘
        │ último alvo encontrado (+900 ms)
        ▼
FECHAMENTO   cena aquece levemente · "Estúdio explorado — você encontrou os 6 objetos."
             [Concluir exploração]  [Continuar olhando]
        │ Concluir (uma única vez por sessão)
        ▼
onComplete(result) → shell salva → RewardResultModal
        ├─ "Praticar este desafio outra vez" → nova sessão (intro → preparar; sem continuação)
        └─ "Continuar jornada" → Home
```

- **Sair** a qualquer momento ("Voltar à jornada") chama `onExit`: nenhum
  resultado, timers da sessão revogados no unmount (padrão do Circuito).
- **Recomeçar** (no Apoio, com confirmação em linha) volta a PREPARAR com a
  mesma dificuldade pré-selecionada; sessão nova, timers antigos revogados.
- **Um resultado por sessão**: "Concluir" só emite uma vez (como o Circuito
  pós MEMORY-CIRCUIT-LIFECYCLE-01).
- **Sem resultado parcial** na v1: a sessão só gera resultado completa. Não
  há beco sem saída porque "Mostrar onde está" existe em toda dificuldade
  (§11).
- **Sem continuação** (`GameContinuation`) na v1: "praticar outra vez"
  recomeça do painel de preparação, com Fácil pré-selecionado. Lembrar a
  dificuldade entre sessões seria um novo membro da união com `kind`
  próprio — só se o playtest pedir (§24).
- Fora do loop v1: narrativa, metaprogressão, ranking, coleção, cronômetro.

---

## 5. Scene concept

### 5.1 Tema

**Estúdio do Explorador** (`explorer-studio`), hora dourada: luz principal
quente da janela à esquerda, preenchimento âmbar da lanterna à direita,
sombras macias, acentos teal. Paleta e materiais do Visual System (madeira,
latão envelhecido, sálvia, marfim). Linha do horizonte única a ~40% da
altura; câmera frontal levemente elevada (a mesma sensação de "objeto sobre
mesa/palco" do Visual System §3), sem distorção.

### 5.2 Formato e extensão

- **Proporção base 2:1**, sistema de coordenadas **3200×1600 su**, origem no
  canto superior esquerdo.
- Por que 2:1: no celular em retrato a cena preenche a altura e mostra
  ~1/3 da largura — **uma zona por tela**; no desktop mostra ~2/3 — **duas
  zonas e meia**. Exploração horizontal natural, com vertical só quando há
  zoom.

| Viewport de referência | Área da cena (CSS px) | Escala "cover" (px/su) | Largura visível | Altura visível |
| --- | --- | --- | --- | --- |
| Celular retrato 390×844 | ≈ 390×600 | 0,375 | 1040 su (32%) | 100% |
| Tablet retrato 820×1180 | ≈ 820×1000 | 0,625 | 1312 su (41%) | 100% |
| Desktop 1440×900 | ≈ 1100×844 | 0,528 | 2085 su (65%) | 100% |
| Desktop 1920×1080 | ≈ 1560×1016 | 0,635 | 2457 su (77%) | 100% |
| Celular paisagem 844×390 | ≈ 600×350 | 0,219 | 2740 su (86%) | 100% |

A referência de fairness é o **celular em retrato** (§9). Paisagem no
celular é suportada, mas a cena fica pequena e depende de zoom.

### 5.3 Três zonas de exploração

| Zona / estação | Faixa x (su) | Conteúdo (intenção de arte) | Alvos do pool |
| --- | --- | --- | --- |
| **Janela** | 0–1060 | janela em arco com vista do lago e da vila; peitoril com vasos e pedrinhas; poltrona com manta estampada; mesinha lateral; pilha de livros; baú no chão | Ampulheta (A), Óculos (B), Concha (C) |
| **Mesa** | 1060–2140 | mesa redonda de madeira em primeiro/meio plano; livro aberto, mapa, xícara, porta-lápis, caixas, tinteiro; parede com quadros acima | Lupa (A), Xícara (A), Bússola (B), Pena de escrever (C) |
| **Estante** | 2140–3200 | estantes altas com livros, barquinho, câmera antiga, busto, globo, relógio de parede, plantas pendentes, quadros pequenos, gancho lateral | Barquinho (A), Chave antiga (B), Borboleta (C) |

Faixas verticais: **teto/vigas** 0–300 su (densidade baixa, repouso);
**faixa principal** 300–1250 su (onde vive o interesse e os alvos);
**chão/tapete/borda da mesa** 1250–1600 su (densidade moderada).

### 5.4 Camadas e densidade

| Camada | Conteúdo | Formato | Parallax (pan) |
| --- | --- | --- | --- |
| `back` | vista pela janela (céu, lago, vila, montanhas), com sangria de ≥140 su além do vão | WebP opaco, recortado ao vão | fator 0,92 (anda menos) |
| `plate` | a sala inteira com decoração **e alvos pintados**; vidro da janela transparente | WebP RGBA, 3200×1600 su | 1,00 (referência) |
| `front` | 1 recorte de primeiro plano (ex.: planta pendente no alto à esquerda ou borda da mesa) | WebP RGBA recortado | fator 1,05 (anda mais) |
| `fx` | recortes "encontrado", selos de check, halo da pista, onda do toque | DOM + WebP pequenos | 1,00 |

- **Objetos decorativos legíveis:** ~75 (±15) — Janela ~20, Mesa ~30,
  Estante ~25. Famílias de semelhantes: lombadas de livros (contam como uma
  família), ~12 plantas, ~8 quadros, ~10 potes/caixas.
- **Objetos-alvo:** pool de **10** pintados na cena; cada dificuldade pede
  5, 6 ou 8 (§10).
- **Áreas de repouso visual:** céu e lago na janela (~6% da área), parede
  lisa acima da mesa (~5%), tapete e chão (~10%), teto e vigas (~8%) —
  **≈30% da cena sem alvo e com pouco detalhe**.
- Parallax: deslocamento máximo de `back` 128 su e de `front` 80 su no
  extremo do pan; desligado (fatores = 1) com `prefers-reduced-motion`.

### 5.5 Pool de alvos da primeira cena

| id | Rótulo | Zona | Nível | Intenção de posição | Eixo maior (su) | Oclusão máx. | Semelhantes na zona |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ampulheta` | Ampulheta | Janela | A | mesinha ao lado da poltrona, contra a luz | ≥170 (≈190) | 20% | 0 |
| `oculos` | Óculos | Janela | B | dobrados sobre a manta estampada | ≥128 (≈140) | 40% | ≤1 |
| `concha` | Concha | Janela | C | no peitoril, entre vasos e pedrinhas | ≥85 (≈100) | 60% | ≤2 (pedras) |
| `lupa` | Lupa | Mesa | A | sobre o mapa aberto | ≥170 (≈230) | 20% | 0 |
| `xicara` | Xícara | Mesa | A | ao lado do livro aberto | ≥170 (≈180) | 20% | 0 |
| `bussola` | Bússola | Mesa | B | meio coberta pela borda do mapa | ≥128 (≈130) | 40% | ≤1 |
| `pena` | Pena de escrever | Mesa | C | no porta-lápis, entre lápis e pincéis | ≥85 (≈150) | 60% | ≤2 (lápis, pincel) |
| `barquinho` | Barquinho | Estante | A | prateleira do meio | ≥170 (≈220) | 20% | 0 |
| `chave` | Chave antiga | Estante | B | pendurada no gancho lateral da estante | ≥128 (≈130) | 40% | ≤1 |
| `borboleta` | Borboleta | Estante | C | num quadro pequeno entre outros quadros | ≥85 (≈95) | 60% | ≤2 (quadros) |

Posições e tamanhos são intenção de arte; o export real fixa as coordenadas
(§17). Cada alvo existe **uma única vez** na cena (F9).

### 5.6 Safe areas para HUD

- O HUD principal fica **fora** da área da cena (coluna à direita no
  desktop, bandeja inferior no celular): nenhum alvo pode ficar preso sob
  ele.
- Sobre a cena só existem: botões de zoom (+/−) e Recentrar no canto
  inferior direito; a mira de teclado no centro (só com foco de teclado).
- **Margens seguras da cena sem alvos:** 8% nas laterais (256 su) e 10% em
  cima e embaixo (160 su). Assim nenhum alvo fica permanentemente sob os
  botões de canto, mesmo em zoom mínimo.

### 5.7 Desktop e celular

| | Desktop (≥ 900 px de largura) | Celular retrato | Celular paisagem (altura < 500 px) |
| --- | --- | --- | --- |
| Barra superior | 56 px: voltar · nome · Apoio · som | 48 px + safe-area | 40 px |
| Lista | coluna à direita ~340 px: miniatura/silhueta/palavra + estado | bandeja inferior ~144 px + safe-area: progresso, fileira de fichas (até 8 × 40 px), Pista, estações | coluna à direita ~220 px, fichas em grade |
| Câmera inicial | estação Mesa em "cover" (~65–77% da largura visível) | estação Mesa (uma zona) | estação Mesa |
| Navegação principal | arrastar com mouse, roda = zoom no cursor, estações | arrastar com um dedo, pinçar, estações | idem |
| Botões | +/− e Recentrar no canto; D-pad no Apoio | idem | idem |

Tocar numa ficha da lista **foca** o item (mostra o nome maior e direciona a
Pista); não move a câmera.

---

## 6. Camera

### 6.1 Modelo escolhido: **D) híbrido**

**Livre dentro de limites + 3 estações nomeadas por ação explícita +
Recentrar.**

- **A) totalmente livre**: bom para explorar, mas sozinho deixa o Explorador
  sem âncora quando aproxima demais.
- **B) livre + soft snap**: o snap automático depois de soltar briga com a
  mão (pior para quem tem tremor ou movimento lento) e pode tirar da tela o
  objeto que a pessoa estava olhando. Rejeitado.
- **C) três estações fixas**: perde a exploração (o centro do conceito).
  Rejeitado como modelo único.
- **D) híbrido**: a câmera é livre, e a orientação vem de três estações
  nomeadas (Janela · Mesa · Estante) que o Explorador aciona quando quer, mais
  o indicador "onde estou" (a estação mais próxima do centro fica destacada).
  A câmera **nunca se move sozinha**, exceto quando o Explorador pede
  (estação, Recentrar, Pista, Mostrar).

### 6.2 Parâmetros

| Parâmetro | Valor |
| --- | --- |
| Pan horizontal | livre dentro dos limites |
| Pan vertical | livre dentro dos limites (em zoom mínimo a altura inteira já cabe na maioria das telas) |
| Limites | a cena **sempre cobre** a área da cena: nunca aparece vazio fora da sala |
| Zoom mínimo | escala "cover" da área atual: `max(largura/3200, altura/1600)` |
| Zoom máximo | `clamp(1,25 px/su, 2 × mínimo, 4 × mínimo)` → celular retrato 1,25 (3,3× o cover), desktop 1440 1,25 (2,4×), celular paisagem 0,875 (4×) |
| Roda (mouse) | zoom ancorado no cursor; fator por evento `2^(−deltaY/500)` limitado a [0,8; 1,25]; `deltaMode` linha ×16, página × altura |
| Pinch do trackpad (`ctrlKey` + roda) | zoom ancorado no cursor; fator `2^(−deltaY/100)` |
| Arrastar (mouse/toque/caneta) | pan 1:1 com o ponteiro |
| Pinch (dois dedos) | zoom pela razão das distâncias, ancorado no centróide + pan pelo deslocamento do centróide |
| Duplo toque | **não existe** (§7.6) |
| Botões +/− | ×1,25 / ÷1,25 em torno do centro da área |
| Estações | Janela (≈530, 820), Mesa (≈1600, 860), Estante (≈2670, 800) su; vão para o centro da zona em zoom mínimo; deslizamento 450 ms ease-in-out |
| Recentrar | zoom mínimo, centrado na estação mais próxima; tecla `0` |
| Inércia | só ao soltar um arrasto com velocidade > 0,3 px/ms; ≤ 250 ms ease-out; distância ≤ 25% da área; desligada com reduced motion |
| Redimensionar/girar | mantém o ponto da cena no centro e a razão zoom/cover; re-aplica limites |
| Reduced motion | deslizamentos viram corte instantâneo; sem inércia; sem parallax relativo |

Valores de roda, inércia e duração: `TO_VALIDATE_IN_SKELETON` (§24).

### 6.3 Como o Explorador não se perde

1. Em zoom mínimo a cena preenche a tela e a altura inteira está visível.
2. O pan nunca sai da sala (limites "cover").
3. As estações têm nome e a atual fica destacada ("Você está na Mesa").
4. Recentrar está sempre a um toque.
5. A câmera não se mexe sem pedido.

---

## 7. Input / gestures

### 7.1 Princípio

Toda entrada da cena passa por **um** reconhecedor de Pointer Events na
superfície da cena (`touch-action: none`), que decide entre *toque*, *pan*
e *pinch*. Nenhuma camada de arte recebe eventos (`pointer-events: none`);
a seleção é resolvida por **hit test geométrico em unidades de cena**, não
por elementos DOM sob o dedo. O reconhecedor e o hit test são funções puras
(testáveis em Node) e independem do renderer (§15.2).

O padrão segue o precedente do próprio repo — a camada de gestos do
tabuleiro da Rota (`routeBabylonScene.ts`: `TAP_MOVE_THRESHOLD_PX = 14`,
multitoque nunca vira toque) — **copiado como política**, não importado
(§19).

### 7.2 Contrato

| Evento | Estado | Efeito |
| --- | --- | --- |
| `pointerdown` (1º ponteiro) | `idle` → `pressed` | captura o ponteiro; guarda posição e hora. Se a câmera estava em movimento (inércia, estação, pista), **para a câmera** e marca o gesto como `catch` (não pode virar toque) |
| `pointerdown` (2º ponteiro) | qualquer → `pinch` | cancela de vez o toque candidato deste gesto |
| `pointerdown` (3º+) | — | ignorado |
| `pointermove` | `pressed` | se a distância passar do limiar → `panning`, aplicando o deslocamento acumulado (sem salto) |
| `pointermove` | `panning` | pan pelo delta |
| `pointermove` | `pinch` | zoom pela razão das distâncias + pan pelo centróide |
| `pointerup` | `pressed` (não `catch`, ≤ 1000 ms) | **TOQUE** no ponto do `pointerdown` |
| `pointerup` | `pressed` (> 1000 ms) | nada (dedo descansando não seleciona) |
| `pointerup` | `panning` | fim do pan; inércia curta se aplicável |
| `pointerup` | `pinch` → resta 1 ponteiro | passa a `panning` com o dedo restante (nunca toque) |
| `pointercancel` / `lostpointercapture` | qualquer | aborta o gesto; nenhum toque |
| botão do mouse ≠ principal | — | ignorado |

| Limiar | Valor |
| --- | --- |
| Movimento máximo de um toque — toque/caneta | 14 px de tela |
| Movimento máximo de um toque — mouse | 6 px de tela |
| Duração máxima de um toque | 1000 ms |

O ponto do toque é o do `pointerdown` (onde a pessoa mirou), não o do
`pointerup` — mais estável com tremor. Limiar, duração e ponto:
`TO_VALIDATE_IN_SKELETON` com idosos.

### 7.3 Teclado

Com a cena focada (`:focus-visible`), aparece uma **mira** no centro da área.

| Tecla | Ação |
| --- | --- |
| ← ↑ → ↓ | pan de 12% da área (Shift: 30%) |
| `+` / `=` / `−` | zoom ×1,25 / ÷1,25 em torno do centro |
| `1` `2` `3` | estações Janela / Mesa / Estante |
| `0` | Recentrar |
| Enter / Espaço | **toque na mira** (mesmo hit test do toque) |

Os demais controles (Pista, lista, Apoio) são botões normais na ordem de
tabulação.

### 7.4 Resolução de um toque

1. Converte o ponto de tela para su com a câmera do momento do
   `pointerdown` (num toque a câmera não se moveu).
2. Para cada alvo **pedido** nesta sessão, mede a distância do ponto à forma
   de hit (elipse ou polígono da parte visível).
3. Acerta se `distância ≤ tolerância_px / escala`. Tolerância (toque):
   Fácil 16 px, Médio 12 px, Difícil 10 px; mouse: 8 / 6 / 5 px.
4. Vários candidatos: vence o que contém o ponto; senão, o mais próximo.
5. Resultado: alvo não encontrado → **encontrado**; alvo já encontrado →
   lembrete; nada → **toque livre** (onda discreta, §12).

Alvos da cena que **não** estão na lista desta dificuldade são decoração:
tocar neles é um toque livre (não revela o pool).

### 7.5 Falsos positivos evitados

- arrastar além do limiar nunca seleciona;
- qualquer gesto que teve dois dedos nunca seleciona;
- o toque que para uma câmera em movimento nunca seleciona;
- dedo pousado por mais de 1 s nunca seleciona;
- nada depende do evento `click` sintetizado na cena (sem "ghost click");
- o pinch do navegador e o scroll da página não disputam a cena
  (`touch-action: none`, listener de roda não passivo só na cena).

### 7.6 Por que não há duplo toque

Duplo toque para zoom obrigaria a atrasar todo toque simples ~300 ms para
saber se vem um segundo — ou o primeiro toque seleciona/erra antes do zoom.
Os dois pioram o verbo principal. Zoom fica com pinch, roda e +/−.

### 7.7 "Respiro" contra tocar em tudo

Como errar não custa nada, varrer a tela com toques resolveria o jogo sem
observar. Proteção calma: **5 toques livres em 4 s** pausam a seleção por
2 s com o texto "Observe com calma — às vezes ajuda aproximar." (pan e zoom
continuam). Sem som, sem vermelho, sem contagem. `TO_VALIDATE_IN_SKELETON`
(pode irritar mais do que ajuda).

---

## 8. Target model

### 8.1 Pintado na prancha × sprite separado

| | Alvo pintado na prancha + recorte alinhado | Alvo como sprite separado em runtime |
| --- | --- | --- |
| Integração (luz, sombra, perspectiva) | perfeita: o artista integra no master | risco de "adesivo" — a lição do Circuito |
| Estado "encontrado" | recorte da mesma composição, mesma posição (alinhado por construção) | o próprio sprite |
| Variação por dificuldade | via **quais alvos são pedidos** (§10) | mover/esconder sprites |
| Custo de arte | uma prancha | prancha + N sprites coerentes |
| Nitidez no zoom | a da prancha | a do sprite |

**Decisão:** pintado na prancha + recorte "encontrado" alinhado. A variação
vem do pool e das listas, não de sprites móveis.

### 8.2 `HiddenObjectDefinition` (conceitual — não é código)

```text
HiddenObjectDefinition
  id         "lupa"                      kebab ASCII, estável (assets, testes, dados)
  label      "Lupa"                      substantivo comum; nunca só cor
  zone       "janela" | "mesa" | "estante"
  tier       "A" | "B" | "C"             encontrabilidade (F1–F8)
  hit        { kind: "ellipse", cx, cy, rx, ry, rotationDeg? }
           | { kind: "polygon", points: [x, y][] }        su, só a parte VISÍVEL
  bounds     { x, y, w, h }              su; caixa do recorte "encontrado" (vem do export)
  foundArt   "targets/lupa-found"        resolvido por tier de imagem (-m/-s)
  thumb      "thumbs/lupa"               miniatura da lista
```

Derivado, não armazenado: anúncio acessível ("Lupa encontrada") = `label`;
deslocamento do halo da pista = hash determinístico do `id`; centro e raio
do objeto = de `bounds`.

### 8.3 O que **não** entra (auditado e recusado)

- `layer` — todo alvo vive na prancha; não há alvo em `back`/`front`.
- `position` separado de `bounds`/`hit` — redundante.
- visibilidade por dificuldade dentro do alvo — a dificuldade escolhe a
  lista (§10); o alvo não muda.
- `hintRegion` armazenada — derivada de `bounds` + dificuldade.
- escala, rotação, z-index, animação — alvos não se movem (F11).
- variantes de arte por dificuldade, sorteio de posição — fora da v1.

### 8.4 Cena e dificuldade (conceitual)

```text
SceneDefinition
  id "explorer-studio" · size { w: 3200, h: 1600 } · safeMargins { x: 256, y: 160 }
  layers   [{ id, art, kind: "back" | "plate" | "front", rect, parallax }]
  stations [{ id: "janela" | "mesa" | "estante", label, center }]
  targets  HiddenObjectDefinition[10]
  presets  Record<DifficultyLevel, DifficultyPreset>

DifficultyPreset
  label            "Fácil" | "Médio" | "Difícil"
  targets          id[]                       ordem fixa = ordem da lista
  listStyle        "picture" | "silhouette" | "word"
  hintStages       HintStage[]                §11
  tolerancePx      { touch, mouse }
```

`DifficultyLevel` reaproveita o tipo existente de `src/types/game.ts`.
Esses tipos ficam **dentro da pasta do jogo**. Não há "engine de hidden
objects" compartilhado: generalizar só quando uma segunda cena existir e
mostrar o que realmente varia.

---

## 9. Fairness contract

Um alvo é justo quando um Explorador atento, sem pressa, consegue
reconhecê-lo **pelo que ele é**, sem caçar pixel e sem adivinhar.

| # | Regra | Como se verifica |
| --- | --- | --- |
| F1 | **Nunca 100% oculto.** Parte visível ≥ 80% (A), ≥ 60% (B), ≥ 40% (C) da silhueta, e o **traço identificador** (lente + cabo da lupa; argola + dentes da chave) sempre visível | prancha de revisão + export (área do recorte visível ÷ objeto inteiro) |
| F2 | **Tamanho mínimo em pixels-fonte no menor tier** (`s`, 0,75 px/su): eixo maior ≥ 128 px (A), ≥ 96 px (B), ≥ 64 px (C) → ≥ 170 / 128 / 85 su | validador (dados de `bounds`) |
| F3 | **Área de toque efetiva ≥ 44×44 CSS px** no celular de referência (cover 0,375 px/su), no zoom de projeto do nível: A em 1×, B em ≤ 1,6×, C em ≤ zoom máximo (forma + tolerância) | validador |
| F4 | **Contraste local** objeto × entorno (anel de 24 su): ≥ 3:1 (A), ≥ 2:1 (B), ≥ 1,5:1 (C); e o objeto é reconhecível na **versão em tons de cinza** da prancha | prancha de revisão (colorida + cinza) |
| F5 | **Nunca atrás de UI.** Nenhuma forma de hit nas margens seguras (§5.6); a camada `front` nunca se sobrepõe a uma forma de hit (+24 su de folga) em nenhum extremo do parallax; pista/fechamento nunca ficam permanentes sobre a cena | validador (geometria + extremos de parallax) |
| F6 | **Sem caça ao pixel.** Nenhum alvo identificável só acima do zoom máximo; tolerância mínima de 10 px no toque | validador + playtest |
| F7 | **Zoom máximo ainda identifica.** No zoom máximo do desktop, o traço identificador é claro no tier `m` | prancha de revisão (recorte por alvo no zoom máximo) |
| F8 | **Semelhantes distinguíveis.** Rótulos únicos entre alvos; semelhantes da mesma categoria na zona: 0 (A), ≤ 1 (B), ≤ 2 (C), sempre distinguíveis **por forma**; rótulo nunca depende só de cor; "massa" de IA que lembre a categoria de algum alvo é removida (auditoria de iscas, §17.3) | validador (rótulos únicos) + prancha de revisão |
| F9 | **Um exemplar.** Cada alvo aparece uma única vez na cena | auditoria de iscas |
| F10 | **Distribuição.** Toda lista tem ≥ 1 alvo em cada zona e ≤ 50% numa zona só; formas de hit não se sobrepõem; separação ≥ 120 su entre alvos | validador |
| F11 | **Estabilidade.** Alvos não se movem, não animam e não mudam entre sessões da mesma dificuldade (v1) | validador (dados fixos) |
| F12 | **Palavras simples.** Rótulos são substantivos concretos e comuns; no Fácil a lista mostra imagem | revisão de copy |
| F13 | **Sem beco sem saída.** "Mostrar onde está" sempre disponível depois dos estágios de pista | teste do reducer da sessão |
| F14 | **Toque livre é grátis.** Sem penalidade, sem contador visível, sem efeito no resultado | teste do reducer + do resultado |

Itens "prancha de revisão" seguem o precedente das pranchas de aceitação do
Circuito (`docs/archive/circuit-visual-01/`): uma imagem gerada por script
com formas de hit, margens seguras, zonas, versão em cinza e recortes no zoom
máximo.

---

## 10. Difficulty

### 10.1 Dimensões

| Dimensão | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| Objetos pedidos | **5** | **6** | **8** |
| Mistura de níveis | 4 A + 1 B | 2 A + 3 B + 1 C | 2 A + 3 B + 3 C |
| Como a lista mostra o objeto | **imagem** + palavra (correspondência perceptiva) | **silhueta** + palavra (forma) | **só palavra** (semântica) |
| Força da pista (§11) | região → perto → Mostrar | zona → região → Mostrar | zona → região ampla → Mostrar |
| Tolerância de toque | 16 px (mouse 8) | 12 px (mouse 6) | 10 px (mouse 5) |
| Zoom necessário (no celular de referência) | nenhum | até ~1,6× para B/C | até o máximo para C |
| Oclusão / contraste / semelhantes | por nível de cada alvo (F1, F4, F8) | idem | idem |
| Tempo | **nunca** | **nunca** | **nunca** |

O que **não** se faz: encolher objetos por dificuldade, esconder 100%,
cronometrar, reduzir pistas a zero, punir toque livre. Todo nível inclui ao
menos dois alvos A de "aquecimento", para a sessão começar com uma vitória
rápida.

### 10.2 Listas da primeira cena (fixas na v1)

| Dificuldade | Objetos (ordem da lista) | Janela / Mesa / Estante |
| --- | --- | --- |
| Fácil | Ampulheta, Lupa, Xícara, Barquinho, Chave antiga | 1 / 2 / 2 |
| Médio | Lupa, Óculos, Bússola, Pena de escrever, Barquinho, Chave antiga | 1 / 3 / 2 |
| Difícil | Ampulheta, Óculos, Concha, Xícara, Bússola, Pena de escrever, Chave antiga, Borboleta | 3 / 3 / 2 |

Todas cumprem F10. O Difícil usa alvos A diferentes do Médio, para que
subir de nível não seja repetir a mesma busca. Listas fixas tornam o
skeleton determinístico (testes e playtests comparáveis); sorteio dentro do
nível fica para depois do playtest de rejogabilidade (§24).

### 10.3 Por que essa progressão é coerente

A dificuldade sobe em duas escadas independentes do relógio: **o que se
procura** (visível → discreto → escondido) e **como se reconhece** (imagem →
forma → palavra). A pista acompanha (mais próxima no Fácil, mais vaga no
Difícil) e a tolerância de toque diminui pouco. Um Explorador com
dificuldade de leitura joga o Fácil inteiro só pela imagem; um Explorador
experiente encontra no Difícil objetos que pedem zoom e atenção ao
material.

---

## 11. Hints

### 11.1 Quando está disponível

Sempre, por **ação explícita**: botão **Pista** no HUD (sem espera, sem
recarga, sem custo). A pista vale para o item **focado** na lista; se nenhum
estiver focado, para o primeiro ainda não encontrado. O botão diz para quem é
("Pista: Óculos").

### 11.2 O que mostra (progressivo, por objeto)

| Dificuldade | 1ª pista | 2ª pista | Depois |
| --- | --- | --- | --- |
| Fácil | **região**: câmera vai à estação do objeto + halo de raio 280 su | **perto**: halo de raio 140 su | Mostrar onde está |
| Médio | **zona**: câmera vai à estação + texto "Procure perto da janela." (sem halo) | **região**: halo de raio 320 su | Mostrar onde está |
| Difícil | **zona**: texto + estação | **região ampla**: halo de raio 420 su | Mostrar onde está |

- **Halo**: poça de luz quente e suave sobre a região, com o resto da cena
  levemente escurecido, por 5 s (entra e sai em 600 ms). O texto da pista
  continua no HUD até o próximo achado.
- O centro do halo é **deslocado** do centro do objeto por até 40% do raio,
  numa direção determinística derivada do `id` — o objeto está dentro, mas
  não no centro. Raio efetivo = `max(raio do estágio, 1,8 × meio-eixo maior
  do objeto)`, para o objeto caber inteiro.
- Se a região estiver fora da tela, a câmera desliza até ela (corte
  instantâneo com reduced motion).
- **Mostrar onde está** (`reveal`): só aparece depois do último estágio
  daquele objeto. A câmera enquadra o objeto (≈25% da menor dimensão da área,
  dentro dos limites de zoom), o objeto recebe o mesmo retorno de
  "encontrado" e o HUD diz "Aqui está: Óculos." Na lista ele fica igual aos
  outros encontrados — sem marca de "ajuda".

### 11.3 Como evita resolver o jogo inteiro

- é por objeto e progressiva: chegar a "Mostrar" exige três ações deliberadas
  por objeto;
- nenhum estágio de pista aponta o objeto exatamente (halo deslocado);
- não há pista "geral" que acenda todos os objetos;
- o custo é só o próprio esforço — que é o certo para "Pensar em paz".

Pistas e "Mostrar" não reduzem o resultado. O uso fica registrado só no log
de playtest do laboratório (§22.7), não no `GameResult`.

### 11.4 Fora da v1

Convite suave depois de inatividade ("Quer uma pista?" após ~90 s sem
achado) — `TO_VALIDATE_IN_SKELETON` como pergunta, não como implementação.

---

## 12. Feedback

| Situação | Visual | Texto / anúncio | Som | Duração |
| --- | --- | --- | --- | --- |
| **Encontrou** | o recorte do objeto "acende" com halo quente suave; uma única respiração de escala 1 → 1,03 → 1; depois fica um **selo de check** pequeno junto ao objeto (forma, não só cor) | ficha da lista ganha check + "encontrado"; "3 de 6"; `aria-live`: "Lupa encontrada. 3 de 6." | carrilhão suave existente (`playSuccessChime`), **só com som ligado** (padrão desligado) | 350 ms de entrada + 600 ms para assentar |
| **Tocou num já encontrado** | o selo pulsa uma vez, de leve | HUD: "Você já encontrou a Lupa." | nenhum | 400 ms |
| **Toque livre** (nada ali) | onda pequena (32 px), cor creme a 30% de opacidade, que se abre e some | nenhum | nenhum | 400 ms |
| **Respiro** (§7.7) | nenhuma | HUD: "Observe com calma — às vezes ajuda aproximar." | nenhum | 2 s de pausa da seleção |
| **Pista** | halo (§11) | texto da pista; `aria-live` | nenhum | 5 s |
| **Fechamento** | 900 ms depois do último achado a cena aquece levemente (gradiente sobreposto, 1,2 s) e o cartão de fechamento aparece | "Estúdio explorado — você encontrou os 6 objetos." · [Concluir exploração] [Continuar olhando] | carrilhão, se ligado | — |

Regras: nunca "erro", "errou", "falhou", "tente de novo"; nunca vermelho;
nada de vibração; nada de confete, partículas ou tremor **dentro da cena**;
nada de "está perto/quente/frio" no toque livre (isso seria uma pista
escondida). Com `prefers-reduced-motion`: sem respiração de escala, sem
onda que se expande (só esmaece), halo sem animação de entrada.

O retorno deve ser lido em < 1 s e não pedir ação: o Explorador continua
explorando.

---

## 13. Accessibility

| Tema | Decisão v1 |
| --- | --- |
| Alvos de toque do HUD | todo botão ≥ 44×44 CSS px |
| Alvos da cena | F2/F3: área efetiva ≥ 44×44 px no zoom de projeto do nível; tolerância em px de tela |
| Toque | um dedo arrasta, dois pinçam; **todo gesto tem alternativa de um toque**: +/−, estações, Recentrar e D-pad (← ↑ → ↓) no painel "Apoio do Explorador" (o padrão de bandeja de apoio do Circuito, recriado) — WCAG 2.5.1 e 2.5.7 |
| Desktop | mouse arrasta, roda aproxima; tudo também por teclado |
| Teclado | §7.3: setas, +/−, 1/2/3, 0 e Enter/Espaço na mira; foco visível; Escape fecha o Apoio e devolve o foco |
| Reduced motion | sem deslizamentos (corte), sem inércia, sem parallax relativo, retornos só por opacidade |
| Contraste | texto do HUD ≥ 4,5:1; estados não textuais ≥ 3:1; contraste dos alvos por nível (F4) |
| Zoom do navegador / texto | HUD em `rem`; a câmera recalcula pelo `ResizeObserver` |
| Texto | frases curtas; rótulos concretos (F12); nenhum texto cozido nas imagens (regra do Visual System) |
| Não depender de cor | encontrado = check + palavra; pista = halo + texto; rótulos sem cor (F8) |
| Leitor de tela | a cena é um controle focável com nome e instruções (`role="application"`, `aria-label` "Cena do Estúdio", descrição com as teclas); `aria-live="polite"` anuncia achados, pistas e estação; lista, preparação, Apoio e fechamento são HTML semântico. Os alvos **não** são botões na árvore de acessibilidade: tabular por eles entregaria a resposta |
| Tempo | nenhum limite de tempo (WCAG 2.2.1); halos somem, mas o texto da pista fica |

**Limite inerente (documentado):** objetos escondidos é um exercício de
busca **visual**. Um Explorador cego usa toda a moldura (preparação, lista,
estado, resultado) mas não tem uma versão equivalente do jogo — uma
"audiodescrição jogável" seria outro jogo. A mira de teclado atende quem
enxerga e não usa ponteiro (teclado, acionador). `role="application"` e os
anúncios: `TO_VALIDATE_IN_SKELETON` com NVDA e VoiceOver.

---

## 14. Technical option comparison

| Critério | A) DOM/CSS transforms + camadas | B) Canvas 2D | C) Babylon / 3D leve | D) Híbrido |
| --- | --- | --- | --- | --- |
| Mobile | **forte**: `transform` no compositor, o mesmo padrão dos visualizadores de foto com pinch-zoom | forte: redesenha só durante gesto/animação | **fraco**: entrada da Rota medida em 9,5–14,8 s no mobile (watchdog de 28 s); custo de WebGL/memória | herda o pior dos dois |
| Desktop | forte | forte | médio | — |
| Hit testing | geométrico em su (§7.4) — igual em A e B | igual | picking de planos: funciona, mas não agrega a uma pintura | — |
| Pan | um `transform` num elemento-mundo via `requestAnimationFrame`, sem render React por frame | matriz de câmera + redraw | câmera ortográfica | — |
| Pinch zoom | Pointer Events + `touch-action: none` | igual | igual (a Rota já tem gestos próprios) | — |
| Acessibilidade | HUD e estados em DOM; cena focável com mira e live region | HUD em DOM; canvas opaco | igual a B | — |
| Performance | boa; **incerteza: nitidez × custo de re-raster no zoom no iOS/Android** (validar) | boa e previsível; custo de redraw em DPR alto | engine de 1.725,8 KB gzip lazy (36 arquivos) | — |
| Produção de assets | WebP em camadas — o pipeline que Home e Circuito já usam | igual | um GLB por objeto: dezenas de modelos para uma sala densa | soma |
| Quantidade de código | **a menor** | +300–500 linhas (DPR, resize, loop "sujo", decode, overlay de acessibilidade, animações de retorno redesenhadas) | a maior (cena, materiais, lifecycle, dispose) | soma |
| Responsividade | CSS nativo | manual | manual | — |
| Manutenção | baixa; padrão já presente no repo | média | alta | alta |
| Qualidade visual | a da arte + parallax por camada | a da arte, nitidez garantida em qualquer escala | iluminação real possível, mas a arte é pintada — não ganha | — |
| Risco | baixo–médio | médio | **alto** | alto |
| Tempo até o protótipo | **o mais curto** | +1–2 dias | o mais longo | — |
| Encaixe no lock | nenhuma mudança de contrato | nenhuma | **quebra o gate A5** (só `RouteBabylonBoard` pode importar `@babylonjs/*`) → exigiria mudança de contrato | — |

**Híbrido avaliado e recusado.** Os únicos híbridos com sentido seriam
(i) DOM + Canvas para efeitos — nenhum efeito da v1 precisa de canvas
(halo, onda e brilho são CSS/WebP); (ii) DOM com renderer de camadas
substituível por Canvas — isso não é outra tecnologia, é a **costura de
fallback** da opção A (§15.2).

Evidência do repo que pesa a favor de A: `MINDFLOW_VISUAL_SYSTEM.md` §1
("2.5D como linguagem principal: profundidade visual com sprites, camadas,
sombras"); a Home de produção é DOM 2.5D sem canvas; o Circuito é board
mestre + overlays + hitboxes em DOM, com parallax de ambiente
(`useCircuitSceneParallax`, 9 px, desligado em reduced motion e toque).

---

## 15. Final scene-tech decision

### 15.1 Decisão

```text
GAME03_SCENE_TECH = DOM_2_5D
```

Estrutura (intenção, não código):

```text
.hos-viewport   (focável, touch-action: none, overflow: hidden; recebe TODOS os eventos)
  .hos-world    (3200×1600 CSS px; transform: translate3d(tx, ty, 0) scale(s); origem 0 0)
    back        <img> vista da janela   — translate de parallax próprio
    plate       <img> prancha           — referência
    front       <img> recorte de frente — translate de parallax próprio
    fx          recortes "encontrado", selos (contraescala por variável CSS), halo, ondas
  mira (teclado)  ·  +/− e Recentrar (canto)
```

- A câmera vive num `ref` e é escrita no `style` do elemento-mundo dentro de
  `requestAnimationFrame`; React só re-renderiza em mudanças discretas
  (achado, pista, fase). Sem loop ocioso: zero rAF quando nada se move.
- Imagens: `next/image` com **`unoptimized`** (o arquivo pré-otimizado pelo
  pipeline é servido como está) e `loading="eager"` nas essenciais. Motivo:
  com zoom por `transform`, o `srcset` do navegador escolhe pelo tamanho de
  layout, não pelo zoom — o tier é escolhido pelo jogo (§16.2). Next 16:
  `priority` está **depreciado** (usar `preload`/`loading="eager"`/
  `fetchPriority`), e `next.config.ts` não precisa mudar.
- Prontidão: `readiness: "explicit"`; `onEntryReady` depois de
  `img.decode()` das essenciais + 2 frames (padrão do Circuito); falha de
  asset essencial → `onEntryError` uma vez → painel de retry da plataforma.

### 15.2 A costura que reduz o risco

Câmera, reconhecedor de gestos, hit test e sessão são **módulos puros sem
DOM**. O renderer de camadas é a única peça que sabe que existe `<img>`.
A incerteza real da opção A — o navegador rasterizar camadas grandes
escaladas (nitidez × custo de re-raster no fim do zoom, principalmente no
Safari iOS) — não decide a arquitetura: se o skeleton reprovar, troca-se só
o renderer por Canvas 2D.

- **Estratégia inicial:** `will-change: transform` só durante o gesto
  (suave), removido ~120 ms depois de parar (o navegador re-rasteriza na
  escala final, nítido).
- **Regra de decisão** (`TO_VALIDATE_IN_SKELETON`): se num iPhone real ou num
  Android intermediário houver borrão persistente no zoom máximo depois de
  parar, ou mais de uma Long Task > 100 ms por fim de gesto, **parar e
  reportar**, propondo o renderer Canvas 2D atrás da mesma costura. O
  container de nuvem só tem Chromium/SwiftShader: a parte iOS exige aparelho
  real.

Isso não exige protótipo antes do skeleton: a decisão é robusta aos dois
desfechos, e pinch-zoom por `transform` é um padrão consolidado da web
(visualizadores de foto).

### 15.3 Babylon e dependências

```text
GAME03_BABYLON = NO
GAME03_NEW_RUNTIME_DEPENDENCY_REQUIRED = NO
```

**Babylon não**, mesmo já estando no projeto: a cena é uma pintura (3D não
acrescenta nada visível), custaria 1,73 MB gzip lazy + inicialização de
engine na entrada (o motivo do watchdog de 28 s da Rota), exigiria assets
3D para uma sala densa e **quebraria o gate A5 do lock**.

**Nenhuma dependência nova** (auditado `package.json`):

| Pacote existente | Uso no Game 03 |
| --- | --- |
| `react`, `next` | sim (componente, `next/image` com `unoptimized`) |
| `lucide-react` | ícones do HUD |
| `motion` | permitido no HUD (já está no grafo inicial por `RewardResultModal`, custo zero de bundle); **nunca** na câmera |
| `canvas-confetti` | não (é do `RewardResultModal`) |
| `@babylonjs/*`, `three`, `@react-three/*` | não |
| `sharp` (dev) | pipeline de assets (§17) |

Bibliotecas de gesto/pan-zoom avaliadas e dispensadas: Pointer Events dão
tudo o que o contrato da §7 precisa em ~200 linhas puras e testáveis, o repo
já tem um precedente inline (gestos da Rota), e uma biblioteca traria
política própria de tap/drag que teríamos de contornar para cumprir §7.5.

---

## 16. Performance budgets

### 16.1 Orçamentos iniciais do skeleton

| Item | Orçamento | Referência no repo |
| --- | --- | --- |
| Prancha tier `m` (3200×1600, WebP RGBA) | ≤ 900 KB (alvo 700 KB) | maior raster atual: 1920×1080, 175 KB (`memory-room-bg.webp`) |
| Prancha tier `s` (2400×1200) | ≤ 500 KB | — |
| Vista da janela (`back`) | ≤ 120 KB por tier | — |
| Recorte de frente (`front`) | ≤ 150 KB | — |
| Miniaturas da lista (10 × 128×128) | ≤ 8 KB cada, ≤ 80 KB total | — |
| **Essenciais do primeiro paint do jogo (tier `m`: prancha + janela + frente + miniaturas)** | **≤ 1,3 MB (alvo ~1,0 MB)** | Home: alvo 600 KB, teto 1,5 MB (Visual System §8); kit do Circuito ~444 KB + fundo 175 KB |
| Recortes "encontrado" (10, adiados) | ≤ 25 KB cada, ≤ 250 KB total | overlays do Circuito: 15–160 KB |
| Arte de intro/transição (recorte da prancha) | ≤ 120 KB | `world-route-hero.webp` 102 KB |
| Memória decodificada (todas as imagens) | ≤ 48 MB (`m`), ≤ 28 MB (`s`) | prancha `m` sozinha = 20,5 MB |
| JS do chunk do jogo | ≤ 20 KB gzip | Circuito 6,4 KB; Rota lazy main 18,4 KB |
| CSS do jogo | ≤ 6 KB gzip | Circuito 4,1 KB |
| Pacotes novos | 0 | — |
| Camadas compostas | ≤ 4 (back, plate, front, fx) | — |
| Nós DOM da cena | ≤ 60 | — |
| Render React por frame de câmera | 0 | — |
| rAF ocioso | 0 | Home: sem loop contínuo |
| Long Tasks do jogo durante o gesto de pan/zoom (CPU 4×, informativo; o fim do gesto é o critério V1) | 0 > 50 ms | baseline do lock §8 |
| Prontidão (Fast 4G emulado, informativo) | ≤ 3 s; sempre < 12 s (watchdog padrão) | Rota precisou de 28 s |

O Game 03 **não declara** `entryWatchdogMs` no skeleton; só declara se a
medição mostrar entrada legítima acima de 12 s (como a Rota fez, com
números).

### 16.2 Resolução, tiers e DPR

- **Master**: 6400×3200 (2 px/su), fora de `public/`.
- **Runtime**: tier `m` = 3200×1600 (1 px/su) por padrão em todos os
  aparelhos; tier `s` = 2400×1200 quando `navigator.deviceMemory ≤ 2` ou
  `saveData`. Escolhido uma vez na montagem. Sem tier por DPR no skeleton.
- No zoom máximo (1,25 px/su) num DPR 2–3 a prancha é ampliada 2,5–3,75× em
  pixels de aparelho: suave, não nítida. Por isso F2 é medido em pixels-fonte
  do menor tier, e "nitidez fotográfica no zoom máximo" está em DO NOT
  PROMISE. Mosaico de alta resolução (deep zoom) só se o playtest mostrar
  que o borrão atrapalha (§24).
- **Formato**: WebP (qualidade ~80; alpha onde precisa) — o formato de todo
  o runtime atual, decodificação rápida. AVIF fica para depois (custaria
  `<picture>` ou mudança no `next.config`, e decodifica mais devagar em
  aparelho fraco).
- **Preload / lazy**: o chunk do jogo já é lazy (registry). As essenciais
  carregam na montagem (sob a intro, que já está na tela); os recortes
  "encontrado" carregam e decodificam depois da prontidão, em segundo plano.
  Se um achado acontecer antes, o selo e o halo aparecem na hora e o recorte
  entra quando chegar.

---

## 17. Asset pipeline

Ferramentas de **autoria**: geração de imagem (GPT), Adobe (Photoshop:
composição, Generative Fill/Expand, remoção de fundo, Match Color, curvas,
Super Resolution do Camera Raw; Firefly opcional), o `sharp` do repo para
exportar/otimizar, Claude para scripts e implementação. **O runtime não
depende de nenhuma delas**, nem de API de geração: o jogo só lê arquivos
estáticos de `public/`.

### 17.1 Fluxo

```text
mockup (direção) + briefing de arte (§5: zonas, luz, câmera, paleta, pool de alvos)
 → 1. geração por zona: 3 imagens em retrato (Janela, Mesa, Estante) + a vista da janela,
      mesmo prompt-base de luz/câmera/paleta, sem texto, sem pessoas
 → 2. composição no Photoshop: master 6400×3200; costuras com Generative Fill;
      um horizonte, uma luz principal; Super Resolution 2× por zona antes de compor
 → 3. alvos: gerados isolados (fundo neutro, mesma direção de luz), recortados,
      posicionados como camadas próprias com sombra de contato e cor casada;
      oclusores por nível
 → 4. limpeza + AUDITORIA DE ISCAS (§17.3)
 → 5. passe de fairness (F1, F4, F7, F8) com a prancha de revisão
 → 6. export sem perda do PSD (master achatado, janela, frente, cada alvo visível)
 → 7. otimização por script (§17.4) → runtime + coordenadas impressas
 → 8. coordenadas coladas na configuração da cena (precedente do Circuito)
 → 9. prancha de revisão regenerada e conferida → jogo
```

### 17.2 Camadas do PSD (convenção)

| Prefixo | Significado | Export |
| --- | --- | --- |
| `P_*` | conteúdo da prancha (sala, decoração) | achatado em `plate` |
| `T_<id>` | um alvo (`T_lupa`) | achatado em `plate` **e** exportado isolado |
| `O_<id>_*` | oclusor acima de um alvo | achatado em `plate`; mascara o recorte "encontrado" do alvo |
| `F_*` | primeiro plano com parallax | `front` (não entra na prancha) |
| `B_window-view` | vista da janela | `back` (não entra na prancha) |

O recorte "encontrado" = `T_<id>` mascarado pelos `O_<id>_*` = **só a parte
visível**, na mesma posição da prancha (alinhado por construção, como os
overlays do Circuito).

### 17.3 Auditoria de iscas (o risco específico de arte gerada)

Imagem gerada produz "massa": formas que lembram objetos sem ser nenhum, e
duplicatas acidentais. Num jogo de busca isso é **injustiça**: o Explorador
toca uma "chave" que não é a chave. Checklist por alvo: varrer a prancha
inteira atrás de qualquer forma da mesma categoria (outras chaves, outras
lupas, outras conchas); corrigir ou remover; remover pseudotexto e glifos;
conferir que cada alvo existe uma vez (F9); conferir perspectiva e sombra
de contato dos alvos.

### 17.4 Script de export (skeleton)

`tools/assets/create_hidden_object_scene.mjs` (proposto; usa `sharp`, já
devDependency):

- lê os exports sem perda de `docs/archive/hidden-objects/explorer-studio/masters/`;
- gera tiers `m`/`s` da prancha, da janela e da frente;
- gera os recortes "encontrado" com halo quente cozido (desfoque do alpha +
  tinta), para o brilho ser idêntico em todos os alvos;
- gera as miniaturas 128×128 (a silhueta do Médio é a própria miniatura com
  filtro CSS — nenhum arquivo extra);
- gera a arte de intro/transição como recorte da prancha (mesma fonte, a
  regra de fonte única do Circuito);
- calcula `bounds` e uma elipse inicial (momentos do alpha) de cada alvo e
  **imprime** as coordenadas em su para colar na configuração;
- confere orçamentos (§16.1) e falha se algum estourar;
- gera a prancha de revisão (§9) em `docs/archive/`.

### 17.5 Organização e nomes

```text
public/assets/hidden-objects/explorer-studio/v1/
  plate-m.webp  plate-s.webp
  window-view-m.webp  window-view-s.webp
  front-<nome>-m.webp  front-<nome>-s.webp
  targets/<id>-found-m.webp  targets/<id>-found-s.webp
  thumbs/<id>.webp
  hero.webp                       arte de intro/transição (recorte da prancha)
  README.md                       contrato: tamanhos, orçamentos, comando de regeneração, proveniência
docs/archive/hidden-objects/explorer-studio/
  masters/                        exports sem perda (master achatado, janela, frente, alvos) — ≤ 40 MB
  review/                         pranchas de revisão
```

- Nomes em kebab ASCII; `id` do alvo = nome do arquivo; versão na pasta
  (`v1/`), nunca no nome. Mudou o kit → pasta nova, nunca sobrescrever
  (o problema de cache do otimizador que o Circuito viveu).
- O PSD em camadas fica no armazenamento de autoria; o que regenera o
  runtime está no repo (`masters/` + script), cumprindo "nenhum estado
  escondido em máquina" do `SOURCE_OF_TRUTH.md`.
- O README registra a proveniência (ferramentas, data, prompts-base) e os
  termos de uso da ferramenta de geração.
- Nada de texto cozido nas imagens.

### 17.6 Assets do skeleton

| Asset | Qtde | Essencial? |
| --- | --- | --- |
| Prancha `m` e `s` | 2 | sim (um tier por sessão) |
| Vista da janela `m`/`s` | 2 | sim |
| Recorte de frente `m`/`s` | 2 (1 recorte) | sim |
| Miniaturas | 10 | sim |
| Recortes "encontrado" `m`/`s` | 20 (10 alvos) | não (adiados) |
| Arte de intro/transição | 1 | sim (intro/transição da plataforma) |
| Emblema do mundo | SVG inline | — |

Fora do skeleton: maquete da Home em 7 passes (só na promoção, §20), sons
novos, animação ambiente, segunda cena.

---

## 18. Platform reuse

### 18.1 Reutilizado como está

| Peça | Arquivo | Como o Game 03 usa |
| --- | --- | --- |
| União `GameId` | `src/types/game.ts` | novo membro `"hidden-objects"` |
| Contrato de entrada | `src/games/entry-contract.ts` | `{ readiness: "explicit" }`, watchdog padrão (12 s) |
| Registry + lazy | `src/games/index.ts` | um `import()` literal → chunk próprio |
| `GameScreen` | `src/components/GameScreen.tsx` | intocado: intro → load → mount; falha de chunk → `onEntryError` |
| Entrada / watchdog / retry | `useWorldEntryController`, `WorldEntryTransition` | intocados; a transição usa `transitionArt` plano (não é mundo de cena mestre) |
| Intro | `GameHowToPlay` + `GAME_INTROS` | uma entrada de copy (3 passos); rótulo do CTA cai no padrão "Começar" |
| Props | `GameComponentProps` | `onComplete`, `onExit`, `onEntryReady`, `onEntryError` (`continuation` não usada na v1) |
| Resultado | `GameResult` via `onComplete` | o shell salva (`saveGameResult`); o jogo nunca toca `localStorage` |
| Tela de resultado | `RewardResultModal` + `WORLD_REWARD_COPY` | uma entrada de copy; caminho genérico (não Rota) |
| Rótulos de detalhe | `src/lib/detail-labels.ts` | 3 rótulos novos (aditivos) |
| Metadados de mundo | `GAME_WORLDS`, `WORLDS`, `WORLD_VISUALS`, `WorldEmblem` | entradas novas (`WorldKey` `discovery`) |
| Som | `src/lib/game-sounds.ts` | preferência existente + `playSuccessChime` |
| Tipo de dificuldade | `DifficultyLevel` (`src/types/game.ts`) | estado interno |
| Validação | `evidence.mjs` (códigos de saída), `--rev`, mutantes, probes Playwright read-only, gate do lock | suítes próprias do Game 03 (§22.5) |
| Padrões de lifecycle | sessão dona dos timers (Circuito, `scheduleForSession`); prontidão após decode + 2 frames (Circuito) | **copiados como padrão**, código próprio |

**`GameResult` do Game 03 (v1):**

```text
activityId "hidden-objects" · activityTitle "Estúdio das Descobertas" · gameId "hidden-objects"
score     = objetos encontrados (5, 6 ou 8) — sem penalidade por pista, "Mostrar" ou toque livre
summary   "Você encontrou os 6 objetos do Estúdio."
details   { objectsFound: 6, objectsTotal: 6, difficultyLabel: "Médio", won: true }
continuation: ausente
```

- `won: true` é o sinal explícito de sucesso que `isSuccessfulResult` já lê
  primeiro (`src/engine/rewards.ts`) — reuso sem mudar a plataforma. Custo
  conhecido: a tela de resultado lista todos os `details`, então aparece
  "Vitória: Sim" (D14, §24).
- `difficultyLabel` em vez de `difficulty`: `formatDetailValuePt` traduz
  `"easy"` como "Aberto" (vocabulário da Rota); o Game 03 usa
  Fácil/Médio/Difícil.
- Toques livres, pistas e tempo **não** entram em `details` (a tela os
  mostraria como avaliação).

### 18.2 Mount ≠ start

O `GameScreen` monta o jogo **sob a intro** (`inert`, `aria-hidden`) para os
assets carregarem enquanto o Explorador lê. Logo: nada de câmera animada,
som ou timer na montagem; tudo começa em "Explorar". Quando a intro some, o
foco vai para o primeiro controle do painel de preparação.

### 18.3 O custo de registrar um `GameId` (D15 medido, não consolidado)

Tabelas que o TypeScript obriga a preencher para um `GameId`/`WorldKey`
novo, todas **aditivas**, sem mudança de lógica:

| # | Arquivo | Entrada |
| --- | --- | --- |
| 1 | `src/types/game.ts` | `GameId` |
| 2 | `src/games/entry-contract.ts` | contrato |
| 3 | `src/games/index.ts` | loader |
| 4 | `src/data/worlds.ts` | `WorldKey` + `WORLDS` + `GAME_WORLDS` |
| 5 | `src/data/game-intros.ts` | `INTRO_COPY` |
| 6 | `src/engine/rewards.ts` | `WORLD_REWARD_COPY` |
| 7 | `src/lib/detail-labels.ts` | rótulos (opcional, mas sem eles a tela mostra "objects Found") |
| 8 | `src/components/worlds/worldVisuals.ts` | `WORLD_VISUALS` |
| 9 | `src/components/worlds/WorldEmblem.tsx` | `MARKS` (+ marca SVG) |
| 10 | `src/components/home/homeLayout.ts` | `HomeWorldKind` + `HOME_WORLD_LAYOUT` (não renderizado no skeleton) |
| 11 | `src/components/worlds/diorama/worldDioramaLayout.ts` | `WorldDioramaKind` + config (uma camada; não renderizada no skeleton) |
| 12 | `src/components/three/world-palette.ts` | `WORLD_3D_PALETTE` (lab 3D) |
| — | `src/data/activities.ts` | atividade `available` (Home só mostra o que está em `PLAYABLE_STAGE_IDS`) |
| — | `src/engine/stage-progress.ts` | **não** no skeleton (é o que põe o mundo na Home) |

E três suítes de plataforma **fixam a lista de 5 jogos** e precisam de uma
entrada nova: `game-readiness-registry-tests.mjs` (`PINNED`),
`game-entry-watchdog-registry-tests.mjs` (`PINNED`) e
`game-continuation-contract-tests.mjs` (`GAME_IDS`). O gate do lock **não**
precisa: o A4 lê a união `GameId` e confere loaders/contratos contra ela.

Decisão: o skeleton preenche as tabelas e registra a contagem real de
arquivos tocados. Consolidar metadados (D15) ou promover rótulos/sucesso a
metadado (D14) é decisão **posterior ao skeleton**, com essa evidência —
classe 5 da política de mudança ("requisito de plataforma achado por um
segundo consumidor real").

### 18.4 Específico do Game 03 (fica em `src/games/hidden-objects/`)

Câmera (matemática pura), reconhecedor de gestos (máquina de estados pura),
hit test, reducer da sessão (fases, achados, pistas, respiro), configuração
da cena (dados), renderer de camadas, HUD/lista/preparação/Apoio/fechamento,
CSS com prefixo `.hos-*` (regra do Visual System: CSS isolado por feature,
nada novo em `globals.css`), e os assets em
`public/assets/hidden-objects/`.

---

## 19. Route-specific boundaries

**Não importar no Game 03** (domínio da Rota, listado como ROTA-SPECIFIC no
lock §10): `route-state`, `route-events`, `route-session`,
`route-generation` (+ job, client, runner, worker, protocol, executor),
`route-defenders`, `route-invariants`, `route-config`, `route-geometry`,
`continuation.ts`, `useEscapeMaze`, `RouteBabylonBoard`/`routeBabylonScene`,
`route-visual.css`, `src/engine/route-random.ts`, `src/engine/difficulty.ts`.

| Tentação | Por que não | O que fazer |
| --- | --- | --- |
| Worker de geração | o Game 03 não tem computação pesada (hit test é O(alvos) por toque) | nada |
| RNG seeded da Rota | a v1 é determinística (listas fixas, deslocamento da pista por hash do `id`) | nada; se um dia sortear, RNG próprio do jogo |
| Gestos do `routeBabylonScene` | vivem dentro da cena Babylon e decidem movimento de peça | copiar a **política** (limiar, multitoque nunca toca) em módulo próprio com testes próprios |
| Reducer/eventos C5/C6 | vocabulário da Rota (turno, defensores, baú) | reducer próprio pequeno (preparar/explorar/fechamento) |
| Cena mestre (`WorldMasterScene`) | contrato dos dois mundos-herói (Rota/Circuito); tipo `MasterSceneGameId` restrito a eles | transição/intro com `transitionArt`/`introArt` planos; avaliar cena mestre só se o Game 03 virar herói |
| Lifecycle de timers do Circuito | o código é do `useColorSequenceGame` | copiar o **padrão** `scheduleForSession` (sessão dona, revoke no unmount) |
| Bandeja de apoio do Circuito | componente do Circuito | recriar o padrão "Apoio do Explorador" no HUD próprio |

Os validadores do Game 03 **não nomeiam** fontes da Rota (assim o
`route-validation-coupling-gate` não precisa de declaração nova) e não usam
`loadRouteModules`.

---

## 20. Legacy slot recommendation

### 20.1 Auditoria dos jogos legados (todos fora do lock)

| | `security-panel` — Central de Comandos | `number-trail` — Trilha Lógica | `seed-garden` — Jardim de Sementes |
| --- | --- | --- | --- |
| Mecânica real (código) | ler um comando e tocar os sistemas (Som, Água, Luz, Energia) na ordem + "Ativar"; regra "não toque em X" a partir dos níveis 3 e 5; 3 enganos encerram (`SECURITY_PANEL_MAX_ERRORS`) | 5 → 12 pedras numeradas em posições embaralhadas; a ordem dos alvos também é sorteada (`shuffledValues`): o Explorador **procura o número mostrado**; 3 enganos encerram (`NUMBER_TRAIL_MAX_ERRORS`) | 6 vasos, semeadura tipo mancala com prévia sem custo; 7 puzzles fixos, 8 movimentos |
| Domínio cognitivo | seguir instrução verbal, memória operacional, inibição | **busca visual / atenção seletiva** (a "ordem lógica" do nome é fraca: a ordem é aleatória) | planejamento, causa e efeito, contagem |
| Redundância | parcial com o Circuito (sequência), mas única em instrução verbal + inibição | **alta com o Game 03** (mesmo domínio, forma abstrata) | baixa (a Rota planeja no espaço; o Jardim, na quantidade) |
| Maturidade | legado: `GameLayout`/`StatCard`/`StatusBanner`, 673 linhas, 3 `setTimeout` sem dono (D11), `frame-fallback` | legado: 484 linhas, 3 `setTimeout` sem dono (D11), `frame-fallback` | legado: 558 linhas, 2 timers sem dono (D11); o Visual System o chama de "mais próximo do conceito" |
| Evolução recente | nenhuma mudança nos 50 commits mais recentes da integração (histórico auditado a partir de `580b230`, 2026-08-14) | idem | idem |
| Tom MindFlow | neutro; limite de enganos | **parece teste de cancelamento/trilhas (clínico)**; limite de enganos | calmo |
| Papel na Home | mundo quieto, `navOrder` 3 | mundo quieto, `navOrder` 4 | mundo quieto, `navOrder` 5 |

### 20.2 Recomendação

```text
GAME03_LEGACY_SLOT_RECOMMENDATION = number-trail (Trilha Lógica)
```

- **Redundância cognitiva**: o Game 03 é a versão rica e ecológica do mesmo
  exercício (achar um alvo entre distratores).
- **Coerência com a direção**: a Trilha é a forma mais "teste clínico" do
  catálogo — exatamente o que o Game 03 não pode parecer — e encerra a sessão
  por enganos, contra "erro sem vergonha".
- **Custo**: tirar a Trilha elimina 3 timers sem dono (D11) e um uso do
  `GameLayout` legado, sem tocar nos mundos-herói.
- **Segundo candidato, depois**: `security-panel` (sobreposição com o
  Circuito). **Fica**: `seed-garden` (domínio único e o mais próximo do
  conceito).

Nada é removido nesta missão.

### 20.3 Como a troca deve acontecer (missão futura de promoção)

Só depois do gate de diversão do skeleton (§22.7):

1. `hidden-objects` entra em `PLAYABLE_STAGE_IDS` na posição da Trilha
   (mundo quieto, `navOrder` 4), com maquete da Home em 7 passes (o
   vocabulário dos mundos secundários: contact-shadow, base, back, main,
   detail, energy, front) e arte de transição/intro definitiva.
2. `number-trail` sai do `GameId`, do registry, das 12 tabelas e das 3
   suítes que fixam a lista; código e assets da Home (`dioramas/trail/`,
   `world-trail.webp`) vão para `docs/archive/`.
3. **Histórico salvo**: resultados antigos com `gameId: "number-trail"`
   continuam no `localStorage`. Hoje `getWorldMeta` cai no Circuito para id
   desconhecido e `WORLD_REWARD_COPY` cai na cópia do Circuito — a Trilha
   apareceria como "Circuito de Memória" no histórico. A promoção precisa
   de um tratamento para mundo aposentado (metadado de exibição ou fallback
   neutro): requisito de plataforma achado pelo Game 03 (classe 5).

---

## 21. Risks

Como a ideia pode ficar bonita no mockup e ruim no produto:

| # | Risco | Por que o mockup esconde | Mitigação | Onde se prova |
| --- | --- | --- | --- | --- |
| R1 | **Tocar em tudo** (toque livre grátis) vira a estratégia | imagem estática não mostra comportamento | respiro (§7.7), níveis de encontrabilidade, playtest de toques livres por achado | playtest (§22.7) |
| R2 | **Caça ao pixel** / objeto injusto | no mockup os alvos são os objetos mais salientes | contrato F1–F14, prancha de revisão, validador | skeleton |
| R3 | **"Massa" de IA**: iscas e duplicatas que parecem alvos | o mockup inteiro é geração | auditoria de iscas (§17.3) | arte |
| R4 | **Arte é o caminho crítico**: uma sala densa e coerente leva dias | o mockup parece "pronto" | teste de prancha antes do código; pool de 10 numa cena só | primeiro passo do skeleton |
| R5 | **Rejogabilidade** de uma cena (decorada na 2ª vez) | uma imagem não mostra a 2ª sessão | listas diferentes por dificuldade; sorteio e cenas novas só após playtest | playtest |
| R6 | **Celular**: cena minúscula, HUD comendo a tela | o mockup é 16:9 de desktop | 2:1 com uma zona por tela, HUD encaixado, F3 no celular de referência | skeleton |
| R7 | **Gestos**: seleção acidental no pan, pan acidental no toque (tremor) | sem interação no mockup | contrato §7, limiares a validar com idosos | skeleton |
| R8 | **Nitidez/custo do zoom em DOM** (iOS) | — | will-change só no gesto; costura para Canvas 2D (§15.2) | skeleton, aparelho real |
| R9 | **Memória** em aparelho fraco (~30 MB decodificados) | — | tier `s`, orçamentos (§16) | skeleton |
| R10 | **UI cobrindo alvos** | ~30% do mockup é UI sobreposta | HUD fora da cena, margens seguras (F5) | skeleton |
| R11 | **Lista vira planilha escolar** | o painel do mockup é bonito mas é uma lista de palavras com check | imagem/silhueta, copy calma, arte adulta, nada de "acertos" | playtest |
| R12 | **Tela de resultado destoa** ("Vitória: Sim", score em destaque, confete) | fora do mockup | aceito no skeleton; decisão D14 com evidência | playtest (§24) |
| R13 | **Dor de registro** (12 tabelas + 3 suítes) gera `GameId` meio registrado | — | o TypeScript obriga as tabelas; checklist §18.3 | skeleton |
| R14 | **Histórico mal rotulado** ao aposentar a Trilha | — | tratamento de mundo aposentado na promoção (§20.3) | promoção |
| R15 | **Prontidão** acima de 12 s em rede lenta | — | orçamentos; medir antes de declarar `entryWatchdogMs` | skeleton |
| R16 | **Explorar sem motivo para aproximar** (zoom não é usado) | a imagem é "bonita de longe" | níveis B/C pedem zoom; microdetalhes que recompensam o olhar | playtest (uso de zoom) |
| R17 | **Copiar a Rota/Circuito por atalho** | — | §19; validadores sem nomes da Rota | revisão |

---

## 22. Skeleton scope — GAME03-SKELETON-01

Objetivo: o **menor protótipo jogável que prove o coração do jogo** —
explorar uma cena e encontrar objetos com calma, no celular e no desktop —
entrando e saindo pela plataforma real.

### 22.1 Dentro

1. **Registro** do `GameId` `hidden-objects` em todas as tabelas de §18.3
   (aditivo), `readiness: "explicit"`, watchdog padrão, loader lazy, copy de
   intro e de resultado, rótulos de detalhe, metadados de mundo
   (`WorldKey` `discovery`), emblema SVG simples. **Não** entra em
   `PLAYABLE_STAGE_IDS`: nada aparece na Home de produção.
2. **Entrada só por laboratório**: `/lab/discovery-studio` (só em
   desenvolvimento, pelo `lab/layout.tsx` existente), montando o fluxo real
   como o `/lab/3d-home` faz: `useWorldEntryController` +
   `WorldEntryTransition` + `GameScreen` + `RewardResultModal`, com
   resultados transitórios (`createTransientGameResult`, sem escrever no
   histórico).
3. **Jogo** em `src/games/hidden-objects/`: preparação (dificuldade + linha
   de controles + Explorar), cena DOM 2.5D (back/plate/front/fx, parallax
   leve), câmera híbrida (§6), gestos (§7), hit test (§7.4), feedback
   (§12), lista com estados e progresso, Pista progressiva + Mostrar
   (§11), respiro (§7.7), estações, Recentrar, +/−, Apoio com D-pad e
   Recomeçar, fechamento com "Concluir exploração"/"Continuar olhando",
   `onComplete` uma vez, `onExit`, prontidão explícita e erro de asset.
4. **Dados**: 1 cena, 3 estações, pool de 10 alvos, listas 5/6/8 fixas.
5. **Assets** de §17.6 + script de export + README + prancha de revisão.
6. **Layouts**: desktop, celular retrato (referência), celular paisagem.

### 22.2 Fora (explicitamente)

Card/mundo na Home de produção; remover a Trilha; `GameContinuation`;
segunda cena; sorteio de listas; narrativa; animação ambiente; sons novos;
analytics; persistência de dificuldade; mosaico/deep zoom; AVIF; renderer
Canvas (só se o critério de §15.2 disparar — então **parar e reportar**);
qualquer consolidação de plataforma (D14/D15); "achados livres" fora da
lista; mudanças na Rota ou no Circuito.

### 22.3 Arquivos previstos (intenção)

```text
src/games/hidden-objects/
  HiddenObjectsGame.tsx        componente do registry (GameComponentProps)
  HiddenObjectsScene.tsx       renderer de camadas + superfície de entrada
  HiddenObjectsHud.tsx         barra, lista/bandeja, Pista, estações, Apoio, fechamento
  HiddenObjectsSetup.tsx       painel de preparação
  useHiddenObjectsSession.ts   reducer + timers donos da sessão
  useSceneCamera.ts            liga gestos/roda/teclado à câmera (ref + rAF)
  scene-config.ts              cena, camadas, estações, alvos, presets (dados)
  camera.ts                    matemática pura da câmera
  gesture.ts                   máquina de estados pura dos gestos
  hit-test.ts                  hit test puro em su
  session.ts                   reducer puro da sessão
  hidden-objects.css           prefixo .hos-*
src/app/lab/discovery-studio/page.tsx
public/assets/hidden-objects/explorer-studio/v1/…        (§17.5)
tools/assets/create_hidden_object_scene.mjs
tools/validation/hidden-objects-skeleton-tests.mjs
tools/validation/hidden-objects-browser-probe.mjs
```

### 22.4 Critérios de aceite

- Lab → transição → intro → preparação → explorar → encontrar todos →
  fechamento → resultado → "praticar outra vez" (sessão nova) e "continuar
  jornada", em desktop e celular emulado.
- Arrastar nunca seleciona; dois dedos nunca selecionam; toque parado
  seleciona; toque que para a câmera não seleciona.
- Zoom respeita mínimo/máximo; a cena nunca mostra vazio fora da sala.
- Cada dificuldade mostra a lista certa, no estilo certo; todos os alvos
  achados → um resultado com o formato de §18.1.
- Pista: estágios por dificuldade, "Mostrar" depois deles; nenhum beco sem
  saída.
- Reduced motion respeitado (§13); teclado completo com mira.
- Nenhum timer ou listener sobrevive a sair, recomeçar ou desmontar.
- Falha de asset essencial → painel de retry da plataforma → nova sessão.
- Orçamentos de §16.1 cumpridos; zero pacote novo.
- **O gate do lock continua 18/18**; o grafo da Home não ganha código do
  Game 03 (A3); o shell continua agnóstico (A9).

### 22.5 Validação

- `npm run lint`, `npx tsc --noEmit`, `npx next build`, `git diff --check`.
- `node tools/validation/gameplay-platform-lock-v1.mjs` (+ `--counterfactuals`).
- Suítes de plataforma com a entrada nova: `game-readiness-registry-tests`,
  `game-entry-watchdog-registry-tests`, `game-continuation-contract-tests`,
  `production-diagnostic-boundary-tests` (a rota de lab não pode vazar para
  produção).
- `hidden-objects-skeleton-tests.mjs` (Node, sem browser): câmera (limites e
  zoom numa matriz de viewports), gestos (sequências sintéticas: toque,
  arrasto no limiar, pinch → nunca toque, catch, cancel, botão direito,
  dedo parado > 1 s), hit test (bordas, tolerância por dificuldade,
  sobreposição), sessão (achar, repetir, último achado → fechamento uma vez,
  Concluir uma vez, Recomeçar e unmount revogam timers, respiro, pista →
  Mostrar), dados de fairness (F2, F3, F5, F6, F8 rótulos, F10, F11),
  formato do resultado; contrafactuais e mutantes no estilo do repo.
- `hidden-objects-browser-probe.mjs` (Playwright, build de produção para o
  chunk e `next dev` para o lab): fluxo completo em 1440×900 (mouse) e
  390×844 (toque, pinch via CDP), reduced motion, retry com a prancha
  bloqueada, 0 erros de página/console; nitidez no zoom máximo depois de
  parar (comparação de recorte) e Long Tasks no fim do gesto (informativo).
- Medição do chunk e dos assets contra §16.1.

### 22.6 Sequência recomendada

1. **Arte primeiro**: briefing → prancha → **teste de prancha** (abaixo).
2. Módulos puros + validador Node.
3. Renderer + câmera + gestos no lab.
4. Sessão, HUD, pista, fechamento, resultado.
5. Probe de browser, orçamentos, aparelho real (iOS + Android).
6. Playtest e relatório do gate de diversão.

### 22.7 Como provar cedo que é divertido

**Teste de prancha (antes de qualquer código, ~30 min):** a prancha
exportada aberta como imagem num celular, com o zoom nativo do visualizador
de fotos; 3 pessoas recebem a lista do Médio. Observar: tempo até o
primeiro achado, objetos que ninguém acha, objetos achados por engano
(iscas), comentários ("isso é uma chave?"). Valida a arte e o fairness, que
são o caminho crítico, sem esperar o jogo.

**Gate de diversão do skeleton** (`GAME03_FUN_GATE`), com um log de sessão
só no lab (transitório, nada em produção, sem analytics):

- Participantes: ≥ 6 (≥ 2 com 60+ anos, ≥ 1 que quase não joga; 4 no
  celular, 2 no desktop); Fácil e depois Médio; pensando em voz alta.
- Medidas: tempo até o primeiro achado; intervalo mediano entre achados;
  toques livres por achado; pistas e "Mostrar" por objeto; conclusão; uso de
  zoom; estações visitadas; seleções acidentais relatadas.
- Perguntas: "Sentiu pressa?", "Achou algo que não tinha notado no
  começo?", "Algum objeto pareceu injusto? Qual?", "Algum toque fez o que
  você não queria?", "Jogaria outra cena?", calma de 1 a 5.
- **Passa** se: ≥ 5/6 concluem o Fácil sem "Mostrar"; mediana de toques
  livres por achado ≤ 3; nenhum objeto apontado como injusto por ≥ 2
  pessoas; nenhuma seleção acidental no pan relatada; ≥ 4/6 jogariam outra
  cena; calma mediana ≥ 4; ≥ 3/6 usam zoom no Médio.
- **Ajusta** (e testa de novo) se: Fácil concluído em < 60 s sem explorar
  (fácil demais: é só uma lista); "Mostrar" em > 50% dos objetos do Médio
  (difícil demais); > 1 seleção acidental por sessão (rever limiares);
  "parece um teste" (rever moldura e copy).

---

## 23. Decisions

```text
GAME03_PROVISIONAL_NAME            = Estúdio das Descobertas ("Explore e encontre");
                                     GameId hidden-objects · WorldKey discovery · cena explorer-studio
GAME03_CORE_LOOP                   = preparar → explorar → tocar → retorno calmo → lista → … →
                                     fechamento → onComplete (um por sessão); sair = onExit sem resultado
GAME03_SCENE_THEME                 = Estúdio do Explorador, hora dourada; 2:1 (3200×1600 su);
                                     zonas Janela · Mesa · Estante; ~75 decorativos; ~30% de repouso
GAME03_SCENE_TECH                  = DOM_2_5D (camadas WebP + transform; câmera/gestos/hit test puros;
                                     fallback de renderer Canvas 2D só pelo critério §15.2)
GAME03_CAMERA_MODEL                = HYBRID — livre em limites "cover" + 3 estações explícitas + Recentrar;
                                     zoom cover → clamp(1,25 px/su, 2×, 4×); sem snap automático
GAME03_INPUT_MODEL                 = reconhecedor único de Pointer Events; toque ≤ 14 px (6 px mouse),
                                     ≤ 1000 ms, nunca multitoque, nunca "catch"; hit test geométrico em su;
                                     roda = zoom no cursor; teclado com mira; sem duplo toque
GAME03_TARGET_MODEL                = pintado na prancha + recorte "encontrado" alinhado + forma de hit
                                     da parte visível; pool de 10 (A4 · B3 · C3)
GAME03_DIFFICULTY_MODEL            = Fácil 5 (4A+1B, imagem) · Médio 6 (2A+3B+1C, silhueta) ·
                                     Difícil 8 (2A+3B+3C, palavra) + força da pista + tolerância; sem tempo
GAME03_HINT_MODEL                  = Pista explícita, por objeto, 2 estágios por dificuldade
                                     (halo deslocado, raio por estágio) → Mostrar onde está; sem custo
GAME03_ASSET_PIPELINE              = GPT por zona → Photoshop master 6400×3200 (P_/T_/O_/F_/B_) →
                                     auditoria de iscas → fairness → exports sem perda (docs/archive) →
                                     sharp → public/assets/hidden-objects/explorer-studio/v1/
GAME03_PLATFORM_REUSE              = registry + import(), contrato explicit (watchdog padrão), GameScreen,
                                     entrada/retry, intro, GameComponentProps, GameResult + persistência
                                     do shell, RewardResultModal, metadados de mundo, game-sounds,
                                     convenções de validação; zero refactor
GAME03_LEGACY_SLOT_RECOMMENDATION  = number-trail (Trilha Lógica), na promoção; security-panel depois
GAME03_SKELETON_SCOPE              = §22: lab-only pela plataforma real; 1 cena; 3 estações; pool de 10;
                                     listas 5/6/8; pan/zoom/pinch/teclado; pista + Mostrar; fechamento;
                                     resultado; restart; readiness; mobile + desktop
GAME03_BABYLON                     = NO
GAME03_NEW_RUNTIME_DEPENDENCY_REQUIRED = NO
```

Nenhuma decisão ficou "TBD". O que depende genuinamente de playtest está em
§24, cada item com um valor inicial concreto.

---

## 24. Open items requiring skeleton playtest

Todos `TO_VALIDATE_IN_SKELETON`: o skeleton nasce com o valor indicado e o
playtest/medição decide se fica.

| # | Item | Valor inicial | Como decidir |
| --- | --- | --- | --- |
| V1 | Nitidez e custo do zoom em DOM no iOS Safari e Android Chrome | `will-change` só no gesto | §15.2: borrão persistente ou > 1 Long Task > 100 ms por fim de gesto → parar e propor renderer Canvas 2D |
| V2 | Limiar de toque, duração máxima e ponto do toque | 14/6 px, 1000 ms, ponto do `pointerdown` | seleções acidentais e toques "que não pegaram" relatados por idosos |
| V3 | Fronteiras dos níveis A/B/C e tamanhos 5/6/8 | §5.5, §10 | toques livres por achado, pistas e "Mostrar" por objeto, conclusão |
| V4 | Raios/estágios da pista | §11.2 | uso de "Mostrar" e relatos de "pista inútil" ou "pista entrega" |
| V5 | Respiro (5 toques em 4 s → 2 s) | ligado | ajuda ou irrita? se irritar, desligar |
| V6 | Parallax (0,92 / 1,05) | ligado (desligado em reduced motion) | profundidade percebida × desconforto/confusão |
| V7 | Altura da bandeja e layout em paisagem | ~144 px; coluna de 220 px | área útil e relatos de aperto |
| V8 | Política de tier de imagem e memória em Android fraco | `m` padrão, `s` com `deviceMemory ≤ 2`/`saveData` | travamentos/recarregamentos de aba |
| V9 | Prontidão em rede lenta | watchdog padrão de 12 s | medir; declarar `entryWatchdogMs` só com número |
| V10 | Rejogabilidade de uma cena | listas fixas | interesse na 2ª sessão; decide sorteio e prioridade da 2ª cena |
| V11 | Encaixe da tela de resultado ("Vitória: Sim", score em destaque, confete) | aceito como está | se destoar, propor D14 (desfecho/rótulos como metadado) com esta evidência |
| V12 | Mira de teclado, `role="application"` e anúncios | §7.3, §13 | teste com teclado, NVDA e VoiceOver |
| V13 | Uso de zoom | — | se ninguém aproxima no Médio, densidade/tamanhos estão errados |
| V14 | Inércia, fatores de roda, durações de deslizamento | §6.2 | relatos de "câmera escorregando" ou "dura" |
| V15 | Lembrar a dificuldade entre sessões | não lembra | se pedirem, membro novo em `GameContinuation` |
| V16 | Convite à pista após inatividade | não existe | perguntar no playtest se teriam querido |
| V17 | Gate de diversão | §22.7 | passa / ajusta |

---

## Apêndice A — Arquivos auditados

Documentos: `docs/GAMEPLAY_PLATFORM_LOCK_V1.md`, `docs/SOURCE_OF_TRUTH.md`,
`docs/ARCHITECTURE.md`, `docs/MINDFLOW_EXPERIENCE_BOOK.md`,
`docs/MINDFLOW_VISUAL_SYSTEM.md`, `docs/MINDFLOW_WORLD_MASTER_SCENES.md`,
`docs/MEMORY_CIRCUIT_ASSET_SPEC.md`, `public/illustrations/home/README.md`,
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
(Next 16: `priority` depreciado, `unoptimized`, `qualities`, `deviceSizes`).

Plataforma: `src/types/game.ts`, `src/games/entry-contract.ts`,
`src/games/index.ts`, `src/components/GameScreen.tsx`, `src/app/page.tsx`,
`src/app/lab/layout.tsx`, `src/app/lab/route-launcher/page.tsx`,
`src/app/lab/3d-home/page.tsx`, `src/components/world-entry/useWorldEntryController.ts`,
`src/components/world-entry/worldEntryTypes.ts`, `src/components/WorldEntryTransition.tsx`,
`src/components/GameHowToPlay.tsx`, `src/components/RewardResultModal.tsx`,
`src/data/activities.ts`, `src/data/worlds.ts`, `src/data/game-intros.ts`,
`src/engine/stage-progress.ts`, `src/engine/storage.ts`, `src/engine/rewards.ts`,
`src/engine/scoring.ts`, `src/lib/detail-labels.ts`, `src/lib/confetti.ts`,
`src/components/home/HomeStage.tsx`, `src/components/home/homeLayout.ts`,
`src/components/worlds/worldVisuals.ts`, `src/components/worlds/WorldEmblem.tsx`,
`src/components/worlds/diorama/worldDioramaLayout.ts`,
`src/components/worlds/diorama/WorldDiorama.tsx`,
`src/components/worlds/diorama/WorldDioramaLayer.tsx`,
`src/components/worlds/master-scene/worldMasterSceneConfig.ts`,
`src/components/three/world-palette.ts`, `src/app/globals.css`
(`touch-action`, `dvh`, safe-area), `src/styles/world-entry.css`.

Jogos: Circuito (`MemoryCircuit3DGame.tsx`, `MemoryCircuitStage.tsx`,
`MemoryCircuitPadLayer.tsx`, `MemoryCircuitAccessibleControls.tsx`,
`useCircuitSceneParallax.ts`, `memoryCircuitLayout.ts`); Rota
(`routeBabylonScene.ts` — camada de gestos; estrutura de módulos via lock e
ARCHITECTURE); legados (`SecurityPanelGame.tsx`, `NumberTrailGame.tsx`,
`SeedGardenGame.tsx`).

Ferramentas e configuração: `package.json`, `next.config.ts`,
`eslint.config.mjs`, `.gitattributes`,
`tools/validation/gameplay-platform-lock-v1.mjs` (A3, A4, A5, A9, D3),
`tools/validation/route-validation-coupling-gate.mjs`,
`tools/validation/memory-circuit-lifecycle-tests.mjs`,
`tools/validation/route-module-loader.mjs`,
`tools/validation/game-readiness-registry-tests.mjs`,
`tools/validation/game-entry-watchdog-registry-tests.mjs`,
`tools/validation/game-continuation-contract-tests.mjs`, `tools/assets/`,
`tools/blender/`; inventário e tamanhos de `public/` e `docs/archive/`.

## Apêndice B — Validação desta missão

- `git diff --check`: limpo.
- Nenhum arquivo em `src/` alterado; `package.json` e `package-lock.json`
  inalterados (o `npm ci` usado para rodar o gate não move o lockfile).
- `node tools/validation/gameplay-platform-lock-v1.mjs`: 18/18,
  `GAMEPLAY_PLATFORM_LOCK_GATE_HOLDS`.
- CORE/DEEP/build não rodados: missão só de documentação.

`GAME03_DISCOVERY_01 = PASS`

`GAME03_SKELETON_01 = READY TO PLAN`
