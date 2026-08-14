# ROTA-ADVERSARIAL-SOLVABILITY-03

## Checkpoint

- Baseline branch: `v06-portal-requires-lights`
- Baseline HEAD: `5865c39ee15c5a140c789fe7300f3b67e380b6e7`
- Baseline state: clean, ahead 12
- Production changes: none
- Push: prohibited and not performed

## Result

The two `PROVED_UNSOLVABLE_PRE_CHEST` results remain correct for the
explicitly scoped `PRE_CHEST_BASELINE` graph. They are not proofs that the
current game, including Chest rewards, is unwinnable.

Both critical maps have a reproducible, positive-probability win through the
actual `useEscapeMaze` hook when the Explorer chooses Pickaxe and opens a
specific wall. The discrepancy is a solver scope/runtime model mismatch, not
an invented Hunter or Sentinel move.

Per-seed classification:

| Seed | Pre-Chest result | Actual-runtime result | Final classification |
| --- | --- | --- | --- |
| 8801107 | `PROVED_UNSOLVABLE_PRE_CHEST` | reproducible Pickaxe win | `MODEL_MISMATCH` |
| 8801214 | `PROVED_UNSOLVABLE_PRE_CHEST` | reproducible Pickaxe win | `MODEL_MISMATCH` |

Mission status: `SOLVER_RUNTIME_MODEL_MISMATCH_FOUND`.

## Solvability definitions

1. **Topological solvability**: the static board has geometric paths between
   required cells when moving defenders are ignored.
2. **Runtime-valid solvability**: every runtime transition preserves the state,
   occupancy, terminal, reward and effective-topology contracts. This does not
   by itself prove a win exists.
3. **Possible win**: there is at least one legal finite gameplay trace to
   `WIN`. Explorer choices are OR and supported RNG outcomes are OR.
4. **Guaranteed win**: there is an Explorer policy that wins for every
   positive-probability defender RNG outcome. Explorer choices are OR and
   supported RNG outcomes are AND.
5. **Actual-runtime win**: the trace uses the shipped Hunter policy, Sentinel
   policy, target/commitment state, occupancy, turn order, traps, Chest pause,
   reward choice, Pickaxe/Second Chance rules, portal and terminal rules.

These definitions are intentionally independent. In particular, no guaranteed
win is not equivalent to impossible, and a simulator timeout is neither one.

## Solver model

The existing exact solver is explicitly `PRE_CHEST_BASELINE`:

- state: Explorer, Hunter, Sentinel, Sentinel target, `commitLeft`, collected
  lights and armed traps;
- actions: legal orthogonal Explorer moves;
- turn order: Explorer move/capture, light pickup, trap activation, ready
  portal, Hunter support, Sentinel decision, defender capture;
- Hunter: exact positive-probability support of the production RNG branches;
- Sentinel: deterministic production `decideSentinelMove`, including defence
  zone, access target, three-turn commitment, distance, territorial guard,
  tie-breaking, armed traps and occupancy;
- Hunter cannot use the portal, armed traps or the Sentinel cell;
- if both defenders select the same destination, the Sentinel moves last and
  remains in its prior cell;
- terminal states: immediate `WIN` or `LOSS`;
- omitted by definition: Chest pause, reward choice, Pickaxe topology and
  Second Chance.

The same exact-support graph answers two different questions:

- existential attractor: Explorer OR, RNG OR;
- guaranteed attractor: Explorer OR, RNG AND.

`PROVED_UNSOLVABLE_PRE_CHEST` is emitted only after a complete graph has no
initial existential attractor. It therefore means there is no
positive-probability win in that pre-Chest model. It does **not** merely mean
that no guaranteed strategy exists.

Packed/reference equivalence remains intact:

- 36,009 state encodings across nine contexts;
- 6,480 successor pairs;
- 5,267 attractor states;
- zero round-trip, merge, split, successor, existential or guaranteed
  mismatches.

## Actual runtime model

The actual-runtime validation adds the omitted state and transitions:

- Chest opening pauses the defender phase until one reward is selected;
- reward selection is an Explorer choice, not RNG;
- Pickaxe is one-use and removes one explicitly selected internal wall from the
  effective topology before defenders answer that turn;
- Explorer, Hunter and Sentinel all consume the same opened topology;
- Second Chance consumes the reward on the first otherwise-terminal capture;
- terminal and occupancy checks are delegated to the shipped hook.

The witness search enumerates the exact Hunter support and calls the production
Sentinel policy. Its A* priority changes exploration order only. It cannot make
absence claims, but every returned witness is an exact finite trace.

The replay then drives the real `useEscapeMaze` hook. For each selected
Hunter outcome, it supplies a deterministic `Math.random` value from the
corresponding non-empty runtime interval. This preserves the distribution and
proves that the finite trace has positive probability; it does not estimate
how often that trace occurs.

Validation seeds use direct `generateMaze(difficulty, route)` generation.
The diagnostic-only harness option aligns the hook sandbox with this regime.
The default harness and production UI generation sequence are unchanged.

## Model differences

### Defender correspondence

No defender action considered by the pre-Chest solver was found that the
runtime cannot produce, and no runtime defender transition was found outside
the solver support:

- Sentinel differential gate: 36 maps, 651 states, zero divergences;
- prior runtime support gate retained: 32,880 transitions, zero outside
  support, 1,241 of 1,242 positive-support branches observed;
- Hunter support and Sentinel role/feint tests pass.

Consequently, territorial guard, target selection, `commitLeft`, distance,
tie-breaking, occupancy and defender order are not the cause of this mismatch.

### Scope mismatch

The pre-Chest graph treats the Chest cell as ordinary walkable terrain and has
no reward/topology state. The shipped game can pause there, let the Explorer
choose Pickaxe, and create a topology that does not exist in the pre-Chest
graph. Second Chance alone is insufficient for these cases; Pickaxe is the
reconciling transition.

## Seed 8801107

Configuration: route 1, medium.

Initial state:

- Explorer `8,0`; Hunter `0,3`; Sentinel `1,7`;
- portal `2,7`; Chest `5,1`;
- lights `8,5`, `7,4`, `5,2`, `3,0`;
- traps `7,8`, `1,2`, `1,8`;
- portal accesses `0,6`, `4,8`.

The board is topologically valid. In the complete packed pre-Chest graph,
209,244 states and 1,350,521 transitions were explored; the initial state is
in neither the existential nor guaranteed attractor.

A concrete reachable closed non-winning singleton is
`0,5|0,4|0,6|0|0|15|2`: Explorer at `0,5`, Hunter at `0,4`,
Sentinel at `0,6`, every light collected and trap `1,2` armed. The top
frame and wall below `0,5` complete the Hunter/Sentinel pincer. This state is
a concrete critical region; the formal impossibility is the empty initial
existential attractor over the complete pre-Chest graph.

Second Chance augmentation was exhausted exactly: 608,766 states, 3,932,822
transitions, no win.

Actual-runtime witness:

- 32 actions;
- choose Pickaxe on entering Chest `5,1`;
- collect all four lights;
- from Explorer `2,5`, open wall `2,6`;
- cross `2,6` and enter portal `2,7`;
- search: 7,969 states, 3,980 processed states, 33,217 expanded successor
  states, 19 effective-topology variants;
- hook replay: exact map match, 60 RNG calls, valid dynamic state throughout,
  completion recorded, final status `won`.

Final classification: `MODEL_MISMATCH`.

## Seed 8801214

Configuration: route 1, hard.

Initial state:

- Explorer `8,0`; Hunter `0,3`; Sentinel `1,7`;
- portal `2,7`; Chest `8,4`;
- lights `8,5`, `5,2`, `4,1`, `7,3`, `7,6`;
- traps `0,2`, `3,2`, `2,0`, `1,7`;
- portal accesses `0,6`, `3,5`, `4,8`.

The board is topologically valid. In the complete packed pre-Chest graph,
178,433 states and 682,024 transitions were explored; the initial state is in
neither the existential nor guaranteed attractor.

A concrete reachable closed non-winning singleton is
`5,8|6,8|4,8|2|2|31|0`: Explorer at `5,8`, Hunter at `6,8`,
Sentinel at `4,8` and every light collected. The right frame and wall at
`5,7` complete the vertical pincer. As above, the singleton illustrates a
critical region while the complete attractor result is the formal proof.

Second Chance augmentation was exhausted exactly: 391,874 states, 1,503,089
transitions, no win.

Actual-runtime witness:

- 32 actions;
- choose Pickaxe on entering Chest `8,4`;
- collect all five lights;
- from Explorer `3,3`, open wall `3,4`;
- traverse the opened corridor to portal `2,7`;
- search: 1,522 states, 628 processed states, 2,772 expanded successor states,
  18 effective-topology variants;
- hook replay: exact map match, 32 RNG calls, valid dynamic state throughout,
  completion recorded, final status `won`.

Final classification: `MODEL_MISMATCH`.

## Seven resource-limit cases

All official `INCONCLUSIVE_RESOURCE_LIMIT` verdicts remain unchanged. Each
partial graph still supplies only lower bounds. The archived shortest
existential witnesses were replayed transition by transition against the exact
packed successor sets and all seven are valid possible wins.

| Seed | Mode | States | Frontier | Frontier ratio | Exact witness |
| --- | --- | ---: | ---: | ---: | ---: |
| 8801008 | easy | 1,000,198 | 68,870 | 6.89% | 21 actions |
| 8801012 | easy | 1,000,211 | 75,027 | 7.50% | 21 actions |
| 8801014 | easy | 1,000,220 | 7,452 | 0.75% | 19 actions |
| 8801108 | medium | 1,000,021 | 49,749 | 4.97% | 28 actions |
| 8801110 | medium | 1,000,302 | 53,614 | 5.36% | 30 actions |
| 8801204 | hard | 1,000,210 | 3,346 | 0.33% | 31 actions |
| 8801207 | hard | 1,000,179 | 102,643 | 10.26% | 22 actions |

The partial graph places 8801204 and 8801207 in its guaranteed attractor, but
that is not a closed-policy certificate and does not justify reclassification.
Seeds 8801014 and 8801204 are the best candidates for a future complete proof
because their remaining BFS frontiers are below one percent.

A useful checkpoint/resume implementation must serialize a coherent solver
snapshot: packed state arrays, key-to-ID index, queue/frontier and head, action
and successor buffers, parent/witness arrays, and solver/map fingerprints.
Serializing only a JSON frontier cannot preserve exact graph identity.

No statistically honest total-state estimate is derived from the open BFS
frontier. Current state counts are lower bounds.

## Difficulty implications

- **Impossibility**: established only inside the pre-Chest model for the two
  critical seeds; both full-runtime maps are demonstrably winnable via Pickaxe.
- **No guarantee**: a separate quantifier result, not proof of impossibility.
  Full-runtime guaranteed status was not solved for these two seeds.
- **High difficulty**: may reduce favourable Hunter outcomes and viable policy
  margin, but does not change the definitions above.
- **Simulator timeout**: reports search/agent performance, not formal
  impossibility.
- **Territorial Sentinel**: contributes route pressure, but exact
  solver/runtime correspondence rules it out as the model mismatch.
- **Hunter**: stochastic support is the primary branching source; a witness
  proves positive probability, not practical frequency.
- **Route**: portal geometry and access layout affect pressure. Existing
  observations remain Route 2/hard 0 wins and 19 timeouts, Route 3/easy 1 win
  and 15 timeouts, and Route 3/hard 3 wins and 16 timeouts.

No speed, count, probability, reward or map-generation parameter changed.
Those observations belong to a future balancing mission.

## Deltas

### Production code delta

Zero files and zero lines.

### Tooling/test delta

- exact capture instrumentation for Second Chance analysis;
- actual-runtime witness search and deterministic hook replay;
- exact replay analysis for the seven state-limit witnesses;
- diagnostic direct-generation mode in the runtime harness;
- optional isolated evidence output for Chest/Pickaxe controlled suites.

### Evidence/doc delta

- `adversarial-solvability.json`: exact Second Chance results and full-runtime
  witnesses;
- `actual-runtime-replay.json`: action-by-action real-hook replay;
- `resource-limit-analysis.json`: lower bounds, exact witness checks and proof
  priorities;
- `regressions/`: solver, Sentinel, Second Chance, Chest and Pickaxe gates;
- this report.

## Validation

- adversarial witness search: `ACTUAL_RUNTIME_WITNESSES_FOUND`;
- real-hook replay: `ACTUAL_RUNTIME_REPLAY_OK`;
- resource-limit analysis: `RESOURCE_LIMIT_LOWER_BOUNDS_OK`;
- packed/reference equivalence: pass, zero mismatches;
- Sentinel runtime equivalence: pass, zero divergences;
- Hunter/Sentinel roles and Sentinel feint/commitment: pass;
- Chest contract: `CHEST_CONTRACT_OK`;
- Pickaxe contract: `PICKAXE_CONTRACT_OK`;
- Second Chance controlled suite: all pass;
- lint: pass with zero errors and zero warnings after cleanup;
- TypeScript: `tsc --noEmit` pass;
- build: not run because no app-consumed code changed;
- diff check: `git diff --check` pass.

## Remaining risks

- The full-runtime witnesses prove possible wins, not guaranteed policies or
  their practical probability.
- Seven guaranteed/complete classifications remain resource-limited.
- Direct validation seed identity differs from the normal UI's initial-easy
  generation sequence; the diagnostic harness makes this explicit.
- Production still uses unseeded `Math.random`; deterministic replay selects
  valid positive-probability outcomes and does not measure frequency.
