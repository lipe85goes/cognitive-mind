# Records this correction supersedes — and what they measured at their own commit

ROTA2-SENTINEL-SOLVER-FIDELITY-03 changes what the reference solvers answer on
one class of states (the Sentinel's target is an armed trap; see
`docs/ROTA2_SENTINEL_SOLVER_FIDELITY_03.md`). Any recorded number derived from
those solvers on such a state moves. Nothing else can: for a walkable target
the shared helper returns exactly the table read the solvers made before, so a
changed output always involves an armed-trap target.

Procedure, per record: run its validator in `--check` on the exact base
`f5826b2` (scratch worktree) and on this tree; the base must reproduce the
record exactly; every field that differs on this tree must be a solver output.

## Check-mode census records — updated, verdicts unchanged

Both validators' checks pass on both trees (`ROTA2_DYNAMIC_TRAPS_CENSUS_OK`
16/16, `ROTA2_OBJECTIVES_CENSUS_OK` 22/22). On the base both records
**MATCH**. On this tree they diverge only in the fields below, all solver
outputs; they were rewritten with `--update`. The values on the left are what
each mission measured at its own commit with the pre-correction solver, and
they stay true of that commit (git history keeps the files as they were).

### `docs/archive/rota2-dynamic-traps-01/census.json`

The one map of the 72-map solver sample whose class moves: **R3 easy 9230007**,
Rota 2.0 rules `I → P` (its v1 class was already `P`). The base solver ran out
of its 3 M-state budget on states where the Sentinel had dropped a door the hook
keeps; the corrected model explores 2 165 940 states and concludes.

| field | recorded (pre-correction) | this tree |
| ----- | ------------------------- | --------- |
| `solver.rota2.P` | 45 | 46 |
| `solver.rota2.I` | 7 | 6 |
| `solver.transitions.P->P` | 43 | 44 |
| `solver.transitions.P->I` | 1 | (absent) |
| `solver.unchanged` | 58 | 59 |
| `solver.inconclusive` | 7 | 6 |

Runtime differential unchanged: 1840 transitions, 0 unsound.

### `docs/archive/rota2-dependent-objectives-02/census.json`

| field | recorded (pre-correction) | this tree | why |
| ----- | ------------------------- | --------- | --- |
| `adversarial.traps01.P` / `.I` | 45 / 7 | 46 / 6 | 9230007 `I → P` (DYNAMIC-TRAPS-01 rules) |
| `adversarial.objectives02.P` / `.I` | 45 / 7 | 46 / 6 | 9230007 `I → P` (product rules) |
| `adversarial.byRoute.3.traps01.P` / `.I` | 11 / 6 | 12 / 5 | the same map |
| `adversarial.byRoute.3.objectives02.P` / `.I` | 11 / 6 | 12 / 5 | the same map |
| `adversarial.transitions.P->P` / `I->I` | 45 / 7 | 46 / 6 | the same map |
| `adversarial.unchanged` / `.inconclusive` | 65 / 7 | 66 / 6 | the same map |
| `runtime.differential.unsound` | 8 | 0 | the 8 turns filed as `defenderModelGap` (seed 9231007, R3 medium) were this class |
| `runtime.differential.defenderModelGap` | 8 | 0 | idem |
| `runtime.differential.gapExamples` | 3 examples | (none) | idem |
| `referenceGap.v1-9f8ebb5` | 2016 / 25 / 7 / 18 | 2016 / 0 / 0 / 0 | the gap this mission corrects |
| `referenceGap.this-tree` | 2016 / 25 / 7 / 18 | 2016 / 0 / 0 / 0 | idem |

(`referenceGap` fields: transitions / unsound / heldDoorArmed / other.)
`referenceGapIsPreExisting` still holds (0 = 0 on the v1 tree and here). The
adversarial comparison between the two missions' rules is unchanged: 0 harder,
0 easier, Route 1 unchanged.

`docs/ROTA2_DEPENDENT_OBJECTIVES_02.md` §7 ("25 de 2016 transições, idênticas
na árvore v1") is left as written: it is what that mission measured, and this
mission reproduces it on the base (fidelity suite S02 `portalRushReplay`:
25 of 2016 with the pre-mission solver, 0 with the corrected one).

## Legacy always-rewrite records — not touched

`dynamic-solver-equivalence-run.mjs` and `dynamic-solvability-run.mjs`
(ROTA-DYNAMIC-SOLVABILITY-01) rewrite `docs/archive/route-dynamic-solvability-01/`
on every run. They were run in scratch worktrees of both trees, never in this
one, and their archive is unchanged here:

- on the base itself they already rewrite 5 files and add 5 witnesses (e.g.
  `suspect-seeds-analysis.json` differs from the record in 705 fields): drift
  that predates this mission;
- base vs this tree: `runtime-solver-equivalence.json`,
  `solver-controlled-tests.json`, `solver-encoding-equivalence.json` and 8 of
  9 witnesses identical; `suspect-seeds-analysis.json` differs only in
  state/transition counts of cases that hit the state limit either way (same
  truncation, same labels) and in seed 8801012's shortest witness, whose
  Sentinel now keeps its door (`…|-1|0|…` → `…|1|1|…`) as the hook does.

The other legacy writers are listed with their results in `regression.md`.
