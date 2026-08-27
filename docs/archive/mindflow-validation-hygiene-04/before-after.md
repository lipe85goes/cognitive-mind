# BEFORE / AFTER

Both defects reproduced at HEAD `b4e7b2b` before anything was changed.

---

## DÉBITO 1 — `final-acceptance` could not run

### BEFORE

```
$ node tools/validation/final-acceptance.mjs
tools/validation/instrumented-generator.mjs:104
  if (retStart < 0 || retEnd < 0) throw new Error("generator shape changed: isValidMap return");
                                        ^
Error: generator shape changed: isValidMap return
    at instrument (tools/validation/instrumented-generator.mjs:104:41)
    at loadInstrumented (tools/validation/instrumented-generator.mjs:156:7)
    at tools/validation/final-acceptance.mjs:28:13
exit=1
```

It threw at import, before FASE 1. Nothing about the gate had ever been observed.

### Isolating the cause

Two candidates: the line endings, or the `isValidMap` conjunction (which this
session's earlier ROTA-CHEST-REWARDS-01 had edited — `shieldUseful` became
`chestUseful`). They were tested independently, on the same source text:

| candidate | result |
| --------- | ------ |
| **A — line endings** | **CONFIRMED.** As read from the worktree (CRLF): `retStart = -1`. The identical text normalised to LF: `retStart = 3411`, `retEnd = 4299`, all **23 conjuncts** parsed. |
| **B — the conjunction's shape** | **RULED OUT.** The `return ( … );` block is intact and well formed; `chestUseful` parses as one of the 23. |

`useEscapeMaze.ts` in the working copy holds 3252 CRLF pairs. `instrument()`
searches for `"  return (\n"`. On CRLF text that literal cannot match.

A near miss worth recording: with `retStart = -1`, `indexOf("\n  );", -1)`
searched from 0 and returned a *plausible* `950`. The guard caught it only
because it tests `retStart` as well.

### The fix

One seam, at the single point where the harness reads production source
(`tools/validation/instrumented-generator.mjs`):

```js
export const normalizeSource = (text) => text.replace(/\r\n/g, "\n");

function readProductionSource(file) {
  return normalizeSource(fs.readFileSync(file, "utf8"));
}
```

Preferred over widening each anchor to `\r?\n`, because there is one read of
production source and therefore one place to make every present and future
anchor stable. `route-runtime-harness.mjs:112` had already been patched with an
ad-hoc `\r?\n` in an earlier mission — the same defect, treated one anchor at a
time.

### A second defect the repair exposed

With the seam in place `final-acceptance` ran end to end, and **FASE 5 reported
`recovery acionada em 0/9`** — the recovery sweep was never entered.

`final-acceptance` built its transform anchor from its *own* second read of the
file:

```js
const capLine = fs.readFileSync(HOOK, "utf8").split("\n").find(…);  // carries a trailing \r
const RECOVERY = loadInstrumented({ transform: (src) => src.replace(capLine, SHORT_RANDOM) });
```

`src` was now LF and `capLine` still carried `\r`, so `replace` matched nothing
and returned the source unchanged. The harness measured **unmodified production**
while reporting on it as though the cap had been shortened. Worse, the phase
printed `FALHOU` and the process still exited `0`.

Both were fixed: the anchor now comes from `productionSource()` — the same text
`transform` receives — the transform asserts the replacement actually happened,
and every phase reaches the exit code.

### AFTER

```
FASE 1 — estrutural final
  TOTAL: 1080/1080 · throws 0 · falhas de auditoria 0
FASE 2 — contínuo final
  TOTAL: 270/270 · throws 0
FASE 5 — recovery determinística
  recovery acionada em 9/9 combinações · mapa certificado pela recovery em 9/9
  todos passam a mesma auditoria de contratos: sim

resumo:
  estrutural 1080: OK (1080/1080, throws 0, auditoria 0)
  contínuo 270:    OK (270/270, throws 0)
  recovery:        OK
```

Recovery entry went from **0/9 to 9/9**.

---

## DÉBITO 2 — a normal check dirtied the worktree

### BEFORE

A single validator, run the ordinary way, on a clean tree:

```
$ git status --porcelain
LIMPA

$ node tools/validation/route-visual-state-tests.mjs
ROUTE_VISUAL_STATE_CONTRACT_OK
exit=0

$ git status --porcelain
 M docs/archive/route-visual-state-06/visual-state-contract.json

$ git diff docs/archive/route-visual-state-06/visual-state-contract.json
(no output)
```

Verdict unchanged, file "modified", and `git diff` empty — the difference was
purely line endings. `core.autocrlf=true`, no `.gitattributes`: the blob is LF,
the checkout is CRLF, the tool writes LF.

Running the CORE set one at a time, restoring between each:

| validator | exit | files dirtied |
| --------- | ---- | ------------- |
| `babylon-lifecycle-tests` | 0 | 1 |
| `route-visual-state-tests` | 0 | 1 |
| `production-diagnostic-boundary-tests` | 0 | 1 |
| `diagnostic-launcher-tests` | 0 | 1 |
| `route-difficulty-identity-tests` | 0 | 1 |
| `difficulty-remount-persistence-tests` | 0 | **0** |
| `difficulty-baseline-tests` | 0 | 1 |
| `difficulty-rebalance-tests` | 0 | **0** |
| `chest-controlled-tests` | 0 | 1 |
| `chest-runtime-gameplay` | 0 | 1 |
| `chest-static-render-audit` | 0 | 1 |
| `pickaxe-controlled-tests` | 0 | 1 |
| `second-chance-controlled-tests` | 0 | 1 |
| `trap-strategy-tests` | 0 | 1 |

12 of 14. The two exceptions are the confirmation, not an anomaly: they are
exactly the two whose evidence files are still LF on disk.

| evidence file | EOL on disk | dirtied |
| ------------- | ----------- | ------- |
| `difficulty-remount-persistence.json` | LF | no |
| `difficulty-rebalance-tests.json` | LF | no |
| `visual-state-contract.json` | CRLF (103) | yes |
| `babylon-lifecycle.json` | CRLF (131) | yes |
| `chest-controlled-tests.json` | CRLF (327) | yes |

### AFTER

`node tools/validation/validation-hygiene-tests.mjs` snapshots size, SHA-256 **and
mtime** of every file under `docs/archive`, runs all 14 CORE validators as
subprocesses in their default mode, then re-snapshots:

```
baseline: 775 arquivos de evidência
imutabilidade:
  arquivos criados          : 0
  arquivos apagados         : 0
  conteúdo alterado         : 0
  reescritos com o mesmo conteúdo (mtime mexeu): 0
  git status idêntico       : sim

VALIDATION_CHECK_IS_READ_ONLY
```

The mtime check is deliberate: a validator that wrote a file and restored it
afterwards would still fail this test. Nothing is restored, because nothing is
written.
