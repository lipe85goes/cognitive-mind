# MindFlow — Game 03 Calibration 02A · Dificuldade V3 nas duas salas

Missão GAME03-CALIBRATION-02A. Branch `feat/game03-calibration-02a`, base exata
`3b122cf140303ebcec4f803f01a0a3205b7a57c6` (`docs(game03): CORE and DEEP in the
MULTISCENE-03 record; text review` — o estado final da GAME03-MULTISCENE-03).
**Sem merge, sem PR, sem terceira sala, sem Rota 2.0.**

**Veredito: `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`.** A dificuldade do Game 03 foi
recalibrada nas duas salas com um sistema só (Dificuldade V3): **Fácil** agora pede o
que o Difícil antigo pedia, com a ajuda generosa de sempre; **Médio** pede mais que o
Difícil antigo e troca nomes por pistas associativas, sem nunca revelar; **Difícil** é
um patamar novo — pistas indiretas, os objetos mais escondidos de cada sala, mais
sósias, nenhuma luz, nenhum enquadramento, nenhum nome antes do achado. Tudo o que uma
máquina verifica passou (§12). Se isso ficou **mais desafiador e ainda calmo** para
pessoas — "pensar em paz" — só o playtest humano diz (§16). A calibração não está
validada por humanos por ter sido pedida pelo dono; **o Game 03 não está travado.**

---

## 1. O que muda para quem joga

| | Fácil (5) | Médio (6) | Difícil (8) |
| --- | --- | --- | --- |
| Lista | imagem + nome | **pista associativa** (sem imagem, sem nome) | **pista indireta** (sem imagem, sem nome) |
| Objetos | carga de busca 0,533–0,552 (o miolo do Difícil antigo); no máx. 1 achado de relance; ≥ 1 C | 0,552–0,612 (acima da média do Difícil antigo); no máx. 1 achado de relance; ≥ 2 C | ≥ 0,612 (o máximo que qualquer rodada do Difícil antigo pedia); **nenhum** achado de relance; nenhum A; ≥ 4 C |
| Sósias por objeto | ≥ 0,75 | ≥ 0,794 | ≥ 1,25 |
| Pista (escada) | estação → área (luz) → "Aqui está" | estação → **a mesma coisa em outras palavras** (variante direta) → direção | estação → contexto |
| Luz / câmera | luz na área; a revelação enquadra | **nunca** luz, **nunca** enquadra | **nunca** luz, **nunca** enquadra |
| Nome | sempre | só no achado | só no achado |

Sem cronômetro, contagem regressiva, pressão de tempo, ranking, vidas, punição de
pontuação nem sequência: o resultado é o mesmo com ou sem pistas e erros (C20). Os
tamanhos 5/6/8, as salas, as estações, a câmera, os gestos, a escolha de sala, o
"Recomeçar" e o "Trocar de cena" são os mesmos.

Cada objeto tem agora um **banco de pistas** (5 variantes: 1 direta, 2 associativas, 2
indiretas). Cada exploração sorteia, junto com a lista, **qual variante cada objeto
conta** — da mesma semente da lista. Uma nova exploração pode contar o mesmo objeto de
outro jeito; "Recomeçar" conta igual.

## 2. Branch, base e commits

- Base verificada antes de qualquer edição: `git rev-parse HEAD` = `3b122cf…`, árvore
  limpa. A branch já existia no remoto, igual à base.
- Commits de checkpoint empurrados durante o trabalho (`475a4e6`, `587d38c`, `3ffc9d3`)
  e o commit final desta missão. Nenhum merge; `v06-portal-requires-lights` intocado.

## 3. Arquitetura

Um motor só, as duas salas como dados — nada no motor nomeia sala, estação ou objeto
(P02, M03).

| Arquivo | O que faz |
| --- | --- |
| `hidden-objects-scene.ts` | contrato: `ClueVariant {level, text}` (`direct` · `associative` · `indirect`), `TargetMeasure {visible, edge, clutter}`, `RoundRule {tiers: [mín, máx], maxPopOuts, minSearch, maxSearch, minDecoys}`; os presets V3 (lista, nível da pista da lista e da re-pista, escada, raio, tolerâncias); `ROUND_FLOORS` e `DECOY_FLOORS` derivados (§7) |
| `hidden-objects-difficulty.ts` (novo) | a régua: carga de busca por objeto (`searchParts`, `searchLoad`, `loadOf`), o perfil da rodada (`roundProfile`) e a regra (`meetsRule`) |
| `hidden-objects-clues.ts` (novo) | seleção semeada das pistas: `selectRoundClues(sala, dificuldade, semente, alvos)`, `clueAt` |
| `hidden-objects-rounds.ts` | candidatas estruturais (tamanho, estilo, distribuição pelas estações) filtradas pela regra medida; `listableIn` exige que o banco tenha os níveis que a lista conta |
| `hidden-objects-model.ts` | `SessionState.clues` sorteado no "start" e mantido até o fim; a re-pista; linhas da lista e anúncios com a pista sorteada |
| `HiddenObjectsGame.tsx` · `hidden-objects.css` | textos do preparar; a silhueta saiu |
| `scenes/explorer-studio.ts` · `scenes/explorer-observatory.ts` | bancos de pistas, medidas da arte v2, os novos objetos e sósias |

Nada da plataforma compartilhada mudou (P01: `src/` fora de `src/games/hidden-objects/`
idêntico à base; `package.json` e `package-lock.json` idênticos). Câmera, gestos e
controlador idênticos byte a byte (P04).

**Gavetas e portas interativas (futuro, não implementado).** A régua lê só dados por
objeto (tier, região, sósias e `measured`), e a rodada só o perfil. Um objeto dentro de
uma gaveta poderia, numa missão futura, contribuir com mais uma parte da carga (uma
ação para revelar) sem nenhum ramo no motor — nada aqui impede isso, e nada disso foi
feito.

## 4. Banco de pistas V2

230 pistas autorais (23 objetos × 5 variantes × 2 salas). Regras, todas verificadas
(C01–C03):

- 3 a 5 variantes por objeto, cada nível presente; frases completas;
- **nenhuma** pista diz o nome de um objeto da sala ou de uma sósia (nem por pedaço de
  palavra: "pinhão" tirou uma pista da Pinha, "manivela" uma do Gramofone,
  "pratinhos" uma da Balança — todas reescritas) e nenhuma se apoia em cor;
- associativa e indireta não usam palavra do rótulo do objeto; a indireta não usa
  palavra da sua variante direta (um ou dois passos de associação a mais);
- tamanho: lista (associativa/indireta) ≤ 48 caracteres; direta (só no banner da
  re-pista) ≤ 56;
- sem repetição na sala e sem quase-duplicata no banco (Jaccard de palavras < 0,34).

Exemplo (Cadeado, Observatório): direta "Tranca e só abre com a chave certa." ·
associativas "Tem um arco que se encaixa num corpo pesado." / "Os namorados o prendem
nas grades das pontes." · indiretas "Sem o segredo dele, o diário fica mudo." /
"Guarda o portão do sítio quando todos viajam."

## 5. Pistas semeadas

`selectRoundClues` escolhe, para cada objeto da lista, a variante da lista e (Médio) a
da re-pista: índice = hash FNV-1a de `id:propósito:nível` combinado com a semente da
rodada e passado pelo finalizador murmur3. É função só de (sala, dificuldade, semente):
a sala fixa os objetos e seus bancos, a dificuldade os níveis que a lista e a re-pista
contam. Consequências verificadas:

- mesma sala + dificuldade + semente → mesmas pistas (C04: 1 200 sorteios, um grafo de
  módulos novo, a tela);
- a pista de um objeto não depende dos colegas de rodada (C06);
- nenhuma pista muda com render, arrasto, zoom, roda, Pista, redimensionar/girar,
  movimento reduzido, bandeja, achado ou quadros ociosos; nenhum sorteio novo depois do
  "Explorar" (C07);
- "Recomeçar" mantém a lista e as pistas (C05) — o mesmo banner de re-pista;
- uma exploração nova pode contar o mesmo objeto de outro jeito, e toda variante é
  alcançada (C06; no browser, `cal-replay`);
- nenhuma fonte nova de aleatoriedade: a semente continua sendo um
  `crypto.getRandomValues` por "Explorar" (H25).

## 6. O modelo de dificuldade da rodada

Uma régua medida, grosseira de propósito — não um modelo de olhos de ninguém. Cada
objeto tem uma **carga de busca** em [0, 1], média ponderada de seis partes:

| Parte | 0 | 1 | Fonte |
| --- | --- | --- | --- |
| tier (peso 2) | A | C (B = 0,5) | autoria (o único que sabe se a parte identificadora aparece) |
| cobertura | visível 100% | visível 40% (piso C) | auditoria (`visible`) |
| mistura | borda 2,96 (P90 da arte v1) | borda 1,3 (piso de justiça) | auditoria (`edge`) |
| sósias | 0 | 2 | dados da sala |
| desordem | 0,096 (P10) | 0,196 (P90) | arte enviada, anel de 16–120 su (`clutter`) |
| tamanho | √área 188 su (P90) | 80 su (P10) | região |

Os pesos são um prior (tier 2, o resto 1), não um ajuste: não há dados de tempo de
pessoas. A rodada tem um **perfil**: carga média, achados de relance (carga < 0,325 —
meio caminho entre a média dos A e a dos B da arte v1), tiers, sósias por objeto,
lugares (estação × faixa de altura), passos semânticos da pista (0 imagem · 1 direta ·
2 associativa · 3 indireta). A regra de cada dificuldade lê o perfil; **nada nela cresce
com o número de objetos** (C12: dobrar a lista não muda o perfil; mudar a contagem não
muda o veredito; os objetos mais fáceis, em qualquer quantidade, nunca passam como
Médio ou Difícil). O relatório chama de "carga total" `n × (busca + passos/3)` — é
descritiva, não decide nada.

## 7. Pisos derivados e enumeração

Os números não são inventados: `hidden-objects-calibration-lib.mjs` mede a base
(`3b122cf`, arte v1, as duas salas) e deriva régua e pisos; C21 exige que as constantes
do produto sejam exatamente as derivadas.

- Sobre as **1 460 rodadas do Difícil V2** das duas salas, medidas com a régua: carga
  0,474–0,612, média 0,552. **Fácil V3 ≥ P25 = 0,533**, **Médio ≥ média = 0,552**,
  **Difícil ≥ máximo = 0,612**; cada faixa termina onde a próxima começa.
- Sósias por objeto no Difícil V2: P25 0,75 · média 0,794 · máximo 1,25 → os pisos.
- Para comparação, Fácil V2 pedia 0,213–0,372 e Médio V2 0,391–0,577.

Enumeração completa (`docs/archive/game03-calibration-02a/calibration-report.md`):

| Sala · dificuldade | Candidatas | Aceitas | Busca mín · média · máx | Sósias/obj | Relance (média) | Objetos alcançados |
| --- | --- | --- | --- | --- | --- | --- |
| Estúdio · Fácil | 14 553 | 414 | 0,533 · 0,543 · 0,552 | 1,003 | 0,96 | 23 |
| Estúdio · Médio | 15 876 | 1 693 | 0,552 · 0,586 · 0,612 | 1,088 | 0,94 | 23 |
| Estúdio · Difícil | 9 100 | 1 890 | 0,612 · 0,681 · 0,778 | 1,353 | 0 | 15 |
| Observatório · Fácil | 14 896 | 767 | 0,533 · 0,543 · 0,552 | 1,024 | 0,95 | 23 |
| Observatório · Médio | 16 464 | 2 886 | 0,552 · 0,583 · 0,612 | 1,110 | 0,87 | 23 |
| Observatório · Difícil | 10 000 | 5 899 | 0,612 · 0,677 · 0,780 | 1,338 | 0 | 17 |

As rejeitadas e o porquê (tiers, relance, abaixo do piso, no piso seguinte, poucas
sósias), os histogramas e a carga de cada objeto estão no relatório. A arte v1 sozinha
**não** sustentava o Difícil novo (0 rodadas): por isso a arte v2 (§8).

## 8. Arte v2: mudanças dirigidas e reauditoria

Pasta nova por sala (`…/v2/`), gerada pelos mesmos scripts; nada sobrescrito. Nenhum
objeto existente mudou de lugar, nome, tier ou região (P03); nenhuma área de toque
diminuiu (C15).

- **Estúdio**: cinco objetos encaixados no que a sala já tinha — Caracol (C, Janela),
  Pião (C, Janela), Tesoura (C, Mesa), Pinha (B, Mesa), Gaita (C, Estante) — e onze
  sósias novas (cesta de arame, roseta entalhada, peão de xadrez, medalha, açucareiro,
  tampa de pote, compasso de pontas, abacaxi de madeira, folha emoldurada, caixa de
  fósforos, estojo de óculos).
- **Observatório**: Caneca (C, Cúpula), Ferradura (B, Cúpula), Esquadro (C, Bancada),
  Cavalo-marinho (C, Arquivo), Cadeado (C, Arquivo) e onze sósias novas (vaso e pote de
  cerâmica, luvas e meia de lã, flâmula, bola de borracha, peça de xadrez, fechadura,
  caleidoscópio, transferidor, medalhão).
- Camuflagem justa: tons do entorno, oclusão parcial por objetos da cena, cenário
  inofensivo; nunca escuridão, nunca escondido por inteiro.

A auditoria (renderiza a sala com e sem cada objeto) pegou e corrigiu: o Pião com
borda 1,27 e o Cadeado com 1,24 (abaixo de 1,3 → um contorno claro; o do Cadeado depois
atenuado de 3,53 para 1,90 para continuar C); a Caneca e o Cadeado com 24,8 e 29,0 px
na tela de referência (< 32 px → regiões e arte maiores, 78×80 e 60×78 su); uma sósia
sobre a Ferradura (movida). Resultado: todos acima dos pisos de sempre — visível A ≥ 80%,
B ≥ 60%, C ≥ 40%; borda ≥ 1,3; menor visível 53,8% (Estúdio) / 57,8% (Observatório),
menor borda 1,32 / 1,41 (C14, M16, auditorias em
`docs/archive/hidden-objects/<sala>/review/v2/fairness.json`, com o hash da prancha).
Revisão visual nos quadros `targets-zoom.webp` e `scene.webp` de cada sala.

Do kit v1 ficou só `explorer-studio/v1/hero.webp`: é a arte de intro/transição que a
plataforma (`worldVisuals.ts`) mostra para o Game 03 — fora do escopo desta missão.

## 9. Sósias V2 e variedade

A pressão de sósias sobe com a dificuldade nas duas salas (C13): por objeto, Estúdio
1,003 · 1,088 · 1,353 e Observatório 1,024 · 1,110 · 1,338; nenhuma rodada abaixo do
piso. Um toque no centro de qualquer sósia nunca acha nada (C15).

A enumeração achou um defeito real: no Observatório **toda** rodada Difícil pedia a Maçã
e o Ratinho (só os dois tinham duas sósias, e o piso pedia ≥ 10 sósias em 8 objetos).
Três sósias novas (caleidoscópio → Luneta, transferidor → Esquadro, medalhão → Cadeado)
abriram o espaço: de 1 467 para 5 899 rodadas, e o objeto mais pedido caiu de 100% para
62,7%. C24 agora fixa a variedade nas duas salas e nas três dificuldades: nenhum objeto
em mais de 3 de cada 4 rodadas, nenhum objeto listável em menos de 1 em 20 (Estúdio
Difícil: Gaita 70,1% no máximo; Fácil: Xícara 6,3% no mínimo).

No Difícil, os achados de relance viram cenário: no Estúdio, os 6 A e Pena e Bolsa
(B de carga baixa); no Observatório, os 6 A. O relatório lista "só cenário aqui".

## 10. Justiça das rodadas

`hidden-objects-round-fairness.mjs` (adaptado à V3: limites de tier, participação exata
por tier, exposição por fração de rodadas) roda a seleção real sobre 1 000 000 de
sementes por dificuldade: `ROUND_FAIRNESS_OK` nas duas salas — toda rodada válida
alcançada, χ² uniforme (|z| ≤ 1,52), nenhum objeto fora da probabilidade exata
(|z| ≤ 2,96), visibilidade média caindo Fácil → Médio → Difícil (88,3% → 85,7% → 81,4%
no Estúdio; 85,9% → 84,7% → 81,5% no Observatório). Relatórios em
`docs/archive/game03-calibration-02a/rounds-<sala>/`.

## 11. Evidência no browser

Build de produção (`next build && next start -p 3100`), Chromium headless, sementes
plantadas em `crypto.getRandomValues`; o que a tela mostra é comparado com o que a
fonte sorteia. `hidden-objects-calibration-probe.mjs` (novo):

| Cenário | Checks | O que cobre |
| --- | --- | --- |
| `cal-desktop` 1440×900 | 36/36 | cada sala: Fácil (imagem + nome; escada até "Aqui está" com o halo), Médio (pistas associativas da semente; estação → re-pista direta → direção; nunca luz, nunca enquadra, nunca nomeia), Difícil (pistas indiretas; estação → contexto; nada de nome até o achado; o achado diz o nome) e Difícil jogado até o fim, resultado com sala e semente |
| `cal-mobile` 390×844, toque | 24/24 | Observatório Difícil e Estúdio Médio: cada pista inteira no seu cartão da faixa, recolher mantém, arrasto e pinça, escadas, achados, banner da re-pista cabe, sem rolagem horizontal |
| `cal-landscape` 844×390, toque | 9/9 | "Explorar" no alcance, pistas inteiras, celular em pé no meio da rodada e de volta (a rodada e as pistas ficam), achado |
| `cal-reduced-motion` | 9/9 | Observatório Médio: estações cortam, re-pista e direção sem luz, pistas mantidas |
| `cal-replay` | 5/5 | mesma semente em duas visitas novas → mesmas pistas; outra semente conta um objeto em comum de outro jeito; "Recomeçar" mantém pistas e re-pista sem sortear de novo |
| **total** | **83/83** | e cada cenário sozinho, processo e browser próprios: **83/83** (`calibration-scenarios-alone.json`) |

Os probes anteriores, com as verificações substituídas reescritas (§15): multiscene
**61/61**, Estúdio **104/104**. Registros (`calibration-probe-run.json`,
`multiscene-probe-run.json`, `studio-browser-probe-run.json`) e 15 testemunhas em
`docs/archive/game03-calibration-02a/`; a arte v1 e v2 lado a lado em `art-v1-vs-v2.webp`.

## 12. Regressões

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 erros, 5 avisos — todos já na base, que tinha 6 (nenhum novo; um saiu) · 0 erros · limpo |
| `next build` | exit 0; mesmas rotas estáticas |
| suite calibration · `--counterfactuals` | 28/28 (15 calibration, 13 preserved) · base + 16 mutantes pegos |
| suite skeleton · `--counterfactuals` | 38/38 · base + 18 mutantes pegos |
| suite experience · `--counterfactuals` | 45/45 · 2 bases + 31 mutantes pegos |
| suite multiscene · `--counterfactuals` | 20/20 · base + 18 mutantes pegos |
| justiça das rodadas, duas salas | `ROUND_FAIRNESS_OK` × 2 |
| relatório de calibração | `CALIBRATION_REPORT_OK`; constantes = derivadas |
| probes de browser | calibração 83/83 (e sozinhos) · multiscene 61/61 · Estúdio 104/104 |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · `LOCK_GATE_COUNTERFACTUALS_HOLD` |
| readiness · watchdog · continuation · diagnostic boundary | 19/19 · 10/10 · 21/21 · MATCHES |
| Circuito (`memory-circuit-lifecycle-tests`) | 13/13 |
| Rota: terminal de resultado · ownership · coupling gate | 13/13 · 7/7 · 6/6 |
| CORE `validation-hygiene-tests.mjs` (em `0d9ae81`) | 15/15 validadores (`CORE_BATTERY_PASSED`); imutabilidade: nada criado, apagado ou alterado, `git status` idêntico (`VALIDATION_CHECK_IS_READ_ONLY`) |
| DEEP `final-acceptance.mjs` (em `0d9ae81`) | estrutural 1080/1080, contínuo 270/270, recovery OK, sem exceções; evidência MATCHES |
| dependências | `package.json` e `package-lock.json` idênticos à base; `npm audit` igual à base: 13 avisos (1 baixo, 2 moderados, 10 altos), 4 em produção (2 moderados, 2 altos) |

## 13. Bundle e assets

Medido nos dois builds de produção, cada um com seu `.next`
(`bundle-and-payload-vs-multiscene-03.json`, gzip 9):

| | `3b122cf` | agora | Δ |
| --- | --- | --- | --- |
| Home, JS e CSS iniciais | 773 682 B · 206 074 B | iguais | 0 |
| Home, arte (com o Game 03 selecionado) | 46 arquivos · 528 352 B | iguais | 0 |
| Game 03, JS lazy | 55 599 B · 17 996 gz | 82 338 B · 25 855 gz | +26,7 KB · **+7,9 KB gz** (230 pistas e a régua) |
| Game 03, CSS | 22 010 B | 21 915 B | −95 B (a silhueta saiu) |
| Rota · Circuito · Babylon | — | idênticos | 0 |
| Entrada + preparar, arte | 7 · 343 266 B | 7 · 349 110 B | +5,8 KB |
| Rodada do Estúdio desde a entrada, arte | 12 · 377 536 B | 12 · 380 426 B | +2,9 KB |
| Observatório escolhido depois, arte | 10 · 333 740 B | 10 · 352 698 B | +19,0 KB |
| `public/assets/hidden-objects/` | 880 528 B | 951 614 B | +71 KB (kit v1 removido, exceto a arte de intro) |

## 14. Contrafactuais e mutantes

`hidden-objects-calibration-tests.mjs --counterfactuals`: a árvore passa tudo; a
**base `3b122cf` falha as 15 verificações `[calibration]` e mantém as 13
`[preserved]`**; cada mutante em memória falha o que nomeia:

| Mutante | Pego por |
| --- | --- |
| a pista é sempre a mesma variante | C06 |
| as pistas são sorteadas de novo a cada render | C04, C07 |
| a dificuldade é ignorada (tudo pela regra do Fácil) | C09, C10, C11 |
| o Difícil aceita rodadas triviais | C11, C10 |
| só o número de objetos decide a dificuldade | C12 |
| o Médio ganha a revelação exata | C16 |
| o Difícil lista a pista direta | C03, C23 |
| o Difícil nomeia os objetos antes do achado | C17 |
| a pressão de sósias é ignorada | C13 |
| uma sala escapa da calibração | C18, P02 |
| um limiar de arte é afrouxado para um alvo passar (a âncora de justiça da régua 1,3 → 1,0) | C21 |
| um alvo cai abaixo do piso (borda 1,21 na auditoria) | C14 |
| uma medida é registrada melhor que a auditoria da arte | C22 |
| o piso de sósias do Difícil só alcançado pelos mesmos objetos | C24, C21 |
| uma pista diz o nome do objeto | C03 |
| uma pista dita duas vezes | C02 |

C05 e C07 são `[preserved]`: a pista única da base também nunca mudava durante a
sessão; os mutantes provam que as verificações não são vazias.

## 15. Verificações substituídas — e por quê

A missão mudou de propósito o que algumas verificações antigas fixavam. Seguindo o
precedente da EXPERIENCE-02 e da MULTISCENE-03, cada uma foi **reescrita para a verdade
nova lendo cada árvore pela sua geração** ("árvore calibrada": existe
`hidden-objects-clues.ts`) — nenhuma tolerância afrouxada, nenhum piso baixado — e
documentada no cabeçalho da suite:

- **skeleton**: H24 (banco de pistas e medidas no lugar da pista única), H25/H29 (Médio
  lista pistas, não silhuetas), H26 (limites de tier; pool A6·B7·C10); as listas que as
  verificações de sessão jogam são rodadas V3 que contêm a Lupa (as listas fixas da V2
  não são rodadas V3); um mutante re-ancorado;
- **experience**: E03 (Dificuldade V3), E04/E05/P02 (banco e pista sorteada), E07
  (segundo toque = re-pista: sem luz, câmera parada), E30 (kit v2; v1 só a intro), E32
  (o Relógio, que todo Difícil de toda geração lista), P01 (pool), P03 (força bruta
  independente com a regra medida, `v3RoundKeeper`), P05 (exposição pela regra, piso
  1/20 e teto 3/4), P12 (o que cada estilo de lista pode mostrar); sete mutantes
  re-ancorados;
- **multiscene**: M02, M15, M16, M20 (congelado na V3); M06 mantém o Estúdio exatamente
  como a EXPERIENCE-02 deixou onde a calibração não alcançou (câmera, controlador,
  moldura e camadas, cada objeto e sósia antigos, hit test, a arte de intro byte a byte)
  e deixa rodadas, sessões e arte para a suite de calibração; quatro mutantes
  re-ancorados;
- **probes**: Estúdio X01/X02/X10/X12/R01 e multiscene P06 leem a pista que a semente
  conta; `hidden-objects-round-fairness.mjs` lê a V3.

Os contrafactuais de todas continuam de pé (§12).

## 16. Playtest humano — `TO_VALIDATE_IN_CALIBRATION_02A`

Para pessoas, nas duas salas, em celular e computador:

1. O **Fácil** novo ainda é acolhedor para quem chega? A escada de pistas (com luz e
   "Aqui está") resolve quando alguém empaca?
2. O **Médio** é claramente mais difícil que o Fácil e que o Difícil antigo — e as
   pistas associativas são justas (dá para chegar no objeto pensando)?
3. A **re-pista** do Médio ("em outras palavras…") ajuda sem estragar a descoberta?
4. O **Difícil** é um desafio novo e satisfatório, ou frustrante? Alguma pista indireta
   é obscura demais, ambígua ou cultural demais para a faixa de idade?
5. Alguém se sentiu **pressionado** ou ansioso? ("pensar em paz")
6. As **sósias** confundem de um jeito justo — e, depois de achar o objeto certo, a
   diferença parece óbvia?
7. Algum objeto novo (Caracol, Pião, Tesoura, Pinha, Gaita, Caneca, Ferradura, Esquadro,
   Cavalo-marinho, Cadeado) é difícil demais de **reconhecer** (não só de achar)?
8. Repetindo o Difícil, as rodadas parecem **variadas**?
9. As pistas cabem e se leem bem no celular (faixa de cartões)?
10. Quanto tempo leva uma rodada de cada dificuldade (para calibrar os pesos da régua
    com dados reais na próxima missão)?

## 17. Limitações e riscos

- **Os pesos são um prior**, não um ajuste: sem tempos de busca de pessoas, a régua
  ordena rodadas, não prevê segundos. O playtest (pergunta 10) é o que pode calibrá-la.
- `clutter` é uma medida grosseira (fração de gradiente forte num anel); `edge` e
  `visible` são as da auditoria de sempre.
- O Fácil pede no máximo 1 achado de relance; objetos A viram raros no Fácil e no Médio
  e somem do Difícil — o que a missão pediu, mas muda o "aquecimento" que existia.
- A variedade do Difícil depende das sósias: o objeto mais pedido está em 70% das
  rodadas do Estúdio; C24 impede que isso passe de 75%.
- A arte segue gerada por script (SVG → sharp); a revisão visual foi minha, não de um
  artista nem de crianças.
- A arte de intro do Estúdio é a do kit v1 (a plataforma a referencia; mudar
  `worldVisuals.ts` estava fora do escopo).

**Próximo passo**: playtest humano com o protocolo da §16; depois, uma missão de ajuste
fino (pesos, pistas específicas, sósias) a partir do que as pessoas mostrarem.

## 18. Arquivos da plataforma compartilhada alterados

Nenhum. Tudo fica em `src/games/hidden-objects/`, `public/assets/hidden-objects/`,
`tools/` e `docs/` (P01).

## 19. Validação

```bash
npx eslint && npx tsc --noEmit && git diff --check
node tools/validation/hidden-objects-calibration-tests.mjs                     # 28/28
node tools/validation/hidden-objects-calibration-tests.mjs --counterfactuals   # base + 16 mutantes
node tools/validation/hidden-objects-calibration.mjs --out docs/archive/game03-calibration-02a
node tools/validation/hidden-objects-skeleton-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-experience-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-multiscene-tests.mjs [--counterfactuals]
node tools/validation/hidden-objects-round-fairness.mjs --scene <sala> --out DIR
node tools/assets/create_hidden_objects_scene.mjs --audit                      # arte v2 do Estúdio + auditoria
node tools/assets/create_observatory_scene.mjs --audit                         # arte v2 do Observatório + auditoria
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-calibration-probe.mjs [--scenario cal-desktop,…] [--out DIR] [--json FILE]
node tools/validation/hidden-objects-multiscene-probe.mjs
PLAYWRIGHT_DIR=… node tools/validation/hidden-objects-browser-probe.mjs
node tools/validation/validation-hygiene-tests.mjs    # CORE
node tools/validation/final-acceptance.mjs            # DEEP
```
