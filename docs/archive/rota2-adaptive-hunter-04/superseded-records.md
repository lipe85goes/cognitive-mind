# Records this mission moved — and what they measured at their own commit

ROTA2-ADAPTIVE-HUNTER-04 changes production on Routes 2 and 3 (on a repeated
direction the Hunter may intercept, so games there take other turns) and adds
the last direction to both solvers' state. Route 1 does not change at all.
Any recorded number that comes from a Route 2/3 game, or from the solvers'
graphs on Routes 2/3, can move; nothing else can.

Procedure, per record: run its validator in `--check` on the exact base
`ec3e564` (scratch worktree) and on this tree. On the base every record below
**MATCHES** (the record is exactly what its own mission measured); on this
tree each one diverges, its checks still pass, and it was rewritten with
`--update`. The left column of each table is what the record said at
`ec3e564`; git history keeps the files as they were.

## Why every difference is a Route 2/3 difference

- **The earlier Rota 2.0 suites and censuses** (DYNAMIC-TRAPS-01,
  DEPENDENT-OBJECTIVES-02, SENTINEL-SOLVER-FIDELITY-03): their oracle and solver
  differentials now model the Route and the production interception module;
  their fixtures are searched in Route 2/3 games, so a seed found by a search
  can move (e.g. the first seed whose game shows a situation). Their Route 1
  checks are unchanged.
- **CORE records whose fixtures include Route 2/3 games**
  (`chest-controlled-tests`, `chest-runtime-gameplay`, `pickaxe-controlled-tests`):
  each validator was also run with its combinations restricted to Route 1
  (a temporary copy with `COMBOS` filtered, output to a scratch directory) on
  the base and on this tree — the three Route-1-only records are
  **identical** on both trees.
- **Fingerprinted reports** (`difficulty-baseline-tests`,
  `difficulty-rebalance-tests`): the fingerprint hashes the whole
  `runDifficultyBaseline` report. The report itself, compared leaf by leaf
  between the two trees with the validators' own options (12 and 16 turns),
  differs in 100 and 123 leaves — **all** in `runtimePolicyMatrix` rows of
  Routes 2 and 3 (Hunter branching, threat and Sentinel shares, outcomes);
  0 on Route 1, 0 in geometry, UI or parameters.
- **`diagnostic-launcher`**: session-determinism witness A is a Route 3 game;
  its 12-turn scripted walk now lasts 11 turns instead of 9 (the game ends
  later). Both runs of the witness are still identical turn by turn.

