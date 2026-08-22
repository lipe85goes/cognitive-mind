# MINDFLOW-CLEANUP-03A — primeira onda de safe deletes

Remoção da CLASS A da `MINDFLOW-ARCHITECTURE-AUDIT-01`, com o graph
**reconfirmado no HEAD atual** — a auditoria é anterior à
`MINDFLOW-PRODUCTION-BOUNDARY-02`, então nada foi removido com base só nela.

Escopo não ampliado. Nenhum refactor oportunista.

---

## GRAPH RECONFIRMATION

| ITEM | PRODUCTION | TEST | TOOLING | BUILD | SAFE TO REMOVE NOW? |
|---|---|---|---|---|---|
| arquivo raiz `s` | ✗ | ✗ | ✗ | ✗ | **sim** |
| `RouteWorldDiorama.tsx` | ✗ | ✗ | ✗ | ✗ | **sim** |
| `CircuitWorldDiorama.tsx` | ✗ | ✗ | ✗ | ✗ | **sim** |
| `SKILL_LABELS` | ✗ | ✗ | ✗ | ✗ | **sim** |
| `WorldVisualContract.homeArt` | ✗ (só escrito) | ✗ | ✗ | ✗ | **sim** |
| `getBestActivationSignalsForGame` | ✗ | ✗ | ✗ | ✗ | **sim** |
| `calculateStars` | ✗ (só via o símbolo acima) | ✗ | ✗ | ✗ | **sim** |

Varredura sobre `src/`, `tools/`, `docs/`, `public/` e configs de raiz, cobrindo
imports, exports, dynamic imports, filesystem routing, referências em string, em
asset e em build. Único barrel do projeto: `src/games/index.ts` — não toca
nenhum dos símbolos.

### Detalhes que mudaram a decisão

**`s`** — 2.874 bytes de saída de `git diff --stat`, com códigos de cor ANSI e
avisos de CRLF. Estava **rastreado** no git. Acidental, confirmado pelo conteúdo.

**Wrappers de diorama** — dez linhas cada, apenas
`<WorldDiorama gameId="…" {...props} />`. Zero consumidores fora de si mesmos.
O `WorldDiorama` em si **continua vivo** (`WorldObject.tsx` na Home e
`WorldMasterScene.tsx`), então remover os wrappers não órfãou nada.

**`homeArt`** — o ponto que exigia cuidado: os cinco caminhos que ele apontava
são **os mesmos** já usados por `transitionArt` e `introArt` na mesma entrada.
Remover o campo portanto **não órfãou nenhum asset**. Nada foi apagado de
`public/`, como a missão exige.

**A cadeia de scoring** — o graph confirmou exatamente a hipótese da missão:

```
getBestActivationSignalsForGame  → calculateStars
        (sem consumidor externo)      (sem outro consumidor)
```

`calculateStars` era usado num único ponto, dentro de
`getBestActivationSignalsForGame`, que por sua vez não era chamado por ninguém.
A cadeia inteira saiu.

**Scoring vivo preservado:** `isSuccessfulResult` e `getRewardCopy` continuam em
`rewards.ts` (usados pelo `RewardResultModal`), e `PLAYABLE_STAGE_IDS` continua
em `stage-progress.ts` (usado por `app/page.tsx` e `lab/3d-home`). Nenhum valor
persistido muda: `calculateStars` era função pura do `score` já gravado, e nada
exibia o resultado dela.

---

## ITEMS REMOVED

Todos os sete. Nenhum rebaixado para follow-up.

### FILES DELETED

| Arquivo | Motivo |
|---|---|
| `s` | saída acidental de `git diff --stat`, rastreada por engano |
| `src/components/worlds/diorama/RouteWorldDiorama.tsx` | wrapper sem consumidor |
| `src/components/worlds/diorama/CircuitWorldDiorama.tsx` | wrapper sem consumidor |

### SYMBOLS REMOVED

| Símbolo | Arquivo |
|---|---|
| `SKILL_LABELS` | `src/data/activities.ts` |
| `getBestActivationSignalsForGame` | `src/engine/stage-progress.ts` |
| `calculateStars` | `src/engine/rewards.ts` |

### TYPE / METADATA DELTA

* `WorldVisualContract.homeArt` — campo removido do tipo;
* cinco `homeArt:` removidos de `WORLD_VISUALS`;
* `stage-progress.ts` — import de `calculateStars` removido, e o type import
  reduzido de `{ GameId, GameResult }` para `{ GameId }`, porque `GameResult` só
  existia para a função removida.

`image`, `dioramaImage`, `transitionArt`, `introArt`, `atmosphere`, `artMode` e
o restante da metadata permanecem intocados.

### TEST DELTA

Nenhum. Nenhuma suíte referenciava os símbolos removidos.

### DOC DELTA

Este README.

---

## NEW CLEANUP CANDIDATES

Encontrados durante o trabalho. **Registrados, não removidos** (§7).

| Candidato | Situação | Observação |
|---|---|---|
| `Activity.skill` | escrito nas 5 entradas de `ACTIVITIES` e declarado em `types/game.ts`, mas **lido por ninguém** | `SKILL_LABELS` era o último leitor. Cuidado ao avaliar: os `.skill` que aparecem na UI vêm de `getWorldMeta` (`data/worlds.ts`), que é uma **fonte diferente** e continua viva. Remover exigiria mexer no tipo `Activity` e no tipo `CognitiveSkill`. |

Nada mais foi identificado como claramente morto nesta passagem.

---

## REGRESSÕES

| Suíte | Veredito |
|---|---|
| `production-diagnostic-boundary-tests` | `PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_OK` |
| `route-visual-state-tests` | `ROUTE_VISUAL_STATE_CONTRACT_OK` |
| `difficulty-rebalance-tests` | `DIFFICULTY_REBALANCE_TESTS_OK` |
| `route-difficulty-identity-tests` | `ROUTE_DIFFICULTY_IDENTITY_OK` |
| `difficulty-remount-persistence-tests` | `DIFFICULTY_REMOUNT_PERSISTENCE_OK` |
| `diagnostic-launcher-tests` | `DIAGNOSTIC_LAUNCHER_OK` |
| `chest-controlled-tests` | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests` | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests` | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay` | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit` | `STATIC_RENDER_AUDIT_OK` |
| `difficulty-baseline-tests` | `DIFFICULTY_BASELINE_TESTS_OK` |

`route-visual-state-tests` é o owner do contrato visual e é a regressão focada do
`homeArt`; `chest-*` e `difficulty-*` cobrem o owner de scoring/gameplay.

**Game registry smoke:** 5 entradas em `GAME_COMPONENTS`, conjunto **idêntico** a
`PLAYABLE_STAGE_IDS`.

**Home flow / static reachability:** o build prerenderiza `/`, `/lab/3d-home`,
`/lab/route-launcher`, `/_not-found` e `/manifest.webmanifest` — mesmo conjunto
de antes.

**Boundary de labs preservado**, Rota preservada, Circuito preservado,
**3 Babylon lights**.

---

## RISCOS REMANESCENTES

* Baixos. Todas as remoções são de símbolos sem leitor, e o `tsc` é a prova
  dura: qualquer consumidor de `homeArt`, `calculateStars` ou
  `getBestActivationSignalsForGame` teria falhado a compilação.
* `calculateStars` era a única definição do conceito "estrelas" (tiers 0–3 por
  score). Se a UI voltar a querer estrelas, a função precisa ser reescrita — mas
  ela estava morta, e mantê-la viva não a tornava mais fácil de reencontrar do
  que o histórico do git.

---

## PRÓXIMA LIMPEZA RECOMENDADA

1. **`Activity.skill`** — o candidato registrado acima; menor e mais contido.
2. Reavaliar as classes B/C da auditoria com o graph reconfirmado, agora que a
   `PRODUCTION-BOUNDARY-02` está no HEAD.
3. Assets de diorama e CSS ficam para uma onda própria: exigem varredura de
   referência por string e por `url()`, que é um tipo de análise diferente da
   desta missão.
