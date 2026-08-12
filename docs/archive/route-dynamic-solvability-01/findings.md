# Findings — exact pre-chest dynamic baseline

## Proven model facts

The runtime is nondeterministic because of the Hunter. Runtime soundness remains
32,880 observed transitions with
0 outside formal support. Sampling is complementary; completeness is justified from actual
RNG branches.

The packed encoder is lossless (36,009
states, 0 collisions/splits/mismatches), successor identity is exact
(6,480 pairs, 0 mismatches), and the
new attractors are equivalent (5,263
states, 0 mismatches).

## Performance finding

The earlier bottleneck attribution was wrong. On seed 8801008, the instrumented reference
spent 0.25% in canonical encoding
and 98.91% in successor enumeration.
Repeated Sentinel pathfinding dominated; string encoding did not.

The packed/precomputed solver reached 155,883
states/s versus the historical 459 states/s,
a 339.6x gain without pruning.

## Twelve suspect seeds

All 12 were executed, and all 12 archived suspicious states were exactly replayed from the
original seeded agent (12/12 metadata matches). Initial verdicts:

- 2 GUARANTEED_SOLVABLE_PRE_CHEST;
- 6 POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST;
- 2 PROVED_UNSOLVABLE_PRE_CHEST;
- 2 INCONCLUSIVE_RESOURCE_LIMIT at the 1,000,000-state case budget.

Ten suspect graphs were exhausted. Two suspicious states are proven RNG-dependent exits;
two are proven true dynamic locks. Eight conclusive initial graphs contain player-reachable
non-winning regions. Trap counterfactuals found 10 optional and 2 not-needed cases; none was
proved required for a win.
This result applies only to the analysed twelve-case battery and must not be generalized as
"traps are never required."

## Post-chest golden regression cases

The two proved-unsolvable suspect seeds are frozen regression targets:

- seed 8801214, route 1, mode hard: POST_CHEST_REGRESSION_TARGET = true;
- seed 8801107, route 1, mode medium: POST_CHEST_REGRESSION_TARGET = true.

They must be rerun unchanged in ROTA-DYNAMIC-SOLVABILITY-02 to measure whether Chest,
Pickaxe, breakable walls, Second Chance, or reward choice changes impossibility.

## 180-map sample

Every one of 180 cases ran incrementally. With a 300,000-state per-map budget, 46 graphs were
exhausted: 7 guaranteed, 25 possible-but-not-guaranteed, and 14 proved unsolvable. The other
134 are explicitly inconclusive. No timeout or open frontier is interpreted as unsolvable.

## Resource-bound roadmap

A future selective --only-inconclusive mode, larger per-case budgets, and an exact
open-addressed visited structure if memory becomes limiting are valid technical improvements.

This checkpoint intentionally does not execute that campaign. ROTA-CHEST-REWARDS-01 will
change the state space through Pickaxe, breakable walls, Second Chance, and reward choice.
The current evidence therefore remains a PRE-CHEST RESOURCE-BOUND BASELINE.

## Lint audit

PRE_EXISTING_LINT_WARNINGS_AT_CHECKPOINT = 9. Four were inherited from the solver-ready
runner and five came from the performance continuation. All were local
@typescript-eslint/no-unused-vars warnings in this mission's tools. The checkpoint removes
them without semantic changes: 0 errors and 0 warnings remain.

## Design implications

Luck dependence and true pre-chest locks are now observed facts, not hypothetical risks.
No map or defender is changed here. PROVED_UNSOLVABLE_PRE_CHEST cases must be compared again
after Pickaxe, breakable walls, and Second Chance in ROTA-DYNAMIC-SOLVABILITY-02.

## Verdict

ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND

The solver is exact and materially faster, the required campaigns ran, and partial evidence
is auditable. The baseline is not classification-complete because 136 cases remain resource
limited (2 suspect + 134 sample).
