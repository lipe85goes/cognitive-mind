# Validation tooling — how to run it

Every validator here answers a question about the repository. Asking a question
does not change the answer, so **a normal run writes nothing**. If what a
validator computes differs from the recorded evidence, it says so and fails; it
never quietly replaces the record.

## The two modes

```bash
node tools/validation/<validator>.mjs
```

`--check` is the default and needs no flag. The validator computes its verdict,
compares it against the evidence in `docs/archive/…`, prints a field-level diff
if they disagree, and writes nothing at all — not even a directory.

```bash
node tools/validation/<validator>.mjs --update
```

Rewrites the evidence, and reports exactly which artifacts changed. Use it when
you have read the diff and the new verdict is the correct one. An `--update`
that decides nothing new writes nothing (`nothing to rewrite`), so it is safe to
run and will not churn the worktree.

Validators that never wrote evidence take no flags — nothing to opt into.

## Exit codes

| code | meaning |
| ---- | ------- |
| 0 | checks passed and evidence matches |
| 1 | the validation itself failed — a contract is broken |
| 2 | evidence divergence in `--check` — the verdict moved |
| 3 | usage error |

Exit 1 and exit 2 mean different things. Exit 1 is "the code is wrong". Exit 2
is "the code changed and the record has not caught up" — read the diff before
deciding which.

## Command sets

**CORE** — the set a normal working session runs. All of it, plus the proof that
running it changed nothing, is one command (about 10 minutes):

```bash
node tools/validation/validation-hygiene-tests.mjs
```

Add `--fast` to skip the four slowest validators (about 1 minute). It proves
immutability exactly the same way, but it does not compare or write evidence: a
subset is a different verdict, not a weaker baseline. Use it while iterating; use
the full run before committing.

**DEEP** — generation acceptance over 1080 seeded maps and 270 continuous
streams, plus the deterministic-recovery proof (about 4 minutes):

```bash
node tools/validation/final-acceptance.mjs
```

**ROUTE PROJECTION** — `data-cell-centers` must describe the camera the board
is drawn with now. Neither writes evidence nor takes `--check`/`--update`:

```bash
node tools/validation/route-projection-tests.mjs           # real Babylon, no browser, ~3 s
node tools/validation/route-projection-browser-probe.mjs   # Playwright, needs a running app
```

The first runs the real controller on `@babylonjs/core` with a `NullEngine` and
also proves it would catch the regression (a counterfactual build without the
fix must fail). The second drives the app through start-after-resize, a blocked
step, Detalhes, Centralizar and a viewport resize; with `--entry launcher`
against `next dev` it also compares the board's pixels with a `--baseline` run.

**EVIDENCE UPDATE** — after a deliberate change, once you have read the diffs:

```bash
node tools/validation/<validator>.mjs --update
```

## Verdict data vs run metadata

Evidence separates *what the validator concluded* from *when and how the run
happened*. Timestamps, wall-clock timings and machine details are declared as
run metadata: they are excluded from the comparison and carried over unchanged
when the verdict has not moved. Everything else is verdict data, and a
difference there is a real signal that fails the check.

## Line endings

The repository is checked out with `core.autocrlf=true` and has no
`.gitattributes`, so a file git wrote is CRLF while a file a tool wrote is LF.
Two consequences the tooling handles explicitly:

- Writes reproduce the existing file's line endings, so an unchanged verdict can
  never show up as a diff.
- `instrumented-generator.mjs` normalises production source before instrumenting
  it, and exposes `productionSource()`. **Any caller that builds a textual anchor
  must take the source from there**, never from its own `readFileSync` — an
  anchor with the wrong line endings matches nothing, and a `replace` that
  matches nothing turns a counterfactual harness into a silent no-op.
