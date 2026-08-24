# ROTA-BABYLON-LIFECYCLE-07 — race de dispose assíncrono

Um erro assíncrono do Babylon envolvendo `postProcessManager` foi observado ao
forçar retry/unmount enquanto assets ainda carregavam. Não havia witness BEFORE,
então nada foi atribuído à missão anterior: esta missão **reproduziu** a race,
provou a causa e corrigiu a ownership.

---

## BABYLON LIFECYCLE OWNERSHIP MAP

```
React mount (RouteBabylonBoard, effect [])
  └── await import("@babylonjs/core" | loaders/glTF | routeBabylonScene)
        guard: cancelled → return
  └── createRouteBabylonController(B, canvas, state, bridge)
        ├── Engine            ← controller
        ├── Scene             ← controller
        ├── ArcRotateCamera   ← Scene
        ├── 3 lights          ← Scene
        ├── GlowLayer         ← Scene   (usa RenderTargetTexture internamente)
        ├── ShadowGenerator   ← key light
        ├── materials         ← controller (fechados no closure)
        ├── pointer/wheel listeners ← canvas, removidos no dispose
        └── disposed: boolean ← o token de ownership, local ao controller
  └── controllerRef.current = controller      ← ownership do React
  └── ResizeObserver + window resize → controller.resize
  └── essentialAssetLoads = Promise.all([7 × ImportMeshAsync])
  └── engine.runRenderLoop(() => scene.render())
  └── ready = essentialAssetLoads.then(...) → espera 1 frame
React unmount → cleanup: cancelled = true, disconnect, removeEventListener,
                controller.dispose(), controllerRef.current = null
```

Ownership é **local ao controller** (`disposed` no closure) — não há estado
global de módulo, e nenhum foi introduzido.

---

## REPRODUCTION BEFORE

A reprodução não dependeu de navegador. `routeBabylonScene.ts` importa Babylon
como `import type * as BABYLON` — **não tem import de runtime** e recebe a
engine por parâmetro. Isso permitiu dirigir o controller **real** com um duplo
estrito, em Node, de forma determinística.

O duplo é **mais rígido que o Babylon**: depois de `scene.dispose()` ou
`engine.dispose()`, qualquer interação com aquela scene/engine é registrada como
violação de ownership. Uma violação significa *"este caminho age sobre um
controller cuja ownership terminou"* — não depende de qual erro o Babylon
resolve lançar hoje.

| Cenário | Antes |
|---|---|
| A — dispose com assets pendentes | ✅ já correto (0 violações) |
| B — retry/remount com assets pendentes | ✅ já correto |
| C — navegar para a Home com assets pendentes | ✅ já correto |
| D — ready → dispose | ✅ já correto |
| E — falha de asset → fallback | ✅ vivo correto · ⚠️ **disposed ainda logava** |
| F — 30 ciclos rápidos mount/unmount | ✅ já correto |
| **H — dispose entre assets chegarem e o ready frame** | ❌ **`ready` ficava `pending` para sempre** |
| **I — referência stale chamando o controller** | ❌ **`updateBoard` 48 · `resize` 6 · `resetView` 5 violações** |

As sete primeiras passavam porque os guards `if (disposed)` **depois de cada
`await`** já existiam e estão corretos. O defeito estava nas duas janelas que
nenhum cenário anterior cobria.

---

## ERROR SIGNATURE

```
TypeError: Cannot read properties of null (reading 'postProcessManager')
```

## TRIGGER

Retry/unmount enquanto assets carregam — e, mais precisamente, **qualquer
chamada a `controller.resize()` depois do dispose**.

## ROOT CAUSE

Duas causas independentes, ambas provadas:

### 1. A superfície pública não defendia a própria ownership

`updateBoard`, `resize` e `resetView` agiam sem condição. A proteção existia
apenas no **consumidor** (o React anulando `controllerRef.current` no cleanup) —
ownership aplicada no lugar errado.

Medido contra um controller disposed: **um único `updateBoard` executou 48
operações numa scene morta** (reconstrói o board inteiro: `TransformNode`s,
meshes, materiais). `resize` → 6, `resetView` → 5.

E é `resize` que fecha a explicação do erro relatado:

```
controller.resize() → engine.resize() → engine.onResizeObservable
  → RenderTargetTexture do GlowLayer responde ao resize
  → mas RenderTargetTexture.dispose() já fez `this._postProcessManager = null`
     (node_modules/@babylonjs/core/Materials/Textures/renderTargetTexture.pure.js:922)
```

`GlowLayer` usa `RenderTargetTexture` internamente e RTTs **se inscrevem em
`engine.onResizeObservable`**. Chamar `resize()` depois do dispose alcança um
`_postProcessManager` que já é `null` — exatamente a assinatura observada.

`resize` é alcançável por `window.addEventListener("resize", controller.resize)`
e pelo `ResizeObserver`. O cleanup remove os dois, mas isso torna a correção
dependente de ordem de entrega de callbacks já enfileirados — e não de uma
invariante.

### 2. `ready` podia nunca resolver

A cadeia de readiness espera o primeiro frame completo via
`scene.onAfterRenderObservable.addOnce(...)`. **`scene.dispose()` limpa
observables sem dispará-los.** Se o dispose caísse entre os assets chegarem e
esse frame, a promise ficava pendente **para sempre**.

`RouteBabylonBoard` fica em `await controller.ready`. A continuação suspensa
retinha o canvas, o controller, o módulo Babylon e o board state pelo resto da
vida da página. É a janela que um "retry enquanto carrega" acerta com
facilidade: os assets chegam, o retry dispara antes do primeiro frame.

---

## POSTPROCESSMANAGER FINDING

Não é uma chamada do nosso código. É o `RenderTargetTexture` do `GlowLayer`
reagindo a `engine.onResizeObservable` depois de `dispose()` já ter anulado o seu
`_postProcessManager`. Por isso **não** foi corrigido pelo nome do erro: a causa
é lifecycle (`resize` após dispose), e o `postProcessManager` é só onde ela
aparece.

## REACT LIFECYCLE FINDING

`RouteBabylonBoard` está **correto** e não foi alterado:

* o guard `cancelled` cobre as duas únicas janelas de `await`;
* `cancelled = true` sempre precede `controller.dispose()`, então a rejeição de
  `ready` nunca fica sem handler;
* refs são por instância, logo um controller antigo não pode chamar `onReady` do
  mount novo nem substituir o ref do controller novo;
* Strict Mode (ligado por padrão no dev do App Router): o cleanup roda
  sincronamente antes de qualquer microtask resolver, então o primeiro
  `mountBabylon` nunca chega a criar um controller.

Nenhum delta de React foi inventado. A correção pertence ao controller.

## ASSET LOAD FINDING

Os guards pós-`await` estavam certos. Os **catch** não: os cinco carregadores
mutavam status e faziam `console.warn` mesmo com a ownership encerrada —
anunciando um fallback procedural que não tinha onde renderizar.

## DISPOSAL ORDER BEFORE

```
stopRenderLoop → roots → protos → materiais → glow.dispose → scene.dispose → engine.dispose
```

Auditada e **mantida**. `stopRenderLoop` vem primeiro, que é o que importa; não
havia evidência para mudar a ordem, então não foi mudada.

## DISPOSAL ORDER AFTER

Idêntica, com dois acréscimos no início:

```
if (disposed) return              ← idempotente
disposed = true
rejectPendingReadyFrame?.(...)    ← liquida readiness ANTES de destruir a scene
stopRenderLoop → … (inalterado)
```

A readiness é liquidada antes de qualquer destruição, porque depois da scene o
observable que ela espera já foi limpo.

---

## FIX DESIGN

Três partes, todas ownership:

1. **Superfície pública inerte** — `updateBoard`, `resize`, `resetView` retornam
   quando `disposed`; `dispose()` é idempotente. Retornam, não lançam: quem
   segura uma referência stale não precisa de try/catch.
2. **`ready` sempre liquida** — `dispose()` rejeita a readiness pendente.
3. **Catch respeita ownership** — os cinco `catch` de asset saem cedo quando
   `disposed`: sem mutação de status, sem log.

## WHY THIS FIX

O token de ownership pedido em §5 **já existia** (`disposed`, local ao closure do
controller). O defeito não era a falta de token — era não consultá-lo na
superfície pública nem nos catch, e uma promise que não conseguia liquidar. Então
a correção mínima adequada é usar o token que já existe, não introduzir um
registro de generations.

Nada aqui engole erro, adianta/atrasa dispose, usa timeout, faz reload, mantém a
scene viva, nem monkeypatch. O objetivo — *"garantir que callbacks antigos não
consigam atuar sobre ownership já encerrada"* — é atingido tornando o controller
inerte, não silenciando o sintoma.

---

## DELTA

### LIFECYCLE PRODUCTION DELTA
`src/games/escape-maze/routeBabylonScene.ts` — único arquivo de produção.

### REACT OWNER DELTA
**Nenhum.** Auditado e correto; alterá-lo seria redundante.

### BABYLON CONTROLLER DELTA
* 4 guards `if (disposed) return;` na superfície pública (incl. `dispose`);
* `rejectPendingReadyFrame` + rejeição no `dispose`;
* guard `if (disposed) return;` no início dos 5 catch de asset.

### TEST / TOOLING DELTA
* `tools/validation/babylon-lifecycle-harness.mjs` — duplo estrito do Babylon;
* `tools/validation/babylon-lifecycle-tests.mjs` — cenários A–I;
* `tools/validation/route-visual-state-tests.mjs` — uma asserção de padrão de
  fonte exigia que `boardAssetStatus = "failed"` fosse a **primeira** instrução
  do catch. O comportamento vivo não mudou (provado pelo cenário E), mas o
  padrão sim. Agora afirma **as duas** metades: a atribuição continua no catch, e
  os cinco catch carregam o guard de ownership.

### EVIDENCE / DOC DELTA
Este README e `babylon-lifecycle.json`.

---

## CONTRATOS

**READY CONTRACT** — canvas oculto enquanto pending; loader visível; revelado só
no frame final; falha de asset revela o fallback procedural final; **um
controller disposed nunca resolve readiness** — rejeita, e agora *sempre*
liquida. O fix recente de visual readiness está preservado
(`READY_FRAME_IS_THE_REVEAL_BOUNDARY` verde).

**ASSET FAILURE CONTRACT** — `PENDING → READY` e `PENDING → FAILED` só produzem
efeito com o controller vivo. `PENDING → DISPOSED` não produz efeito nenhum:
sem status, sem log, sem toque em Scene/Engine. `DISPOSED` é terminal.

**STALE CALLBACK CONTRACT** — nenhuma continuação, callback ou referência stale
pode agir sobre um controller disposed. Medido: 48/6/5 → **0/0/0**.

---

## REPRODUCTION AFTER

| Cenário | Antes | Depois |
|---|---|---|
| H — `ready` liquida no dispose | `pending` (pendurada) | **`rejected`** |
| I — `updateBoard` / `resize` / `resetView` stale | 48 / 6 / 5 | **0 / 0 / 0** |
| E — falha de asset após dispose | logava | **silencioso** |
| A–D, F, G | verdes | verdes |

`BABYLON_LIFECYCLE_OK` · **0 unhandled rejections**.

## STRESS RESULTS

30 ciclos mount/unmount variando o quanto o mount avança (pendente, parcial,
ready):

| | |
|---|---|
| Violações de ownership | **0** |
| Listeners de canvas vazados | **0** |
| Scenes criadas / disposed | 30 / **30** |
| Engines criados / disposed | 30 / **30** |
| Render loops iniciados / parados | 30 / **30** |
| Unhandled rejections | **0** |

## LEAK / RESOURCE OBSERVATIONS

Pareado 1:1 em scenes, engines e render loops; nenhum listener sobrando; GlowLayer
criado e disposed 1:1; nenhum frame renderizado após dispose. **Não reivindico
"zero leak"** — reivindico o que foi medido, e a medição é sobre esta race, não
um profiling de heap.

---

## REGRESSÕES

| Suíte | Veredito |
|---|---|
| `babylon-lifecycle-tests` | `BABYLON_LIFECYCLE_OK` |
| `route-visual-state-tests` | `ROUTE_VISUAL_STATE_CONTRACT_OK` |
| `production-diagnostic-boundary-tests` | `PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_OK` |
| `diagnostic-launcher-tests` | `DIAGNOSTIC_LAUNCHER_OK` |
| `route-difficulty-identity-tests` | `ROUTE_DIFFICULTY_IDENTITY_OK` |
| `difficulty-remount-persistence-tests` | `DIFFICULTY_REMOUNT_PERSISTENCE_OK` |
| `difficulty-rebalance-tests` | `DIFFICULTY_REBALANCE_TESTS_OK` |
| `chest-controlled-tests` | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests` | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests` | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay` (Hunter/Sentinel/traps/portal) | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit` | `STATIC_RENDER_AUDIT_OK` |
| `difficulty-baseline-tests` | `DIFFICULTY_BASELINE_TESTS_OK` |
| `validate-route-9x9` (geração) | `errors: []`, `generationThrows: 0` |

**VISUAL REGRESSION:** nenhuma. 3 Babylon lights, 1 render loop, materiais,
GLBs, câmera, board, walls, player, Hunter/Sentinel, portal, Chest, Pickaxe,
glow e fail-safe procedural intactos — o cenário G afirma luzes e render loop
diretamente.

**GAMEPLAY:** nenhum arquivo de gameplay tocado.

**LAB BOUNDARY:** `/lab/route-launcher` e `/lab/3d-home` prerenderizados em dev,
404 em produção; resultados diagnósticos transitórios; seed contida.

**Registry smoke:** 5 entradas.

---

## RISCOS REMANESCENTES

* O duplo é mais rígido que o Babylon, então uma violação nele é sempre um
  defeito real — mas o inverso não vale: o Babylon pode ter caminhos internos
  que o duplo não modela. O que ficou provado é que **nenhum caminho do nosso
  código** age sobre um controller disposed.
* A race não pôde ser observada num navegador aqui (o painel deste ambiente não
  hidrata; a Home do produto também não). A reprodução é o teste de contrato,
  que é o que §12 prefere.
* `resize()` agora é silencioso quando disposed. Se algum dia alguém quiser saber
  que um resize chegou tarde, precisará de instrumentação — inércia foi a escolha
  deliberada.

## FOLLOW-UPS

Registrados, **fora de escopo** (§18): `final-acceptance.mjs`,
anchor do `instrumented-generator`, validator `--check`/`--update`,
`Activity.skill`, CSS, assets, metadata, dependências R3F.
