# MINDFLOW-VALIDATION-HYGIENE-04

Two debts in the validation infrastructure, which turned out to share one root
cause.

- **DÉBITO 1** — `final-acceptance.mjs` could not run. It threw
  `generator shape changed: isValidMap return` before its first phase.
- **DÉBITO 2** — running the validators normally rewrote evidence JSONs, so a
  routine check left the worktree dirty and the session ended in `git restore`.

## The shared root cause

The repository is checked out with `core.autocrlf=true` and has no
`.gitattributes`. The blob git stores is LF; the file git writes into the working
copy is CRLF; a file a tool writes is LF. So **whether any given file is LF or
CRLF on disk depends on whether git last touched it**, not on anything in the
code.

That single fact produced both debts:

- `instrument()` anchors on LF-shaped literals — `"  return (\n"`, `"\n  );"`.
  When `useEscapeMaze.ts` was CRLF, `lastIndexOf("  return (\n")` returned `-1`
  and the harness refused to run. **The `isValidMap` conjunction itself was
  intact** — the same text, normalised to LF, parses into all 23 conjuncts.
- Every validator wrote its evidence unconditionally, in LF, over a CRLF
  checkout. `git status` reported a modification even when every byte of meaning
  was identical.

The two debts also fed each other: the routine cure for the dirty worktree was
`git checkout` / `git restore`, and a checkout is exactly what converts a file to
CRLF.

## Measured, not assumed

Of the 14 CORE validators, 12 dirtied the worktree on a normal run. The two that
did not — `difficulty-remount-persistence-tests` and `difficulty-rebalance-tests`
— are precisely the two whose evidence files are still **LF** on disk. Every one
of the 12 that dirtied writes to a **CRLF** file. The correlation is exact.

| file | EOL on disk | dirtied by a normal run |
| ---- | ----------- | ----------------------- |
| `difficulty-remount-persistence.json` | LF | no |
| `difficulty-rebalance-tests.json` | LF | no |
| `visual-state-contract.json` | CRLF (103) | yes |
| `babylon-lifecycle.json` | CRLF (131) | yes |
| `chest-controlled-tests.json` | CRLF (327) | yes |

For most of them `git diff` was empty while `git status` showed ` M`: there was
no content change at all.

## The contract

A normal run is `--check` and writes nothing — not a file, not a directory.
`--update` is explicit, rewrites, and names every artifact it changed. Evidence
separates **verdict data** (compared; a difference fails loudly with a
field-level diff) from **run metadata** (timestamps, wall-clock timings —
excluded from the comparison, and carried over unchanged when the verdict has not
moved, so `--update` is a no-op when nothing was decided differently).

Exit codes: `0` agreement · `1` the validation failed · `2` evidence diverged ·
`3` usage. A broken contract outranks a stale record, so a real regression is
never reported as "the record is old".

`tools/validation/README.md` is the operating guide.

## What the new check found

Turning the silent overwrite into a comparison surfaced a backlog. Eight CORE
artifacts disagreed with what their validator computes at HEAD, **while every one
of those validators' contracts still passed**:

| artifact | why it had drifted |
| -------- | ------------------ |
| `chest-static-render-audit.json` | still described the R3F era (`BOTH_RENDERERS_CARRY_EVERY_STATE`); the legacy renderer was removed in `e25921a` |
| `trap-controlled-tests.json` | trap cells moved (`2,0` → `1,3`) |
| `chest-controlled-tests.json` | generation drift |
| `second-chance-controlled-tests.json` | generation drift |
| `chest-runtime-gameplay.json` | generation drift |
| `pickaxe-controlled-tests.json` | generation drift |
| `diagnostic-launcher.json` | generation drift |
| `difficulty-baseline-tests.json` | generation drift |
| `route-difficulty-identity.json` | generation drift |

The generation drift is real and expected: ROTA-DIFFICULTY-04C added the
`route-random.ts` seam and ROTA-DIFFICULTY-05 rebalanced the difficulty profiles,
which change which template a given seed selects. These records stayed stale
because every run recomputed the current values and every `git restore`
discarded them — the workaround was not just untidy, it was actively throwing
away the answer.

All were re-recorded with `--update` in this mission, each after confirming the
validator's own contract verdict was `OK` (exit 2, never exit 1).

`final-acceptance`'s archive was handled differently, because it is a closed
mission's final report rather than a live baseline — see
`docs/archive/route-dual-guardians-maps-01a/README-current.md`.

## FINAL_ACCEPTANCE_HAS_UNIQUE_COVERAGE = YES

The one plausible replacement is `validate-route-9x9.mjs`, which also generates
maps and re-audits them (`validateMap`) against bounds, overlaps, reachability,
solvability, wall counts, junctions, chest placement and guardian exits. The
overlap is real, but three things only `final-acceptance` covers:

1. **Escape width on the resolved objective route.** `final-acceptance.auditMap`
   calls `resolveObjectiveRoute`, then `routeCellsHaveEscape`, then
   `escapeGeometryIsPossible`. `validate-route-9x9.mjs` contains **no reference to
   any of those four symbols** — it asserts the objective is *solvable*, never
   that the route production actually resolves has escape width. That property is
   what ROTA-DUAL-GUARDIANS-MAPS-01A existed to establish.
2. **Continuous, non-reseeded streams.** `validate-route-9x9` calls
   `setSeed(seed)` once per map. FASE 2 seeds once per combination and generates
   30 maps on that single PRNG stream — the regime the runtime actually uses, and
   the only place PRNG state carried between maps is exercised.
3. **The recovery proof.** FASE 5 caps the random phase at one attempt in an
   in-memory copy to *force* the recovery sweep, then proves the map it returns
   passes the same contract audit — no bypass, no uncertified fallback.
   `validate-route-9x9` reimplements a recovery loop but never forces the random
   phase to fail, so it never demonstrates recovery is reachable or that its
   output is certified.

Retiring the gate would therefore have dropped coverage that exists nowhere else.
**Outcome A — REPAIR.**

`validate-route-9x9.mjs` also has its own sandbox loader and its own
`createSeededRandom`, which is why it was never affected by DÉBITO 1.

## Files

- `VALIDATION-TOOLING-MAP.md` — the §1 read-only audit of all 67 tools.
- `validation-check-is-read-only.json` — the §10 immutability proof.
- `before-after.md` — the reproduction of both defects, before and after.
