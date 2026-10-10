# MindFlow — Game 03 Multiscene 03 · Estúdio das Descobertas em duas salas

Missão GAME03-MULTISCENE-03. Branch `feat/game03-multiscene-03`, base exata
`58b5f08bebee4a3eeee1398075208dbeee9ee27e` (`feat(game03): complete experience-02
with target pool v1`). Integração canônica: `v06-portal-requires-lights` — **sem
merge nesta missão, sem PR**.

**Veredito: `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`.** O Game 03 virou um jogo de
várias salas com um motor só: o Estúdio do Explorador (cena 01, com comportamento
idêntico ao da EXPERIENCE-02) e o **Observatório do Explorador** (cena 02, nova).
Tudo o que uma máquina verifica passou — suites, contrafactuais, mutantes, auditoria
de arte, justiça das rodadas, probes de browser no build de produção, regressões da
plataforma, CORE e DEEP (§10). Se o Observatório é bonito, justo e calmo para
pessoas, e se a escolha de sala é clara, só o playtest humano diz (§13). **Nada aqui
está travado; o Game 03 V1 não é declarado travado.**

---

## 1. O que existe agora

Home (um único card do Game 03, como antes) → transição → intro → **preparar**:
"Cena" (Estúdio do Explorador · Observatório do Explorador, cada uma com uma
prévia, o nome e uma linha) e "Dificuldade" (Fácil 5 · Médio 6 · Difícil 8, sem
mudança) num cartão só → **"Explorar" sorteia a rodada daquela sala** → a sala →
arrastar, aproximar, estações da sala (Estúdio: Janela/Mesa/Estante; Observatório:
Cúpula/Bancada/Arquivo; teclas 1–3), Recentrar, Pista → lista completa → "Estúdio
explorado" / "Observatório explorado" → resultado pela tela compartilhada →
"Praticar outra vez" (mesma sala, rodada nova) ou "Continuar jornada".

Durante a rodada, o topo tem **"Trocar de cena"** (volta ao preparar, não salva
nada) e **"Recomeçar"** (mesma sala, mesma dificuldade, mesma lista). Sem
desbloqueio, campanha, estrelas, cronômetro, vidas, ranking ou placar.

## 2. Branch, base e commits (relatório A)

| Commit | O quê |
| --- | --- |
| `58b5f08` | base exata (EXPERIENCE-02 completa) |
| `6bb02f9` | contrato de cena, registro de salas, dados do Observatório |
| `ced0a9e` | arte v1 do Observatório e sua auditoria |
| `671b5b5` | suite multiscene, probe multiscene, alvos pequenos maiores |
| `f95bbfe` | "Explorar" visível em celulares baixos; relatório de justiça por sala |
| `db4251f` | orçamento de entrada por sala no M17; relatórios de rodada por sala |
| `9de3b0b` | prévias pelo otimizador de imagem; parede do arquivo menos vazia; evidência |
| `4dc7da7` | registro da missão (este doc) e ARCHITECTURE.md |
| (seguinte) | CORE/DEEP no registro; revisão do texto |

O SHA final e o HEAD remoto estão no relatório de fechamento da sessão.

## 3. Arquitetura (relatório B)

**Uma sala é dado.** `hidden-objects-scene.ts` deixou de ser o Estúdio e virou o
**contrato**: `SceneDefinition` = `id`, `name`, `copy` (linha da prévia, rótulo da
viewport, título de conclusão, resumo do resultado), `preview`, `width`/`height`,
`stations` + `initialStation`, `pool` (`HiddenObjectDefinition`: id, rótulo, rótulo
acessível, pista de função, tier, estação, região de toque autoral, textos de pista
por degrau, `listedAs` opcional), `lookAlikes` (sósias com `resembles`), `layers`
(camadas com parallax e retângulos opacos), `thumbnail(id)` e `backdrop`. O
contrato mantém o que é global e congelado: `DIFFICULTY_PRESETS`,
`DIFFICULTY_ORDER`, margens seguras, folga de sósia.

- `scenes/explorer-studio.ts` — os dados do Estúdio **movidos sem mudança** (mesmos
  nomes, mesmas regiões, mesmas camadas; `EXPLORER_STUDIO` só os embrulha).
- `scenes/explorer-observatory.ts` — a sala nova (§5).
- `hidden-objects-scenes.ts` — o registro: `SCENES` (a ordem do seletor),
  `DEFAULT_SCENE`, `sceneById`, e a sala lembrada **só em memória** nesta visita
  (`rememberScene`/`forgetScene`; nada é salvo; uma sala que falhou é esquecida).

**Um motor.** Câmera, controlador, rodadas e modelo recebem a sala como primeiro
argumento (`clampCamera(scene, …)`, `selectRoundTargets(scene, difficulty, seed)`,
`hitTest(scene, …)`, `hintHalo(scene, …)`); o controlador recebe `scene` nas opções;
`SessionState.scene` guarda a sala da rodada. Não existe
`HiddenObjectsGameForStudio`/`…ForObservatory` nem `if (scene.id === …)` no motor
(o mutante "um ramo específico de sala vaza para o motor" é pego pelo M03). A
câmera fora do React, o gesto, o hit test em espaço de cena, o parallax que nunca
move a geometria, a prontidão (`SceneReadiness`), pistas, achados, resultado,
acessibilidade e layout móvel são os mesmos para as duas salas.

**Prova de que o Estúdio não mudou** (M06 e E01): dados, regiões, sósias e camadas
iguais a `58b5f08`; as rodadas de 1.500 sementes × 3 dificuldades iguais; traços de
sessão, grade de hit test e bytes da arte iguais; uma varredura de câmera (210 KB
de números) e registros do controlador idênticos aos do skeleton `87f30d3`; o
relatório de justiça das rodadas do Estúdio é idêntico ao da EXPERIENCE-02 (só o
rótulo da missão muda).

**O que mudou no React** (só em `src/games/hidden-objects/`):
`HiddenObjectsScene` recebe `scene` e `onLoad` ("loading"/"ready"/"failed"), monta
as camadas da sala (z-index pela ordem, não por id) e só lê a sala na montagem
(`useState(() => scene)`); `HiddenObjectsGame` remonta a cena por
`key = ${scene.id}:${attempt}` ao trocar de sala, mostra o seletor e o aviso de
falha, e passa a prontidão ao shell como antes (`onEntryReady`/`onEntryError`).

## 4. Escolha de sala (relatório C)

- **Dentro do Game 03, no preparar** — a Home mantém um único card. É um passo só:
  sala e dificuldade no mesmo cartão, depois "Explorar". Nada de wizard.
- A sala marcada ao abrir é a lembrada nesta visita (na primeira, o Estúdio).
  Escolher uma sala **não salva resultado** e não sorteia nada (M07, D07).
- A prévia de cada sala é leve e chega pelo otimizador de imagem do Next (como a
  arte da intro); a arte em resolução cheia de uma sala só é pedida quando ela vai
  para a tela (M17, D03/D06/D08, Y02/Y03).
- "Explorar" fica desabilitado ("Preparando a cena…") só enquanto a sala escolhida
  carrega (ou se ela falhou); se a arte essencial falhar: "Não foi possível abrir o Observatório do
  Explorador agora." + "Tentar de novo" — e a outra sala continua jogável (M18).
- "Trocar de cena" (no topo, só durante a rodada) volta ao preparar na mesma sala e
  dificuldade, sem salvar nada; escolher outra sala e "Explorar" começa uma
  exploração nova lá (M12, D07, D24). Pelo teclado: Tab até os botões de rádio.
- Celular: o cartão cabe em 390×844 sem rolar; em telas baixas (≤ 700 px em pé)
  a introdução e as linhas de apoio somem e a prévia fica 2:1; deitado (≤ 520 px de
  altura) o cartão vira duas colunas e "Explorar" fica na tela (P01/P02, L01, e o
  `small` 360×640 do probe do Estúdio).

## 5. Observatório do Explorador — design visual (relatório D)

**Ideia:** o observatório de um explorador no fim da tarde. A cúpula está aberta, a
lua aparece pela fresta e o planeta da tarde pela janela redonda. "Pensar em paz":
azul de anoitecer, latão e madeira quentes, luzes quentes acesas (o pendente, a
vela, a lanterna da direita), nada piscando. Densidade é proposital, não ruído: cada estação tem um
assunto e os objetos estão onde fariam sentido.

**Três regiões** (estações), pensadas para esta sala e não copiadas do Estúdio:

| Estação | Faixa (su) | O que tem |
| --- | --- | --- |
| **Cúpula** — "sob a cúpula, perto do telescópio" | 0–1240 | telescópio no tablado, estante com escada, mesinha com atlas, cadeira de observação com manta, buraco no rodapé |
| **Bancada** — "na bancada de trabalho" | 1240–2400 | prancheta com carta de estrelas, escrivaninha, tinteiro, bandeja de chá, prateleiras ao lado da janela redonda, cadeira Windsor |
| **Arquivo** — "no arquivo de mapas e curiosidades" | 2400–3600 | arquivo de gavetas, gramofone, mesinha de microscópio, armário de vidro com potes, violino na parede, globo celeste, relógio |

**Profundidade 2.5D:** céu e colinas atrás (parallax 0,9) → placa → nervura mais
próxima da cúpula em cima (1,04) → cortina e baús à esquerda, lanterna e samambaia à
direita (1,05). As camadas da frente só pintam dentro dos seus retângulos opacos, e
o M16 prova que nenhum desses retângulos, crescidos pelo maior deslocamento de
parallax + 24 su, cobre alvo ou sósia.

**Pipeline:** SVG por script (`tools/assets/create_observatory_scene.mjs`, com o kit
comum `hidden-objects-art-kit.mjs`) → sharp: albedo × luz (multiply), brilho
(screen), grão com semente (soft-light) → WebP. Cada alvo é desenhado exatamente na
sua região do arquivo de dados (fonte única); os objetos que a rodada não pede ficam
pintados e inertes.

**Portão de qualidade visual, honesto:** `docs/archive/game03-multiscene-03/studio-vs-observatory.webp`
põe as duas salas lado a lado; os quadros de revisão estão em
`docs/archive/hidden-objects/explorer-observatory/review/v1/` (cena, cinza, regiões,
alvos ampliados), os mesmos quatro do Estúdio.

- Melhor que o Estúdio: luz (lua, vela, pendente com halo), leitura de profundidade
  (três camadas de frente e o céu que desliza), variedade de materiais (latão, vidro,
  porcelana, pelo, papel), regiões com assunto próprio, e uma paleta que separa as
  duas salas de longe.
- Mais denso que o Estúdio? **Pouco.** Depois de comparar lado a lado, a parede do
  arquivo ganhou um relógio e o chão um banquinho com atlas (cenário puro, longe de
  todo alvo e sósia — todos os valores da auditoria ficaram iguais). O tapete da
  rosa dos ventos continua sendo uma área de respiro grande no enquadramento da
  Bancada, de propósito. Densidade: comparável ou um pouco acima do Estúdio, não
  muito acima.
- Ainda é arte de protótipo: vetor desenhado por script, com sombra e grão, não a
  arte final. Ampliada (zoom máximo), a pintura é limpa, mas sem textura de
  pincel. Isto é item de playtest (§13), não bloqueio técnico.

## 6. Pool de alvos (relatório E)

18 alvos, 6 por estação, 2 por tier por estação (A 6 · B 6 · C 6). Todos os estilos
de lista servem para todos (nenhum é um quadro com contorno retangular, então
nenhum precisa de `listedAs`). Cada um tem rótulo, rótulo acessível, pista de
função (Difícil), região de toque autoral, e as três frases de pista (lugar exato
no Fácil, direção no Médio, contexto no Difícil).

| Estação | A (aberto) | B (parcial) | C (escondido) |
| --- | --- | --- | --- |
| Cúpula | Coruja (no alto da escada) · Pipa (pendurada na parede) | Luneta (na mesinha, ao lado do atlas) · Pantufas (sob a manta caída) | Óculos (na caixa de oculares, perto de argolas) · Ratinho (saindo do buraco do rodapé) |
| Bancada | Sistema solar (ponta direita da bancada) · Vela (castiçal ao lado da prancheta) | Compasso (sobre a carta de estrelas) · Bule (atrás de uma pilha de livros) | Sino (entre lombadas na prateleira) · Maçã (atrás do tinteiro) |
| Arquivo | Violino (na parede, sobre o arquivo) · Gramofone (em cima do arquivo) | Microscópio (entre caixinhas de amostras) · Gato (enrolado entre pastas) | Balança (no armário de vidro, entre potes) · Leque (na gaveta entreaberta) |

**12 sósias naturais** (cenário, nunca alvo; tocar neles não faz nada): rolo de
mapas ↔ luneta, argolas de latão ↔ óculos, escova de sapato ↔ ratinho, esfera
armilar ↔ sistema solar, pinça ↔ compasso, regador ↔ bule, funil ↔ sino, novelo de
lã ↔ maçã, luminária de mesa ↔ microscópio, almofada ↔ gato, móbile de estrelas ↔
balança, concha ↔ leque. Folga mínima de 32 su de qualquer alvo; um toque no centro
de qualquer sósia em 0,375 px/su (o padrão E16 do Estúdio) não acha nada (M16).

A dificuldade nunca vem de coisa microscópica, contraste impossível ou área de
toque invisível: os alvos C estão escondidos por **oclusão natural** (o caderno
sobre os óculos, o ratinho metade no buraco, os potes na frente dos pratos da
balança, a frente da gaveta sobre o leque, o tinteiro na frente da maçã).

## 7. Rodadas e sementes (relatório F)

- Uma rodada é função pura de **(sala, dificuldade, semente)**: as rodadas válidas
  de cada sala são enumeradas (mistura de tiers do preset, estilo de lista, e
  espalhamento entre estações ⌊k/n⌋..⌈k/n⌉), a semente (mulberry32) escolhe uma e
  embaralha a ordem da lista. Rodadas válidas: Estúdio 148 / 243 / 692,
  Observatório 156 / 312 / 768 (Fácil/Médio/Difícil).
- A semente é tirada **uma vez por "Explorar"** (`crypto.getRandomValues`). Nada mais
  sorteia: render, arrasto, zoom, pinça, resize, rotação, pista, movimento reduzido,
  bandeja e visibilidade não mudam a lista (M09, L05, P07).
- **Recomeçar** = mesma sala, dificuldade e lista (M10). **Praticar outra vez** =
  mesma sala por padrão, semente nova (M11, D22/D23). **Trocar de cena** = preparar
  na mesma sala; "Explorar" lá é uma exploração nova (M12). A mesma semente nas duas
  salas dá a lista de cada sala, sem vazar nada da outra (I01–I05).
- O resultado vai pela plataforma compartilhada genérica com
  `details = { difficulty, foundObjects, totalObjects, completed, sceneId, roundSeed }`
  (M13, D21, P10, L06). Nenhuma lógica de Observatório na tela de resultado
  compartilhada (M19). Um resultado antigo do Game 03, salvo como a EXPERIENCE-02
  salvava (sem `sceneId`), e um legado da Trilha continuam lidos e mantidos no
  próximo salvamento (M13; e o cenário `legacy` do probe do Estúdio).

## 8. Justiça (relatório G)

**Auditoria da arte** (`--audit`, sobre a sala composta; pisos da Discovery §9, os
mesmos do Estúdio, nunca baixados): visível A ≥ 0,80 · B ≥ 0,60 · C ≥ 0,40; borda
≥ 1,3:1.

| Tier | Estúdio: visível · borda (mín) | Observatório: visível · borda (mín) |
| --- | --- | --- |
| A | 0,979 (0,96) · 1,65 (1,33) | 0,988 (0,93) · 2,81 (1,92) |
| B | 0,911 (0,75) · 1,99 (1,32) | 0,833 (0,77) · 2,37 (1,44) |
| C | 0,772 (0,54) · 2,08 (1,53) | 0,779 (0,60) · 1,71 (1,48) |

O que foi consertado **na arte e na geometria, não nos limites**: contornos escuros
que derrubavam a borda (pipa 1,17, violino 1,19, pantufas 1,26) ganharam aro claro;
as pantufas foram redesenhadas; os C, expostos demais, ganharam oclusões naturais; a
geometria de toque de óculos/luneta/leque/maçã cresceu para o piso do celular
deitado (44 px efetivos no zoom máximo, ≥ 32 px no enquadramento de abertura). O
teste de toque em sósia desta suite nasceu mais estrito que o do Estúdio (0,21 px/su)
e foi alinhado ao padrão E16 (0,375 px/su) — a mesma régua para as duas salas.

**Geometria** (M16): margens seguras 256×160 su; ≥ 24 su entre alvos; ≥ 32 su
entre alvo e sósia; frentes opacas longe de alvos e sósias; enquadramento da
revelação livre do HUD em 6 viewports; tamanhos de toque acima.

**Rodadas** (`hidden-objects-round-fairness.mjs --scene`, 1.000.000 de sementes por
dificuldade; `docs/archive/game03-multiscene-03/rounds-*`): todas as rodadas válidas
alcançadas; frequência por objeto sem desvio (χ² z ≤ 1,51 nas duas salas; |z| máximo
por objeto 2,12 no Observatório, 2,51 no Estúdio); visibilidade média da lista
Observatório 92,6 % / 84,1 % / 82,5 % (Estúdio 94,8 / 87,5 / 84,9); sósias por
rodada Observatório 0,43 / 0,78 / 0,83 (Estúdio 0,41 / 0,67 / 0,75) — no Difícil o
Observatório tem um pouco mais de sósias por rodada e a lista é um pouco menos
visível (−2,4 pontos), dentro dos mesmos pisos.

## 9. Evidência no browser (relatório H)

Build de produção (`next build && next start -p 3100`), Chromium headless com
SwiftShader, 1×. Sementes plantadas em `crypto.getRandomValues`; nada no produto é
gancho de teste. Evidência em `docs/archive/game03-multiscene-03/`.

| Cenário (`--scenario`) | Checks | O que cobre |
| --- | --- | --- |
| `ms-desktop` 1440×900 | 25/25 | Home real → preparar com as duas salas (Estúdio marcado) → rodada semeada no Estúdio → achado → "Trocar de cena" (nada salvo) → Observatório (arte pedida só agora) → Fácil/Médio/Difícil iguais → rodada semeada → arrastar, roda e +, as três estações, a escada de pistas, achado com nome, conclusão "Observatório explorado", resultado pela tela compartilhada, "Praticar outra vez" (mesma sala, lista nova), troca de volta ao Estúdio; 0 commits React por pointermove |
| `ms-mobile` 390×844, toque | 12/12 | Observatório no Difícil: preparar cabe e "Explorar" no alcance, arrasto, pinça, bandeja (pistas de função, recolher), pista só até o contexto, achado, conclusão, resultado com `sceneId`/`roundSeed`, sem rolagem horizontal |
| `ms-landscape` 844×390, toque | 8/8 | Médio: "Explorar" sem rolar, estações, pinça + arrasto, **celular virado em pé no meio da rodada e de volta** (a rodada e o progresso ficam), resultado |
| `ms-reduced-motion` | 6/6 | estações cortam, halo e anel sem fade, nenhum parallax nas quatro camadas que deslizam |
| `ms-isolation` | 6/6 | mesma semente nas duas salas, cada uma uma nova entrada pela Home: cada lista é da sua sala; nada vaza; nada salvo |
| `ms-payload` | 4/4 | o que cada passo pede (§11) |
| **total** | **61/61** | e cada cenário sozinho, processo e browser próprios: **61/61** (`multiscene-scenarios-alone.json`) |

O probe do Estúdio (`hidden-objects-browser-probe.mjs`, o da EXPERIENCE-02) roda
inteiro: **104/104**, incluindo a corrida de hidratação do reload da Home (RR1–RR3,
a correção da EXPERIENCE-02 continua de pé), resultados legados, e o celular
pequeno 360×640 (`studio-browser-probe-run.json`).

Testemunhas (16): preparar (desktop, Observatório marcado, celular, deitado),
Observatório aberto, aproximado, pista mostrada, achado, resultado, pinça e pista no
celular, deitado → em pé → deitado, halo com movimento reduzido, isolamento.

## 10. Regressões (relatório K)

Rodado no fechamento, sobre a árvore commitada:

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 erros, 6 avisos — os mesmos 6 de `58b5f08` (nenhum novo) · 0 erros · limpo |
| `next build` | exit 0; mesmas rotas estáticas |
| suite skeleton · `--counterfactuals` | 38/38 · 19 pegos (`HIDDEN_OBJECTS_SKELETON_COUNTERFACTUALS_HOLD`) |
| suite experience · `--counterfactuals` | 45/45 · 33 pegos (`HIDDEN_OBJECTS_EXPERIENCE_COUNTERFACTUALS_HOLD`) |
| suite multiscene · `--counterfactuals` | 20/20 · base + 18 mutantes pegos (§12) |
| justiça (arte + rodadas, duas salas) | `ROUND_FAIRNESS_OK` × 2; M16 |
| probes de browser | 61/61 multiscene (e 61/61 sozinhos) · 104/104 Estúdio |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · 5 baselines e 6 mutantes pegos |
| `game-readiness-registry` · `game-entry-watchdog-registry` · `game-continuation-contract` · `production-diagnostic-boundary` | 19/19 · 10/10 · 21/21 · OK (evidência MATCHES) |
| `memory-circuit-lifecycle-tests.mjs` (Circuito) | 13/13 |
| `route-journey-terminal-tests.mjs` (tela de resultado real da Rota) · `route-journey-ownership-tests.mjs` · `route-validation-coupling-gate.mjs` | 13/13 · 7/7 · 6/6 |
| CORE `validation-hygiene-tests.mjs` (em `4dc7da7`) | 15/15 validadores (`CORE_BATTERY_PASSED`); imutabilidade: 0 arquivos criados, apagados ou alterados, `git status` idêntico (`VALIDATION_CHECK_IS_READ_ONLY`) |
| DEEP `final-acceptance.mjs` (em `4dc7da7`) | estrutural 1080/1080, contínuo 270/270, recovery OK, sem exceções; evidência MATCHES |
| auditoria de dependências | `package.json` e `package-lock.json` idênticos à base; `npm audit` igual à base: 13 avisos (1 baixo, 2 moderados, 10 altos), 4 em produção (2 moderados, 2 altos) |

## 11. Desempenho, assets e bundle (relatório I)

Medido nos dois builds de produção, cada um com seu próprio `.next`
(`bundle-and-payload-vs-experience-02.json`; gzip nível 9; respostas do otimizador
de imagem pesadas pelo tamanho servido):

| | `58b5f08` (EXPERIENCE-02) | agora | Δ |
| --- | --- | --- | --- |
| Home, JS inicial (HTML) | 773.682 B · 242.772 gz | 773.682 B · 242.773 gz | 0 B (+1 gz: ids de chunk) |
| Home, arte pedida (com o Game 03 selecionado) | 46 arquivos · 528.352 B | 46 · 528.352 B | 0 — **a Home não pede arte de sala** (Y01) |
| Game 03, conjunto lazy JS | 40.184 B · 13.465 gz | 55.599 B · 17.996 gz | +15,4 KB · **+4,5 KB gz** |
| Game 03, CSS | 19.328 B · 4.709 gz | 22.010 B · 5.106 gz | +2,7 KB · +0,4 KB gz |
| Entrada + preparar, arte | 6 pedidos · 332.000 B | 7 · 343.266 B | **+11,3 KB** (a prévia do Observatório; a do Estúdio não gerou pedido novo — o browser reusou a variante da intro em cache) |
| Rodada do Estúdio desde a entrada, arte | 11 · 366.270 B | 12 · 377.536 B | +11,3 KB (a mesma prévia) |
| Observatório escolhido depois (Fácil) | — | 10 · 333.740 B, 0 JS | 5 camadas + 5 miniaturas, só quando escolhido |
| Rota, conjunto lazy JS | 55.385 B | 55.502 B | +117 B: o ícone `DoorOpen` do lucide, agora usado também pelo Game 03, vira um módulo compartilhado dentro do chunk; nenhum código da Rota mudou |
| Circuito · Babylon | 19.502 · 8.028.358 B | iguais | 0 |

- **Sala 02, arquivos:** 447,4 KB no total (24 arquivos); essenciais (5 camadas)
  310,8 KB contra 279,1 KB das 4 camadas do Estúdio (+11 %); placa 227,5 KB.
  Orçamento de entrada por sala (M17): 1,3 MB — Estúdio 412,5 KB, Observatório
  447,4 KB.
- **Dados de uma sala no chunk:** ~11,3 KB de JS transpilado, ~3,4 KB gz (o
  Observatório); é o custo de cada sala nova enquanto os dados viajarem no chunk do
  Game 03. Arte nunca: cada sala só pede a sua (M17 mutante "toda a arte de sala
  importada de cara" é pego).
- Arrasto: 0 commits React por pointermove/touchmove no desktop e no celular, nas
  duas salas. Tempo de entrada até pronto (SwiftShader, indicativo): 4,4 s desktop,
  2,1 s celular — a mesma ordem da EXPERIENCE-02 (4,3 s · 1,8 s).
- Nenhuma dependência nova; nenhum Babylon no Game 03.

## 12. Contrafactuais e mutantes (relatório J)

Suite `tools/validation/hidden-objects-multiscene-tests.mjs` (M01–M20: 17
`[multiscene]`, 3 `[preserved]`). **Contrafactual:** em `58b5f08`, os 17
`[multiscene]` falham e os 3 `[preserved]` passam (Estúdio igual, plataforma
compartilhada intocada, contrato de dificuldade congelado). **Mutantes** (em
memória, cada um precisa derrubar o check que o nomeia): o seletor sempre abre o
Estúdio (M08) · o Observatório usa o pool do Estúdio (M05, M16) · `sceneId` some do
resultado (M13) · Recomeçar volta ao Estúdio (M10) · trocar de sala mantém a lista
velha (M12) · escolher sala salva resultado (M07) · toda a arte de sala importada de
cara (M17) · ramo específico de sala na plataforma (M13, M19) · ramo específico de
sala no motor (M03) · um objeto não listado do Observatório responde ao toque (M14)
· um alvo coberto pela frente (M16) · uma camada da frente cresce sobre a sala (M16)
· o equilíbrio por região ignorado (M15) · "Praticar outra vez" esquece a sala (M11)
· uma sala que falhou é oferecida de novo primeiro (M18) · o Observatório sorteia
pelas estações do Estúdio (M15, M03) · o Médio recalibrado (M20) · a arte do
Observatório repintada sem nova auditoria (M16). **18/18 pegos**
(`HIDDEN_OBJECTS_MULTISCENE_COUNTERFACTUALS_HOLD`).

As suites antigas continuam valendo sobre o motor novo: a harness liga as funções
"sala primeiro" ao Estúdio (`boundToScene`), então skeleton (38) e experience (45) leem
o Estúdio como antes; os seus mutantes foram reancorados nas linhas novas, sem
afrouxar nada (todos pegos).

## 13. Playtest humano — `TO_VALIDATE_IN_MULTISCENE_03`

Mesmo protocolo do `GAME03_FUN_GATE` (`docs/GAME03_SKELETON_01.md` §7: 5–8 pessoas,
≥ 3 com 60+, metade no celular), com estas perguntas sobre a sala 02:

| # | Item | Estado técnico |
| --- | --- | --- |
| S1 | O Observatório é **mais bonito e mais "jogo"** que o Estúdio? Parece calmo ("Pensar em paz") ou carregado? | lado a lado em `studio-vs-observatory.webp`; densidade comparável (§5) |
| S2 | Os 18 objetos são reconhecíveis na arte — sobretudo pantufas, óculos sob o caderno, ratinho no buraco, balança entre os potes, leque na gaveta, maçã atrás do tinteiro? | auditoria acima dos pisos (§8) |
| S3 | Os sósias (pinça/compasso, funil/sino, novelo/maçã, concha/leque, almofada/gato…) são "olhar com cuidado" e não armadilha? | folga ≥ 32 su; toque no sósia não conta nem pune |
| S4 | Cúpula / Bancada / Arquivo fazem sentido como lugares? As frases de pista ("sob a cúpula, perto do telescópio") ajudam? | D16, D17 |
| S5 | A escolha de sala no preparar é encontrada e entendida? Alguém procura a sala na Home? | um card na Home, por desenho |
| S6 | "Trocar de cena" no topo é claro? Alguém o confunde com "Recomeçar" ou com sair? | não salva nada (D07) |
| S7 | O Difícil do Observatório (sósias 0,83 por rodada) parece justo para 60+? | §8 |
| S8 | Celular deitado e em pé com a cúpula escura: os alvos C se leem em tela real (brilho baixo, reflexo)? | medido só em Chromium/SwiftShader |
| S9 | A lua, a vela e o pendente com halo cansam a vista? | sem animação de luz |
| S10 | Leitor de tela (NVDA/VoiceOver) no seletor de salas (rádios com prévia) e aparelhos reais (iOS Safari, Android Chrome) | só automatizado |

## 14. Limitações e próximo passo (relatórios L e O)

- A arte das duas salas é desenhada por script (SVG → WebP), não a arte final; o
  Observatório é mais rico em luz e profundidade, mas sua densidade é só comparável
  à do Estúdio (§5).
- Os dados de cada sala viajam no chunk do Game 03 (~3,4 KB gz por sala). Com 4+
  salas vale separar os dados por sala num `import()` próprio; a arte já é por sala.
- A sala lembrada vive só em memória (uma recarga volta ao Estúdio), de propósito:
  não há conta, campanha ou progresso salvo.
- A estação "atual" segue a regra do skeleton (a que contém o centro da vista),
  com o mesmo efeito nas bordas que a EXPERIENCE-02 registrou (§11 de lá).
- Medido só em Chromium headless (SwiftShader); iOS Safari e Android reais ficam
  para o playtest.
- `npm audit` tem os mesmos avisos de antes (§10); fica para uma missão de
  dependências.
- A pasta `explorer-observatory/v1/` foi repintada dentro desta missão (relógio e
  banquinho, `9de3b0b`), antes de qualquer merge, com nova auditoria e novo hash da
  prancha. Depois do merge vale a regra da casa: arte nova é pasta nova.

**Próximo passo recomendado:** o playtest humano das duas salas (§13). Se passar,
uma missão própria para a arte final do Observatório (ou para decidir se a densidade
sobe), e só depois pensar numa sala 03 — cada sala nova é um arquivo de dados, um
script de arte, sua auditoria e uma linha no registro.

## 15. Arquivos da plataforma compartilhada alterados (relatório M)

**Nenhum.** Todas as mudanças de produto estão em `src/games/hidden-objects/`
(contrato, registro, as duas salas, motor, React e CSS do Game 03) e
`public/assets/hidden-objects/explorer-observatory/`; de documentação, este registro,
a seção do Game 03 em `docs/ARCHITECTURE.md` e a evidência em `docs/archive/`. App Shell, GameScreen, a tela
de resultado compartilhada, o registro de jogos, a Home, `package.json` e
`package-lock.json` estão byte a byte iguais a `58b5f08` (M19; a única diferença de
bundle fora do Game 03 é o módulo do ícone no chunk da Rota, §11). Ferramentas:
`tools/assets/` (kit de arte comum, script do Observatório; o script do Estúdio só
passou a ler os dados de `scenes/explorer-studio.ts` e gera os mesmos bytes) e
`tools/validation/` (harness, suites, probes, justiça das rodadas).

## 16. Validação

```bash
npx eslint && npx tsc --noEmit && git diff --check
node tools/validation/hidden-objects-multiscene-tests.mjs                     # 20/20
node tools/validation/hidden-objects-multiscene-tests.mjs --counterfactuals   # base + 18 mutantes
node tools/validation/hidden-objects-skeleton-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-experience-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-round-fairness.mjs --scene explorer-observatory --out DIR
node tools/assets/create_observatory_scene.mjs --audit                        # repinta e reaudita
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-multiscene-probe.mjs [--scenario ms-desktop,…] [--out DIR] [--json FILE]
PLAYWRIGHT_DIR=… node tools/validation/hidden-objects-browser-probe.mjs
node tools/validation/validation-hygiene-tests.mjs    # CORE
node tools/validation/final-acceptance.mjs            # DEEP
```
