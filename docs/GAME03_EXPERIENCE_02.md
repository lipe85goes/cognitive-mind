# MindFlow — Game 03 Experience 02 · Estúdio das Descobertas (experiência V2 + pool de alvos V1)

Missão GAME03-EXPERIENCE-02. Branch `feat/game03-experience-02`, base
`87f30d3e3cb39e40bef415a1a9312150fee7b78d` (`feat(game03): add discovery studio
skeleton`). Integração canônica: `v06-portal-requires-lights` — **sem merge nesta
missão**. Trabalho recuperado: `8fbd638` (experiência V2, listas fixas); checkpoint
do pool de alvos: `ff86f0b`.

**Veredito: `TECHNICAL_PASS_HUMAN_PLAYTEST_REQUIRED`.** Tudo o que uma máquina
consegue verificar passou: suites, contrafactuais, mutantes, probe de browser no
build de produção (cada cenário também sozinho), relatório de justiça das rodadas,
regressões, build e orçamento (§6–§9). Se o Estúdio é gostoso, justo e calmo para
pessoas — sobretudo 60+ e no celular — só o Playtest Humano 02 diz (§10). **Nada
aqui está travado.** Rota Estratégica, Circuito de Memória e o contrato de
plataforma v1 seguem travados; a única mudança compartilhada é de classe 5 (§4.4).

---

## 1. O que existe

Pela Home, no slot da antiga Trilha: transição → intro → preparar (Fácil 5 ·
Médio 6 · Difícil 8 objetos) → **"Explorar" sorteia a rodada** — quais objetos do
pool de 18 a lista pede — → cena → arrastar, aproximar (roda, pinça, + e −),
estações Janela/Mesa/Estante, Recentrar → tocar → achado com anel calmo e o nome
→ Pista (degraus por dificuldade) → lista completa → "Estúdio explorado" →
"Concluir exploração" → resultado ("Objetos encontrados", "Modo") → "Praticar
outra vez" (nova exploração, nova lista) ou "Continuar jornada". "Recomeçar" refaz
a **mesma** lista do começo. Os objetos que a rodada não pede continuam pintados
na sala e não respondem ao toque; nada anuncia quais são elegíveis. Sem
cronômetro, vidas, erros, ranking ou placar que diminua.

## 2. Recuperação e verificação independente (relatório A)

- A sessão começou com o worktree vazio: o trabalho da EXPERIENCE-02 existia só
  localmente. Nada foi reconstruído a partir da base: o trabalho foi publicado como
  `8fbd638`, o worktree avançou (fast-forward) até ele e foi verificado antes de
  qualquer mudança. Um reinício de container no meio da missão não perdeu nada —
  o checkpoint `ff86f0b` foi publicado em seguida.
- O que a missão anterior afirmava, medido de novo em `8fbd638`:

| Afirmação | Medido em `8fbd638` |
| --- | --- |
| skeleton 38/38 | 38/38 |
| contrafactual do skeleton 30/30 + 8/8, 18/18 mutantes | base `f9254429`: 30/30 `[contract]` falham, 8/8 `[preserved]` seguram; 18/18 mutantes pegos |
| experiência 32/32 | 32/32 (15 `[experience]` + 17 `[preserved]`) |
| contrafactual da experiência 15/15 + 17/17, 18/18 mutantes | base `87f30d3`: 15/15 falham, 17/17 seguram; 18/18 mutantes pegos |
| Difficulty V2, pistas semânticas, escada de pistas, HUD, arte v1 | cobertos pelos checks `[experience]` acima e pelo probe |
| assets essenciais ~268 KB, entrada ~364 KB (orçamento 1,3 MB) | 268,3 KB e 363,8 KB de 1270 KB |
| probe de browser (Fácil/Médio/Difícil, celular, reduced motion) | 75/76 — X13 falhou por defeito do probe (§3.3); a releitura da Home esperava a resposta esperada (§3) |
| build | `next build` exit 0 |

## 3. Home/reload: causa raiz (relatório B)

### 3.1 Sintoma e causa

No probe da base, depois de uma exploração ao lado de um resultado antigo da
Trilha e de recarregar a Home, a leitura às vezes mostrava a **Rota Estratégica**
selecionada, e não o Estúdio (o resultado jogável mais recente).

A Home é estática (prerenderizada): o HTML do servidor seleciona sempre o mundo
padrão, a Rota. O histórico salvo só seleciona outro mundo num efeito de montagem
de `src/app/page.tsx`, **depois** da hidratação — o commit 1 do React é a
hidratação (a Rota, igual ao HTML), o commit 2 aplica o histórico (o Estúdio). O
probe da base lia em `networkidle` + 400 ms, um instante que não tem ordem nenhuma
com a hidratação: com a CPU ocupada, a leitura cai antes do commit 1, ou entre o 1
e o 2, e vê o padrão do servidor. O probe recuperado (`8fbd638`) trocou isso por
uma espera pela própria resposta esperada (até 6 s), que esconde a corrida em vez
de explicá-la.

### 3.2 Evidência

Cenário `reload-race` do probe (build de produção; o dispositivo guarda
`[hidden-objects, number-trail]`; CPU desacelerada por CDP
`Emulation.setCPUThrottlingRate` até a corrida aparecer;
`docs/archive/game03-experience-02/browser-probe-run.json` → `metrics.reloadRace`):

| CPU | Leitura da base (`networkidle` + 400 ms) | Leitura hidratada | Commits da hidratada |
| --- | --- | --- | --- |
| 1× | Estúdio (4 commits) | Estúdio | 1 Rota → 2 Estúdio |
| 20× | Estúdio (4 commits) | Estúdio | 1 Rota → 2 Estúdio |
| 50× | **Rota (1 commit: hidratada, histórico ainda não aplicado)** | Estúdio | 1 Rota → 2 Estúdio |
| 100× | **Rota (0 commits: antes da hidratação)** | Estúdio | 1 Rota → 2 Estúdio |

RR1: o HTML do servidor seleciona a Rota. RR2: a leitura da base pode cair antes
da hidratação, com o Estúdio guardado no aparelho. RR3: a Home hidratada seleciona
o resultado jogável mais recente em toda velocidade, sempre na ordem "commit 1 =
padrão do servidor, commit seguinte = histórico".

### 3.3 Classificação e correção

**Defeito do probe; o comportamento do produto estava certo.** Nenhuma mudança de
produto. No probe: toda leitura da Home espera a página hidratar e assentar — ≥ 1
commit do React (contado pelo stand-in do hook do DevTools, que o React chama em
produção também) e depois 800 ms sem commit — e **nunca** espera a resposta que o
check quer; o resultado antigo entra pelo `storageState` do contexto (nenhum
script o escreve). Mesma família: X13 arrastava sempre para a direita, o que não
move uma câmera encostada na parede da Janela; agora arrasta para o meio da sala.

## 4. Experiência V2 (relatório C)

### 4.1 Dificuldade V2: muda o que se diz, não o tamanho do alvo

| | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| Objetos por rodada | 5 | 6 | 8 |
| Mistura de tiers | 3A + 2B | 1A + 3B + 2C | 1A + 3B + 4C |
| A lista mostra | imagem + nome | silhueta + nome | para que serve (o nome só depois de achado) |
| Pista 1 | estação (a câmera vai até ela) | estação | estação |
| Pista 2 | `hintRegion` + halo (raio 240 su) | halo largo (raio 400 su) | `hintContext` em palavras ("está …") |
| Pista 3 | "Mostrar onde está" (enquadra o objeto) | `hintDirection` em palavras ("olhe …") | — (a escada para no contexto) |
| Tolerância toque / mouse | 16 / 8 px | 12 / 6 px | 10 / 5 px |

Médio e Difícil nunca apontam o objeto; o Difícil nunca acende nada na sala, nunca
desliza a câmera até o objeto e nunca o nomeia antes do achado (E07–E10, P11). As
tolerâncias são as do skeleton: a dificuldade nunca vem de alvos menores.

### 4.2 Pistas semânticas e achado

- Cada objeto tem `clue` (para que serve, sem nomeá-lo nem nomear outro da lista),
  `hintRegion`, `hintDirection` e `hintContext` (E04, P02). Ex.: Pena — "Escrevia
  molhando a ponta na tinta."; Gaiola — "Casinha com grades para um passarinho."
- Achado: anel calmo + selo + etiqueta com o nome no próprio objeto; a linha da
  lista passa a mostrar o nome (no Difícil, com a pista que ele respondeu);
  `aria-live` "Encontrou: …". Reduced motion: liga/desliga em degraus, sem fade nem
  escala (E19, E31).
- HUD: painel lateral no desktop que recolhe para um trilho; bandeja no celular
  que recolhe para uma linha (a sala cresce); coluna de 15,5 rem com a lista
  rolando dentro dela no celular deitado (E28).

### 4.3 Arte v1

`public/assets/hidden-objects/explorer-studio/v1/`: janela, prancha 3200×1600,
dois primeiros planos, 18 miniaturas e a arte de transição, geradas por
`tools/assets/create_hidden_objects_scene.mjs` (SVG → WebP, sem Blender). O grão
agora tem semente (mulberry32 + Box–Muller): o mesmo script dá os mesmos bytes.
`--audit` mede cada alvo na sala composta e grava
`docs/archive/hidden-objects/explorer-studio/review/v1/fairness.json` (com o SHA da
prancha); 11 sósias pintados, cada um longe do alvo que imita (E16, E17).

### 4.4 Mudança compartilhada (classe 5 do lock)

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/engine/rewards.ts` | `ResultPresentation` (`scoreLabel`, `detailKeys`, `modeLabels`) opcional por jogo + `getResultPresentation` | o segundo consumidor mostra "Objetos encontrados" e "Modo: Difícil" em vez de "Registro da prática" e de detalhes técnicos |
| `src/lib/detail-labels.ts` | `formatResultDetails(details, apresentação)` | uma lista de detalhes só, com os rótulos de sempre |
| `src/components/RewardResultModal.tsx` | lê a apresentação; não nomeia jogo nenhum | modal agnóstico |
| `src/components/worlds/worldVisuals.ts` | arte de transição/intro do Estúdio aponta para o kit v1 | metadado do próprio Estúdio |

Sem `presentation`, um jogo aparece exatamente como antes — Rota, Circuito,
legados e resultados antigos da Trilha (E15). Nenhum contrato do §4 do lock mudou;
o gate segue 18/18; a nota pós-lock está no §3 de
`docs/GAMEPLAY_PLATFORM_LOCK_V1.md`.

## 5. Pool de alvos V1 (relatório D)

### 5.1 O pool

18 objetos autorais, 6 A / 6 B / 6 C; toda estação tem todos os tiers. As posições
são literais na cena (P01): a sala é sempre a mesma, só a lista muda.

| Estação | A | B | C |
| --- | --- | --- | --- |
| Janela (5) | Ampulheta, Guarda-chuva | Binóculo | Chave antiga, Gaiola |
| Mesa (7) | Lupa, Borboleta | Bússola, Pena, Chapéu | Relógio, Xícara |
| Estante (6) | Barco em miniatura, Globo | Lanterna, Bolsa de couro | Câmera, Estatueta |

Dos 8 novos, dois foram pintados agora junto à janela (guarda-chuva; gaiola, com
hera por cima) e seis eram objetos de cena da arte v1 promovidos a alvos (xícara,
pena, borboleta, chapéu, globo, bolsa). A promoção não mexeu na pintura: o único
trecho da prancha que mudou foi x 961–1065, y 295–1197 (guarda-chuva, gaiola,
hera). Depois, a auditoria medida pediu: xícara B → C (54 % visível atrás do livro
aberto), pena C → B (100 % visível, borda 2,93:1), bordas claras de material no
chapéu e na bolsa (borda 1,18 e 1,25 → 1,91 e 2,25) e bronze mais claro na gaiola
(1,32 → 1,53).

| Objeto | Tier | Estação | Região (su) | Pista (`clue`) |
| --- | --- | --- | --- | --- |
| Guarda-chuva | A | Janela | rect 986,930 64×258 | Abre-se para proteger da água do céu. |
| Gaiola de passarinho | C | Janela | rect 960,446 76×142 | Casinha com grades para um passarinho. |
| Xícara de chá | C | Mesa | rect 1380,950 100×60 | Leva o chá quentinho até a boca. |
| Pena de escrever | B | Mesa | rect 1994,896 82×170 | Escrevia molhando a ponta na tinta. |
| Borboleta emoldurada | A | Mesa | rect 1932,318 104×124 | Tem asas coloridas, mas não voa mais. |
| Chapéu de explorador | B | Mesa | rect 2066,428 124×66 | Vai na cabeça de quem viaja. |
| Globo terrestre | A | Estante | círculo 2200,990 r96 | Mostra o mundo inteiro numa bola. |
| Bolsa de couro | B | Estante | rect 2168,594 96×120 | Leva as coisas pendurada no ombro. |

Metadados de cada objeto: `label`, `accessibleLabel`, `clue`, `tier`, `station`,
`region`, `hintRegion`, `hintDirection`, `hintContext` e, se preciso, `listedAs`
(a Borboleta só aparece como imagem ou pista: a silhueta de um quadro é um
retângulo).

### 5.2 Uma rodada válida

1. tem exatamente a mistura de tiers da dificuldade;
2. só lista o que o estilo de lista consegue mostrar (`listedAs`);
3. cada estação fica com ⌊k/3⌋ ou ⌈k/3⌉ objetos (Fácil 1–2, Médio 2, Difícil
   2–3): nenhuma concentração, toda rodada atravessa a sala;
4. cada objeto aparece uma vez.

Rodadas válidas: **Fácil 148, Médio 243, Difícil 692** — enumeradas pelo jogo e
confirmadas por uma força bruta independente (P03).

### 5.3 Algoritmo

`src/games/hidden-objects/hidden-objects-rounds.ts`, puro: enumera as rodadas
válidas (uma vez por dificuldade, em cache), escolhe uma com `mulberry32(semente)`
— **toda rodada válida igualmente provável** — e embaralha a ordem da lista
(Fisher–Yates com o mesmo gerador): a primeira linha não diz por onde começar. Sem
`Math.random`, relógio ou pacote novo (H25, E25). Custo medido: enumerar 1–5 ms,
uma vez; sortear ~3 µs.

### 5.4 A dificuldade participa da seleção

O tier é o que a arte mede, não um rótulo: visível A ≥ 80 %, B ≥ 60 %, C ≥ 40 %, e
borda ≥ 1,3:1 para **todos** (ninguém é difícil por estar apagado). A mistura de
tiers faz cada dificuldade pedir mais do olho — média exata sobre as rodadas
(`fairness-report.json` → `perceptualLoad`):

| | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| parte visível do objeto | 94,8 % | 87,5 % | 84,9 % |
| sósias por objeto pedido | 0,41 | 0,67 | 0,75 |
| objetos < 80 % visíveis por rodada (média; máx.) | 0,35; 1 | 1,51; 3 | 2,52; 4 |

Além disso o Difícil pede 8 objetos por pista de função, sem imagem, sem halo e
sem "Mostrar onde está" (P11). Se isso é "difícil na percepção humana" e não só
nas medidas, é a pergunta central do playtest (§10).

### 5.5 Semente e ciclo de vida

- A semente é sorteada **uma vez por "Explorar"** (`crypto.getRandomValues`, a
  única aleatoriedade do jogo) e guardada na sessão; o shell a expõe em
  `data-round-seed` e o resultado a grava em `details.roundSeed` (dificuldade +
  semente refazem a lista — P10).
- "Recomeçar" mantém a lista (P07; probe X07). Nova entrada pela Home ou
  "Praticar outra vez" = nova exploração = nova semente (P08; probe X06, X31, R02).
- Nada sorteia de novo no meio da rodada: zoom, pan, pinça, estações, resize,
  rotação do celular, rerender, pistas, reduced motion ligado e desligado, aba
  oculta, lista recolhida (P06; probe X30, L06 — **um** sorteio por exploração,
  contado no browser).
- Objetos fora da rodada: pintados, sem resposta ao toque, sem anúncio (P09;
  probe R03).
- Testes injetam a semente: o harness troca a fonte (`createRandomSource`) e o
  probe planta sementes em `crypto.getRandomValues`; nenhum teste depende de
  `Math.random`.

### 5.6 Fronteira MULTISCENE

`RoundSource { stations, pool, presets }` e `EXPLORER_STUDIO_ROUNDS`: a seleção
recebe a cena como dado, e o resultado já grava `sceneId`. **Não existe** segunda
cena jogável, carrossel, desbloqueio, campanha nem mapa novo.

## 6. Justiça (relatório E)

`node tools/validation/hidden-objects-round-fairness.mjs --out
docs/archive/game03-experience-02` roda o `selectRoundTargets` real sobre
1.000.000 de sementes por dificuldade (sequência fixa, reproduzível) e grava
`fairness-report.md` (tabelas por objeto) e `fairness-report.json`.

| | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| rodadas válidas / alcançadas | 148 / 148 | 243 / 243 | 692 / 692 |
| listas inválidas sorteadas | 0 | 0 | 0 |
| χ² das rodadas contra uniforme (z) | 1,51 | −0,27 | −0,84 |
| maior \|z\| por objeto (medido × exato) | 2,19 | 2,51 | 2,35 |
| exposição ÷ média do tier (mín.–máx.) | 0,865–1,216 | 0,638–1,317 | 0,728–1,318 |
| padrões Janela-Mesa-Estante | 1-2-2 44,6 % · 2-1-2 24,3 % · 2-2-1 31,1 % | 2-2-2 100 % | 2-3-3 43,9 % · 3-2-3 24,3 % · 3-3-2 31,8 % |
| 1ª linha por estação (J / M / E) | 31,1 / 35,1 / 33,8 % | 33,4 / 33,3 / 33,3 % | 32,0 / 34,4 / 33,6 % |
| tier da 1ª linha | A 60,0 · B 40,0 % | A 16,7 · B 50,0 · C 33,3 % | A 12,5 · B 37,5 · C 49,9 % |

Todas as listas sorteadas têm a mistura exata de tiers (100 %), e a 1ª linha
segue a proporção da rodada: a ordem não favorece tier nem estação.

**Exposição desigual, por construção.** Dentro de um tier, a exposição não pode
ser igual: toda rodada tira ⌊k/3⌋–⌈k/3⌉ objetos de cada estação, e a sala dá 5
objetos à Janela, 7 à Mesa e 6 à Estante — um objeto da Janela é pedido mais vezes
que um da Mesa do mesmo tier. Pior caso: Médio, tier A — Ampulheta e Guarda-chuva
26,3 %, Lupa 12,8 % (máx./mín. 2,06). A igualdade é impossível com essa regra (no
Médio a Janela precisa dar 2 de 6 objetos por rodada; exposição igual dentro de
cada tier daria 1,57). O critério inicial do P05 (máx./mín. ≤ 2 dentro do tier)
media a geometria da sala, não o sorteio; virou "nenhum objeto sorteável abaixo de
metade ou acima do dobro da média do seu tier" (pior caso: Lupa no Médio, 0,638),
e a razão máx./mín. continua no relatório. Se a diferença se nota jogando é item do
playtest (§10, P5).

## 7. Testes (relatório F)

### 7.1 Suites

| Suite | Resultado |
| --- | --- |
| `hidden-objects-skeleton-tests.mjs` | 38/38 (30 `[contract]`, 8 `[preserved]`) — H24–H26 reescritos para o pool (os dez continuam; rodadas 5/6/8 sorteadas; composição de tiers); H27 roda sobre todas as rodadas possíveis |
| `… --counterfactuals` | base `f9254429`: 30/30 falham, 8/8 seguram; 18/18 mutantes pegos |
| `hidden-objects-experience-tests.mjs` | 45/45 (16 `[experience]`, 12 `[pool]`, 17 `[preserved]`) |
| `… --counterfactuals` | base `87f30d3`: 16/16 `[experience]` e 12/12 `[pool]` falham, 17/17 `[preserved]` seguram; base `8fbd638` (listas fixas): só os 12/12 `[pool]` falham, o resto segura; 31/31 mutantes pegos |
| `hidden-objects-round-fairness.mjs` | `ROUND_FAIRNESS_OK` (§6) |
| `hidden-objects-browser-probe.mjs` | 104/104; cada um dos 10 cenários também sozinho (`--scenario`), 104/104 |

### 7.2 Mutantes do pool (mutante → detector exigido → resultado)

| Mutante | Exigido falhar | Falharam |
| --- | --- | --- |
| toda semente sorteia a mesma rodada | P05, P08 | E32, P05, P08 |
| a mistura de tiers é ignorada | E03, P03 | E03, E33, P03, P05 |
| uma rodada pode listar um objeto duas vezes | P05 | E14, E21, P05, P10 |
| rodadas deixam de se espalhar pelas estações | P03 | P03 |
| a lista é sorteada de novo a cada render | P06 | E05–E10, E21, E32, P06–P10 |
| uma rodada lista um objeto a menos | P05 | E14, E21, P05, P06 |
| a semente é ignorada: `Math.random` sorteia | P04 | E07, E08, E31, E32, P04, P08, P10 |
| "Recomeçar" sorteia lista nova | P07 | P07 |
| todo objeto do pool responde ao toque | P09 | E21, P09, P10 |
| o Médio lista um quadro pelo contorno | P12 | P03, P12 |
| uma entrada nova repete a última lista | P08 | E31, E32, P06, P07, P08, P10 |
| o resultado esquece a rodada | P10 | P10 |
| um objeto do pool perde as palavras da pista | P02 | E04, P02 |

Os outros 18 mutantes da experiência (revelação exata de volta no Difícil, halo no
contexto, nomes na lista do Difícil, arrastar que seleciona, parallax no hit test,
escada igual para todos, alvo fora de alcance, anel animado em reduced motion,
render por `pointermove`, Trilha ativa de novo, "Mostrar onde está" no Médio,
sósia sobre o alvo, placar sem rótulo, nome do achado nunca mostrado, lista que não
recolhe, Rota tocada, dependência nova, pistas com custo) e os 18 do skeleton
seguem pegos.

### 7.3 Probe de browser V2

Build de produção (`next build && next start -p 3100`), Chromium headless com
SwiftShader. Cada cenário planta as próprias sementes em `crypto.getRandomValues`
e confere que a lista na tela é exatamente a que a semente sorteia
(`hidden-objects-rounds.ts` lido da fonte).

| Cenário | Checks | O que cobre |
| --- | --- | --- |
| `desktop` | 42 | 1440×900, Fácil (semente 101): pan, roda/±, Mesa, toque livre, achado, arrastar sobre alvo, escada inteira, a rodada que segura (X30), resultado com `roundSeed`; "Praticar outra vez" → Médio (202): silhuetas, escada que não aponta, "Recomeçar" mantém a lista; nova entrada pela Home → Fácil (303), outra lista |
| `hard` | 8 | Difícil (404): pistas como lista, escada sem luz nem deslize, nome no achado, pan/zoom/estações, trilho, resultado |
| `mobile` | 12 | 390×844 toque, Difícil (505): arrastar, pinça, bandeja, pistas legíveis, recolher, completar, sem overflow |
| `landscape` | 9 | 844×390 toque, Médio (606): coluna lateral, pinça + arrastar, pista, achados, celular virado em pé e de volta no meio da rodada (mesma rodada), resultado |
| `small` | 5 | 360×640, Fácil (707) |
| `reduced-motion` | 6 | corte de estação, halos, anel e etiqueta sem fade (808) |
| `legacy` | 8 | resultado antigo da Trilha; releitura hidratada da Home (909) |
| `rounds` | 4 | nove entradas pela Home com nove sementes (3 por dificuldade): lista = sorteio, espalhada, sem repetição, estilo certo, 1 sorteio por entrada; objeto fora da rodada é cenário |
| `reload-race` | 4 | §3 |
| `bundle` | 6 | §8 |

## 8. Medições (relatório G)

- **Bundle** (mesmo medidor do skeleton; `metrics.bundle`):

| Conjunto | skeleton `87f30d3` | agora | Δ |
| --- | --- | --- | --- |
| Home inicial JS | 773 153 B (gzip 242 550) | 773 682 B (gzip 242 772) | +529 B (gzip +222): apresentação do resultado |
| Home inicial CSS | 206 111 B | 206 074 B | −37 B |
| Estúdio, lazy, JS | 31 937 B (gzip 10 537), 1 arquivo | 40 184 B (gzip 13 465), 2 arquivos | +8 247 B (gzip +2 928) |
| Estúdio, lazy, CSS | 12 926 B (gzip 3 551) | 19 328 B (gzip 4 709) | +6 402 B |
| Rota / Circuito / Babylon | 55 385 / 19 502 / 8 028 358 B | idênticos | 0 |

  O Estúdio continua fora do grafo inicial da Home, sem Babylon, Rota ou Circuito.
- **Assets** (H38, E30): prancha 202,9 KB, janela 11,9 KB, primeiros planos 32,2 +
  25,6 KB → essenciais **272,5 KB**; 18 miniaturas 105,0 KB; arte de transição
  35,0 KB → entrada **412,5 KB de 1270 KB** (era 363,8 KB em `8fbd638`; +48,7 KB =
  8 miniaturas novas 43,7 KB, prancha +4,2 KB — a pintura nova junto à janela e os
  retoques de borda —, arte de transição +0,8 KB; as 10 miniaturas antigas são
  byte a byte as mesmas).
- **Performance** (Chromium/SwiftShader, `metrics`): arrasto no desktop — 24
  `pointermove` → 0 commits React, 24 escritas de estilo, 0 long tasks; celular —
  16 movimentos de toque → 0 commits; Entrar → cena revelada 4,25 s no desktop e
  1,79 s no celular (rasterização por software; o skeleton media 4,1–6,6 s e
  1,2–1,9 s); seleção da rodada ~3 µs (enumeração 1–5 ms, uma vez). 60 fps em GPU
  real não foi medido.
- **Dependências**: nenhuma nova — `package.json` e `package-lock.json` idênticos
  à base (H14, E25). `npm audit` (o mesmo antes e depois desta missão): 13 avisos
  no total, 4 em produção (2 moderados, 2 altos: `next` 16.3.6 — correção em
  16.4.0 — e `source-map-js`); ficam para uma missão de dependências (classe 2).

## 9. Regressões (relatório H)

Rodado por inteiro no fechamento, um comando depois do outro, com o worktree
parado (`git status` igual antes e depois):

| Verificação | Resultado |
| --- | --- |
| `eslint` · `tsc --noEmit` · `git diff --check` | 0 problemas · 0 erros · limpo |
| `next build` | exit 0; rotas estáticas |
| CORE `validation-hygiene-tests.mjs` | 15/15 validadores (`CORE_BATTERY_PASSED`); imutabilidade: 0 arquivos criados, apagados ou alterados, `git status` idêntico (`VALIDATION_CHECK_IS_READ_ONLY`) |
| DEEP `final-acceptance.mjs` | estrutural 1080/1080, contínuo 270/270, recovery 9/9, sem exceções |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · 5 baselines e 6 mutantes pegos |
| `game-readiness-registry`, `game-entry-watchdog-registry`, `game-continuation-contract`, `production-diagnostic-boundary` | OK |
| `memory-circuit-lifecycle-tests.mjs` | OK |
| `route-journey-terminal-tests.mjs` (tela de resultado real da Rota) · `route-journey-ownership-tests.mjs` | OK · OK |
| `route-validation-coupling-gate.mjs` | 6/6 — **corrigido nesta missão** (abaixo) |
| suites do Estúdio, contrafactuais, justiça, probe | §6–§7 |

- **Rota**: pasta `src/games/escape-maze/` byte a byte igual ao skeleton, contrato
  e loader iguais (E22); conjunto lazy da Rota idêntico no bundle; R1–R3 do gate,
  CORE e DEEP verdes; a tela de resultado da Rota igual (E15,
  `route-journey-terminal-tests`).
- **Circuito**: pasta igual (E23), `memory-circuit-lifecycle-tests`, M1/M2 do gate,
  conjunto lazy idêntico.
- **Plataforma**: A1–A10 do gate; GameScreen e App Shell sem nome de jogo (H10,
  H11, H37); a única mudança é a apresentação do resultado (§4.4), com todos os
  outros jogos exibidos como antes (E15).
- **Home/navegação**: o Estúdio no slot da Trilha (02), sair sem salvar e voltar à
  Home (23, 24, X31), nova entrada pela Home com lista nova (X31, R02), resultado
  antigo da Trilha lido e mantido (33–35), releitura hidratada (35, RR1–RR3).
- **Correção do gate de acoplamento**: o mutante "a Rota é tocada" da suite de
  experiência (vindo de `8fbd638`) editava `src/games/escape-maze/continuation.ts`
  pelo nome — o R1 do `route-validation-coupling-gate` falhava desde `8fbd638`
  (`--rev=87f30d3` passa; `--rev=8fbd638` e `--rev=ff86f0b` falham). Agora o
  mutante pega, na hora de rodar, um arquivo-fonte qualquer da pasta da Rota; a
  suite não nomeia mais nenhum módulo da Rota, o gate volta a 6/6 e o E22 continua
  pegando o mutante.

## 10. Playtest Humano 02 — `TO_VALIDATE_IN_EXPERIENCE_02`

Mesmo protocolo do `GAME03_FUN_GATE` (`docs/GAME03_SKELETON_01.md` §7: 5–8 pessoas,
≥ 3 com 60+, metade no celular), com estas perguntas a mais:

| # | Item | Estado técnico |
| --- | --- | --- |
| P1 | O Difícil é **mais difícil na percepção humana** (8 objetos, lista por função, pista só até o contexto), e não frustrante para 60+? | medido: menos visível, mais sósias, mais objetos parcialmente cobertos (§5.4); 8 objetos mantidos |
| P2 | As pistas de função são entendidas e inequívocas ao lado dos sósias? | E04: não nomeiam o objeto nem outro da lista |
| P3 | As silhuetas do Médio são reconhecíveis (guarda-chuva, gaiola, xícara, pena, chapéu, globo, bolsa)? | a Borboleta não aparece como silhueta (P12) |
| P4 | Os objetos novos são reconhecíveis na arte (gaiola sob a hera, xícara atrás do livro — 54 % visível —, borboleta no quadro)? | auditoria acima dos pisos (§5.1) |
| P5 | "A cada visita, a sala pede outros objetos" motiva a voltar? A exposição desigual (Lupa ~1 a cada 8 rodadas no Médio) se nota? | §6 |
| P6 | "Recomeçar" com a mesma lista e "Praticar outra vez" com lista nova é o que se espera? | P07/P08 |
| P7 | Celular deitado: a coluna lateral mostra 3 dos 6 itens e rola; na abertura a sala quase cabe na largura e há pouco para arrastar — confortável? | L02/L03 |
| P8 | A lista recolhível é descoberta? | X14/X21 |
| P9 | A tela de resultado ("Objetos encontrados", "Modo") basta? | X04, X15 |
| P10 | "Pensar em paz": o anel, a etiqueta e os halos são calmos; nada pressiona? | sem cronômetro, vidas, ranking (E12–E14) |
| P11 | A estação acesa (botão "atual") confunde? No desktop 1440×900 e no celular deitado, Janela e Estante deixam "Mesa" acesa (§11) | comportamento do skeleton, não mudou |
| P12 | Leitor de tela (NVDA/VoiceOver) e aparelhos reais (iOS Safari, Android Chrome) | medido só em Chromium/SwiftShader |

## 11. Limitações e próximos passos

- A arte ainda é desenhada por script (SVG → WebP), não a arte definitiva.
- A estação "atual" é a que contém o centro da vista (`nearestStation`, sem
  mudança desde o skeleton): onde a câmera encosta nas paredes — desktop
  1440×900 com a lista aberta ou recolhida, celular deitado — apertar Janela ou
  Estante move a câmera certo, mas deixa "Mesa" acesa (a luz de pista da estação
  está certa). Fica como tarefa própria, depois do playtest decidir o que "estação
  atual" deve dizer.
- A exposição desigual dentro de um tier é estrutural (§6).
- `npm audit` acusa avisos antigos (§8), fora do escopo desta missão.
- Próximos passos, nesta ordem: Playtest Humano 02; calibrar os itens de §10;
  só então arte definitiva, recortes de "encontrado", som e — numa missão
  MULTISCENE própria — a segunda cena.

## 12. Validação

```bash
node tools/validation/hidden-objects-skeleton-tests.mjs                      # 38 checks, sem browser
node tools/validation/hidden-objects-skeleton-tests.mjs --counterfactuals    # base f9254429 + 18 mutantes
node tools/validation/hidden-objects-experience-tests.mjs                    # 45 checks
node tools/validation/hidden-objects-experience-tests.mjs --counterfactuals  # bases 87f30d3 e 8fbd638 + 31 mutantes
node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-browser-probe.mjs \
  --out docs/archive/game03-experience-02/witnesses \
  --json docs/archive/game03-experience-02/browser-probe-run.json   # 104 checks; --scenario NOME roda um sozinho
node tools/assets/create_hidden_objects_scene.mjs --audit                   # regenera o kit v1 e a auditoria (~10 min)
```

Evidência: `docs/archive/game03-experience-02/` (testemunhas, registro do probe,
cenários sozinhos, relatório de justiça).
