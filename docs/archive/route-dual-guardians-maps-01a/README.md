# Rota Estratégica — Dois Guardiões, mapas 01A

Material de aceitação da `ROTA-DUAL-GUARDIANS-MAPS-01A` e das missões de
fechamento que se seguiram a ela. Nada nesta pasta é ilustrativo: todo número
foi medido, e a ferramenta que o produziu está em `tools/validation/`.

**Nenhum arquivo de produção foi commitado.** O gerador validado aqui vive no
working tree, não em `HEAD` — ver "Estado do repositório" no fim.

---

## Veredito

**ROTA-DUAL-GUARDIANS-MAPS-01A_READY_FOR_RUNTIME**

| portão | exigido | medido |
|---|---|---|
| estrutural final | 1080/1080 certificados, 0 throws | **1080/1080, 0 throws, 0 falhas de auditoria** |
| contínuo final | 270/270, 0 throws | **270/270, 0 throws** |
| dinâmico final | `SYSTEM_CAUSED = 0` | **0** (225 PLAYER_CAUSED em 270 mapas) |
| classificador | 3/3 | **3/3**, critério congelado |
| recovery determinística | entra, mesmos gates, mapa certificado | **9/9 combinações** |
| mapas não certificados | 0 | **0** |
| throws nas amostras finais | 0 | **0** |
| validações técnicas | lint/tsc/build/diff | **todas passam** |
| contratos de qualidade | nenhum relaxado | **nenhum** |

---

## 1. Seleção de luzes — fechada

O gate 13 (“toda luz partilha bloco biconexo com o Explorador”) rejeitava 81,4%
dos candidatos. Um solver exaustivo provou que em **2.330 de 2.330** existia
conjunto válido: o layout estava certo, a escolha não.

`sharesBlock` passou a ser critério de **elegibilidade**, não só de validação, e
a seleção virou busca com backtracking limitado sobre a ordem de score.

| | |
|---|---|
| candidatos reprocessados | **2330/2330** |
| falhas de gate 13 | **0/2330** |
| testes controlados A–F | **6/6** |
| quatro seeds históricas | **4/4** |

O teste **B (greedy trap)** encontrou um defeito real: a cauda antiga completava
o conjunto até a contagem exigida **ignorando a separação mínima**, e nada a
jusante reexaminava separação. Seis luzes com oito violações eram certificadas.
A cauda foi removida. Detalhes em
[`choose-stars-contract.md`](choose-stars-contract.md) e
[`star-selection-algorithm.md`](star-selection-algorithm.md).

Nos 2.330 casos reais o backtracking nunca precisou recuar — o filtro de
elegibilidade resolveu sozinho. Ele é rede de segurança, e sua única cobertura
vem do teste B. Isso está registrado, não escondido:
[`star-selection-backtracking-profile.json`](star-selection-backtracking-profile.json).

## 2. Largura de fuga e rota objetiva

`routeCellsHaveEscape` respondia por 96,2% das rejeições estruturais. Um
classificador exato — admissibilidade depende só das paredes, logo uma rota
válida existe se e somente se início, luzes e portal partilham uma componente
do subgrafo admissível — separou as 255 rejeições:

| classe | casos |
|---|---|
| legítimas (portal inalcançável por células admissíveis) | **192** |
| evitáveis por escolha de rota | **38** |
| evitáveis só com outro conjunto de luzes | **25** |

As 797 células ofensoras eram **todas** do mesmo subtipo: grau exatamente 2
dentro da região de convergência do portal. 85,7% em borda ou canto do
tabuleiro. Caso limite exato: com portal `0,7`, a célula `0,8` é canto — grau
máximo 2 — e nunca poderá satisfazer a regra de 3.

`resolveObjectiveRoute` devolve a rota mais barata como antes e **só** repete a
busca dentro do subgrafo admissível quando aquela reprova: mesma matriz de
custo, mesmo desempate, ainda a mais curta. **38/38 corrigidos**, com paredes,
luzes e portal idênticos. Custo médio pago: +4,84 movimentos.

`escapeGeometryIsPossible` rejeita cedo, antes da seleção de luzes, o candidato
cujo portal não é alcançável por células admissíveis. Condição **necessária**
para o gate final, então não pode descartar mapa válido — e foi medido:

| | |
|---|---|
| candidatos observados | **10.008** |
| rejeições antecipadas verdadeiras | 3.995 |
| **falsas rejeições** | **0** |
| legítimos identificados cedo | **192/192** |

Contratos em [`objective-route-contract.md`](objective-route-contract.md) e
[`portal-escape-geometry-contract.md`](portal-escape-geometry-contract.md).

## 3. Robustez de geração

Seis throws históricos, todos na Rota 3, reproduzidos com 572 tentativas cada e
dominados pela mesma família (65,4% `routeCellsHaveEscape`). Depois das
correções: **6/6 certificados**, em 10 a 162 tentativas.

A varredura de recuperação foi provada explicitamente: com a fase aleatória
limitada a uma tentativa numa cópia em memória (cap de produção intocado), a
recovery entra em **9/9** combinações, passa pelos **mesmos** gates e devolve
mapa que sobrevive à mesma auditoria de 18 contratos. Não existe caminho de
fallback não certificado — o gerador lança em vez de entregar mapa não validado.

## 4. Dinâmico

270 mapas (3 rotas × 3 modos × 30), com os contratos congelados: agente
`humanV3`, Caçador de produção, Sentinela `{ patrol: true, commitTurns: 3 }`,
exploração de estados alcançáveis, classificador congelado.

| | |
|---|---|
| estados sob pressão | 225 |
| **PLAYER_CAUSED** | 225 |
| **SYSTEM_CAUSED_INEVITABLE_PINCERS** | **0** |
| estados sem jogada legal | 111 |
| colapsos dentro da zona do portal | 12 |

O classificador **não foi ajustado** durante esta execução. Seus três testes
controlados continuam 3/3.

## 5. Desempenho — observacional

**BROWSER_PERFORMANCE_NOT_REMEASURED.** Playwright não está instalado neste
ambiente, e o painel de navegador interno não compõe quadros
(`document.hidden = true`, `requestAnimationFrame` entregou 0 frames em 600 ms),
então o gate de prontidão do mundo nunca libera e o tabuleiro não é alcançado.
Nenhum número de navegador foi inventado.

Como evidência secundária, o mesmo harness Node mediu antes e depois:

| | antes | depois |
|---|---|---|
| p50 | 797,1 ms | **114,9 ms** |
| p75 | 1506,2 | **214,3** |
| p90 | 2281,9 | **336,3** |
| p95 | 2687,9 | **401,7** |
| p99 | 3116,6 | **466,9** |
| max | 4630,9 | **697,3** |
| >1 s | 51 de 120 | **0** |

O baseline publicado (p50 365 / p90 1834) veio de navegador em sessão anterior e
**não é comparável** a estes números.

## 6. Validador 9×9

Estava morto: os dois anchors de injeção em corpo de função foram apagados por
um refactor anterior e ele lançava na partida. Reparado sem remendar corpo
algum — superfície de export append-only, e o harness dirige `buildCandidate` +
`isValidMap`. O anchor de string foi substituído por equivalência
comportamental: **108/108** mapas idênticos entre harness e `generateMaze`.

Final: 180 mapas, 9 templates (3 por rota), 0 fallbacks, 0 throws, 0 erros.

---

## KNOWN NON-BLOCKING

**25 candidatos observados poderiam ser salvos com outro conjunto de estrelas,
mas o candidato atual é corretamente rejeitado.** Isso é oportunidade futura de
eficiência, não defeito de correção.

Registrado como `KNOWN_STAR_DEPENDENT_GENERATION_WASTE` em
[`known-star-dependent-waste.json`](known-star-dependent-waste.json). Nenhum
mapa inválido é aceito por causa deles, nenhum throw conhecido lhes é atribuído,
e o contínuo da Rota 3 passou 360/360 e 270/270 com eles presentes.

## Artefatos históricos superados

Os artefatos de **02/08** em `docs/archive/route-9x9-validation-01/` registram
**4 templates**, **75 px de scroll** a 1440×900 e **LIGHTCOUNT 11**. Os três
foram superados por trabalho posterior e **não descrevem o estado atual**:

- templates: hoje são **9**, três por rota, todos 9×9 — confirmado no código e
  no validador (`uniqueCount: 9`);
- scroll: fechado pela `ROTA-RUNTIME-STABILITY-01` (06/08), que rastreou a causa
  (696 − 620,4 = 75,6 px) e mediu `depois: 0`;
- luzes: a cena atual cria **3** — `route-key-light` (direcional),
  `route-fill-light` (hemisférica), `route-rim-light` (point), com
  `maxSimultaneousLights = 3` em todo material. As point lights decorativas
  citadas naquele relatório não existem mais em `src/`.

Aqueles arquivos são mantidos como registro histórico. Não reabrir.

## Estado do repositório

`HEAD` está deliberadamente atrás: o gerador descrito aqui existe apenas no
working tree, em `src/games/escape-maze/useEscapeMaze.ts`. Um checkout limpo
hoje reproduz os seis throws, o gate 13 em 81,4% e o validador quebrado.
Nenhum commit foi feito em nenhuma destas missões.

## Índice de evidências

| arquivo | conteúdo |
|---|---|
| `structural-1080-final.json` | 1080 mapas, 18 contratos auditados por mapa |
| `continuous-270-final.json` | 9 streams master-seeded, sem reseed |
| `dynamic-270-final.json` | 270 mapas, estados alcançáveis, veredito de pinça |
| `classifier-final.json` | testes controlados A/B/C |
| `deterministic-recovery-final.json` | prova da varredura de recuperação |
| `generation-performance-final.json` | tempo observacional e a lacuna do navegador |
| `known-star-dependent-waste.json` | os 25 não bloqueadores |
| `route-01a-final-acceptance.json` | consolidação dos portões |
| `choose-stars-contract.md` · `star-selection-*.json` | seleção de luzes |
| `objective-route-*.{md,json}` | rota objetiva |
| `portal-escape-geometry-contract.md` · `early-escape-equivalence-10k.json` | geometria do portal |
| `route-cells-have-escape-*.{md,json}` | autópsia das 255 rejeições |
| `generation-six-throws-{before,after}.json` | os seis throws |
| `validator-9x9-repair.json` · `validator-9x9-final.json` | validador |
| `is-valid-map-reason-codes.md` | reason codes do gate final |
