# MindFlow — Game 03 Interactions 04 · peças da sala que abrem e se movem

Missão GAME03-INTERACTIONS-04. Branch `feat/game03-interactions-04`, base exata
`ede2cb124cf93506d2530fe1c6a007619e6fda01` (`docs(game03): CORE and DEEP in the
CALIBRATION-02A record` — o estado final da GAME03-CALIBRATION-02A).
**Sem merge, sem PR, sem terceira sala, sem Rota 2.0, Game 03 não travado.**

**Veredito: `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`.** As duas salas ganharam uma
camada de interação com o ambiente — gaveta, porta, cortina, tampa e um objeto que se
afasta — como dados de cena, com um motor só; alguns objetos agora ficam guardados
atrás dessas peças e só podem ser achados depois que o Explorador abre ou move a peça
certa. Tudo o que uma máquina verifica passou (§16). Se isso deixa o Game 03 mais
exploratório **sem** virar "abrir todas as gavetas" — e continua "pensar em paz" — só o
playtest humano diz (§19).

---

## 1. O que muda para quem joga

- Em cada sala, **três peças** se mexem com um toque (ou com o botão delas no teclado):
  elas têm o desenho de quem se abre — puxador, maçaneta, dobradiça, prega de tecido,
  fecho de tampa, um cesto encostado. Um toque abre/afasta; outro fecha/devolve.
- Cada peça guarda **um objeto novo** da sala. Enquanto a peça está fechada, o objeto
  não aparece e não pode ser achado (um toque ali abre a peça, não acha nada); aberta,
  ele é um objeto como os outros — mesma região, mesma identidade, mesma semente.
- Uma rodada pede **no máximo 1** objeto guardado no Fácil, **1–2** no Médio e **1–3**
  no Difícil. Nunca a lista toda: a maioria dos objetos continua à vista.
- Um objeto guardado que a rodada **não** lista é cenário: abrir a peça mostra o objeto,
  e tocar nele não conta nada.
- **Fácil**: a última pista ("Mostrar onde está") de um objeto guardado ilumina **a
  peça** e diz o que fazer ("Aqui está guardado: Ioiô — abra a gaveta funda da
  bancada.") — sem abrir nada. Aberta a peça, a mesma pista mostra o objeto.
- **Médio**: as pistas continuam só palavras; a direção de um objeto guardado sugere
  que ele está guardado ("embaixo do tampo, à direita, guardado"), sem luz, sem câmera,
  sem abrir.
- **Difícil**: só contexto ("guardado bem embaixo dos planetas de latão, longe da
  vista") — nunca o nome da peça, nunca luz, nunca abre.
- "Recomeçar" mantém a lista e as pistas e **fecha** todas as peças. Uma exploração
  nova (Praticar outra vez, Trocar de cena → Explorar, outra sala) sempre começa com
  tudo fechado. Nada é salvo.

Sem cronômetro, sem pontuação de pressão, sem vidas, sem ranking: abrir peças, pedir
pistas e errar toques não muda o resultado (I25).

## 2. Branch, base e commits

- Verificado antes de editar: branch `feat/game03-interactions-04`, `HEAD` =
  `ede2cb1…`, árvore limpa; a branch já existia no remoto.
- Commits de checkpoint empurrados durante o trabalho (`3e6daae`, `b7aaba1`, `153df77`,
  `38369e2`) e os commits finais desta missão. Nenhum merge.

## 3. Arquitetura

Um motor só; as peças são dados. Nada no motor nomeia sala, estação, objeto, peça ou
estado de peça (I03, P02 da calibração).

| Arquivo | O que faz |
| --- | --- |
| `hidden-objects-scene.ts` | contrato: `SceneInteractable` (id, `kind`, rótulos, estação, arte `src` + `rect`, `origin`, `states`, `initial`, `motionMs`, `hintAction`), `InteractableState` (`pose`, `hit`, `open`, `announce`), `InteractablePose` (deslocamento, giro, escala — negativa vira a peça —, `shade`); `HiddenObjectDefinition.gate`; `SceneDefinition.interactables`; `RoundRule.gated` e `GATED_BOUNDS` |
| `hidden-objects-interactions.ts` (novo) | o motor das peças, puro: estado inicial, estado atual, próximo estado (o último volta ao primeiro), "o portão está aberto?", a matriz da pose (a mesma conta do CSS), os limites da arte posada, o CSS da pose e o teste de toque nas áreas de cada estado |
| `hidden-objects-model.ts` | `SessionState.interactions`; ação `interact`; evento `interact`; o toque procura primeiro os objetos **listados e expostos**, depois as peças, depois é um toque livre; `start`/`restart` repõem as peças; `isExposed`; a escada de pistas lê as peças (`revealedPiece`) |
| `hidden-objects-difficulty.ts` | `interactionDepth`; o perfil da rodada ganha `gated` e `actions`; um objeto guardado nunca é "achado de relance"; `meetsRule` aplica `rule.gated` |
| `HiddenObjectsScene.tsx` · `hidden-objects.css` | as peças no plano da prancha (acima dela, abaixo dos primeiros planos), uma transform CSS por estado (transição com a duração da peça; nenhuma com movimento reduzido); áreas de cursor para o mouse; o contorno da peça com foco do teclado |
| `HiddenObjectsGame.tsx` | os botões "Na sala" (um por peça, `aria-expanded`, rótulo acessível; ocultos até o teclado chegar, então um chip visível); foco → contorno e câmera mostra a peça; a frase do preparar e das instruções |
| `scenes/explorer-studio.ts` · `scenes/explorer-observatory.ts` | as três peças de cada sala, os três objetos guardados, uma sósia de cada, as medidas da arte v3 |

**Câmera, gestos e controlador: idênticos à base byte a byte** (P04 da calibração). O
toque numa peça passa pelo mesmo reconhecedor TAP/DRAG/PINCH de sempre: um toque é
toque (abre), um arrasto é câmera (nunca abre), uma pinça é zoom. Não há listener novo
na viewport nem eventos aninhados.

Nada da plataforma compartilhada mudou (P01: `src/` fora de `src/games/hidden-objects/`
idêntico à base; `package.json`/`package-lock.json` idênticos).

## 4. Os arquétipos

| Arquétipo | Sala · peça | Pose aberta | Guarda |
| --- | --- | --- | --- |
| gaveta | Estúdio · gaveta da mesinha (sob a ampulheta) | desliza 56 su para fora | Apito (C) |
| tampa | Estúdio · tampa da caixinha de madeira (sobre o mapa) | vira para trás na dobradiça (escala −0,45, sombra 0,78) | Colar (C) |
| objeto que se afasta | Estúdio · cesto de mapas (pé da estante) | vai 178 su para o lado e inclina 3° | Cantil (B) |
| porta | Observatório · portinhola do lambri (ao lado do telescópio) | gira na dobradiça da direita (escala −0,28, sombra 0,62) | Foguete (C) |
| gaveta | Observatório · gaveta funda do pedestal da bancada | sai 76 su e cresce 5% | Ioiô (C) |
| cortina | Observatório · cortina sob a mesinha do microscópio | junta-se à esquerda nas argolas (escala 0,27) | Tambor (C) |

Todos os cinco arquétipos pedidos estão nas duas salas juntas; cada sala tem três
peças, uma por estação. Nenhuma física: só poses autorais entre dois estados. Arrasto
livre não existe: toque/clique/Enter/Espaço — nenhuma peça depende de arrastar.

## 5. Estúdio

- **Janela — gaveta da mesinha**: a mesinha redonda da ampulheta ganhou uma gaveta
  com puxador de latão. Dentro: o Apito, meio coberto por um bilhete dobrado.
- **Mesa — caixinha de madeira**: a caixinha que já estava na ponta do mapa ganhou uma
  tampa funda com fecho. Dentro: o Colar de contas, um lenço de seda por cima.
- **Estante — cesto de mapas**: o cesto de rolos que já estava no pé da estante virou
  uma peça (a mesma pintura). Atrás dele, no chão: o Cantil, com um mapa enrolado
  encostado.
- Sósias novas, fora das peças: apontador (Apito), ábaco (Colar), pandeiro (Cantil).

## 6. Observatório

- **Cúpula — portinhola do lambri**: o painel de lambri vazio à esquerda do pé do
  telescópio virou uma portinhola com maçaneta e duas dobradiças. Dentro: o Foguete de
  brinquedo numa prateleirinha, um paninho de tricô sobre a aleta.
- **Bancada — gaveta funda**: um pedestal de duas gavetas sob a ponta direita da
  bancada. Na de cima: o Ioiô, uma carta celeste dobrada por cima de um lado.
- **Arquivo — cortina da mesinha**: uma cortina curta em argolas sob a mesinha do
  microscópio. Na prateleira de baixo: o Tambor, uma baqueta e um feltro na frente.
- Sósias novas: chapéu de mago (Foguete), carretel (Ioiô), lata de biscoitos (Tambor).

## 7. Portões de revelação

- `gate` no objeto nomeia a peça. `isExposed(sala, peças, objeto)` = sem portão, ou a
  peça num estado `open`. O toque só tem como candidatos os objetos **listados e
  expostos**; o objeto guardado não é achado, não é anunciado e a lista não muda.
- O toque que cai na área de uma peça fechada (a área fechada cobre o objeto que ela
  guarda) **abre a peça** — a sensação é "toquei no armário e ele abriu".
- Aberta: mesma região, mesmo objeto, mesma semente. A arte aberta e a área de toque
  aberta nunca encostam no objeto (I23), então tocar no objeto acha o objeto e tocar na
  peça a fecha.
- Abrir outra peça não expõe nada (I11; mutante "abrir qualquer peça expõe tudo").
- Objeto guardado não listado continua cenário mesmo exposto (I12).

## 8. Dificuldade V3 — profundidade de interação

A régua de carga de busca **não mudou**: ela mede o objeto como ele aparece quando está
à vista (as medidas de um objeto guardado são as da auditoria com a peça aberta). A
interação é contada à parte, como **profundidade**: o número de ações autorais entre a
sala em repouso e o objeto (0 à vista, 1 atrás de uma peça). Não há peso inventado nem
"carga de interação" fictícia; o que a regra lê é uma contagem:

- `RoundProfile.gated` — quantos objetos listados estão atrás de uma peça; `actions` —
  quantas peças distintas a lista pede (hoje igual, uma peça guarda um objeto);
- `RoundRule.gated` — limites por dificuldade (`GATED_BOUNDS`): Fácil [0, 1],
  Médio [1, 2], Difícil [1, 3];
- um objeto guardado **nunca** conta como achado de relance (medido: 0% visível com a
  peça fechada — `visibleAtRest` na auditoria).

### Como os limites foram escolhidos (enumeração antes de travar)

| Configuração testada | Resultado | Decisão |
| --- | --- | --- |
| objetos guardados sem sósia; Difícil [1, 3] | Difícil pedia em média **menos** objetos guardados que o Médio (Estúdio 1,11 vs 1,18; Observatório 1,07 vs 1,16) — sem sósias eles quase nunca passavam no piso de sósias do Difícil | rejeitada |
| sem sósia; Difícil [2, 3] | Estúdio Difícil: Chave em 86% das rodadas, Chapéu em 0,4% (C24 quebra) | rejeitada |
| Fácil [1, 1] | Xícara em 2,2% das rodadas do Fácil | rejeitada |
| **uma sósia por objeto guardado; Fácil [0,1] · Médio [1,2] · Difícil [1,3]; Cantil B** | pressão sobe Fácil < Médio < Difícil nas duas salas; nenhum objeto acima de 3/4 nem abaixo de 1/20 | **adotada** |

O Cantil é B (85% visível, uma sósia, só um canto coberto — a definição de B); como C
ele empurrava a Xícara para 4,2% das rodadas do Fácil (abaixo do piso de variedade 1/20,
que não foi baixado).

### O espaço de rodadas aceito (`docs/archive/game03-interactions-04/calibration-report.md`)

| Sala · dificuldade | Candidatas | Aceitas | Busca mín · média · máx | Sósias/obj | Guardados por rodada (média · rodadas por contagem) |
| --- | --- | --- | --- | --- | --- |
| Estúdio · Fácil | 28 000 | 898 | 0,533 · 0,543 · 0,552 | 0,992 | 0,55 · 0: 408, 1: 490 |
| Estúdio · Médio | 35 280 | 3 153 | 0,552 · 0,585 · 0,612 | 1,059 | 1,30 · 1: 2 195, 2: 958 |
| Estúdio · Difícil | 44 800 | 8 001 | 0,612 · 0,679 · 0,799 | 1,325 | 1,55 · 1: 4 265, 2: 3 070, 3: 666 |
| Observatório · Fácil | 28 512 | 1 343 | 0,533 · 0,543 · 0,552 | 0,983 | 0,43 · 0: 767, 1: 576 |
| Observatório · Médio | 36 288 | 4 053 | 0,552 · 0,584 · 0,612 | 1,026 | 1,24 · 1: 3 063, 2: 990 |
| Observatório · Difícil | 47 775 | 19 413 | 0,612 · 0,694 · 0,792 | 1,312 | 1,47 · 1: 11 508, 2: 6 737, 3: 1 168 |

Os pisos de busca e de sósias são os da CALIBRATION-02A, derivados da base `3b122cf` —
iguais (C21). A ordem continua Fácil < Médio < Difícil em busca (faixas sem
sobreposição) **e** em pressão de interação (I22). Nenhuma rodada guarda mais da
metade da lista; nenhum Fácil pede duas peças; nenhum Difícil fica sem peça (I21).
Objeto guardado mais pedido: Cantil em 56,7% das rodadas do Médio do Estúdio; todos
abaixo de 3/4.

Carga de busca dos guardados (com a peça aberta): Apito 0,805 · Colar 0,655 · Cantil
0,431 · Foguete 0,751 · Ioiô 0,671 · Tambor 0,731.

## 9. Pistas

A mesma escada da Dificuldade V3, sem sistema paralelo:

| | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| estação | sim | sim | sim |
| 2º degrau | área (luz larga, fora do centro) + "procure na mesinha junto à janela…" | re-pista direta | contexto ("guardado …") |
| último degrau | **peça fechada**: halo na peça, câmera enquadra a peça, "Aqui está guardado: X — abra …"; **peça aberta**: o objeto, como sempre | direção (sugere "guardado", nunca a peça) | — |
| abre a peça? | **nunca** | **nunca** | **nunca** |
| ilumina/enquadra a peça? | só o último degrau | nunca | nunca |

O texto de contexto do Difícil não usa nenhuma palavra do nome da peça (I19). Nenhuma
pista mostra um objeto através de uma peça fechada.

## 10. Ciclo de vida das peças

| Momento | Peças |
| --- | --- |
| entrada / preparar | estado autoral de cada peça da sala escolhida |
| "Explorar" | estado autoral (nova semente, nova rodada) |
| durante a rodada | só o toque do Explorador ou o botão da peça muda — pan, zoom, pinça, roda, estações, teclas, pistas, render, redimensionar, girar, movimento reduzido, bandeja, achados e toques livres não mudam (I16) |
| "Recomeçar" | mesma lista, mesmas pistas, mesma semente; **peças fechadas** (I13) |
| "Praticar outra vez" | mesma sala, nova semente, peças fechadas (I14) |
| "Trocar de cena" / outra sala | o estado da sala anterior some; a sala nova começa autoral (I15) |

Nada disso é salvo; não existe "gaveta meio aberta" entre explorações.

## 11. Acessibilidade

- Toque, mouse e teclado: o toque/clique passa pelo reconhecedor de sempre; no teclado,
  cada peça tem um botão nativo (`type="button"`, Enter e Espaço), com
  `aria-label` (ex.: "Gaveta da mesinha da janela") e `aria-expanded` (aberta/fechada);
  o mira+Enter da viewport também abre a peça que estiver no centro.
- Os botões ficam fora da viewport (o controlador de teclado da viewport não os
  intercepta) e invisíveis até o Tab chegar: aí aparecem como um chip ("Cesto de
  mapas — O cesto de mapas está no lugar.") e a peça ganha um contorno tracejado na
  sala; a câmera traz a peça para a tela (sem mexer na peça).
- O anúncio é calmo e útil, na região viva de sempre: "A gaveta da mesinha está
  aberta." — nunca diz o que há dentro.
- Áreas de toque das peças nos pisos de sempre: ≥ 44 px efetivos no zoom máximo em
  todas as viewports, ≥ 32 px na capa do celular, enquadráveis fora do HUD (I24); a
  menor área é 30 su (a tampa aberta).
- Movimento reduzido: a peça muda de estado na hora (sem transição); o significado é
  o mesmo (I07; probe `int-reduced-motion`).
- As instruções lidas pelo leitor de tela citam as peças e a lista "Na sala".

## 12. Câmera e gestos

- Arrasto que começa numa peça → pan, a peça não muda (I08, mouse e toque; mutante
  "um arrasto abre a peça").
- Toque numa peça → a câmera não se move (I09, inclusive toque com tremor de 5 px;
  mutante "o toque também move a câmera").
- Pinça sobre uma peça → zoom, a peça não muda.
- No browser: arrasto de 24 movimentos → **0 commits do React**; cada passo de peça →
  **1 commit** (contador ligado ao gancho de DevTools que o próprio React chama). A
  câmera continua fora do React.

## 13. Arte v3 e auditoria

Pasta nova por sala (`…/v3/`), gerada pelos mesmos scripts (determinísticos — a
Observatório regenerada deu bytes idênticos); `v2/` público removido (o herói v1 do
Estúdio continua). Nenhum objeto antigo mudou de região, tier, nome ou pistas (I27).

- Cada peça: pintada em SVG no lugar, iluminada pela mesma passagem de luz da prancha,
  recortada no seu `rect` e enviada como WebP transparente (0,9–6,1 KB cada).
- A prancha pinta o que cada peça guarda, no lugar.
- A auditoria (`docs/archive/hidden-objects/<sala>/review/v3/fairness.json`) ganhou
  `visibleAtRest` e `visibleOpen` (visível com todas as peças fechadas / abertas) e mede
  borda, contraste e desordem de um objeto guardado com a sua peça aberta.

| Objeto guardado | Tier | Visível fechado | Visível aberto | Borda | Peça |
| --- | --- | --- | --- | --- | --- |
| Apito | C | 0% | 74,2% | 1,79 | gaveta (Estúdio) |
| Colar | C | 0% | 77,9% | 3,16 | tampa (Estúdio) |
| Cantil | B | 0% | 84,6% | 2,47 | cesto (Estúdio) |
| Foguete | C | 0% | 76,4% | 1,78 | porta (Observatório) |
| Ioiô | C | 0% | 76,7% | 3,91 | gaveta (Observatório) |
| Tambor | C | 0% | 61,3% | 3,09 | cortina (Observatório) |

Pisos de sempre, nenhum afrouxado: visível A ≥ 80%, B ≥ 60%, C ≥ 40%; borda ≥ 1,3;
lado mínimo × zoom máximo ≥ 44 px (F6). A auditoria pegou e corrigiu: o Ioiô com borda
1,15 (vermelho sobre madeira escura → laranja-claro com aro creme) e o Cantil com 1,12
(oliva → feltro claro); o Apito e o Colar com 34–36 su de lado (abaixo do F6 → 54 su, e
a gaveta e a tampa aprofundadas para guardá-los); três nomes de sósia que colidiam com
palavras de pistas existentes (canivete, carretel de linha, chapéu de festa/aniversário/
bruxa → apontador, carretel, chapéu de mago).

Para os objetos que já existiam, visível e borda são **idênticos** aos da v2; só a
desordem ao redor mudou onde uma peça ou sósia nova entrou no anel de 120 su (ex.:
Microscópio 0,107 → 0,145, Ratinho 0,132 → 0,161), e nenhuma peça fechada ou aberta
cobre um objeto que não guarda (`visibleAtRest` = `visibleOpen` = `visible`, I23).

Quadros de revisão por sala: `scene.webp` (fechado), `scene-open.webp` (aberto),
`regions.webp` (regiões + áreas de toque fechada em laranja e aberta em azul
tracejado), `pieces.webp` (cada peça: fechada · aberta · aberta com o objeto
contornado), `targets-zoom.webp`, `scene-grayscale.webp`.

## 14. Contrafactuais e mutantes

`hidden-objects-interactions-tests.mjs --counterfactuals`: a árvore passa 28/28; a
**base `ede2cb1` falha as 24 verificações `[interactions]` e mantém as 4
`[preserved]`**; cada mutante em memória falha o que nomeia:

| Mutante | Pego por |
| --- | --- |
| o objeto pode ser tocado através da gaveta fechada | I10 |
| abrir qualquer peça expõe todos os guardados | I11 |
| um guardado não listado vira achado quando exposto | I12 |
| "Recomeçar" mantém as gavetas abertas | I13 |
| um render fecha as gavetas | I05 |
| um arrasto de câmera abre a peça em que começou | I08 |
| um toque numa peça também move a câmera | I09 |
| o Difícil ilumina a gaveta exata | I19 |
| o Médio abre a tampa sozinho | I18 |
| a regra da rodada ignora a profundidade de interação | I20, I21 |
| todo Difícil guarda todos os objetos que pode | I01, I21 |
| o rótulo acessível de uma peça some | I06 |
| a área de toque de uma peça encolhe abaixo do piso | I24 |
| um ramo específico de peça no motor | I03 |
| a arte de todas as salas importada pela Home | I28 |
| uma peça cobre um objeto que não guarda | I23 |
| o Fácil abre a peça para o Explorador | I17 |
| pistas e peças abertas mudam o resultado | I25 |

As 28 verificações (I01–I28): contrato das peças nas duas salas · ids únicos e motor
guiado por dados (uma cópia da sala com peças renomeadas e deslocadas joga pela
cópia) · nenhum ramo de sala/peça no motor · estado inicial autoral · toque percorre os
estados · teclado · movimento reduzido · pan não abre · toque não faz pan · fechado não
acha · a peça certa expõe · não listado é cenário · Recomeçar · Praticar outra vez ·
outra sala · nada além do Explorador mexe nas peças · pista do Fácil · Médio sem
revelação · Difícil sem apontar · regra conta a profundidade · nenhuma rodada patológica
· ordem das dificuldades · justiça fechado/aberto · pisos de toque · sem
cronômetro/pontuação · resultados antigos · objetos de antes preservados · Home leve.

## 15. Verificações substituídas — e por quê

Cada uma foi reescrita para a verdade nova lendo cada árvore pela sua geração
("árvore interativa": existe `hidden-objects-interactions.ts`, `isInteractive` no
harness) — nenhum piso baixado, nenhuma tolerância afrouxada — e as contrafactuais de
cada suite continuam de pé (§16).

| Onde | Verdade antiga | Verdade nova | Por quê |
| --- | --- | --- | --- |
| helpers `find` (harness, calibração, multiscene, sondas de browser) | tocar o centro de um objeto listado o acha | um objeto guardado é achado abrindo a peça e tocando nele | o portão é o contrato novo; tocar através da peça agora **não** deve achar (I10) |
| harness `v3RoundKeeper` (força bruta independente) | tiers, relance, faixa, sósias | + `rule.gated`; guardado nunca é relance | a regra do produto ganhou um limite contado |
| harness/calibração/multiscene `decode` | as camadas são a arte essencial | + as imagens das peças (`.hos-piece`) | sem a porta, a sala mostraria o que a porta guarda |
| calibração C22 | desordem medida na sala em repouso | idem, mas o objeto guardado com a sua peça aberta | ele só é procurado quando está à vista |
| calibração: mutante "fairness cai abaixo do piso" | editava a auditoria v2 | edita a auditoria do kit que a sala envia (v3) | a v2 não é mais enviada; o mutante tinha ficado inerte |
| esqueleto H24 | campos exatos do objeto | + `gate` opcional, que precisa nomear uma peça da sala | campo novo do contrato |
| esqueleto H26 · experiência P01 | pool A6 · B7 · C10 | A6 · B8 · C12 | três objetos novos (um B, dois C) |
| esqueleto H28 · experiência E06 | o "Mostrar onde está" fica sobre o objeto | sobre a peça enquanto ela está fechada | o Fácil não revela através da peça |
| esqueleto H31 e listas de sessão | as listas fixas de Médio/Difícil eram rodadas V3 | Médio/Difícil agora exigem ≥ 1 guardado: a rodada mais próxima (Pinha → Colar no Médio, Pião → Cantil no Difícil) | as listas antigas deixaram de ser rodadas válidas |
| experiência E30 · multiscene M06 | kit v2 | kit v3 (as mesmas miniaturas sob a pasta nova) | arte nova é pasta nova |
| experiência P05 | 30 000 sorteios alcançam toda rodada | `max(30 000, 12 × rodadas)` sorteios | o Difícil agora tem 8 001–19 413 rodadas: 30 000 sorteios deixariam ~225 sem alcançar por acaso, não por viés; o teste fica mais forte, não mais fraco |
| multiscene: mutante "arte repintada sem nova auditoria" | editava a auditoria v2 do Observatório | edita a v3 | idem |
| multiscene: mutante "o Observatório usa o pool do Estúdio" | âncora `import type { HiddenObjectDefinition` | âncora `import type {` | o import da sala virou multilinha (ganhou `SceneInteractable`); a âncora antiga aparecia 0× e o mutante ficava `BROKEN` — mesma mutação, mesmos checks exigidos (M05, M16) |

## 16. Regressões

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 erros, 5 avisos (os 5 da base; nenhum novo) · 0 erros · limpo |
| `next build` | exit 0; mesmas rotas estáticas |
| suite **interactions** · `--counterfactuals` | **28/28** · base + 18 mutantes pegos (`HIDDEN_OBJECTS_INTERACTIONS_COUNTERFACTUALS_HOLD`) |
| suite calibration · `--counterfactuals` | 28/28 · base + 16 mutantes pegos |
| suite skeleton · `--counterfactuals` | 38/38 · base + 18 mutantes pegos |
| suite experience · `--counterfactuals` | 45/45 · bases `87f30d3` e `8fbd638` pegas, 31/31 mutantes pegos (`HIDDEN_OBJECTS_EXPERIENCE_COUNTERFACTUALS_HOLD`) |
| suite multiscene · `--counterfactuals` | 20/20 · base `58b5f08` pega (17/17 falham, 3/3 preservados de pé), 18/18 mutantes pegos (`HIDDEN_OBJECTS_MULTISCENE_COUNTERFACTUALS_HOLD`; um mutante teve a âncora restaurada, §15) |
| justiça das rodadas, duas salas (1 000 000 de sementes por dificuldade) | `ROUND_FAIRNESS_OK` × 2 — toda rodada alcançada, χ² uniforme (\|z\| ≤ 2,27), nenhum objeto fora da probabilidade exata (\|z\| ≤ 2,65) |
| relatório de calibração | `CALIBRATION_REPORT_OK`; constantes = derivadas |
| probe **interactions** | **42/42**, e cada cenário sozinho, processo e browser próprios: 42/42 |
| probes antigos | calibração 83/83 · multiscene 61/61 · Estúdio ⟨STUDIO_PROBE⟩ |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · `LOCK_GATE_COUNTERFACTUALS_HOLD` |
| readiness · watchdog · continuation · diagnostic boundary | 19/19 · 10/10 · 21/21 · MATCHES |
| Circuito (`memory-circuit-lifecycle-tests`) | 13/13 |
| Rota: terminal de resultado · ownership · coupling gate | 13/13 · 7/7 · 6/6 |
| CORE `validation-hygiene-tests.mjs` | ⟨CORE⟩ |
| DEEP `final-acceptance.mjs` | ⟨DEEP⟩ |
| dependências | `package.json` e `package-lock.json` idênticos à base; nenhuma dependência nova; `npm audit` 13 avisos (1 baixo, 2 moderados, 10 altos, 0 críticos) — idêntico à base `ede2cb1`, mesmo `package-lock.json` |

A multiscene `ms-mobile` pegou uma regressão real durante a missão: a frase nova do
preparar ("gavetas e portas se abrem…") numa linha própria empurrava o "Explorar" para
fora da tela do celular 390×844. Corrigido juntando-a à linha de controles que já
existia (`P02_EXPLORAR_IN_REACH` 12/12).

## 17. Bundle, assets e desempenho

Medido nos dois builds de produção, cada um com seu `.next`
(`docs/archive/game03-interactions-04/bundle-and-payload-vs-calibration-02a.json`,
gzip 9):

| | `ede2cb1` | agora | Δ |
| --- | --- | --- | --- |
| Home, JS e CSS iniciais | 773 682 B · 206 074 B | iguais (mesmos bytes) | 0 |
| Home, arte (com o Game 03 selecionado) | 46 arquivos · 528 352 B | iguais | 0 |
| Game 03, JS lazy | 82 338 B · 25 855 gz | 95 561 B · 29 419 gz | +13,2 KB · **+3,6 KB gz** (motor das peças, seis objetos com bancos de pistas, seis sósias, seis peças) |
| motor das peças (`hidden-objects-interactions.ts`, fonte) | — | 5 786 B · 2 212 gz | vai dentro do chunk do Game 03 |
| Game 03, CSS | 21 915 B | 23 252 B | +1,3 KB |
| Rota · Circuito · Babylon | — | idênticos | 0 |
| Entrada + preparar, arte | 7 · 349 110 B | 10 · 359 610 B | +10,5 KB (as três peças do Estúdio, a prancha v3) |
| Rodada do Estúdio desde a entrada, arte | 12 · 380 426 B | 15 · 394 086 B | +13,7 KB |
| Observatório escolhido depois, arte | 10 · 352 698 B | 13 · 356 922 B | +4,2 KB |
| peças por sala | — | Estúdio 8,0 KB (cesto 6,1 · tampa 1,0 · gaveta 0,9) · Observatório 4,7 KB (cortina 2,7 · porta 1,2 · gaveta 0,9) | |
| `public/assets/hidden-objects/` | 951 614 B | 1 006 646 B | +55 KB |

Desempenho (probe, build de produção): 0 commits do React durante um arrasto de 24
movimentos (desktop e celular); 1 commit por passo de peça; a câmera escreve o
`transform` só em `requestAnimationFrame` como antes (controlador intacto). Babylon não
entra; nenhuma dependência nova.

## 18. Limitações conhecidas

- **As peças têm dois estados** (fechada/aberta, no lugar/afastado). O contrato aceita
  mais, mas nenhuma sala usa; uma peça guarda um objeto.
- O tamanho de um objeto guardado é limitado pelo tamanho da peça: os guardados do
  Estúdio estão no limite do piso F6 (54 su).
- A arte das peças é posada em 2D (escala negativa simula a porta/tampa virando); não
  é perspectiva real. A revisão visual foi minha, não de um artista nem de crianças.
- A dica de que "gavetas e portas se abrem" está na linha de controles do preparar e
  nas instruções do leitor de tela; em telas baixas (≤ 700 px de altura) a linha de
  controles do preparar é escondida desde antes desta missão, então ali a descoberta
  depende só da arte (puxadores, maçanetas, prega do tecido) e do cursor de mão no
  desktop.
- A profundidade de interação é uma contagem (0/1), não um tempo: sem dados de pessoas,
  não se sabe quanto uma peça "custa" em segundos.
- O cursor de mão sobre as peças (desktop) vale para todas as dificuldades — revela que
  algo se abre, nunca qual peça guarda o objeto pedido.

## 19. Playtest humano — `TO_VALIDATE_IN_INTERACTIONS_04`

1. As peças **parecem** abríveis sem ninguém avisar? Quem joga descobre sozinho que a
   gaveta/porta/cortina se mexe — em quanto tempo?
2. Abrir uma peça é **gostoso** (movimento, som ausente, ritmo) ou parece um botão?
3. Alguém começa a **abrir tudo** sem pensar? (o comportamento que a missão quer
   evitar)
4. No **Médio**, a direção "… guardado" faz pensar em procurar dentro de algo? É óbvia
   demais?
5. No **Difícil**, o contexto ("guardado bem embaixo dos planetas…") é justo para
   chegar à peça certa, ou vira tentativa e erro?
6. No **Fácil**, a última pista que ilumina a peça e diz "abra …" ensina o gesto? A
   criança abre sozinha depois?
7. Algum objeto guardado (Apito, Colar, Cantil, Foguete, Ioiô, Tambor) é difícil de
   **reconhecer** dentro da peça?
8. Alguém se sente **enganado** ao tocar num objeto através da peça fechada (o toque
   abre a peça em vez de achar)?
9. No celular, abrir uma peça com o dedo atrapalha o arrastar da câmera (ou o
   contrário)?
10. Usuários de teclado/leitor de tela: a lista "Na sala" e os anúncios são claros e
    calmos?
11. "Recomeçar" fechando tudo parece certo — ou estranho?
12. "Pensar em paz" continua? Alguém se sentiu pressionado?

## 20. Próximo passo recomendado

Playtest humano com o protocolo da §19 nas duas salas, celular e computador. Depois,
uma missão curta de ajuste (quais peças ficam, pistas de contexto, talvez uma segunda
peça "vazia" por sala se as pessoas abrirem tudo por reflexo — ou menos peças se
abrirem pouco), a partir do que as pessoas mostrarem. O Game 03 não está travado.

## 21. Validação

```bash
npx eslint && npx tsc --noEmit && git diff --check
node tools/validation/hidden-objects-interactions-tests.mjs                     # 28/28
node tools/validation/hidden-objects-interactions-tests.mjs --counterfactuals   # base ede2cb1 + 18 mutantes
node tools/validation/hidden-objects-calibration-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-skeleton-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-experience-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-multiscene-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-calibration.mjs --out docs/archive/game03-interactions-04
node tools/validation/hidden-objects-round-fairness.mjs --scene <sala> --out DIR
node tools/assets/create_hidden_objects_scene.mjs --audit      # kit v3 do Estúdio + auditoria (peças incluídas)
node tools/assets/create_observatory_scene.mjs --audit         # kit v3 do Observatório + auditoria
node tools/assets/sync-hidden-objects-measured.mjs             # copia as medidas da auditoria para as salas
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-interactions-probe.mjs [--scenario int-desktop-studio,…] [--out DIR] [--json FILE]
node tools/validation/hidden-objects-calibration-probe.mjs
node tools/validation/hidden-objects-multiscene-probe.mjs
PLAYWRIGHT_DIR=… node tools/validation/hidden-objects-browser-probe.mjs
node tools/validation/validation-hygiene-tests.mjs    # CORE
node tools/validation/final-acceptance.mjs            # DEEP
```

Arquivo da missão: `docs/archive/game03-interactions-04/` — relatório de calibração,
justiça das rodadas por sala, registros dos probes (interactions, calibração,
multiscene, Estúdio), cenários sozinhos, bundle e carga contra `ede2cb1`, testemunhas
(`witnesses/`).
