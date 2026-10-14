# MindFlow — Game 03 V1 · registro de candidato a lock (GAME03-FINAL-POLISH-LOCK-06)

Missão GAME03-FINAL-POLISH-LOCK-06. Branch `feat/game03-final-polish-lock-06`, base exata
`4dc446140b1c0249070c44a23053068473cc521a` (`docs(game03): REPLAYABILITY-05 record — …`, o estado
final da GAME03-REPLAYABILITY-05).

**Veredito: `GAME03_V1_LOCK_CANDIDATE`.** Nenhum bloqueio de jogabilidade conhecido; todas as
suítes, contrafactuais, mutantes, sondas de browser, portões de justiça e variedade, regressões
cruzadas, CORE e DEEP passaram (§13–§16). **Candidato, não lock:** o Game 03 não está travado,
esta branch **não** foi integrada a `v06-portal-requires-lights` e **nada** foi promovido a
produção. A decisão de travar e integrar vem depois de uma revisão independente (§20).

Esta missão não acrescentou jogabilidade: nenhuma sala, sistema de alvo, tipo de peça, mecânica
de dificuldade, cronômetro, pontuação, conquista, campanha, progressão, inventário, backend,
conta ou física. A Home não foi tocada (§11).

---

## 1. Linhagem

| | |
| --- | --- |
| Branch | `feat/game03-final-polish-lock-06` (já existia no remoto, na base exata) |
| Base exata | `4dc4461` — GAME03-REPLAYABILITY-05 final |
| Verificado antes de editar | branch certa, `HEAD` = `4dc4461`, árvore limpa |
| Commits da missão | `1244123` (polimento: título, intro, pistas, ratinho) · `8722de6` (fileira das estações no celular, sonda final, D21) · `db62ff0` (suíte final-lock) · `7e3f339` (evidência e docs canônicos) · o commit deste registro |
| Árvore de evidência | `7e3f33978b036b89d0263c0a48f9bac98ef05a95` — todo código, arte e evidência; o commit final só acrescenta este arquivo (`git log -1 -- docs/GAME03_V1_LOCK_CANDIDATE_06.md` dá o SHA final) |
| Merge / PR | nenhum |

Histórico do Game 03: SKELETON-01 → EXPERIENCE-02 → MULTISCENE-03 → CALIBRATION-02A →
INTERACTIONS-04 → REPLAYABILITY-05 → **FINAL-POLISH-LOCK-06**.

## 2. O que é o Game 03 V1

- **Duas salas, um motor:** Estúdio do Explorador e Observatório do Explorador, escolhidas no
  preparar (rádios nativos com prévia). O motor não nomeia sala, estação, objeto, lugar nem peça.
- **Alvos semeados:** cada "Explorar" tira uma semente de 32 bits (`crypto.getRandomValues`); dela
  saem o arranjo da sala, a lista (5/6/8 de 26 objetos por sala) e as pistas.
- **Bancos de pistas:** cada objeto tem uma pista direta, duas associativas e duas indiretas; a
  rodada escolhe pela semente (Fácil: imagem e nome; Médio: associativa, reconta direta; Difícil:
  indireta, sem nomes até achar).
- **Dificuldade V3:** regra medida por rodada (tiers por lugar, carga de busca, achados de relance,
  sósias, profundidade de interação); pisos derivados, nunca baixados.
- **Escadas de pista:** Fácil vai até "Mostrar onde está"; Médio só palavras (região → direção),
  nunca revela; Difícil para no contexto, nunca revela nem aponta a peça.
- **Peças da sala:** gavetas, portinhola, cortina, tampa, cesto — estados autorais, um toque ou um
  botão nativo (`aria-expanded`); o que está guardado não é achado nem anunciado com a peça fechada.
- **Arranjos autorais:** objetos, sósias e cenário mudam entre lugares desenhados; mesma semente,
  mesma sala; "Recomeçar" mantém; nova exploração nunca repete o arranjo imediatamente anterior.
- **Celular e computador:** pan, pinça, roda, teclado, retrato e paisagem, girar no meio da rodada.
- **Acessibilidade:** teclado de ponta a ponta, foco visível, região viva, movimento reduzido, nada
  da imagem da sala é tabulável.
- **Resultado:** um por sessão, `score` = objetos achados, sem tempo/erros/dicas; título
  "Exploração concluída", resumo com o nome da sala.

**Fora da V1:** terceira sala, cronômetro, pontuação de pressão, conquistas, campanha, desbloqueios,
progressão, inventário, contas/backend, física, memória de arranjos entre visitas, divisão do
código por sala (§18, §19).

## 3. Sinal humano

O dono do projeto jogou o build da REPLAYABILITY-05 e relatou que **parece bom**, que o conceito de
arranjos dinâmicos funciona e que não viu bloqueio; antes disso, as peças tinham sido consideradas
uma boa melhora e a Dificuldade V3 bem melhor. É sinal real — e é **uma** sessão informal: não
prova cada lugar, aparelho ou modo de acessibilidade. As auditorias de máquina e visuais abaixo
continuam valendo por si; nenhum resultado deste registro se apoia só no relato.

## 4. Mudanças de produto (todas pequenas, todas de polimento)

| # | O quê | Por quê |
| --- | --- | --- |
| 1 | Título da tela de resultado do Game 03: "Estúdio explorado" → **"Exploração concluída"** (`src/engine/rewards.ts`, só a entrada `"hidden-objects"`) | O Observatório terminava com "Estúdio explorado" sobre "Você encontrou todos os objetos do Observatório." O título agora serve às duas salas; o resumo (de cada sala) nomeia a sala. O cartão de conclusão dentro do jogo continua "Estúdio explorado" / "Observatório explorado" |
| 2 | Intro ("Como jogar") do Game 03: "Explore o estúdio do explorador…" / "Escolha a dificuldade e entre no estúdio." → "Explore uma das salas do explorador…" / "Escolha a sala e a dificuldade." (`src/data/game-intros.ts`, só a entrada do Game 03) | A intro falava de uma sala só e não mencionava a escolha de sala |
| 3 | Cinco pistas e uma palavra de pista (§7) | Pistas que apontavam um lugar que o objeto pode deixar, ou português pouco natural |
| 4 | Observatório: o ratinho "atrás do baú azul" passa a estar **atrás** do baú e espiar pela ponta (§6) | O lugar ficava na frente da borda do baú mas era pintado por baixo dele: contradição de profundidade, só um vulto cinza e o rabo |
| 5 | Celular em pé (≤ 479 px): as estações ganham uma fileira própria (§10) | "Bancada" (e "Estante" abaixo de 360 px) era cortado ao lado de Pista, de 320 a 412 px |

Nada mais em `src/` mudou: motor, regras, salas (exceto o lugar do ratinho e os textos acima),
CSS (exceto o bloco de §10), componentes — byte a byte (P01–P03, §14).

## 5. Revisão de cada lugar (qualidade humana dos arranjos)

Método: uma prancha por coisa e lugar, a sala composta como o jogo compõe (prancha, atlas, peças,
primeiros planos), recortada ao redor do lugar, com tier e frequência medida —
**240 lugares** (Estúdio 133, Observatório 107), todos os lugares autorais de objetos, sósias e
cenário, incluindo os guardados, os mais frequentes e os mais raros
(`docs/archive/game03-final-polish-lock-06/placement-review/`). Revisão minha, a olho, lugar a lugar.

**Corrigido:** `ratinho@bau-cupula` (§6).

**Revisto e mantido (registrado, não é bloqueio):**

- Estúdio — `estojo-de-oculos@s5-rolos` (sósia, no seu lugar de sempre desde o kit v2) fica ~10 su
  acima dos rolos de papel, no escuro do pé da estante: lê como "atrás dos rolos". Corrigir exigiria
  repintar o lugar de casa; a sósia não é pedida.
- Estúdio — o guarda-chuva pendurado no varão (`varao-b`, 33%) por um fio, como a gaiola: um pouco
  lúdico, plausível, tier A.
- Estúdio — pedrinhas no assento da poltrona e a tigela de latão no chão atrás do baú: cenário,
  plausíveis.
- Observatório — o regador de casa e no chão com o raminho verde: coerente com o de casa.
- Observatório — sósias escuras no assoalho escuro (peça de xadrez): sósias, não alvos.

**Concentração** (medida de novo, §12): os lugares mais tomados continuam abaixo do teto de 85%
(R25) — chaleira (sósia) 81,9%, tesoura 80,5%, gaita 79,5%, chave 78,6% (Estúdio); regador
(sósia) 79,9%, rolo de mapas (sósia) 77,9%, cavalo-marinho 76,1% (Observatório). No Difícil, o mais
concentrado é a tesoura no mapa (83,8%, teto 90%). Não reequilibrei: nenhum desses lugares
mostrou problema de produto, e mexer só porque o número não é redondo está fora do escopo.

## 6. O ratinho atrás do baú

| | Antes (`4dc4461`) | Agora |
| --- | --- | --- |
| Lugar `bau-cupula` | `at (620, 1380)`, base **na frente** da borda do baú (y 1366), pintado antes do baú | `at (618, 1362)`, base **atrás** da borda; espelhado (`flip`), a cabeça espia pela ponta do baú |
| O que se vê | o baú cobre o corpo; só o rabo e um vulto cinza | cabeça, orelhas, focinho e o começo do corpo |
| Auditoria | visível 43,3% · borda 1,74 | visível 65,8% · borda 1,48 (tier C; o ratinho em casa: 77,8% · 1,87, também C) |
| Conflitos do lugar | `pantufas@atras-bau`, `rolo-de-mapas@chao-cupula-a` | os mesmos dois (o arranjo da sala não mudou: mesmo espaço, mesmas frequências) |
| Frequência | Difícil 64,9% toca / 35,1% baú | idem |

A dica do lugar ("escondido atrás de uma caixa com cantos de latão") ficou literalmente certa.
Testemunhas: `placement-review/ratinho-bau-cupula-{before,after}.webp`. Arte regenerada pelo
kit v4 (`create_observatory_scene.mjs`, reproduzível byte a byte: reexecutado sem mudança de dados,
não altera nenhum arquivo); o atlas foi reempacotado (1024×785, +26 B), e por isso a contribuição
de desordem de vários vizinhos mudou em ±0,001–0,002; as medidas foram sincronizadas
(`sync-hidden-objects-measured.mjs`) e toda a regra de rodada foi remedida (§12).

## 7. Pistas

Banco inteiro relido no contexto (260 pistas, 2 salas) e todas as palavras de pista de cada lugar.

| Objeto | Antes | Agora | Por quê |
| --- | --- | --- | --- |
| tesoura (Difícil) | "Sem ela, o recorte do mapa sairia rasgado." | "Na aula de artes, faz o recorte sem rasgar." | mandava ao mapa; a tesoura também fica no chão, embaixo da mesa |
| guarda-chuva | "Fechado num canto, espera o tempo virar." | "Fechado, fica esperando o tempo virar." | também fica pendurado no varão, fora do canto |
| ferradura (Difícil) | "Atrás da porta, promete afastar o azar." | "Pendurada na entrada, promete afastar o azar." | o Observatório tem uma **portinhola** que abre e guarda outra coisa (o foguete): o Difícil mandava abrir a peça errada |
| globo | "Na aula de geografia, todos giravam ele." | "Na aula de geografia, todos queriam girá-lo." | registro das outras pistas |
| foguete (Difícil) | "Um menino sonha pilotá-lo pelo espaço afora." | "Um menino sonha em pilotá-lo pelo espaço afora." | regência ("sonhar em") |
| pantufas, lugar `atras-bau` (contexto) | "…quase escondido" | "…quase escondidas" | concordância (pantufas) |

Mantidas, revisadas uma a uma: "Sem ela, a porta fica fechada para sempre." (chave — porta em geral;
o Estúdio não tem porta), "O explorador leva nela o mapa e o lanche." (bolsa — conteúdo; a bolsa
nunca se move), "…as pérolas fogem pelo chão." (colar — está na caixinha), "Num dia sem brisa, ela
fica no chão." (pipa — pista do Difícil, e a pipa nunca entra no Difícil), "canto em quina reta"
(esquadro — forma). A suíte final-lock (L03) prende essa revisão: uma palavra de lugar numa pista
só passa se todo lugar do objeto também a diz, ou se está nessa lista revisada.

A escolha semeada não mudou (índice no banco, não texto): mesma semente, mesma pista.

## 8. Dificuldade

Dificuldade V3 **não** foi redesenhada; nenhum piso, faixa ou teto mudou (o motor é byte a byte o da
base — P02). Verificado de novo:

- **Fácil:** busca real (visível médio das listas 88,9% Estúdio / 88,4% Observatório), escada até
  "Mostrar onde está" e o toque pelo próprio jogador (`lock-studio`, `lock-keyboard`).
- **Médio:** a lista não nomeia, a pista nunca revela (`MEDIUM_HINTS_NEVER_NAME_OR_REVEAL`), 86,1% /
  86,0% visível.
- **Difícil:** sem nomes antes de achar (lista e `aria-label`), sem revelação, nenhum lugar A
  (R21), guardados atrás das peças e objetos fora de casa em toda rodada de teste
  (`HARD_*`), 83,8% / 83,2% visível. Rodadas completas no Difícil nas duas salas.

## 9. Interações

Nenhuma mudança: as peças continuam como na INTERACTIONS-04/REPLAYABILITY-05. Verificado: a peça
fechada esconde o guardado no lugar atual dele (toque abre a peça e não acha —
`HARD_KEPT_OBJECT_NOT_FOUND_THROUGH_ITS_SHUT_PIECE`), abre com toque e com Enter (`aria-expanded`
acompanha), Recomeçar fecha as peças, 1 commit do React por interação, 0 no arrasto. A
descobribilidade continua vindo da arte (sem contornos permanentes); o contorno aparece só quando o
botão de teclado da peça tem foco.

## 10. Celular

Medido em 14 tamanhos (320×568 a 915×412, retrato e paisagem, lista aberta e recolhida, nas duas
salas): **antes**, as estações eram cortadas no Observatório de 320 a 412 px (e no Estúdio abaixo de
360 px) — 36–54 px por botão para "Bancada" (53–63 px). **Agora**, em telas ≤ 479 px de largura,
as estações têm fileira própria abaixo de [contagem · Pista]: 94–132 px por botão, todos os rótulos
inteiros em todos os tamanhos; Pista ganhou espaço para dizer de que objeto fala. Custo: ~51 px de
altura da sala no celular em pé (ex.: 320×568 com a lista aberta, 336 px de sala). Paisagem e
≥ 480 px não mudaram.

Matriz no build de produção (`lock-phone`): 320×568 Observatório Difícil (Explorar ao alcance, pistas
inteiras, rótulos inteiros com a lista aberta e recolhida, peça tocada, guardado achado, sem
transbordo), 390×844 Estúdio Médio → girar para 844×390 no meio da rodada (arranjo e achados
mantidos, a busca continua) → Fácil até a tela de resultado no celular (botões ao alcance). A sala
escura do Observatório lê bem a 320 px (testemunhas `phone-320-*`).

## 11. Home

Fora do escopo e intocada. P01 prova que todo arquivo fora de `src/games/hidden-objects/` é byte a
byte o da base, exceto a entrada `"hidden-objects"` de `rewards.ts` e de `game-intros.ts` (as tabelas
por jogo — o resto desses arquivos idêntico). O JS inicial da Home mudou **−3 B** (−4 B gz):
os textos de resultado e intro vão no chunk da casca do app junto com o modal de resultado e o
GameScreen; nenhum módulo da Home mudou; arte da Home idêntica (46 arquivos, 528 352 B).

## 12. Replayability, justiça e variedade (medidos de novo)

| | Estúdio | Observatório |
| --- | --- | --- |
| rodadas válidas na sala pintada (Fácil · Médio · Difícil), 1 000 000 de sementes cada | 884 · 3 160 · 8 005 — todas alcançadas | 1 327 · 4 027 · 19 414 — todas alcançadas |
| χ² uniforme (z) · maior \|z\| por objeto | 1,50 / −0,39 / 0,53 · ≤ 2,80 | 0,78 / 0,69 / −0,19 · ≤ 2,03 |
| 30 000 explorações por dificuldade: listas inválidas · *fallbacks* | 0 · 0 | 0 · 0 |
| exato em 500 sementes: posto χ² (z) · KS · maior \|z\| por objeto | ≤ 0,46 · ≤ 1,21 · ≤ 2,29 | ≤ 0,99 · ≤ 1,10 · ≤ 2,55 |
| visível médio das listas (Fácil → Médio → Difícil) | 88,9 → 86,1 → 83,8% | 88,4 → 86,0 → 83,2% |
| arranjos alcançáveis · componentes | 10^12,99 · 11 | 10^10,23 · 10 |
| coisas fora do lugar entre explorações (média) | 47,1% | 42,6% |
| repetições imediatas · conflitos · *fallbacks* (6 000 explorações) | 0 · 0 · 0 | 0 · 0 · 0 |
| 20 visitas de 20 explorações | todas únicas, 0 repetições | todas únicas, 0 repetições |
| lugar mais tomado · Difícil mais concentrado | 81,9% · 83,8% | 79,9% · 77,4% |
| auditoria por lugar: menor visível A · B · C (borda) | 89,6% · 74,7% · 53,8% (≥ 1,31) | 93,1% · 70,5% · 43,0% (≥ 1,32) |
| guardados: visível com a peça fechada | 0 em 6 lugares | 0 em 6 lugares |

`ROUND_FAIRNESS_OK` nas duas salas, `CALIBRATION_REPORT_OK` (constantes = derivadas), variedade
idêntica à da base (o espaço de arranjos não mudou). O Observatório mudou 1 rodada no Fácil e 6 no
Médio do total de válidas (1 326 → 1 327, 4 021 → 4 027) pelas medidas de desordem remedidas (§6);
todas cumprem a regra na sala que o jogo mostra. Mesmos pisos (A ≥ 0,80, B ≥ 0,60, C ≥ 0,40,
borda ≥ 1,3, guardado ≤ 0,05), mesmos tetos (R25: 85% / 90%), nenhum afrouxado.

## 13. Suítes

| Suíte | Normal | `--counterfactuals` |
| --- | --- | --- |
| skeleton | 38/38 | base `f925442` pega (30/30 falham, 8/8 de pé) · **18/18** mutantes |
| experience | 45/45 | bases `87f30d3` e `8fbd638` pegas · **31/31** mutantes |
| multiscene | 20/20 | base `58b5f08` pega (17/17, 3/3) · **18/18** mutantes |
| calibration | 28/28 | base `3b122cf` pega (15/15, 13/13) · **16/16** mutantes |
| interactions | 28/28 | base `ede2cb1` pega (24/24, 4/4) · **18/18** mutantes |
| replayability | 36/36 | base `36ab89a` pega (31/31, 5/5) · **21/21** mutantes |
| **final-lock** (nova) | 9/9 | base `4dc4461` pega (5/5 `[lock]` falham, 4/4 `[preserved]` de pé) · **13/13** mutantes |

**135 mutantes, todos pegos; nenhum `BROKEN`, nenhum `MISSED`.** Âncoras auditadas: `mutate` exige
que cada âncora apareça exatamente 1× (senão `BROKEN`) — nenhuma quebrou; e cada mutante falha o que
nomeia (nenhum inerte). Logs em `docs/archive/game03-final-polish-lock-06/logs/`.

**Suíte final-lock** (`hidden-objects-final-lock-tests.mjs`): L01 o título do resultado serve a toda
sala e o resumo nomeia a sala · L02 a intro não fala de uma sala só · L03 nenhuma pista aponta um
lugar que o objeto pode deixar (com a lista revisada de §7) · L04 no celular as estações têm
fileira própria · L05 o ratinho está atrás do baú e legível · P01 nada fora do Game 03 além das
entradas dele nas tabelas por jogo, mesmas dependências e lockfile · P02 o motor é o da base · P03
as salas têm as mesmas coisas, lugares e tiers · P04 uma semente é uma sala, e as salas variam.

**Verificações reescritas (verdade antiga → verdade nova)**, marcadas no código com
`GAME03-FINAL-POLISH-LOCK-06 (restated)`; nenhum piso baixado:

| Onde | Antes → agora | Prova |
| --- | --- | --- |
| skeleton H01/H13/H31, experience E27, multiscene M13, calibration C19, interactions I26 | o título do Game 03 é "Estúdio explorado" → é um dos títulos do Game 03 (`GAME03_RESULT_TITLES`: "Estúdio explorado" até aqui, "Exploração concluída" agora) — nunca o padrão, nunca o da Trilha | as bases de cada suíte continuam pegas; L01 e seus dois mutantes prendem o título novo |
| multiscene M19, calibration P01 | nada fora do Game 03 muda → nada, exceto a entrada `"hidden-objects"` das tabelas por jogo (`changedOutsideGame03`: o resto desses arquivos byte a byte) | P01 da final-lock: mutante "o texto de outro jogo muda" pego |
| interactions I27 | o banco de pistas é o da base → o da base, exceto as reescritas listadas (`GAME03_LOCK06_CLUE_EDITS`, de → para) | qualquer outra mudança de pista falha |
| replayability probe `rep-replay` | mesma semente ⇒ mesmo hash de PNG → mesmos pixels dentro de 8/255 por canal; outra semente ⇒ diferença material | o céu do Observatório (`back.webp`, paralaxe) é rasterizado com ruído de até 6/255 entre páginas: o hash falhava ~1 em 3 na **base** também (medido: 2 de 4); outra semente difere em 197/255 em 1,8% dos pixels |
| browser probe 20 | título "Estúdio explorado" → "Exploração concluída" | — |
| multiscene probe D21 | **reforçado**: além do resumo, o título do resultado do Observatório | foi assim que o "Estúdio explorado" escapou |

## 14. Browser (build de produção)

| Sonda | Resultado |
| --- | --- |
| **final-lock** (nova, pequena) | **50/50** — `lock-studio` 16, `lock-observatory` 10, `lock-phone` 16, `lock-keyboard` 8; cada cenário sozinho também |
| replayability | 41/41; cada cenário sozinho (9+5+7+4+4+3+9) |
| interactions | 42/42 |
| calibration | 83/83 |
| multiscene | 61/61 (com o D21 reforçado) |
| Estúdio (browser-probe) | 104/104 |

Total: **381/381** checks. Na base, antes de mexer: os mesmos probes passaram, exceto
`rep-replay` (o ruído do céu, acima).

**Matriz humana (automatizada no build de produção, `hidden-objects-final-lock-probe.mjs`):**
Estúdio Fácil completo (escada até "Mostrar onde está") → resultado → Praticar outra vez → Médio
representativo (dois achados fora de casa, pistas sem nome) → Recomeçar mantém → Difícil completo com
guardado fora do 1º lugar e ≥ 3 objetos fora de casa → resultado; Observatório Fácil representativo
→ Trocar de cena (nada salvo) → Médio completo → resultado → Difícil completo (guardado + fora de
casa) → resultado; celular 320 e 390, paisagem e giro; movimento reduzido + só teclado (sala,
dificuldade e Explorar pelas teclas; peça com Enter; escada de pista e Enter na mira acha o objeto;
o achado é anunciado; foco visível em toda parada; nenhuma imagem da sala tabulável). Testemunhas:
`docs/archive/game03-final-polish-lock-06/witnesses/` (17).

## 15. Desempenho e tamanho

Medido nos dois builds de produção, cada um com seu `.next`
(`bundle-and-payload-vs-replayability-05.json`, gzip 9):

| | `4dc4461` | agora | Δ |
| --- | --- | --- | --- |
| Home, JS inicial | 773 682 B · 242 774 gz | 773 679 B · 242 770 gz | −3 B (textos de resultado/intro na casca) |
| Home, CSS inicial · arte | 206 074 B · 46 arquivos 528 352 B | iguais | 0 |
| Game 03, JS lazy | 182 695 B · 49 010 gz | 182 716 B · 48 996 gz | +21 B · −14 gz |
| Game 03, CSS | 23 539 B · 5 396 gz | 23 784 B · 5 427 gz | +245 B (a fileira das estações) |
| Entrada + preparar, arte | 11 · 440 068 B | iguais | 0 |
| Rodada do Estúdio desde a entrada | 16 · 474 718 B | iguais | 0 |
| Observatório escolhido depois | 14 · 399 308 B | 14 · 399 334 B | +26 B (atlas reempacotado) |
| atlas Estúdio · Observatório | 143 680 B · 94 754 B (1024×780) | 143 680 B · 94 780 B (1024×785) | 0 · +26 B |
| Rota · Circuito · Babylon | — | idênticos | 0 |

Execução: **1 commit do React** por arranjo novo (as duas salas), **0** durante o pan, **1** por
interação de peça — iguais à base; compor um arranjo custa 0,70 ms (Estúdio) / 0,57 ms
(Observatório) em média, pior 16–23 ms (1ª chamada, JIT frio); atlas decodificado 5,7 MB / 3,2 MB
(+20 KB). Nenhuma dependência nova.

**Compactação investigada — nenhuma aplicada** (medidas no chunk real, `next build`):

| Ideia | Ganho medido | Decisão |
| --- | --- | --- |
| arte por lugar como arrays (sem nomes de campo) | −0,53 KB gz | não: ilegível, sem ganho real |
| arte por lugar como uma string + vizinhos por índice | −1,6 KB gz bruto (−1,2 KB líquido com o decodificador) ≈ 2,5% do chunk | não: módulo gerado ilegível, âncoras de mutante e leituras das suítes, por ~1 KB |
| tirar as palavras de pista do objeto (redundantes com as do lugar) | −1,4 KB gz | não: muda o contrato `HiddenObjectDefinition` (H24, I27…) por 3% |
| atlas com qualidade menor | — | não: os objetos pequenos são o jogo; já é q74 com transparência barata |
| dividir o código por sala (carregar só a sala jogada) | ~13–15 KB gz por sessão de uma sala | não agora: é arquitetura (definição de sala assíncrona); limiar em §18 |

Cada sala custa ~16 KB gz de dados (Estúdio: cena 11,0 + arte 5,1; Observatório: 11,4 + 4,3) num
chunk de ~48 KB gz.

## 16. Regressões cruzadas

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 erros, 5 avisos (os da base) · 0 · limpo |
| `next build` | exit 0, mesmas rotas |
| platform lock v1 · `--counterfactuals` | 18/18 · `LOCK_GATE_COUNTERFACTUALS_HOLD` (5 bases históricas + 6 mutantes; o clone raso foi aprofundado para alcançar `61c3b04`) |
| readiness · watchdog · continuation · diagnostic boundary | 19/19 · 10/10 · 21/21 · `PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_OK` (MATCHES) |
| Circuito | 13/13 |
| Rota: terminal · ownership · coupling gate | 13/13 · 7/7 · 6/6 |
| CORE (`validation-hygiene-tests.mjs`) | 15/15, `CORE_BATTERY_PASSED`, `VALIDATION_CHECK_IS_READ_ONLY` (MATCHES) |
| DEEP (`final-acceptance.mjs --check`) | estrutural 1080/1080, contínuo 270/270, recovery 9/9, 5 evidências MATCHES |
| dependências | `package.json` e `package-lock.json` idênticos à base; `npm audit` 13 (1 baixo, 2 moderados, 10 altos, 0 críticos) — o mesmo lockfile |

## 17. Limitações conhecidas

- **Âncoras fixas por desenho** (microscópio, leque, gramofone, sistema solar, vela; barco, globo,
  bolsa, lanterna): sempre no mesmo lugar.
- **Concentração:** quatro objetos do Estúdio ficam em casa em ~79–81% dos arranjos, e a tesoura no
  Difícil em 83,8% (tetos 85/90%). Quem joga muito pode "lembrar" esses.
- **Anti-repetição** lembra só o último arranjo de cada sala, só na visita.
- **Sósia flutuante:** o estojo de óculos (sósia) no pé da estante fica ~10 su acima dos rolos (§5).
- **Celular em pé:** a fileira das estações tira ~51 px da sala (≤ 479 px de largura).
- **"Praticar outra vez"** passa de novo pela transição e pela intro da plataforma (comportamento
  compartilhado e travado; não mudei).
- **Desordem aditiva** por lugar difere da composição inteira em até 0,002 (como na REPLAYABILITY-05).
- **Arte 2D gerada por script**; "atrás" é ordem de pintura. A revisão visual foi minha, não de um
  artista nem de crianças/idosos.
- **Validação humana:** um relato informal do dono do projeto; nenhum playtest estruturado com o
  público-alvo nesta fase.
- **Ruído de raster** no céu do Observatório (≤ 6/255 entre páginas): invisível, mas impede
  comparação por hash.

## 18. Escalabilidade (terceira sala)

Nada no motor nomeia uma sala (P02/R36): uma terceira sala é um módulo `scenes/<sala>.ts` (estações,
pool, sósias, cenário, slots, peças), um gerador de arte no kit v4 (prancha, atlas, auditoria,
`.art.ts`) e uma linha no registro `SCENES`. Sem ramo no motor, sem componente novo, sem reescrever
compositor, regra de rodada ou peças (os tipos de peça existentes cobrem gaveta/porta/cortina/
tampa/cesto).

**Limiar para dividir o código por sala:** hoje os dados de cada sala (~16 KB gz) vão no mesmo chunk
lazy do Game 03 (~48 KB gz). Com uma **terceira sala** (≈ 64 KB gz, dois terços sendo salas que a
sessão não joga), ou com o chunk passando de ~64 KB gz, vale carregar `scenes/<sala>.ts` +
`.art.ts` por `import()` quando a sala é escolhida (o preparar precisa só de nome, frase e prévia).
Isso torna a definição da sala assíncrona — missão própria, com as suítes acompanhando.

## 19. Ideias adiadas para depois da V1

- Memória de arranjos de mais de uma exploração (anti-repetição mais longa), sem salvar nada.
- Reequilibrar os lugares mais concentrados (tesoura, gaita, chave) com lugares novos e arte nova.
- Compactar a arte por lugar e dividir o código por sala (§15, §18).
- Repintar o estojo de óculos sobre os rolos.
- Terceira sala.
- Playtest estruturado com o público-alvo (idosos, crianças) nas duas salas.

## 20. Decisão e próximo passo

**`GAME03_V1_LOCK_CANDIDATE`:** nenhum bloqueio de jogabilidade conhecido; todas as suítes e
contrafactuais passam; 135/135 mutantes pegos; 381/381 checks de browser; revisão visual de 240
lugares feita e o único defeito corrigido; justiça e variedade dentro de todos os pisos e tetos;
acessibilidade (teclado, foco, `aria-expanded`, região viva, movimento reduzido) e celular
(320–915 px) verificados; Home, Rota, Circuito e plataforma intactos; diff dentro do escopo; o sinal
humano atual não aponta bloqueio.

Recomendado: (1) revisão independente desta branch contra `4dc4461` — o diff de produto é pequeno
(§4) e a arte mudou num lugar só (§6); (2) uma rodada curta de playtest no celular, com atenção à
fileira das estações e ao ratinho atrás do baú; (3) se aprovada, integrar em
`v06-portal-requires-lights` e registrar o lock do Game 03 V1 (atualizando `SOURCE_OF_TRUTH.md`);
(4) depois, a mudança da Home planejada pelo dono, e só então a Rota 2.0.

## 21. Como reproduzir

```bash
npx eslint && npx tsc --noEmit && git diff --check
node tools/validation/hidden-objects-final-lock-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-{skeleton,experience,multiscene,calibration,interactions,replayability}-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-round-fairness.mjs --scene <sala> --out DIR
node tools/validation/hidden-objects-layout-variety.mjs --n=2000 --json FILE
node tools/validation/hidden-objects-calibration.mjs --out DIR
node tools/assets/create_observatory_scene.mjs && node tools/assets/sync-hidden-objects-measured.mjs   # nada muda
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-final-lock-probe.mjs [--scenario lock-studio,lock-observatory,lock-phone,lock-keyboard] [--out DIR]
node tools/validation/hidden-objects-{replayability,interactions,calibration,multiscene}-probe.mjs
node tools/validation/hidden-objects-browser-probe.mjs --build .next
node tools/validation/gameplay-platform-lock-v1.mjs --counterfactuals   # precisa do histórico completo (git fetch --unshallow)
node tools/validation/validation-hygiene-tests.mjs                     # CORE
node tools/validation/final-acceptance.mjs --check                     # DEEP
```

Arquivo: `docs/archive/game03-final-polish-lock-06/` — `logs/` (todas as suítes, contrafactuais,
cruzadas, CORE, DEEP, justiça), `rounds-<sala>/`, `variety-report.json`, `calibration-report.*`,
`*-probe-run.json`, `scenarios-alone.json`, `bundle-and-payload-vs-replayability-05.json`,
`placement-review/` (240 lugares + o ratinho antes/depois), `witnesses/`.
