# ROTA-DYNAMIC-SOLVABILITY-01 evidence

Exact nondeterministic PRE_CHEST_BASELINE for Rota Estratégica. No production file, map,
threshold, defender policy, or runtime state is changed.

## Status flags

- PRE_CHEST_BASELINE = true
- BASELINE_COMPLETE = false
- RESOURCE_BOUND = true
- DYNAMIC_SOLVABILITY_02_REQUIRED = true

## Reproduce

```powershell
node tools/validation/dynamic-solver-equivalence-run.mjs
node tools/validation/dynamic-solver-performance-run.mjs
node tools/validation/dynamic-solvability-campaign.mjs --suspects --resume
node tools/validation/dynamic-solvability-campaign.mjs --sample --resume
node tools/validation/dynamic-solvability-finalize.mjs --validations-passed
```

## Evidence map

- Runtime/RNG: `determinism-probe.json`, `rng-support-contract.md`,
  `runtime-solver-equivalence.json`.
- State/transition: `dynamic-state-contract.md`, `dynamic-transition-contract.md`,
  `successor-enumerator-design.md`.
- Solver/equivalence/performance: `solver-design.md`,
  `solver-encoding-equivalence.json`, `solver-performance.json`,
  `solver-controlled-tests.json`.
- Campaigns: `suspect-seeds-analysis.json`, `dynamic-solvability-sample.json`,
  `oscillation-scc-analysis.json`, `trap-necessity-analysis.json`,
  `dead-region-analysis.json`, `human-review-candidates.json`.
- Closeout: `findings.md`, `route-dynamic-solvability-01-acceptance.json`.
- Resumable case records: `work/<campaign-hash>/cases/`.

## Post-chest golden regression cases

- seed 8801214, route 1, mode hard: POST_CHEST_REGRESSION_TARGET = true
- seed 8801107, route 1, mode medium: POST_CHEST_REGRESSION_TARGET = true

Both remain unchanged for ROTA-DYNAMIC-SOLVABILITY-02.

## Future resource-bound work

A selective --only-inconclusive mode, larger budgets, and an exact open-addressed visited
structure if memory becomes limiting are valid future improvements. Do not run them in this
checkpoint: Chest will change the state space through Pickaxe, breakable walls, Second Chance,
and reward choice.

## Lint audit

PRE_EXISTING_LINT_WARNINGS_AT_CHECKPOINT = 9, all @typescript-eslint/no-unused-vars:
four inherited from the solver-ready runner and five introduced during the prior
performance continuation. All were fixed locally; lint now reports 0 errors and 0 warnings.

Current verdict: **ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND**.
