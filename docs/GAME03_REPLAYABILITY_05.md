# MindFlow — Game 03 Replayability 05 · a mesma sala, arrumada de outro jeito

Missão GAME03-REPLAYABILITY-05. Branch `feat/game03-replayability-05`, base exata
`36ab89a7dfdf592792f93c7c489b57a6128ce38f` (`docs(game03): INTERACTIONS-04 record — CORE,
DEEP and final regressions` — o estado final da GAME03-INTERACTIONS-04).
**Sem merge, sem PR, sem terceira sala, sem Rota 2.0, Game 03 não travado.**

**Veredito: `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`.** As duas salas deixaram de ter um só
arranjo: cada exploração nova compõe, a partir da sua semente, onde estão os objetos que
se movem — alvos, sósias e cenário — escolhendo entre **lugares autorais** (slots)
desenhados sala a sala. Os móveis grandes, as fontes de luz e as peças que abrem ficam
fixos; os objetos menores trocam de lugar. Mesma semente, mesma sala, ao pixel;
"Recomeçar" mantém o arranjo; uma exploração nova traz outro. Tudo o que uma máquina
verifica passou (§19). Se a sala parece **a mesma sala, arrumada de outro jeito** — e se
isso faz voltar a ela sem virar "decorar onde está" — só o playtest humano diz (§22).

---

## 1. O que muda para quem joga

- Cada **Explorar** (Praticar outra vez, Trocar de cena → Explorar, outra sala) arruma a
  sala de novo: em média **47% das coisas** do Estúdio e **43%** do Observatório estão
  em outro lugar que na exploração anterior — objetos da lista, sósias e cenário juntos.
- A sala continua **a mesma**: estante, mesa, janela, telescópio, poltrona, lanterna,
  vela, cúpula, as três peças que abrem de cada sala — nada disso se move.
- Um objeto só aparece onde **cabe e faz sentido**: no peitoril, numa prateleira, no
  tapete, atrás de um baú, dentro da gaveta que o guarda. Nunca no ar, nunca fora da
  sala, nunca embaixo da moldura da tela, nunca em cima de outro.
- **Recomeçar** mantém a lista, as pistas **e o arranjo** (e fecha as peças, como antes).
- Uma exploração nova **nunca** repete exatamente o arranjo anterior da mesma sala
  (enquanto houver outro — e há ~10¹⁰ a 10¹³).
- As pistas falam do lugar onde o objeto está **nesta** exploração ("no chão, atrás do
  baú azul"), o "Mostrar onde está" do Fácil acende onde ele está, e o toque acha o
  objeto onde ele está — nunca onde ele estava pintado antes.
- O Difícil nunca pede um objeto num lugar "à vista" (tier A daquele lugar): o mesmo
  objeto pode ser fácil num lugar e difícil em outro, e a regra da rodada mede onde ele
  está.

Sem cronômetro, sem pontuação de pressão, sem vidas, sem ranking, sem inventário, sem
física; nada é salvo além do que já era (R32, R33).

## 2. Branch, base e commits

- Verificado antes de editar: branch `feat/game03-replayability-05`, `HEAD` = `36ab89a…`,
  árvore limpa.
- Commits de checkpoint empurrados durante o trabalho (`e14324d`, `1884620`, `a3dca1b`,
  `2bc0c56`, `14ff457`, `d502043`) e o commit final desta missão. Nenhum merge, nenhum PR.

## 3. Arquitetura

Um motor só; os lugares são dados. Nada no motor nomeia sala, estação, objeto, slot ou
peça (R35, R36).

| Arquivo | O que faz |
| --- | --- |
| `hidden-objects-scene.ts` | contrato: `SceneSlot` (id, estação, superfície, ponto `at`, `align`, peça que o guarda `gate`, palavras de pista `hints`), `Placement` (slot + `tier` daquele lugar), `SceneProp` (cenário que se move), `PlacementArt` / `PlacementSprite` / `PlacementMeasure` (o retângulo do atlas e a auditoria de cada lugar), `SceneAtlas`; `TARGET_GAP_SU = 24` (F2 onde quer que os objetos estejam) |
| `hidden-objects-layout.ts` (novo) | o compositor, puro: as coisas da sala e seus lugares, a tabela de conflitos (ocupação, F2, folga das sósias, profundidade), a composição semeada (domínios podados contra o fixo, componentes independentes, busca com verificação adiante, limite de passos, *fallback* para o arranjo pintado), a assinatura do arranjo, `placedScene` (a sala como esta exploração a joga: região, tier, medidas e palavras de pista de cada objeto onde ele está), os sprites a pintar |
| `hidden-objects-rounds.ts` | `selectRound`: a semente compõe o arranjo e sorteia a lista **na sala assim arrumada** (até `LAYOUT_ATTEMPTS = 6` arranjos, `ROUND_DRAWS = 4000` sorteios cada; depois, o arranjo pintado com as suas rodadas enumeradas); `explorationSeed`: a anti-repetição (até `REPEAT_DRAWS = 8` sementes) |
| `hidden-objects-model.ts` | `state.layout` (o arranjo da rodada; o pintado no preparar) e `roomOf(state)`: toque, pistas, auréola e modelo de rodada leem a sala colocada |
| `hidden-objects-scenes.ts` | a memória da visita: o último arranjo de cada sala (só em memória — nada salvo) |
| `HiddenObjectsGame.tsx` / `HiddenObjectsScene.tsx` | `explore()` tira a semente pela anti-repetição; `SceneThings` pinta cada coisa móvel como um retângulo do atlas da sala no seu lugar, entre a prancha e as peças (`aria-hidden`, sem eventos: o toque é geometria); o atlas é arte essencial da prontidão |
| `scenes/<sala>.ts` | slots e lugares de cada coisa (o primeiro é onde ela foi pintada) |
| `scenes/<sala>.art.ts` (novo, gerado) | o retângulo do atlas e as medidas de cada lugar |
| `tools/assets/hidden-objects-sprites.mjs` (novo) | o kit v4: renderiza cada coisa em cada lugar com a luz da sala (cor exata recuperada da composição com e sem ela), recorta, empacota o atlas, audita cada lugar como o jogo o mostra |

O preparar mostra a sala como foi pintada (o arranjo "de casa"); a rodada mostra o seu
arranjo. O arranjo nasce da mesma semente que a lista — não de `Math.random`, não de um
render (R02, R04, R08).

## 4. O modelo de slots autorais

- Um **slot** é um ponto de apoio desenhado na arte: o meio da base (`align: "bottom"`),
  do topo (pendurados) ou o centro, numa estação, numa superfície (chão, prateleira,
  peitoril, mesa, parede). Coordenadas livres não existem: um objeto só fica em slots da
  sua sala (R02, R10).
- Uma coisa tem **2 a 4 lugares** (`placements`); o primeiro é onde ela foi pintada. Uma
  coisa com um só lugar é fixa e fica na prancha.
- Cada lugar de um objeto da lista pode ter o seu **tier** (A à vista, B parcialmente
  escondido, C bem escondido) — a mesma pantufa é B na manta e A no meio do chão.
- Cada slot traz as **palavras de pista** daquele lugar (região para o Fácil, direção para
  o Médio, contexto para o Difícil).
- Um objeto guardado atrás de uma peça só tem lugares **dentro** da peça que o guarda
  (`gate` do slot = `gate` do objeto): a gaveta continua sendo a gaveta (R03, R13, R14).
- Uma sósia fica sempre na **estação** do objeto com que se parece (R03).
- Regras de ocupação (o mesmo contrato nos dois lados: motor e suíte independente):
  dois objetos da lista a ≥ 24 su (F2); uma sósia a ≥ 32 su de qualquer objeto da lista
  (forma a forma); quaisquer outras duas coisas com caixas a ≥ 4 su — salvo uma clara
  frente/fundo (bases a ≥ 40 su) em que a de trás **não** é objeto da lista; o mesmo
  slot, nunca (R09).
- Todo lugar respeita a área segura (F1), não fica sob a moldura de primeiro plano com
  folga de 24 su (F4), é enquadrável longe do HUD (F5) e não fica sob uma peça que não o
  guarda (R10).

## 5. Estúdio

| | |
| --- | --- |
| Coisas | 57: 26 objetos da lista, 25 sósias, 6 de cenário |
| Móveis | 50 (22 objetos, 22 sósias, 6 de cenário) · fixos 7: barco, lanterna (fonte de luz), globo, bolsa e três sósias que são parte do baú e do móvel (alça, fivela, roseta entalhada) |
| Slots · lugares | 85 · 140 (7 coisas com 1 lugar, 18 com 2, 31 com 3, 1 com 4) |
| Guardados | apito (gaveta da mesinha: 2 lugares), colar (caixinha da mesa: 2), cantil (cesto de mapas: 2) |
| Cenário que se move | pedrinhas, tigela de latão, garrafinha (peitoris, mesinha, poltrona), pote de frutinhas, caixa escura, caixa clara (estante) |
| Atlas | `v4/atlas.webp` 1024×1391, 133 sprites, 143 680 B |

## 6. Observatório

| | |
| --- | --- |
| Coisas | 53: 26 objetos, 26 sósias, 1 de cenário |
| Móveis | 42 (21 objetos, 20 sósias, 1 de cenário) · fixos 11: sistema solar, vela (fonte de luz), gramofone, microscópio, leque e seis sósias presas à sala (esfera armilar, luminária, móbile, flâmula, fechadura, transferidor) |
| Slots · lugares | 76 · 118 (11 coisas com 1 lugar, 21 com 2, 19 com 3, 2 com 4) |
| Guardados | foguete (portinhola do lambri: 2 lugares), ioiô (gaveta da bancada: 2), tambor (cortina da mesinha: 2) |
| Cenário que se move | a xícara azul (mesa) |
| Atlas | `v4/atlas.webp` 1024×780, 107 sprites, 94 754 B |

No fim da missão, a pantufa ganhou um lugar **atrás do baú azul** (só a boca das
pantufas aparece sobre a tampa: 70,5% visível, borda 4,48:1), e a meia, um lugar no chão
da cúpula para abrir espaço — sem isso, o Difícil pedia a pantufa sempre no mesmo lugar
(§18).

## 7. Semente e determinismo

- Uma exploração = **uma semente de 32 bits** (`crypto.getRandomValues`). Dela derivam,
  por propósito, a semente do arranjo (`layout:<tentativa>`) e a do sorteio
  (`round:<tentativa>`) — `derivedSeed`, finalizador murmur3.
- Mesma sala + dificuldade + semente ⇒ mesma assinatura de arranjo, mesmas coordenadas,
  mesmas regiões de toque, mesma lista e ordem (R04, R05; em browser, `rep-replay`:
  mesma semente numa visita nova ⇒ a mesma composição **pixel a pixel**).
- "Recomeçar" mantém o arranjo (R06); pan, zoom, pinça, redimensionar, girar o celular,
  movimento reduzido, pistas, peças e achados não mexem em nada (R08; em browser,
  `rep-desktop-studio`, `rep-mobile-landscape`, `rep-reduced-motion`).
- A assinatura é um caractere por coisa móvel (o índice do seu lugar); o shell a expõe em
  `data-layout` (as sondas reconstroem a sala a partir dela).

## 8. Anti-repetição imediata

- A visita lembra, **só em memória**, a assinatura do último arranjo de cada sala.
- Uma exploração nova tira uma semente; se ela devolveria a sala exatamente como estava,
  tira outra — no máximo `REPEAT_DRAWS = 8` vezes, depois fica com a última (R28: nunca um
  laço aberto).
- A semente escolhida é **a rodada inteira**: a memória decide qual semente, nunca o que
  uma semente dá (R27).
- Medido: 0 repetições imediatas em 150 explorações seguidas por sala e dificuldade
  (R26); 20 visitas de 20 explorações por sala: nenhuma repetição imediata, nenhuma sala
  repetida dentro da visita, 47% (Estúdio) e 43% (Observatório) das coisas fora do lugar de
  uma exploração para a outra (relatório de variedade).

## 9. Alvos, sósias e cenário

- **Tudo** o que é pequeno se move, não só o que a lista pede: se só os objetos listados
  mudassem de lugar, o movimento entregaria a lista. Sósias e cenário seguem a mesma
  semente (R16, R17), e o que se move não diz nada sobre o que está pedido (R17: um objeto
  listado está fora de casa tão frequentemente quanto qualquer outra coisa móvel — a
  diferença fica abaixo de 20 pontos).
- O que a lista não pede continua cenário em qualquer lugar (R15).
- Variação medida (relatório de variedade, 2 000 sementes × 3 dificuldades por sala):

| | Estúdio | Observatório |
| --- | --- | --- |
| coisas fora do lugar entre duas explorações (média · p10–p90) | 47,1% · 36,8–56,1% | 42,6% · 34,0–52,8% |
| mesmo lugar que na exploração anterior: objeto · sósia · cenário | 50,7% · 42,2% · 45,4% | 45,9% · 45,4% · 61,0% |
| entropia média de lugar (1 = uniforme) | 0,902 | 0,932 |
| lugar mais tomado | 81,9% (a chaleira, sósia, na prateleira 4) | 79,9% (o regador, sósia, na prateleira) |

## 10. Compatibilidade com as peças

- Cada objeto guardado tem dois lugares **dentro** da sua peça; fechada, nenhum toque o
  acha em nenhum dos dois (R13: um toque na região acha nada e mexe a peça); aberta, ele
  é achado onde está (R14).
- Nenhum lugar de qualquer coisa fica sob uma peça que não o guarda (R10, e a auditoria
  `visibleAtRest` = 0 para os seis guardados em todos os lugares).
- A profundidade de interação (0/1 por objeto) e os limites de guardados por
  dificuldade continuam valendo em todo arranjo (R22).

## 11. Dificuldade V3 por lugar

- A regra da rodada (tiers, buscas, *pop-outs*, sósias, guardados) mede a **sala
  colocada**: cada objeto com o tier, a visibilidade, a borda e a desordem **daquele
  lugar**, com os vizinhos **daquele arranjo** (desordem aditiva: o anel medido sem nada
  que se move + a contribuição de cada vizinho presente) (R18).
- Os pisos de cada dificuldade valem em todo arranjo composto (R19–R21, contados pela
  suíte de forma independente a partir dos tiers de cada lugar).
- O Difícil nunca aceita um lugar A (à vista): a regra dele admite 0 objetos A
  (`A: [0, 0]`) e 0 *pop-outs*, e o tier contado é o **do lugar** — um objeto num lugar à
  vista nunca entra numa lista do Difícil (R21; o mutante que deixa entrar é pego). E um
  objeto com dois lugares B/C ou mais nunca fica preso num só (R25: nenhum acima de 90%
  das suas rodadas difíceis num lugar; medido, o mais concentrado fica em 83,8% — a
  tesoura do Estúdio).
- Justiça das rodadas (`hidden-objects-round-fairness.mjs`, reescrito — §18;
  `docs/archive/game03-replayability-05/rounds-<sala>/`), `ROUND_FAIRNESS_OK` nas duas salas:

| | Estúdio | Observatório |
| --- | --- | --- |
| sala pintada, 1 000 000 de sementes por dificuldade: rodadas válidas · alcançadas | 884 · 3 160 · 8 005 — todas | 1 326 · 4 021 · 19 414 — todas |
| χ² uniforme (z) · maior \|z\| por objeto | 1,50 / −0,39 / 0,53 · ≤ 2,80 | 0,64 / 0,77 / −0,19 · ≤ 2,11 |
| arranjos, 30 000 sementes por dificuldade: listas inválidas · *fallbacks* | 0 · 0 | 0 · 0 |
| exato em 500 sementes por dificuldade: posto χ² (z) · KS (√n·D) | ≤ 0,46 · ≤ 1,21 | ≤ 0,69 · ≤ 0,82 |
| maior \|z\| por objeto contra as probabilidades exatas por arranjo | 2,29 | 2,51 |
| visível médio das listas (medido, Fácil → Médio → Difícil) | 88,9% → 86,1% → 83,8% | 88,2% → 85,7% → 82,6% |

## 12. Justiça por lugar

A auditoria do kit v4 mede **cada objeto em cada lugar** como o jogo o mostra (prancha,
o sprite do atlas, as peças em repouso e abertas, o primeiro plano):

| | Estúdio | Observatório |
| --- | --- | --- |
| lugares auditados | 58 | 57 |
| A: menor visível · menor borda | 89,6% · 1,32 | 93,1% · 1,92 |
| B | 74,7% · 1,32 | 70,5% · 1,32 |
| C | 53,8% · 1,31 | 43,0% · 1,39 |
| guardados: visível com a peça fechada | 0 em 6 lugares | 0 em 6 lugares |

Pisos: visível A ≥ 0,80 · B ≥ 0,60 · C ≥ 0,40; borda ≥ 1,3:1; guardado em repouso
≤ 0,05 (R23, que também exige que o jogo leia exatamente as medidas da auditoria do atlas
enviado — hash SHA-256 do atlas). A desordem de cada objeto no arranjo pintado (as linhas
`targets`, que a calibração C22 confere contra a composição enviada) passou a ser medida
na composição **com os sprites do atlas** (`composeShipped` + `homeSprites`), porque a
prancha não tem mais as coisas que se movem; C22 não mudou e continua exata. O contraste
médio (F4 "como escrito") é informativo, como antes: o menor é a lupa no livro da esquerda
(1,00; borda 1,84); na base era 1,06.

## 13. Variedade e espaço de arranjos

| | Estúdio | Observatório |
| --- | --- | --- |
| componentes independentes · tamanhos | 11 · 16, 12, 9, 3, 3, 2, 1, 1, 1, 1, 1 | 10 · 10, 9, 9, 7, 2, 1, 1, 1, 1, 1 |
| arranjos alcançáveis (exato, produto dos componentes) | **10^12,99** | **10^10,23** |
| arranjos distintos em 6 000 explorações (2 000 sementes × 3) | 2 000 (cada semente, um arranjo) | 2 000 |
| repetições imediatas · conflitos · *fallbacks* | 0 · 0 · 0 | 0 · 0 · 0 |
| custo: média · pior por rodada | 0,68 ms · 28 ms (1ª chamada, JIT frio) | 0,46 ms · 42 ms (idem) |
| pior: passos de composição · tentativa · sorteios | 7 629 / 20 000 · 0 / 6 · 199 / 4 000 | 183 / 20 000 · 0 / 6 · 164 / 4 000 |

Todo lugar autoral é alcançável e foi sorteado (R24); nenhum lugar passa de 85% dos
arranjos nem fica abaixo de 5% (R25). Relatório completo:
`docs/archive/game03-replayability-05/variety-report.json`.

## 14. Arte v4 — prancha + atlas

- A prancha (`plate.webp`) é a sala **sem** as coisas que se movem; as coisas fixas
  continuam pintadas nela.
- Cada coisa em cada lugar é renderizada **na luz da sala** (a mesma iluminação, brilho e
  grão da prancha) e recortada; a cor é recuperada exatamente da composição com e sem ela
  (`colour = (comCoisa − (1−k)·semCoisa)/k`), e o que fica na frente do slot (a tampa do
  baú, o cesto, a moldura) já recorta o sprite.
- Todos os sprites de uma sala num atlas só (`atlas.webp`), um pedido HTTP, decodificado
  uma vez; cada coisa é um `<span>` com `background-position`.
- Kit v3 removido (as pastas `v3/` das duas salas); o hero e as miniaturas seguem no v4.

## 15. Evidência visual

Em `docs/archive/hidden-objects/replayability/` (gerado por
`hidden-objects-layout-witnesses.mjs`, a partir dos arquivos enviados, como o jogo
compõe):

- `explorer-studio-layouts.webp` e `explorer-observatory-layouts.webp`: **seis arranjos**
  por sala — Fácil, Médio, quatro Difícil — com a lista em vermelho e tudo o que saiu do
  lugar pintado em azul tracejado;
- `<sala>-compare.webp`: **o mesmo canto da sala em seis sementes**, lado a lado — a mesma
  sala, outra organização;
- `<sala>-kept.webp`: um objeto guardado no seu segundo lugar, peça fechada e aberta;
- `witnesses.json`: semente, dificuldade, assinatura, lista e o que saiu do lugar.

Em `docs/archive/game03-replayability-05/witnesses/` (capturas do browser, build de
produção): Estúdio no Médio e na exploração seguinte, objeto achado no lugar novo,
Observatório no Difícil, guardado fechado/aberto, celular retrato (com a pista) e
paisagem (antes/depois de girar), movimento reduzido nas duas salas, mesma semente e
outra semente.

## 16. Evidência de browser

`hidden-objects-replayability-probe.mjs` (novo), build de produção, sete cenários — cada um
roda sozinho com `--scenario`:

| Cenário | O que prova |
| --- | --- |
| `rep-desktop-studio` | a sala é a composição da semente; pan/zoom não move nada; arrasto sem render; um arranjo novo é um *setup* limitado; achado onde está, não onde estava; Recomeçar mantém; exploração nova muda |
| `rep-desktop-observatory` | sósias, alvo e cenário fora de casa; guardado fechado/aberto no lugar atual; Difícil |
| `rep-mobile-portrait` | toque, pan, pinça, peça, pista no lugar atual, sem overflow |
| `rep-mobile-landscape` | girar no meio da rodada não move nada; continua jogando |
| `rep-reduced-motion` | mesmo arranjo e mesma semântica sem animação |
| `rep-replay` | mesma semente numa visita nova = mesma composição (pixels); outra semente = outra |
| `rep-sequence` | várias explorações seguidas, nenhuma igual à anterior |

Resultado: **41/41** no conjunto; **41/41** somando cada cenário sozinho (9 + 5 + 7 + 4 + 4
+ 3 + 9; `replayability-probe-run.json`, `replayability-scenarios-alone.json`). Probes
antigos no build final: interactions 42/42 · calibração 83/83 · multiscene 61/61 · Estúdio
104/104 (`*-probe-run.json`).

## 17. Contrafactuais e mutantes

`hidden-objects-replayability-tests.mjs --counterfactuals`: a árvore passa 36/36; a **base
`36ab89a` falha as 31 verificações `[replayability]` e mantém as 5 `[preserved]`**; cada
mutante em memória falha o que nomeia:

| Mutante | Pego por |
| --- | --- |
| a vista compõe o próprio arranjo com `Math.random` a cada render | R02, R08 |
| a mesma semente dá outro lugar (o compositor conta as chamadas) | R04, R05 |
| Recomeçar sorteia outro arranjo | R06 |
| o toque ainda testa o objeto onde ele estava pintado | R11 |
| a auréola da pista acende onde o objeto estava pintado | R12 |
| duas coisas podem dividir um slot | R09 |
| dois objetos da lista mais perto que o piso F2 | R09 |
| um slot fora da sala | R10 |
| as sósias nunca se movem | R16 |
| o cenário nunca se move | R17 |
| só os objetos listados se movem | R16, R17 |
| um objeto guardado sai da sua peça | R03 |
| uma peça fechada pode ser tocada através | R13 |
| o modelo da rodada ignora o que a auditoria mediu no lugar | R18 |
| o Difícil aceita um objeto num lugar à vista | R21 |
| um lugar que nenhuma sala comporta | R24 |
| toda coisa fica sempre no primeiro slot | R07, R25, R29 |
| a anti-repetição muda o que uma semente dá | R27 |
| a anti-repetição sorteia até a sala mudar (sem limite) | R28 |
| um ramo específico de sala no compositor | R36 |
| a Home importa a arte de arranjo de uma sala | R31 |

21 mutantes (os 20 da missão + F2). Todas as âncoras de mutante das seis suítes foram
conferidas contra a árvore final (cada uma aparece exatamente 1×). Cinco mutantes foram
reancorados (§18) — mesma mutação, mesmos checks exigidos: três cujas âncoras tinham
ficado para trás com a autoria e a reescrita de `selectRound` (`BROKEN`), um que editava a
auditoria de um kit que a sala não envia mais (inerte) e um que tinha virado equivalente.
O último é "duas coisas podem dividir um slot": tirar só o termo "mesmo slot" da tabela de
conflitos virou um mutante equivalente (todos os 138 pares de lugares que dividem um slot já
conflitam pela forma, nas duas salas — nenhum arranjo muda), então ele passou a fazer o
que o nome diz: duas coisas no mesmo slot **nunca** conflitam. R09 pega.

## 18. Verificações reescritas — verdade antiga → verdade nova

Cada uma foi reescrita para a sala **como a exploração a joga**, lendo cada árvore pela sua
geração (existe `hidden-objects-layout.ts`), e marcada no código com
`GAME03-REPLAYABILITY-05 (restated)`. Nenhum piso baixado, nenhuma tolerância afrouxada.
A prova contrafactual de cada linha é a suite dela em `--counterfactuals`: a base anterior
de cada suite continua pega e todos os mutantes continuam pegos (§19), mais o que a
coluna diz.

| Onde | Verdade antiga → verdade nova | Por quê | Invariante nova | Prova contrafactual |
| --- | --- | --- | --- | --- |
| harness `decode` (e calibração, interactions, multiscene) | as camadas e as peças são a arte essencial → + o atlas da sala | a prancha pinta a sala sem as coisas que se movem | a sala não fica pronta sem o atlas decodificado | esqueleto: "ready before the layers decode" → H32, pego |
| harness `played()`, `tapOn`, `findIn`, `revealOf`; helpers `find`/`tapObject`/`target` das suítes e das sondas | tocar o centro da região pintada acha o objeto → tocar onde **o arranjo da rodada** o põe | o objeto está em outro lugar; tocar o lugar antigo agora **não** deve achar (R11) | toda sonda reconstrói a sala de `data-layout` (`placedScene`) | R11 e o mutante "o toque ainda testa onde estava pintado" |
| esqueleto H24 | campos exatos do objeto → + `placements`, cada um num slot da sala | campo novo do contrato | todo lugar nomeia um slot existente | mutantes do esqueleto 18/18 |
| esqueleto H28 · experiência E06 | a auréola do "Mostrar onde está" fica sobre a região pintada → sobre o lugar da rodada (a peça, se fechada) | a pista segue o objeto | auréola = região colocada | R12 e "a auréola acende onde estava pintado" |
| esqueleto H34 | enquadra a Lupa pintada → enquadra a Lupa colocada | idem | o movimento reduzido corta no lugar atual | esqueleto `--counterfactuals` (base + 18 mutantes) |
| experiência E02 · multiscene M16 | cada objeto é desenhado por uma entrada do mapa de arte → + `THING_PAINT` (a tinta de cada coisa que se move, para os seus lugares), contado uma vez | o script desenha cada coisa uma vez e a reusa em cada slot | um objeto, uma arte | multiscene: "a arte do Observatório repintada sem auditoria nova" → M16, pego |
| experiência E07 · E08 · calibração C23 | a direção/contexto falam do lugar pintado → do slot onde está | as palavras de pista vêm do slot | a pista descreve o lugar atual | experiência: "Médio regains the exact reveal" → E03, E07; "Difícil regains the exact reveal" → E03, E08, E10, P11, pegos |
| experiência E30 · multiscene M06 | kit v3 → kit v4 (as mesmas miniaturas; o atlas conta nos dois orçamentos) | arte nova é pasta nova | o Estúdio continua o da EXPERIENCE-02 onde ela não foi tocada (sem comparar `placements`, onde o primeiro lugar é a região de antes) | bases das duas suítes continuam pegas |
| experiência P05 | 30 000+ sementes alcançam toda rodada da sala, sem viés → o sorteio sem viés é provado **na sala pintada** (o *fallback*, com o amostrador do produto, χ²) e cada semente dá uma rodada válida **da sua própria sala**, com os mesmos limites de exposição e de estação da 1ª linha | as rodadas agora são do arranjo de cada semente | uniforme entre as rodadas válidas do arranjo | experiência: "every seed draws the same round" → P05, P08, pego |
| calibração C08 | as rodadas Fácil sorteadas são rodadas enumeradas da sala → são rodadas válidas do arranjo da semente, conferidas pela regra aplicada à parte (`v3RoundKeeper`) | idem | toda lista cumpre a regra na sala em que é jogada | calibração `--counterfactuals` (base + 16 mutantes); R19 e "o Difícil aceita um lugar à vista" → R21 |
| interactions I09 | tocar cada peça numa rodada Médio (semente fixa) não move a câmera → uma semente por peça cuja rodada **não** lista o que ela guarda | com os arranjos, o tambor no 2º lugar fica ao alcance do dedo pela borda da cortina aberta; numa rodada que o lista, o toque o acha antes (a regra de sempre) | um toque de peça nunca faz pan | "a tap on a piece also pans the camera" continua pego |
| interactions I17 · I25 · multiscene M14 | toca o centro pintado → toca a região colocada | idem | o toque segue o lugar | "Fácil opens the piece" → I17; "hints and opened pieces make the result" → I25; "an unlisted Observatory object answers a tap" → M14, pegos |
| `hidden-objects-round-fairness.mjs` | toda semente sorteia uniforme entre as rodadas válidas **da sala** (enumeradas uma vez) → (1) na sala pintada, a seleção do produto com os outros lugares postos de lado: tudo o que valia antes, com a mesma força (1 000 000 de sementes); (2) a seleção real em 30 000 sementes: toda lista é rodada válida do seu arranjo, nenhuma linha favorece tier ou estação, exposição 5–75%, a carga perceptiva sobe com a dificuldade; (3) em 500 sementes, as rodadas de cada arranjo enumeradas: a rodada sorteada é uniforme entre elas (posto aleatorizado: χ² e KS) e cada objeto sai tanto quanto as probabilidades exatas por arranjo dizem | a versão antiga comparava cada semente com a sala pintada e falhava (\|z\| até 29) — por construção, não por viés | uniforme entre as rodadas válidas **do arranjo da semente** | um sorteio que favorece rodadas falha (1) e (3); uma lista válida só na sala pintada falha (2) e (3) |
| mutante "duas coisas podem dividir um slot" (replayability) | tirava o termo "mesmo slot" → nenhum conflito por slot | equivalente nos dados finais (§17) | slot exclusivo | R09 pega a versão reancorada |
| mutante "um slot fora da sala" (replayability) | movia o slot `mapa-fundo-b` → move `mapa-dir-fundo` (um lugar da Xícara) para x = 3990 | `mapa-fundo-b` saiu da sala durante a autoria; a âncora aparecia 0× (`BROKEN`) | — | R10 pega |
| mutante "the Observatory's art is repainted without a new audit" (multiscene) | editava a auditoria v3 do Observatório → edita a auditoria do kit que a sala envia (lido da sala: v4) | a sala passou a enviar o kit v4, que o M16 lê; o mutante ficou inerte (`MISSED`: editava um arquivo que nada lia) — o mesmo caso da v2→v3 na INTERACTIONS-04 | a auditoria lida é a do kit enviado | M16 pega (§19) |
| mutantes "every seed draws the same round" e "the seed is ignored: Math.random draws the round" (experiência) | trocavam o sorteio de `selectRoundTargets` → em `selectRound`: a lista sorteada uma vez só, na sala pintada, com gerador fixo (a mesma rodada para toda semente); o gerador do sorteio vira `Math.random` | `selectRound` reescrito: a semente compõe o arranjo e depois sorteia; as âncoras antigas apareciam 0× (`BROKEN`). Fixar só o gerador não bastava: arranjos diferentes aceitam candidatos diferentes, e o P08 (duas sementes, duas listas) não caía — a mutação precisa ignorar a semente de verdade. Em árvores sem arranjos, as âncoras de antes | a lista lê a semente | P05 e P08; P04 — pegos (§19) |

## 19. Regressões

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 erros, 5 avisos (os 5 da base; nenhum novo) · 0 erros · limpo |
| `next build` | exit 0; mesmas rotas estáticas |
| a base `36ab89a` nas cinco suítes antigas reescritas (`--rev`) | esqueleto 38/38 · experiência 45/45 · multiscene 20/20 · calibração 28/28 · interactions 28/28 — as garantias de antes continuam valendo na base; só o contrato novo a reprova |
| suite **replayability** · `--counterfactuals` | **36/36** · base `36ab89a` pega (31/31 `[replayability]` falham, 5/5 `[preserved]` de pé), 21/21 mutantes pegos (`HIDDEN_OBJECTS_REPLAYABILITY_COUNTERFACTUALS_HOLD`) |
| suite skeleton · `--counterfactuals` | 38/38 · base `f925442` pega (30/30 falham, 8/8 de pé), 18/18 mutantes pegos (`HIDDEN_OBJECTS_SKELETON_COUNTERFACTUALS_HOLD`) |
| suite experience · `--counterfactuals` | 45/45 · bases `87f30d3` e `8fbd638` pegas, 31/31 mutantes pegos (`HIDDEN_OBJECTS_EXPERIENCE_COUNTERFACTUALS_HOLD`; dois reancorados, §18) |
| suite multiscene · `--counterfactuals` | 20/20 · base `58b5f08` pega (17/17 falham, 3/3 de pé), 18/18 mutantes pegos (`…_COUNTERFACTUALS_HOLD`; um reancorado, §18) |
| suite calibration · `--counterfactuals` | 28/28 · base `3b122cf` pega (15/15 falham, 13/13 de pé), 16/16 mutantes pegos (`…_COUNTERFACTUALS_HOLD`) |
| suite interactions · `--counterfactuals` | 28/28 · base `ede2cb1` pega (24/24 falham, 4/4 de pé), 18/18 mutantes pegos (`…_COUNTERFACTUALS_HOLD`) |
| justiça por lugar (Estúdio, Observatório) | todos os lugares acima dos pisos (§12) |
| justiça das rodadas, duas salas (1 000 000 de sementes na sala pintada; 30 000 + 500 exatas por arranjo) | `ROUND_FAIRNESS_OK` × 2 — toda rodada alcançada, χ² uniforme (\|z\| ≤ 1,50), nenhum objeto fora da probabilidade exata (\|z\| ≤ 2,80); 0 listas inválidas em 180 000 explorações; posto uniforme por arranjo (\|z\| ≤ 0,69, KS ≤ 1,21) |
| relatório de variedade | 0 conflitos, 0 *fallbacks*, 0 repetições imediatas em 12 000 rodadas; todo lugar sorteado; nenhum objeto do Difícil acima de 85% num lugar (§9, §13) |
| relatório de calibração | `CALIBRATION_REPORT_OK`; constantes = derivadas |
| probe **replayability** | **41/41**, e cada cenário sozinho 41/41 |
| probes antigos (build final) | interactions 42/42 · calibração 83/83 · multiscene 61/61 · Estúdio 104/104 |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · `LOCK_GATE_COUNTERFACTUALS_HOLD` |
| readiness · watchdog · continuation · diagnostic boundary | 19/19 · 10/10 · 21/21 · `PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_OK` (evidência MATCHES) |
| Circuito (`memory-circuit-lifecycle-tests`) | 13/13 |
| Rota: terminal de resultado · ownership · coupling gate | 13/13 · 7/7 · 6/6 |
| CORE `validation-hygiene-tests.mjs` | 15/15 validadores (`CORE_BATTERY_PASSED`); imutabilidade: nada criado, apagado ou alterado, `git status` idêntico (`VALIDATION_CHECK_IS_READ_ONLY`, evidência MATCHES) |
| DEEP `final-acceptance.mjs` | estrutural 1080/1080, contínuo 270/270, recovery OK (9/9), sem exceções; 5 evidências MATCHES |
| dependências | `package.json` e `package-lock.json` idênticos à base; nenhuma dependência nova; `npm audit` 13 avisos (1 baixo, 2 moderados, 10 altos, 0 críticos) — idêntico à base, mesmo `package-lock.json` |

## 20. Bundle, assets e desempenho

Medido nos dois builds de produção, cada um com seu `.next`
(`docs/archive/game03-replayability-05/bundle-and-payload-vs-interactions-04.json`, gzip 9):

| | `36ab89a` | agora | Δ |
| --- | --- | --- | --- |
| Home, JS e CSS iniciais | 773 682 B · 206 074 B | iguais (mesmos bytes) | 0 |
| Home, arte (com o Game 03 selecionado) | 46 arquivos · 528 352 B | iguais | 0 |
| Game 03, JS lazy | 95 457 B · 29 402 gz | 182 695 B · 49 010 gz | +87,2 KB · **+19,6 KB gz** (compositor, slots e lugares, arte por lugar) |
| Game 03, CSS | 23 252 B | 23 539 B | +0,3 KB |
| Rota · Circuito · Babylon | — | idênticos | 0 |
| Entrada + preparar, arte | 10 · 359 610 B | 11 · 440 064 B | +80,5 KB (o atlas do Estúdio; a prancha v4 é a sala sem as coisas que se movem) |
| Rodada do Estúdio desde a entrada, arte | 15 · 394 086 B | 16 · 474 714 B | +80,6 KB |
| Observatório escolhido depois, arte | 13 · 356 922 B | 14 · 399 308 B | +42,4 KB |
| `public/assets/hidden-objects/` | 1 006 646 B | 1 128 480 B | +121,8 KB (v3 removido, v4 com dois atlas) |

De onde vem o JS a mais (fonte, gzip 9; o chunk é minificado): a arte por lugar
(`*.art.ts`: o retângulo do atlas e as medidas de 256 lugares) ≈ 10,7 KB gz; o compositor
≈ 7,6 KB gz de fonte com comentários; os slots e lugares nas duas salas ≈ 4,5 KB gz cada.
Tudo no chunk lazy do Game 03; a Home não muda um byte.

Assets dinâmicos: **um atlas por sala** (Estúdio 133 sprites, 1024×1391, 143 680 B;
Observatório 107 sprites, 1024×780, 94 754 B). Memória: o atlas decodificado soma 5,7 MB
(Estúdio) e 3,2 MB (Observatório) às pranchas (20,5 MB e 23,0 MB decodificadas, do mesmo
tamanho de antes).

Desempenho (probe, build de produção): **1 commit do React** para montar um arranjo novo
(Estúdio e Observatório); **0 commits** durante um arrasto de câmera; o compositor custa
0,46–0,68 ms por rodada em média (pior 42 ms, a primeira chamada com JIT frio); pior caso
7 629 de 20 000 passos, tentativa 0 de 6, 199 de 4 000 sorteios; nenhum *fallback* em
12 000 rodadas. Babylon não entra; nenhuma dependência nova.

## 21. Limitações conhecidas

- **Âncoras fixas por desenho**: microscópio, leque, gramofone, sistema solar, vela
  (Observatório), barco, globo, bolsa, lanterna (Estúdio) nunca se movem — são grandes,
  fontes de luz ou parte do móvel. Quem os procura no Difícil os acha sempre no mesmo
  lugar (eles têm um só lugar, não "colapsam").
- Algumas coisas ficam em casa na maior parte dos arranjos, porque os outros lugares delas
  conflitam com muitos vizinhos: a chaleira (sósia) na prateleira em 81,9%, a tesoura no
  mapa em 80,5%, a lupa no mapa em 68,2% (Estúdio); o regador em 79,9% (Observatório).
  Todas abaixo do teto de 85% (R25), mas são as que menos variam.
- O tamanho de um objeto guardado continua limitado pela peça; os guardados têm dois
  lugares cada, ambos dentro da peça.
- A arte é 2D: "atrás do baú" é a ordem de pintura, não perspectiva real; a sombra de
  contato de cada coisa vai com ela, mas não muda com o lugar. A revisão visual foi
  minha, não de um artista nem de crianças.
- O JS lazy do Game 03 cresceu +19,6 KB gz (dados de lugar e o compositor); um formato
  compacto para a arte por lugar caberia numa missão de otimização.
- A rodada do Estúdio carrega +80,6 KB de atlas; o Observatório, +42,4 KB.
- A anti-repetição lembra só o **último** arranjo de cada sala, e só durante a visita.
- A desordem que o jogo lê por lugar é **aditiva** (o anel medido sem nada que se move + a
  contribuição de cada vizinho presente); a da composição inteira (o relatório de
  calibração, C22) difere dela em até 0,002 na sala pintada (3 objetos do Estúdio, 1 do
  Observatório). Isso troca 4 rodadas perto do limiar no Fácil e no Médio do Observatório
  (1 326 / 4 021 rodadas pela leitura do jogo, 1 322 / 4 025 pelo relatório); o Estúdio
  fica idêntico (884 / 3 160 / 8 005). O jogo é coerente consigo (R18): toda rodada que ele
  sorteia cumpre a regra na sala que ele mostra.

## 22. Playtest humano — `TO_VALIDATE_IN_REPLAYABILITY_05`

1. Depois de duas ou três explorações, a pessoa percebe que **a sala é a mesma** — e que
   as coisas estão em outro lugar? Isso aparece como surpresa boa ou como confusão?
2. Alguém tenta **ir direto** ao lugar onde o objeto estava da última vez? Por quanto
   tempo, até perceber?
3. Algum lugar parece **errado** para o objeto (uma pantufa onde pantufa não fica, algo
   flutuando, algo grande demais para a prateleira)?
4. Os lugares novos de cada objeto são **justos** no Médio e no Difícil? Algum vira
   "impossível" ou "óbvio demais"?
5. As pistas ("atrás do baú azul", "no peitoril") descrevem bem onde o objeto está
   **agora**?
6. A pantufa atrás do baú, o gato atrás do cesto, a xícara atrás do livro: dá para
   reconhecer o objeto pela parte que aparece?
7. As sósias trocando de lugar continuam enganando de um jeito **justo**?
8. Abrir as peças (gaveta, porta, cortina, tampa, cesto) continua natural quando o objeto
   guardado muda de posição dentro delas?
9. No celular, o arranjo novo muda algo no conforto (objetos pequenos perto da borda,
   alcance do dedo)?
10. Alguém **quer** jogar de novo para "ver como a sala ficou"? (o motivo da missão)
11. "Recomeçar" mantendo o arranjo parece certo — ou a pessoa esperava outra arrumação?
12. "Pensar em paz" continua? Alguém se sentiu pressionado?

## 23. Próximo passo recomendado

Playtest humano com o protocolo da §22 nas duas salas, celular e computador, com o
INTERACTIONS-04 (§19 de lá) no mesmo encontro. Depois, **uma missão curta de fechamento do
Game 03**: ajustar lugares que as pessoas acharem estranhos ou injustos, decidir se a
anti-repetição deve lembrar mais de um arranjo, compactar a arte por lugar, e então
travar o Game 03 v1 com o que o playtest mostrar. O Game 03 não está travado.

## 24. Validação

```bash
npx eslint && npx tsc --noEmit && git diff --check
node tools/validation/hidden-objects-replayability-tests.mjs                     # 36/36
node tools/validation/hidden-objects-replayability-tests.mjs --counterfactuals   # base 36ab89a + 21 mutantes
node tools/validation/hidden-objects-interactions-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-calibration-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-skeleton-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-experience-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-multiscene-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-layout-variety.mjs --n=2000 --json docs/archive/game03-replayability-05/variety-report.json
node tools/validation/hidden-objects-layout-witnesses.mjs
node tools/validation/hidden-objects-round-fairness.mjs --scene <sala> --out docs/archive/game03-replayability-05/rounds-<sala>
node tools/validation/hidden-objects-calibration.mjs --out docs/archive/game03-replayability-05
node tools/assets/create_hidden_objects_scene.mjs              # kit v4 do Estúdio: prancha, atlas, auditoria por lugar
node tools/assets/create_observatory_scene.mjs                 # kit v4 do Observatório
node tools/assets/sync-hidden-objects-measured.mjs             # copia as medidas da auditoria para as salas
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-replayability-probe.mjs [--scenario rep-desktop-studio,…] [--out DIR] [--json FILE]
node tools/validation/hidden-objects-interactions-probe.mjs
node tools/validation/hidden-objects-calibration-probe.mjs
node tools/validation/hidden-objects-multiscene-probe.mjs
PLAYWRIGHT_DIR=… node tools/validation/hidden-objects-browser-probe.mjs
node tools/validation/validation-hygiene-tests.mjs    # CORE
node tools/validation/final-acceptance.mjs            # DEEP
```

Arquivo da missão: `docs/archive/game03-replayability-05/` — relatório de variedade,
justiça das rodadas por sala, relatório de calibração, registros dos probes
(replayability, cenários sozinhos, interactions, calibração, multiscene, Estúdio), bundle e
carga contra `36ab89a`, testemunhas (`witnesses/`); e
`docs/archive/hidden-objects/replayability/` (os painéis de arranjos).
