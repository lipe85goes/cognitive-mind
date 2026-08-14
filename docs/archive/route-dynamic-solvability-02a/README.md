# ROTA-DYNAMIC-SOLVABILITY-02A resource-bound closeout

## Scope and outcome

The exact 12-seed resource-bound campaign now completes as a bounded validation run. It uses the existing packed exact graph implementation, keeps the original transitions and attractor semantics, and records every seed independently. No production or gameplay file changed.

`RESOURCE_BOUND_VALIDATION_CLOSED` means that both executions completed all 12 prescribed cases at the required 1,000,000-state budget with exact semantics and no process timeout. It does not turn a `STATE_LIMIT` result into a solvability proof: seven cases remain explicitly classified as `INCONCLUSIVE_RESOURCE_LIMIT`.

## Root cause of the previous resource bound

The 12-seed wrapper still called the reference object/string graph explorer. The instrumented reference profile spent 98.899% of exploration time enumerating successors, including repeated Sentinel path/distance work, while encoding consumed 0.241% and visited-set operations consumed 0.541%. It processed 5,001 states in 9.457 s (528.8 states/s).

The state spaces are also legitimately large: seven cases reach the required one-million-state bound. The unnecessary cost was the wrapper's use of the reference representation and repeated runtime computations, not the presence of those states. The existing packed implementation uses numeric mixed-radix state keys, typed-array graph storage, precomputed topology/distances, and linear-time backward attractors. It processed 120,019 states in 0.791 s (171,004.0 states/s), a 323.39x throughput gain over the instrumented reference.

## Changes

- `dynamic-solvability-run.mjs` now delegates each prescribed seed to the exact packed `analyzeCase` implementation and records processed states, transitions, frontier, attractors, witness, phase timings, memory, resource limit, runner, environment, and total runtime.
- `dynamic-solvability-campaign-lib.mjs` exposes both attractor cardinalities already computed by the packed solver.
- `dynamic-solver-performance-run.mjs` accepts an isolated evidence directory and profiles the current Hunter/Sentinel occupancy signature.
- `dynamic-solvability-resource-closeout.mjs` verifies the exact case set, 1,000,000-state budget, `PACKED_EXACT` runner, distinct hash environments, supported resource limits, and full logical fingerprints while excluding timing and memory from semantic equality.

## Semantic equivalence

The reference and packed implementations were compared directly:

- 36,009 encoded states across nine route/difficulty contexts;
- zero round-trip mismatches, false merges, or false splits;
- 6,480 successor-set pairs with zero identity mismatches;
- 5,267 attractor states with zero existential or guaranteed mismatches;
- 32,880 observed runtime transitions with zero outcomes outside enumerated support in each full campaign;
- two complete campaigns produced zero logical fingerprint mismatches.

## 12-seed results

Durations are `PYTHONHASHSEED=1 / PYTHONHASHSEED=997`. A `STATE_LIMIT` row completed the bounded run but intentionally remains inconclusive.

| Seed | Case | Exact result | Duration | States | Transitions | Limit |
| ---: | :--- | :--- | ---: | ---: | ---: | :--- |
| 8801008 | r1/easy | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.375 s / 6.065 s | 1,000,198 | 6,556,644 | `STATE_LIMIT` |
| 8801012 | r1/easy | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.232 s / 6.000 s | 1,000,211 | 6,861,905 | `STATE_LIMIT` |
| 8801014 | r1/easy | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.626 s / 6.449 s | 1,000,220 | 7,108,635 | `STATE_LIMIT` |
| 8801107 | r1/medium | `PROVED_UNSOLVABLE_PRE_CHEST` | 1.376 s / 1.333 s | 209,244 | 1,350,521 | none |
| 8801108 | r1/medium | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.092 s / 5.721 s | 1,000,021 | 6,421,805 | `STATE_LIMIT` |
| 8801109 | r1/medium | `POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST` | 3.209 s / 3.197 s | 474,775 | 3,063,981 | none |
| 8801110 | r1/medium | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.095 s / 5.548 s | 1,000,302 | 6,086,814 | `STATE_LIMIT` |
| 8801204 | r1/hard | `INCONCLUSIVE_RESOURCE_LIMIT` | 6.582 s / 6.243 s | 1,000,210 | 3,715,463 | `STATE_LIMIT` |
| 8801207 | r1/hard | `INCONCLUSIVE_RESOURCE_LIMIT` | 4.836 s / 4.733 s | 1,000,179 | 3,167,611 | `STATE_LIMIT` |
| 8801212 | r1/hard | `GUARANTEED_SOLVABLE_PRE_CHEST` | 5.700 s / 5.117 s | 875,737 | 3,129,445 | none |
| 8801214 | r1/hard | `PROVED_UNSOLVABLE_PRE_CHEST` | 0.991 s / 0.951 s | 178,433 | 682,024 | none |
| 8802000 | r2/easy | `POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST` | 3.578 s / 3.381 s | 435,296 | 3,000,597 | none |

Shortest existential witnesses are stored per environment for every case where one was found. The two proved-unsolvable cases correctly have no witness.

## Aggregate profile

Each environment produced the same logical aggregate:

- states discovered: 9,174,826;
- states processed: 8,814,125;
- transitions: 51,145,445;
- existential attractor states: 7,601,868;
- guaranteed attractor states: 2,197,793;
- peak frontier: 107,986;
- estimated peak solver memory: 150,112,560 bytes (143.16 MiB);
- process timeouts: 0;
- state-limited cases: 7.

Total campaign runtime was 57.721 s for hash environment `1` and 54.756 s for hash environment `997`, 112.478 s combined. Timing and memory are diagnostic; the deterministic gate compares logical fields and complete witnesses.

## Regression evidence

- Packed/reference encoding, successor sets, and attractors: passed.
- Runtime transition support and controlled solver fixtures: passed in both full runs.
- Sentinel lab/runtime equivalence: 36 maps and 651 states, zero divergences; feint and distinct-role gates passed.
- Lint: passed (`npm.cmd run lint`).
- Typecheck: passed (`npx.cmd tsc --noEmit`).
- Build: not run because no file consumed by the Next.js build changed.
- Production code delta: zero files.
- Babylon lighting contract: unchanged; the scene still declares exactly three lights.

The giant generation, Pickaxe, Second Chance, static/dynamic solvability, and map campaigns were not repeated because their production inputs did not change. The exact successor/attractor gate and Sentinel runtime equivalence cover the changed tooling boundary without reopening protected gameplay contracts.

## Evidence index

- `resource-bound-closeout.json`: hard closeout gate, aggregate metrics, per-seed fingerprints, and both durations.
- `hash-1/` and `hash-997/`: isolated complete reports and witnesses.
- `solver-encoding-equivalence.json`: representation, successor-set, and attractor equivalence.
- `solver-performance.json`: instrumented reference/packed profile.
- `regressions/`: Sentinel runtime equivalence, feint, and role evidence.
- `smoke/`: 5,000-state schema/runner smoke performed before the final full campaigns.

## Remaining follow-ups

The following balance observations remain outside this mission and were not modified:

- Route 2/hard: 0 wins and 19 timeouts in 20 runs;
- Route 3/easy: 1 win and 15 timeouts;
- Route 3/hard: 3 wins and 16 timeouts.

A future investigation may raise the resource bound or use deterministic checkpoint/resume to obtain definitive classifications for the seven `STATE_LIMIT` cases. That is not required to close execution of this prescribed resource-bound campaign and must not be represented as a current solvability proof.
