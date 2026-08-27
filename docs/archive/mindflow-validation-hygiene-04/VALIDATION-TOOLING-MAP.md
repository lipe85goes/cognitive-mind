# VALIDATION TOOLING MAP

*MINDFLOW-VALIDATION-HYGIENE-04 · read-only audit of `tools/validation` at HEAD `b4e7b2b`.*

67 `.mjs` files. The classification below is what each file **is**, not what it
was named after. Only the CORE and DEEP sets are run in a normal working session;
that is the boundary this mission's hygiene contract applies to.

## A. CORE CHECK — run in a normal session (15)

Live contracts, checked against recorded evidence. All were converted to the
`--check` / `--update` contract by this mission: a normal run writes nothing.

| validator | evidence directory | run metadata declared | ~time |
| --------- | ------------------ | --------------------- | ----- |
| `route-visual-state-tests.mjs` | `route-visual-state-06` | — | 0.1s |
| `chest-static-render-audit.mjs` | `route-chest-rewards-01` | — | 0.1s |
| `babylon-lifecycle-tests.mjs` | `route-babylon-lifecycle-07-async-dispose` | — | 0.7s |
| `production-diagnostic-boundary-tests.mjs` | `mindflow-production-boundary-02` | `generatedAt` | 0.5s |
| `trap-strategy-tests.mjs` | `route-traps-strategy-01` | — | 4.9s |
| `chest-controlled-tests.mjs` | `route-chest-rewards-01` | — | 12.1s |
| `diagnostic-launcher-tests.mjs` | `route-difficulty-04c-diagnostic-launcher` | — | 13.5s |
| `difficulty-remount-persistence-tests.mjs` | `route-difficulty-04b-remount-persistence` | — | 20.4s |
| `second-chance-controlled-tests.mjs` | `route-chest-rewards-01` | — | 22.6s |
| `chest-runtime-gameplay.mjs` | `route-chest-rewards-01` | — | 47.5s |
| `difficulty-rebalance-tests.mjs` | `route-difficulty-05-rebalance/regressions/rebalance-focused` | — | 55.6s |
| `difficulty-baseline-tests.mjs` | `route-difficulty-04-baseline` | — | 56.6s |
| `pickaxe-controlled-tests.mjs` | `route-chest-rewards-01` | — | 90.2s |
| `route-difficulty-identity-tests.mjs` | `route-difficulty-04a-ui-identity-fix` | — | 265.9s |
| `validation-hygiene-tests.mjs` *(new)* | `mindflow-validation-hygiene-04` | — | runs the 14 above |

Nine honour a `ROUTE_VALIDATION_OUT` / `ROUTE_VALIDATION_OUTPUT_DIR` override, the
mechanism earlier missions used to file a re-run under their own directory. The
two spellings are inconsistent — recorded, not changed, because renaming one
would silently break the archived call recipes that use it.

## B. DEEP CHECK — expensive acceptance gate (1)

| validator | evidence directory | run metadata declared | ~time |
| --------- | ------------------ | --------------------- | ----- |
| `final-acceptance.mjs` | `route-dual-guardians-maps-01a/current` | `route3HardFinal` | ~250s |

Was broken at HEAD and is repaired by this mission. See
`docs/archive/route-dual-guardians-maps-01a/README-current.md` for why its
baseline moved to a `current/` subdirectory.

## C. LIBRARY — imported, never executed standalone (15)

`evidence.mjs` *(new)*, `instrumented-generator.mjs`, `route-runtime-harness.mjs`,
`route-lab.mjs`, `babylon-lifecycle-harness.mjs`, `breakable-wall-certifier.mjs`,
`dual-guardian-balance.mjs`, `dual-guardian-lab.mjs`, `dynamic-solver.mjs`,
`dynamic-solver-packed.mjs`, `dynamic-solver-packed-graph.mjs`,
`dynamic-solver-packed-scc.mjs`, `dynamic-solver-packed-solve.mjs`,
`dynamic-solver-packed-successors.mjs`, `dynamic-solvability-campaign-lib.mjs`.

`instrumented-generator.mjs` is the only one that rewrites production source
text. That is where DÉBITO 1 lived; it is also where this mission put the fix.

## D. EVIDENCE GENERATOR — one-shot analysis, not a gate (24)

`analyse-dual-balance`, `analyse-dual-guardians`, `analyse-dynamic-pincer`,
`analyse-route-maps`, `adversarial-resource-analysis`, `adversarial-runtime-replay`,
`autopsy-generation`, `breakable-wall-feasibility`, `chest-acceptance`,
`diagnose-fallback`, `difficulty-baseline-run`, `difficulty-rebalance-run`,
`dynamic-solver-equivalence-run`, `dynamic-solver-performance-run`,
`escape-generation-autopsy`, `escape-generation-close`, `final-rejection-autopsy`,
`golden-seeds-post-chest-input`, `inspect-route-board-glb`,
`render-route-9x9-evidence`, `star-capacity-proof`, `star-selection-proof`,
`test-pincer-classifier`, `test-star-selection`.

These ran once, during the mission that needed them, and their conclusions are
archived. They still write unconditionally. **They are not part of DÉBITO 2**:
they are not run in a normal session, so they were not a source of the recurring
churn — the BEFORE measurement confirms which validators actually dirtied the
worktree, and none of these were among them. Converting all 24 would be the
general refactor this mission was told not to perform.

## E. CAMPAIGN — long-running, checkpointed exploration (6)

`adversarial-solvability-run`, `dynamic-solvability-02`,
`dynamic-solvability-campaign`, `dynamic-solvability-finalize`,
`dynamic-solvability-resource-closeout`, `dynamic-solvability-run`.

`dynamic-solvability-campaign-lib` writes through a `.tmp-<pid>-<now>` file and
renames — the only tool here that already had a deliberate write discipline.

## F. CLOSEOUT / SUPERSEDED (6)

`sentinel-runtime-closeout`, `sentinel-runtime-equivalence`, `trap-strategy-closeout`,
`validate-route-9x9`, `verify-graph-equivalence`, `verify-route-board-alignment`.

`validate-route-9x9.mjs` only writes when `--report <path>` is passed, so it was
already opt-in and is not a churn source; it does carry `generatedAt` and
`elapsedMs` in that report. `verify-route-board-alignment.mjs` is the only tool
that spawns a subprocess (`inspect-route-board-glb.mjs`) — checked as part of the
§16 call-site audit, and unaffected by the default-mode change.

## Findings recorded, not fixed

- 26 executable tools never set `process.exitCode`, so a failure exits 0. Two of
  them were in the CORE/DEEP sets and are fixed here (`trap-strategy-tests`,
  `final-acceptance`); the remaining 24 are analysis tools whose output is read
  by a human, not a gate.
- `ROUTE_VALIDATION_OUT` vs `ROUTE_VALIDATION_OUTPUT_DIR` — two names for one
  concept.
- The repository has no `.gitattributes` while `core.autocrlf=true`, which is the
  root cause behind both debts. Adding one would renormalise the whole worktree
  in a single commit — far outside this mission's delta budget, and recorded here
  as the durable fix rather than performed.
