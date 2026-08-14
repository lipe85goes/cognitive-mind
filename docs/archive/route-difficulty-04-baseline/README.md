# ROTA-DIFFICULTY-04-BASELINE closeout

Status: `DIFFICULTY_MODEL_DEFECT_FOUND`

This mission establishes a deterministic measurement baseline without changing shipped gameplay. It also finds a correctness defect in the actual UI journey: selecting `medium` or `hard` after resuming Route 2 or Route 3 silently resets the route to Route 1. Balance changes must not be evaluated through that flow until route/difficulty identity is preserved.

The machine-readable source of truth is `difficulty-baseline.json`. Raw regression artifacts are under `regressions/`.

## CHECKPOINT

| Field | Value |
| --- | --- |
| HEAD before | `580b230e1e1ce300a6004c42b1b3b409a2ea3edc` |
| Branch | `v06-portal-requires-lights` |
| Ahead before | 13 |
| Worktree before | clean |
| Push | not executed |
| Production gameplay | unchanged |

## CURRENT DIFFICULTY SYSTEM

### Common parameters

| Parameter | Route/difficulty | Current value | Effect |
| --- | --- | --- | --- |
| Board | all | 9x9; Explorer starts at `8,0` | Fixed movement space and common start. |
| Generation budget | all | 500 random attempts; 3 recovery rounds; 12 retries per slot | Reliability gate only; rejected candidates do not redefine difficulty. |
| Input guard | all | 150 ms | Suppresses duplicate input; movement remains turn-based and has no mode-specific speed. |
| Sentinel | all | zone radius 2; leash 2; threat horizon 6; commitment 3 turns | Same territorial policy in every combination; geometry changes realized pressure. |
| Chest | all | one explicit choice: one-use Pickaxe or one-use Second Chance | Same rules in every combination; geometry changes reward value. |
| Pickaxe | all | opens one eligible adjacent internal wall; costs one turn | Changes the one shared topology used by Explorer, Hunter and Sentinel. |
| Second Chance | all | cancels one capture, consumes the reward, restores the start-of-turn occupancy | Defensive value depends on whether a policy reaches a capture state. |
| Portal | all | route-template exit candidates; all lights required | Later templates and objective counts change approach burden. |
| RNG | all | current seeded `Math.random` replacement in tooling; production consumes global `Math.random` | Generation, Hunter choices and Sentinel tie-breaking share an RNG stream in the UI. |

### Difficulty parameters

| Parameter | Easy | Medium | Hard | Effect |
| --- | --- | --- | --- | --- |
| Minimum decision ratio | 0.62 | 0.55 | 0.50 | Harder modes accept more forced route geometry. |
| Maximum forced streak | 3 | 4 | 5 | Harder modes permit longer forced corridors. |
| Maximum idle dead ends | 0 | 1 | 2 | Harder modes permit more non-objective dead ends. |
| Hunter accepted start range | 8-13 | 7-12 | 6-11 | Intended to bring the Hunter closer as difficulty rises. |
| Hunter policy | 50% any neighbour; otherwise prefer non-pursuit when available | 75% best closer move when available; otherwise any neighbour | best closer move whenever available; random tie-break | Pursuit probability rises, but hard also becomes more behaviorally predictable. |
| Base wall limits | 13-18 | 18-23 | 23-28 | Density rises by mode before route adjustment. |
| Base lights / traps | 3 / 3 | 4 / 4 | 5 / 5 | Objective and hazard burden rises by mode. |

### Route parameters

| Parameter | Route 1 | Route 2 | Route 3 | Effect |
| --- | --- | --- | --- | --- |
| Templates | 3 | 3 | 3 | Fixed template families. |
| Exit candidates | `2,8`, `2,7` | `1,8`, `0,7`, `0,8` | `0,8`, `0,7` | Changes portal placement and territorial geometry. |
| Hunter candidates | `0,3`, `1,5`, `2,6` | `2,3`, `1,4`, `2,5`, `0,3` | `1,4`, `2,3`, `0,3`, `1,5` | Route-specific starting pressure. |
| Minimum portal path | 7 | 8 | 10 | Raises the minimum static approach length. |
| Minimum reachable cells | 53 | 50 | 45 | Later routes accept denser reachable regions. |
| Minimum junctions | 10 | 9 | 8 | Later routes accept less branching. |
| Hunter minimum start distance | 9 | 8 | 8 | Route gate before difficulty-specific acceptance. |
| Light start / exit / separation minimum | 3 / 2 / 2 | 3 / 2 / 2 | 4 / 2 / 3 | Route 3 spreads objectives more aggressively. |
| Trap start / separation minimum | 4 / 3 | 3 / 2 | 4 / 2 | Route-specific hazard placement. |
| Chest minimum / target distance | 3 / 4 | 4 / 5 | 4 / 6 | Later routes target a farther Chest. |
| Wall randomization attempts | 8 | 14 | 26 | Later routes explore more wall variants before acceptance. |
| Wall adjustment | base - 3 | base | base + 1 | Route density progression. |
| Objective adjustment | base | base | base + 1, capped at 6 | Route 3 adds one light. |
| Trap adjustment | base - 1, minimum 2 | base | base + 1, capped at 6 | Route hazard progression. |

The resulting generation matrix is:

| Combination | Wall limits | Lights | Traps |
| --- | ---: | ---: | ---: |
| R1 easy | 10-15 | 3 | 2 |
| R1 medium | 15-20 | 4 | 3 |
| R1 hard | 20-25 | 5 | 4 |
| R2 easy | 13-18 | 3 | 3 |
| R2 medium | 18-23 | 4 | 4 |
| R2 hard | 23-28 | 5 | 5 |
| R3 easy | 14-19 | 4 | 4 |
| R3 medium | 19-24 | 5 | 5 |
| R3 hard | 24-29 | 6 | 6 |

## LEGACY SIMULATOR AUDIT

Classification: `PARTIALLY_STALE`.

The legacy runner in `tools/validation/sentinel-runtime-closeout.mjs` still uses production `generateMaze`, current Hunter and Sentinel decision functions, current RNG semantics and a 160-turn budget. Its Explorer policy follows lights in fixed map-array order, takes a shortest path to the current target and avoids only cells currently occupied by defenders.

It does not exercise the real `useEscapeMaze` transition loop, Chest pause, reward choice, Pickaxe, opened topology, Second Chance, result/remount generation flow, dynamic objective ordering or a meaningful threat/Chest strategy. It is a correctness smoke signal, not a practical-difficulty estimator.

The current rerun reproduced the mission's cited outcomes exactly:

| Combination | Wins | Hunter loss | Sentinel loss | Timeouts |
| --- | ---: | ---: | ---: | ---: |
| R2 hard | 0 | 0 | 1 | 19 |
| R3 easy | 1 | 2 | 2 | 15 |
| R3 hard | 3 | 0 | 1 | 16 |

The older versioned JSON differs slightly (`0/18`, `1/16`, `2/16` wins/timeouts for those rows), so the original claim has provenance drift. Reproducibility against current pure functions does not make the policy representative of the shipped runtime.

## UI VS VALIDATION GENERATION

Classification: `NOT_EQUAL`.

The hook creates an easy map on mount. Starting then creates another map. Selecting `medium` or `hard` first creates a setup map and starting creates another selected-mode map. Therefore a direct one-call generation seed does not identify the map the user actually receives.

More importantly, `changeDifficulty` sets `routeNumber` to 1 and generates Route 1. The result flow remounts with `initialRouteNumber = nextRouteNumber`, but difficulty initializes to `easy`; selecting `medium` or `hard` after that remount resets Route 2/3 to Route 1.

Observed across 270 UI attempts:

| Check | Result |
| --- | ---: |
| Determinism replays | 27/27 identical |
| Direct map identity equals UI map identity | 0/270 |
| Requested Route x Difficulty preserved | 150/270 |
| Silent route resets | 120/270 |
| Invalid dynamic states | 0 |

Every reset was in exactly four requested combinations: `R2/medium`, `R2/hard`, `R3/medium`, and `R3/hard`, 30 samples each. This is a correctness defect and blocks trustworthy human balance conclusions for those UI paths. Production was not changed because this mission explicitly requires documenting independent bugs before any gameplay edit.

## SAMPLE / SEEDS

| Layer | Per combination | Total | Seed base |
| --- | ---: | ---: | ---: |
| Direct geometry | 120 | 1,080 maps | 12,400,000 |
| Actual UI generation | 30 | 270 attempts | 13,300,000 |
| Runtime policies | 24 x 4 policies | 864 runs | 14,200,000 |
| Historical generation regression | 260 effective runs | 2,340 maps | existing validator contract |

For the three new layers, the formula is `base + route * 10000 + modeIndex * 1000 + sample`, where `modeIndex` is 0/1/2 for easy/medium/hard. Policy budget is 160 turns. The deterministic report fingerprint is `ce71fcfc08b0bd522fb56791d4efb4c1f3f9fcd55a0a15eb1ead95864d34fced`.

All 1,080 geometry maps, 270 UI states and 864 policy runs passed their validity gates. There were zero generation failures, zero invalid policy runs and zero policy/map mismatches.

## ROUTE x DIFFICULTY MATRIX

Means across 120 direct maps per combination:

| Combo | Walls | Lights | Traps | Objective moves | Portal distance | Chest detour | Hunter start distance | Decision ratio | Forced streak |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R1 easy | 14.76 | 3 | 2 | 19.76 | 13.23 | 0.22 | 11.85 | 0.762 | 1.14 |
| R1 medium | 18.93 | 4 | 3 | 23.12 | 14.00 | 0.12 | 12.13 | 0.708 | 1.71 |
| R1 hard | 21.28 | 5 | 4 | 24.30 | 14.00 | 0.20 | 11.48 | 0.664 | 2.29 |
| R2 easy | 17.53 | 3 | 3 | 26.43 | 15.43 | 1.65 | 11.72 | 0.819 | 1.63 |
| R2 medium | 21.38 | 4 | 4 | 27.50 | 15.65 | 2.18 | 11.51 | 0.731 | 2.33 |
| R2 hard | 24.08 | 5 | 5 | 28.71 | 16.18 | 2.37 | 11.63 | 0.680 | 2.71 |
| R3 easy | 18.54 | 4 | 4 | 26.42 | 15.55 | 1.58 | 12.03 | 0.763 | 2.03 |
| R3 medium | 22.21 | 5 | 5 | 28.88 | 15.67 | 2.27 | 11.91 | 0.745 | 2.23 |
| R3 hard | 25.63 | 6 | 6 | 31.25 | 15.65 | 2.27 | 11.08 | 0.673 | 3.09 |

No aggregate difficulty score was created. Each axis keeps its own meaning.

## GEOMETRY METRICS

Wall density, objective count, objective-route length and forced streak generally increase from easy to hard. Branching falls as density rises: mean junction count moves from 46.27 to 33.54 on Route 1, 40.60 to 27.48 on Route 2 and 40.49 to 27.43 on Route 3. Mean corridor ratio rises from 0.300 to 0.404, 0.336 to 0.454 and 0.330 to 0.434 respectively.

Mean articulation points rise sharply with difficulty: R1 `0.12 -> 3.34`, R2 `1.81 -> 5.62`, R3 `1.92 -> 6.81`. Mean portal accesses remain above two in all combinations, while Route 2/3 have smaller portal zones than Route 1. This is stronger choke pressure, not evidence of topological impossibility.

R1 to R2 is the largest route step. R2 to R3 is weaker on some geometry axes: R2/easy and R3/easy have effectively equal objective moves, and cycle rank slightly increases from R2 to R3 in all modes. These are mild non-monotonicities, not gross progression inversions.

## HUNTER PRESSURE

Hunter pressure is controlled directly by mode probability and indirectly by geometry. In the direct-objective comparative policy, effective branching drops from roughly 2.52-2.55 on easy to 1.43-1.50 on hard. Hunter threat share rises materially in medium/hard on most routes, but potential immediate capture share remains below 1% in these traces.

The accepted Hunter start distance is not perfectly monotonic in the sample: R1 medium (12.13) starts slightly farther than easy (11.85), and R2 hard (11.63) slightly farther than medium (11.51). Route 3 is monotonic. These small inversions do not erase the stronger hard-mode pursuit rule.

Hard's always-closer behavior also makes it more predictable. Whether that predictability offsets raw pursuit pressure is a human-playtest question; automated local policies are not reliable enough to justify changing Hunter RNG.

## SENTINEL PRESSURE

Sentinel constants do not change by route or difficulty. Realized pressure comes from topology and player path.

For the direct-objective policy, the Sentinel is committed for 67%-91% of observed turns and blocks at least one shortest portal route for 67%-80%. Its zone occupancy share rises to about 40% on R2/R3 hard. Immediate Sentinel capture potential remains near zero; the dominant effect is territorial denial and forced rerouting, not direct pursuit.

The independent runtime-equivalence regression compared 651 states over 36 maps with zero divergences and covered patrol, commitment start/hold/expiry, retarget, leash and reposition states. There is no evidence here of a Sentinel logic regression.

## CHEST / REWARD EFFECT

Mean Chest detour is near zero on Route 1 and 1.58-2.37 moves on Route 2/3, with a maximum observed detour of 10. Chest-aware policies often hit their turn budget because their local objective/revisit rules are weak; those timeouts do not prove the Chest is impractical for humans.

The geometric upper bound for Pickaxe value is highly progression-dependent:

| Combo | Maps with a beneficial wall | Mean best move improvement | Max | Chest-adjacent beneficial wall |
| --- | ---: | ---: | ---: | ---: |
| R1 easy | 2.5% | 0.05 | 2 | 0.8% |
| R1 medium | 42.5% | 1.02 | 6 | 6.7% |
| R1 hard | 55.8% | 1.45 | 6 | 11.7% |
| R2 easy | 81.7% | 2.27 | 6 | 20.0% |
| R2 medium | 79.2% | 2.22 | 10 | 15.0% |
| R2 hard | 76.7% | 2.13 | 8 | 17.5% |
| R3 easy | 76.7% | 2.00 | 10 | 13.3% |
| R3 medium | 75.8% | 2.13 | 8 | 11.7% |
| R3 hard | 67.5% | 2.07 | 8 | 13.3% |

The best wall is usually not adjacent when the Chest is opened, so Pickaxe value often requires carrying it to a later strategic wall. Openings can also shorten the Hunter path; the reward has no invisible Explorer protection. Second Chance use is policy-dependent and sparse in the simple direct runs, so this sample is insufficient to rank the two rewards for humans.

## RUNTIME POLICY COMPARISON

The four policies are instruments, not human-player models:

- `OBJECTIVE_ROUTE_GREEDY_SECOND_CHANCE`: direct objective order, Second Chance.
- `THREAT_AWARE_SECOND_CHANCE`: lexicographic local safety/revisit policy, Second Chance.
- `CHEST_AWARE_SECOND_CHANCE`: visits Chest before objectives, Second Chance.
- `CHEST_AWARE_PICKAXE`: visits Chest before objectives, Pickaxe.

Direct-policy wins out of 24 were `17/12/10` on R1 easy/medium/hard, `10/4/3` on R2, and `12/3/2` on R3. The supposedly cautious policy often timed out because its local safety rule cycles or refuses useful progress. Chest-aware policies also time out heavily on later routes. This sensitivity proves why no automated win rate in this report should be treated as a human difficulty target.

No policy run had an invalid runtime state or a map mismatch. A timeout proves only that one labelled policy failed within 160 turns.

## OUTLIERS

| Category | Seed | Combination | Witness |
| --- | ---: | --- | --- |
| Longest objective route | 12432045 | R3 hard | 43 moves; strongest candidate wall `4,5` |
| Long objective route | 12432073 | R3 hard | 42 moves |
| Long objective route | 12432101 | R3 hard | 41 moves |
| Closest Hunter start | 12420031 | R2 easy | distance 9; candidate wall `3,1` |
| Longest forced streak | 12432116 | R3 hard | 10 moves; candidate wall `3,2` |
| Highest articulation count | 12431111 | R3 medium | 13 articulation points |
| Highest Chest detour | 12430048 | R3 easy | 10 moves |
| Highest Pickaxe improvement | 12421027 | R2 medium | 10 moves; wall `3,3` |
| Highest Pickaxe improvement | 12430079 | R3 easy | 10 moves; wall `4,3` |

These are preserved deterministic diagnostics. Production UI cannot currently accept a seed, so they are not honest manual reproduction instructions yet.

## DIFFICULTY PROGRESSION

Sixteen of 18 selected easy-to-hard checks are monotonic. The two exceptions are the small Hunter start-distance inversions on Route 1 and Route 2. All wall, light, trap, objective-length and forced-streak checks progress in the intended direction.

Seven of 12 selected Route 1-to-3 checks are monotonic. Non-monotonic checks are R2/R3 near-ties in easy objective length, medium forced streak and cycle rank in all modes. Route 3 still has more objectives, the longest hard objective path and the largest hard forced streak. There is no gross `easy > hard` or `Route 2 >> Route 3` inversion, but Route 2/3 separation is weaker than Route 1/2 on several structural axes.

## POSSIBLE VS PRACTICAL FINDINGS

- Topological solvability: static objective and portal paths exist without moving defenders.
- Runtime-valid: all sampled current-hook transitions preserved state and occupancy contracts.
- Possible win: one positive-probability finite witness is enough; prior full-runtime Pickaxe witnesses remain valid.
- Guaranteed win: requires a policy winning against every supported RNG outcome; this report does not claim it.
- Practical difficulty: geometry and labelled policy burden indicate substantial pressure on later/denser combinations, but only corrected UI playtests can calibrate human experience.

A win witness does not establish a healthy human win rate. A policy timeout does not establish impossibility.

## REBALANCE CANDIDATES

No candidate was applied.

| Priority | Parameter | Current state / problem | Evidence | Potential future change | Expected effect | Regression risk |
| --- | --- | --- | --- | --- | --- | --- |
| 0 - correctness prerequisite | UI route/difficulty state | Resumed Route 2/3 resets to Route 1 when medium/hard is selected | 120/270 resets in exactly four combinations | Preserve resumed route in `changeDifficulty` and persist selected difficulty across result remount; define journey semantics first | Makes playtest identity truthful | Progression/session-state behavior; requires its own mission and UI regression tests |
| 1 - medium certainty | Chest placement burden | Route 2/3 mean detour 1.58-2.37; max 10 | Seeds `12430048`, `12430073`, `12430117` | Human-test current placement before changing target distance | Determine whether optional reward feels strategic or compulsory | Moving Chest changes reward access and defender paths |
| 2 - medium/low certainty | Route 2 vs Route 3 structure | Several metrics are near-tied or mildly non-monotonic | 7/12 route checks monotonic | If human data confirms weak progression, adjust one structural axis only | Clearer route identity | Can disturb certified generation and dynamic solvability |
| 3 - low certainty | Hard Hunter predictability | Always-closer pursuit raises pressure but reduces effective branching | Hard branching about 1.43-1.50 vs easy 2.52-2.55 | Test predictability before considering tie/randomness changes | Preserve threat while reducing exploitable repetition | RNG/support changes affect adversarial proofs and replay determinism |
| 4 - observation only | Pickaxe value distribution | Beneficial-map rate 2.5% on R1 easy vs 67.5%-81.7% later | Exhaustive one-wall geometry scan per map | Do not change until reward comprehension/value is human-tested | Avoid premature reward homogenization | Any protection or wall filtering would violate current explicit-choice contract |

## HUMAN PLAYTEST PLAN

First reproduce the correctness defect without a seed: complete/resume Route 2 or Route 3, select `medium` or `hard`, and verify that the current UI silently displays/plays Route 1. Do not record that session as Route 2/3 balance evidence.

After a small diagnostic seed entry exists in a separate mission, run this six-session battery. Keep reward, turns, captures, retries, perceived bottleneck and whether the route identity matched the request.

| Session | Route/mode | Seed | Reward/scenario | Purpose |
| --- | --- | ---: | --- | --- |
| A | R1 easy | 12410000 | natural choice | Low-pressure control and onboarding burden |
| B | R2 easy | 12420031 | natural choice; Hunter starts close | Test whether early pressure feels fair |
| C | R2 medium | 12421027 | replay once per reward; Pickaxe wall `3,3` | Compare a high-value Pickaxe witness to Second Chance |
| D | R3 easy | 12430048 | replay ignoring and visiting Chest | Test 10-move Chest detour value |
| E | R3 hard | 12432045 | replay once per reward; candidate wall `4,5` | Test 43-move objective burden |
| F | R3 hard | 12432116 | candidate wall `3,2` | Test 10-move forced corridor perception |

The current production UI has no seed input and consumes RNG during setup/gameplay, so these exact fixtures are not manually reproducible today. Do not claim otherwise and do not build a complex analytics system as part of this baseline.

## PRODUCTION CODE DELTA

Zero files, zero lines. No app-consumed gameplay, UI, render, generator or difficulty value changed.

## TOOLING / TEST DELTA

- `tools/validation/instrumented-generator.mjs`: exposes existing production constants/functions only through the diagnostic VM surface.
- `tools/validation/difficulty-baseline-run.mjs`: deterministic 3x3 geometry, UI-sequence and real-hook policy campaign.
- `tools/validation/difficulty-baseline-tests.mjs`: focused determinism, matrix, UI defect and validity gates.

## EVIDENCE / DOC DELTA

- `README.md`: interpretation, recommendations and playtest plan.
- `difficulty-baseline.json`: complete parameters, samples, metrics, per-run evidence, outliers and fingerprint.
- `difficulty-baseline-tests.json`: focused deterministic gate.
- `regressions/`: isolated legacy, 2,340-map, Chest, Pickaxe, Second Chance, Sentinel and solver artifacts.

## TESTS

- `node tools/validation/difficulty-baseline-tests.mjs`: `DIFFICULTY_BASELINE_TESTS_OK`; two identical fingerprints.
- `node tools/validation/validate-route-9x9.mjs --seeds 200 --template-seeds 20 ...`: 2,340 maps; 22,290 rejected candidates; 0 fallbacks; 0 throws; 0 errors.
- `node tools/validation/chest-controlled-tests.mjs`: `CHEST_CONTRACT_OK`.
- `node tools/validation/pickaxe-controlled-tests.mjs`: `PICKAXE_CONTRACT_OK`.
- `node tools/validation/second-chance-controlled-tests.mjs`: `SECOND_CHANCE_CONTRACT_OK`.
- `node tools/validation/sentinel-runtime-equivalence.mjs`: `SENTINEL_RUNTIME_OK`; 651 states; 0 divergences.
- `node tools/validation/dynamic-solver-equivalence-run.mjs`: `SOLVER_ENCODING_EQUIVALENCE_OK`; 36,009 round-trips, 6,480 successor pairs and 5,267 attractor states with zero mismatches.

## LINT

`npm.cmd run lint`: passed with zero warnings or errors.

## TYPECHECK

`npx.cmd tsc --noEmit`: passed.

## BUILD

Not required by mission contract because app-consumed code is unchanged; not run.

## DIFF CHECK

`git diff --check`: passed.

## REMAINING RISKS

- Route/difficulty identity is not preserved by the actual resumed UI flow; this is the discovered model defect.
- Automated policies are deliberately simple and produce policy-specific cycles/timeouts; they must not be labeled human behavior.
- Exact outlier seeds need a future bounded diagnostic launcher before honest manual reproduction.
- Route 2/3 practical separation and reward preference remain human-playtest questions.
- No production fix or rebalance is included in this mission.

## FINAL STATUS

`DIFFICULTY_MODEL_DEFECT_FOUND`
