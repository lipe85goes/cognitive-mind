# Regression — exact base `f5826b2` vs this tree

The base was checked out as a scratch git worktree (node_modules linked), so
every `--rev`/`git show` a validator makes still resolves. Validators that
rewrite their archive on every run were run only in scratch worktrees of both
trees; this tree's archive was never written by them.

Only tooling changed (`git diff f5826b2 -- src/` is empty), so a validator
that does not load the reference solvers runs the same code on both trees.
Those that do load them: the fidelity suite and census (this mission), the
Dynamic Traps census, the Dependent Objectives suite (O26) and census, and the
ROTA-DYNAMIC-SOLVABILITY-01 / ROTA-ADVERSARIAL-SOLVABILITY-03 runners.

## Solver consumers

| validator | base `f5826b2` | this tree | difference |
| --------- | -------------- | --------- | ---------- |
| fidelity suite S00–S12 | `[fidelity]` 4/4 fail, `[preserved]` 9/9 hold (counterfactual holds) | 13/13 | the corrected class only |
| fidelity mutants M01–M12 | — | 12/12 caught | — |
| fidelity census (1080 maps) | 1 031 hook turns / 87 870 production pairs / 86 824 static pairs wrong, all BLOCKED_KEPT | 0 / 0 / 0 | the corrected class only |
| `rota2-dynamic-traps-census.mjs` | 16/16 checks, evidence **MATCHES** | 16/16 checks; evidence differed only in 9230007 `I → P` → record updated | `superseded-records.md` |
| `rota2-dependent-objectives-census.mjs` | 22/22 checks, evidence **MATCHES** (referenceGap 25, defenderModelGap 8) | 22/22 checks; evidence differed only in solver outputs → record updated | `superseded-records.md` |
| `rota2-dependent-objectives-tests.mjs` | 30/30, evidence MATCHES | 30/30, evidence MATCHES (O26: 431 transitions, 0 unsound on both) | none |
| `dynamic-solver-equivalence-run.mjs` (legacy) | `SOLVER_ENCODING_EQUIVALENCE_OK` | same, output identical | none (it samples states before any trap is armed — why the gap went unseen) |
| `dynamic-solvability-run.mjs` (legacy) | `SOLVER_SOUNDNESS_OK` | same | suspects: state counts of limit-truncated cases; 8801012's witness keeps its door |
| `dynamic-solver-performance-run.mjs` (legacy) | `SOLVER_PERFORMANCE_PROFILE_OK` | same | timing percentages only |
| `adversarial-solvability-run.mjs` (legacy) | `ACTUAL_RUNTIME_WITNESSES_FOUND` | same, output identical | none |
| `adversarial-resource-analysis.mjs` (legacy) | `RESOURCE_LIMIT_LOWER_BOUNDS_FAILED` (pre-existing: 8801204 step 7 and 8801207 step 3 invalid) | same verdict; also 8801012 step 18 and 8801108 step 25 invalid | see below |

**Archived witnesses.** `adversarial-resource-analysis.mjs` re-validates the
shortest witnesses ROTA-DYNAMIC-SOLVABILITY-02A archived (the record says all
seven valid). The fidelity suite now judges every step of every archived
witness (10 witnesses, 185 steps) by production — the string reference — and
requires the solver to accept a step iff production does (S06
`archivedWitnesses`). Production rejects five steps:

| witness step | production | base solver | corrected solver | class |
| ------------ | ---------- | ----------- | ---------------- | ----- |
| 8801012 step 18 | rejects | **accepts** | rejects | the corrected one: the Explorer arms the held door (3,5); the archived successor drops it (`…\|-1\|0\|…`), production keeps it (`…\|1\|1\|…`) |
| 8801108 step 25 | rejects | **accepts** | rejects | the corrected one |
| 8801204 step 7 | rejects | rejects | rejects | pre-existing, unrelated: the archive no longer matches today's production (already invalid on the base) |
| 8801207 step 3 | rejects | rejects | rejects | pre-existing, unrelated (already invalid on the base) |
| 8801212 step 2 | rejects | rejects | rejects | pre-existing, unrelated (not a STATE_LIMIT case, so the resource analysis does not read it) |

The base fails S06 on the first two; this tree passes. 8801012 stays winnable in
the corrected model: the corrected `dynamic-solvability-run.mjs` finds a 21-step
witness through `3,5|3,7|1,7|1|1|7|1` (the door kept) ending in WIN.

## Everything else (same code on both trees)

| validator | result | base |
| --------- | ------ | ---- |
| `route-defenders-extraction-tests.mjs` (C3) | 19/20 — P5 "every other Rota module untouched" | identical check lines |
| `route-state-reducer-tests.mjs` (C5) | 41/42 — P2 | identical |
| `route-domain-events-tests.mjs` (C6) | 34/35 — P2 | identical |
| `route-generation-lifecycle-tests.mjs` (C7B) | 35/36 — P3 | identical |
| `route-generation-worker-tests.mjs` (C7C) | 40/41 — P3 | identical |
| `route-generation-extraction-tests.mjs` (C2) | 21/21 | — |
| `route-worker-rng-handoff-tests.mjs` (C7A) | OK | — |
| `rota2-dynamic-traps-tests.mjs` | 28/28, evidence MATCHES | — |
| `rota2-dynamic-traps-edit.mjs`, `rota2-dependent-objectives-edit.mjs` | exact reversals | — |
| `route-journey-ownership-tests.mjs` / `route-journey-terminal-tests.mjs` | 7/7 / 13/13 | — |
| `game-continuation-contract-tests.mjs` | 21/21 | — |
| `route-board-loader-tests.mjs` | 7/7 | — |
| `gameplay-platform-lock-v1.mjs` | 21/21; `--counterfactuals` hold | — |
| `route-validation-coupling-gate.mjs` | 6/6 (no new allowlist entry) | — |
| `sentinel-runtime-equivalence.mjs` (legacy) | `SENTINEL_RUNTIME_OK`, outputs identical to base | identical |
| `dynamic-solvability-02.mjs` (legacy) | `DYNAMIC_SOLVABILITY_02_OK`, output identical to base | identical |

The five pre-existing failures (C3 P5, C5 P2, C6 P2, C7B P3, C7C P3) are the
ones ROTA2-DEPENDENT-OBJECTIVES-02 recorded: each extraction suite's "every
other module untouched" against its own historical base.

## Final checks (this tree)

| check | result |
| ----- | ------ |
| `npm run lint` | 0 errors, the base's 5 warnings (none in this mission's files) |
| `tsc --noEmit` | clean |
| `next build` | ok; all 263 static client files byte-identical to the base build (13 194 899 bytes of chunks; build-id manifests excluded) |
| `git diff --check` | clean |
| `git diff f5826b2 -- src/` | empty |
| CORE `validation-hygiene-tests.mjs` | 15/15, `CORE_BATTERY_PASSED`, read-only proven, evidence MATCHES |
| DEEP `final-acceptance.mjs` | structural 1080 / continuous 270 / recovery OK, 5 records MATCH |
| fidelity census `--check` on the final code | 11/11 checks, `ROTA2_SENTINEL_FIDELITY_CENSUS_OK`, evidence MATCHES |
| `rota2-dependent-objectives-tests.mjs --mutants` | 16/16 caught (M14, the solver on the old win rule, by O25/O26) |
